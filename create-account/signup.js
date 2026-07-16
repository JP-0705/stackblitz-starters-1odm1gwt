async function executeSignup() {
  const errorMsg = document.getElementById('signupErrorMsg');
  const emailField = document.getElementById('signupEmail');
  const passwordField = document.getElementById('signupPassword');
  const confirmField = document.getElementById('signupPasswordConfirm');
  const email = emailField.value.trim().toLowerCase();
  const password = passwordField.value;
  const confirmPassword = confirmField.value;

  [emailField, passwordField, confirmField].forEach((f) =>
    f.classList.remove('auth-input-error')
  );

  if (!supabaseClient) {
    errorMsg.innerText = 'Not connected to the database. Check the console.';
    errorMsg.style.display = 'block';
    return;
  }
  if (!email || !password || !confirmPassword) {
    emailField.classList.toggle('auth-input-error', !email);
    passwordField.classList.toggle('auth-input-error', !password);
    confirmField.classList.toggle('auth-input-error', !confirmPassword);
    errorMsg.innerText = 'Please fill in all fields.';
    errorMsg.style.display = 'block';
    return;
  }
  const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailPattern.test(email)) {
    errorMsg.innerText = 'Please enter a valid email address (e.g. name@company.com).';
    errorMsg.style.display = 'block';
    return;
  }
  if (password !== confirmPassword) {
    errorMsg.innerText = 'Passwords do not match.';
    errorMsg.style.display = 'block';
    return;
  }

  const { data, error } = await supabaseClient.rpc('create_account', {
    p_email: email,
    p_password: password,
  });

  if (error) {
    console.error('Signup error:', error);
    errorMsg.innerText = error.message || 'Could not create account.';
    errorMsg.style.display = 'block';
    return;
  }

  showToast('Account created! You can now log in as a viewer.', 'success');
  setTimeout(() => {
    window.location.href = '/login/';
  }, 1500);
}
document.addEventListener('DOMContentLoaded', () => {
  const fields = [
    document.getElementById('signupEmail'),
    document.getElementById('signupPassword'),
    document.getElementById('signupPasswordConfirm'),
  ];
  fields.forEach((field) => {
    field.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') executeSignup();
    });
    field.addEventListener('input', () => field.classList.remove('auth-input-error'));
  });
});
