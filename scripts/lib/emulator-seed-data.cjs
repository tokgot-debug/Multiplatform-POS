"use strict";

const BRANCH_ID = "branch-main";
const DEVICE_ID = "device-main-till-01";
const STAFF_ID = "staff-owner-1";
const SHIFT_ID = "shift-main-open";

const categorySeeds = [
  ["category-beers", "Beers & Ciders", 10],
  ["category-spirits", "Spirits & Wines", 20],
  ["category-soft-drinks", "Soft Drinks & Water", 30],
  ["category-food", "Food & Meals", 40],
  ["category-services", "Services & Charges", 50],
];

const productSeeds = [
  {
    id: "product-tusker", sku: "BAR-BEE-01", name: "Tusker Lager 500ml",
    categoryId: "category-beers", uom: "BOTTLE", taxCode: "A",
    itemClassCode: "50202306", packageUnitCode: "BO", originCountry: "KE",
    sellPriceMinor: 25_000, costPriceMinor: 16_000, imagePath: "/ai_images/beer_glass.jpg",
  },
  {
    id: "product-guinness", sku: "BAR-BEE-02", name: "Guinness Foreign Extra 500ml",
    categoryId: "category-beers", uom: "BOTTLE", taxCode: "A",
    itemClassCode: "50202306", packageUnitCode: "BO", originCountry: "KE",
    sellPriceMinor: 28_000, costPriceMinor: 18_000, imagePath: "/ai_images/stout_glass.jpg",
  },
  {
    id: "product-jameson-tot", sku: "BAR-SPR-02", name: "Jameson Irish Whiskey (tot 30ml)",
    categoryId: "category-spirits", uom: "TOT", taxCode: "A",
    itemClassCode: "50202302", packageUnitCode: "EA", originCountry: "IE",
    sellPriceMinor: 25_000, costPriceMinor: 14_000, imagePath: "/ai_images/whiskey_glass.jpg",
  },
  {
    id: "product-coca-cola", sku: "BAR-SFT-01", name: "Coca-Cola 300ml",
    categoryId: "category-soft-drinks", uom: "BOTTLE", taxCode: "B",
    itemClassCode: "50202500", packageUnitCode: "BO", originCountry: "KE",
    sellPriceMinor: 10_000, costPriceMinor: 6_000, imagePath: "/ai_images/coke_bottle.png",
  },
  {
    id: "product-water", sku: "BAR-SFT-03", name: "Mineral Water 500ml",
    categoryId: "category-soft-drinks", uom: "BOTTLE", taxCode: "C",
    itemClassCode: "50202500", packageUnitCode: "BO", originCountry: "KE",
    sellPriceMinor: 7_000, costPriceMinor: 3_500, imagePath: "/ai_images/mineral_water.jpg",
  },
  {
    id: "product-nyama-choma", sku: "FOD-NYM-01", name: "Nyama Choma (per 0.5kg)",
    categoryId: "category-food", uom: "PORTION", taxCode: "A",
    itemClassCode: "50101700", packageUnitCode: "PK", originCountry: "KE",
    sellPriceMinor: 80_000, costPriceMinor: 50_000, imagePath: "/ai_images/nyama_choma.jpg",
  },
  {
    id: "product-table-service", sku: "SRV-TBL-01", name: "Table Service Charge",
    categoryId: "category-services", uom: "CHARGE", taxCode: "E",
    itemClassCode: "73151600", packageUnitCode: "EA", originCountry: "KE",
    sellPriceMinor: 10_000, costPriceMinor: 0, imagePath: null, isService: true,
  },
];

const stockQuantities = new Map([
  ["product-tusker", [120, 22]],
  ["product-guinness", [60, 14]],
  ["product-jameson-tot", [150, 36]],
  ["product-coca-cola", [144, 34]],
  ["product-water", [200, 48]],
  ["product-nyama-choma", [50, 10]],
]);

function createSeedDocuments({ email, now, tenantId }) {
  const documents = [];
  const add = (collection, id, data) => documents.push({ collection, id, data });

  add("tenants", tenantId, {
    id: tenantId,
    legalName: "Tokgut Local Test Business Ltd",
    tradingName: "Tokgut POS Emulator",
    kraPin: "P000000000A",
    etimsMode: "none",
    status: "active",
    currency: "KES",
    timezone: "Africa/Nairobi",
    createdAt: now,
    updatedAt: now,
  });
  add("branches", BRANCH_ID, {
    id: BRANCH_ID,
    tenantId,
    name: "Local Test Branch",
    code: "BH001",
    etimsBranchId: "00",
    status: "active",
    createdAt: now,
    updatedAt: now,
  });
  add("devices", DEVICE_ID, {
    id: DEVICE_ID,
    tenantId,
    branchId: BRANCH_ID,
    label: "Emulator Till 01",
    serialNumber: "EMULATOR-TILL-0001",
    status: "active",
    createdAt: now,
    updatedAt: now,
  });
  add("staff", STAFF_ID, {
    id: STAFF_ID,
    tenantId,
    name: "Local Emulator Owner",
    phone: "+254700000001",
    email,
    role: "owner",
    status: "active",
    createdAt: now,
    updatedAt: now,
  });

  for (const [id, name, sortOrder] of categorySeeds) {
    add("categories", id, {
      id, tenantId, name, sortOrder, isActive: true, createdAt: now, updatedAt: now,
    });
  }

  for (const seed of productSeeds) {
    add("products", seed.id, {
      ...seed,
      tenantId,
      isService: seed.isService ?? false,
      itemTypeCode: seed.isService ? "2" : "1",
      quantityUnitCode: "U",
      isActive: true,
      version: 1,
      etimsRegisteredAt: null,
      createdAt: now,
      updatedAt: now,
    });
  }

  productSeeds.slice(0, 5).forEach((product, index) => {
    const id = `barcode-${product.id.replace(/^product-/, "")}`;
    add("barcodes", id, {
      id,
      tenantId,
      productId: product.id,
      value: `50001023400${String(index + 22).padStart(2, "0")}`,
      createdAt: now,
    });
  });

  add("customers", "customer-walk-in", {
    id: "customer-walk-in",
    tenantId,
    name: "Walk-In Guest",
    phone: "",
    kraPin: null,
    email: null,
    priceTier: "retail",
    creditLimitMinor: 0,
    paymentTermsDays: 0,
    isActive: true,
    createdAt: now,
    updatedAt: now,
  });
  add("suppliers", "supplier-local", {
    id: "supplier-local",
    tenantId,
    name: "Local Test Supplier",
    phone: "+254700000002",
    email: "supplier@example.test",
    kraPin: "P000000001B",
    isActive: true,
    createdAt: now,
    updatedAt: now,
  });

  for (const [productId, [storeQty, houseQty]] of stockQuantities) {
    for (const [location, qty] of [["STORE", storeQty], ["HOUSE", houseQty]]) {
      const id = `${BRANCH_ID}_${productId}_${location}`;
      add("stock_balances", id, {
        id, tenantId, branchId: BRANCH_ID, productId, location, qty, updatedAt: now,
      });
    }
  }

  add("shifts", SHIFT_ID, {
    id: SHIFT_ID,
    tenantId,
    branchId: BRANCH_ID,
    deviceId: DEVICE_ID,
    staffId: STAFF_ID,
    status: "open",
    openingFloatMinor: 500_000,
    expectedCashMinor: 500_000,
    countedCashMinor: null,
    openedAt: now,
    closedAt: null,
    createdAt: now,
    updatedAt: now,
  });
  add("tenant_settings", tenantId, {
    tenantId,
    establishmentName: "Tokgut POS Emulator",
    receiptFooter: "Local emulator transaction - not a fiscal receipt",
    currency: "KES",
    locale: "en-KE",
    timezone: "Africa/Nairobi",
    cashEnabled: true,
    lowStockThresholdQty: 10,
    acceptedPaymentMethods: ["cash"],
    updatedAt: now,
    updatedByStaffId: STAFF_ID,
  });
  add("audit_logs", "audit-emulator-seed", {
    id: "audit-emulator-seed",
    tenantId,
    branchId: BRANCH_ID,
    actorStaffId: STAFF_ID,
    action: "emulator.seeded",
    entityType: "tenant",
    entityId: tenantId,
    metadata: { source: "scripts/seed-emulators.cjs" },
    createdAt: now,
  });

  return documents;
}

module.exports = {
  BRANCH_ID,
  DEVICE_ID,
  STAFF_ID,
  SHIFT_ID,
  createSeedDocuments,
};
