// Show toast messages instead of ugly browser alerts
function showToast(message, type = 'info') {
    const container = document.getElementById('toastContainer');
    if (!container) {
        alert(message);
        return;
    }
    const toast = document.createElement('div');
    toast.className = `toast-msg ${type}`;
    let icon = 'fa-info-circle';
    if (type === 'error') icon = 'fa-circle-exclamation';
    if (type === 'success') icon = 'fa-circle-check';

    toast.innerHTML = `<i class="fa-solid ${icon}"></i><span>${message}</span>`;
    container.appendChild(toast);

    setTimeout(() => {
        toast.style.opacity = '0';
        toast.style.transform = 'translateY(10px)';
        toast.style.transition = 'all 0.3s ease';
        setTimeout(() => toast.remove(), 300);
    }, 4000);
}

// Switch between Sign In and Sign Up tabs
function switchAuthMode(mode) {
    const signinForm = document.getElementById('loginForm');
    const signupForm = document.getElementById('registerForm');
    const tabSignIn = document.getElementById('tabSignIn');
    const tabSignUp = document.getElementById('tabSignUp');
    const googleBar = document.getElementById('googleSignInBar');

    if (mode === 'login') {
        signinForm.style.display = 'flex';
        signupForm.style.display = 'none';
        tabSignIn.classList.add('active');
        tabSignUp.classList.remove('active');
        if (googleBar) googleBar.style.display = 'block';
    } else {
        signinForm.style.display = 'none';
        signupForm.style.display = 'flex';
        tabSignIn.classList.remove('active');
        tabSignUp.classList.add('active');
        if (googleBar) googleBar.style.display = 'none';
    }
}

// Toggle password visibility
function togglePasswordVisibility(inputId, btn) {
    const input = document.getElementById(inputId);
    if (!input) return;
    const icon = btn.querySelector('i');
    if (input.type === 'password') {
        input.type = 'text';
        icon.classList.remove('fa-eye');
        icon.classList.add('fa-eye-slash');
    } else {
        input.type = 'password';
        icon.classList.remove('fa-eye-slash');
        icon.classList.add('fa-eye');
    }
}

// --- Google OAuth ---
async function initiateGoogleSignIn() {
    const btn = document.getElementById('googleSignInBtn');
    const statusEl = document.getElementById('googleOAuthStatus');

    // Check if Google OAuth is configured on the server
    try {
        const res = await fetch(window.STUDYMATE_API_BASE + '/auth/google/status');
        const json = await res.json();
        if (!json.data || !json.data.configured) {
            if (statusEl) {
                statusEl.style.display = 'block';
                statusEl.style.color = '#e53e3e';
                statusEl.innerHTML = '⚠️ Google Sign-In is not configured yet. Please add <code>GOOGLE_CLIENT_ID</code> and <code>GOOGLE_CLIENT_SECRET</code> to your <code>.env</code> file.';
            }
            return;
        }
    } catch (e) {
        showToast('Could not reach server. Is the backend running?', 'error');
        return;
    }

    if (btn) {
        btn.disabled = true;
        btn.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> Redirecting to Google...`;
    }
    // Redirect to Google OAuth flow
    window.location.href = window.STUDYMATE_API_BASE + '/auth/google';
}

// Submit Authentication Request
async function handleAuthSubmit(e, type) {
    e.preventDefault();
    const btn = document.getElementById(type === 'login' ? 'btnSignInSubmit' : 'btnSignUpSubmit');
    const originalText = btn.innerHTML;
    btn.disabled = true;
    btn.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i><span>Processing...</span>`;

    let payload = {};
    if (type === 'login') {
        payload = {
            email: document.getElementById('l_email').value.trim(),
            password: document.getElementById('l_password').value
        };
    } else {
        const rawSubj = document.getElementById('r_subjects').value;
        const subjects = rawSubj ? rawSubj.split(',').map(s => s.trim()).filter(Boolean) : [];
        payload = {
            name: document.getElementById('r_name').value.trim(),
            email: document.getElementById('r_email').value.trim(),
            password: document.getElementById('r_password').value,
            department: document.getElementById('r_dept').value,
            academic_year: document.getElementById('r_year').value,
            subjects
        };
    }

    try {
        const res = await fetch(window.STUDYMATE_API_BASE + '/auth/' + type, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
        const json = await res.json();
        if (json.status === 'success') {
            showToast(type === 'login' ? 'Welcome back! Redirecting to Dashboard...' : 'Account created! Redirecting...', 'success');
            setTimeout(() => {
                window.location.href = 'dashboard.html';
            }, 800);
        } else {
            showToast(json.message || 'Authentication failed. Please check credentials.', 'error');
            btn.disabled = false;
            btn.innerHTML = originalText;
        }
    } catch (err) {
        showToast('Network request failed. Ensure backend server is running.', 'error');
        btn.disabled = false;
        btn.innerHTML = originalText;
    }
}

// Handle error params from Google OAuth redirect
function checkUrlErrors() {
    const params = new URLSearchParams(window.location.search);
    const error = params.get('error');
    if (error) {
        const messages = {
            'google_auth_failed': 'Google sign-in was cancelled or failed. Please try again.',
            'oauth_not_configured': 'Google OAuth is not configured on this server.',
        };
        showToast(messages[error] || `Authentication error: ${error}`, 'error');
        // Clean up URL
        history.replaceState(null, '', window.location.pathname);
    }
}

// Bind event listeners
document.addEventListener('DOMContentLoaded', () => {
    const loginForm = document.getElementById('loginForm');
    const registerForm = document.getElementById('registerForm');

    if (loginForm) loginForm.addEventListener('submit', e => handleAuthSubmit(e, 'login'));
    if (registerForm) registerForm.addEventListener('submit', e => handleAuthSubmit(e, 'register'));

    checkUrlErrors();

    // Check existing session — redirect to dashboard if already logged in
    (async () => {
        try {
            const res = await fetch(window.STUDYMATE_API_BASE + '/auth/me');
            if (res.ok) {
                const json = await res.json();
                if (json.status === 'success' && json.data && json.data.userId) {
                    window.location.href = 'dashboard.html';
                }
            }
        } catch (e) {}
    })();
});
