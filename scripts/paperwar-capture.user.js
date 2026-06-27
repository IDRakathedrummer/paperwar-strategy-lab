// ==UserScript==
// @name         PaperWar Strategy Lab - Auto Capture
// @namespace    paperwar-strategy-lab
// @version      2.5
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

  // ─── DOM READERS ───────────────────────────────────────────────────────────
  function txt(sel) { const e = document.querySelector(sel); return e ? e.innerText.trim() : null; }
  function all(sel) { return [...document.querySelectorAll(sel)].map(e => e.innerText.trim()); }

  function getInk() {
    const raw = txt('.ink');
    return raw ? parseInt(raw.replace(/[^0-9]/g, ''), 10) : null;
  }

  function getOwnedTech() {
    return {
      owned: all('.technode.owned .tn-nm'),
      poor: all('.technode.poor .tn-nm'),
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
  // isVisible() was unreliable: the game wraps all sections in a display:none
  // ancestor, so every selector appeared hidden regardless of actual game state.
  // Instead, use pure querySelector presence checks. The getInk() !== null guard
  // on 'match' prevents false positives if .hpbar lingers during lobby/menu.
  function getPhase() {
    if (document.querySelector('.rc-head'))                              return 'result';
    if (document.querySelector('.lob-actions'))                         return 'lobby';
    if (document.querySelector('.hpbar') && getInk() !== null)         return 'match';
    if (document.querySelector('.screen'))                              return 'menu';
    return 'unknown';
  }

  function getResult() {
    const head = txt('.rc-head');
    const label = txt('.rc-label');
    const sub = txt('.rc-sub');
    return head ? { head, label, sub } : null;
  }

  function getLobbyConfig() {
    return {
      seed: txt('.seedin'),
      pills: all('.pillrow.mtpills .cs-val'),
      cfgSecs: all('.cfgsec-hd'),
    };
  }

  // ─── API TRANSPORT ────────────────────────────────────────────────────────
  function post(endpoint, data) {
    fetch(API + endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    })
    .then(res => {
      if (!res.ok) res.text().then(t => console.warn('[PW-Capture] HTTP', res.status, endpoint, t));
    })
    .catch(err => console.warn('[PW-Capture] POST failed:', endpoint, err));
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
    prevInk = null;
    prevTech = null;
    lastSnapshotAt = 0;

    console.log('[PW-Capture] Match START:', matchId);
    post('/api/matches/start', {
      match_id: matchId,
      timestamp: startTs,
      config,
    });

    document.addEventListener('click', onDocumentClick, true);
  }

  function onMatchEnd(result) {
    if (!matchId) return;
    document.removeEventListener('click', onDocumentClick, true);

    recordEvent('match_end_snapshot', {
      ink: getInk(),
      tech: getOwnedTech(),
      units: getUnits(),
      hp: getHP(),
      ammo: getAmmo(),
    });

    console.log('[PW-Capture] Match END:', result);
    post('/api/matches/end', {
      match_id: matchId,
      timestamp: Date.now(),
      result: result || { head: 'unknown', label: null, sub: null },
      events: eventBuffer,
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
    if (/unlock|technode/i.test(sig)) type = 'tech_unlock';
    else if (/transport|load|drop|carrier|naval/i.test(sig)) type = 'transport';
    else if (/build|produce|queue|spawn|place|airport|factory/i.test(sig)) type = 'build';

    if (type !== 'tech_unlock') recordEvent(type, { entity: label });
    else recordEvent(type, { entity: label, via: 'click' });
  }

  // ─── POLL LOOP ────────────────────────────────────────────────────────────
  function poll() {
    const phase = getPhase();

    if (phase !== lastPhase) {
      console.log(`[PW-Capture] Phase: ${lastPhase} → ${phase}`);
      if (phase === 'match' && lastPhase === 'lobby') onMatchStart(getLobbyConfig());
      if (phase === 'result' && lastPhase === 'match') onMatchEnd(getResult());
      lastPhase = phase;
    }

    if (phase === 'match' && matchId) {
      const ink = getInk();
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
  console.log('[PW-Capture] v2.5 loaded. Backend:', API);

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
