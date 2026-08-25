import { HttpsError } from "firebase-functions/v2/https";

import { asRecord, documentId } from "../../shared/validation";
import type { StaffPinInput } from "./types";

const PIN_PATTERN = /^\d{4}$/;

export function parseStaffPinInput(value: unknown): StaffPinInput {
  const input = asRecord(value, "Request data");
  if (typeof input.pin !== "string" || !PIN_PATTERN.test(input.pin)) {
    throw new HttpsError(
      "invalid-argument",
      "PIN must contain exactly four digits.",
    );
  }

  return {
    tenantId: documentId(input.tenantId, "tenantId"),
    staffId: documentId(input.staffId, "staffId"),
    pin: input.pin,
  };
}
