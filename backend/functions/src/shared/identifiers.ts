import { createHash } from "node:crypto";

export function deterministicId(prefix: string, value: string): string {
  const digest = createHash("sha256").update(value).digest("hex").slice(0, 48);
  return `${prefix}-${digest}`;
}
