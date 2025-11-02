// login.js

// Ganti dengan URL dan anon key dari proyek Supabase Anda
const SUPABASE_URL = 'https://YOR_PROJECT_ID.supabase.co';
const SUPABASE_ANON_KEY = 'YOUR_ANON_KEY';

const supabase = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

const errorDiv = document.getElementById('login-error');
const googleLoginBtn = document.getElementById('googleLoginBtn');

// Handler untuk Login with Google
googleLoginBtn.addEventListener('click', async () => {
    const { data, error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
    });
    if (error) {
        errorDiv.textContent = `Login Google Gagal: ${error.message}`;
    }
});