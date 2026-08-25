import { HttpsError } from "firebase-functions/v2/https";

import { MAX_MINOR_UNITS } from "./validation";

export function inclusiveTax(totalMinor: number, basisPoints: number): number {
  return basisPoints === 0
    ? 0
    : Math.round((totalMinor * basisPoints) / (10_000 + basisPoints));
}

export function safeSum(values: readonly number[], field: string): number {
  const total = values.reduce((sum, value) => sum + value, 0);
  if (!Number.isSafeInteger(total) || total < 0 || total > MAX_MINOR_UNITS) {
    throw new HttpsError(
      "failed-precondition",
      `${field} exceeds the supported money range.`,
    );
  }

  return total;
}
