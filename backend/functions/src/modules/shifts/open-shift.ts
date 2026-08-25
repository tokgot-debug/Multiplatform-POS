import { Timestamp } from "firebase-admin/firestore";
import { HttpsError, onCall } from "firebase-functions/v2/https";

import { FUNCTION_REGION } from "../../config/runtime";
import { db } from "../../lib/firebase";
import { deterministicId } from "../../shared/identifiers";
import { asRecord, documentId, minorUnits } from "../../shared/validation";

/**
 * Opens (or returns) the caller's shift on a device.
 *
 * createSale refuses to run without an open shift belonging to the selling
 * staff member on that exact device, so a till cannot transact until this has
 * been called. The staff id comes from the verified claims, never the request
 * body: a cashier must not be able to open a shift in someone else's name.
 */
export const openShift = onCall(
  { region: FUNCTION_REGION },
  async (request) => {
    if (!request.auth) {
      throw new HttpsError("unauthenticated", "Start a till session first.");
    }

    const claims = request.auth.token;
    const tenantId = typeof claims.tenant_id === "string" ? claims.tenant_id : null;
    const staffId = typeof claims.staff_id === "string" ? claims.staff_id : null;
    if (!tenantId || !staffId) {
      throw new HttpsError("permission-denied", "This session carries no staff claims.");
    }

    const input = asRecord(request.data, "Request data");
    const branchId = documentId(input.branchId, "branchId");
    const deviceId = documentId(input.deviceId, "deviceId");
    const openingFloatMinor = input.openingFloatMinor === undefined
      ? 0
      : minorUnits(input.openingFloatMinor, "openingFloatMinor");

    const now = Timestamp.now();
    const deviceRef = db.collection("devices").doc(deviceId);
    const branchRef = db.collection("branches").doc(branchId);

    // One open shift per staff member per device. Re-calling is idempotent so a
    // till that reloads mid-service does not strand or duplicate its shift.
    const shiftId = deterministicId("shift", `${tenantId}:${deviceId}:${staffId}`);
    const shiftRef = db.collection("shifts").doc(shiftId);

    return db.runTransaction(async (transaction) => {
      const [deviceDocument, branchDocument, shiftDocument] =
        await transaction.getAll(deviceRef, branchRef, shiftRef);

      const device = deviceDocument.data() ?? {};
      if (
        !deviceDocument.exists
        || device.tenantId !== tenantId
        || device.branchId !== branchId
        || device.status !== "active"
      ) {
        throw new HttpsError("failed-precondition", "Device is not active for this branch.");
      }

      const branch = branchDocument.data() ?? {};
      if (
        !branchDocument.exists
        || branch.tenantId !== tenantId
        || branch.status !== "active"
      ) {
        throw new HttpsError("failed-precondition", "Branch is not active for this tenant.");
      }

      const existing = shiftDocument.data() ?? {};
      if (shiftDocument.exists && existing.status === "open") {
        // createSale increments expectedCashMinor and rejects the sale if it is
        // absent, so backfill any shift opened before the field existed.
        if (!Number.isSafeInteger(existing.expectedCashMinor)) {
          transaction.update(shiftRef, {
            expectedCashMinor: Number.isSafeInteger(existing.openingFloatMinor)
              ? Number(existing.openingFloatMinor)
              : 0,
          });
        }
        return { shiftId, reused: true, openedAt: existing.openedAt ?? null };
      }

      transaction.set(shiftRef, {
        id: shiftId,
        tenantId,
        branchId,
        deviceId,
        staffId,
        status: "open",
        openingFloatMinor,
        // What the drawer should hold: the float plus every cash sale since.
        expectedCashMinor: openingFloatMinor,
        openedAt: now,
        closedAt: null,
      });

      return { shiftId, reused: false, openedAt: now.toDate().toISOString() };
    });
  },
);
