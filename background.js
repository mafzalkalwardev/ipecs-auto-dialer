/* ------------------------------------------------------------------
 * background.js — the campaign's single source of truth.
 *
 * MV3 service workers are killed after ~30s idle, so two rules apply:
 *   1. Every state transition is written to chrome.storage.local
 *      immediately, so a recycled worker can resume mid-campaign.
 *   2. While the side panel is open it holds a long-lived Port, which
 *      keeps this worker alive. Inter-call delays therefore use plain
 *      setTimeout (chrome.alarms has a 30s floor — useless for a 5s gap).
 * ------------------------------------------------------------------ */

import { ACCOUNTS_API_BASE } from './config.js';

const KEY = 'campaign';

const BLANK = {
  status: 'idle',        // idle | running | paused | awaiting_outcome | finished
  contacts: [],
  summary: null,
  index: -1,             // index of the contact currently being handled
  dialDelaySeconds: 5,
  enforceCallingWindow: true,
  startedAt: null,
  finishedAt: null,
  lastStatusText: '',
};

let state = { ...BLANK };
let panelPorts = new Set();
let contentPort = null;
let delayTimer = null;

const IPECS_TAB_URLS = [
  'https://one3.ipecs-cloud.co.uk/*',
  'https://*.ipecs-cloud.co.uk/*',
];
const IPECS_CALL_URL = 'https://one3.ipecs-cloud.co.uk/call';

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/**
 * Content scripts do not auto-inject into tabs that were already open when
 * the extension was installed/reloaded. Find (or open) an iPECS tab and
 * inject the dialer bridge so contentPort connects.
 */
async function ensureCallingTab() {
  if (contentPort) return true;

  let tabs = [];
  try {
    tabs = await chrome.tabs.query({ url: IPECS_TAB_URLS });
  } catch (_) {
    tabs = [];
  }

  // Broader fallback — some Chrome builds are picky about url globs.
  if (!tabs.length) {
    try {
      const all = await chrome.tabs.query({});
      tabs = all.filter((t) => /ipecs-cloud\.co\.uk/i.test(t.url || ''));
    } catch (_) {}
  }

  if (!tabs.length) {
    try {
      const created = await chrome.tabs.create({ url: IPECS_CALL_URL, active: true });
      tabs = [created];
      commit({}, 'Opened iPECS Cloud — sign in if needed, then press Resume');
    } catch (err) {
      commit({ status: 'paused' }, `Could not open iPECS: ${err.message}`);
      return false;
    }
  } else {
    // Prefer a /call tab; focus it so the operator sees the dialer.
    const preferred = tabs.find((t) => /\/call/i.test(t.url || '')) || tabs[0];
    try {
      await chrome.tabs.update(preferred.id, { active: true });
      if (preferred.windowId != null) {
        await chrome.windows.update(preferred.windowId, { focused: true });
      }
    } catch (_) {}
    tabs = [preferred, ...tabs.filter((t) => t.id !== preferred.id)];
  }

  for (const tab of tabs) {
    if (!tab?.id) continue;
    try {
      await chrome.scripting.executeScript({
        target: { tabId: tab.id, allFrames: true },
        files: ['content/selectors.js', 'content/inject.js'],
      });
      try {
        await chrome.scripting.insertCSS({
          target: { tabId: tab.id, allFrames: true },
          files: ['content/hud.css'],
        });
      } catch (_) { /* css optional */ }
    } catch (err) {
      console.warn('[IPECS Dialer] inject failed on tab', tab.id, err?.message || err);
    }
  }

  for (let i = 0; i < 40; i++) {
    if (contentPort) return true;
    await sleep(100);
  }
  return !!contentPort;
}

/* ================= account / subscription =================
 * Kept entirely separate from campaign `state` on purpose: RESET clears
 * a campaign, it must never log the user out. One account = one device,
 * enforced server-side by binding it to a random UUID generated once
 * per install and never sent anywhere except your own accounts server.
 * There is no payment processor involved — you approve accounts and
 * set how long they last by hand from the server's /admin page. */

const ACCOUNT_STORAGE_KEY = 'account';
const DEVICE_STORAGE_KEY = 'device';

let account = { username: null, token: null, status: 'unknown', plan: null, expiresAt: null, lastError: null, lastCheckedAt: null };
let deviceId = null;

async function loadAccount() {
  const stored = await chrome.storage.local.get([ACCOUNT_STORAGE_KEY, DEVICE_STORAGE_KEY]);
  if (stored[ACCOUNT_STORAGE_KEY]) account = { ...account, ...stored[ACCOUNT_STORAGE_KEY] };
  if (stored[DEVICE_STORAGE_KEY]) {
    deviceId = stored[DEVICE_STORAGE_KEY];
  } else {
    deviceId = crypto.randomUUID();
    await chrome.storage.local.set({ [DEVICE_STORAGE_KEY]: deviceId });
  }
}

function persistAccount() {
  chrome.storage.local.set({ [ACCOUNT_STORAGE_KEY]: account });
}

function isAccountValid() {
  return account.status === 'active' && (!account.expiresAt || new Date(account.expiresAt) > new Date());
}

function broadcastAccount() {
  for (const p of panelPorts) {
    try { p.postMessage({ type: 'ACCOUNT', payload: account }); } catch (_) {}
  }
}

function reasonText(reason) {
  switch (reason) {
    case 'device_mismatch': return 'This account is already logged in on another computer. Log out there first.';
    case 'not_found': return 'Account not found.';
    case 'bad_credentials': return 'Incorrect username or password.';
    case 'pending': return 'Your account is registered but not approved yet — contact the seller.';
    case 'disabled': return 'This account has been disabled.';
    case 'expired': return 'Your subscription has expired — contact the seller to renew.';
    case 'username_taken':
    case 'trial_used_on_device':
      return reason; // server already sends a friendly sentence for these
    default: return reason || 'Something went wrong.';
  }
}

const FETCH_TIMEOUT_MS = 90_000;

async function ensureDeviceReady() {
  if (!deviceId) await loadAccount();
}

/** Warm the API before auth so the first request is less likely to time out. */
async function wakeServer() {
  try {
    await fetch(`${ACCOUNTS_API_BASE}/health`, {
      method: 'GET',
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    });
  } catch (_) { /* offline — auth call will surface the error */ }
}

async function postJson(path, body) {
  const res = await fetch(`${ACCOUNTS_API_BASE}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
  });
  const data = await res.json().catch(() => ({}));
  return { ok: res.ok && data.ok, data };
}

function networkErrorReason(err) {
  if (err && (err.name === 'TimeoutError' || err.name === 'AbortError')) {
    return 'The server is taking too long to respond. Please try again in a moment.';
  }
  return 'Could not reach the server. Check your internet connection and try again.';
}

async function registerAccount(username, password, email) {
  try {
    await ensureDeviceReady();
    await wakeServer();
    const { ok, data } = await postJson('/api/register', { username, password, email });
    return ok ? { ok: true, message: data.message } : { ok: false, reason: data.reason || reasonText() };
  } catch (err) {
    return { ok: false, reason: networkErrorReason(err) };
  }
}

async function startTrial(username, password, email) {
  try {
    await ensureDeviceReady();
    await wakeServer();
    const { ok, data } = await postJson('/api/trial', { username, password, email, deviceId });
    if (!ok) return { ok: false, reason: data.reason || reasonText() };
    account = { username, token: data.token, status: 'active', plan: data.plan, expiresAt: data.expiresAt, lastError: null, lastCheckedAt: new Date().toISOString() };
    persistAccount();
    broadcastAccount();
    return { ok: true };
  } catch (err) {
    return { ok: false, reason: networkErrorReason(err) };
  }
}

async function login(username, password) {
  try {
    await ensureDeviceReady();
    await wakeServer();
    const { ok, data } = await postJson('/api/login', { username, password, deviceId });
    if (!ok) {
      account = { username, token: null, status: 'unknown', plan: null, expiresAt: null, lastError: reasonText(data.reason), lastCheckedAt: new Date().toISOString() };
      persistAccount();
      broadcastAccount();
      return { ok: false, reason: account.lastError };
    }
    account = { username, token: data.token, status: 'active', plan: data.plan, expiresAt: data.expiresAt, lastError: null, lastCheckedAt: new Date().toISOString() };
    persistAccount();
    broadcastAccount();
    return { ok: true };
  } catch (err) {
    return { ok: false, reason: networkErrorReason(err) };
  }
}

async function revalidateAccount() {
  if (!account.token) return;
  try {
    const { ok, data } = await postJson('/api/validate', { username: account.username, token: account.token, deviceId });
    account = {
      ...account,
      status: ok ? 'active' : (data.reason === 'device_mismatch' || data.reason === 'not_found' ? 'unknown' : 'inactive'),
      plan: ok ? data.plan : account.plan,
      expiresAt: ok ? data.expiresAt : account.expiresAt,
      lastError: ok ? null : reasonText(data.reason),
      lastCheckedAt: new Date().toISOString(),
    };
    persistAccount();
    if (!isAccountValid() && (state.status === 'running' || state.status === 'awaiting_outcome')) {
      stopCampaign('Subscription check failed — dialing stopped');
    }
  } catch (_) {
    // Network hiccup — don't flip a working session to invalid over one
    // failed check, but do record it so long outages are visible.
    account = { ...account, lastError: 'Could not reach the accounts server', lastCheckedAt: new Date().toISOString() };
    persistAccount();
  }
  broadcastAccount();
}

async function logoutAccount() {
  if (account.token) {
    try {
      await fetch(`${ACCOUNTS_API_BASE}/api/logout`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: account.username, token: account.token }),
      });
    } catch (_) { /* best effort — freeing the device server-side is what matters */ }
  }
  account = { username: null, token: null, status: 'unknown', plan: null, expiresAt: null, lastError: null, lastCheckedAt: null };
  persistAccount();
  broadcastAccount();
}

/* ================= persistence ================= */

async function load() {
  const stored = await chrome.storage.local.get(KEY);
  if (stored[KEY]) state = { ...BLANK, ...stored[KEY] };
}

function persist() {
  chrome.storage.local.set({ [KEY]: state });
}

function commit(patch = {}, statusText) {
  Object.assign(state, patch);
  if (statusText !== undefined) state.lastStatusText = statusText;
  persist();
  broadcast();
}

/* ================= messaging ================= */

function broadcast() {
  const snapshot = view();
  for (const p of panelPorts) {
    try { p.postMessage({ type: 'STATE', payload: snapshot }); } catch (_) {}
  }
  pushHud(snapshot);
}

/** What the UI actually needs — derived, so the panel stays dumb. */
function view() {
  const c = state.contacts;
  const completed = c.filter((x) => x.status === 'completed').length;
  const failed = c.filter((x) => x.status === 'failed').length;
  const ready = c.filter((x) => x.status === 'ready').length;
  const tally = (r) => c.filter((x) => x.result === r).length;

  return {
    status: state.status,
    summary: state.summary,
    dialDelaySeconds: state.dialDelaySeconds,
    enforceCallingWindow: state.enforceCallingWindow,
    statusText: state.lastStatusText,
    current: state.index >= 0 ? c[state.index] : null,
    position: state.index + 1,
    stats: {
      total: c.length,
      completed,
      failed,
      readyToDial: ready,
      answered: tally('Answered'),
      voicemail: tally('Voicemail'),
      percent: c.length ? Math.round(((completed + failed) / c.length) * 100) : 0,
    },
    contacts: c,
  };
}

function pushHud(v) {
  if (!contentPort) return;
  try {
    contentPort.postMessage({
      type: 'HUD_UPDATE',
      payload: {
        visible: state.status !== 'idle' && state.status !== 'finished',
        name: v.current?.name || '—',
        number: v.current?.pretty || '',
        index: v.position,
        total: v.stats.total,
        percent: v.stats.percent,
        status: state.lastStatusText,
        awaitingOutcome: state.status === 'awaiting_outcome',
        inCall: state.status === 'running' && !!v.current && v.current.status === 'dialing',
      },
    });
  } catch (_) {}
}

async function toContent(type, payload = {}) {
  if (!contentPort) {
    const ok = await ensureCallingTab();
    if (!ok || !contentPort) {
      commit(
        { status: 'paused' },
        'Calling tab not found — open https://one3.ipecs-cloud.co.uk/call, reload the page, then press Resume'
      );
      return false;
    }
  }
  try {
    contentPort.postMessage({ type, payload });
    return true;
  } catch (_) {
    contentPort = null;
    const ok = await ensureCallingTab();
    if (!ok || !contentPort) {
      commit({ status: 'paused' }, 'Lost connection to iPECS tab — reload the iPECS page and press Resume');
      return false;
    }
    try {
      contentPort.postMessage({ type, payload });
      return true;
    } catch (_) {
      contentPort = null;
      commit({ status: 'paused' }, 'Lost connection to iPECS tab — reload the iPECS page and press Resume');
      return false;
    }
  }
}

/* ================= the state machine ================= */

async function startCampaign() {
  if (!isAccountValid()) {
    commit({}, 'Log in to an active account to start dialing');
    return;
  }
  if (!state.contacts.length) return;
  commit({ status: 'running', startedAt: new Date().toISOString(), finishedAt: null }, 'Connecting to iPECS…');
  const linked = await ensureCallingTab();
  if (!linked) {
    commit({ status: 'paused' }, 'Open https://one3.ipecs-cloud.co.uk/call then press Resume');
    return;
  }
  commit({}, 'Starting…');
  advance();
}

function stopCampaign(reason = 'Auto dial stopped') {
  clearTimeout(delayTimer);
  delayTimer = null;
  commit({ status: 'paused' }, reason);
}

/** Move to the next ready contact, or finish. */
async function advance() {
  if (state.status !== 'running') return;

  const next = state.contacts.findIndex((c) => c.status === 'ready');
  if (next === -1) {
    clearTimeout(delayTimer);
    commit(
      { status: 'finished', index: -1, finishedAt: new Date().toISOString() },
      'All contacts in this campaign batch have been processed.'
    );
    return;
  }

  const contact = state.contacts[next];
  contact.status = 'dialing';
  contact.startedAt = new Date().toISOString();
  commit({ index: next }, `Calling ${contact.name || contact.pretty}…`);

  const sent = await toContent('DIAL', { number: contact.number });
  if (!sent) {
    contact.status = 'ready';
    contact.startedAt = null;
  }
}

function scheduleNext() {
  clearTimeout(delayTimer);
  const ms = Math.max(0, state.dialDelaySeconds * 1000);
  let left = state.dialDelaySeconds;

  const tick = () => {
    if (state.status !== 'running') return;
    if (left <= 0) return advance();
    commit({}, `Next call in ${left}s…`);
    left -= 1;
    delayTimer = setTimeout(tick, 1000);
  };

  if (ms === 0) advance();
  else tick();
}

/* ================= inbound events ================= */

function onContentMessage({ type, payload }) {
  const contact = state.index >= 0 ? state.contacts[state.index] : null;

  switch (type) {
    case 'CONTENT_READY':
      broadcast();
      break;

    case 'STATUS':
      commit({}, payload.text);
      break;

    case 'CALL_STARTED':
      if (contact) contact.startedAt = payload.at;
      commit({}, `Dialing ${contact?.pretty || ''}…`);
      break;

    case 'CALL_CONNECTED':
      commit({}, 'Connected');
      break;

    case 'CALL_TICK':
      commit({}, `In call: ${payload.seconds}s`);
      break;

    case 'CALL_ENDED':
      if (contact) {
        contact.durationSeconds = payload.durationSeconds;
        contact.endedAt = payload.at;
      }
      // Wait for the human to tag the outcome before moving on.
      commit({ status: 'awaiting_outcome' }, 'Select an outcome to continue');
      break;

    case 'DIAL_FAILED':
      if (contact) {
        contact.status = 'failed';
        contact.result = 'Failed';
        contact.endedAt = new Date().toISOString();
      }
      commit({}, `Dial failed: ${payload.reason}`);
      if (state.status === 'running') scheduleNext();
      break;

    case 'STOP_REQUESTED':
      stopCampaign();
      break;

    case 'OUTCOME_SELECTED':
      recordOutcome(payload?.result);
      break;
  }
}

function recordOutcome(result) {
  if (state.status !== 'awaiting_outcome') return;
  const contact = state.index >= 0 ? state.contacts[state.index] : null;
  if (!contact || !result) return;
  contact.result = result;
  contact.status = 'completed';
  if (contact.durationSeconds === null || contact.durationSeconds === undefined) {
    contact.durationSeconds = 0;
  }
  if (!contact.endedAt) contact.endedAt = new Date().toISOString();

  commit({ status: 'running' }, `Marked ${result}`);
  scheduleNext();
}

/* ================= ports ================= */

chrome.runtime.onConnect.addListener((port) => {
  if (port.name === 'ipecs-content' || port.name === 'gv-content') {
    contentPort = port;
    port.onMessage.addListener(onContentMessage);
    port.onDisconnect.addListener(() => { contentPort = null; });
    broadcast();
    return;
  }

  if (port.name === 'gv-panel') {
    panelPorts.add(port);
    port.onDisconnect.addListener(() => panelPorts.delete(port));
    const reply = (type, payload) => {
      try { port.postMessage({ type, payload }); } catch (_) {}
    };

    port.onMessage.addListener(async (msg) => {
      switch (msg.type) {
        case 'GET_STATE':
          reply('STATE', view());
          break;

        case 'GET_ACCOUNT':
          reply('ACCOUNT', account);
          revalidateAccount();
          break;

        case 'REGISTER': {
          const result = await registerAccount(msg.payload.username, msg.payload.password, msg.payload.email);
          reply('REGISTER_RESULT', result);
          break;
        }

        case 'START_TRIAL': {
          const result = await startTrial(msg.payload.username, msg.payload.password, msg.payload.email);
          reply('AUTH_RESULT', result);
          break;
        }

        case 'LOGIN': {
          const result = await login(msg.payload.username, msg.payload.password);
          reply('AUTH_RESULT', result);
          break;
        }

        case 'LOGOUT':
          await logoutAccount();
          break;

        case 'LOAD_CONTACTS':
          commit({
            contacts: msg.payload.contacts,
            summary: msg.payload.summary,
            status: 'idle',
            index: -1,
          }, `Imported ${msg.payload.contacts.length} contacts`);
          break;
        case 'START':
          // Live-check rather than trusting the cached status — a
          // client whose access just expired shouldn't be able to
          // start a fresh campaign just because the last poll was 20
          // minutes ago and still said "active".
          await revalidateAccount();
          await startCampaign();
          break;
        case 'STOP':
          stopCampaign();
          break;
        case 'RESUME': {
          await revalidateAccount();
          if (!isAccountValid()) {
            commit({}, 'Log in to an active account to resume dialing');
            break;
          }
          // If Stop was pressed while a call had already ended and was
          // awaiting an outcome tag, resuming must not silently skip that
          // contact — advance() only looks for status 'ready', so a
          // 'dialing' contact left behind here would be lost forever.
          const cur = state.index >= 0 ? state.contacts[state.index] : null;
          if (cur && cur.status === 'dialing' && cur.endedAt) {
            commit({ status: 'awaiting_outcome' }, 'Resuming — select an outcome to continue');
          } else {
            if (cur && cur.status === 'dialing') cur.status = 'ready'; // interrupted mid-dial; retry it
            commit({ status: 'running' }, 'Connecting to iPECS…');
            const linked = await ensureCallingTab();
            if (!linked) {
              commit({ status: 'paused' }, 'Open https://one3.ipecs-cloud.co.uk/call then press Resume');
              break;
            }
            commit({ status: 'running' }, 'Resuming…');
            await advance();
          }
          break;
        }
        case 'OUTCOME':
          recordOutcome(msg.payload?.result);
          break;
        case 'HANGUP':
          await toContent('HANGUP');
          break;
        case 'SET_DELAY':
          commit({ dialDelaySeconds: Number(msg.payload.seconds) || 0 });
          break;
        case 'SET_WINDOW_ENFORCEMENT':
          commit({ enforceCallingWindow: !!msg.payload.enabled });
          break;
        case 'RESET':
          state = { ...BLANK };
          persist();
          broadcast();
          break;
      }
    });
    load().then(broadcast);
    loadAccount().then(() => {
      broadcastAccount();
      wakeServer().then(revalidateAccount);
    });
  }
});

/* ================= lifecycle ================= */

const ACCOUNT_ALARM = 'gvad-account-check';

chrome.runtime.onInstalled.addListener(() => {
  chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true }).catch(() => {});
  load();
  loadAccount().then(revalidateAccount);
  chrome.alarms.create(ACCOUNT_ALARM, { periodInMinutes: 30 });
});

chrome.runtime.onStartup.addListener(() => {
  load();
  loadAccount().then(revalidateAccount);
});

chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === ACCOUNT_ALARM) revalidateAccount();
});

load();
loadAccount().then(revalidateAccount);
