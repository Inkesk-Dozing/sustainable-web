/* ============================================
   KRMU ECHOSENSE - Admin Auth Logic
   ============================================ */

document.addEventListener('DOMContentLoaded', () => {
    const loginForm = document.getElementById('adminLoginForm');
    const loginError = document.getElementById('loginError');
    const loginBtn = document.getElementById('loginBtn');

    // Admin Credentials
    // In a real app, these should be handled via a backend or custom claims.
    // For this project, we'll use a dedicated admin login check.
    const ADMIN_ID = "admin";
    const ADMIN_PASS = "admin123"; // User should change this

    loginForm.addEventListener('submit', (e) => {
        e.preventDefault();
        
        const userId = document.getElementById('adminUser').value;
        const pass = document.getElementById('adminPass').value;

        loginBtn.disabled = true;
        loginBtn.textContent = "Verifying...";
        loginError.textContent = "";

        // Simple validation
        if (userId === ADMIN_ID && pass === ADMIN_PASS) {
            // Set admin session
            localStorage.setItem('krmu_admin_session', 'true');
            localStorage.setItem('krmu_admin_id', userId);
            
            showToast('Login Successful', 'Welcome to the Admin Panel', 'success');
            
            setTimeout(() => {
                window.location.href = 'admin-dashboard.html';
            }, 1000);
        } else {
            loginBtn.disabled = false;
            loginBtn.textContent = "Login to Panel";
            loginError.textContent = "Invalid Admin ID or Password";
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
