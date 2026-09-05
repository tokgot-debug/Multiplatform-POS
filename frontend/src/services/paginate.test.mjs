import assert from 'node:assert/strict';
import test from 'node:test';

import { PAGE_SIZE, paginate } from './paginate.js';

const rows = (n) => Array.from({ length: n }, (_, index) => index + 1);

test('paginate slices to the page and reports the range', () => {
  const view = paginate(rows(132), 2, 25);

  assert.deepEqual(view.rows, rows(50).slice(25));
  assert.equal(view.page, 2);
  assert.equal(view.pages, 6);
  assert.equal(view.total, 132);
  assert.equal(view.from, 26);
  assert.equal(view.to, 50);
});

test('the last page is short, not padded', () => {
  const view = paginate(rows(132), 6, 25);

  assert.equal(view.rows.length, 7);
  assert.equal(view.from, 126);
  assert.equal(view.to, 132);
});

test('a page beyond the end clamps back into range', () => {
  // The case a filter creates: sitting on page 5, then the list shrinks to 10
  // rows. Without clamping the user gets an empty table and no way back.
  const view = paginate(rows(10), 5, 25);

  assert.equal(view.page, 1);
  assert.equal(view.rows.length, 10);
  assert.equal(view.from, 1);
  assert.equal(view.to, 10);
});

test('an empty list still yields a usable view', () => {
  const view = paginate([], 3, 25);

  assert.deepEqual(view.rows, []);
  assert.equal(view.page, 1);
  assert.equal(view.pages, 1);
  assert.equal(view.total, 0);
  assert.equal(view.from, 0);
  assert.equal(view.to, 0);
});

test('junk page and size arguments fall back rather than throwing', () => {
  for (const page of [0, -4, NaN, undefined, null, 'abc', 1.7]) {
    const view = paginate(rows(30), page, 25);
    assert.equal(view.page >= 1 && view.page <= view.pages, true, `page ${page}`);
  }

  for (const size of [0, -1, NaN, undefined, 'abc']) {
    assert.equal(paginate(rows(30), 1, size).rows.length, Math.min(30, PAGE_SIZE), `size ${size}`);
  }

  assert.deepEqual(paginate(null, 1, 25).rows, []);
});
