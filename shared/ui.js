// Shared sidebar/settings-menu UI behavior — loaded on every app page.
function toggleSidebar() {
  document.body.classList.toggle('sidebar-collapsed');
}

function toggleSettingsMenu() {
  document.getElementById('settingsMenu').classList.toggle('open');
}

function closeSettingsMenu() {
  document.getElementById('settingsMenu').classList.remove('open');
}

document.addEventListener('click', (e) => {
  const settingsBox = document.querySelector('.sidebar-settings');
  if (settingsBox && !settingsBox.contains(e.target)) {
    closeSettingsMenu();
  }
});

// Simple in-page lightbox for asset thumbnails — keeps the click from
// navigating away to the image's own URL in a new tab.
function showAssetImagePreview(url, label) {
  const modal = document.getElementById('imagePreviewModal');
  if (!modal) return;
  document.getElementById('imagePreviewImg').src = url;
  document.getElementById('imagePreviewLabel').innerText = label || '';
  modal.style.display = 'flex';
}

function closeAssetImagePreview() {
  const modal = document.getElementById('imagePreviewModal');
  if (!modal) return;
  modal.style.display = 'none';
  document.getElementById('imagePreviewImg').src = '';
}

// Lightweight, non-blocking success/error notification — replaces native
// alert() for messages that don't need the user to stop and click OK.
// type: 'success' | 'error' | 'info'
function showToast(message, type = 'success') {
  const container = document.getElementById('toastContainer');
  if (!container) {
    // Fallback for any page that hasn't been given the container yet.
    return alert(message);
  }

  const icons = { success: '✅', error: '⚠️', info: 'ℹ️' };
  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  toast.innerHTML = `
    <span class="toast-icon">${icons[type] || icons.info}</span>
    <span>${message}</span>
    <button class="toast-close" aria-label="Dismiss">✕</button>
  `;
  container.appendChild(toast);

  requestAnimationFrame(() => toast.classList.add('toast-visible'));

  const dismiss = () => {
    toast.classList.remove('toast-visible');
    setTimeout(() => toast.remove(), 250);
  };
  toast.querySelector('.toast-close').addEventListener('click', dismiss);
  setTimeout(dismiss, 4000);
}

// Promise-based replacement for native confirm() — resolves true/false
// once the person clicks a button, so callers just `await` it.
// options: { title, confirmLabel, confirmColor }
function showConfirm(message, options = {}) {
  const modal = document.getElementById('customConfirmModal');
  if (!modal) {
    // Fallback for any page that hasn't been given the modal yet.
    return Promise.resolve(confirm(message));
  }

  return new Promise((resolve) => {
    document.getElementById('customConfirmTitle').innerText = options.title || 'Please Confirm';
    document.getElementById('customConfirmMessage').innerText = message;
    const okBtn = document.getElementById('customConfirmOkBtn');
    okBtn.innerText = options.confirmLabel || 'OK';
    okBtn.style.background = options.confirmColor || '#0b1d33';
    modal.style.display = 'flex';

    const cancelBtn = document.getElementById('customConfirmCancelBtn');
    const cleanup = (result) => {
      modal.style.display = 'none';
      okBtn.removeEventListener('click', onOk);
      cancelBtn.removeEventListener('click', onCancel);
      resolve(result);
    };
    const onOk = () => cleanup(true);
    const onCancel = () => cleanup(false);
    okBtn.addEventListener('click', onOk);
    cancelBtn.addEventListener('click', onCancel);
  });
}
