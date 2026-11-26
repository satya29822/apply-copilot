// Apply Copilot — service worker.
// Owns the side panel lifecycle and relays panel <-> content-script messages.

chrome.runtime.onInstalled.addListener(() => {
  chrome.sidePanel
    .setPanelBehavior({ openPanelOnActionClick: true })
    .catch((err) => console.warn('[copilot] side panel behavior', err));
});

async function activeTab() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  return tab;
}

// Content scripts are declared in the manifest, but a page loaded before the
// extension was installed/reloaded has no script in it. Inject on demand.
async function ensureContentScript(tabId) {
  try {
    await chrome.tabs.sendMessage(tabId, { type: 'PING' });
    return true;
  } catch {
    try {
      await chrome.scripting.executeScript({
        target: { tabId },
        files: ['content/parser.js', 'content/filler.js', 'content/main.js'],
      });
      return true;
    } catch (err) {
      console.warn('[copilot] inject failed', err);
      return false;
    }
  }
}

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (msg?.type !== 'TO_PAGE') return;

  (async () => {
    const tab = await activeTab();
    if (!tab?.id) {
      sendResponse({ ok: false, error: 'No active tab.' });
      return;
    }
    if (/^(chrome|edge|about|chrome-extension):/.test(tab.url || '')) {
      sendResponse({ ok: false, error: 'Copilot can\u2019t read browser pages. Open a job posting first.' });
      return;
    }
    const ready = await ensureContentScript(tab.id);
    if (!ready) {
      sendResponse({ ok: false, error: 'This page blocks extensions. Try reloading it.' });
      return;
    }
    try {
      const result = await chrome.tabs.sendMessage(tab.id, msg.payload);
      sendResponse({ ok: true, result, url: tab.url, title: tab.title });
    } catch (err) {
      sendResponse({ ok: false, error: String(err?.message || err) });
    }
  })();

  return true; // keep the channel open for the async reply
});
