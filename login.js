// login.js

const googleLoginBtn = document.getElementById('googleLoginBtn');
const errorDiv = document.getElementById('login-error');

// Handler untuk Login with Google
googleLoginBtn?.addEventListener('click', async () => {
    // Pastikan kita menggunakan supabaseClient yang sama dari supabase-client.js
    if (typeof supabaseClient === 'undefined') {
        errorDiv.textContent = 'Supabase client tidak terdefinisi.';
        return;
    }

    const { data, error } = await supabaseClient.auth.signInWithOAuth({
        provider: 'google',
    });
    if (error) {
        errorDiv.textContent = `Login Google Gagal: ${error.message}`;
    }
});