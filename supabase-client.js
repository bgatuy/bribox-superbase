// supabase-client.js

// Ganti dengan URL dan anon key dari proyek Supabase Anda
const SUPABASE_URL = 'https://YOR_PROJECT_ID.supabase.co';
const SUPABASE_ANON_KEY = 'YOUR_ANON_KEY';

// Inisialisasi Supabase client. Variabel `supabaseClient` akan tersedia secara global.
const { createClient } = supabase;
const supabaseClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// ==================================================
// INI ADALAH SCRIPT "PENJAGA GERBANG"
// ==================================================
// Cek jika kita TIDAK sedang di halaman login
if (!window.location.pathname.endsWith('login.html') && !window.location.pathname.endsWith('register.html')) {
    // Cek sesi login pengguna
    supabaseClient.auth.getSession().then(({ data: { session } }) => {
        if (!session) {
            // Jika tidak ada sesi (belum login), tendang ke halaman login.
            window.location.href = 'login.html';
        }
    });
}