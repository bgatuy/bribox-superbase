// admin.js

document.addEventListener('DOMContentLoaded', async () => {
  // Pastikan supabaseClient sudah ada
  if (typeof supabaseClient === 'undefined') {
    alert('Koneksi ke Supabase gagal. Halaman tidak dapat dimuat.');
    window.location.href = 'trackmate.html'; // Konsisten pakai path relatif
    return;
  }

  // 1. Verifikasi bahwa pengguna adalah admin
  const { data: isAdmin, error } = await supabaseClient.rpc('is_admin');

  if (error) {
    alert(`Gagal memverifikasi akses admin: ${error.message}`);
    window.location.href = 'trackmate.html';
    return;
  }

  if (!isAdmin) {
    // Jika bukan admin, tendang ke halaman utama
    alert('Akses ditolak. Anda bukan admin.');
    window.location.href = 'trackmate.html';
    return;
  }

  // Inisialisasi fungsionalitas umum
  if (typeof initSidebar === 'function') initSidebar();
  if (typeof initLogoutButton === 'function') initLogoutButton();

  // 2. Muat data statistik
  loadAdminStats();

  // 3. Tambahkan event listener ke tombol reset
  const btnAdminResetAll = document.getElementById('btnAdminResetAll');
  btnAdminResetAll?.addEventListener('click', async () => {
    const confirmationText = "PERINGATAN ADMIN:\n\nAnda akan MENGHAPUS SEMUA DATA (laporan bulanan dan file PDF) dari SEMUA PENGGUNA secara permanen. Ini dilakukan untuk mengosongkan database.\n\nKetik 'RESET' untuk konfirmasi.";
    const userInput = prompt(confirmationText);

    if (userInput !== 'RESET') {
      showToast('Reset dibatalkan.', 3000, 'info');
      return;
    }

    try {
      showSpinner();

      // Sertakan token session + body konfirmasi; beberapa fungsi meminta header/confirm
      const { data: sess } = await supabaseClient.auth.getSession();
      const headers = {};
      if (sess?.session?.access_token) headers['Authorization'] = `Bearer ${sess.session.access_token}`;

      // Panggil Edge Function
      const { data, error } = await supabaseClient.functions.invoke('reset-all-data', {
        headers,
        body: { confirm: 'RESET' }
      });

      if (error) {
        // Perkaya pesan error dengan status/body jika ada
        let extra = '';
        try {
          const resp = error?.context?.response;
          if (resp) {
            const text = await resp.text();
            extra = ` (HTTP ${resp.status}) ${text || resp.statusText}`;
          }
        } catch {}
        throw new Error(error.message + extra);
      }

      console.log('Respon dari fungsi:', data);
      showToast('RESET BERHASIL: Semua data pengguna telah dihapus.', 5000, 'success');

    } catch (err) {
      console.error('Gagal memanggil fungsi reset:', err);
      showToast(`RESET GAGAL: ${err.message}`, 5000, 'warn');
    } finally {
      hideSpinner();
    }
  });
});

/**
 * Memuat data statistik untuk dashboard admin.
 * NOTE: Saat ini menggunakan data placeholder. Ini bisa diganti dengan panggilan API sungguhan.
 */
async function loadAdminStats() {
  const el = (id) => document.getElementById(id);
  const totalUsersEl = el('stat-total-users');
  const monthlyReportsEl = el('stat-monthly-reports');
  const totalFilesEl = el('stat-total-files');
  const storageUsageEl = el('stat-storage-usage');

  // Placeholder values
  if (totalUsersEl) totalUsersEl.textContent = '1';
  if (monthlyReportsEl) monthlyReportsEl.textContent = '0';
  if (totalFilesEl) totalFilesEl.textContent = '0';
  if (storageUsageEl) storageUsageEl.textContent = '0 MB';

  // TODO: Ganti dengan panggilan Supabase sungguhan
  // Contoh:
  // const { data: users, error: userError } = await supabaseClient.from('users').select('*', { count: 'exact', head: true });
  // if (totalUsersEl && !userError) totalUsersEl.textContent = users.count;

  // const { data: reports, error: reportError } = await supabaseClient.from('monthly_reports').select('*', { count: 'exact', head: true });
  // if (monthlyReportsEl && !reportError) monthlyReportsEl.textContent = reports.count;

  // ...dan seterusnya untuk file dan storage.
}
