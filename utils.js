// ===== UTILS.JS (File Baru) =====
// Berisi fungsi-fungsi yang dipakai di banyak halaman.

/**
 * Inisialisasi dan menyediakan fungsi untuk menampilkan/menyembunyikan spinner loading global.
 */
(function initGlobalSpinner() {
  const spinner = document.createElement('div');
  spinner.className = 'loading-spinner';
  spinner.innerHTML = '<div class="spinner"></div>';
  spinner.style.display = 'none';
  
  const style = document.createElement('style');
  style.textContent = `.loading-spinner{position:fixed;inset:0;background:rgba(255,255,255,.7);z-index:9999;display:flex;align-items:center;justify-content:center}.spinner{width:40px;height:40px;border:4px solid #ccc;border-top-color:#007bff;border-radius:50%;animation:spin 1s linear infinite}@keyframes spin{to{transform:rotate(360deg)}}`;
  
  document.addEventListener('DOMContentLoaded', () => {
    document.head.appendChild(style);
    document.body.appendChild(spinner);
  });

  window.showSpinner = () => { spinner.style.display = 'flex'; };
  window.hideSpinner = () => { spinner.style.display = 'none'; };
})();

// Hitung root app agar redirect/link bekerja dari subfolder (mis. monthly-report/*)
function getAppRoot() {
  const p = window.location.pathname || '/';
  const idx = p.indexOf('/monthly-report/');
  if (idx >= 0) return p.slice(0, idx + 1); // contoh: /app/
  return p.replace(/[^\/]*$/, '');          // contoh: /app/
}

/**
 * Menampilkan notifikasi toast.
 * @param {string} message Pesan yang akan ditampilkan.
 * @param {number} [duration=3000] Durasi dalam milidetik.
 * @param {'success'|'info'|'warn'} [variant='success'] Tema warna toast.
 */
function showToast(message, duration = 3000, variant = "success") {
  let el = document.querySelector(".toast");
  if (!el) {
    el = document.createElement("div");
    el.className = "toast";
    el.setAttribute("role", "status");
    el.setAttribute("aria-live", "polite");
    document.body.appendChild(el);
  }

  const bg =
    variant === "info" ? "#0d6efd" :
    variant === "warn" ? "#f59e0b" :
    "#28a745"; // default success
  el.style.background = bg;

  el.textContent = String(message);
  el.classList.remove("show", "hiding");
  if (el._hideTimer) clearTimeout(el._hideTimer);

  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      el.classList.add("show");
    });
  });

  el._hideTimer = setTimeout(() => {
    el.classList.add("hiding");
    el.classList.remove("show");
  }, duration);

  el.onclick = () => {
    if (el._hideTimer) clearTimeout(el._hideTimer);
    el.classList.add("hiding");
    el.classList.remove("show");
  };
}


/** Inisialisasi fungsionalitas sidebar */
function initSidebar() {
  const sidebar = document.querySelector('.sidebar');
  const toggleBtn = document.querySelector('.sidebar-toggle-btn');
  const overlay = document.getElementById('sidebarOverlay') || document.querySelector('.sidebar-overlay');
  const sidebarLinks = document.querySelectorAll('.sidebar a');

  function openSidebar() { sidebar.classList.add('visible'); overlay?.classList.add('show'); document.body.style.overflow = 'hidden'; }
  function closeSidebar() { sidebar.classList.remove('visible'); overlay?.classList.remove('show'); document.body.style.overflow = ''; }
  function toggleSidebar() { sidebar.classList.contains('visible') ? closeSidebar() : openSidebar(); }

  // Hubungkan tombol toggle
  toggleBtn?.addEventListener('click', toggleSidebar);
  overlay?.addEventListener('click', closeSidebar);
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && sidebar.classList.contains('visible')) closeSidebar(); });
  sidebarLinks.forEach(a => a.addEventListener('click', closeSidebar));
}

/**
 * Menambahkan tombol Logout ke sidebar dan menangani fungsinya.
 */
function initLogoutButton() {
  const headerLogoutBtn = document.getElementById('btnLogout');
  const mobileLogoutBtn = document.getElementById('btnLogoutMobile');

  // Fungsi logout bersama
  const handleLogout = async () => {
    if (!confirm('Anda yakin ingin logout?')) return;

    try {
      // Sembunyikan konten segera agar tidak ada interaksi saat proses logout
      const dash = document.querySelector('.dashboard');
      if (dash) dash.style.visibility = 'hidden';
      showSpinner?.();

      if (typeof supabaseClient !== 'undefined') {
        await Promise.race([
          supabaseClient.auth.signOut().catch(()=>{}),
          new Promise(r => setTimeout(r, 1500)) // fallback timeout singkat
        ]);
      }

      // Bersihkan token Supabase di localStorage kalau masih tersisa
      try {
        Object.keys(localStorage)
          .filter(k => /^sb-.*-auth-token/i.test(k) || /supabase.*auth/i.test(k))
          .forEach(k => localStorage.removeItem(k));
      } catch {}
    } finally {
      hideSpinner?.();
      // Redirect ke index di root app
      const root = getAppRoot();
      window.location.replace(root + 'index.html');
    }
  };

  // Tambahkan event listener ke tombol logout di header
  if (headerLogoutBtn) {
    headerLogoutBtn.addEventListener('click', handleLogout);
  }

  // Tambahkan event listener ke tombol logout di navigasi bawah (mobile)
  if (mobileLogoutBtn) {
    mobileLogoutBtn.addEventListener('click', handleLogout);
  }
}

/**
 * Menambahkan fitur khusus admin, seperti link ke halaman admin.
 * Fungsi ini harus dipanggil setelah user terautentikasi.
 */
async function initAdminFeatures() {
  const mobileAdminButton = document.querySelector('.bottom-nav .bn-admin');
  const sidebarNav = document.querySelector('.sidebar nav');
  const bottomNav = document.querySelector('.bottom-nav');

  // Jika elemen penting tidak ada, hentikan.
  if (!mobileAdminButton || !sidebarNav || !bottomNav) return;

  // KUNCI PERBAIKAN:
  // Selalu hapus link admin yang mungkin sudah ada di sidebar dari eksekusi sebelumnya.
  // Ini mencegah link "yatim" muncul untuk non-admin.
  const existingAdminLink = sidebarNav.querySelector('a[href*="admin.html"]');
  if (existingAdminLink) existingAdminLink.remove();

  // Panggil fungsi is_admin() dari database untuk memeriksa role.
  const { data: isAdmin, error } = await supabaseClient.rpc('is_admin');

  if (error) {
    console.error('Gagal memeriksa status admin:', error.message);
    // Pastikan layout kembali ke default jika ada error
    mobileAdminButton.setAttribute('hidden', '');
    bottomNav.style.gridTemplateColumns = 'repeat(4, 1fr)';
    return;
  }

  if (isAdmin === true) {
    const root = getAppRoot();
    const adminLink = document.createElement('a');
    adminLink.href = root + 'admin.html';
    adminLink.innerHTML = `<span class="material-icons" style="color: #facc15;">admin_panel_settings</span> Admin Panel`;
    sidebarNav.appendChild(adminLink);
    mobileAdminButton.href = root + 'admin.html';
    mobileAdminButton.removeAttribute('hidden');
    bottomNav.style.gridTemplateColumns = 'repeat(5, 1fr)';
  } else {
    // Jika BUKAN admin, secara eksplisit sembunyikan tombol DAN kembalikan grid ke 4 kolom.
    mobileAdminButton.setAttribute('hidden', '');
    bottomNav.style.gridTemplateColumns = 'repeat(4, 1fr)';
  }
}

/**
 * Inisialisasi layout global, memuat konten halaman, dan mengelola status aktif.
 * Ini adalah "otak" dari sistem templating sisi klien.
 */
async function initGlobalLayout() {
  const pageContent = document.getElementById('page-content');
  const pageTitleEl = document.getElementById('page-title');
  const pageCssEl = document.getElementById('page-css');
  const pageScriptsContainer = document.getElementById('page-scripts');
  
  if (!pageContent || !pageTitleEl || !pageCssEl || !pageScriptsContainer) {
    console.error('Elemen layout penting tidak ditemukan. Pastikan Anda memuat dari _layout.html');
    return;
  }

  // Tentukan halaman mana yang harus dimuat dari URL
  const path = window.location.pathname.split('/').pop();
  const pageName = path.replace('.html', '');

  // Daftar halaman dan resource-nya
  const pages = {
    'trackmate': {
      partial: '_page-trackmate.html',
      scripts: ['/trackmate.js'],
      libs: [
        'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.4.120/pdf.min.js',
        'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.4.120/pdf.worker.min.js'
      ]
    },
    'appsheet': {
      partial: '_page-appsheet.html',
      scripts: ['/appsheet.js'], // Nanti bisa diganti ke trackmate.js jika logikanya sama
      libs: [
        'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.4.120/pdf.min.js',
        'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.4.120/pdf.worker.min.js'
      ]
    },
    'formserahterima': {
      partial: '_page-formserahterima.html',
      scripts: ['/formserahterima.js'],
      libs: [
        'https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js',
        'https://cdnjs.cloudflare.com/ajax/libs/jspdf-autotable/3.8.2/jspdf.plugin.autotable.min.js',
        'https://unpkg.com/pdf-lib/dist/pdf-lib.min.js'
      ]
    },
    'admin': {
      partial: '_page-admin.html',
      scripts: ['/admin.js']
    },
    'monthly-form': {
      partial: '/monthly-report/_page-monthly-form.html',
      css: '/monthly-report/monthly-form.css',
      scripts: ['/monthly-report/monthly-form.js']
    },
    'monthly-data': {
      partial: '/monthly-report/_page-monthly-data.html',
      css: '/monthly-report/monthly-data.css',
      scripts: ['/monthly-report/monthly-data.js'],
      libs: ['https://cdn.jsdelivr.net/npm/exceljs@4.4.0/dist/exceljs.min.js']
    }
    // Tambahkan halaman lain di sini
  };

  const pageConfig = pages[pageName];

  if (!pageConfig) {
    // Fallback jika halaman tidak ditemukan, mungkin redirect ke trackmate
    if (pageName !== 'index' && pageName !== '') {
      console.warn(`Konfigurasi untuk halaman "${pageName}" tidak ditemukan. Mengarahkan ke trackmate.html`);
      window.location.replace('/trackmate.html');
    }
    return;
  }

  try {
    // 1. Muat konten HTML parsial
    const response = await fetch(pageConfig.partial);
    if (!response.ok) throw new Error(`Gagal memuat ${pageConfig.partial}: ${response.statusText}`);
    const html = await response.text();
    pageContent.innerHTML = html;

    // 2. Set judul halaman dari atribut data-page-title di dalam parsial
    const titleFromPartial = pageContent.querySelector('[data-page-title]');
    if (titleFromPartial) {
      const titleText = titleFromPartial.getAttribute('data-page-title');
      pageTitleEl.textContent = titleText;
      document.title = `${titleText} - BRIBOX KANPUS`;
      titleFromPartial.remove(); // Hapus elemen setelah mengambil judulnya
    }

    // 3. Muat CSS spesifik halaman (jika ada)
    pageCssEl.href = pageConfig.css || '';

    // 4. Muat dan jalankan skrip (library dan skrip halaman)
    pageScriptsContainer.innerHTML = ''; // Bersihkan skrip lama
    const scriptsToLoad = [...(pageConfig.libs || []), ...(pageConfig.scripts || [])];
    
    for (const src of scriptsToLoad) {
      const script = document.createElement('script');
      script.src = src;
      // pdf.worker.min.js tidak perlu dieksekusi, hanya perlu ada
      if (!src.includes('pdf.worker')) {
        script.defer = true;
      }
      pageScriptsContainer.appendChild(script);
    }

    // 5. Inisialisasi komponen UI global
    initSidebar();
    initLogoutButton();
    initMobileSubmenu(); // Fungsi baru untuk submenu mobile

    // 6. Set status aktif pada menu
    document.body.setAttribute('data-page', pageName.split('-')[0]); // e.g., 'monthly-data' -> 'monthly'
    document.querySelectorAll('.sidebar a, .bottom-nav a').forEach(a => {
      a.classList.remove('active');
      if (a.getAttribute('href').includes(path)) {
        a.classList.add('active');
      }
    });

    // 7. Panggil initAdminFeatures SETELAH semua layout siap.
    // Ini adalah langkah kunci untuk mencegah race condition.
    await initAdminFeatures();

  } catch (error) {
    console.error('Gagal memuat halaman:', error);
    pageContent.innerHTML = `<div class="card"><p style="color: red;">Error: Gagal memuat konten halaman. Cek console untuk detail.</p></div>`;
  }
}

/** Inisialisasi submenu navigasi bawah (mobile) */
function initMobileSubmenu() {
  const trigger = document.querySelector('.bn-monthly-trigger');
  const menu = document.getElementById('bn-submonthly');

  if (trigger && menu) {
    const close = () => { trigger.setAttribute('aria-expanded', 'false'); menu.hidden = true; };
    const open = () => { trigger.setAttribute('aria-expanded', 'true'); menu.hidden = false; };

    trigger.addEventListener('click', (e) => {
      e.preventDefault();
      menu.hidden ? open() : close();
    });

    document.addEventListener('click', (e) => {
      if (!menu.hidden && !menu.contains(e.target) && !trigger.contains(e.target)) {
        close();
      }
    });
    document.addEventListener('keydown', (e) => { if (e.key === 'Escape') close(); });
  }
}
