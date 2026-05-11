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

    // 3. Fetch Data
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

    // 4. Render Table
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
                <tr data-id="${item.id}">
                    <td class="text-muted">${date}</td>
                    <td class="font-medium">${escapeHtml(item.fullName || item.userName || 'Anonymous')}</td>
                    <td>${escapeHtml(item.department || 'N/A')}</td>
                    <td><span class="badge ${typeClass}">${typeLabel}</span></td>
                    <td class="font-mono">${item.score || 0}</td>
                    <td class="text-right">
                        <button class="btn--delete" onclick="deleteResponse('${item.id}')" title="Delete Response">
                            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18"></path><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"></path><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"></path><line x1="10" y1="11" x2="10" y2="17"></line><line x1="14" y1="11" x2="14" y2="17"></line></svg>
                        </button>
                    </td>
                </tr>
            `;
        }).join('');
    }

    // 5. Update Stats
    function updateStats(data) {
        totalResponsesEl.textContent = data.length;
        totalVolunteersEl.textContent = data.filter(i => i.type === 'volunteer' || i.volunteer === 'Yes').length;
        totalQuizzesEl.textContent = data.filter(i => i.status === 'submitted' || i.type !== 'volunteer').length;
    }

    // 6. Delete Handler
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

    // 7. Search Logic
    searchInput.addEventListener('input', (e) => {
        const query = e.target.value.toLowerCase();
        const filtered = allResponses.filter(item => {
            const name = (item.fullName || item.userName || '').toLowerCase();
            const dept = (item.department || '').toLowerCase();
            return name.includes(query) || dept.includes(query);
        });
        renderDashboard(filtered);
    });

    // 8. Export CSV
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

    // 9. Logout
    logoutBtn.addEventListener('click', () => {
        localStorage.removeItem('krmu_admin_session');
        window.location.href = 'admin-login.html';
    });

    // Initial load
    fetchAllResponses();
});

// Helpers
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

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
