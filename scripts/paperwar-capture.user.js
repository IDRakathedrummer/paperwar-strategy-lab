// ==UserScript==
// @name         PaperWar Strategy Lab - Auto Capture
// @namespace    paperwar-strategy-lab
// @version      3.0
// @description  Full match recorder: real DOM selectors + click-intercepted build/transport events
// @author       paperwar-strategy-lab
// @match        http://paper.hosted-by-fern.host:*/*
// @icon         https://www.google.com/s2/favicons?sz=64&domain=hosted-by-fern.host
// @grant        none
// @run-at       document-idle
// ==/UserScript==

(function () {
  'use strict';

  const API = 'http://localhost:8000';
  const POLL_MS = 2000;
  const SNAP_EVERY = 10000;

  // ─── STATE ────────────────────────────────────────────────────────────────
  let matchId = null;
  let lastPhase = null;
  let eventBuffer = [];
  let prevInk = null;
  let prevTech = null;
  let lastSnapshotAt = 0;
  let startTs = null;

  function relT() { return startTs ? ((Date.now() - startTs) / 1000) : 0; }

  // ─── BRIDGE DETECTION ──────────────────────────────────────────────────────
  setTimeout(() => {
    if (!window.__pwBridgeReady) {
      console.warn(
        '[PW-Capture] Bridge extension not detected. ' +
        'Load extension/ in chrome://extensions (Developer mode) ' +
        'to enable backend communication.'
      );
    }
  }, 2000);

  // ─── DOM READERS ───────────────────────────────────────────────────────────
  function txt(sel) { const e = document.querySelector(sel); return e ? e.innerText.trim() : null; }
  function all(sel) { return [...document.querySelectorAll(sel)].map(e => e.innerText.trim()); }

  function getInk() {
    const raw = txt('.ink');
    return raw ? parseInt(raw.replace(/[^0-9]/g, ''), 10) : null;
  }

  function getOwnedTech() {
    return {
      owned:  all('.technode.owned .tn-nm'),
      poor:   all('.technode.poor .tn-nm'),
      locked: all('.technode.locked .tn-nm'),
    };
  }

  function getUnits() { return all('.card').slice(0, 20); }

  function getHP() {
    return [...document.querySelectorAll('.hpbar')]
      .map(el => {
        const inner = el.querySelector('*');
        return inner ? (inner.style.width || inner.getAttribute('data-pct')) : null;
      })
      .filter(Boolean);
  }

  function getAmmo() { return all('.aminkrow'); }

  // ─── PHASE DETECTION ──────────────────────────────────────────────────────
  // The result overlay keeps .hpbar in the DOM, so we must check for the
  // result screen FIRST before the match condition, using the unique
  // "BATTLE CONCLUDED" text that only appears on the end screen.
  function isBattleConcluded() {
    return document.body.innerText.includes('BATTLE CONCLUDED');
  }

  function getPhase() {
    if (isBattleConcluded())                                     return 'result';
    if (document.querySelector('.hpbar') && getInk() !== null)  return 'match';
    if (document.querySelector('.lob-actions'))                  return 'lobby';
    if (document.querySelector('.screen'))                       return 'menu';
    return 'unknown';
  }

  function getResult() {
    // Find the big outcome word: DEFEAT, VICTORY, DRAW, etc.
    // It's the largest/most prominent text on the result overlay.
    const outcomeEl = [...document.querySelectorAll('*')].find(el =>
      el.children.length === 0 &&
      /^(DEFEAT|VICTORY|DRAW|WIN|LOSS)$/i.test((el.innerText || '').trim())
    );
    const outcome = outcomeEl ? outcomeEl.innerText.trim() : null;

    // Grab the stats paragraph ("Your team's Commanders were destroyed. Time...").
    const statsEl = [...document.querySelectorAll('*')].find(el =>
      el.children.length === 0 &&
      /commanders|destroyed|time \d/i.test((el.innerText || '').trim())
    );
    const stats = statsEl ? statsEl.innerText.trim() : null;

    return { head: outcome, label: stats, sub: null };
  }

  function getLobbyConfig() {
    return {
      seed:    txt('.seedin'),
      pills:   all('.pillrow.mtpills .cs-val'),
      cfgSecs: all('.cfgsec-hd'),
    };
  }

  // ─── API TRANSPORT ────────────────────────────────────────────────────────
  function post(endpoint, payload) {
    window.postMessage(
      { type: 'PW_CAPTURE_POST', endpoint, payload },
      '*'
    );
  }

  // ─── EVENT HELPERS ────────────────────────────────────────────────────────
  function recordEvent(type, data = {}) {
    if (!matchId) return;
    const ev = { t: Math.round(relT()), type, ...data };
    eventBuffer.push(ev);
    post('/api/events/', { match_id: matchId, ...ev });
  }

  // ─── LIFECYCLE ────────────────────────────────────────────────────────────
  function onMatchStart(config) {
    matchId = `match_${Date.now()}`;
    startTs = Date.now();
    eventBuffer = [];
    lastSnapshotAt = 0;

    console.log('[PW-Capture] Match START:', matchId);
    post('/api/matches/start', { match_id: matchId, timestamp: startTs, config });

    const ink  = getInk();
    const tech = getOwnedTech();
    prevInk  = ink;
    prevTech = tech;
    recordEvent('match_start_snapshot', { ink, tech, units: getUnits(), hp: getHP(), ammo: getAmmo() });

    document.addEventListener('click', onDocumentClick, true);
  }

  function onMatchEnd(result) {
    if (!matchId) return;
    document.removeEventListener('click', onDocumentClick, true);

    recordEvent('match_end_snapshot', { ink: getInk(), tech: getOwnedTech(), units: getUnits(), hp: getHP(), ammo: getAmmo() });

    console.log('[PW-Capture] Match END:', result);
    post('/api/matches/end', {
      match_id:  matchId,
      timestamp: Date.now(),
      result:    result || { head: 'unknown', label: null, sub: null },
      events:    eventBuffer,
    });

    matchId = null;
    startTs = null;
    eventBuffer = [];
    prevInk = prevTech = null;
    lastSnapshotAt = 0;
  }

  // ─── CLICK INTERCEPTOR ────────────────────────────────────────────────────
  function onDocumentClick(e) {
    const btn = e.target.closest(
      'button, [class*="btn"], .technode, [class*="unit"], ' +
      '[class*="structure"], [class*="transport"], [class*="produce"]'
    );
    if (!btn) return;

    const label = (btn.innerText || btn.title || btn.getAttribute('aria-label') || '')
      .trim().replace(/\s+/g, ' ').slice(0, 64);
    if (!label) return;

    const sig = (btn.className || '') + ' ' + label;
    let type = 'ui_click';
    if (/unlock|technode/i.test(sig))                                      type = 'tech_unlock';
    else if (/transport|load|drop|carrier|naval/i.test(sig))               type = 'transport';
    else if (/build|produce|queue|spawn|place|airport|factory/i.test(sig)) type = 'build';

    if (type !== 'tech_unlock') recordEvent(type, { entity: label });
    else                        recordEvent(type, { entity: label, via: 'click' });
  }

  // ─── POLL LOOP ────────────────────────────────────────────────────────────
  function poll() {
    const phase = getPhase();

    if (phase !== lastPhase) {
      console.log(`[PW-Capture] Phase: ${lastPhase} → ${phase}`);
      if (phase === 'match' && !matchId)              onMatchStart(getLobbyConfig());
      if (phase === 'result' && lastPhase === 'match') onMatchEnd(getResult());
      lastPhase = phase;
    }

    if (phase === 'match' && matchId) {
      const ink  = getInk();
      const tech = getOwnedTech();

      if (ink !== null && ink !== prevInk) {
        recordEvent('ink_change', { ink, prev: prevInk });
        prevInk = ink;
      }

      if (prevTech) {
        const newUnlocks = tech.owned.filter(t => !prevTech.owned.includes(t));
        newUnlocks.forEach(name => recordEvent('tech_unlock', { name, via: 'poll' }));
      }
      prevTech = tech;

      if (Date.now() - lastSnapshotAt >= SNAP_EVERY) {
        recordEvent('snapshot', { ink, tech, units: getUnits(), hp: getHP(), ammo: getAmmo() });
        lastSnapshotAt = Date.now();
      }
    }
  }

  setInterval(poll, POLL_MS);
  console.log('[PW-Capture] v3.0 loaded. Backend:', API);

  // ─── STATUS BADGE ─────────────────────────────────────────────────────────
  const badge = document.createElement('div');
  badge.style.cssText = 'position:fixed;bottom:12px;right:12px;z-index:99999;'
    + 'background:rgba(0,0,0,0.72);color:#fff;font:11px/1.2 monospace;'
    + 'padding:5px 9px;border-radius:5px;user-select:none;'
    + 'display:flex;gap:6px;align-items:center;';
  const dot = document.createElement('span');
  const lbl = document.createElement('span');
  badge.append(dot, lbl);
  function refreshBadge() {
    const cols = { lobby: '#888', match: '#4caf50', result: '#ff9800', menu: '#555', unknown: '#555' };
    dot.style.color = cols[lastPhase] || '#888';
    dot.textContent = '●';
    lbl.textContent = lastPhase === 'match'
      ? `REC ${(matchId || '').slice(-8)} · ${eventBuffer.length} ev`
      : `[${lastPhase || 'init'}]`;
  }
  document.body.appendChild(badge);
  setInterval(refreshBadge, 800);

})();
