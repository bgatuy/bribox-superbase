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

      // Panggil Edge Function (tanpa header kustom agar tidak memicu isu CORS tambahan)
      const { data, error } = await supabaseClient.functions.invoke('reset-all-data', {
        body: { confirm: 'RESET' }
      });

      if (error) {
        // Perkaya pesan error dengan status jika tersedia
        const resp = error?.context?.response;
        const extra = resp ? ` (HTTP ${resp.status} ${resp.statusText || ''})` : '';
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

  if (typeof supabaseClient === 'undefined') return;

  // Helper untuk format ukuran
  const formatBytes = (bytes) => {
    const b = Number(bytes) || 0;
    if (b >= 1024 * 1024 * 1024) return (b / (1024 * 1024 * 1024)).toFixed(2) + ' GB';
    if (b >= 1024 * 1024) return (b / (1024 * 1024)).toFixed(2) + ' MB';
    if (b >= 1024) return (b / 1024).toFixed(2) + ' KB';
    return b + ' B';
  };

  try {
    const now = new Date();
    const yyyy = now.getFullYear();
    const mm = String(now.getMonth() + 1).padStart(2, '0');
    const monthKey = `${yyyy}-${mm}`; // sesuai kolom month di monthly_reports

    // Lakukan paralel untuk kecepatan
    const [
      filesCountRes,
      monthlyCountRes,
      sizesUsersRes
    ] = await Promise.all([
      supabaseClient.from('pdf_history').select('*', { count: 'exact', head: true }),
      supabaseClient.from('monthly_reports').select('*', { count: 'exact', head: true }).eq('month', monthKey),
      // Ambil hanya kolom yang diperlukan untuk menghemat payload
      supabaseClient.from('pdf_history').select('user_id,size_bytes')
    ]);

    // Total file PDF
    if (!filesCountRes.error && totalFilesEl) {
      totalFilesEl.textContent = String(filesCountRes.count || 0);
    }

    // Laporan bulan ini
    if (!monthlyCountRes.error && monthlyReportsEl) {
      monthlyReportsEl.textContent = String(monthlyCountRes.count || 0);
    }

    // Total pengguna (distinct user_id) + total size
    if (!sizesUsersRes.error && Array.isArray(sizesUsersRes.data)) {
      const rows = sizesUsersRes.data;
      let totalBytes = 0;
      const userSet = new Set();
      for (const r of rows) {
        if (r.user_id) userSet.add(r.user_id);
        if (typeof r.size_bytes === 'number') totalBytes += r.size_bytes;
      }
      if (totalUsersEl) totalUsersEl.textContent = String(userSet.size || 0);
      if (storageUsageEl) storageUsageEl.textContent = formatBytes(totalBytes);
    }
  } catch (e) {
    // Biarkan placeholder jika gagal; tampilkan log untuk debugging
    console.warn('Gagal memuat statistik admin:', e);
  }
}
