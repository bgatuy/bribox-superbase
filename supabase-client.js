// supabase-client.js

// Ganti dengan URL dan anon key dari proyek Supabase Anda
const SUPABASE_URL = 'https://yaajbonefhpdeehdkujr.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlhYWpib25lZmhwZGVlaGRrdWpyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjUwMzA3MDAsImV4cCI6MjA4MDYwNjcwMH0.UjM0CrVxwKR-jiMNICqRx-Njgzw7SexmBNRCsrXHqKI';

// Inisialisasi Supabase client. Variabel `supabaseClient` akan tersedia secara global.
const { createClient } = supabase;
const supabaseClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// ==================================================
// INI ADALAH SCRIPT "PENJAGA GERBANG"
// ==================================================
// Cek jika kita TIDAK sedang di halaman login (yaitu bukan di index.html atau /)
function __getAppRoot() {
  const path = window.location.pathname;
  if (path.includes('/monthly-report/')) {
    return path.substring(0, path.indexOf('/monthly-report/')) + '/';
  }
  return path.substring(0, path.lastIndexOf('/') + 1);
}
const path = window.location.pathname;
// Jika di admin.html, sembunyikan konten sampai verifikasi role selesai
if (path.endsWith('/admin.html') || path.endsWith('admin.html')) {
  try { document.body.style.visibility = 'hidden'; } catch {}
}
const BASE = __getAppRoot();
if (!path.endsWith('/') && !path.endsWith('/index.html')) {
  // Gate cepat: kalau tidak ada session, langsung redirect (tanpa menunggu event)
  supabaseClient.auth.getSession().then(async ({ data: { session } }) => {
    if (!session) {
      window.location.replace(BASE + 'index.html');
    } else {
      // Jika halaman admin, verifikasi role lebih dulu
      if (path.endsWith('/admin.html') || path.endsWith('admin.html')) {
        try {
          const { data: isAdmin } = await supabaseClient.rpc('is_admin');
          if (isAdmin === true) {
            try { document.body.style.visibility = 'visible'; } catch {}
          } else {
            // non-admin: langsung alihkan ke halaman utama tanpa alert
            window.location.replace(BASE + 'trackmate.html');
            return;
          }
        } catch {
          // error cek role -> alihkan ke halaman utama
          window.location.replace(BASE + 'trackmate.html');
          return;
        }
      }

      // Auto logout saat idle lama (8 jam)
      if (!window.__idleTimeoutSetup) {
        window.__idleTimeoutSetup = true;
        const IDLE_LIMIT_MS = 8 * 60 * 60 * 1000; // 8 jam
        let idleTimer;
        const activityEvents = ['mousemove', 'keydown', 'scroll', 'touchstart', 'visibilitychange'];
        const resetIdleTimer = () => {
          clearTimeout(idleTimer);
          idleTimer = setTimeout(async () => {
            try { await supabaseClient.auth.signOut(); } catch {}
            window.location.replace(BASE + 'index.html?reason=idle');
          }, IDLE_LIMIT_MS);
        };
        activityEvents.forEach(evt => document.addEventListener(evt, resetIdleTimer, { passive: true }));
        resetIdleTimer();
      }

      // Jangan panggil initGlobalLayout sembarang halaman.
      // Hanya jalankan bila marker elemen layout tersedia.
      const dashboardElement = document.querySelector('.dashboard');
      if (typeof injectGlobalLayout === 'function' && dashboardElement) {
        injectGlobalLayout();
        // Panggil initAdminFeatures SETELAH layout dibuat untuk menambahkan link admin.
        if (typeof initAdminFeatures === 'function') {
          await initAdminFeatures();
        }
      }
    }
  });

  // Listener tetap aktif untuk menangkap SIGNED_OUT dlsb.
  supabaseClient.auth.onAuthStateChange((event, session) => {
    // Jika logout dari tab lain, paksa redirect.
    if (event === 'SIGNED_OUT' || (event === 'USER_DELETED' && !session)) {
      window.location.replace(BASE + 'index.html');
    }
  });
}
