// Shared session/auth handling.
// Login is a separate page now (/login/), so every "app" page must check
// for a session on load and redirect to /login/ if none is found.
let activeUserSession =
  JSON.parse(sessionStorage.getItem('ACTIVE_SESSION')) || null;

// Call at the top of every app page's init. Redirects to /login/ (and
// returns null) if nobody is signed in.
function requireAuth() {
  activeUserSession =
    JSON.parse(sessionStorage.getItem('ACTIVE_SESSION')) || null;
  if (!activeUserSession) {
    window.location.href = '/login/';
    return null;
  }
  return activeUserSession;
}

function executeLogout() {
  sessionStorage.removeItem('ACTIVE_SESSION');
  activeUserSession = null;
  window.location.href = '/login/';
}

// Shows/hides admin-only buttons and the role label in the shared header.
function applyRoleVisibility() {
  if (!activeUserSession) return;
  const roleLabel = document.getElementById('roleLabelDisplay');
  if (roleLabel) roleLabel.innerText = activeUserSession.role;

  const isAdmin = activeUserSession.role === 'ADMIN';
  const addBtn = document.getElementById('addNewAssetMasterBtn');
  if (addBtn) addBtn.style.display = isAdmin ? 'block' : 'none';
  const blankBtn = document.getElementById('blankCountSheetBtn');
  if (blankBtn) blankBtn.style.display = isAdmin ? 'block' : 'none';
  const countBtn = document.getElementById('physicalCountBtn');
  if (countBtn) countBtn.style.display = isAdmin ? 'block' : 'none';
  const delLink = document.getElementById('deletedItemsMenuLink');
  if (delLink) delLink.style.display = isAdmin ? 'block' : 'none';
  const historyLink = document.getElementById('countHistoryMenuLink');
  if (historyLink) historyLink.style.display = isAdmin ? 'block' : 'none';
}

// CHANGE PASSWORD — shared across every app page via the Settings menu.
function openChangePasswordModal() {
  document.getElementById('changePwCurrent').value = '';
  document.getElementById('changePwNew').value = '';
  document.getElementById('changePwConfirm').value = '';
  document.getElementById('changePwErrorMsg').style.display = 'none';
  document.getElementById('changePasswordModal').style.display = 'flex';
}

function closeChangePasswordModal() {
  document.getElementById('changePasswordModal').style.display = 'none';
}

async function executeChangePassword() {
  const errorMsg = document.getElementById('changePwErrorMsg');
  const currentPw = document.getElementById('changePwCurrent').value;
  const newPw = document.getElementById('changePwNew').value;
  const confirmPw = document.getElementById('changePwConfirm').value;

  if (!activeUserSession) return;
  if (!supabaseClient) {
    errorMsg.innerText = 'Not connected to the database. Check the console.';
    errorMsg.style.display = 'block';
    return;
  }
  if (newPw !== confirmPw) {
    errorMsg.innerText = 'New passwords do not match.';
    errorMsg.style.display = 'block';
    return;
  }

  const { error } = await supabaseClient.rpc('change_password', {
    p_email: activeUserSession.email,
    p_current_password: currentPw,
    p_new_password: newPw,
  });

  if (error) {
    console.error('Change password error:', error);
    errorMsg.innerText = error.message || 'Could not change password.';
    errorMsg.style.display = 'block';
    return;
  }

  closeChangePasswordModal();
  alert('Password updated successfully.');
}
