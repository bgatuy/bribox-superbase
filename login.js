// login.js

document.addEventListener('DOMContentLoaded', () => {
    const googleLoginBtn = document.getElementById('googleLoginBtn');
    const errorDiv = document.getElementById('login-error');

    // PENGECEKAN PENTING:
    // Jika pengguna membuka halaman login tapi sudah punya sesi,
    // langsung arahkan ke halaman utama.
    supabaseClient.auth.getSession().then(({ data: { session } }) => {
        if (session) {
            window.location.href = '/trackmate.html';
        }
    });

    // Handler untuk Login with Google
    googleLoginBtn?.addEventListener('click', async () => {
        if (typeof supabaseClient === 'undefined') {
            if(errorDiv) errorDiv.textContent = 'Supabase client tidak terdefinisi.';
            return;
        }

        const { data, error } = await supabaseClient.auth.signInWithOAuth({
            provider: 'google',
            options: {
                redirectTo: window.location.origin + '/trackmate.html'
            }
        });
        if (error) {
            if(errorDiv) errorDiv.textContent = `Login Google Gagal: ${error.message}`;
        }
    });
});