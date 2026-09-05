/**
 * Role code <-> till label.
 *
 * Custom claims carry the backend's role codes; every role check in the till is
 * written against the display labels. Translating once at the sign-in boundary
 * keeps both sides speaking their own vocabulary - and a mismatch here silently
 * hides modules rather than failing loudly, so it lives in one place.
 */

export const ROLE_LABELS = {
  owner: 'Owner',
  store_manager: 'Store Manager',
  supervisor: 'Supervisor',
  cashier: 'Cashier',
  bar_staff: 'Bar Staff',
  store_keeper: 'Store Keeper'
};

export const ROLE_CODES = Object.fromEntries(
  Object.entries(ROLE_LABELS).map(([code, label]) => [label, code])
);

/** Backend role code -> the label the till's permission checks expect. */
export function roleLabel(code) {
  return ROLE_LABELS[String(code || '')] || '';
}
