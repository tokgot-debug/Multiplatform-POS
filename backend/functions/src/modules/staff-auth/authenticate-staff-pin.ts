import { logger } from "firebase-functions";
import { Timestamp } from "firebase-admin/firestore";
import { HttpsError, onCall } from "firebase-functions/v2/https";

import { FUNCTION_REGION } from "../../config/runtime";
import { parseStaffPinInput } from "./input";
import { verifyStaffPin } from "./verify-pin";

/**
 * Verifies the local four-digit till lock after Firebase Auth has established
 * the staff identity. It never creates an authenticated Firebase identity and
 * never returns PIN material to the browser.
 */
export const authenticateStaffPin = onCall(
  { region: FUNCTION_REGION },
  async (request) => {
    if (!request.auth) {
      throw new HttpsError(
        "unauthenticated",
        "Sign in with Firebase before unlocking a till.",
      );
    }

    const input = parseStaffPinInput(request.data);
    if (
      request.auth.token.tenant_id !== input.tenantId
      || request.auth.token.staff_id !== input.staffId
    ) {
      throw new HttpsError(
        "permission-denied",
        "The authenticated claims do not match this staff profile.",
      );
    }

    try {
      const result = await verifyStaffPin(
        request.auth.uid,
        input,
        Timestamp.now(),
      );
      if (result.status === "locked") {
        throw new HttpsError(
          "resource-exhausted",
          `Too many attempts. Try again after ${result.lockedUntil}.`,
        );
      }
      if (result.status === "invalid") {
        throw new HttpsError(
          "permission-denied",
          result.locked
            ? "Incorrect PIN. The profile is temporarily locked."
            : "The staff ID or PIN is incorrect.",
        );
      }

      return result.session;
    } catch (error) {
      if (error instanceof HttpsError) throw error;
      logger.error("authenticateStaffPin failed", {
        error,
        tenantId: input.tenantId,
        staffId: input.staffId,
        uid: request.auth.uid,
      });
      throw new HttpsError("internal", "The staff PIN could not be verified.");
    }
  },
);
