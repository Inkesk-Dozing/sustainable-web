/* ============================================
   KRMU ECHOSENSE - Admin Dashboard Logic
   ============================================ */

document.addEventListener('DOMContentLoaded', async () => {
    // 1. Session Guard
    if (localStorage.getItem('krmu_admin_session') !== 'true') {
        window.location.href = 'admin-login.html';
        return;
    }

    // 2. DOM Elements
    const responsesTable = document.getElementById('adminResponsesTable');
    const totalResponsesEl = document.getElementById('statTotalResponses');
    const totalVolunteersEl = document.getElementById('statTotalVolunteers');
    const totalQuizzesEl = document.getElementById('statTotalQuizzes');
    const logoutBtn = document.getElementById('adminLogoutBtn');
    const exportBtn = document.getElementById('exportBtn');
    const searchInput = document.getElementById('searchInput');

    let allResponses = [];

    // ---------- Helpers ----------
    function waitForFirebase(timeout = 8000) {
        return new Promise((resolve, reject) => {
            if (window.db && window.authDB) { resolve(); return; }
            const start = Date.now();
            const t = setInterval(() => {
                if (window.db && window.authDB) { clearInterval(t); resolve(); }
                else if (Date.now() - start > timeout) { clearInterval(t); reject(new Error('Firebase not ready')); }
            }, 100);
        });
    }

    function waitForAuth(timeout = 10000) {
        return new Promise((resolve, reject) => {
            const t = setTimeout(() => reject(new Error('Auth timeout')), timeout);
            window.authDB.onAuthStateChanged(user => {
                clearTimeout(t);
                resolve(user);
            });
        });
    }

    // ---------- Init ----------
    async function init() {
        try {
            showTableStatus('Connecting to Firebase...');
            await waitForFirebase();

            showTableStatus('Checking authentication...');

            // Attempt to sign in with the stored admin credentials
            // If already signed in, onAuthStateChanged resolves immediately
            let user = await waitForAuth(5000);

            if (!user) {
                // Not signed in — try auto sign-in with admin email using a known password attempt
                showTableStatus('Re-authenticating admin...');
                // We can't silently re-auth without a password here.
                // Fall through to fetch anyway — Firestore rules might allow public read,
                // or the user is still in a valid local session.
            }

            showTableStatus('Fetching all responses...');
            await fetchAllResponses();
        } catch (err) {
            console.error('Init error:', err);
            showTableStatus(`Error: ${err.message}. Retrying with open rules...`);
            // Last-ditch attempt: fetch without waiting for auth
            await fetchAllResponsesFallback();
        }
    }

    // ---------- Primary fetch (auth-aware) ----------
    async function fetchAllResponses() {
        try {
            // Try multiple collection names to cover all stored data
            const collections = ['pledges', 'responses', 'submissions', 'users'];
            let combined = [];

            for (const col of collections) {
                try {
                    let query = window.db.collection(col);
                    // Try with ordering, fall back to unordered
                    let snapshot;
                    try {
                        snapshot = await query.orderBy('timestamp', 'desc').get();
                    } catch {
                        snapshot = await query.get();
                    }
                    if (!snapshot.empty) {
                        const docs = snapshot.docs.map(doc => ({ id: doc.id, _collection: col, ...doc.data() }));
                        combined = combined.concat(docs);
                        console.log(`✅ Found ${docs.length} docs in '${col}'`);
                    }
                } catch (colErr) {
                    console.warn(`Collection '${col}' skipped:`, colErr.code || colErr.message);
                }
            }

            // Sort combined results by timestamp descending
            combined.sort((a, b) => {
                const tA = a.timestamp ? (a.timestamp.toDate ? a.timestamp.toDate().getTime() : new Date(a.timestamp).getTime()) : 0;
                const tB = b.timestamp ? (b.timestamp.toDate ? b.timestamp.toDate().getTime() : new Date(b.timestamp).getTime()) : 0;
                return tB - tA;
            });

            allResponses = combined;
            renderDashboard(allResponses);
            updateStats(allResponses);

            if (allResponses.length === 0) {
                showTableStatus('No responses found in database. The collections may be empty.');
            }
        } catch (error) {
            console.error('Fetch error:', error);
            showTableStatus(`Failed to fetch: ${error.code || error.message}`);
        }
    }

    // Fallback: try fetching pledges without auth (in case rules are open)
    async function fetchAllResponsesFallback() {
        try {
            const snapshot = await window.db.collection('pledges').get();
            allResponses = snapshot.docs.map(doc => ({ id: doc.id, _collection: 'pledges', ...doc.data() }));
            renderDashboard(allResponses);
            updateStats(allResponses);
        } catch (err) {
            showTableStatus('Permission denied. Please log out and log in again to refresh your session.');
        }
    }

    function showTableStatus(msg) {
        if (responsesTable) {
            responsesTable.innerHTML = `<tr><td colspan="6" class="text-center py-8 text-muted" style="padding: 2rem;">${msg}</td></tr>`;
        }
    }

    // ---------- Render Table ----------
    function renderDashboard(data) {
        if (data.length === 0) {
            showTableStatus('No responses found.');
            return;
        }

        responsesTable.innerHTML = data.map(item => {
            let dateStr = 'N/A';
            if (item.timestamp) {
                try {
                    const d = item.timestamp.toDate ? item.timestamp.toDate() : new Date(item.timestamp);
                    dateStr = d.toLocaleDateString() + ' ' + d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                } catch {}
            } else if (item.createdAt) {
                try {
                    const d = item.createdAt.toDate ? item.createdAt.toDate() : new Date(item.createdAt);
                    dateStr = d.toLocaleDateString();
                } catch {}
            }

            const isVolunteer = item.volunteer === 'Yes' || item.type === 'volunteer';
            const typeClass = isVolunteer ? 'badge--volunteer' : 'badge--quiz';
            const typeLabel = isVolunteer ? 'Volunteer' : 'Quiz Submission';

            const name = escapeHtml(item.fullName || item.name || item.userName || item.displayName || 'Anonymous');
            const dept = escapeHtml(item.department || item.dept || 'N/A');
            const score = item.score !== undefined ? item.score : (item.totalScore || '—');
            const collection = item._collection || 'pledges';

            return `
                <tr data-id="${item.id}">
                    <td class="text-muted" style="font-size: 0.8rem;">${dateStr}</td>
                    <td style="font-weight: 500;">${name}</td>
                    <td>${dept}</td>
                    <td><span class="badge ${typeClass}">${typeLabel}</span></td>
                    <td style="font-family: monospace;">${score}</td>
                    <td style="text-align: right;">
                        <button class="btn--delete" onclick="deleteResponse('${item.id}', '${collection}')" title="Delete Response">
                            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18"></path><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"></path><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"></path></svg>
                        </button>
                    </td>
                </tr>
            `;
        }).join('');
    }

    // ---------- Stats ----------
    function updateStats(data) {
        totalResponsesEl.textContent = data.length;
        totalVolunteersEl.textContent = data.filter(i => i.volunteer === 'Yes' || i.type === 'volunteer').length;
        totalQuizzesEl.textContent = data.filter(i => i.volunteer !== 'Yes' && i.type !== 'volunteer').length;
    }

    // ---------- Delete ----------
    window.deleteResponse = async (id, collection = 'pledges') => {
        if (!confirm('Are you sure you want to delete this response?')) return;
        try {
            await window.db.collection(collection).doc(id).delete();
            showToast('Deleted', 'Response removed', 'success');
            allResponses = allResponses.filter(r => r.id !== id);
            renderDashboard(allResponses);
            updateStats(allResponses);
        } catch (err) {
            console.error('Delete error:', err);
            showToast('Error', 'Failed to delete: ' + err.message, 'error');
        }
    };

    // ---------- Search ----------
    searchInput.addEventListener('input', (e) => {
        const q = e.target.value.toLowerCase();
        const filtered = allResponses.filter(item => {
            const n = (item.fullName || item.name || item.userName || '').toLowerCase();
            const d = (item.department || item.dept || '').toLowerCase();
            return n.includes(q) || d.includes(q);
        });
        renderDashboard(filtered);
    });

    // ---------- Export CSV ----------
    exportBtn.addEventListener('click', () => {
        if (allResponses.length === 0) { showToast('No data', 'Nothing to export', 'error'); return; }

        const headers = ['Date', 'Name', 'Department', 'Type', 'Score', 'Collection'];
        const rows = allResponses.map(item => {
            let dateStr = '';
            if (item.timestamp) {
                try {
                    const d = item.timestamp.toDate ? item.timestamp.toDate() : new Date(item.timestamp);
                    dateStr = d.toISOString();
                } catch {}
            }
            return [
                `"${dateStr}"`,
                `"${item.fullName || item.name || item.userName || ''}"`,
                `"${item.department || item.dept || ''}"`,
                `"${item.type || (item.volunteer === 'Yes' ? 'volunteer' : 'quiz')}"`,
                item.score !== undefined ? item.score : '',
                `"${item._collection || ''}"`
            ].join(',');
        });

        const csv = [headers.join(','), ...rows].join('\n');
        const blob = new Blob([csv], { type: 'text/csv' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `echosense_responses_${new Date().toISOString().split('T')[0]}.csv`;
        a.click();
        URL.revokeObjectURL(url);
    });

    // ---------- Logout ----------
    logoutBtn.addEventListener('click', async () => {
        localStorage.removeItem('krmu_admin_session');
        if (window.authDB) {
            try { await window.authDB.signOut(); } catch {}
        }
        window.location.href = 'admin-login.html';
    });

    // ---------- Run ----------
    init();
});

// ---------- Escape HTML ----------
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text || '';
    return div.innerHTML;
}

// ---------- Toast ----------
function showToast(title, message, type = 'success') {
    const toast = document.getElementById('toast');
    if (!toast) return;
    toast.innerHTML = `<div class="toast__body"><div class="toast__title">${title}</div><div class="toast__message">${message}</div></div>`;
    toast.className = `toast toast--visible toast--${type}`;
    setTimeout(() => toast.classList.remove('toast--visible'), 4000);
}
