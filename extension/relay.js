// PaperWar Capture Bridge — relay script (isolated world)
// Runs in the default ISOLATED world so chrome.runtime is available.
// Listens for CustomEvents dispatched by the MAIN-world content.js
// and forwards them to the background service worker via sendMessage.

window.addEventListener('__pwRelay', (event) => {
  const { endpoint, payload } = event.detail;

  if (!chrome.runtime?.id) {
    console.warn('[PW-Bridge] Extension context invalidated. Hard-reload the page.');
    return;
  }

  try {
    chrome.runtime.sendMessage(
      { type: 'PW_FETCH', endpoint, payload },
      (response) => {
        if (chrome.runtime.lastError) {
          console.warn('[PW-Bridge] sendMessage error:', chrome.runtime.lastError.message);
        }
      }
    );
  } catch (err) {
    console.warn('[PW-Bridge] sendMessage threw:', err.message);
  }
});

console.log('[PW-Bridge] relay script ready (isolated world).');
