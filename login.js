// login.js

// Ganti dengan URL dan anon key dari proyek Supabase Anda
const SUPABASE_URL = 'https://hfwklepqsiwubjxatmsq.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imhmd2tsZXBxc2l3dWJqeGF0bXNxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjIwODk5MDAsImV4cCI6MjA3NzY2NTkwMH0.gWi8ukCILo11q-3wToMZQ4aHOLrp19Ss8jZoDHMJusY';

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