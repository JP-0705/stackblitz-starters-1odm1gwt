async function executeLoginGate() {
  const emailField = document.getElementById('authEmail');
  const passwordField = document.getElementById('authPassword');
  const userIn = emailField.value.trim().toLowerCase();
  const passIn = passwordField.value;
  const errorMsg = document.getElementById('authErrorMsg');
  const submitBtn = document.getElementById('authSubmitBtn');
  const originalBtnText = submitBtn.innerText;


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
  submitBtn.disabled = true;
  submitBtn.innerText = 'Logging in...';

  // Authenticates against Supabase's built-in auth.users table instead of
  // the old custom app_users table + verify_login RPC.
  const { data, error } = await supabaseClient.auth.signInWithPassword({
    email: userIn,
    password: passIn,
  });

  if (error) {
    console.error('Login error:', error);
    if (error.message && error.message.toLowerCase().includes('email not confirmed')) {
      errorMsg.innerText = 'Please confirm your email before logging in.';
    } else {
      errorMsg.innerText = 'Incorrect Email or Password';
    }
    errorMsg.style.display = 'block';
    submitBtn.disabled = false;
    submitBtn.innerText = originalBtnText;
    return;
  }

  if (data && data.user) {
    // Role now lives in the auth user's metadata (set at signup / by an
    // admin in Supabase Authentication > Users), not in a separate table.
    const assignedRole = (data.user.user_metadata && data.user.user_metadata.role) || 'VIEWER';
    const session = { email: data.user.email, role: assignedRole };
    sessionStorage.setItem('ACTIVE_SESSION', JSON.stringify(session));
    window.location.href = '/dashboard/';
  } else {
    errorMsg.innerText = 'Incorrect Email or Password';
    errorMsg.style.display = 'block';
    submitBtn.disabled = false;
    submitBtn.innerText = originalBtnText;
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
document.addEventListener('DOMContentLoaded', async () => {
  const existing = JSON.parse(sessionStorage.getItem('ACTIVE_SESSION')) || null;
  if (existing) {
    window.location.href = '/dashboard/';
    return;
  }
  // Also cover the case where a real Supabase auth session is still valid
  // (e.g. tab was closed and reopened) but the sessionStorage copy is gone.
  if (supabaseClient) {
    const { data } = await supabaseClient.auth.getSession();
    if (data && data.session && data.session.user) {
      const assignedRole =
        (data.session.user.user_metadata && data.session.user.user_metadata.role) || 'VIEWER';
      sessionStorage.setItem(
        'ACTIVE_SESSION',
        JSON.stringify({ email: data.session.user.email, role: assignedRole })
      );
      window.location.href = '/dashboard/';
    }
  }
});
