// PaperWar Capture Bridge — background service worker
// Receives relay requests from the content script and performs the
// actual fetch() to localhost:8000. Extension origins are treated as
// secure contexts by Chrome, so Private Network Access is not blocked.

const API = 'http://localhost:8000';

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type !== 'PW_FETCH') return false;

  const { endpoint, payload } = message;

  fetch(API + endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })
    .then(async (res) => {
      if (!res.ok) {
        const text = await res.text();
        console.warn('[PW-Bridge] HTTP', res.status, endpoint, text);
        sendResponse({ ok: false, status: res.status, text });
      } else {
        sendResponse({ ok: true, status: res.status });
      }
    })
    .catch((err) => {
      console.warn('[PW-Bridge] fetch failed:', endpoint, err.message);
      sendResponse({ ok: false, error: err.message });
    });

  // Return true to keep the message channel open for the async response.
  return true;
});

console.log('[PW-Bridge] background service worker ready.');
