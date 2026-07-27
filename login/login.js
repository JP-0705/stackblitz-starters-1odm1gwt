function toggleForgotPassword() {
  const loginFields = ['authEmail', 'authPassword', 'authSubmitBtn', 'authErrorMsg'];
  const forgotSection = document.getElementById('forgotPasswordSection');
  const isShowingForgot = forgotSection.style.display === 'block';

  forgotSection.style.display = isShowingForgot ? 'none' : 'block';
  loginFields.forEach((id) => {
    document.getElementById(id).style.display = isShowingForgot ? '' : 'none';
  });
  document.querySelectorAll('.auth-signup-link').forEach((el) => {
    if (!forgotSection.contains(el)) {
      el.style.display = isShowingForgot ? '' : 'none';
    }
  });

  document.getElementById('forgotPasswordMsg').style.display = 'none';
  document.getElementById('forgotPasswordEmail').value = '';
}

async function executeForgotPassword() {
  const emailField = document.getElementById('forgotPasswordEmail');
  const msg = document.getElementById('forgotPasswordMsg');
  const btn = document.getElementById('forgotPasswordBtn');
  const email = emailField.value.trim().toLowerCase();

  msg.style.background = '';
  msg.style.borderColor = '';
  msg.style.color = '';

  if (!supabaseClient) {
    msg.innerText = 'Not connected to the database. Check the console.';
    msg.style.display = 'block';
    return;
  }
  if (!email) {
    msg.innerText = 'Please enter your email.';
    msg.style.display = 'block';
    return;
  }

  btn.disabled = true;
  btn.innerText = 'Sending...';

  // redirectTo points Supabase to our own reset-password page — sending
  // this from the app (instead of the "Send password recovery" button in
  // the Supabase dashboard) is what lets us control where the link goes.
  const { error } = await supabaseClient.auth.resetPasswordForEmail(email, {
    redirectTo: `${window.location.origin}/reset-password/`,
  });

  btn.disabled = false;
  btn.innerText = 'SEND RESET LINK';

  if (error) {
    console.error('Password recovery request error:', error);
    msg.innerText = error.message || 'Could not send reset link.';
    msg.style.display = 'block';
    return;
  }

  // Deliberately the same message whether or not the email exists — this
  // avoids leaking which addresses have accounts on the site.
  msg.style.background = '#dcfce7';
  msg.style.borderColor = '#bbf7d0';
  msg.style.color = '#166534';
  msg.innerText = 'If an account exists for that email, a reset link is on its way.';
  msg.style.display = 'block';
}

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
