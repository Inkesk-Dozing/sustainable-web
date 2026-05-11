/* ============================================
   KRMU ECHOSENSE - Admin Auth Logic
   ============================================ */

document.addEventListener('DOMContentLoaded', () => {
    const loginForm = document.getElementById('adminLoginForm');
    const loginError = document.getElementById('loginError');
    const loginBtn = document.getElementById('loginBtn');

    // Accept both 'admin' and 'admin@krmu.edu.in'
    const ADMIN_EMAIL = "admin@krmu.edu.in";

    async function authenticateAdminWithFirebase(password) {
        if (typeof firebase === 'undefined' || !firebase.auth) {
            console.error("Firebase Auth not loaded");
            return false;
        }
        try {
            await firebase.auth().signInWithEmailAndPassword(ADMIN_EMAIL, password);
            return true;
        } catch (error) {
            if (error.code === 'auth/user-not-found') {
                try {
                    await firebase.auth().createUserWithEmailAndPassword(ADMIN_EMAIL, password);
                    return true;
                } catch (createError) {
                    console.error("Failed to create admin user:", createError);
                    return false;
                }
            }
            console.error("Admin auth failed:", error);
            return false;
        }
    }

    loginForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const userId = document.getElementById('adminUser').value;
        const pass = document.getElementById('adminPass').value;

        loginBtn.disabled = true;
        loginBtn.textContent = "Verifying...";
        loginError.textContent = "";

        if (userId === 'admin' || userId === ADMIN_EMAIL) {
            const success = await authenticateAdminWithFirebase(pass);
            
            if (success) {
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
        } else {
            loginBtn.disabled = false;
            loginBtn.textContent = "Login to Panel";
            loginError.textContent = "Invalid Admin ID";
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
