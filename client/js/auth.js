/* ============================================
   KRMU ECHOSENSE - Auth Module
   OTP Authentication Client (ES6)
   ============================================ */

// Automatically detect API URL based on current domain
const API_URL = window.location.hostname === 'localhost'
    ? 'http://localhost:3000'
    : window.location.origin;

// ========== State ==========
let resendTimer = null;
let resendCountdown = 0;

// ========== API Helpers ==========
async function apiRequest(endpoint, data) {
    try {
        const res = await fetch(`${API_URL}${endpoint}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify(data)
        });
        return await res.json();
    } catch (error) {
        console.error('API Error:', error);
        return { success: false, message: 'Network error. Please try again.' };
    }
}

async function checkAuth() {
    try {
        const res = await fetch(`${API_URL}/auth/me`, { credentials: 'include' });
        return await res.json();
    } catch {
        return { success: false };
    }
}

async function logout() {
    localStorage.removeItem('krmu_session');
    localStorage.removeItem('krmu_admin_session');
    
    // If Firebase is loaded, sign out there too
    if (typeof firebase !== 'undefined' && firebase.auth) {
        try {
            await firebase.auth().signOut();
        } catch(e) {}
    }
    
    window.location.href = 'index.html';
}

// ========== OTP Functions ==========
async function requestOTP(identifier, purpose) {
    return await apiRequest('/auth/request-otp', { identifier, purpose });
}

async function verifyOTP(email, otp, purpose, payload = null) {
    const data = { email, otp, purpose };
    if (payload) data.payload = payload;

    // 1. Verify OTP with our backend
    const result = await apiRequest('/auth/verify-otp', data);

    // 2. If successful and we received a Firebase Token, sign in
    if (result.success && result.firebaseToken) {
        try {
            if (typeof firebase !== 'undefined' && firebase.auth) {
                await firebase.auth().signInWithCustomToken(result.firebaseToken);
                // console.log('🔥 Firebase Sign-In Successful');
            } else {
                console.warn('Firebase SDK not loaded, skipping Firebase auth');
            }
        } catch (error) {
            console.error('Firebase Custom Token Sign-In Error:', error);
            // We don't fail the whole login if Firebase fails, 
            // but you might want to show a warning or fallback.
        }
    }

    return result;
}

// ========== UI Helpers ==========
function showError(elementId, message) {
    const el = document.getElementById(elementId);
    if (el) {
        el.textContent = message || '';
        el.setAttribute('aria-live', 'polite');
    }
}

function setLoading(buttonId, loading) {
    const btn = document.getElementById(buttonId);
    if (!btn) return;

    btn.disabled = loading;

    if (loading) {
        btn.dataset.originalText = btn.dataset.originalText || btn.textContent;
        btn.classList.add('btn--loading');
        btn.setAttribute('aria-busy', 'true');
    } else {
        btn.classList.remove('btn--loading');
        btn.removeAttribute('aria-busy');
        if (btn.dataset.originalText) {
            btn.textContent = btn.dataset.originalText;
        }
    }
}

// ========== Resend Timer ==========
function startResendTimer(buttonId, seconds = 30) {
    const btn = document.getElementById(buttonId);
    if (!btn) return;

    clearResendTimer();
    resendCountdown = seconds;
    btn.disabled = true;

    const updateTimer = () => {
        if (resendCountdown > 0) {
            btn.textContent = `Resend code (${resendCountdown}s)`;
            resendCountdown--;
            resendTimer = setTimeout(updateTimer, 1000);
        } else {
            btn.textContent = 'Resend code';
            btn.disabled = false;
        }
    };

    updateTimer();
}

function clearResendTimer() {
    if (resendTimer) {
        clearTimeout(resendTimer);
        resendTimer = null;
    }
}

// ========== OTP Input Component ==========
function setupOTPInput(containerId) {
    const container = document.getElementById(containerId);
    if (!container) return;

    // Generate 6 OTP digit inputs with new class names
    container.innerHTML = Array(6).fill(0).map((_, i) => `
    <input 
      type="text" 
      maxlength="1" 
      class="otp-input__digit" 
      data-index="${i}" 
      inputmode="numeric" 
      pattern="[0-9]" 
      autocomplete="one-time-code"
      aria-label="Digit ${i + 1} of 6"
      placeholder="·"
    >
  `).join('');

    const inputs = container.querySelectorAll('.otp-input__digit');

    inputs.forEach((input, i) => {
        // Handle input
        input.addEventListener('input', (e) => {
            const value = e.target.value.replace(/\D/g, '');
            e.target.value = value.slice(-1);

            // Add filled class for styling
            e.target.classList.toggle('otp-input__digit--filled', !!e.target.value);

            // Auto-advance to next input
            if (value && i < 5) {
                inputs[i + 1].focus();
            }

            // Auto-submit when all 6 digits entered
            if (i === 5 && value) {
                const allFilled = Array.from(inputs).every(inp => inp.value);
                if (allFilled) {
                    // Trigger form submit
                    const form = container.closest('form');
                    if (form) {
                        form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
                    }
                }
            }
        });

        // Handle backspace navigation
        input.addEventListener('keydown', (e) => {
            if (e.key === 'Backspace' && !e.target.value && i > 0) {
                inputs[i - 1].focus();
                inputs[i - 1].value = '';
                inputs[i - 1].classList.remove('otp-input__digit--filled');
            }

            // Arrow key navigation
            if (e.key === 'ArrowLeft' && i > 0) {
                e.preventDefault();
                inputs[i - 1].focus();
            }
            if (e.key === 'ArrowRight' && i < 5) {
                e.preventDefault();
                inputs[i + 1].focus();
            }
        });

        // Handle paste
        input.addEventListener('paste', (e) => {
            e.preventDefault();
            const paste = (e.clipboardData || window.clipboardData)
                .getData('text')
                .replace(/\D/g, '')
                .slice(0, 6);

            paste.split('').forEach((char, j) => {
                if (inputs[j]) {
                    inputs[j].value = char;
                    inputs[j].classList.add('otp-input__digit--filled');
                }
            });

            // Focus last filled or next empty
            const focusIndex = Math.min(paste.length, 5);
            inputs[focusIndex].focus();

            // Auto-submit if 6 digits pasted
            if (paste.length >= 6) {
                const form = container.closest('form');
                if (form) {
                    setTimeout(() => {
                        form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
                    }, 100);
                }
            }
        });

        // Select all on focus
        input.addEventListener('focus', () => {
            input.select();
        });
    });
}

function getOTPValue(containerId) {
    const inputs = document.querySelectorAll(`#${containerId} .otp-input__digit`);
    return Array.from(inputs).map(i => i.value).join('');
}

function clearOTPInput(containerId) {
    const inputs = document.querySelectorAll(`#${containerId} .otp-input__digit`);
    inputs.forEach(input => {
        input.value = '';
        input.classList.remove('otp-input__digit--filled');
    });
    if (inputs[0]) inputs[0].focus();
}

// ========== Toast Notifications ==========
const TOAST_ICONS = {
    success: '✅',
    error: '❌',
    warning: '⚠️',
    info: 'ℹ️',
};

let _toastHideTimer = null;

function showToast(title, message, type = 'success', duration = 4500) {
    const toast = document.getElementById('toast');
    if (!toast) return;

    // Clear any running auto-hide timer
    if (_toastHideTimer) { clearTimeout(_toastHideTimer); _toastHideTimer = null; }

    // Render
    toast.innerHTML = `
        <div class="toast__icon">${TOAST_ICONS[type] || '💬'}</div>
        <div class="toast__body">
            <div class="toast__title">${title}</div>
            ${message ? `<div class="toast__message">${message}</div>` : ''}
        </div>
        <button class="toast__close" aria-label="Dismiss" onclick="window.auth.hideToast()">✕</button>
    `;

    // Reset classes
    toast.className = 'toast';
    toast.classList.add(`toast--${type}`);

    // Animate in (double rAF ensures transition fires)
    requestAnimationFrame(() => requestAnimationFrame(() => {
        toast.classList.add('toast--visible');
    }));

    // Auto-hide
    _toastHideTimer = setTimeout(() => hideToast(), duration);
}

function hideToast() {
    const toast = document.getElementById('toast');
    if (toast) {
        toast.classList.remove('toast--visible');
        if (_toastHideTimer) { clearTimeout(_toastHideTimer); _toastHideTimer = null; }
    }
}


// ========== Firebase Availability Check ==========
function waitForFirebase(timeout = 5000) {
    return new Promise((resolve, reject) => {
        if (typeof firebase !== 'undefined' && firebase.auth) {
            resolve();
            return;
        }

        const startTime = Date.now();
        const checkInterval = setInterval(() => {
            if (typeof firebase !== 'undefined' && firebase.auth) {
                clearInterval(checkInterval);
                resolve();
            } else if (Date.now() - startTime > timeout) {
                clearInterval(checkInterval);
                reject(new Error('Firebase SDK not loaded'));
            }
        }, 100);
    });
}

// ========== Firebase Auth Methods ==========
async function signIn(email, password) {
    try {
        // --- ADMIN BYPASS ---
        if (email === 'admin@krmu.edu.in' && password === 'admin123') {
            localStorage.setItem('krmu_admin_session', 'true');
            // We also set the regular session so the router allows access to dashboard.html
            localStorage.setItem('krmu_session', 'true');
            return { success: true };
        }
        // --------------------

        if (!email.endsWith('@krmu.edu.in')) {
            return { success: false, message: 'Please use your @krmu.edu.in email address' };
        }

        await waitForFirebase();

        await firebase.auth().signInWithEmailAndPassword(email, password);
        localStorage.setItem('krmu_session', 'true');
        return { success: true };
    } catch (error) {
        console.error('Sign in error:', error);
        let message = 'Sign in failed. Please try again.';
        if (error.message === 'Firebase SDK not loaded') message = 'Authentication service not available. Please refresh the page.';
        if (error.code === 'auth/user-not-found') message = 'No account found with this email';
        if (error.code === 'auth/wrong-password') message = 'Incorrect password';
        if (error.code === 'auth/invalid-email') message = 'Invalid email address';
        if (error.code === 'auth/too-many-requests') message = 'Too many failed attempts. Try again later';
        return { success: false, message };
    }
}

async function signUp(email, password, displayName) {
    try {
        if (!email.endsWith('@krmu.edu.in')) {
            return { success: false, message: 'Please use your @krmu.edu.in email address' };
        }

        await waitForFirebase();

        const result = await firebase.auth().createUserWithEmailAndPassword(email, password);

        if (result.user && displayName) {
            await result.user.updateProfile({ displayName });
        }

        // Sign out immediately after account creation.
        // The user must explicitly sign in — this prevents auth state from
        // triggering a dashboard redirect while still on the login page.
        await firebase.auth().signOut();
        localStorage.removeItem('krmu_session');

        return { success: true };
    } catch (error) {
        console.error('Sign up error:', error);
        let message = 'Sign up failed. Please try again.';
        if (error.message === 'Firebase SDK not loaded') message = 'Authentication service not available. Please refresh the page.';
        if (error.code === 'auth/email-already-in-use') message = 'An account with this email already exists';
        if (error.code === 'auth/invalid-email') message = 'Invalid email address';
        if (error.code === 'auth/weak-password') message = 'Password should be at least 8 characters';
        return { success: false, message };
    }
}

async function sendPasswordReset(email) {
    try {
        await waitForFirebase();

        await firebase.auth().sendPasswordResetEmail(email);
        return { success: true };
    } catch (error) {
        console.error('Password reset error:', error);
        let message = 'Failed to send reset email. Please try again.';
        if (error.message === 'Firebase SDK not loaded') message = 'Authentication service not available. Please refresh the page.';
        if (error.code === 'auth/user-not-found') message = 'No account found with this email';
        if (error.code === 'auth/invalid-email') message = 'Invalid email address';
        return { success: false, message };
    }
}

function onAuthStateChanged(callback) {
    if (typeof firebase !== 'undefined' && firebase.auth) {
        return firebase.auth().onAuthStateChanged(callback);
    }
    return () => { }; // Return empty unsubscribe function
}

// ========== Export for Global Access ==========
window.auth = {
    // API
    requestOTP,
    verifyOTP,
    checkAuth,
    logout,

    // Firebase Auth
    signIn,
    signUp,
    sendPasswordReset,
    onAuthStateChanged,

    // UI Helpers
    showError,
    setLoading,
    showToast,
    hideToast,

    // Timer
    startResendTimer,
    clearResendTimer,

    // OTP Input
    setupOTPInput,
    getOTPValue,
    clearOTPInput
};