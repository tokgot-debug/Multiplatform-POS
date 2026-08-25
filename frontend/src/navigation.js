/**
 * Sidebar modules and the roles allowed to reach them.
 *
 * main.js carried this table twice - once to hide nav buttons and once to
 * guard tab switching - and the two copies had to stay in step by hand. One
 * table now feeds the sidebar, the route guard and nothing else.
 *
 * Labels and icons are exactly those from the original index.html.
 */

export const NAV_ITEMS = [
  { tab: 'till', icon: '🏪', label: 'Dashboard' },
  { tab: 'orders', icon: '🧾', label: 'Orders Viewer' },
  { tab: 'shifts', icon: '💵', label: 'Shift Management' },
  { tab: 'inventory', icon: '🍽️', label: 'Menu Admin' },
  { tab: 'mpesa', icon: '📱', label: 'Mpesa' },
  { tab: 'store-stock', icon: '📦', label: 'Store Stock' },
  { tab: 'house-stock', icon: '📊', label: 'House Stock' },
  { tab: 'users', icon: '👥', label: 'Users' },
  { tab: 'audit-logs', icon: '📜', label: 'Audit Logs' },
  { tab: 'finance', icon: '📈', label: 'Financials & AI' },
  { tab: 'qrtools', icon: '🔧', label: 'QR & Tools' },
  { tab: 'settings', icon: '⚙️', label: 'Settings' }
];

/** Modules absent from this map are reachable by every signed-in role. */
export const RESTRICTED_TABS = {
  'users': ['Owner', 'Store Manager'],
  'settings': ['Owner', 'Store Manager'],
  'inventory': ['Owner', 'Store Manager', 'Supervisor', 'Store Keeper'],
  'store-stock': ['Owner', 'Store Manager', 'Supervisor', 'Store Keeper'],
  'house-stock': ['Owner', 'Store Manager', 'Supervisor', 'Bar Staff'],
  'orders': ['Owner', 'Store Manager', 'Supervisor', 'Bar Staff'],
  'finance': ['Owner', 'Store Manager'],
  'qrtools': ['Owner', 'Store Manager', 'Supervisor'],
  'audit-logs': ['Owner', 'Store Manager']
};

export function canViewTab(role, tab) {
  const allowed = RESTRICTED_TABS[tab];
  return !allowed || allowed.includes(role);
}

export const DEFAULT_TAB = 'till';
