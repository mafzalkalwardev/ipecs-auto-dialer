/* ------------------------------------------------------------------
 * inject.js — runs on the calling website
 *
 * Responsibilities:
 *   1. Drive the dialpad (type a number, press call, hang up).
 *   2. Detect call state transitions and report them upstream.
 *   3. Render the draggable on-page "Dialer HUD".
 *
 * It holds NO queue state. The service worker owns the campaign; this
 * script is a pair of hands and a pair of eyes.
 * ------------------------------------------------------------------ */

(() => {
  'use strict';

  // Avoid double-wiring when background re-injects after Reload.
  if (window.__IPECS_AUTO_DIALER_INJECTED__) return;
  window.__IPECS_AUTO_DIALER_INJECTED__ = true;

  const POLL_MS = 400;

  let port = null;
  let watcher = null;
  let callState = 'idle';         // idle | dialing | connected | ended
  let callStartedAt = null;
  let lastSeenTimer = null;
  let sawLiveCall = false;         // true once in-call UI has appeared
  // iPECS can take several seconds before "Connected" + red hangup appear.
  const DIAL_UI_GRACE_MS = 15000;

  /* ================= messaging ================= */

  function extensionAlive() {
    try {
      return Boolean(chrome.runtime?.id);
    } catch (_) {
      return false;
    }
  }

  function connect() {
    // After an extension reload, old content scripts keep running but their
    // chrome.runtime binding is dead ("Extension context invalidated").
    if (!extensionAlive()) {
      stopWatching();
      return;
    }
    try {
      port = chrome.runtime.connect({ name: 'ipecs-content' });
      port.onMessage.addListener(handleCommand);
      port.onDisconnect.addListener(() => {
        port = null;
        if (!extensionAlive()) {
          stopWatching();
          return;
        }
        setTimeout(connect, 1000); // service worker recycled; reattach
      });
    } catch (_) {
      stopWatching();
    }
  }

  function send(type, payload = {}) {
    if (!extensionAlive() || !port) return;
    try { port.postMessage({ type, payload }); } catch (_) {}
  }

  async function handleCommand({ type, payload }) {
    switch (type) {
      case 'DIAL':
        await dial(payload.number).catch((err) =>
          send('DIAL_FAILED', { number: payload.number, reason: err.message })
        );
        break;
      case 'HANGUP':
        hangup();
        break;
      case 'HUD_UPDATE':
        renderHud(payload);
        break;
      case 'PING':
        send('PONG', { href: location.href });
        break;
    }
  }

  /* ================= dialpad control ================= */

  /**
   * The host page input is React-controlled: assigning `.value` directly
   * updates the DOM but never the React state, so the call button stays
   * disabled. We call the *native* value setter, which React's synthetic
   * event system does observe.
   */
  function setControlledValue(el, value) {
    const proto = el instanceof HTMLTextAreaElement
      ? HTMLTextAreaElement.prototype
      : HTMLInputElement.prototype;
    const setter = Object.getOwnPropertyDescriptor(proto, 'value').set;
    setter.call(el, value);
    el.dispatchEvent(new InputEvent('input', { bubbles: true, data: value, inputType: 'insertText' }));
    el.dispatchEvent(new Event('input', { bubbles: true }));
    el.dispatchEvent(new Event('change', { bubbles: true }));
  }

  /** Keep the LEFT dialpad usable when the column is tucked under the nav. */
  function revealLeftDialpad(el) {
    if (!el) return;
    try { el.scrollIntoView({ block: 'center', inline: 'nearest' }); } catch (_) {}
    let node = el;
    for (let i = 0; i < 10 && node; i++) {
      const r = node.getBoundingClientRect();
      if (r.width > 120 && r.x < 40) {
        // Nudge the dial column out from under the left rail.
        node.style.position = node.style.position || 'relative';
        node.style.left = '64px';
        node.style.zIndex = '20';
        break;
      }
      node = node.parentElement;
    }
  }

  async function clearDialField(el) {
    const clearBtn = IPECSSel.find('clearDial', { requireVisible: false });
    if (clearBtn) {
      for (let i = 0; i < 14; i++) clearBtn.click();
      await sleep(80);
    }
    try { el.focus(); } catch (_) {}
    try { el.select(); } catch (_) {}
    setControlledValue(el, '');
    try { document.execCommand('selectAll'); document.execCommand('delete'); } catch (_) {}
    setControlledValue(el, '');
    await sleep(60);
  }

  /**
   * Fill the LEFT dialpad textarea (confirmed on live iPECS DOM).
   */
  async function enterNumber(number) {
    const digits = String(number).replace(/[^\d*#]/g, '');
    if (!digits) throw new Error('No dialable digits in number');

    const input = IPECSSel.find('dialInput', { requireVisible: false });
    if (!input) throw new Error('Left dialpad field not found (textarea Search by name, number)');

    revealLeftDialpad(input);
    await clearDialField(input);

    try { input.focus(); } catch (_) {}
    setControlledValue(input, digits);
    try {
      document.execCommand('selectAll');
      document.execCommand('insertText', false, digits);
    } catch (_) {}
    setControlledValue(input, digits);
    await sleep(150);

    if ((input.value || '').replace(/\s/g, '') !== digits) {
      await clearDialField(input);
      for (const ch of digits) {
        const keyBtn = IPECSSel.dialKeyButton(ch);
        if (!keyBtn) continue;
        revealLeftDialpad(keyBtn);
        keyBtn.click();
        await sleep(40);
      }
    }

    const got = (input.value || '').replace(/\s/g, '');
    if (!got.includes(digits.slice(-4))) {
      throw new Error('Could not enter number into left dialpad — is the Calls dialpad visible?');
    }
    // Guard against stale leftover digits (wrong-number bug).
    if (got !== digits) {
      await clearDialField(input);
      setControlledValue(input, digits);
      try {
        document.execCommand('selectAll');
        document.execCommand('insertText', false, digits);
      } catch (_) {}
      setControlledValue(input, digits);
      await sleep(100);
    }
    if ((input.value || '').replace(/\s/g, '') !== digits) {
      throw new Error(`Dial field shows "${input.value}" but expected "${digits}"`);
    }
    return input;
  }

  function clickCallButton() {
    const btn = IPECSSel.find('callButton', { requireVisible: false });
    if (!btn) throw new Error('Voice call button (.testAudioCallDial) not found on left dialpad');
    if (btn.getAttribute('aria-disabled') === 'true' || btn.disabled) {
      throw new Error('Call button is disabled — number may be invalid');
    }
    revealLeftDialpad(btn);
    clickEl(btn);
    return btn;
  }

  /** End any leftover live call before starting the next number. */
  async function ensureIdleBeforeDial() {
    if (!IPECSSel.isInCall()) return;
    send('STATUS', { text: 'Ending previous call first…' });
    hangup();
    const start = Date.now();
    while (IPECSSel.isInCall() && Date.now() - start < 8000) {
      hangup();
      await sleep(250);
    }
    await sleep(400);
  }

  async function dial(number) {
    send('STATUS', { text: `Entering number ${number}…` });

    if (!/\/call/i.test(location.pathname) && !location.href.includes('/call')) {
      send('STATUS', { text: 'Open Calls (/call) — dialpad is on the LEFT' });
    }

    await ensureIdleBeforeDial();
    await IPECSSel.waitFor('dialInput', 10000);
    await enterNumber(number);
    send('STATUS', { text: `Calling ${number}…` });
    await sleep(350);
    clickCallButton();

    callState = 'dialing';
    callStartedAt = Date.now();
    sawLiveCall = false;
    lastSeenTimer = null;
    send('CALL_STARTED', { number, at: new Date().toISOString() });
    startWatching();
  }

  function clickEl(el) {
    if (!el) return;
    try {
      el.dispatchEvent(new MouseEvent('pointerdown', { bubbles: true, cancelable: true, view: window }));
      el.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true, view: window }));
      el.click();
      el.dispatchEvent(new MouseEvent('mouseup', { bubbles: true, cancelable: true, view: window }));
      el.dispatchEvent(new MouseEvent('pointerup', { bubbles: true, cancelable: true, view: window }));
    } catch (_) {
      try { el.click(); } catch (__) {}
    }
  }

  function hangup() {
    // Prefer the red #FE1440 in-call end button (verified on live iPECS).
    const btn =
      IPECSSel.find('hangupButton', { requireVisible: false }) ||
      (typeof IPECSSel.findRedHangup === 'function' ? IPECSSel.findRedHangup() : null);
    if (!btn) return false;
    clickEl(btn);
    // Retry shortly — iPECS sometimes ignores the first synthetic click.
    setTimeout(() => {
      if (typeof IPECSSel.isInCall === 'function' && IPECSSel.isInCall()) {
        const again =
          IPECSSel.find('hangupButton', { requireVisible: false }) ||
          (typeof IPECSSel.findRedHangup === 'function' ? IPECSSel.findRedHangup() : null);
        clickEl(again);
      }
    }, 400);
    return true;
  }

  /* ================= call state detection ================= */

  function startWatching() {
    stopWatching();
    watcher = setInterval(evaluate, POLL_MS);
    evaluate();
  }

  function stopWatching() {
    if (watcher) clearInterval(watcher);
    watcher = null;
  }

  function readTimer() {
    const el = IPECSSel.find('callTimer', { requireVisible: false });
    if (!el) return null;
    const m = (el.innerText || el.textContent || '').match(/(\d{1,2}):(\d{2})(?::(\d{2}))?/);
    if (!m) return null;
    return m[3]
      ? (+m[1]) * 3600 + (+m[2]) * 60 + (+m[3])
      : (+m[1]) * 60 + (+m[2]);
  }

  function evaluate() {
    // Live = red hangup OR "Connected"/"Calling"/"Ringing" label.
    const live = typeof IPECSSel.isInCall === 'function'
      ? IPECSSel.isInCall()
      : !!IPECSSel.find('hangupButton', { requireVisible: false });
    const secs = readTimer();
    if (secs !== null) lastSeenTimer = secs;
    if (live) sawLiveCall = true;

    if (live && callState === 'dialing') {
      callState = 'connected';
      send('CALL_CONNECTED', { at: new Date().toISOString() });
    }

    if (live) {
      evaluate._goneSince = 0;
      send('CALL_TICK', {
        seconds: secs ?? Math.round((Date.now() - callStartedAt) / 1000),
      });
      return;
    }

    // Call UI not present yet / anymore.
    if (callState === 'dialing') {
      if (!sawLiveCall && Date.now() - callStartedAt < DIAL_UI_GRACE_MS) return;
      const duration = lastSeenTimer ?? Math.round((Date.now() - callStartedAt) / 1000);
      const hadLive = sawLiveCall;
      callState = 'ended';
      stopWatching();
      lastSeenTimer = null;
      sawLiveCall = false;
      if (!hadLive) {
        send('DIAL_FAILED', { reason: 'Call UI did not appear — check dialer selectors' });
      } else {
        send('CALL_ENDED', { durationSeconds: duration, at: new Date().toISOString() });
      }
      return;
    }

    if (callState === 'connected') {
      // Require a short absence so a momentary DOM flicker doesn't end the call.
      if (!evaluate._goneSince) evaluate._goneSince = Date.now();
      if (Date.now() - evaluate._goneSince < 800) return;
      const duration = lastSeenTimer ?? Math.round((Date.now() - callStartedAt) / 1000);
      callState = 'ended';
      stopWatching();
      lastSeenTimer = null;
      sawLiveCall = false;
      evaluate._goneSince = 0;
      send('CALL_ENDED', { durationSeconds: duration, at: new Date().toISOString() });
      return;
    }

    evaluate._goneSince = 0;
  }

  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

  /* ================= on-page HUD ================= */

  let hud = null;

  function buildHud() {
    hud = document.createElement('div');
    hud.id = 'gvad-hud';
    hud.innerHTML = `
      <div class="gvad-hud__bar">
        <span class="gvad-hud__grip" aria-hidden="true">⠿</span>
        <span class="gvad-hud__title">IPECS Auto Dialer</span>
        <span class="gvad-hud__count" data-hud="count">0/0</span>
      </div>
      <div class="gvad-hud__body">
        <div class="gvad-hud__label">Active contact</div>
        <div class="gvad-hud__name" data-hud="name">—</div>
        <div class="gvad-hud__num" data-hud="number"></div>
        <div class="gvad-hud__label">Queue progress</div>
        <div class="gvad-hud__track"><i data-hud="bar"></i></div>
        <div class="gvad-hud__status" data-hud="status">Idle</div>
        <div class="gvad-hud__outcomes" data-hud="outcomes" hidden>
          <div class="gvad-hud__label">Select outcome</div>
          <div class="gvad-hud__grid">
            <button type="button" data-outcome="Answered">Answered</button>
            <button type="button" data-outcome="Voicemail">Voicemail</button>
            <button type="button" data-outcome="Busy">Busy</button>
            <button type="button" data-outcome="No Answer">No answer</button>
            <button type="button" data-outcome="Wrong Number">Wrong no.</button>
            <button type="button" data-outcome="Disconnected">Disconn.</button>
            <button type="button" data-outcome="Callback">Callback</button>
            <button type="button" class="is-ok" data-outcome="Interested">Interested</button>
            <button type="button" class="is-bad" data-outcome="Not Interested">Not int.</button>
          </div>
        </div>
        <div class="gvad-hud__actions">
          <button type="button" data-hud-action="hangup">End call</button>
          <button type="button" class="is-danger" data-hud-action="stop">Stop dialing</button>
        </div>
      </div>`;
    document.body.appendChild(hud);

    hud.querySelector('[data-hud-action="hangup"]').onclick = hangup;
    hud.querySelector('[data-hud-action="stop"]').onclick = () => send('STOP_REQUESTED');
    hud.querySelector('.gvad-hud__grid').addEventListener('click', (e) => {
      const btn = e.target.closest('[data-outcome]');
      if (!btn || btn.disabled) return;
      send('OUTCOME_SELECTED', { result: btn.getAttribute('data-outcome') });
    });
    makeDraggable(hud, hud.querySelector('.gvad-hud__bar'));
  }

  function renderHud({ name, number, index, total, status, percent, visible, awaitingOutcome, inCall }) {
    if (!hud) buildHud();
    hud.style.display = visible === false ? 'none' : 'block';
    const set = (k, v) => {
      const el = hud.querySelector(`[data-hud="${k}"]`);
      if (el && v !== undefined) el.textContent = v;
    };
    set('name', name || '—');
    set('number', number || '');
    set('count', `${index ?? 0}/${total ?? 0}`);
    set('status', status || '');
    const bar = hud.querySelector('[data-hud="bar"]');
    if (bar && percent !== undefined) bar.style.width = `${percent}%`;

    const outcomes = hud.querySelector('[data-hud="outcomes"]');
    if (outcomes) outcomes.hidden = !awaitingOutcome;
    hud.classList.toggle('is-awaiting', !!awaitingOutcome);

    const hangupBtn = hud.querySelector('[data-hud-action="hangup"]');
    if (hangupBtn) hangupBtn.disabled = !!awaitingOutcome || !inCall;

    for (const b of hud.querySelectorAll('[data-outcome]')) {
      b.disabled = !awaitingOutcome;
    }
  }

  function makeDraggable(el, handle) {
    let dx = 0, dy = 0;
    handle.style.cursor = 'move';
    handle.addEventListener('pointerdown', (e) => {
      const r = el.getBoundingClientRect();
      dx = e.clientX - r.left;
      dy = e.clientY - r.top;
      const move = (ev) => {
        el.style.left = `${ev.clientX - dx}px`;
        el.style.top = `${ev.clientY - dy}px`;
        el.style.right = 'auto';
        el.style.bottom = 'auto';
      };
      const up = () => {
        document.removeEventListener('pointermove', move);
        document.removeEventListener('pointerup', up);
      };
      document.addEventListener('pointermove', move);
      document.addEventListener('pointerup', up);
    });
  }

  /* ================= boot ================= */

  connect();
  send('CONTENT_READY', { href: location.href });
  console.info('[IPECS Dialer] content script ready — run IPECSSel.probe() to verify selectors.');
})();
