import { Timestamp } from "firebase-admin/firestore";

export function normalizeFirestoreValue<T>(value: T): T {
  if (value instanceof Timestamp) return value.toDate().toISOString() as T;
  if (Array.isArray(value)) {
    return value.map((item) => normalizeFirestoreValue(item)) as T;
  }
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>).map(([key, nested]) => [
        key,
        normalizeFirestoreValue(nested),
      ]),
    ) as T;
  }

  return value;
}
