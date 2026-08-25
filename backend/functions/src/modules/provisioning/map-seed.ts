import { HttpsError } from "firebase-functions/v2/https";

import { TAX_BASIS_POINTS } from "../sales/constants";
import type { MappedSeed, MappedStaff, SeedPayload } from "./types";

/** The till's role labels -> the role codes the backend authorises against. */
const ROLE_MAP: Record<string, string> = {
  "Owner": "owner",
  "Store Manager": "store_manager",
  "Supervisor": "supervisor",
  "Cashier": "cashier",
  "Bar Staff": "bar_staff",
  "Store Keeper": "store_keeper",
};

/** KES float -> integer minor units, rounded off the string form. */
export function toMinor(value: unknown): number {
  const amount = Number(value);
  if (!Number.isFinite(amount)) return 0;
  return Math.round(Number((amount * 100).toFixed(4)));
}

function text(value: unknown, fallback = ""): string {
  return typeof value === "string" && value.trim() ? value.trim() : fallback;
}

function requireId(value: unknown, label: string): string {
  const id = text(value);
  if (!id) throw new HttpsError("invalid-argument", `${label} is missing an id.`);
  return id;
}

export function mapSeed(payload: SeedPayload): MappedSeed {
  const tenantSource = payload.tenant ?? {};
  const tenantId = text(payload.TENANT_ID) || requireId(tenantSource.id, "tenant");

  const branchSources = payload.branches ?? [];
  if (branchSources.length === 0) {
    throw new HttpsError("invalid-argument", "At least one branch is required.");
  }

  const branches = branchSources.map((branch) => ({
    id: requireId(branch.id, "branch"),
    tenantId,
    name: text(branch.name, "Branch"),
    code: text(branch.code, "BH001"),
    etimsBranchId: text(branch.etims_bhf_id, "00"),
    status: branch.is_active === 0 ? "inactive" : "active",
  }));

  const deviceSources = payload.devices ?? (payload.device ? [payload.device] : []);
  const devices = deviceSources.map((device) => ({
    id: requireId(device.id, "device"),
    tenantId,
    branchId: text(device.branch_id, branches[0].id),
    label: text(device.label, "Till"),
    status: "active",
  }));

  const staff: MappedStaff[] = (payload.users ?? []).map((user) => {
    const role = ROLE_MAP[text(user.role)];
    if (!role) {
      throw new HttpsError("invalid-argument", `Unknown staff role "${String(user.role)}".`);
    }
    const pin = text(user.pin);
    if (!/^\d{4}$/.test(pin)) {
      throw new HttpsError("invalid-argument", `Staff ${String(user.id)} needs a four-digit PIN.`);
    }
    const id = requireId(user.id, "staff");
    return {
      id,
      name: text(user.name, id),
      // Auth needs a unique address; fall back to a routable-looking local one.
      email: text(user.email, `${id}@${tenantId}.local`),
      phone: text(user.phone),
      role,
      pin,
    };
  });

  const products = (payload.products ?? []).map((product) => {
    const id = requireId(product.id, "product");
    const taxCode = text(product.tax_code, "A");
    if (!Object.prototype.hasOwnProperty.call(TAX_BASIS_POINTS, taxCode)) {
      throw new HttpsError("invalid-argument", `Product ${id} has unsupported tax code "${taxCode}".`);
    }
    return {
      id,
      tenantId,
      sku: text(product.sku, id),
      name: text(product.name, id),
      categoryId: text(product.category_id),
      uom: text(product.uom, "EACH"),
      sellPriceMinor: toMinor(product.sell_price),
      costPriceMinor: toMinor(product.cost_price),
      taxCode,
      itemClassCode: text(product.item_cls_cd),
      isService: product.is_service === 1 || product.is_service === true,
      isActive: product.is_active !== 0,
      imagePath: text(product.image_data) || null,
    };
  });

  const productById = new Map(products.map((product) => [product.id, product]));

  // Opening HOUSE balances. The till seeds movements into STORE, but a sale can
  // only draw on HOUSE, so the opening quantity is placed there to make the
  // deployed catalogue sellable.
  const balanceQty = new Map<string, number>();
  for (const movement of payload.stockMovements ?? []) {
    const productId = text(movement.product_id);
    const branchId = text(movement.branch_id, branches[0].id);
    if (!productById.has(productId)) continue;
    const qty = Number(movement.qty);
    if (!Number.isFinite(qty)) continue;
    const key = `${branchId}_${productId}`;
    balanceQty.set(key, (balanceQty.get(key) ?? 0) + Math.trunc(qty));
  }

  const stockBalances = [...balanceQty.entries()].map(([key, qty]) => {
    const separator = key.indexOf("_");
    const branchId = key.slice(0, separator);
    const productId = key.slice(separator + 1);
    return {
      // Must match stockBalanceId() in sales/dependencies.ts exactly.
      id: `${branchId}_${productId}_HOUSE`,
      tenantId,
      branchId,
      productId,
      location: "HOUSE",
      qty: Math.max(0, qty),
    };
  });

  return {
    tenantId,
    tenant: {
      id: tenantId,
      tenantId,
      legalName: text(tenantSource.legal_name, "Vanbransa"),
      tradingName: text(tenantSource.trading_name, "Vanbransa"),
      kraPin: text(tenantSource.kra_pin),
      etimsMode: text(tenantSource.etims_mode, "OSCU"),
      status: "active",
    },
    settings: {
      tenantId,
      establishmentName: text(tenantSource.trading_name, "Vanbransa"),
      receiptFooter: "Thank you for your business.",
      locale: "en-KE",
      timezone: "Africa/Nairobi",
      cashEnabled: true,
      lowStockThresholdQty: 10,
      // Only cash is enabled at provisioning: the other methods require a
      // verified payment intent that no provider webhook creates yet.
      acceptedPaymentMethods: ["cash"],
      updatedByStaffId: null,
    },
    branches,
    devices,
    categories: (payload.categories ?? []).map((category) => ({
      id: requireId(category.id, "category"),
      tenantId,
      name: text(category.name, "General"),
      isActive: true,
    })),
    products,
    barcodes: (payload.barcodes ?? [])
      .filter((barcode) => text(barcode.barcode))
      .map((barcode) => ({
        id: text(barcode.barcode),
        tenantId,
        productId: text(barcode.product_id),
        value: text(barcode.barcode),
      })),
    customers: (payload.customers ?? []).map((customer) => ({
      id: requireId(customer.id, "customer"),
      tenantId,
      name: text(customer.name, "Guest"),
      phone: text(customer.phone),
      kraPin: text(customer.kra_pin),
      priceTier: text(customer.price_tier, "RETAIL"),
      isActive: true,
    })),
    suppliers: (payload.suppliers ?? []).map((supplier) => ({
      id: requireId(supplier.id, "supplier"),
      tenantId,
      name: text(supplier.name, "Supplier"),
      kraPin: text(supplier.kra_pin),
      phone: text(supplier.phone),
      email: text(supplier.email),
      isActive: true,
    })),
    staff,
    stockBalances,
  };
}
