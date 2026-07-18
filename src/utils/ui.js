import store from '../store.js';

/**
 * Show a toast notification
 */

export function showToast(type, message) {
  const container = document.getElementById('toast-container');
  if (!container) return;

  const toast = document.createElement('div');
  const config = {
    error: { bg: 'bg-error-container border border-error/20', icon: 'error', color: 'text-error' },
    success: { bg: 'bg-success-container border border-success/20', icon: 'check_circle', color: 'text-success' },
    warning: { bg: 'bg-warning-container border border-warning/20', icon: 'warning', color: 'text-warning' },
    info: { bg: 'bg-primary-container border border-primary/20', icon: 'info', color: 'text-primary' },
  };
  const c = config[type] || config.info;

  toast.className = `toast-enter pointer-events-auto ${c.bg} px-4 py-3 rounded-xl shadow-lg flex items-center gap-3`;
  toast.innerHTML = `
    <span class="material-symbols-outlined text-sm ${c.color}">${c.icon}</span>
    <span class="text-body-sm text-dark-text">${message}</span>
  `;
  container.appendChild(toast);

  setTimeout(() => {
    toast.classList.remove('toast-enter');
    toast.classList.add('toast-exit');
    setTimeout(() => toast.remove(), 300);
  }, 4000);
}

/**
 * Format a date as relative time
 */
export function formatTimeAgo(dateStr) {
  if (!dateStr) return '';
  const now = new Date();
  const date = new Date(dateStr);
  const seconds = Math.floor((now - date) / 1000);

  if (seconds < 10) return 'just now';
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

/**
 * Update the user badge in the top bar
 */
export function updateUserBadge() {
  const user = store.get('user');
  const profile = store.get('profile');
  const badge = document.getElementById('user-badge');
  const gemsEl = document.getElementById('user-gems');
  const nameEl = document.getElementById('user-name-display');

  if (user && profile) {
    badge.classList.remove('hidden');
    gemsEl.textContent = `${profile.gems || 0} 💎`;
    nameEl.textContent = profile.display_name || 'Player';
  } else {
    badge.classList.add('hidden');
  }
}
