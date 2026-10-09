const API = window.STUDYMATE_API_BASE || '/api';
let CURRENT_USER = null;   
let STUDENT_ID = null;     
let GROUPS_CACHE = [];

window.addEventListener('DOMContentLoaded', async () => {
    try {
        const res = await fetch(API + '/auth/me');
        if (!res.ok) {
            window.location.href = 'index.html';
            return;
        }
        const json = await res.json();
        if (json.status !== 'success') {
            window.location.href = 'index.html';
            return;
        }
        
        CURRENT_USER = json.data;
        document.getElementById('userChip').textContent = CURRENT_USER.email + ' · sign out';

        await loadOrCreateProfile();
        bindTabs();
        bindForms();
        refreshAll();
    } catch (err) {
        console.error(err);
        window.location.href = 'index.html';
    }
});

async function logout() {
    await fetch(API + '/auth/logout', { method: 'POST' });
    window.location.href = 'index.html';
}

function bindTabs() {
    document.querySelectorAll('.tab').forEach(tab => {
        tab.addEventListener('click', () => {
            document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
            document.querySelectorAll('.panel').forEach(p => p.classList.remove('active'));
            tab.classList.add('active');
            document.getElementById('panel-' + tab.dataset.tab).classList.add('active');
        });
    });
}

async function api(path, options = {}) {
    const res = await fetch(API + path, {
        headers: { 'Content-Type': 'application/json' },
        ...options
    });
    const json = await res.json();
    if (!res.ok || json.status !== 'success') throw new Error(json.message || 'Request failed');
    return json.data;
}

async function loadOrCreateProfile() {
    if (CURRENT_USER.profileId) {
        try {
            const data = await api('/profile/' + CURRENT_USER.profileId);
            STUDENT_ID = CURRENT_USER.profileId;
            fillProfileForm(data);
        } catch (e) { }
    }
}

function fillProfileForm(data) {
    document.getElementById('p_department').value = data.department || '';
    document.getElementById('p_year').value = data.academic_year || '';
    document.getElementById('p_subjects').value = (data.subjects || []).join(', ');
    document.getElementById('p_time').value = data.available_time || '';
    document.getElementById('p_bio').value = data.bio || '';
}

function bindForms() {
    document.getElementById('profileForm').addEventListener('submit', async e => {
        e.preventDefault();
        const subjects = document.getElementById('p_subjects').value.split(',').map(s => s.trim()).filter(Boolean);
        
        const payload = {
            name: document.getElementById('p_department').value + ' Student', // Simple mock if name not in form
            department: document.getElementById('p_department').value,
            year: document.getElementById('p_year').value,
            bio: document.getElementById('p_bio').value,
            available_time: document.getElementById('p_time').value,
            subjects
        };
        try {
            const data = await api('/profile', { method: 'POST', body: JSON.stringify(payload) });
            STUDENT_ID = data.student_id;
            CURRENT_USER.profileId = STUDENT_ID;
            alert('Profile saved.');
            refreshAll();
        } catch (err) {
            alert('Profile save failed: ' + err.message);
        }
    });

    document.getElementById('groupForm').addEventListener('submit', async e => {
        e.preventDefault();
        if (!STUDENT_ID) return alert('Save your profile first.');
        await api('/groups', {
            method: 'POST',
            body: JSON.stringify({
                group_name: document.getElementById('g_name').value,
                description: document.getElementById('g_desc').value,
                max_members: Number(document.getElementById('g_max').value) || 6,
                created_by: STUDENT_ID
            })
        });
        e.target.reset();
        loadGroups();
    });

    document.getElementById('noteForm').addEventListener('submit', async e => {
        e.preventDefault();
        const groupId = document.getElementById('notesGroupSelect').value;
        if (!groupId) return alert('Pick a group first.');
        await api('/notes', {
            method: 'POST',
            body: JSON.stringify({
                group_id: groupId,
                uploaded_by: STUDENT_ID,
                title: document.getElementById('n_title').value,
                file_url: document.getElementById('n_url').value
            })
        });
        e.target.reset();
        loadNotes(groupId);
    });

    document.getElementById('goalForm').addEventListener('submit', async e => {
        e.preventDefault();
        if (!STUDENT_ID) return alert('Save your profile first.');
        await api('/goals', {
            method: 'POST',
            body: JSON.stringify({
                student_id: STUDENT_ID,
                goal_text: document.getElementById('goal_text').value,
                target_date: document.getElementById('goal_date').value
            })
        });
        e.target.reset();
        loadGoals();
    });

    document.getElementById('notesGroupSelect').addEventListener('change', e => {
        if (e.target.value) loadNotes(e.target.value);
    });
}

function refreshAll() {
    if (!STUDENT_ID) return;
    loadMatches();
    loadRequests();
    loadGroups();
    loadGoals();
}

async function loadMatches() {
    const el = document.getElementById('matchList');
    el.innerHTML = '<div class="empty-state">Finding matches…</div>';
    try {
        const matches = await api('/match/' + STUDENT_ID);
        if (!matches.length) {
            el.innerHTML = '<div class="empty-state">No matches yet — try adding more subjects to your profile.</div>';
            return;
        }
        el.innerHTML = matches.map(m => `
            <div class="card">
                <h3 style="font-size:16px;">Student #${m.student_id}</h3>
                <div class="match-score">match score: ${m.match_score}</div>
                <p style="font-size:13px; color:var(--ink-soft);">${escapeHtml(m.department)} · ${escapeHtml(m.year || '')}</p>
                ${m.shared_subjects.map(s => `<span class="pill">${escapeHtml(s)}</span>`).join('')}
                <button class="btn small teal" style="margin-top:10px;" onclick="sendChatRequest('${m.student_id}')">Send request</button>
            </div>
        `).join('');
    } catch (err) {
        el.innerHTML = '<div class="empty-state">Could not load matches.</div>';
    }
}

async function sendChatRequest(receiverId) {
    await api('/requests', { method: 'POST', body: JSON.stringify({ sender_id: STUDENT_ID, receiver_id: receiverId }) });
    alert('Request sent.');
    loadRequests();
}

async function loadRequests() {
    const data = await api('/requests/' + STUDENT_ID);
    document.getElementById('incomingList').innerHTML = data.incoming.length ? data.incoming.map(r => `
        <div class="card" style="margin-bottom:10px;">
            <strong>Student #${r.sender_name || '...'}</strong> <span class="pill ${r.status}">${r.status}</span>
            ${r.status === 'pending' ? `
                <div style="margin-top:10px;">
                    <button class="btn small teal" onclick="respondRequest('${r.ROWID}','accepted')">Accept</button>
                    <button class="btn small danger" onclick="respondRequest('${r.ROWID}','rejected')">Decline</button>
                </div>` : ''}
        </div>
    `).join('') : '<div class="empty-state">No incoming requests.</div>';

    document.getElementById('outgoingList').innerHTML = data.outgoing.length ? data.outgoing.map(r => `
        <div class="card" style="margin-bottom:10px;">
            <strong>Student #${r.receiver_name || '...'}</strong> <span class="pill ${r.status}">${r.status}</span>
        </div>
    `).join('') : '<div class="empty-state">You haven\'t sent any requests.</div>';
}

async function respondRequest(id, status) {
    await api('/requests/' + id, { method: 'PUT', body: JSON.stringify({ status }) });
    loadRequests();
}

async function loadGroups() {
    GROUPS_CACHE = await api('/groups');
    document.getElementById('groupList').innerHTML = GROUPS_CACHE.length ? GROUPS_CACHE.map(g => `
        <div class="card">
            <h3 style="font-size:16px;">${escapeHtml(g.group_name)}</h3>
            <p style="font-size:13px;">${escapeHtml(g.description || '')}</p>
            <button class="btn small teal" onclick="joinGroup('${g.ROWID}')">Join group</button>
        </div>
    `).join('') : '<div class="empty-state">No groups yet.</div>';

    document.getElementById('notesGroupSelect').innerHTML = '<option value="">Select a group</option>' + 
        GROUPS_CACHE.map(g => `<option value="${g.ROWID}">${escapeHtml(g.group_name)}</option>`).join('');
}

async function joinGroup(id) {
    try {
        await api('/groups/' + id + '/join', { method: 'POST', body: JSON.stringify({ student_id: STUDENT_ID }) });
        alert('Joined group.');
    } catch(err) {
        alert(err.message);
    }
}

async function loadNotes(groupId) {
    const notes = await api('/notes/' + groupId);
    document.getElementById('noteList').innerHTML = notes.length ? notes.map(n => `
        <div class="card" style="margin-bottom:10px;">
            <strong>${escapeHtml(n.title)}</strong>
            <p style="font-size:12px;">shared by Student #${escapeHtml(n.uploader_name || '...')}</p>
            ${n.file_url ? `<a href="${escapeHtml(n.file_url)}" target="_blank" class="pill">Open</a>` : ''}
        </div>
    `).join('') : '<div class="empty-state">No notes here.</div>';
}

async function loadGoals() {
    const goals = await api('/goals/' + STUDENT_ID);
    document.getElementById('goalList').innerHTML = goals.length ? goals.map(g => `
        <div class="card" style="margin-bottom:10px; display:flex; justify-content:space-between;">
            <div>
                <strong style="${g.is_completed ? 'text-decoration:line-through;' : ''}">${escapeHtml(g.goal_text)}</strong>
                <p style="font-size:12px;">${g.target_date ? 'due ' + g.target_date : ''}</p>
            </div>
            <button class="btn small ${g.is_completed ? 'secondary' : 'teal'}" onclick="toggleGoal('${g.ROWID}', ${!g.is_completed})">
                ${g.is_completed ? 'Undo' : 'Mark done'}
            </button>
        </div>
    `).join('') : '<div class="empty-state">No goals yet.</div>';
}

async function toggleGoal(id, complete) {
    await api('/goals/' + id, { method: 'PUT', body: JSON.stringify({ is_completed: complete }) });
    loadGoals();
}

function escapeHtml(str) {
    return String(str).replace(/[&<>"']/g, s => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[s]));
}
