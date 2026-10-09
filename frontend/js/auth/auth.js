function toggleAuth() {
    const s = document.getElementById('signin');
    const r = document.getElementById('signup');
    const sub = document.getElementById('authSub');
    if (s.style.display === 'none') {
        s.style.display = 'block';
        r.style.display = 'none';
        sub.innerText = 'Sign in to get matched with classmates.';
    } else {
        s.style.display = 'none';
        r.style.display = 'block';
        sub.innerText = 'Create an account to get started.';
    }
}

async function handleAuth(e, type) {
    e.preventDefault();
    const email = document.getElementById(type === 'login' ? 'l_email' : 'r_email').value;
    const password = document.getElementById(type === 'login' ? 'l_password' : 'r_password').value;
    
    try {
        const res = await fetch(window.STUDYMATE_API_BASE + '/auth/' + type, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, password })
        });
        const json = await res.json();
        if (json.status === 'success') {
            window.location.href = 'dashboard.html';
        } else {
            alert(json.message);
        }
    } catch (err) {
        alert('Request failed');
    }
}

document.getElementById('loginForm').addEventListener('submit', e => handleAuth(e, 'login'));
document.getElementById('registerForm').addEventListener('submit', e => handleAuth(e, 'register'));

window.addEventListener('DOMContentLoaded', async () => {
    try {
        const res = await fetch(window.STUDYMATE_API_BASE + '/auth/me');
        if (res.ok) {
            const json = await res.json();
            if (json.status === 'success') window.location.href = 'dashboard.html';
        }
    } catch (e) {}
});
