// PaperWar Capture Bridge — content script
// Runs in the MAIN world (same window as the userscript) so that:
// - window.__pwBridgeReady is directly visible to the userscript
// - window.postMessage events are on the same window object
// No script tag injection needed.

// Signal to the userscript that the bridge is active.
window.__pwBridgeReady = true;

window.addEventListener('message', (event) => {
  if (event.source !== window) return;
  if (!event.data || event.data.type !== 'PW_CAPTURE_POST') return;

  const { endpoint, payload } = event.data;
  if (!endpoint || !payload) return;

  // NOTE: Running in MAIN world means chrome.runtime is NOT available here.
  // We relay via a CustomEvent to a thin isolated-world relay script.
  window.dispatchEvent(
    new CustomEvent('__pwRelay', { detail: { endpoint, payload } })
  );
});

console.log('[PW-Bridge] content script ready (MAIN world).');
