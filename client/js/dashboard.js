/* ============================================
   KRMU ECHOSENSE - Dashboard Logic
   Fetch user data & stats
   ============================================ */

import { showToast, escapeHtml } from './ui.js';
window.showToast = showToast; // Expose for HTML inline onclick

// DOM Elements
const elements = {
    userName: document.getElementById('userName'),
    totalImpact: document.getElementById('totalImpact'),
    volunteerCount: document.getElementById('volunteerCount'),
    myScore: document.getElementById('myScore'),
    deptLeaderboard: document.getElementById('deptLeaderboard'),
    pledgeList: document.getElementById('pledgeList'),
    logoutBtn: document.getElementById('logoutBtn')
};

// Expose Volunteer Handler
window.handleVolunteer = async function () {
    const btn = document.getElementById('volunteerBtn');
    if (btn && btn.disabled) return;

    const user = firebase.auth().currentUser;
    if (!user) {
        showToast('Please log in first', 'error');
        return;
    }

    try {
        const volunteerData = {
            userId: user.uid,
            fullName: user.displayName || user.email.split('@')[0],
            department: 'Volunteer',
            score: 0,
            volunteer: 'Yes',
            type: 'volunteer',
            status: 'volunteered',
            timestamp: firebase.firestore.FieldValue.serverTimestamp()
        };
        await window.db.collection('pledges').add(volunteerData);
        showToast('Thanks for volunteering!', 'success');

        // Disable button immediately with timestamp
        if (btn) {
            btn.disabled = true;
            btn.innerHTML = `<span class="text-xl">✅</span><span class="text-sm font-medium">Volunteered</span><span class="text-xs text-muted">Just now</span>`;
            btn.classList.add('opacity-50', 'cursor-not-allowed');
        }
    } catch (error) {
        console.error('Volunteer error:', error);
        showToast('Error saving: ' + error.message, 'error');
    }
};

/**
 * Initialize Dashboard
 */
async function initDashboard() {
    try {
        // 1. Fetch User Data (Auth Check)
        const user = await fetchUser();
        if (!user) {
            // Clear stale session flag to prevent redirect loop
            try { localStorage.removeItem('krmu_session'); } catch (e) { }
            window.location.replace('index.html');
            return;
        }

        // Auth success: Show content
        document.body.classList.remove('auth-loading');

        const isAdmin = localStorage.getItem('krmu_admin_session') === 'true';

        if (isAdmin) {
            document.getElementById('studentPanel').style.display = 'none';
            document.getElementById('adminPanel').style.display = 'block';
            initAdminDashboard();
        } else {
            const studentPanel = document.getElementById('studentPanel');
            if (studentPanel) studentPanel.style.display = 'block';
            const adminPanel = document.getElementById('adminPanel');
            if (adminPanel) adminPanel.style.display = 'none';

            elements.userName.textContent = user.displayName || user.email.split('@')[0] || 'Student';

            // 2. Check Volunteer Status
            checkVolunteerStatus(user.uid);

            // 3. Check Quiz Status
            checkQuizStatus(user.uid);

            // 4. Fetch Dashboard Stats
            await fetchStats();
        }

    } catch (error) {
        console.error('Dashboard init failed:', error);
        showToast('Error', 'Failed to load dashboard data', 'error');
    }
}

/**
 * Fetch Current User (Firebase Client-Side)
 */
function fetchUser() {
    return new Promise((resolve) => {
        let resolved = false;
        let listenerAttached = false;
        let sdkWaitTimer = null;
        let authTimeout = null;

        function done(user) {
            if (resolved) return;
            resolved = true;
            if (sdkWaitTimer) clearInterval(sdkWaitTimer);
            if (authTimeout) clearTimeout(authTimeout);
            resolve(user);
        }

        function attachListener(authInstance) {
            if (listenerAttached) return;
            listenerAttached = true;
            if (sdkWaitTimer) clearInterval(sdkWaitTimer);

            let nullGraceTimer = null;

            const unsubscribe = authInstance.onAuthStateChanged(user => {
                if (user) {
                    if (nullGraceTimer) clearTimeout(nullGraceTimer);
                    unsubscribe();
                    done(user);
                    return;
                }

                if (nullGraceTimer) return;

                nullGraceTimer = setTimeout(() => {
                    unsubscribe();
                    // Re-check currentUser after grace period.
                    // New accounts may briefly emit null before resolving;
                    // 4s gives Firebase enough time to confirm the new session.
                    const stableUser = authInstance.currentUser || null;
                    done(stableUser);
                }, 4000);
            });
        }

        // Wait for firebase SDK to load if needed
        sdkWaitTimer = setInterval(() => {
            if (resolved) return;

            if (window.authDB) { // window.authDB set in firebase-init.js
                attachListener(window.authDB);
            } else if (window.firebase && window.firebase.auth) {
                attachListener(firebase.auth());
            }
        }, 100);

        // Timeout fallback — 15s for slow iOS Safari (ITP throttles IndexedDB)
        authTimeout = setTimeout(() => {
            done(null);
        }, 15000);
    });
}

/**
 * Check if user already volunteered
 */
async function checkVolunteerStatus(userId) {
    if (!window.db) return;
    const btn = document.getElementById('volunteerBtn');
    if (!btn) return;

    try {
        const snap = await window.db.collection('pledges')
            .where('userId', '==', userId)
            .where('volunteer', '==', 'Yes')
            .get();

        if (!snap.empty) {
            const volunteerDoc = snap.docs[0].data();
            let timeAgoText = '';

            if (volunteerDoc.timestamp) {
                try {
                    const date = volunteerDoc.timestamp.toDate();
                    const diff = Date.now() - date.getTime();
                    const mins = Math.floor(diff / 60000);
                    const hours = Math.floor(mins / 60);
                    const days = Math.floor(hours / 24);

                    if (days > 0) timeAgoText = `${days}d ago`;
                    else if (hours > 0) timeAgoText = `${hours}h ago`;
                    else if (mins > 0) timeAgoText = `${mins}m ago`;
                    else timeAgoText = 'Just now';
                } catch (e) {
                    timeAgoText = '';
                }
            }

            btn.disabled = true;
            btn.innerHTML = `<span class="text-xl">✅</span><span class="text-sm font-medium">Volunteered</span>${timeAgoText ? `<span class="text-xs text-muted">${timeAgoText}</span>` : ''}`;
            btn.classList.add('opacity-50', 'cursor-not-allowed');
        }
    } catch (e) {
        console.error("Error checking volunteer status", e);
    }
}

/**
 * Check if user already submitted quiz
 */
async function checkQuizStatus(userId) {
    if (!window.db) return;
    const btn = document.getElementById('takeQuizBtn');
    if (!btn) return;

    try {
        const snap = await window.db.collection('pledges')
            .where('userId', '==', userId)
            .where('status', '==', 'submitted')
            .orderBy('timestamp', 'desc')
            .limit(1)
            .get();

        if (!snap.empty) {
            const quizDoc = snap.docs[0].data();
            const score = quizDoc.score ?? 0;
            let timeAgoText = '';

            if (quizDoc.timestamp) {
                try {
                    const date = quizDoc.timestamp.toDate();
                    const diff = Date.now() - date.getTime();
                    const mins = Math.floor(diff / 60000);
                    const hours = Math.floor(mins / 60);
                    const days = Math.floor(hours / 24);

                    if (days > 0) timeAgoText = `${days}d ago`;
                    else if (hours > 0) timeAgoText = `${hours}h ago`;
                    else if (mins > 0) timeAgoText = `${mins}m ago`;
                    else timeAgoText = 'Just now';
                } catch (e) {
                    timeAgoText = '';
                }
            }

            // Handle both button and anchor elements
            if (btn.tagName === 'A') {
                btn.removeAttribute('href');
                btn.style.pointerEvents = 'none';
            } else {
                btn.disabled = true;
            }
            btn.innerHTML = `<span class="text-xl">✅</span><span class="text-sm font-medium">Quiz Done • ${score} pts</span>${timeAgoText ? `<span class="text-xs text-muted">${timeAgoText}</span>` : ''}`;
            btn.classList.add('opacity-50', 'cursor-not-allowed');
        }
    } catch (e) {
        console.error("Error checking quiz status", e);
    }
}

const DEPARTMENTS = [
    'Computer Science', 'Law', 'Management', 'Engineering', 'Medical',
    'Fashion', 'Journalism', 'Basic Sciences', 'Architecture', 'Education', 'Other'
];

/**
 * Fetch Stats (Real-time Firestore)
 */
async function fetchStats() {
    // 1. Listen to Pledges Collection
    // Note: For large scale, we would use distributed counters. 
    // For this scale (< few thousand), client-side counting is acceptable.

    if (window.db) {
        // PLEDGES LISTENER - OPTIMIZED WITH LIMIT
        window.db.collection('pledges').orderBy('timestamp', 'desc').limit(100).onSnapshot(snap => {
            const pledges = [];
            snap.forEach(doc => pledges.push({ id: doc.id, ...doc.data() }));

            // Update Metrics
            updateMetrics(pledges);

            // Update Leaderboard
            updateLeaderboard(pledges);

            // Update Feed
            updateFeed(pledges.slice(0, 5)); // Recent 5

        }, err => console.error('Stats listener failed:', err));

    } else {
        console.error('Firestore not initialized');
    }
}

/**
 * Calculate & Update Top Cards
 */
function updateMetrics(pledges) {
    // Total Impact (Approximate if limited)
    // For real total with limit, use a separate counter document in production.
    elements.totalImpact.textContent = (pledges.length >= 100 ? "100+" : pledges.length).toLocaleString();

    // Volunteers (Count where volunteer == "Yes")
    const volCount = pledges.filter(p => p.volunteer === 'Yes').length;
    elements.volunteerCount.textContent = volCount.toLocaleString();

    // My Score
    const currentUser = firebase.auth().currentUser;
    if (currentUser) {
        const myPledges = pledges.filter(p => p.userId === currentUser.uid);
        const myTotal = myPledges.reduce((sum, p) => sum + (parseInt(p.score) || 0), 0);
        elements.myScore.textContent = myTotal;
    }
}

/**
 * Update Leaderboard (Group by Dept)
 */
function updateLeaderboard(pledges) {
    const deptScores = {};

    // Initialize
    DEPARTMENTS.forEach(d => deptScores[d] = 0);

    // Sum scores
    pledges.forEach(p => {
        const dept = p.department || 'Other';
        const score = parseInt(p.score) || 0;
        if (deptScores[dept] !== undefined) {
            deptScores[dept] += score;
        } else {
            deptScores['Other'] += score;
        }
    });

    // Sort & Rank
    const sortedDepts = Object.entries(deptScores)
        .map(([name, score]) => ({ name, score }))
        .sort((a, b) => b.score - a.score)
        .slice(0, 5); // Top 5

    // Render
    if (sortedDepts.length > 0) {
        elements.deptLeaderboard.innerHTML = sortedDepts.map((dept, index) => `
            <tr>
                <td class="font-medium text-muted">#${index + 1}</td>
                <td>${escapeHtml(dept.name)}</td>
                <td class="text-right font-mono">${dept.score.toLocaleString()}</td>
            </tr>
        `).join('');
    } else {
        elements.deptLeaderboard.innerHTML = '<tr><td colspan="3" class="text-center text-muted">No data available</td></tr>';
    }
}

/**
 * Update Recent Activity Feed
 */
function updateFeed(recentPledges) {
    if (recentPledges.length > 0) {
        elements.pledgeList.innerHTML = recentPledges.map(p => {
            // Calculate time ago using ui.js utility or fallback
            let timeAgoText = 'Just now';
            if (p.timestamp || p.createdAt) {
                const ts = p.createdAt || p.timestamp;
                try {
                    const date = ts.toDate();
                    const diff = Date.now() - date.getTime();
                    const mins = Math.floor(diff / 60000);
                    const hours = Math.floor(mins / 60);
                    const days = Math.floor(hours / 24);

                    if (days > 0) timeAgoText = `${days} day${days > 1 ? 's' : ''} ago`;
                    else if (hours > 0) timeAgoText = `${hours} hr${hours > 1 ? 's' : ''} ago`;
                    else if (mins > 0) timeAgoText = `${mins} min${mins > 1 ? 's' : ''} ago`;
                } catch (e) {
                    console.warn('Error parsing timestamp:', e);
                }
            }

            // Get name with fallback
            const name = p.userName || p.fullName || 'Anonymous';
            const initials = name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase();
            const dept = p.department || 'General';
            const score = p.score ?? 0;

            // Determine entry type and styling
            const isVolunteer = p.volunteer === 'Yes' || p.type === 'volunteer';
            const avatarBgClass = isVolunteer ? 'bg-volunteer-10' : 'bg-primary-10';
            const avatarIcon = isVolunteer ? '🤝' : initials;
            const avatarTextClass = isVolunteer ? '' : 'text-primary font-bold text-sm';
            const statusText = isVolunteer
                ? 'Volunteered'
                : `${escapeHtml(dept)} • Score: ${score}`;

            return `
            <div class="flex items-center gap-3 p-2 hover-bg-muted rounded-md transition-colors animate-slideUp">
                <div class="flex items-center justify-center w-10 h-10 rounded-full ${avatarBgClass} ${avatarTextClass}">
                    ${avatarIcon}
                </div>
                <div class="flex-1">
                    <div class="text-sm font-medium">${escapeHtml(name)}</div>
                    <div class="text-xs text-muted">${statusText}</div>
                </div>
                <div class="text-xs text-muted">${timeAgoText}</div>
            </div>
            `;
        }).join('');
    } else {
        elements.pledgeList.innerHTML = '<div class="text-center text-muted py-4">No recent activity</div>';
    }
}


function updateUI(stats) {
    // Deprecated - functions split above
}

/**
 * Logout handler
 */
if (elements.logoutBtn) {
    elements.logoutBtn.addEventListener('click', async () => {
        try {
            // Immediate optimistic cleanup
            localStorage.removeItem('krmu_session');
            localStorage.removeItem('krmu_admin_session');

            if (window.authDB) {
                await window.authDB.signOut();
            } else if (window.firebase && window.firebase.auth) {
                await firebase.auth().signOut();
            }
            window.location.replace('index.html');
        } catch (error) {
            console.error('Logout failed', error);
        }
    });
}

// ============================================
// ADMIN DASHBOARD LOGIC
// ============================================
let allResponses = [];

async function initAdminDashboard() {
    const responsesTable = document.getElementById('adminResponsesTable');
    const totalResponsesEl = document.getElementById('statTotalResponses');
    const totalVolunteersEl = document.getElementById('statTotalVolunteers');
    const totalQuizzesEl = document.getElementById('statTotalQuizzes');
    const exportBtn = document.getElementById('exportBtn');
    const searchInput = document.getElementById('searchInput');

    async function fetchAllResponses() {
        if (!window.db) {
            console.error("Firestore not initialized");
            return;
        }

        try {
            const snapshot = await window.db.collection('pledges').orderBy('timestamp', 'desc').get();
            allResponses = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            }));

            renderDashboard(allResponses);
            updateStats(allResponses);
        } catch (error) {
            console.error("Error fetching responses:", error);
            showToast('Error', 'Failed to load data', 'error');
        }
    }

    function renderDashboard(data) {
        if (data.length === 0) {
            responsesTable.innerHTML = '<tr><td colspan="6" class="text-center py-8 text-muted">No responses found</td></tr>';
            return;
        }

        responsesTable.innerHTML = data.map(item => {
            const date = item.timestamp ? item.timestamp.toDate().toLocaleDateString() : 'N/A';
            const typeClass = item.type === 'volunteer' ? 'badge--volunteer' : 'badge--quiz';
            const typeLabel = item.type === 'volunteer' ? 'Volunteer' : 'Quiz Submission';
            
            return `
                <tr data-id="${item.id}" style="border-bottom: 1px solid rgba(var(--border-rgb), 0.1);">
                    <td class="p-4 text-muted">${date}</td>
                    <td class="p-4 font-medium">${escapeHtml(item.fullName || item.userName || 'Anonymous')}</td>
                    <td class="p-4">${escapeHtml(item.department || 'N/A')}</td>
                    <td class="p-4"><span class="px-2 py-1 rounded-full text-xs font-medium ${typeClass}">${typeLabel}</span></td>
                    <td class="p-4 font-mono text-primary">${item.score || 0}</td>
                    <td class="p-4 text-right">
                        <button style="color: #ef4444;" onclick="deleteResponse('${item.id}')" title="Delete Response">
                            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18"></path><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"></path><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"></path><line x1="10" y1="11" x2="10" y2="17"></line><line x1="14" y1="11" x2="14" y2="17"></line></svg>
                        </button>
                    </td>
                </tr>
            `;
        }).join('');
    }

    function updateStats(data) {
        totalResponsesEl.textContent = data.length;
        totalVolunteersEl.textContent = data.filter(i => i.type === 'volunteer' || i.volunteer === 'Yes').length;
        totalQuizzesEl.textContent = data.filter(i => i.status === 'submitted' || i.type !== 'volunteer').length;
    }

    window.deleteResponse = async (id) => {
        if (!confirm('Are you sure you want to delete this response?')) return;

        try {
            await window.db.collection('pledges').doc(id).delete();
            showToast('Deleted', 'Response has been removed', 'success');
            // Optimistic UI update
            allResponses = allResponses.filter(r => r.id !== id);
            renderDashboard(allResponses);
            updateStats(allResponses);
        } catch (error) {
            console.error("Error deleting document:", error);
            showToast('Error', 'Failed to delete response', 'error');
        }
    };

    if (searchInput) {
        searchInput.addEventListener('input', (e) => {
            const query = e.target.value.toLowerCase();
            const filtered = allResponses.filter(item => {
                const name = (item.fullName || item.userName || '').toLowerCase();
                const dept = (item.department || '').toLowerCase();
                return name.includes(query) || dept.includes(query);
            });
            renderDashboard(filtered);
        });
    }

    if (exportBtn) {
        exportBtn.addEventListener('click', () => {
            if (allResponses.length === 0) return;

            const headers = ['Date', 'Name', 'Department', 'Type', 'Score', 'User ID'];
            const csvRows = [
                headers.join(','),
                ...allResponses.map(item => {
                    const date = item.timestamp ? item.timestamp.toDate().toISOString() : '';
                    return [
                        `"${date}"`,
                        `"${item.fullName || item.userName || ''}"`,
                        `"${item.department || ''}"`,
                        `"${item.type || ''}"`,
                        item.score || 0,
                        `"${item.userId || ''}"`
                    ].join(',');
                })
            ];

            const csvString = csvRows.join('\n');
            const blob = new Blob([csvString], { type: 'text/csv' });
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.setAttribute('href', url);
            a.setAttribute('download', `echosense_responses_${new Date().toISOString().split('T')[0]}.csv`);
            a.click();
        });
    }

    fetchAllResponses();
}

// Auto-run
initDashboard();
