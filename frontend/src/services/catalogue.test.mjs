import assert from 'node:assert/strict';
import test from 'node:test';

import { toLocalProduct } from './catalogue.js';

test('minor units become the KES floats the till prices in', () => {
  // The backend settles in integer cents; the cart and every screen still work
  // in shillings. Getting this wrong prices a beer at 25000.
  const local = toLocalProduct({ id: 'p1', tenantId: 't1', sku: 'BAR-01', sellPriceMinor: 25_000, costPriceMinor: 16_000 });

  assert.equal(local.sell_price, 250);
  assert.equal(local.cost_price, 160);
});

test('an imported product with no price is inactive and free', () => {
  const local = toLocalProduct({ id: 'p2', tenantId: 't1', sku: 'FOD-09', name: 'Pilau', isActive: false });

  assert.equal(local.sell_price, 0);
  assert.equal(local.is_active, 0);
});

test('is_active defaults to on rather than hiding a product', () => {
  assert.equal(toLocalProduct({ id: 'p3', tenantId: 't1', sku: 'X' }).is_active, 1);
});

test('booleans become the 0/1 Dexie indexes on', () => {
  // is_service and is_active are indexed; a raw boolean is not a usable key.
  const local = toLocalProduct({ id: 'p4', tenantId: 't1', sku: 'SRV-1', isService: true });

  assert.equal(local.is_service, 1);
  assert.equal(typeof local.is_active, 'number');
});

test('a product with no name falls back to something displayable', () => {
  assert.equal(toLocalProduct({ id: 'p5', tenantId: 't1', sku: 'BAR-77' }).name, 'BAR-77');
  assert.equal(toLocalProduct({ id: 'p6', tenantId: 't1' }).name, 'p6');
});
