// ---------------------------------------------------------------------------
// SECURITY HELPERS — every value that comes from the database or the user
// must go through escapeHtml() before it is placed inside an innerHTML
// template. Otherwise a name like <img src=x onerror=...> would run as code
// in the browser of whoever views the table (stored XSS).
// ---------------------------------------------------------------------------
function escapeHtml(value) {
  return String(value === undefined || value === null ? '' : value).replace(
    /[&<>"']/g,
    (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch])
  );
}

// Today's date as YYYY-MM-DD in the USER'S local time. (toISOString() uses UTC,
// which shows *yesterday's* date in the Philippines between 12:00am and 8:00am.)
function todayLocalISO() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

// Only allow http(s) URLs (blocks javascript: and data: links in image fields).
function safeUrl(value) {
  try {
    const u = new URL(String(value || ''), window.location.origin);
    return u.protocol === 'https:' || u.protocol === 'http:' ? u.href : '';
  } catch (err) {
    return '';
  }
}

// Reads the saved session without ever throwing on corrupted storage.
function readStoredSession() {
  try {
    return JSON.parse(sessionStorage.getItem('ACTIVE_SESSION') || 'null');
  } catch (err) {
    sessionStorage.removeItem('ACTIVE_SESSION');
    return null;
  }
}

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

function openAboutModal() {
  const modal = document.getElementById('aboutModal');
  if (modal) modal.style.display = 'flex';
}

function closeAboutModal() {
  const modal = document.getElementById('aboutModal');
  if (modal) modal.style.display = 'none';
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
    <span>${escapeHtml(message)}</span>
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


// Sidebar "Forms" group: click to open/close; opens by itself on the Forms pages
// and highlights the page you are on.
function initFormsNavGroup() {
  const toggle = document.getElementById('formsGroupToggle');
  const sub = document.getElementById('formsSub');
  if (!toggle || !sub) return;
  const path = window.location.pathname.replace(/\/index\.html$/, '/');
  const onFormsPage = path.indexOf('/forms') === 0;
  const setOpen = (open) => {
    sub.style.display = open ? 'block' : 'none';
    toggle.setAttribute('aria-expanded', open ? 'true' : 'false');
    toggle.classList.toggle('open', open);
  };
  let open = onFormsPage;
  if (!onFormsPage) {
    try {
      open = localStorage.getItem('formsNavOpen') === '1';
    } catch (e) {
      open = false;
    }
  }
  setOpen(open);
  toggle.classList.toggle('active', onFormsPage);
  sub.querySelectorAll('.nav-sub-link').forEach((a) => {
    a.classList.toggle('active', a.getAttribute('href') === path);
  });
  toggle.addEventListener('click', () => {
    const next = sub.style.display === 'none';
    setOpen(next);
    try {
      localStorage.setItem('formsNavOpen', next ? '1' : '0');
    } catch (e) {
      /* storage not available: the menu still works */
    }
  });
}
document.addEventListener('DOMContentLoaded', initFormsNavGroup);
