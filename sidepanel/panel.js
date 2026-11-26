import { scoreJob } from './matcher.js';

const $ = (id) => document.getElementById(id);
const STATUSES = ['Saved', 'Applied', 'Screening', 'Interviewing', 'Offer', 'Rejected'];

let profile = {};
let tracked = [];
let current = null; // { job, match }

/* ---------- storage ---------- */

async function load() {
  const data = await chrome.storage.local.get(['profile', 'tracked']);
  profile = data.profile || {};
  tracked = data.tracked || [];
}

const saveProfile = () => chrome.storage.local.set({ profile });
const saveTracked = () => chrome.storage.local.set({ tracked });

/* ---------- page bridge ---------- */

function toPage(payload) {
  return new Promise((resolve) => {
    chrome.runtime.sendMessage({ type: 'TO_PAGE', payload }, resolve);
  });
}

/* ---------- match view ---------- */

function chip(text, cls) {
  const el = document.createElement('span');
  el.className = `chip ${cls}`;
  el.textContent = text;
  return el;
}

function renderChips(box, label, items, cls, critical = []) {
  box.replaceChildren();
  if (!items.length) return;
  const head = document.createElement('span');
  head.className = 'chips__label';
  head.textContent = `${label} (${items.length})`;
  box.append(head);
  items.forEach((s) => box.append(chip(s, critical.includes(s) ? `${cls} chip--critical` : cls)));
}

function renderMatch() {
  const { job, match } = current;
  $('matchResult').hidden = false;
  $('jobTitle').textContent = job.title;
  $('jobCompany').textContent = [job.company, job.location].filter(Boolean).join(' \u00b7 ');

  $('scoreNum').textContent = match.score;
  requestAnimationFrame(() => {
    $('scoreMark').style.width = `${Math.max(12, match.score * 0.62)}px`;
  });
  $('verdict').textContent = match.verdict;
  $('askedCount').textContent = `${match.matched.length}/${match.askedCount} skills in the posting`;

  const yn = $('yearsNote');
  yn.hidden = !match.yearsNote;
  yn.textContent = match.yearsNote || '';

  renderChips($('matchedChips'), 'You have', match.matched, 'chip--have');
  renderChips($('coveredChips'), 'Close enough', match.covered, 'chip--near');
  renderChips($('missingChips'), 'Not on your resume', match.missing, 'chip--gap', match.criticalGaps);
  $('fillReport').textContent = '';
}

async function readPosting() {
  const btn = $('readBtn');
  btn.disabled = true;
  btn.textContent = 'Reading\u2026';
  const hint = $('matchHint');
  hint.className = 'hint';

  const res = await toPage({ action: 'PARSE' });
  btn.disabled = false;
  btn.textContent = 'Read this posting';

  if (!res?.ok) {
    hint.className = 'hint error';
    hint.textContent = res?.error || 'Could not read this page.';
    return;
  }
  const job = res.result;
  if (!job.body || job.body.length < 200) {
    hint.className = 'hint error';
    hint.textContent = 'Found very little text here. Is the full posting open?';
    return;
  }
  if (!profile.skills?.length) {
    hint.className = 'hint error';
    hint.textContent = 'Add your skills under Profile first \u2014 the score needs them.';
  } else {
    hint.textContent = `Parsed from ${job.source}.`;
  }

  current = { job, match: scoreJob(job.body, profile) };
  renderMatch();
}

async function fillForm() {
  const btn = $('fillBtn');
  btn.disabled = true;
  btn.textContent = 'Filling\u2026';
  const res = await toPage({ action: 'FILL', profile });
  btn.disabled = false;
  btn.textContent = 'Fill the form';

  const out = $('fillReport');
  if (!res?.ok) {
    out.className = 'hint error';
    out.textContent = res?.error || 'Fill failed.';
    return;
  }
  const { filled, hasUpload } = res.result;
  out.className = 'hint';
  if (!filled.length) {
    out.textContent = 'No matching fields on this page. Open the application form and try again.';
    return;
  }
  const parts = [`Filled ${filled.length} field${filled.length === 1 ? '' : 's'}: ${filled.map((f) => f.label).join(', ')}.`];
  if (hasUpload) parts.push('Attach your resume yourself \u2014 file inputs can\u2019t be set by an extension.');
  parts.push('Check everything, then press Submit on the page.');
  out.textContent = parts.join(' ');
}

/* ---------- tracker ---------- */

function saveCurrent() {
  if (!current) return;
  const { job, match } = current;
  if (tracked.some((t) => t.url === job.url)) {
    $('fillReport').textContent = 'Already in your tracker.';
    return;
  }
  tracked.unshift({
    id: crypto.randomUUID(),
    title: job.title,
    company: job.company,
    url: job.url,
    score: match.score,
    gaps: match.criticalGaps,
    status: 'Saved',
    date: new Date().toISOString().slice(0, 10),
  });
  saveTracked();
  renderTracker();
  $('fillReport').textContent = 'Saved to tracker.';
}

function renderTracker() {
  const list = $('trackerList');
  list.replaceChildren();
  $('trackerCount').textContent = tracked.length;
  $('trackerEmpty').hidden = tracked.length > 0;

  tracked.forEach((t) => {
    const li = document.createElement('li');
    li.className = 'item';

    const top = document.createElement('div');
    top.className = 'item__top';
    const title = document.createElement('span');
    title.className = 'item__title';
    title.textContent = t.title;
    const score = document.createElement('span');
    score.className = 'item__score';
    score.textContent = t.score;
    top.append(title, score);

    const meta = document.createElement('div');
    meta.className = 'item__meta';
    meta.textContent = `${t.company} \u00b7 ${t.date}${t.gaps?.length ? ` \u00b7 gap: ${t.gaps.join(', ')}` : ''}`;

    const row = document.createElement('div');
    row.className = 'item__row';
    const sel = document.createElement('select');
    STATUSES.forEach((s) => {
      const o = document.createElement('option');
      o.value = s;
      o.textContent = s;
      if (s === t.status) o.selected = true;
      sel.append(o);
    });
    sel.addEventListener('change', () => {
      t.status = sel.value;
      saveTracked();
    });
    const link = document.createElement('a');
    link.href = t.url;
    link.target = '_blank';
    link.rel = 'noreferrer';
    link.textContent = 'Open';
    const del = document.createElement('button');
    del.className = 'del';
    del.textContent = 'Remove';
    del.addEventListener('click', () => {
      tracked = tracked.filter((x) => x.id !== t.id);
      saveTracked();
      renderTracker();
    });
    row.append(sel, link, del);

    li.append(top, meta, row);
    list.append(li);
  });
}

function exportCsv() {
  if (!tracked.length) return;
  const cell = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;
  const rows = [
    ['Date', 'Title', 'Company', 'Score', 'Status', 'Gaps', 'URL'],
    ...tracked.map((t) => [t.date, t.title, t.company, t.score, t.status, (t.gaps || []).join('; '), t.url]),
  ];
  const blob = new Blob([rows.map((r) => r.map(cell).join(',')).join('\n')], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `applications-${new Date().toISOString().slice(0, 10)}.csv`;
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
}

/* ---------- profile ---------- */

function fillProfileForm() {
  const form = $('profileForm');
  Object.entries(profile).forEach(([k, v]) => {
    if (form.elements[k]) form.elements[k].value = v;
  });
  form.elements.skillsRaw.value = (profile.skills || []).join(', ');
}

function handleProfileSubmit(e) {
  e.preventDefault();
  const data = Object.fromEntries(new FormData(e.target).entries());
  data.skills = (data.skillsRaw || '')
    .split(',')
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
  delete data.skillsRaw;
  if (!data.fullName && (data.firstName || data.lastName)) {
    data.fullName = `${data.firstName} ${data.lastName}`.trim();
  }
  profile = data;
  saveProfile();
  const flag = $('savedFlag');
  flag.hidden = false;
  setTimeout(() => (flag.hidden = true), 1800);
  if (current) {
    current.match = scoreJob(current.job.body, profile);
    renderMatch();
  }
}

/* ---------- wiring ---------- */

document.querySelectorAll('.tab').forEach((tab) => {
  tab.addEventListener('click', () => {
    document.querySelectorAll('.tab').forEach((t) => t.classList.toggle('is-current', t === tab));
    document.querySelectorAll('.view').forEach((v) => {
      v.classList.toggle('is-current', v.id === `view-${tab.dataset.view}`);
    });
  });
});

$('readBtn').addEventListener('click', readPosting);
$('fillBtn').addEventListener('click', fillForm);
$('saveBtn').addEventListener('click', saveCurrent);
$('exportBtn').addEventListener('click', exportCsv);
$('clearBtn').addEventListener('click', () => {
  if (!tracked.length) return;
  tracked = [];
  saveTracked();
  renderTracker();
});
$('profileForm').addEventListener('submit', handleProfileSubmit);

load().then(() => {
  fillProfileForm();
  renderTracker();
});
