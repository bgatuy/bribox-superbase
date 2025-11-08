// supabase-client.js

// Ganti dengan URL dan anon key dari proyek Supabase Anda
const SUPABASE_URL = 'https://hfwklepqsiwubjxatmsq.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imhmd2tsZXBxc2l3dWJqeGF0bXNxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjIwODk5MDAsImV4cCI6MjA3NzY2NTkwMH0.gWi8ukCILo11q-3wToMZQ4aHOLrp19Ss8jZoDHMJusY';

// Inisialisasi Supabase client. Variabel `supabaseClient` akan tersedia secara global.
const { createClient } = supabase;
const supabaseClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// ==================================================
// INI ADALAH SCRIPT "PENJAGA GERBANG"
// ==================================================
// Cek jika kita TIDAK sedang di halaman login (yaitu bukan di index.html atau /)
function __getAppRoot() {
  const p = window.location.pathname || '/';
  const idx = p.indexOf('/monthly-report/');
  if (idx >= 0) return p.slice(0, idx + 1);
  return p.replace(/[^\/]*$/, '');
}
const path = window.location.pathname;
const BASE = __getAppRoot();
if (!path.endsWith('/') && !path.endsWith('/index.html')) {
  // Gate cepat: kalau tidak ada session, langsung redirect (tanpa menunggu event)
  supabaseClient.auth.getSession().then(({ data: { session } }) => {
    if (!session) {
      window.location.replace(BASE + 'index.html');
    } else {
      const dashboard = document.querySelector('.dashboard');
      if (dashboard) dashboard.style.visibility = 'visible';
      if (typeof initAdminFeatures === 'function') initAdminFeatures();
    }
  });

  // Listener tetap aktif untuk menangkap SIGNED_OUT dlsb.
  supabaseClient.auth.onAuthStateChange((event, session) => {
    if (event === 'SIGNED_OUT') {
      window.location.replace(BASE + 'index.html');
      return;
    }
    if ((event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') && session) {
      const dashboard = document.querySelector('.dashboard');
      if (dashboard) dashboard.style.visibility = 'visible';
      if (typeof initAdminFeatures === 'function') initAdminFeatures();
    }
  });
}
