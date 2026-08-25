import { logger } from "firebase-functions";
import { HttpsError, onCall } from "firebase-functions/v2/https";

import { FUNCTION_REGION } from "../../config/runtime";
import { parseSaleInput } from "./input";
import { executeCreateSale } from "./transaction";

export const createSale = onCall(
  { region: FUNCTION_REGION },
  async (request) => {
    if (!request.auth) {
      throw new HttpsError("unauthenticated", "Sign in before creating a sale.");
    }

    const input = parseSaleInput(request.data);
    if (request.auth.token.tenant_id !== input.tenantId) {
      throw new HttpsError(
        "permission-denied",
        "The authenticated account does not belong to this tenant.",
      );
    }
    if (request.auth.token.staff_id !== input.staffId) {
      throw new HttpsError(
        "permission-denied",
        "The authenticated staff claim does not match this sale.",
      );
    }

    try {
      return await executeCreateSale(input);
    } catch (error) {
      if (error instanceof HttpsError) throw error;
      logger.error("createSale transaction failed", {
        error,
        tenantId: input.tenantId,
        branchId: input.branchId,
        uid: request.auth.uid,
      });
      throw new HttpsError("internal", "The sale could not be created.");
    }
  },
);
