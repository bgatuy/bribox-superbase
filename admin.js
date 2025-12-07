// admin.js

document.addEventListener('DOMContentLoaded', async () => {
  // Verifikasi admin dan inisialisasi layout sekarang ditangani oleh supabase-client.js dan utils.js.
  // Cukup panggil fungsi yang spesifik untuk halaman ini.
  // Muat statistik dan daftar pengguna secara bersamaan
  Promise.all([
    loadAdminStats(),
    loadUserList()
  ]);

  // Event untuk tombol Reset Semua Data
  const btnAdminResetAll = document.getElementById('btnAdminResetAll');
  btnAdminResetAll?.addEventListener('click', handleAdminReset);

  // Event delegation untuk aksi di tabel pengguna (ubah role, hapus)
  const userTableBody = document.getElementById('user-table-body');
  userTableBody?.addEventListener('change', handleRoleChange);
  userTableBody?.addEventListener('click', handleDeleteUser);
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
    // Panggil satu RPC function yang akan menghitung semua statistik di sisi server
    const { data: stats, error } = await supabaseClient.rpc('get_admin_stats');

    if (error) {
      throw error;
    }

    if (stats) {
      if (totalFilesEl) totalFilesEl.textContent = String(stats.total_files || 0);
      if (monthlyReportsEl) monthlyReportsEl.textContent = String(stats.monthly_reports || 0);
      if (totalUsersEl) totalUsersEl.textContent = String(stats.total_users || 0);
      if (storageUsageEl) storageUsageEl.textContent = formatBytes(stats.storage_usage || 0);
    }
  } catch (e) {
    console.warn('Gagal memuat statistik admin:', e);
    // Tampilkan pesan error di UI agar admin tahu ada masalah
    const statCards = document.querySelectorAll('.stat-card .stat-value');
    statCards.forEach(card => {
        card.textContent = 'Error';
        card.style.color = '#dc3545'; // Merah
    });
    showToast?.(`Gagal memuat statistik: ${e.message}`, 5000, 'warn');
  }
}

/**
 * Memuat daftar semua pengguna dan menampilkannya dalam tabel.
 */
async function loadUserList() {
  const tableBody = document.getElementById('user-table-body');
  if (!tableBody) return;

  // Dapatkan ID admin yang sedang login untuk mencegah modifikasi diri sendiri
  const { data: { user: currentAdmin } } = await supabaseClient.auth.getUser();
  const currentAdminId = currentAdmin?.id;

  try {
    const { data: users, error } = await supabaseClient.rpc('get_all_users');
    if (error) throw error;

    if (!users || users.length === 0) {
      tableBody.innerHTML = `<tr><td colspan="5" class="text-center">Tidak ada pengguna ditemukan.</td></tr>`;
      return;
    }

    // Kosongkan body tabel sebelum mengisi
    tableBody.innerHTML = '';

    // Helper untuk format tanggal
    const formatDate = (dateString) => {
      if (!dateString) return 'Belum pernah';
      return new Date(dateString).toLocaleString('id-ID', {
        dateStyle: 'medium',
        timeStyle: 'short'
      });
    };

    users.forEach(user => {
      const isCurrentUser = user.user_id === currentAdminId;
      const row = document.createElement('tr');

      // Tampilkan dropdown untuk user lain, tampilkan badge statis untuk diri sendiri
      const roleCellContent = isCurrentUser
        ? `<span class="role-badge role-${user.role}">${user.role}</span>`
        : `
          <select class="role-selector" data-user-id="${user.user_id}" data-original-role="${user.role}">
            <option value="user" ${user.role === 'user' ? 'selected' : ''}>User</option>
            <option value="admin" ${user.role === 'admin' ? 'selected' : ''}>Admin</option>
          </select>
        `;

      row.innerHTML = `
        <td>${user.email}</td>
        <td>${roleCellContent}</td>
        <td>${formatDate(user.created_at)}</td>
        <td>${formatDate(user.last_sign_in_at)}</td>
        <td class="actions">
          <button class="btn-icon" title="Hapus Pengguna" data-user-id="${user.user_id}" data-user-email="${user.email}" ${isCurrentUser ? 'disabled' : ''}>
            <span class="material-icons">delete_outline</span>
          </button>
        </td>
      `;
      tableBody.appendChild(row);
    });

  } catch (err) {
    console.error('Gagal memuat daftar pengguna:', err);
    tableBody.innerHTML = `<tr><td colspan="5" class="text-center" style="color: #dc3545;">Gagal memuat data: ${err.message}</td></tr>`;
  }
}

/**
 * Menangani event saat admin mengubah role pengguna dari dropdown.
 * @param {Event} e The change event.
 */
async function handleRoleChange(e) {
  if (!e.target.classList.contains('role-selector')) return;

  const selector = e.target;
  const targetUserId = selector.dataset.userId;
  const newRole = selector.value;
  const originalRole = selector.dataset.originalRole;
  const userEmail = selector.closest('tr').cells[0].textContent;

  if (newRole === originalRole) return; // Tidak ada perubahan

  const confirmation = confirm(`Anda yakin ingin mengubah role untuk pengguna "${userEmail}" dari "${originalRole}" menjadi "${newRole}"?`);

  if (!confirmation) {
    selector.value = originalRole; // Kembalikan pilihan jika dibatalkan
    return;
  }

  try {
    showSpinner();
    const { error } = await supabaseClient.rpc('admin_update_user_role', {
      target_user_id: targetUserId,
      new_role: newRole
    });

    if (error) throw error;

    showToast(`Role untuk ${userEmail} berhasil diubah.`, 4000, 'success');
    await loadUserList(); // Muat ulang daftar pengguna untuk memastikan UI konsisten
  } catch (err) {
    showToast(`Gagal mengubah role: ${err.message}`, 6000, 'warn');
    selector.value = originalRole; // Kembalikan jika gagal
  } finally {
    hideSpinner();
  }
}

/**
 * Menangani event saat admin mengklik tombol hapus pengguna.
 * @param {Event} e The click event.
 */
async function handleDeleteUser(e) {
  const deleteButton = e.target.closest('.btn-icon[title="Hapus Pengguna"]');
  if (!deleteButton) return;

  const targetUserId = deleteButton.dataset.userId;
  const userEmail = deleteButton.dataset.userEmail;

  const confirmation = confirm(
    `PERINGATAN!\n\nAnda yakin ingin menghapus pengguna "${userEmail}"?\n\nSemua data milik pengguna ini (file, histori, laporan) akan dihapus secara permanen. Tindakan ini tidak bisa dibatalkan.`
  );

  if (!confirmation) return;

  try {
    showSpinner();

    // Ambil token untuk otorisasi
    const { data: { session } } = await supabaseClient.auth.getSession();
    if (!session?.access_token) throw new Error("Otorisasi gagal: token tidak ditemukan.");

    // Panggil Edge Function untuk menghapus pengguna
    const { error } = await supabaseClient.functions.invoke('admin-delete-user', {
      method: 'POST',
      headers: { Authorization: `Bearer ${session.access_token}` },
      body: { target_user_id: targetUserId }
    });

    if (error) throw error;

    showToast(`Pengguna ${userEmail} berhasil dihapus.`, 4000, 'success');
    // Muat ulang daftar pengguna dan statistik
    await Promise.all([
      loadUserList(),
      loadAdminStats()
    ]);
  } catch (err) {
    showToast(`Gagal menghapus pengguna: ${err.message}`, 6000, 'warn');
  } finally {
    hideSpinner();
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
