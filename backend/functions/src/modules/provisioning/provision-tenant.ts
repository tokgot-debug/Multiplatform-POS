import { randomBytes } from "node:crypto";

import { getAuth } from "firebase-admin/auth";
import { FieldValue, Timestamp } from "firebase-admin/firestore";
import { logger } from "firebase-functions";
import { defineSecret } from "firebase-functions/params";
import { HttpsError, onCall } from "firebase-functions/v2/https";

import { FUNCTION_REGION } from "../../config/runtime";
import { db } from "../../lib/firebase";
import { derivePinHash } from "../staff-auth/pin-crypto";
import { mapSeed } from "./map-seed";
import type { SeedPayload } from "./types";

/**
 * Shared secret required to run provisioning, set with:
 *   firebase functions:secrets:set POS_BOOTSTRAP_SECRET
 *
 * This callable can mint staff identities and rewrite the catalogue, so it is
 * meant to be deployed, run once, and then removed again.
 */
const BOOTSTRAP_SECRET = defineSecret("POS_BOOTSTRAP_SECRET");

export const provisionTenant = onCall(
  { region: FUNCTION_REGION, secrets: [BOOTSTRAP_SECRET], timeoutSeconds: 300 },
  async (request) => {
    const data = (request.data ?? {}) as SeedPayload & {
      bootstrapSecret?: string;
      force?: boolean;
    };

    const expected = BOOTSTRAP_SECRET.value();
    if (!expected) {
      throw new HttpsError("failed-precondition", "No bootstrap secret is configured.");
    }
    if (typeof data.bootstrapSecret !== "string" || data.bootstrapSecret !== expected) {
      throw new HttpsError("permission-denied", "Invalid bootstrap secret.");
    }

    const seed = mapSeed(data);
    const tenantRef = db.collection("tenants").doc(seed.tenantId);

    // Refuse to trample an already-live tenant unless explicitly forced. A
    // second accidental run would otherwise reset prices and stock.
    if ((await tenantRef.get()).exists && data.force !== true) {
      throw new HttpsError(
        "already-exists",
        `Tenant ${seed.tenantId} is already provisioned. Pass force:true to overwrite.`,
      );
    }

    const now = Timestamp.now();
    const auth = getAuth();
    const createdStaff: { staffId: string; uid: string; email: string }[] = [];

    // 1. Auth identities and custom claims. Firestore rules read these claims,
    //    so a staff member without them can see nothing at all.
    for (const staff of seed.staff) {
      const password = randomBytes(24).toString("base64url");
      let uid: string;
      try {
        const existing = await auth.getUserByEmail(staff.email);
        uid = existing.uid;
        await auth.updateUser(uid, { displayName: staff.name });
      } catch {
        const created = await auth.createUser({
          email: staff.email,
          password,
          displayName: staff.name,
          emailVerified: true,
        });
        uid = created.uid;
      }

      await auth.setCustomUserClaims(uid, {
        tenant_id: seed.tenantId,
        staff_id: staff.id,
        staff_role: staff.role,
      });
      createdStaff.push({ staffId: staff.id, uid, email: staff.email });
    }

    // 2. Firestore documents, batched. Well under the 500-write limit for this
    //    dataset, but chunked so a larger catalogue does not silently break.
    const writes: { ref: FirebaseFirestore.DocumentReference; data: unknown }[] = [];
    const push = (path: string, id: string, value: Record<string, unknown>) =>
      writes.push({ ref: db.collection(path).doc(id), data: value });

    push("tenants", seed.tenantId, { ...seed.tenant, updatedAt: now });
    push("tenant_settings", seed.tenantId, { ...seed.settings, updatedAt: now });
    for (const branch of seed.branches) push("branches", branch.id, branch);
    for (const device of seed.devices) push("devices", device.id, device);
    for (const category of seed.categories) push("categories", category.id, category);
    for (const product of seed.products) push("products", product.id, product);
    for (const barcode of seed.barcodes) push("barcodes", barcode.id, barcode);
    for (const customer of seed.customers) push("customers", customer.id, customer);
    for (const supplier of seed.suppliers) push("suppliers", supplier.id, supplier);
    for (const balance of seed.stockBalances) {
      push("stock_balances", balance.id, { ...balance, updatedAt: now });
    }

    for (const staff of seed.staff) {
      const record = createdStaff.find((entry) => entry.staffId === staff.id);
      push("staff", staff.id, {
        tenantId: seed.tenantId,
        name: staff.name,
        email: staff.email,
        phone: staff.phone,
        role: staff.role,
        status: "active",
        authUid: record?.uid ?? null,
      });

      // PIN material never leaves the server; only salt and hash are stored.
      const salt = randomBytes(16);
      const hash = await derivePinHash(staff.pin, salt);
      push("staff_pin_credentials", `${seed.tenantId}_${staff.id}`, {
        tenantId: seed.tenantId,
        staffId: staff.id,
        pinSaltBase64: salt.toString("base64"),
        pinHashBase64: hash.toString("base64"),
        updatedAt: now,
      });
    }

    // Invoice counter starts where the branch has not sold anything yet.
    for (const branch of seed.branches) {
      push("counters", `sales_${seed.tenantId}_${branch.id}`, {
        tenantId: seed.tenantId,
        branchId: branch.id,
        value: 0,
      });
    }

    for (let i = 0; i < writes.length; i += 400) {
      const batch = db.batch();
      for (const write of writes.slice(i, i + 400)) {
        batch.set(write.ref, write.data as Record<string, unknown>, { merge: true });
      }
      await batch.commit();
    }

    await db.collection("audit_logs").add({
      tenantId: seed.tenantId,
      branchId: null,
      actorStaffId: null,
      action: "tenant.provisioned",
      entityType: "tenant",
      entityId: seed.tenantId,
      metadata: {
        staff: createdStaff.length,
        products: seed.products.length,
        documents: writes.length,
      },
      createdAt: FieldValue.serverTimestamp(),
    });

    logger.info("Tenant provisioned", {
      tenantId: seed.tenantId,
      documents: writes.length,
      staff: createdStaff.length,
    });

    return {
      tenantId: seed.tenantId,
      documentsWritten: writes.length,
      staff: createdStaff.map((entry) => ({ staffId: entry.staffId, email: entry.email })),
      products: seed.products.length,
      stockBalances: seed.stockBalances.length,
    };
  },
);
