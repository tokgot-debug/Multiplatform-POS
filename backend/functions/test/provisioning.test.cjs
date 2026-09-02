const assert = require("node:assert/strict");
const test = require("node:test");

const { mapSeed, toMinor } = require("../lib/modules/provisioning/map-seed.js");

function seed(overrides = {}) {
  return {
    TENANT_ID: "tenant-01",
    tenant: {
      id: "tenant-01",
      legal_name: "Kenya Retail Group Ltd",
      trading_name: "Vanbransa",
      kra_pin: "P051234567A",
    },
    branches: [
      { id: "branch-nai-01", name: "Nairobi CBD", code: "BH001", etims_bhf_id: "00", is_active: 1 },
    ],
    device: { id: "device-till-01", branch_id: "branch-nai-01", label: "Main Till 01" },
    users: [
      { id: "user-owner", name: "Owner", email: "o@x.co", pin: "0000", role: "Owner" },
      { id: "user-cashier-1", name: "Wanjiku", email: "w@x.co", pin: "1111", role: "Cashier" },
    ],
    categories: [{ id: "cat-beers", name: "Beers" }],
    products: [
      {
        id: "prod-tusker-bottle", sku: "BAR-BEE-01", name: "Tusker 500ml",
        category_id: "cat-beers", uom: "BOTTLE", tax_code: "A",
        sell_price: 250.0, cost_price: 160.0, is_active: 1, is_service: 0,
      },
    ],
    barcodes: [{ barcode: "5449000000996", product_id: "prod-tusker-bottle" }],
    stockMovements: [
      { id: "sm-01", branch_id: "branch-nai-01", product_id: "prod-tusker-bottle", qty: 120 },
    ],
    customers: [{ id: "cust-walkin", name: "Walk-In Guest", price_tier: "RETAIL" }],
    suppliers: [{ id: "supp-01", name: "EABL", kra_pin: "P059876543Z" }],
    ...overrides,
  };
}

test("prices convert to integer minor units", () => {
  const mapped = mapSeed(seed());
  assert.equal(mapped.products[0].sellPriceMinor, 25000);
  assert.equal(mapped.products[0].costPriceMinor, 16000);
  assert.ok(Number.isSafeInteger(mapped.products[0].sellPriceMinor));
  // Float trap: 19.99 * 100 is 1998.9999999999998 before rounding.
  assert.equal(toMinor(19.99), 1999);
});

test("stock balance id matches the sales dependency contract", () => {
  const mapped = mapSeed(seed());
  const balance = mapped.stockBalances[0];
  // sales/dependencies.ts builds `${branchId}_${productId}_HOUSE`. A mismatch
  // here makes every checkout fail with a missing HOUSE balance.
  assert.equal(balance.id, "branch-nai-01_prod-tusker-bottle_HOUSE");
  assert.equal(balance.location, "HOUSE");
  assert.equal(balance.qty, 120);
  assert.equal(balance.tenantId, "tenant-01");
});

test("opening stock is never negative", () => {
  const mapped = mapSeed(seed({
    stockMovements: [
      { branch_id: "branch-nai-01", product_id: "prod-tusker-bottle", qty: 10 },
      { branch_id: "branch-nai-01", product_id: "prod-tusker-bottle", qty: -40 },
    ],
  }));
  assert.equal(mapped.stockBalances[0].qty, 0);
});

test("provisioning seeds no staff and no credentials", () => {
  // Identities come from Firebase Auth via bootstrapOwner and createStaffUser.
  // The seed used to carry a PIN per user, which shipped in the app bundle.
  const mapped = mapSeed(seed({ users: [{ id: "u1", name: "X", pin: "1111", role: "Owner" }] }));
  assert.equal("staff" in mapped, false);
  assert.equal(JSON.stringify(mapped).includes("1111"), false);
});

test("an unsupported tax code is rejected", () => {
  assert.throws(
    () => mapSeed(seed({
      products: [{ id: "p1", sku: "S", name: "N", tax_code: "Z", sell_price: 1 }],
    })),
    /unsupported tax code/,
  );
});

test("only cash is enabled until a provider webhook exists", () => {
  const mapped = mapSeed(seed());
  assert.deepEqual(mapped.settings.acceptedPaymentMethods, ["cash"]);
  assert.equal(mapped.settings.cashEnabled, true);
});

test("tenant and branch are marked active so checkout preconditions pass", () => {
  const mapped = mapSeed(seed());
  assert.equal(mapped.tenant.status, "active");
  assert.equal(mapped.branches[0].status, "active");
  assert.equal(mapped.devices[0].status, "active");
  assert.equal(mapped.customers[0].isActive, true);
});
