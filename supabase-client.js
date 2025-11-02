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
// Cek jika kita TIDAK sedang di halaman login
if (!window.location.pathname.endsWith('login.html')) {
    // Menggunakan onAuthStateChange untuk menunggu status login siap.
    // Ini akan berjalan sekali saat halaman dimuat.
    const { data: { subscription } } = supabaseClient.auth.onAuthStateChange((event, session) => {
        // Berhenti mendengarkan setelah pengecekan pertama selesai untuk efisiensi.
        subscription.unsubscribe();

        // Jika event adalah INITIAL_SESSION dan tidak ada sesi,
        // artinya pengguna benar-benar belum login.
        if (event === 'INITIAL_SESSION' && !session) {
            // Tendang ke halaman login.
            window.location.href = '/login.html'; // FIX: Gunakan path absolut
        }
    });
}