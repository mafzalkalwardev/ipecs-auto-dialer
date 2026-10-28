import { test } from 'node:test';
import assert from 'node:assert/strict';
import { normalize, buildQueue, checkCallingWindow } from '../lib/phone.js';

test('normalize accepts common UK mobile formats', () => {
  const inputs = [
    '07958647398', '+44 7958 647398', '447958647398', '7958647398',
  ];
  for (const input of inputs) {
    const r = normalize(input);
    assert.equal(r.ok, true, `failed for ${input}: ${r.reason}`);
    assert.equal(r.e164, '+447958647398');
    assert.equal(r.national, '07958647398');
  }
});

test('normalize accepts UK geographic numbers', () => {
  const r = normalize('02079460000');
  assert.equal(r.ok, true);
  assert.equal(r.e164, '+442079460000');
  assert.equal(r.national, '02079460000');
});

test('normalize survives Excel mangling numbers into other types', () => {
  assert.equal(normalize(7958647398).e164, '+447958647398');
});

test('normalize rejects malformed numbers', () => {
  assert.equal(normalize('').ok, false);
  assert.equal(normalize(null).ok, false);
  assert.equal(normalize('12345').ok, false);
  assert.equal(normalize('+16512631806').ok, false);
});

test('buildQueue dedupes and validates UK leads', () => {
  const { contacts, summary } = buildQueue([
    { 'Phone Number': '07958647398', 'Customer Name': 'A' },
    { phone: '+447958647398', name: 'dup' },
    { mobile: 'bad', contact: 'X' },
  ]);
  assert.equal(contacts.length, 1);
  assert.equal(summary.duplicate, 1);
  assert.equal(summary.invalid, 1);
  assert.equal(contacts[0].number, '07958647398');
});

test('checkCallingWindow uses Europe/London', () => {
  const threeAm = new Date('2026-01-15T03:00:00Z');
  const noon = new Date('2026-01-15T12:00:00Z');
  assert.equal(checkCallingWindow('+447958647398', threeAm).allowed, false);
  assert.equal(checkCallingWindow('+447958647398', noon).allowed, true);
});
