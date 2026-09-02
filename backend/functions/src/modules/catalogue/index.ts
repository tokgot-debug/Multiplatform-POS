/**
 * Bulk catalogue import.
 *
 * provisionTenant is the only other thing that writes products, and it rewrites
 * a whole tenant from a seed file. This upserts a batch instead, so a manager
 * can load a supplier list into an empty catalogue and correct it afterwards.
 *
 * A row priced at zero is imported and reported, not rejected: the client would
 * rather have the names in and price them later than block the whole file. Such
 * a product is created inactive so nobody can ring it up for nothing before
 * somebody has looked at it.
 */

import { Timestamp } from "firebase-admin/firestore";
import { HttpsError, onCall } from "firebase-functions/v2/https";

import { FUNCTION_REGION } from "../../config/runtime";
import { db } from "../../lib/firebase";
import { deterministicId } from "../../shared/identifiers";
import { ADMIN_ROLES } from "../../shared/roles";
import { asRecord } from "../../shared/validation";
import { TAX_BASIS_POINTS } from "../sales/constants";

/**
 * Firestore caps a batch at 500 writes and each row is one, so this is the
 * limit per call rather than per file. The till splits a larger sheet into
 * chunks of this size and reports progress across them.
 */
export const MAX_ROWS = 500;
const MAX_TEXT = 200;

export interface ImportIssue {
  row: number;
  sku: string;
  message: string;
}

function text(value: unknown, fallback = ""): string {
  if (typeof value === "number") return String(value);
  if (typeof value !== "string") return fallback;
  return value.trim().slice(0, MAX_TEXT) || fallback;
}

/**
 * "1,250.00", "KES 400", "" -> minor units.
 *
 * Spreadsheets export money with thousands separators and currency prefixes,
 * and a blank cell means zero rather than an error.
 */
export function priceToMinor(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return 0;
  const cleaned = String(value).replace(/[^0-9.\-]/g, "");
  if (cleaned === "" || cleaned === "-") return 0;

  const parsed = Number(cleaned);
  if (!Number.isFinite(parsed) || parsed < 0) return null;

  const minor = Math.round(parsed * 100);
  return Number.isSafeInteger(minor) ? minor : null;
}

export const importProducts = onCall(
  { region: FUNCTION_REGION, timeoutSeconds: 300 },
  async (request) => {
    if (!request.auth) throw new HttpsError("unauthenticated", "Sign in first.");
    const claims = request.auth.token;
    const tenantId = typeof claims.tenant_id === "string" ? claims.tenant_id : null;
    const staffId = typeof claims.staff_id === "string" ? claims.staff_id : null;
    const role = typeof claims.staff_role === "string" ? claims.staff_role : "";
    if (!tenantId || !staffId) {
      throw new HttpsError("permission-denied", "This session carries no staff claims.");
    }
    if (!ADMIN_ROLES.has(role)) {
      throw new HttpsError("permission-denied", "Only an owner or store manager can import products.");
    }

    const input = asRecord(request.data, "Request data");
    const rows = Array.isArray(input.rows) ? input.rows : null;
    if (!rows || rows.length === 0) {
      throw new HttpsError("invalid-argument", "The file contained no rows.");
    }
    if (rows.length > MAX_ROWS) {
      throw new HttpsError(
        "invalid-argument",
        `Send at most ${MAX_ROWS} rows per call; this one carried ${rows.length}.`,
      );
    }

    const rejected: ImportIssue[] = [];
    const unpriced: ImportIssue[] = [];
    const batch = db.batch();
    const seen = new Set<string>();
    let imported = 0;

    rows.forEach((raw, index) => {
      // Row 1 is the header in the file the person is looking at.
      const line = index + 2;
      const row = (raw ?? {}) as Record<string, unknown>;

      const name = text(row.name);
      const sku = text(row.sku, name);
      if (!name) {
        rejected.push({ row: line, sku, message: "No product name." });
        return;
      }
      if (!sku) {
        rejected.push({ row: line, sku: "", message: "No SKU and no name to fall back on." });
        return;
      }
      if (seen.has(sku)) {
        rejected.push({ row: line, sku, message: "Duplicate SKU in this file." });
        return;
      }

      const taxCode = text(row.taxCode, "A").toUpperCase();
      if (!Object.prototype.hasOwnProperty.call(TAX_BASIS_POINTS, taxCode)) {
        rejected.push({ row: line, sku, message: `Unknown tax code "${taxCode}".` });
        return;
      }

      const sellPriceMinor = priceToMinor(row.sellPrice);
      const costPriceMinor = priceToMinor(row.costPrice);
      if (sellPriceMinor === null || costPriceMinor === null) {
        rejected.push({ row: line, sku, message: "Price is not a number." });
        return;
      }

      if (sellPriceMinor === 0) {
        unpriced.push({ row: line, sku, message: `${name} imported with no price.` });
      }

      seen.add(sku);
      const id = deterministicId("product", `${tenantId}:${sku}`);
      batch.set(
        db.collection("products").doc(id),
        {
          id,
          tenantId,
          sku,
          name,
          categoryId: text(row.categoryId) || null,
          uom: text(row.uom, "EACH"),
          sellPriceMinor,
          costPriceMinor,
          taxCode,
          isService: false,
          // Unpriced items exist but cannot be sold until someone prices them.
          isActive: sellPriceMinor > 0,
          updatedAt: Timestamp.now(),
        },
        { merge: true },
      );
      imported += 1;
    });

    // A chunk where every row is unusable is reported, not thrown: the caller
    // is walking a large sheet and one bad block must not lose the rest.
    if (imported > 0) await batch.commit();

    await db.collection("audit_logs").add({
      tenantId,
      branchId: null,
      actorStaffId: staffId,
      action: "catalogue.imported",
      entityType: "product",
      entityId: null,
      metadata: { imported, unpriced: unpriced.length, rejected: rejected.length },
      createdAt: Timestamp.now(),
    });

    return { imported, unpriced, rejected };
  },
);
