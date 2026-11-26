// Apply Copilot — form filler.
// Matches fields by label / name / placeholder / aria-label and writes values
// with native setters so React and Angular forms register the change.
// This file never clicks a submit control. That is deliberate.

(() => {
  const FIELD_MAP = [
    { key: 'fullName', re: /(full[\s_-]?name|^name$|your name|candidate name)/i },
    { key: 'firstName', re: /(first[\s_-]?name|given[\s_-]?name|fname)/i },
    { key: 'lastName', re: /(last[\s_-]?name|surname|family[\s_-]?name|lname)/i },
    { key: 'email', re: /(e-?mail)/i },
    { key: 'phone', re: /(phone|mobile|contact number|telephone)/i },
    { key: 'location', re: /(current (city|location)|city|location|based in)/i },
    { key: 'linkedin', re: /(linked ?in)/i },
    { key: 'github', re: /(git ?hub)/i },
    { key: 'portfolio', re: /(portfolio|personal (site|website)|website|other url)/i },
    { key: 'currentCompany', re: /(current (employer|company)|present company)/i },
    { key: 'currentTitle', re: /(current (title|role|designation)|job title)/i },
    { key: 'totalExperience', re: /(total experience|years of experience|experience \(years\)|yrs? exp)/i },
    { key: 'noticePeriod', re: /(notice period|availability to join|when can you (start|join))/i },
    { key: 'currentCtc', re: /(current (ctc|salary|compensation))/i },
    { key: 'expectedCtc', re: /(expected (ctc|salary|compensation)|salary expectation)/i },
    { key: 'coverLetter', re: /(cover letter|why do you want|tell us about|additional information|anything else)/i },
    { key: 'workAuth', re: /(work authoriz|authorized to work|require sponsor|visa status)/i },
  ];

  function labelFor(el) {
    const bits = [];
    if (el.id) {
      const lab = document.querySelector(`label[for="${CSS.escape(el.id)}"]`);
      if (lab) bits.push(lab.innerText);
    }
    const wrap = el.closest('label');
    if (wrap) bits.push(wrap.innerText);
    const labelled = el.getAttribute('aria-labelledby');
    if (labelled) {
      labelled.split(/\s+/).forEach((id) => {
        const n = document.getElementById(id);
        if (n) bits.push(n.innerText);
      });
    }
    bits.push(el.getAttribute('aria-label') || '', el.name || '', el.id || '', el.placeholder || '');
    const group = el.closest('.field, .form-group, [class*="field"], [class*="question"]');
    if (group) bits.push(group.innerText.slice(0, 160));
    return bits.join(' | ').replace(/\s+/g, ' ').trim();
  }

  function setNative(el, value) {
    const proto = el instanceof HTMLTextAreaElement ? HTMLTextAreaElement : HTMLInputElement;
    const setter = Object.getOwnPropertyDescriptor(proto.prototype, 'value')?.set;
    if (setter) setter.call(el, value);
    else el.value = value;
    el.dispatchEvent(new Event('input', { bubbles: true }));
    el.dispatchEvent(new Event('change', { bubbles: true }));
    el.dispatchEvent(new Event('blur', { bubbles: true }));
  }

  function setSelect(el, value) {
    const want = String(value).toLowerCase();
    const hit = [...el.options].find(
      (o) => o.text.toLowerCase().includes(want) || want.includes(o.text.toLowerCase().trim())
    );
    if (!hit) return false;
    el.value = hit.value;
    el.dispatchEvent(new Event('change', { bubbles: true }));
    return true;
  }

  function flash(el, ok) {
    const prev = el.style.outline;
    el.style.outline = ok ? '2px solid #1F7A5C' : '2px dashed #C08A00';
    el.style.outlineOffset = '1px';
    setTimeout(() => {
      el.style.outline = prev;
    }, 2600);
  }

  window.__copilotFill = function fill(profile) {
    const fields = [...document.querySelectorAll('input, textarea, select')].filter((el) => {
      if (el.disabled || el.readOnly) return false;
      if (['hidden', 'submit', 'button', 'file', 'password'].includes(el.type)) return false;
      const box = el.getBoundingClientRect();
      return box.width > 0 && box.height > 0;
    });

    const filled = [];
    const skipped = [];
    const used = new Set();

    for (const el of fields) {
      const hay = labelFor(el);
      if (!hay) continue;
      const match = FIELD_MAP.find((f) => f.re.test(hay) && profile[f.key]);
      if (!match) {
        if (/resume|cv|upload/i.test(hay)) skipped.push({ label: hay.split('|')[0].slice(0, 60), why: 'file upload' });
        continue;
      }
      if (el.value && el.value.trim().length > 0 && !used.has(el)) {
        skipped.push({ label: match.key, why: 'already filled' });
        continue;
      }
      const value = profile[match.key];
      let ok = true;
      if (el.tagName === 'SELECT') ok = setSelect(el, value);
      else setNative(el, value);
      used.add(el);
      flash(el, ok);
      (ok ? filled : skipped).push(ok ? { label: match.key, value: String(value).slice(0, 40) } : { label: match.key, why: 'no matching option' });
    }

    const hasUpload = !!document.querySelector('input[type="file"]');
    return { filled, skipped, hasUpload, total: fields.length };
  };
})();
