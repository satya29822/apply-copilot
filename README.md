# Apply Copilot

A Chrome MV3 side-panel extension that reads a job posting, scores it against your resume, and fills the application form. It stops at Submit — you press that.

## Install

1. Unzip the folder somewhere permanent (don't delete it after loading).
2. Chrome → `chrome://extensions` → turn on **Developer mode**.
3. **Load unpacked** → select the `jobcopilot` folder.
4. Pin it, click the icon to open the side panel.
5. Go to **Profile**, fill it in, save. The skills box drives the score — put in everything real, comma separated.

## Use

- Open a posting → **Read this posting** → you get a 0–100 fit score, the skills you have, the ones that are close enough, and the gaps. Gaps the posting lists as must-haves are outlined in red.
- Open the application form → **Fill the form**. Filled fields flash green. Resume upload stays manual (browsers block extensions from setting file inputs, by design).
- **Save to tracker** → status dropdown per application, CSV export.

## What it parses

JSON-LD `JobPosting` first, then site-specific selectors for LinkedIn, Naukri, Indeed, Greenhouse, Lever, Ashby, Wellfound, and Workday, then a generic text-block fallback. Anything else still works via the fallback, just less cleanly.

## Notes

- Everything is local. `chrome.storage.local` only — no server, no network calls, no posting text leaving the browser.
- Selectors on LinkedIn and Naukri change every few months. When a site stops parsing cleanly, update `content/parser.js` → `SITE_RULES`; the JSON-LD path and the fallback keep it working meanwhile.
- Deliberately no auto-submit and no bulk apply. Automated submission gets accounts flagged on the major boards, and untailored applications convert badly enough that volume doesn't make up for it.

## Extending it

- **Better scoring**: `sidepanel/matcher.js` is keyword-based. Swapping `scoreJob` for an LLM call would catch phrasing the lexicon misses.
- **Per-role cover letters**: the `coverLetter` profile field is static. Generating it from the parsed JD is the obvious next step.
- **New fields**: add a `{ key, re }` entry to `FIELD_MAP` in `content/filler.js` and a matching input in `panel.html`.
