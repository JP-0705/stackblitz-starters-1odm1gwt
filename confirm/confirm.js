// This page is where the "Confirm your email" link in the signup email
// lands. Supabase validates the token itself, then redirects the browser
// here with a session already attached to the URL (supabase-js picks it
// up automatically because detectSessionInUrl defaults to true).

document.addEventListener('DOMContentLoaded', async () => {
  const title = document.getElementById('confirmTitle');
  const subtitle = document.getElementById('confirmSubtitle');
  const spinner = document.getElementById('confirmSpinner');
  const loginBtn = document.getElementById('confirmGoLoginBtn');
  const dashboardBtn = document.getElementById('confirmGoDashboardBtn');

  if (!supabaseClient) {
    spinner.style.display = 'none';
    title.innerText = 'Something went wrong';
    subtitle.innerText = 'Not connected to the database. Check the console.';
    loginBtn.style.display = 'block';
    return;
  }

  // Surface any error Supabase attached to the redirect (expired link,
  // already-used link, etc). These come through as query/hash params
  // like ?error=...&error_description=...
  const hashParams = new URLSearchParams(window.location.hash.replace(/^#/, ''));
  const queryParams = new URLSearchParams(window.location.search);
  const errorDescription =
    hashParams.get('error_description') || queryParams.get('error_description');

  if (errorDescription) {
    spinner.style.display = 'none';
    title.innerText = 'Confirmation link problem';
    subtitle.innerText = decodeURIComponent(errorDescription.replace(/\+/g, ' '));
    loginBtn.style.display = 'block';
    return;
  }

  // Give supabase-js a moment to parse the tokens out of the URL and
  // establish the session.
  const { data, error } = await supabaseClient.auth.getSession();

  spinner.style.display = 'none';

  if (error || !data || !data.session) {
    title.innerText = 'Confirmation link problem';
    subtitle.innerText =
      'This link may have expired or already been used. Please try logging in, or sign up again.';
    loginBtn.style.display = 'block';
    return;
  }

  // Confirmed — the user already has a valid session at this point, so
  // log them straight in, same as login.js does.
  const assignedRole =
    (data.session.user.user_metadata && data.session.user.user_metadata.role) || 'VIEWER';
  sessionStorage.setItem(
    'ACTIVE_SESSION',
    JSON.stringify({ email: data.session.user.email, role: assignedRole })
  );

  title.innerText = 'Email confirmed!';
  subtitle.innerText = 'Your account is ready. Taking you to the dashboard…';
  dashboardBtn.style.display = 'block';

  setTimeout(() => {
    window.location.href = '/dashboard/';
  }, 1500);
});
