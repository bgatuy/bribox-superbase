// login.js

document.addEventListener('DOMContentLoaded', async () => {
    const googleLoginBtn = document.getElementById('googleLoginBtn');
    const errorDiv = document.getElementById('login-error');

    // 1. Cek apakah pengguna sudah memiliki sesi aktif.
    // Jika ya, jangan tampilkan halaman login, langsung arahkan ke aplikasi.
    try {
        const { data: { session } } = await supabaseClient.auth.getSession();
        if (session) {
            window.location.href = '/trackmate.html';
            return; // Hentikan eksekusi script lebih lanjut jika sudah redirect.
        }
    } catch (e) {
        console.error("Gagal memeriksa sesi:", e);
    }

    // 2. Handler untuk tombol Login with Google.
    googleLoginBtn?.addEventListener('click', async () => {
        if (typeof supabaseClient === 'undefined') {
            if (errorDiv) errorDiv.textContent = 'Supabase client tidak terdefinisi.';
            return;
        }
        const { data, error } = await supabaseClient.auth.signInWithOAuth({
            provider: 'google',
        });
        if (error) {
            if(errorDiv) errorDiv.textContent = `Login Google Gagal: ${error.message}`;
        }
    });

    // 3. Listener ini akan menangani pengalihan SETELAH login berhasil.
    supabaseClient.auth.onAuthStateChange((event, session) => {
        if (event === 'SIGNED_IN' && session) {
            window.location.href = '/trackmate.html';
        }
    });
});
