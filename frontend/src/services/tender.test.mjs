import assert from 'node:assert/strict';
import test from 'node:test';

import { mapPaymentMethod, toMinor } from './tender.js';

test('toMinor converts KES floats to integer minor units', () => {
  assert.equal(toMinor(0), 0);
  assert.equal(toMinor(1), 100);
  assert.equal(toMinor(250.5), 25050);
  // Float representation traps: naive `x * 100` truncates a cent on these.
  assert.equal(toMinor(19.99), 1999);
  assert.equal(toMinor(1.005), 101);
  assert.equal(toMinor(8.87), 887);
});

test('toMinor never emits a fractional or NaN amount', () => {
  for (const bad of [undefined, null, '', 'abc', NaN, Infinity]) {
    assert.equal(toMinor(bad), 0, `expected 0 for ${String(bad)}`);
  }
  assert.ok(Number.isSafeInteger(toMinor(1234.567)));
});

test('mapPaymentMethod normalises local tender codes', () => {
  assert.equal(mapPaymentMethod('CASH'), 'cash');
  assert.equal(mapPaymentMethod('cash'), 'cash');
  assert.equal(mapPaymentMethod('MPESA'), 'mpesa');
  assert.equal(mapPaymentMethod('PAYSTACK_CARD'), 'card');
  assert.equal(mapPaymentMethod('BANK'), 'bank_transfer');
});

test('mapPaymentMethod returns null for anything unrecognised', () => {
  // Must stay null: the outbox holds such a sale instead of guessing a tender.
  for (const bad of ['BITCOIN', '', undefined, null, 'SPLIT']) {
    assert.equal(mapPaymentMethod(bad), null, `expected null for ${String(bad)}`);
  }
});
