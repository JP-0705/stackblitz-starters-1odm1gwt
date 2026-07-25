// Shared Supabase connection — loaded first on every page.
// The actual project URL and key live in /config/supabase-config.js
// (loaded right before this file) so they only need to be changed
// in one place if you ever switch Supabase projects.

let supabaseClient = null;
try {
  if (typeof SUPABASE_URL === 'undefined' || typeof SUPABASE_KEY === 'undefined') {
    throw new Error(
      '/config/supabase-config.js was not loaded before supabase-client.js — check the <script> order on this page.'
    );
  }
  if (!window.supabase) {
    throw new Error(
      'Supabase library not found on window. Check that the CDN <script> tag loaded successfully (open DevTools > Network tab and look for supabase-js).'
    );
  }
  supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
} catch (err) {
  console.error('Supabase initialization failed:', err);
}
