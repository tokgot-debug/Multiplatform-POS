import { randomBytes, timingSafeEqual } from "node:crypto";

import { getAuth } from "firebase-admin/auth";
import { Timestamp } from "firebase-admin/firestore";
import { logger } from "firebase-functions";
import { HttpsError, onCall } from "firebase-functions/v2/https";

import { FUNCTION_REGION } from "../../config/runtime";
import { db } from "../../lib/firebase";
import { normalizeFirestoreValue } from "../../shared/firestore-values";
import { asRecord, documentId } from "../../shared/validation";
import { derivePinHash, PIN_KEY_LENGTH } from "./pin-crypto";

const PIN_PATTERN = /^\d{4}$/;
const MAX_FAILURES = 5;
const LOCK_DURATION_MS = 15 * 60 * 1_000;

/**
 * Exchanges a staff PIN for a Firebase session carrying tenant/staff claims.
 *
 * This is the till's entry point: authenticateStaffPin cannot serve that role
 * because it requires the very claims a new till does not have yet.
 *
 * Because the caller is unauthenticated, the failure counter is keyed on the
 * staff profile rather than the calling uid - keying it on the uid would let an
 * attacker reset their own lockout by signing in anonymously again.
 *
 * ponytail: staff-keyed lockout only. Enable App Check and add a per-device
 * enrolment secret before this is exposed beyond the client's own tills.
 */
export const startTillSession = onCall(
  { region: FUNCTION_REGION },
  async (request) => {
    const input = asRecord(request.data, "Request data");
    const tenantId = documentId(input.tenantId, "tenantId");
    const staffId = documentId(input.staffId, "staffId");
    const deviceId = documentId(input.deviceId, "deviceId");
    if (typeof input.pin !== "string" || !PIN_PATTERN.test(input.pin)) {
      throw new HttpsError("invalid-argument", "PIN must contain exactly four digits.");
    }

    const now = Timestamp.now();
    const credentialRef = db
      .collection("staff_pin_credentials")
      .doc(`${tenantId}_${staffId}`);
    const attemptRef = db
      .collection("staff_pin_attempts")
      .doc(`till_${tenantId}_${staffId}`);
    const staffRef = db.collection("staff").doc(staffId);
    const deviceRef = db.collection("devices").doc(deviceId);

    const outcome = await db.runTransaction(async (transaction) => {
      const [credentialDocument, attemptDocument, staffDocument, deviceDocument] =
        await transaction.getAll(credentialRef, attemptRef, staffRef, deviceRef);

      const attempts = attemptDocument.data() ?? {};
      const lockedUntil = attempts.lockedUntil;
      if (
        lockedUntil instanceof Timestamp
        && lockedUntil.toMillis() > now.toMillis()
      ) {
        return {
          status: "locked" as const,
          lockedUntil: lockedUntil.toDate().toISOString(),
        };
      }

      const device = deviceDocument.data() ?? {};
      const deviceIsValid = deviceDocument.exists
        && device.tenantId === tenantId
        && device.status === "active";

      const credential = credentialDocument.data() ?? {};
      const staff = staffDocument.data() ?? {};

      // Always derive a hash, even when the record is missing, so a wrong
      // staff id and a wrong PIN cost the same amount of time.
      const storedSalt = typeof credential.pinSaltBase64 === "string"
        ? Buffer.from(credential.pinSaltBase64, "base64")
        : randomBytes(16);
      const storedHash = typeof credential.pinHashBase64 === "string"
        ? Buffer.from(credential.pinHashBase64, "base64")
        : randomBytes(PIN_KEY_LENGTH);
      const candidateHash = await derivePinHash(input.pin as string, storedSalt);

      const credentialMatches = credentialDocument.exists
        && credential.tenantId === tenantId
        && credential.staffId === staffId
        && storedHash.length === candidateHash.length
        && timingSafeEqual(storedHash, candidateHash);
      const staffIsActive = staffDocument.exists
        && staff.tenantId === tenantId
        && staff.status === "active";

      if (!credentialMatches || !staffIsActive || !deviceIsValid) {
        const failedCount = Number.isSafeInteger(attempts.failedCount)
          ? Number(attempts.failedCount) + 1
          : 1;
        const shouldLock = failedCount >= MAX_FAILURES;
        transaction.set(attemptRef, {
          tenantId,
          staffId,
          failedCount: shouldLock ? 0 : failedCount,
          lockedUntil: shouldLock
            ? Timestamp.fromMillis(now.toMillis() + LOCK_DURATION_MS)
            : null,
          updatedAt: now,
        });
        return { status: "invalid" as const, locked: shouldLock };
      }

      transaction.delete(attemptRef);
      return {
        status: "ok" as const,
        staff: normalizeFirestoreValue({ ...staff, id: staffId }),
        authUid: typeof staff.authUid === "string" ? staff.authUid : null,
        role: String(staff.role),
      };
    });

    if (outcome.status === "locked") {
      throw new HttpsError(
        "resource-exhausted",
        `Too many attempts. Try again after ${outcome.lockedUntil}.`,
      );
    }
    if (outcome.status === "invalid") {
      throw new HttpsError(
        "permission-denied",
        outcome.locked
          ? "Incorrect PIN. This profile is now temporarily locked."
          : "The staff profile, device or PIN is incorrect.",
      );
    }
    if (!outcome.authUid) {
      throw new HttpsError(
        "failed-precondition",
        "This staff profile has no Firebase identity. Re-run provisioning.",
      );
    }

    const claims = {
      tenant_id: tenantId,
      staff_id: staffId,
      staff_role: outcome.role,
    };
    const customToken = await getAuth().createCustomToken(outcome.authUid, claims);

    await db.collection("audit_logs").add({
      tenantId,
      branchId: null,
      actorStaffId: staffId,
      action: "staff.till_session",
      entityType: "staff",
      entityId: staffId,
      metadata: { deviceId },
      createdAt: now,
    });

    logger.info("Till session issued", { tenantId, staffId, deviceId });

    return {
      customToken,
      tenantId,
      staff: outcome.staff,
      authenticatedAt: now.toDate().toISOString(),
    };
  },
);
