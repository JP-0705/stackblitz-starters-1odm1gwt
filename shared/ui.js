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
