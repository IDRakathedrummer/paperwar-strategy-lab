// PaperWar Capture Bridge — content script
// Runs in the game page context. Listens for postMessage events from
// the userscript and forwards them to the background service worker,
// which does the actual fetch() to localhost:8000.

// Inject a flag into the PAGE's JS world (not the extension isolated world)
// so the userscript can read window.__pwBridgeReady.
const flagScript = document.createElement('script');
flagScript.textContent = 'window.__pwBridgeReady = true;';
(document.head || document.documentElement).appendChild(flagScript);
flagScript.remove();

window.addEventListener('message', (event) => {
  // Only handle messages from this page, with our sentinel type.
  if (event.source !== window) return;
  if (!event.data || event.data.type !== 'PW_CAPTURE_POST') return;

  const { endpoint, payload } = event.data;
  if (!endpoint || !payload) return;

  // Guard against "Extension context invalidated" — happens when the
  // extension is reloaded while the page stays open. The old content
  // script keeps running but its runtime connection is severed.
  // Fix: hard-reload the game page after reloading the extension.
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

console.log('[PW-Bridge] content script ready.');
