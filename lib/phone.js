/* ------------------------------------------------------------------
 * phone.js — UK normalization, validation, dedupe, and calling windows.
 * Pure functions only: no DOM, no chrome.* APIs. Unit-testable in Node.
 * ------------------------------------------------------------------ */

/**
 * Normalize free-form input to E.164 for the UK numbering plan.
 * Accepts: 07…, 01…/02…/03…, +44…, 44…, and common spaced/punctuated forms.
 * Returns { ok, e164, national, pretty, reason }.
 *
 * `national` is what we type into the iPECS dialpad (leading 0).
 */
export function normalize(raw) {
  if (raw === null || raw === undefined) {
    return { ok: false, reason: 'empty' };
  }

  let s = String(raw).trim();
  if (!s) return { ok: false, reason: 'empty' };

  // Keep a leading + so we can detect international form before stripping.
  const hasPlus = s.startsWith('+');
  const digits = s.replace(/[^\d]/g, '');
  if (!digits) return { ok: false, reason: 'empty' };

  let national; // digits with leading 0, no country code

  if (digits.startsWith('44') && digits.length >= 12) {
    // +44 / 44 …
    national = `0${digits.slice(2)}`;
  } else if (digits.startsWith('0') && digits.length >= 10 && digits.length <= 11) {
    national = digits;
  } else if (!hasPlus && digits.length === 10 && /^[1237]/.test(digits)) {
    // Excel sometimes drops the leading 0: 7958647398 → 07958647398
    national = `0${digits}`;
  } else {
    return { ok: false, reason: `unrecognised UK number (${digits.length} digits)` };
  }

  // UK national numbers are typically 10–11 digits including leading 0.
  if (national.length < 10 || national.length > 11) {
    return { ok: false, reason: `expected 10–11 national digits, got ${national.length}` };
  }
  if (!national.startsWith('0')) {
    return { ok: false, reason: 'UK national number must start with 0' };
  }

  // Reject obvious junk / premium / non-geographic short codes if too short after 0.
  const body = national.slice(1);
  if (!/^\d{9,10}$/.test(body)) {
    return { ok: false, reason: 'invalid UK subscriber length' };
  }

  // Soft checks: mobiles 07…, geographic 01/02…, non-geo 03…
  const first2 = national.slice(0, 2);
  if (!['01', '02', '03', '07', '08', '09'].includes(first2)) {
    return { ok: false, reason: `unsupported UK prefix ${first2}` };
  }

  const e164 = `+44${body}`;
  return {
    ok: true,
    e164,
    national,
    pretty: prettyUk(national),
  };
}

function prettyUk(national) {
  // Mobile: 07XXX XXXXXX
  if (national.startsWith('07') && national.length === 11) {
    return `${national.slice(0, 5)} ${national.slice(5)}`;
  }
  // London-style 020: 020 XXXX XXXX
  if (national.startsWith('020') && national.length === 11) {
    return `${national.slice(0, 3)} ${national.slice(3, 7)} ${national.slice(7)}`;
  }
  // Generic: group as 0XXX XXX XXXX when 11 digits
  if (national.length === 11) {
    return `${national.slice(0, 4)} ${national.slice(4, 7)} ${national.slice(7)}`;
  }
  return national;
}

/**
 * Turn parsed rows into a dial queue.
 * @param rows  array of objects from the CSV/XLSX parse
 * @param opts.dncList  array of raw numbers to exclude
 * @returns { contacts, summary }
 */
export function buildQueue(rows, opts = {}) {
  const dnc = new Set(
    (opts.dncList || [])
      .map((n) => normalize(n))
      .filter((r) => r.ok)
      .map((r) => r.e164)
  );

  const seen = new Set();
  const contacts = [];
  let invalid = 0;
  let duplicate = 0;
  let suppressed = 0;

  rows.forEach((row, i) => {
    const rawNumber = pick(row, ['phone number', 'phone', 'number', 'mobile', 'cell', 'phone_number']);
    const name = pick(row, ['customer name', 'name', 'contact', 'full name', 'customer', 'contact name']) || '';

    const norm = normalize(rawNumber);
    if (!norm.ok) { invalid++; return; }
    if (dnc.has(norm.e164)) { suppressed++; return; }
    if (seen.has(norm.e164)) { duplicate++; return; }

    seen.add(norm.e164);
    contacts.push({
      id: `c${contacts.length + 1}`,
      sourceRow: i + 2,          // +2 = 1-indexed, plus header row
      name: String(name).trim(),
      number: norm.national,      // what we type into the iPECS dialpad
      e164: norm.e164,
      pretty: norm.pretty,
      status: 'ready',            // ready | dialing | completed | failed | skipped
      result: null,
      durationSeconds: null,
      startedAt: null,
      endedAt: null,
    });
  });

  return {
    contacts,
    summary: {
      total: rows.length,
      valid: contacts.length,
      invalid,
      duplicate,
      suppressed,
      readyToDial: contacts.length,
    },
  };
}

/** Case- and space-insensitive column lookup. */
function pick(row, keys) {
  const map = {};
  for (const k of Object.keys(row)) {
    map[k.toLowerCase().replace(/[\s_]+/g, ' ').trim()] = row[k];
  }
  for (const k of keys) {
    const v = map[k];
    if (v !== undefined && v !== null && String(v).trim() !== '') return v;
  }
  return undefined;
}

/* ---------------- calling guardrails ---------------- */

/**
 * UK outbound soft window in Europe/London local time (default 08:00–21:00).
 * Not legal advice — a practical safety net for UK dialling.
 *
 * @returns { allowed, localHour, reason }
 */
export function checkCallingWindow(e164, now = new Date(), window = { start: 8, end: 21 }) {
  if (!e164 || !String(e164).startsWith('+44')) {
    return { allowed: true, localHour: null, reason: 'not a UK number' };
  }

  let localHour;
  try {
    const parts = new Intl.DateTimeFormat('en-GB', {
      timeZone: 'Europe/London',
      hour: 'numeric',
      hour12: false,
    }).formatToParts(now);
    localHour = Number(parts.find((p) => p.type === 'hour')?.value);
  } catch (_) {
    return { allowed: true, localHour: null, reason: 'timezone unavailable' };
  }

  const allowed = localHour >= window.start && localHour < window.end;
  return {
    allowed,
    localHour,
    reason: allowed ? null : `UK local time ${localHour}:00 is outside ${window.start}:00–${window.end}:00`,
  };
}
