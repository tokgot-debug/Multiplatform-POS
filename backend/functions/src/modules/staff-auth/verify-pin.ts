import { randomBytes, timingSafeEqual } from "node:crypto";

import { Timestamp } from "firebase-admin/firestore";

import { db } from "../../lib/firebase";
import { normalizeFirestoreValue } from "../../shared/firestore-values";
import { derivePinHash, PIN_KEY_LENGTH } from "./pin-crypto";
import type { StaffPinInput, StaffPinTransactionResult } from "./types";

const MAX_FAILURES = 5;
const LOCK_DURATION_MS = 15 * 60 * 1_000;

export async function verifyStaffPin(
  authUid: string,
  input: StaffPinInput,
  timestamp: Timestamp,
): Promise<StaffPinTransactionResult> {
  // These compound IDs are existing persistence contracts. They must not be
  // changed without a data migration or a dual-read compatibility period.
  const credentialRef = db
    .collection("staff_pin_credentials")
    .doc(`${input.tenantId}_${input.staffId}`);
  const attemptRef = db
    .collection("staff_pin_attempts")
    .doc(`${authUid}_${input.staffId}`);
  const staffRef = db.collection("staff").doc(input.staffId);
  const auditRef = db.collection("audit_logs").doc();

  return db.runTransaction(async (transaction) => {
    const [credentialDocument, attemptDocument, staffDocument] =
      await transaction.getAll(credentialRef, attemptRef, staffRef);
    const attempts = attemptDocument.data() ?? {};
    const lockedUntil = attempts.lockedUntil;
    if (
      lockedUntil instanceof Timestamp
      && lockedUntil.toMillis() > timestamp.toMillis()
    ) {
      return {
        status: "locked",
        lockedUntil: lockedUntil.toDate().toISOString(),
      };
    }

    const credential = credentialDocument.data() ?? {};
    const staff = staffDocument.data() ?? {};
    const storedSalt = typeof credential.pinSaltBase64 === "string"
      ? Buffer.from(credential.pinSaltBase64, "base64")
      : randomBytes(16);
    const storedHash = typeof credential.pinHashBase64 === "string"
      ? Buffer.from(credential.pinHashBase64, "base64")
      : randomBytes(PIN_KEY_LENGTH);
    const candidateHash = await derivePinHash(input.pin, storedSalt);
    const credentialMatches =
      credentialDocument.exists
      && credential.tenantId === input.tenantId
      && credential.staffId === input.staffId
      && storedHash.length === candidateHash.length
      && timingSafeEqual(storedHash, candidateHash);
    const staffIsActive =
      staffDocument.exists
      && staff.tenantId === input.tenantId
      && staff.status === "active";

    if (!credentialMatches || !staffIsActive) {
      const failedCount = Number.isSafeInteger(attempts.failedCount)
        ? Number(attempts.failedCount) + 1
        : 1;
      const shouldLock = failedCount >= MAX_FAILURES;
      transaction.set(attemptRef, {
        tenantId: input.tenantId,
        staffId: input.staffId,
        uid: authUid,
        failedCount: shouldLock ? 0 : failedCount,
        lockedUntil: shouldLock
          ? Timestamp.fromMillis(timestamp.toMillis() + LOCK_DURATION_MS)
          : null,
        updatedAt: timestamp,
      });
      return { status: "invalid", locked: shouldLock };
    }

    transaction.delete(attemptRef);
    transaction.set(auditRef, {
      id: auditRef.id,
      tenantId: input.tenantId,
      branchId: null,
      actorStaffId: input.staffId,
      action: "staff.login",
      entityType: "staff",
      entityId: input.staffId,
      metadata: { source: "firebase-pin" },
      createdAt: timestamp,
    });
    return {
      status: "ok",
      session: {
        tenantId: input.tenantId,
        staff: normalizeFirestoreValue({ ...staff, id: input.staffId }),
        authenticatedAt: timestamp.toDate().toISOString(),
      },
    };
  });
}
