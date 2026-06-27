// PaperWar Capture Bridge — content script
// Runs in the game page context. Listens for postMessage events from
// the userscript and forwards them to the background service worker,
// which does the actual fetch() to localhost:8000.

// Signal to the userscript that the bridge extension is active.
// This suppresses the "Bridge extension not detected" console warning.
window.__pwBridgeReady = true;

window.addEventListener('message', (event) => {
  // Only handle messages from this page, with our sentinel type.
  if (event.source !== window) return;
  if (!event.data || event.data.type !== 'PW_CAPTURE_POST') return;

  const { endpoint, payload } = event.data;
  if (!endpoint || !payload) return;

  chrome.runtime.sendMessage(
    { type: 'PW_FETCH', endpoint, payload },
    (response) => {
      if (chrome.runtime.lastError) {
        console.warn('[PW-Bridge] sendMessage error:', chrome.runtime.lastError.message);
      }
    }
  );
});

console.log('[PW-Bridge] content script ready.');
