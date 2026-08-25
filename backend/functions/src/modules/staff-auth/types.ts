export type StaffPinInput = {
  tenantId: string;
  staffId: string;
  pin: string;
};

export type StaffPinTransactionResult =
  | { status: "locked"; lockedUntil: string }
  | { status: "invalid"; locked: boolean }
  | { status: "ok"; session: Record<string, unknown> };
