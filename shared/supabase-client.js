// Shared Supabase connection — loaded first on every page.
const SUPABASE_URL = 'https://aoloilsaotsfpgcksaov.supabase.co';
const SUPABASE_KEY = 'sb_publishable_HQeUx_oI2i90Dji8gKQoOA_RIb7GnY4';

let supabaseClient = null;
try {
  if (!window.supabase) {
    throw new Error(
      'Supabase library not found on window. Check that the CDN <script> tag loaded successfully (open DevTools > Network tab and look for supabase-js).'
    );
  }
  supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
} catch (err) {
  console.error('Supabase initialization failed:', err);
}
