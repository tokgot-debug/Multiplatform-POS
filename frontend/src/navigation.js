/**
 * Sidebar modules and the roles allowed to reach them.
 *
 * main.js carried this table twice - once to hide nav buttons and once to
 * guard tab switching - and the two copies had to stay in step by hand. One
 * table now feeds the sidebar, the route guard and nothing else.
 *
 * Labels and icons are exactly those from the original index.html.
 */

/**
 * Sidebar groups, in the order they appear.
 *
 * Grouped by what someone is trying to do rather than by which screen came
 * first: a cashier lives entirely in Service, a store keeper in Stock, and an
 * owner drops into Money and Administration at the end of a shift.
 *
 * Users is not here - staff management now lives inside Settings, so there is
 * one place that answers "who can do what".
 */
export const NAV_GROUPS = [
  {
    id: 'service',
    label: 'Service',
    items: [
      { tab: 'till', icon: '🏪', label: 'Dashboard' },
      { tab: 'orders', icon: '🧾', label: 'Orders Viewer' },
      { tab: 'shifts', icon: '💵', label: 'Shift Management' }
    ]
  },
  {
    id: 'stock',
    label: 'Stock',
    items: [
      { tab: 'inventory', icon: '🍽️', label: 'Menu Admin' },
      { tab: 'store-stock', icon: '📦', label: 'Store Stock' },
      { tab: 'house-stock', icon: '📊', label: 'House Stock' }
    ]
  },
  {
    id: 'money',
    label: 'Money',
    items: [
      { tab: 'mpesa', icon: '📱', label: 'Mpesa' },
      { tab: 'finance', icon: '📈', label: 'Financials & AI' }
    ]
  },
  {
    id: 'admin',
    label: 'Administration',
    items: [
      { tab: 'audit-logs', icon: '📜', label: 'Audit Logs' },
      { tab: 'qrtools', icon: '🔧', label: 'QR & Tools' },
      { tab: 'settings', icon: '⚙️', label: 'Settings' }
    ]
  }
];

/** Flat list, still the single source of truth for what a route is called. */
export const NAV_ITEMS = NAV_GROUPS.flatMap((group) => group.items);

/** The group holding a tab, so the sidebar can open it on a deep link. */
export function groupForTab(tab) {
  const group = NAV_GROUPS.find((entry) => entry.items.some((item) => item.tab === tab));
  return group ? group.id : NAV_GROUPS[0].id;
}

/** Modules absent from this map are reachable by every signed-in role. */
export const RESTRICTED_TABS = {
  // Settings now carries staff management, so it keeps the old users rule.
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
