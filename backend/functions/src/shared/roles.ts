/**
 * Canonical staff roles.
 *
 * The role codes the backend authorises against. The till shows friendlier
 * labels; ROLE_LABELS is the one place that translation lives, so a renamed
 * label can never silently create a role nothing grants access to.
 */

export const ROLE_LABELS: Record<string, string> = {
  owner: "Owner",
  store_manager: "Store Manager",
  supervisor: "Supervisor",
  cashier: "Cashier",
  bar_staff: "Bar Staff",
  store_keeper: "Store Keeper",
};

export const STAFF_ROLES = new Set(Object.keys(ROLE_LABELS));

/** Roles that may create, re-password, or disable other staff. */
export const ADMIN_ROLES = new Set(["owner", "store_manager"]);

/**
 * Only an owner may mint another owner.
 *
 * Without this a store manager could create an owner account and then sign in
 * as it, which is a full privilege escalation out of their own role.
 */
export function canAssignRole(actorRole: string, targetRole: string): boolean {
  if (!ADMIN_ROLES.has(actorRole)) return false;
  if (targetRole === "owner") return actorRole === "owner";
  return STAFF_ROLES.has(targetRole);
}
