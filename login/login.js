async function executeLoginGate() {
  const userIn = document
    .getElementById('authEmail')
    .value.trim()
    .toLowerCase();
  const passIn = document.getElementById('authPassword').value;
  const errorMsg = document.getElementById('authErrorMsg');

  if (!supabaseClient) {
    errorMsg.innerText = 'Not connected to the database. Check the console.';
    errorMsg.style.display = 'block';
    return;
  }

  const { data, error } = await supabaseClient.rpc('verify_login', {
    p_email: userIn,
    p_password: passIn,
  });

  if (error) {
    console.error('Login RPC error:', error);
    errorMsg.innerText = 'Login failed — check the console for details.';
    errorMsg.style.display = 'block';
    return;
  }

  if (data && data.length > 0) {
    const assignedRole = data[0].role;
    const session = { email: userIn, role: assignedRole };
    sessionStorage.setItem('ACTIVE_SESSION', JSON.stringify(session));
    window.location.href = '/dashboard/';
  } else {
    errorMsg.innerText = 'Invalid access payload permissions.';
    errorMsg.style.display = 'block';
  }
}
const emailField = document.getElementById('authEmail');
const passwordField = document.getElementById('authPassword');
[emailField, passwordField].forEach((field) => {
  field.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') executeLoginGate();
  });
});

// If already logged in, skip straight to the dashboard.
document.addEventListener('DOMContentLoaded', () => {
  const existing = JSON.parse(sessionStorage.getItem('ACTIVE_SESSION')) || null;
  if (existing) window.location.href = '/dashboard/';
});
