/**
 * toast.js - Lightweight toast notification utility
 */

let container = null;

function getContainer() {
  if (!container) {
    container = document.createElement('div');
    container.className = 'toast-container';
    document.body.appendChild(container);
  }
  return container;
}

/**
 * @param {string} message
 * @param {'soft' | 'success' | 'warn' | 'danger'} type
 * @param {number} duration ms
 */
export function showToast(message, type = 'soft', duration = 3000) {
  const wrap = getContainer();
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.textContent = message;
  wrap.appendChild(toast);
  setTimeout(() => {
    toast.style.transition = 'opacity 0.3s';
    toast.style.opacity = '0';
    setTimeout(() => toast.remove(), 300);
  }, duration);
}