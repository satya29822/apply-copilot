// Apply Copilot — message router inside the page.

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  try {
    switch (msg?.action) {
      case 'PING':
        sendResponse({ pong: true });
        break;
      case 'PARSE':
        sendResponse(window.__copilotParse());
        break;
      case 'FILL':
        sendResponse(window.__copilotFill(msg.profile || {}));
        break;
      case 'COUNT_FIELDS': {
        const n = document.querySelectorAll('form input, form textarea, form select').length;
        sendResponse({ fields: n });
        break;
      }
      default:
        sendResponse({ error: 'Unknown action' });
    }
  } catch (err) {
    sendResponse({ error: String(err?.message || err) });
  }
  return true;
});
