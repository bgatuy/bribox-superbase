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
const path = window.location.pathname;
const BASE = path.replace(/[^\/]*$/, '');
if (!path.endsWith('/') && !path.endsWith('/index.html')) {
  // Tetap berlangganan supaya SIGNED_OUT juga ter-handle
  supabaseClient.auth.onAuthStateChange((event, session) => {
    // Initial gate saat load halaman selain index
    if (event === 'INITIAL_SESSION') {
      if (!session) {
        window.location.replace(BASE + 'index.html');
        return;
      }
      // Ada sesi → tampilkan konten
      const dashboard = document.querySelector('.dashboard');
      if (dashboard) dashboard.style.visibility = 'visible';
      if (typeof initAdminFeatures === 'function') initAdminFeatures();
      return;
    }

    // Saat logout dari halaman mana pun, paksa kembali ke login
    if (event === 'SIGNED_OUT') {
      window.location.replace(BASE + 'index.html');
      return;
    }

    // Bila token diperbarui/masuk ulang, pastikan konten terlihat
    if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') {
      const dashboard = document.querySelector('.dashboard');
      if (dashboard) dashboard.style.visibility = 'visible';
      if (typeof initAdminFeatures === 'function') initAdminFeatures();
    }
  });
}
