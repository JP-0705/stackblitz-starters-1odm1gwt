async function executeLoginGate() {
  const emailField = document.getElementById('authEmail');
  const passwordField = document.getElementById('authPassword');
  const userIn = emailField.value.trim().toLowerCase();
  const passIn = passwordField.value;
  const errorMsg = document.getElementById('authErrorMsg');

  emailField.classList.remove('auth-input-error');
  passwordField.classList.remove('auth-input-error');

  if (!supabaseClient) {
    errorMsg.innerText = 'Not connected to the database. Check the console.';
    errorMsg.style.display = 'block';
    return;
  }

  if (!userIn || !passIn) {
    emailField.classList.toggle('auth-input-error', !userIn);
    passwordField.classList.toggle('auth-input-error', !passIn);
    errorMsg.innerText = 'Please enter both your email and password.';
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
  field.addEventListener('input', () => field.classList.remove('auth-input-error'));
});

// If already logged in, skip straight to the dashboard.
document.addEventListener('DOMContentLoaded', () => {
  const existing = JSON.parse(sessionStorage.getItem('ACTIVE_SESSION')) || null;
  if (existing) window.location.href = '/dashboard/';
});
