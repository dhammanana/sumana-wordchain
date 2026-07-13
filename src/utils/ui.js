/**
 * Shared UI utility functions
 */

/**
 * Show a toast notification
 */
export function showToast(type, message) {
  const container = document.getElementById('toast-container');
  if (!container) return;

  const toast = document.createElement('div');
  const bgColor = type === 'error'
    ? 'bg-error-container text-on-error-container'
    : type === 'success'
      ? 'bg-secondary-container text-on-secondary-container'
      : 'bg-surface-container-high text-on-background';
  const icon = type === 'error' ? 'error' : type === 'success' ? 'check_circle' : 'info';
  const fill = icon === 'info' ? 0 : 1;

  toast.className = `toast-enter pointer-events-auto ${bgColor} px-gap-md py-3 rounded-xl shadow-lg border border-outline-variant flex items-center gap-3`;
  toast.innerHTML = `
    <span class="material-symbols-outlined text-sm" style="font-variation-settings:'FILL'${fill}">${icon}</span>
    <span class="font-body-md text-body-md">${message}</span>
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
