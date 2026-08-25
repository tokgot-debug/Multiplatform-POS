import { HttpsError } from "firebase-functions/v2/https";

export const MAX_MINOR_UNITS = 1_000_000_000_000;

const DOCUMENT_ID_PATTERN = /^[A-Za-z0-9_-]{1,128}$/;

export function asRecord(
  value: unknown,
  field = "request data",
): Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new HttpsError("invalid-argument", `${field} must be an object.`);
  }

  return value as Record<string, unknown>;
}

export function documentId(value: unknown, field: string): string {
  if (typeof value !== "string" || !DOCUMENT_ID_PATTERN.test(value)) {
    throw new HttpsError(
      "invalid-argument",
      `${field} must contain 1-128 letters, numbers, underscores, or hyphens.`,
    );
  }

  return value;
}

export function optionalText(
  value: unknown,
  field: string,
  maxLength: number,
): string | null {
  if (value === undefined || value === null || value === "") return null;
  if (typeof value !== "string" || value.trim().length > maxLength) {
    throw new HttpsError(
      "invalid-argument",
      `${field} must be a string of at most ${maxLength} characters.`,
    );
  }

  return value.trim();
}

export function minorUnits(
  value: unknown,
  field: string,
  allowZero = true,
): number {
  if (
    typeof value !== "number"
    || !Number.isSafeInteger(value)
    || (allowZero ? value < 0 : value <= 0)
    || value > MAX_MINOR_UNITS
  ) {
    throw new HttpsError(
      "invalid-argument",
      `${field} must be ${allowZero ? "a non-negative" : "a positive"} safe integer in minor units.`,
    );
  }

  return value;
}
