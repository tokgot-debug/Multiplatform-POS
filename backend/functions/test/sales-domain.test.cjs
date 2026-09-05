const assert = require("node:assert/strict");
const test = require("node:test");

const {
  assertDiscountPermission,
  calculateSaleTotals,
  prepareSaleLines,
} = require("../lib/modules/sales/domain.js");
const {
  saleRequestFingerprint,
} = require("../lib/modules/sales/fingerprint.js");
const { parseSaleInput } = require("../lib/modules/sales/input.js");

function request(overrides = {}) {
  return {
    tenantId: "tenant-1",
    branchId: "branch-1",
    deviceId: "device-1",
    shiftId: "shift-1",
    staffId: "staff-1",
    customerId: "customer-1",
    idempotencyKey: "checkout-0001",
    tableNumber: "A4",
    buyerKraPin: "P051234567A",
    lines: [{ productId: "product-1", qty: 2 }],
    payments: [{ method: "cash", amountMinor: 2_000 }],
    ...overrides,
  };
}

function productDocument(overrides = {}) {
  return {
    exists: true,
    data: () => ({
      tenantId: "tenant-1",
      isActive: true,
      sellPriceMinor: 1_000,
      taxCode: "A",
      sku: "SKU-1",
      name: "Test product",
      isService: false,
      ...overrides,
    }),
  };
}

test("sale input normalizes optional values and keeps server DTO limits", () => {
  const parsed = parseSaleInput(request());

  assert.equal(parsed.buyerKraPin, "P051234567A");
  assert.equal(parsed.lines[0].discountMinor, 0);
  assert.equal(parsed.payments[0].reference, null);
});

test("one digital provider reference cannot fund multiple payment entries", () => {
  assert.throws(
    () => parseSaleInput(request({
      payments: [
        { method: "mpesa", amountMinor: 1_000, reference: "QK-123" },
        { method: "mpesa", amountMinor: 1_000, reference: "qk-123" },
      ],
    })),
    (error) => error.code === "invalid-argument"
      && error.message.includes("only settle one payment entry"),
  );
});

test("buyer KRA PIN is validated before the transaction starts", () => {
  assert.throws(
    () => parseSaleInput(request({ buyerKraPin: "not-a-pin" })),
    (error) => error.code === "invalid-argument"
      && error.message.includes("KRA PIN format"),
  );
});

test("pricing uses authoritative products and inclusive tax", () => {
  const parsed = parseSaleInput(request());
  const lines = prepareSaleLines(parsed.lines, [productDocument()], parsed.tenantId);
  const totals = calculateSaleTotals(lines, parsed.payments);

  assert.equal(lines[0].taxMinor, 276);
  assert.deepEqual(totals, {
    subtotalMinor: 2_000,
    discountMinor: 0,
    taxMinor: 276,
    totalMinor: 2_000,
  });
});

test("unknown product tax codes fail closed", () => {
  const parsed = parseSaleInput(request());
  assert.throws(
    () => prepareSaleLines(
      parsed.lines,
      [productDocument({ taxCode: "UNKNOWN" })],
      parsed.tenantId,
    ),
    (error) => error.code === "failed-precondition"
      && error.message.includes("supported tax code"),
  );
});

test("frontline staff cannot submit client-selected discounts", () => {
  const parsed = parseSaleInput(request({
    lines: [{ productId: "product-1", qty: 2, discountMinor: 100 }],
    payments: [{ method: "cash", amountMinor: 1_900 }],
  }));
  const lines = prepareSaleLines(parsed.lines, [productDocument()], parsed.tenantId);

  assert.throws(
    () => assertDiscountPermission(lines, "cashier"),
    (error) => error.code === "permission-denied",
  );
  assert.doesNotThrow(() => assertDiscountPermission(lines, "owner"));
});

test("idempotency fingerprints bind a key to the complete normalized request", () => {
  const original = parseSaleInput(request());
  const changed = parseSaleInput(request({ tableNumber: "B7" }));

  assert.equal(saleRequestFingerprint(original), saleRequestFingerprint(original));
  assert.notEqual(saleRequestFingerprint(original), saleRequestFingerprint(changed));
});
