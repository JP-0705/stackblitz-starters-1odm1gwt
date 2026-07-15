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
