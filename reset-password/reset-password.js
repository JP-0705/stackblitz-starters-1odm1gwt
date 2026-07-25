// This page is where password recovery links land — whether triggered by
// an admin using "Send password recovery" in the Supabase dashboard, or
// (if added later) a self-serve "Forgot password?" link on the login page.
//
// Supabase's recovery link establishes a temporary, recovery-only session
// on this page; we just need to detect that session exists, show a form,
// and call updateUser({ password }) to actually change it.

let recoverySessionReady = false;

function showState(stateId) {
  ['resetLoadingState', 'resetFormState', 'resetProblemState', 'resetSuccessState'].forEach(
    (id) => {
      document.getElementById(id).style.display = id === stateId ? 'block' : 'none';
    }
  );
}

function showProblem(message) {
  document.getElementById('resetProblemText').innerText = message;
  showState('resetProblemState');
}

document.addEventListener('DOMContentLoaded', async () => {
  const watchdog = setTimeout(() => {
    showProblem('This is taking longer than expected. Please try the link again, or request a new one.');
  }, 12000);

  try {
    if (!supabaseClient) {
      clearTimeout(watchdog);
      showProblem('Not connected to the database. Check the console.');
      return;
    }

    const hashParams = new URLSearchParams(window.location.hash.replace(/^#/, ''));
    const queryParams = new URLSearchParams(window.location.search);
    const errorDescription =
      hashParams.get('error_description') || queryParams.get('error_description');

    if (errorDescription) {
      clearTimeout(watchdog);
      showProblem(decodeURIComponent(errorDescription.replace(/\+/g, ' ')));
      return;
    }

    // Newer Supabase projects send recovery links with a `code` query param
    // (PKCE flow) that needs to be explicitly exchanged for a session.
    const code = queryParams.get('code');
    if (code) {
      const { error: exchangeError } = await supabaseClient.auth.exchangeCodeForSession(code);
      if (exchangeError) {
        console.error('exchangeCodeForSession error:', exchangeError);
        clearTimeout(watchdog);
        showProblem(
          exchangeError.message ||
            'This link may have expired or already been used. Please request a new one.'
        );
        return;
      }
    }

    // Older/implicit-flow projects put tokens straight in the URL hash —
    // detectSessionInUrl (default true) picks those up automatically.
    const { data, error } = await supabaseClient.auth.getSession();

    clearTimeout(watchdog);

    if (error || !data || !data.session) {
      if (error) console.error('getSession error:', error);
      showProblem(
        'No valid recovery link was found. Please request a new password reset.'
      );
      return;
    }

    recoverySessionReady = true;
    showState('resetFormState');
  } catch (err) {
    console.error('Unexpected error verifying recovery link:', err);
    clearTimeout(watchdog);
    showProblem('Something unexpected went wrong. Please request a new password reset.');
  }
});

async function executePasswordReset() {
  const errorMsg = document.getElementById('resetErrorMsg');
  const newPasswordField = document.getElementById('newPassword');
  const confirmField = document.getElementById('confirmNewPassword');
  const submitBtn = document.getElementById('resetSubmitBtn');
  const newPassword = newPasswordField.value;
  const confirmPassword = confirmField.value;

  errorMsg.style.display = 'none';

  if (!recoverySessionReady) {
    errorMsg.innerText = 'Your recovery link is no longer valid. Please request a new one.';
    errorMsg.style.display = 'block';
    return;
  }
  if (!newPassword || !confirmPassword) {
    errorMsg.innerText = 'Please fill in both password fields.';
    errorMsg.style.display = 'block';
    return;
  }
  if (newPassword.length < 6) {
    errorMsg.innerText = 'Password must be at least 6 characters.';
    errorMsg.style.display = 'block';
    return;
  }
  if (newPassword !== confirmPassword) {
    errorMsg.innerText = 'Passwords do not match.';
    errorMsg.style.display = 'block';
    return;
  }

  submitBtn.disabled = true;
  submitBtn.innerText = 'Saving...';

  const { error } = await supabaseClient.auth.updateUser({ password: newPassword });

  if (error) {
    console.error('Password reset error:', error);
    errorMsg.innerText = error.message || 'Could not update password.';
    errorMsg.style.display = 'block';
    submitBtn.disabled = false;
    submitBtn.innerText = 'SET NEW PASSWORD';
    return;
  }

  // Sign out of this temporary recovery session so they log back in fresh
  // with the new password, same as any normal login.
  await supabaseClient.auth.signOut();
  sessionStorage.removeItem('ACTIVE_SESSION');

  showState('resetSuccessState');
}
