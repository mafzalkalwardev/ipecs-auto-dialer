/* ------------------------------------------------------------------
 * selectors.js — iPECS ONE (one3.ipecs-cloud.co.uk/call)
 *
 * Live DOM hooks (verified on logged-in /call):
 *   LEFT dialpad:
 *     textarea[placeholder="Search by name, number"]
 *     button.testDialZero … testDialNine / testDialAstar / testDialSharp
 *     button.testAudioCallDial   (green voice)
 *     button.testVideoCallDial   (green video — never use)
 *     button.testClearDial
 *   IN-CALL bar (center):
 *     header text "Connected" + "MM:SS" timer
 *     red hangup button: SVG path fill="#FE1440" (no aria-label / no test*)
 *
 * Run IPECSSel.probe() in DevTools on the calling tab to verify.
 * ------------------------------------------------------------------ */

const IPECSSel = (() => {
  const DIAL_KEY = {
    '0': '.testDialZero',
    '1': '.testDialOne',
    '2': '.testDialTwo',
    '3': '.testDialThree',
    '4': '.testDialFour',
    '5': '.testDialFive',
    '6': '.testDialSix',
    '7': '.testDialSeven',
    '8': '.testDialEight',
    '9': '.testDialNine',
    '*': '.testDialAstar',
    '#': '.testDialSharp',
  };

  const CANDIDATES = {
    dialInput: [
      'textarea[placeholder*="Search by name, number" i]',
      'textarea[placeholder*="name, number" i]',
      'textarea[maxlength="32"][placeholder*="Search" i]',
      () => byPlaceholderFuzzy('textarea', ['search by name, number', 'name, number'], { exclude: ['search user', 'contacts'] }),
    ],

    callButton: [
      'button.testAudioCallDial',
      '.testAudioCallDial',
      () => document.querySelector('button.testAudioCallDial'),
    ],

    clearDial: [
      'button.testClearDial',
      '.testClearDial',
    ],

    // Red end-call control in the in-call toolbar (fill #FE1440).
    hangupButton: [
      () => findRedHangup(),
      'button[aria-label*="End call" i]',
      'button[aria-label*="Hang up" i]',
      'button[title*="End call" i]',
      'button[title*="Hang up" i]',
    ],

    // "Connected" label shown while live.
    connectedLabel: [
      () => byExactText('Connected'),
      () => byExactText('Calling'),
      () => byExactText('Ringing'),
    ],

    // Elapsed timer next to Connected, e.g. "00:19".
    callTimer: [
      () => findConnectedTimer(),
    ],

    callSurface: [
      () => findRedHangup(),
      () => byExactText('Connected'),
    ],
  };

  function byPlaceholderFuzzy(tag, needles, opts = {}) {
    const exclude = (opts.exclude || []).map((s) => String(s).toLowerCase());
    for (const el of document.querySelectorAll(tag)) {
      const p = (el.placeholder || '').toLowerCase();
      if (exclude.some((x) => p.includes(x))) continue;
      if (needles.some((n) => p.includes(n))) return el;
    }
    return null;
  }

  function byExactText(text) {
    const want = String(text).trim().toLowerCase();
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    let n;
    while ((n = walker.nextNode())) {
      if ((n.nodeValue || '').trim().toLowerCase() !== want) continue;
      const el = n.parentElement;
      if (el && el.getBoundingClientRect().height > 0) return el;
    }
    return null;
  }

  /** Red hang-up in the floating in-call control bar. */
  function findRedHangup() {
    const buttons = document.querySelectorAll('button');
    for (const el of buttons) {
      const html = el.innerHTML || '';
      if (!/#FE1440/i.test(html)) continue;
      // Exclude unrelated red icons that aren't phone hangup paths.
      if (!/viewBox=\"0 0 28 13\"|M13\\.529|hang|end/i.test(html) && !/#FE1440/i.test(html)) continue;
      const r = el.getBoundingClientRect();
      if (r.width < 10 || r.height < 10) continue;
      // Prefer the control-bar hangup (typically mid/lower screen).
      return el;
    }
    // Broader fallback: any visible button whose SVG is filled #FE1440.
    for (const el of buttons) {
      if (!/#FE1440/i.test(el.innerHTML || '')) continue;
      const r = el.getBoundingClientRect();
      if (r.width >= 20 && r.height >= 20 && r.y > 80) return el;
    }
    return null;
  }

  function findConnectedTimer() {
    // Prefer timer span sitting near "Connected".
    const label = byExactText('Connected') || byExactText('Calling') || byExactText('Ringing');
    if (label) {
      const root = label.parentElement || label;
      const candidate = [...root.querySelectorAll('span,div')].find((el) =>
        /^\s*\d{1,2}:\d{2}(:\d{2})?\s*$/.test((el.textContent || '').trim())
      );
      if (candidate) return candidate;
      // Sibling search
      const sib = label.parentElement?.querySelector('span,div');
      for (const el of (label.parentElement?.parentElement?.querySelectorAll('span,div') || [])) {
        if (/^\s*\d{1,2}:\d{2}(:\d{2})?\s*$/.test((el.textContent || '').trim())) return el;
      }
      if (sib && /^\d/.test((sib.textContent || '').trim())) return sib;
    }
    // Global: MM:SS that is NOT a call-log AM/PM timestamp.
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    let n;
    while ((n = walker.nextNode())) {
      const t = (n.nodeValue || '').trim();
      if (!/^\d{1,2}:\d{2}(:\d{2})?$/.test(t)) continue;
      const parent = n.parentElement;
      if (!parent) continue;
      const ctx = (parent.parentElement?.textContent || parent.textContent || '');
      if (/AM|PM|Unknown/i.test(ctx)) continue;
      if (/07\d{8,}/.test(ctx) && /Unknown/i.test(ctx)) continue;
      if (parent.getBoundingClientRect().height > 0) return parent;
    }
    return null;
  }

  function isVisible(el) {
    if (!el) return false;
    const r = el.getBoundingClientRect();
    return r.width > 0 && r.height > 0;
  }

  /** True while iPECS shows an active/ringing call. */
  function isInCall() {
    if (findRedHangup()) return true;
    if (byExactText('Connected')) return true;
    if (byExactText('Calling')) return true;
    if (byExactText('Ringing')) return true;
    return false;
  }

  function dialKeyButton(digit) {
    const sel = DIAL_KEY[String(digit)];
    return sel ? document.querySelector(sel) : null;
  }

  function find(key, { requireVisible = true } = {}) {
    const list = CANDIDATES[key];
    if (!list) throw new Error(`Unknown selector key: ${key}`);
    for (const strategy of list) {
      let el = null;
      try {
        el = typeof strategy === 'function' ? strategy() : document.querySelector(strategy);
      } catch (_) { /* next */ }
      if (!el) continue;
      if (!requireVisible || isVisible(el) || key === 'dialInput' || key === 'callButton' || key === 'hangupButton') {
        return el;
      }
    }
    return null;
  }

  function waitFor(key, timeout = 8000, interval = 150) {
    return new Promise((resolve, reject) => {
      const started = Date.now();
      (function tick() {
        const el = find(key, { requireVisible: false });
        if (el) return resolve(el);
        if (Date.now() - started > timeout) {
          return reject(new Error(`Timed out waiting for "${key}"`));
        }
        setTimeout(tick, interval);
      })();
    });
  }

  function probe() {
    const rows = Object.keys(CANDIDATES).map((key) => {
      const el = find(key, { requireVisible: false });
      return {
        key,
        found: !!el,
        tag: el ? el.tagName.toLowerCase() : '—',
        class: el ? String(el.className).slice(0, 40) : '—',
        text: el ? (el.innerText || el.placeholder || '').trim().slice(0, 30) : '—',
      };
    });
    console.table(rows);
    console.info('[IPECS Dialer] inCall=', isInCall());
    return rows;
  }

  return {
    find, waitFor, probe, isVisible, isInCall,
    dialKeyButton, findRedHangup, DIAL_KEY, CANDIDATES,
  };
})();

window.IPECSSel = IPECSSel;
window.GVSel = IPECSSel;
