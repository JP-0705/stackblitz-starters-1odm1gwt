async function executeSignup() {
  const errorMsg = document.getElementById('signupErrorMsg');
  const email = document
    .getElementById('signupEmail')
    .value.trim()
    .toLowerCase();
  const password = document.getElementById('signupPassword').value;
  const confirmPassword = document.getElementById(
    'signupPasswordConfirm'
  ).value;

  if (!supabaseClient) {
    errorMsg.innerText = 'Not connected to the database. Check the console.';
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

  alert('Account created! You can now log in as a viewer.');
  window.location.href = '/login/';
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
  });
});
