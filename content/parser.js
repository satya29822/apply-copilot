// Apply Copilot — posting parser.
// Strategy: JSON-LD JobPosting first (most ATS platforms emit it), then
// per-site selectors, then a generic largest-text-block fallback.

(() => {
  const SITE_RULES = [
    {
      host: /linkedin\./,
      title: ['.job-details-jobs-unified-top-card__job-title', '.top-card-layout__title', 'h1'],
      company: ['.job-details-jobs-unified-top-card__company-name', '.topcard__org-name-link'],
      body: ['.jobs-description__content', '.description__text', '#job-details'],
    },
    {
      host: /naukri\./,
      title: ['.styles_jd-header-title__rZwM1', 'h1'],
      company: ['.styles_jd-header-comp-name__MvqAI a', '.jd-header-comp-name'],
      body: ['.styles_JDC__dang-inner-html__h0K4t', '.job-desc', '.dang-inner-html'],
    },
    {
      host: /indeed\./,
      title: ['h1.jobsearch-JobInfoHeader-title', '[data-testid="jobsearch-JobInfoHeader-title"]', 'h1'],
      company: ['[data-testid="inlineHeader-companyName"]', '[data-company-name]'],
      body: ['#jobDescriptionText', '.jobsearch-JobComponent-description'],
    },
    {
      host: /greenhouse\.io|boards\.greenhouse/,
      title: ['.app-title', 'h1.section-header', 'h1'],
      company: ['.company-name', '#header .company-name'],
      body: ['#content', '.job__description', '#job_description'],
    },
    {
      host: /lever\.co/,
      title: ['.posting-headline h2', 'h2'],
      company: ['.main-header-logo img', '.posting-categories'],
      body: ['.section-wrapper.page-full-width', '[data-qa="job-description"]'],
    },
    {
      host: /ashbyhq\.com/,
      title: ['h1', '[class*="_title"]'],
      company: ['[class*="_companyName"]'],
      body: ['[class*="_description"]', '#overview'],
    },
    {
      host: /wellfound\.com|angel\.co/,
      title: ['h1', '[class*="job-title"]'],
      company: ['[class*="company-link"]', '[class*="startup-link"]'],
      body: ['[class*="job-description"]', '#job-description'],
    },
    {
      host: /myworkdayjobs\.com|workday/,
      title: ['[data-automation-id="jobPostingHeader"]', 'h1'],
      company: ['[data-automation-id="company"]'],
      body: ['[data-automation-id="jobPostingDescription"]'],
    },
  ];

  const pick = (selectors) => {
    for (const sel of selectors || []) {
      const el = document.querySelector(sel);
      const text = (el?.innerText || el?.getAttribute?.('alt') || '').trim();
      if (text.length > 1) return text;
    }
    return '';
  };

  function fromJsonLd() {
    const nodes = document.querySelectorAll('script[type="application/ld+json"]');
    for (const node of nodes) {
      let data;
      try {
        data = JSON.parse(node.textContent);
      } catch {
        continue;
      }
      const queue = Array.isArray(data) ? [...data] : [data];
      while (queue.length) {
        const item = queue.shift();
        if (!item || typeof item !== 'object') continue;
        if (Array.isArray(item['@graph'])) queue.push(...item['@graph']);
        if (item['@type'] === 'JobPosting' || (Array.isArray(item['@type']) && item['@type'].includes('JobPosting'))) {
          const html = item.description || '';
          const tmp = document.createElement('div');
          tmp.innerHTML = html;
          return {
            title: item.title || '',
            company: item.hiringOrganization?.name || '',
            location:
              item.jobLocation?.address?.addressLocality ||
              item.jobLocation?.[0]?.address?.addressLocality ||
              '',
            body: tmp.innerText.trim(),
            source: 'json-ld',
          };
        }
      }
    }
    return null;
  }

  function largestBlock() {
    let best = null;
    let bestLen = 0;
    document.querySelectorAll('main, article, section, div').forEach((el) => {
      if (el.children.length > 60) return;
      const len = (el.innerText || '').length;
      if (len > bestLen && len < 24000) {
        bestLen = len;
        best = el;
      }
    });
    return bestLen > 400 ? best.innerText.trim() : document.body.innerText.slice(0, 12000);
  }

  window.__copilotParse = function parse() {
    const rule = SITE_RULES.find((r) => r.host.test(location.hostname));
    const ld = fromJsonLd();

    const title = pick(rule?.title) || ld?.title || document.querySelector('h1')?.innerText?.trim() || document.title;
    const company =
      pick(rule?.company) ||
      ld?.company ||
      document.querySelector('meta[property="og:site_name"]')?.content ||
      location.hostname.replace(/^www\./, '');
    const body = pick(rule?.body) || ld?.body || largestBlock();

    return {
      title: title.slice(0, 200),
      company: company.slice(0, 120),
      location: ld?.location || '',
      body: body.slice(0, 20000),
      url: location.href,
      source: rule ? location.hostname : ld?.source || 'generic',
      capturedAt: Date.now(),
    };
  };
})();
