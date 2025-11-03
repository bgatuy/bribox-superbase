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
    if (typeof supabaseClient !== 'undefined') {
      await supabaseClient.auth.signOut();
    }
    window.location.href = '/trackmate.html'; // Arahkan ke halaman login baru
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
  if (typeof supabaseClient === 'undefined') return;

  // Panggil fungsi is_admin() dari database untuk memeriksa role.
  // Ini adalah cara yang lebih baik daripada hardcoding ID.
  const { data: isAdmin, error } = await supabaseClient.rpc('is_admin');

  if (error) {
    // Jangan tampilkan error ke user, cukup log di console.
    console.error('Gagal memeriksa status admin:', error.message);
    return;
  }

  if (isAdmin) {
    const nav = document.querySelector('.sidebar nav');
    if (nav && !nav.querySelector('a[href="admin.html"]')) {
      const adminLink = document.createElement('a');
      adminLink.href = 'admin.html';
      adminLink.innerHTML = `<span class="material-icons" style="color: #facc15;">admin_panel_settings</span> Admin Panel`;
      
      nav.appendChild(adminLink);
    }
  }
}