/* ============================================
   KRMU ECHOSENSE - Admin Auth Logic
   Uses anonymous Firebase Auth to bypass domain restrictions.
   Admin credentials are validated locally; Firebase anonymous
   sign-in is used only to satisfy Firestore auth requirements.
   ============================================ */

document.addEventListener('DOMContentLoaded', () => {
    const loginForm = document.getElementById('adminLoginForm');
    const loginError = document.getElementById('loginError');
    const loginBtn = document.getElementById('loginBtn');

    // Hardcoded admin credentials (change password here if needed)
    const VALID_IDS = ['admin', 'admin@krmu.edu.in'];
    const ADMIN_PASSWORD = 'admin123';

    async function signInAnonymouslyForFirestore() {
        // Wait for Firebase to be ready
        for (let i = 0; i < 30; i++) {
            if (window.firebase && window.firebase.auth) break;
            await new Promise(r => setTimeout(r, 200));
        }
        if (!window.firebase || !window.firebase.auth) {
            console.warn('Firebase not loaded — Firestore reads may fail');
            return false;
        }
        try {
            const auth = firebase.auth();
            // If already signed in, reuse session
            if (auth.currentUser) return true;
            await auth.signInAnonymously();
            console.log('Signed in anonymously for Firestore access');
            return true;
        } catch (err) {
            console.warn('Anonymous sign-in failed:', err.code, err.message);
            // Non-fatal — admin session still works via localStorage
            return false;
        }
    }

    loginForm.addEventListener('submit', async (e) => {
        e.preventDefault();

        const userId = document.getElementById('adminUser').value.trim();
        const pass = document.getElementById('adminPass').value;

        loginBtn.disabled = true;
        loginBtn.textContent = 'Verifying...';
        loginError.textContent = '';

        if (VALID_IDS.includes(userId) && pass === ADMIN_PASSWORD) {
            // Sign in anonymously so Firestore rules pass (allow read: if request.auth != null)
            await signInAnonymouslyForFirestore();

            localStorage.setItem('krmu_admin_session', 'true');
            localStorage.setItem('krmu_admin_id', userId);

            showToast('Login Successful', 'Welcome to the Admin Panel', 'success');

            setTimeout(() => {
                window.location.href = 'admin-dashboard.html';
            }, 1000);
        } else {
            loginBtn.disabled = false;
            loginBtn.textContent = 'Login to Panel';
            loginError.textContent = 'Invalid Admin ID or Password';
            showToast('Login Failed', 'Please check your credentials', 'error');
        }
    });
});

function showToast(title, message, type = 'success') {
    const toast = document.getElementById('toast');
    if (!toast) return;

    toast.innerHTML = `
        <div class="toast__body">
            <div class="toast__title">${title}</div>
            <div class="toast__message">${message}</div>
        </div>
    `;
    toast.className = `toast toast--visible toast--${type}`;

    setTimeout(() => {
        toast.classList.remove('toast--visible');
    }, 3000);
}
