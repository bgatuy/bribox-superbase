// admin.js

document.addEventListener('DOMContentLoaded', async () => {
  // Verifikasi admin dan inisialisasi layout sekarang ditangani oleh supabase-client.js dan utils.js.
  // Cukup panggil fungsi yang spesifik untuk halaman ini.
  loadAdminStats();

  // Event untuk tombol Reset Semua Data
  const btnAdminResetAll = document.getElementById('btnAdminResetAll');
  btnAdminResetAll?.addEventListener('click', handleAdminReset);
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
    // Lakukan paralel untuk kecepatan
    const [
      filesCountRes,
      monthlyCountRes,
      sizesUsersRes
    ] = await Promise.all([
      supabaseClient.from('pdf_history').select('*', { count: 'exact', head: true }),
      supabaseClient.from('monthly_reports').select('*', { count: 'exact', head: true }),
      supabaseClient.from('pdf_history').select('user_id,size_bytes')
    ]);

    // Total file PDF
    if (!filesCountRes.error && totalFilesEl) {
      totalFilesEl.textContent = String(filesCountRes.count || 0);
    }

    // Total laporan bulanan
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
      if (totalUsersEl) totalUsersEl.textContent = String(userSet.size);
      if (storageUsageEl) storageUsageEl.textContent = formatBytes(totalBytes);
    }
  } catch (e) {
    console.warn('Gagal memuat statistik admin:', e);
  }
}

/**
 * Menangani logika untuk mereset semua data melalui Edge Function.
 */
async function handleAdminReset() {
  const confirmationText =
    "PERINGATAN ADMIN:\n\nAnda akan MENGHAPUS SEMUA DATA pengguna (histori PDF, file di storage, dan laporan bulanan).\n\nKetik 'RESET' untuk konfirmasi.";
  const userInput = prompt(confirmationText);
  if (userInput !== 'RESET') {
    showToast('Reset dibatalkan.', 3000, 'info');
    return;
  }

  try {
    showSpinner();

    // Ambil access token pengguna yang sedang login untuk otorisasi di Edge Function
    const { data: { session } } = await supabaseClient.auth.getSession();
    const token = session?.access_token;
    if (!token) throw new Error("Otorisasi gagal: token tidak ditemukan.");

    // Panggil Edge Function 'reset-all-data'
    const { data, error } = await supabaseClient.functions.invoke('reset-all-data', {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
      body: { confirm: 'RESET' }
    });

    if (error) {
      const resp = error?.context?.response;
      const extra = resp ? ` (HTTP ${resp.status} ${resp.statusText || ''})` : '';
      throw new Error(error.message + extra);
    }

    showToast('RESET BERHASIL: Semua data pengguna telah dihapus.', 5000, 'success');
    loadAdminStats(); // Muat ulang statistik setelah reset
  } catch (err) {
    showToast(`RESET GAGAL: ${err.message}`, 6000, 'warn');
  } finally {
    hideSpinner();
  }
}
