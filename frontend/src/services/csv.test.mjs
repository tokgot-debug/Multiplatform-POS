import assert from 'node:assert/strict';
import test from 'node:test';

import { ensureUniqueSkus, matchColumns, parseProductCsv, splitCsvLine } from './csv.js';

test('a repeated code carrying different products keeps every one of them', () => {
  // The failure this exists for: a Category column read as the SKU collapses
  // 2636 rows onto a handful of products and reports it as a success.
  const { rows, generated } = ensureUniqueSkus([
    { sku: 'BEER', name: 'Tusker Lager' },
    { sku: 'BEER', name: 'White Cap' },
    { sku: 'BEER', name: 'Guinness' }
  ]);

  assert.equal(rows.length, 3);
  assert.equal(generated, 2);
  assert.equal(new Set(rows.map((row) => row.sku)).size, 3);
});

test('the same product listed twice is dropped, not duplicated', () => {
  const { rows, duplicates } = ensureUniqueSkus([
    { sku: 'BAR-01', name: 'Tusker Lager' },
    { sku: 'BAR-01', name: 'Tusker Lager' }
  ]);

  assert.equal(rows.length, 1);
  assert.equal(duplicates, 1);
});

test('rows with no SKU fall back to their name and stay distinct', () => {
  const { rows } = ensureUniqueSkus([
    { sku: '', name: 'Pilau' },
    { sku: '', name: 'Ugali' },
    { sku: '', name: 'Pilau' }
  ]);

  assert.deepEqual(rows.map((row) => row.sku), ['Pilau', 'Ugali']);
});

test('matching is case and space insensitive', () => {
  const { rows, generated } = ensureUniqueSkus([
    { sku: ' bar-01 ', name: 'Tusker' },
    { sku: 'BAR-01', name: 'White Cap' }
  ]);

  assert.equal(generated, 1);
  assert.equal(new Set(rows.map((row) => String(row.sku).toUpperCase())).size, 2);
});

test('a row with neither code nor name is left for the server to reject', () => {
  const { rows } = ensureUniqueSkus([{ sku: '', name: '' }]);
  assert.equal(rows.length, 1);
});

test('quoted cells survive the commas inside them', () => {
  // A menu is full of names like this; a plain split(',') shifts every column
  // after it and silently imports the price as the unit of measure.
  assert.deepEqual(
    splitCsvLine('BAR-01,"Nyama Choma, 1/2 kg",800'),
    ['BAR-01', 'Nyama Choma, 1/2 kg', '800']
  );
});

test('a doubled quote is one literal quote', () => {
  assert.deepEqual(splitCsvLine('A,"He said ""hi""",2'), ['A', 'He said "hi"', '2']);
});

test('columns match whatever the restaurant called them', () => {
  assert.deepEqual(
    matchColumns(['Item Code', 'Menu Item', 'Selling Price', 'Buying Price']),
    { sku: 'Item Code', name: 'Menu Item', sellPrice: 'Selling Price', costPrice: 'Buying Price' }
  );
});

test('one header is never claimed by two fields', () => {
  const mapping = matchColumns(['Price', 'Cost']);
  assert.notEqual(mapping.sellPrice, mapping.costPrice);
});

test('a file parses into importable rows', () => {
  const { rows, mapping, error } = parseProductCsv(
    'SKU,Product Name,Price\nBAR-01,Tusker Lager,250\nFOD-02,"Pilau, full",0\n'
  );

  assert.equal(error, null);
  assert.equal(mapping.sellPrice, 'Price');
  assert.deepEqual(rows, [
    { sku: 'BAR-01', name: 'Tusker Lager', sellPrice: '250' },
    { sku: 'FOD-02', name: 'Pilau, full', sellPrice: '0' }
  ]);
});

test('a file with no name or SKU column is refused with its headers shown', () => {
  const { error, rows } = parseProductCsv('Colour,Weight\nred,2\n');
  assert.match(error, /No product name or SKU column/);
  assert.match(error, /Colour, Weight/);
  assert.equal(rows.length, 0);
});

test('a header-only file is refused', () => {
  assert.match(parseProductCsv('SKU,Name,Price\n').error, /at least one product/);
});
