// Global shared context to eliminate circular dependencies.
// The annotation stops TypeScript inferring `null` as the only permitted type
// for these slots when the TSX shell reads them.
/**
 * @type {{
 *   currentUser: any,
 *   currentBranch: any,
 *   currentTenant: any,
 *   activeShift: any,
 *   syncManager: any,
 *   views: Record<string, any>
 * }}
 */
export const state = {
  currentUser: null,
  currentBranch: null,
  currentTenant: null,
  activeShift: null,
  syncManager: null,
  views: {}
};

export function showNotification(message, type = 'success') {
  const container = document.body;
  if (!container) return;
  
  const notif = document.createElement('div');
  notif.className = `notification-toast ${type}`;
  notif.innerHTML = `
    <span class="toast-text">${message}</span>
  `;
  container.appendChild(notif);
  
  Object.assign(notif.style, {
    position: 'fixed',
    bottom: '24px',
    right: '24px',
    background: 'var(--bg-surface)',
    border: '1px solid var(--border-color)',
    borderRadius: '10px',
    padding: '12px 20px',
    fontSize: '12px',
    fontWeight: '600',
    color: type === 'success' ? 'var(--accent-green)' : (type === 'warning' ? 'var(--accent-amber)' : 'var(--accent-rose)'),
    borderColor: type === 'success' ? 'rgba(16, 185, 129, 0.3)' : (type === 'warning' ? 'rgba(245, 158, 11, 0.3)' : 'rgba(244, 63, 94, 0.3)'),
    boxShadow: 'var(--glass-shadow)',
    transform: 'translateY(100px)',
    transition: 'transform 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275)',
    zIndex: 9999,
    display: 'flex',
    alignItems: 'center',
    gap: '10px'
  });
  
  setTimeout(() => { notif.style.transform = 'translateY(0)'; }, 50);
  setTimeout(() => {
    notif.style.transform = 'translateY(100px)';
    setTimeout(() => notif.remove(), 300);
  }, 4000);
}
