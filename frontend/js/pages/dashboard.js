const API = window.STUDYMATE_API_BASE || '/api';
let CURRENT_USER = null;   
let STUDENT_ID = null;     
let GROUPS_CACHE = [];

// =============================================
//   IN-DASHBOARD TOAST (replaces browser alert)
// =============================================
function showDashToast(message, type = 'info') {
    // Try global toast first
    if (typeof showToast === 'function') { showToast(message, type); return; }
    const container = document.getElementById('toastContainer');
    if (!container) return;
    const t = document.createElement('div');
    t.className = `toast-msg ${type}`;
    t.innerHTML = `<i class="fa-solid fa-${type === 'error' ? 'circle-exclamation' : type === 'success' ? 'circle-check' : 'info-circle'}"></i><span>${message}</span>`;
    container.appendChild(t);
    setTimeout(() => { t.style.opacity = '0'; setTimeout(() => t.remove(), 300); }, 4000);
}

// =============================================
//   CUSTOM MODAL (replaces browser confirm/prompt)
// =============================================
function showDashModal({ title = '', body = '', inputPlaceholder = null, confirmLabel = 'Confirm', cancelLabel = 'Cancel', onConfirm, type = 'confirm' }) {
    // Remove any existing modal
    const existing = document.getElementById('dashCustomModal');
    if (existing) existing.remove();

    const overlay = document.createElement('div');
    overlay.id = 'dashCustomModal';
    overlay.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.45);z-index:9999;display:flex;align-items:center;justify-content:center;';

    const card = document.createElement('div');
    card.style.cssText = 'background:var(--card);border-radius:10px;padding:28px 30px;max-width:460px;width:90%;box-shadow:0 10px 40px rgba(0,0,0,0.2);position:relative;';

    let inputHtml = '';
    if (inputPlaceholder !== null) {
        inputHtml = `<textarea id="dashModalInput" rows="3" style="width:100%;margin:12px 0 0;padding:9px 12px;border:1px solid var(--line);border-radius:4px;font-size:13px;font-family:var(--font-body);background:var(--input-bg);color:var(--ink);resize:vertical;box-sizing:border-box;" placeholder="${inputPlaceholder}"></textarea>`;
    }

    card.innerHTML = `
        <button onclick="document.getElementById('dashCustomModal').remove()" style="position:absolute;top:12px;right:14px;background:none;border:none;font-size:20px;cursor:pointer;color:var(--ink-soft);">×</button>
        <h3 style="font-size:16px;margin:0 0 8px;color:var(--ink);">${title}</h3>
        <p style="font-size:13px;color:var(--ink-soft);margin:0;line-height:1.5;">${body}</p>
        ${inputHtml}
        <div style="display:flex;justify-content:flex-end;gap:8px;margin-top:18px;">
            <button id="dashModalCancel" class="btn small secondary">${cancelLabel}</button>
            <button id="dashModalConfirm" class="btn small">${confirmLabel}</button>
        </div>
    `;
    overlay.appendChild(card);
    document.body.appendChild(overlay);

    // Close on overlay click
    overlay.addEventListener('click', (e) => { if (e.target === overlay) overlay.remove(); });
    document.getElementById('dashModalCancel').addEventListener('click', () => overlay.remove());
    document.getElementById('dashModalConfirm').addEventListener('click', () => {
        const inputEl = document.getElementById('dashModalInput');
        const value = inputEl ? inputEl.value.trim() : null;
        overlay.remove();
        if (onConfirm) onConfirm(value);
    });

    // Focus input if available
    const inp = document.getElementById('dashModalInput');
    if (inp) setTimeout(() => inp.focus(), 50);
}

window.addEventListener('DOMContentLoaded', async () => {
    try {
        const res = await fetch(API + '/auth/me');
        if (!res.ok) { window.location.href = 'index.html'; return; }
        const json = await res.json();
        if (json.status !== 'success') { window.location.href = 'index.html'; return; }
        
        CURRENT_USER = json.data;
        const displayName = CURRENT_USER.name || CURRENT_USER.email.split('@')[0];
        const userChip = document.getElementById('userChip');
        if (userChip) {
            userChip.innerHTML = `<i class="fa-solid fa-circle-user" style="color:var(--highlight); margin-right:6px;"></i><strong>${escapeHtml(displayName)}</strong> <span style="color:#ef4444; margin-left:8px;"><i class="fa-solid fa-right-from-bracket"></i> Sign out</span>`;
        }

        // Initialize Home panel
        const homeNameEl = document.getElementById('homeUserName');
        if (homeNameEl) homeNameEl.textContent = displayName.split(' ')[0];
        const homeDateEl = document.getElementById('homeDateLabel');
        if (homeDateEl) {
            const now = new Date();
            homeDateEl.textContent = now.toLocaleDateString('en-IN', { weekday:'long', year:'numeric', month:'short', day:'numeric' });
        }

        await loadOrCreateProfile();
        bindTabs();
        bindForms();
        initAcademicModules();
        refreshAll();

        // Load home panel data
        loadDailyChallenge();
        loadHomeConnections();

        // Start notification polling every 5 seconds
        loadNotifications();
        setInterval(loadNotifications, 5000);
    } catch (err) {
        console.error(err);
        window.location.href = 'index.html';
    }
});

function switchMainTab(tabName) {
    const tabBtn = document.querySelector(`.tab[data-tab="${tabName}"]`);
    if (tabBtn) tabBtn.click();
}

async function logout() {
    await fetch(API + '/auth/logout', { method: 'POST' });
    window.location.href = 'index.html';
}

function bindTabs() {
    document.querySelectorAll('.tab').forEach(tab => {
        tab.addEventListener('click', () => {
            document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
            document.querySelectorAll('.panel').forEach(p => p.classList.remove('active'));
            // Activate ALL tabs with same data-tab (sidebar may have duplicates)
            document.querySelectorAll(`.tab[data-tab="${tab.dataset.tab}"]`).forEach(t => t.classList.add('active'));
            const panel = document.getElementById('panel-' + tab.dataset.tab);
            if (panel) panel.classList.add('active');
        });
    });
}

// =============================================
//   APTITUDE DAILY CHALLENGE
// =============================================
const APTITUDE_BANK = [
    { q: "If a train travels 300 km in 5 hours, what is its average speed?", opts: ["50 km/h","60 km/h","70 km/h","80 km/h"], ans: 1 },
    { q: "What is the value of √144 + √81?", opts: ["21","18","25","15"], ans: 0 },
    { q: "A shopkeeper sells an item for ₹540 at a 10% profit. What was the cost price?", opts: ["₹486","₹490","₹500","₹510"], ans: 2 },
    { q: "If 6 workers complete a task in 8 days, how many days will 12 workers take?", opts: ["6 days","4 days","3 days","2 days"], ans: 1 },
    { q: "What comes next in the series: 2, 6, 12, 20, 30, ?", opts: ["40","42","44","46"], ans: 1 },
    { q: "The average of 5 numbers is 48. If one number is 60, the average of the other four is:", opts: ["45","46","47","44"], ans: 0 },
    { q: "A boat covers 20 km in 2 hours upstream. If the stream speed is 3 km/h, what is the boat's speed in still water?", opts: ["13 km/h","10 km/h","7 km/h","17 km/h"], ans: 0 },
    { q: "What is 15% of 840?", opts: ["116","126","136","106"], ans: 1 },
    { q: "In a class of 60 students, 40% are girls. How many boys are there?", opts: ["24","36","40","20"], ans: 1 },
    { q: "If P is 25% more than Q, then Q is what percent less than P?", opts: ["20%","25%","15%","30%"], ans: 0 },
    { q: "Which data structure uses LIFO (Last In, First Out) order?", opts: ["Queue","Linked List","Stack","Tree"], ans: 2 },
    { q: "What is the time complexity of binary search on a sorted array?", opts: ["O(n)","O(log n)","O(n²)","O(1)"], ans: 1 },
    { q: "How many bytes are in 2 kilobytes?", opts: ["1024","2048","4096","512"], ans: 1 },
    { q: "Which of the following is a primary key property?", opts: ["Nullable","Non-unique","Unique and Not Null","Optional"], ans: 2 },
    { q: "What does 'SQL' stand for?", opts: ["Structured Query Language","Sequential Query Logic","Simple Query Language","System Query Language"], ans: 0 },
    { q: "In OSI model, which layer handles data encryption?", opts: ["Transport","Network","Presentation","Session"], ans: 2 },
    { q: "What is the output of: 5 & 3 in binary (bitwise AND)?", opts: ["1","7","2","8"], ans: 0 },
    { q: "Which sorting algorithm has the best average-case time complexity?", opts: ["Bubble Sort","Merge Sort","Selection Sort","Insertion Sort"], ans: 1 },
    { q: "What is the maximum number of nodes at depth d in a binary tree?", opts: ["2d","2^d","d²","d+1"], ans: 1 },
    { q: "Which protocol is used to send email?", opts: ["HTTP","FTP","SMTP","POP3"], ans: 2 },
    { q: "A can complete work in 12 days, B in 18 days. Together they complete it in:", opts: ["7.2 days","8 days","6 days","10 days"], ans: 0 },
    { q: "Find the odd one out: 121, 144, 169, 196, 225, 256, 288", opts: ["225","256","288","196"], ans: 2 },
    { q: "If log₁₀(100) = x, what is x?", opts: ["1","2","10","0.5"], ans: 1 },
    { q: "In how many ways can 4 people be seated in a row?", opts: ["16","24","12","8"], ans: 1 },
    { q: "What is the probability of getting a head when a coin is tossed?", opts: ["1/4","1/3","1/2","1"], ans: 2 },
    { q: "Which of these is NOT a type of join in SQL?", opts: ["INNER JOIN","OUTER JOIN","CROSS JOIN","DEEP JOIN"], ans: 3 },
    { q: "What does RAM stand for?", opts: ["Random Access Memory","Read All Memory","Rapid Access Module","Read And Move"], ans: 0 },
    { q: "Which layer of TCP/IP model corresponds to the OSI Application layer?", opts: ["Internet","Transport","Application","Network Access"], ans: 2 },
    { q: "Find the LCM of 12 and 18.", opts: ["36","24","72","6"], ans: 0 },
    { q: "A pipe fills a tank in 6 hrs, another empties in 12 hrs. Together, when both open, tank fills in:", opts: ["12 hrs","18 hrs","24 hrs","6 hrs"], ans: 0 },
];

let challengeIdx = -1;

function loadDailyChallenge() {
    // Pick a new random question (not the same as previous)
    let newIdx;
    do { newIdx = Math.floor(Math.random() * APTITUDE_BANK.length); } while (newIdx === challengeIdx && APTITUDE_BANK.length > 1);
    challengeIdx = newIdx;
    const q = APTITUDE_BANK[challengeIdx];

    document.getElementById('challengeQuestion').textContent = q.q;
    const resultEl = document.getElementById('challengeResult');
    resultEl.className = 'challenge-result';
    resultEl.textContent = '';
    const nextBtn = document.getElementById('nextChallengeBtn');
    if (nextBtn) nextBtn.style.display = 'none';

    const optsEl = document.getElementById('challengeOptions');
    optsEl.innerHTML = q.opts.map((opt, i) =>
        `<button class="challenge-option" onclick="answerChallenge(this, ${i}, ${q.ans})">${opt}</button>`
    ).join('');
}

function answerChallenge(btn, chosen, correct) {
    // Disable all buttons
    document.querySelectorAll('.challenge-option').forEach(b => b.disabled = true);
    btn.classList.add(chosen === correct ? 'correct' : 'wrong');
    if (chosen !== correct) {
        document.querySelectorAll('.challenge-option')[correct].classList.add('correct');
    }
    const resultEl = document.getElementById('challengeResult');
    resultEl.className = 'challenge-result show ' + (chosen === correct ? 'pass' : 'fail');
    resultEl.textContent = chosen === correct ? '✅ Correct! Great job!' : `❌ Wrong! Correct answer: ${APTITUDE_BANK[challengeIdx].opts[correct]}`;
    const nextBtn = document.getElementById('nextChallengeBtn');
    if (nextBtn) nextBtn.style.display = 'inline-flex';
}

// =============================================
//   HOME CONNECTIONS
// =============================================
async function loadHomeConnections() {
    const grid = document.getElementById('homeConnectionsGrid');
    if (!grid) return;
    try {
        let connections = [];
        if (STUDENT_ID) {
            try {
                const data = await api('/requests/connections/' + STUDENT_ID);
                connections = Array.isArray(data) ? data : [];
            } catch(e) { /* fallback below */ }
        }
        if (connections.length === 0) {
            // Try loading from accepted requests
            try {
                const reqs = await api('/requests');
                connections = (Array.isArray(reqs) ? reqs : []).filter(r => r.status === 'accepted');
            } catch(e) {}
        }
        if (connections.length === 0) {
            grid.innerHTML = `<div class="empty-state" style="grid-column:1/-1;">
                <i class="fa-solid fa-user-group" style="font-size:24px; margin-bottom:8px; display:block; color:var(--pin-teal);"></i>
                No connections yet. <a href="#" onclick="switchMainTab('find'); return false;" style="color:var(--pin-teal);">Find study partners!</a>
            </div>`;
            return;
        }
        grid.innerHTML = connections.map(c => {
            const name = escapeHtml(c.partner_name || c.name || 'Study Partner');
            const dept = escapeHtml(c.department || c.partner_department || '');
            const initials = name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0,2);
            const partnerId = c.partner_profile_id || c.profile_id || c._id || c.id;
            return `<div class="connection-chip" onclick="switchMainTab('find')" title="View ${name}'s profile">
                <div class="connection-avatar">${initials}</div>
                <div class="connection-info">
                    <strong>${name}</strong>
                    <span>${dept || 'StudyMate'}</span>
                </div>
            </div>`;
        }).join('');
    } catch(e) {
        grid.innerHTML = `<div class="empty-state" style="grid-column:1/-1;">Could not load connections.</div>`;
    }
}



async function api(path, options = {}) {
    const res = await fetch(API + path, {
        headers: { 'Content-Type': 'application/json' },
        ...options
    });
    const text = await res.text();
    let json = null;
    try {
        json = JSON.parse(text);
    } catch (e) {
        throw new Error(res.status === 404 ? 'Endpoint not found. Please refresh or verify server routes.' : `Server error (${res.status})`);
    }
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
    if (document.getElementById('p_name')) document.getElementById('p_name').value = data.name || CURRENT_USER?.name || '';
    document.getElementById('p_department').value = data.department || '';
    document.getElementById('p_year').value = data.academic_year || '';
    document.getElementById('p_subjects').value = (data.subjects || []).join(', ');
    document.getElementById('p_time').value = data.available_time || '';
    document.getElementById('p_bio').value = data.bio || '';

    // Active days setup
    const activeDays = data.active_days || ['Mon', 'Wed', 'Fri', 'Sat'];
    document.querySelectorAll('#profileActiveDaysPicker .day-pill').forEach(pill => {
        pill.classList.toggle('selected', activeDays.includes(pill.dataset.day));
    });
    updateActiveDaysSummary();
}

function toggleActiveDay(btn) {
    btn.classList.toggle('selected');
    updateActiveDaysSummary();
}

function updateActiveDaysSummary() {
    const selectedDays = Array.from(document.querySelectorAll('#profileActiveDaysPicker .day-pill.selected')).map(p => p.dataset.day);
    const summaryEl = document.getElementById('profileActiveDaysSummary');
    if (summaryEl) {
        if (selectedDays.length === 0) {
            summaryEl.textContent = 'Flexible study · No fixed schedule';
        } else {
            summaryEl.textContent = `Active ${selectedDays.length} days/week (${selectedDays.join(', ')})`;
        }
    }
}

function bindForms() {
    document.getElementById('profileForm').addEventListener('submit', async e => {
        e.preventDefault();
        const subjects = document.getElementById('p_subjects').value.split(',').map(s => s.trim()).filter(Boolean);
        const studentName = document.getElementById('p_name') ? document.getElementById('p_name').value.trim() : (CURRENT_USER?.name || 'Student');
        const selectedDays = Array.from(document.querySelectorAll('#profileActiveDaysPicker .day-pill.selected')).map(p => p.dataset.day);

        const payload = {
            name: studentName,
            department: document.getElementById('p_department').value,
            year: document.getElementById('p_year').value,
            bio: document.getElementById('p_bio').value,
            available_time: document.getElementById('p_time').value,
            subjects,
            active_days: selectedDays
        };
        try {
            const data = await api('/profile', { method: 'POST', body: JSON.stringify(payload) });
            STUDENT_ID = data.student_id;
            CURRENT_USER.profileId = STUDENT_ID;
            CURRENT_USER.name = studentName;

            const feedback = document.getElementById('profileSaveFeedback');
            if (feedback) {
                feedback.style.display = 'inline-block';
                setTimeout(() => { feedback.style.display = 'none'; }, 3500);
            }
            refreshAll();
        } catch (err) {
            showDashToast('Profile save failed: ' + err.message, 'error');
        }
    });

    document.getElementById('groupForm').addEventListener('submit', async e => {
        e.preventDefault();
        if (!STUDENT_ID) { showDashToast('Save your profile first before creating a group.', 'error'); return; }
        try {
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
            const groupFormBox = document.getElementById('createGroupForm');
            if (groupFormBox) groupFormBox.style.display = 'none';
            showDashToast('Study group created!', 'success');
            loadGroups();
        } catch(err) {
            showDashToast('Could not create group: ' + err.message, 'error');
        }
    });

    document.getElementById('noteForm').addEventListener('submit', async e => {
        e.preventDefault();
        const groupId = document.getElementById('notesGroupSelect').value;
        if (!groupId) { showDashToast('Please select a group first.', 'error'); return; }
        try {
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
            const noteBox = document.getElementById('quickShareNoteBox');
            if (noteBox) noteBox.style.display = 'none';
            showDashToast('Note shared with group!', 'success');
            loadNotes(groupId);
        } catch(err) {
            showDashToast('Could not share note: ' + err.message, 'error');
        }
    });

    document.getElementById('goalForm').addEventListener('submit', async e => {
        e.preventDefault();
        if (!STUDENT_ID) { showDashToast('Save your profile first before adding goals.', 'error'); return; }
        const reminderVal = document.getElementById('goal_reminder') ? document.getElementById('goal_reminder').value : null;
        try {
            await api('/goals', {
                method: 'POST',
                body: JSON.stringify({
                    student_id: STUDENT_ID,
                    goal_text: document.getElementById('goal_text').value,
                    target_date: document.getElementById('goal_date') ? document.getElementById('goal_date').value : null,
                    reminder_datetime: reminderVal || null
                })
            });
            e.target.reset();
            const goalBox = document.getElementById('createGoalFormBox');
            if (goalBox) goalBox.style.display = 'none';
            showDashToast('Goal added!', 'success');
            loadGoals();
        } catch(err) {
            showDashToast('Could not add goal: ' + err.message, 'error');
        }
    });

    document.getElementById('notesGroupSelect').addEventListener('change', e => {
        if (e.target.value) loadNotes(e.target.value);
    });
}

function initAcademicModules() {
    if (window.CatalogueModule) window.CatalogueModule.init();
    if (window.MaterialsModule) window.MaterialsModule.init();
    if (window.UploaderModule) window.UploaderModule.init();
    if (window.QuizzesModule) window.QuizzesModule.init();
    if (window.FlashcardsModule) window.FlashcardsModule.init();
    if (window.ConceptMapsModule) window.ConceptMapsModule.init();
    if (window.CommunityModule) window.CommunityModule.init();
    if (window.ChatModule) window.ChatModule.init();
    initSharedNotesHandlers();
}

function toggleNotifDropdown() {
    const dropdown = document.getElementById('notifDropdown');
    if (!dropdown) return;
    dropdown.style.display = dropdown.style.display === 'none' ? 'block' : 'none';
}

function clearAllNotifs() {
    const list = document.getElementById('notifDropdownList');
    if (list) list.innerHTML = '<div class="notif-item empty">No unread notifications.</div>';
    const badge = document.getElementById('topNotifBadge');
    if (badge) badge.style.display = 'none';
}

async function loadNotifications() {
    try {
        if (!STUDENT_ID) return;
        const reqData = await api('/requests/' + STUDENT_ID);
        const incoming = reqData.incoming || [];
        const pending = incoming.filter(r => r.status === 'pending');
        
        let pendingGoals = [];
        try {
            const goalsData = await api('/goals/' + STUDENT_ID);
            pendingGoals = (goalsData || []).filter(g => !g.is_completed);
        } catch (e) {}

        const badge = document.getElementById('topNotifBadge');
        const list = document.getElementById('notifDropdownList');
        if (!badge || !list) return;

        const totalNotifs = pending.length + (pendingGoals.length > 0 ? 1 : 0);
        if (totalNotifs > 0) {
            badge.textContent = totalNotifs;
            badge.style.display = 'flex';
        } else {
            badge.style.display = 'none';
        }

        let html = '';
        if (pending.length > 0) {
            pending.forEach(p => {
                html += `
                    <div class="notif-item unread" onclick="switchMainTab('requests'); toggleNotifDropdown();">
                        <i class="fa-solid fa-user-plus"></i>
                        <div>
                            <strong>${escapeHtml(p.sender_name || 'Classmate')}</strong> sent you a study partner request.
                            <div style="font-size:11px; color:var(--ink-soft); margin-top:2px;">Click to view and respond</div>
                        </div>
                    </div>
                `;
            });
        }
        if (pendingGoals.length > 0) {
            html += `
                <div class="notif-item" onclick="switchMainTab('goals'); toggleNotifDropdown();">
                    <i class="fa-solid fa-bullseye" style="color:#fbbf24;"></i>
                    <div>
                        You have <strong>${pendingGoals.length} academic goal${pendingGoals.length > 1 ? 's' : ''}</strong> in progress.
                        <div style="font-size:11px; color:var(--ink-soft); margin-top:2px;">Click to review goals</div>
                    </div>
                </div>
            `;
        }
        if (!html) {
            html = '<div class="notif-item empty"><i class="fa-regular fa-bell-slash" style="color:var(--ink-soft); font-size:18px; display:block; margin:0 auto 6px;"></i>All caught up! No new notifications.</div>';
        }
        list.innerHTML = html;
    } catch (e) {
        console.error('loadNotifications error:', e);
    }
}

async function updateStatsOverview() {
    try {
        if (!STUDENT_ID) return;
        try {
            const res = await api('/match/' + STUDENT_ID + '?tab=for_you');
            const count = Array.isArray(res) ? res.length : (res.data ? res.data.length : 0);
            const partnersEl = document.getElementById('statPartnersCount');
            if (partnersEl) partnersEl.textContent = `${count} Available`;
        } catch(e) {}

        try {
            const groups = await api('/groups');
            const groupsEl = document.getElementById('statGroupsCount');
            if (groupsEl) groupsEl.textContent = `${groups.length} Study Pods`;
        } catch(e) {}

        try {
            const goals = await api('/goals/' + STUDENT_ID);
            const goalsEl = document.getElementById('statGoalsCount');
            if (goalsEl) {
                const completed = (goals || []).filter(g => g.is_completed).length;
                goalsEl.textContent = `${completed}/${(goals || []).length} Finished`;
            }
        } catch(e) {}

        const libEl = document.getElementById('statLibraryCount');
        if (libEl) libEl.textContent = 'Vault Active';
    } catch (e) {
        console.error('updateStatsOverview error:', e);
    }
}

function refreshAll() {
    if (window.ChatModule) window.ChatModule.refreshAll();
    loadSharedNotes();
    loadNotifications();
    updateStatsOverview();
    if (!STUDENT_ID) return;
    loadMatches();
    loadRequests();
    loadGroups();
    loadGoals();
}

// Smart Study Partner State
let CURRENT_PARTNER_TAB = 'for_you';
let PARTNER_SEARCH_TIMEOUT = null;
let CACHED_PARTNERS = [];

async function loadMatches() {
    const el = document.getElementById('matchList');
    if (!el) return;

    if (!STUDENT_ID) {
        el.innerHTML = `
            <div class="empty-state" style="grid-column: 1 / -1;">
                <p>Please complete and save your student profile in the <strong>Profile</strong> tab first to receive personalized recommendations.</p>
            </div>
        `;
        return;
    }

    // Render skeleton loading state
    el.innerHTML = `
        <div class="skeleton-card"><div class="skeleton-avatar"></div><div class="skeleton-line" style="width:60%;"></div><div class="skeleton-line" style="width:40%;"></div><div class="skeleton-line" style="width:80%;"></div></div>
        <div class="skeleton-card"><div class="skeleton-avatar"></div><div class="skeleton-line" style="width:55%;"></div><div class="skeleton-line" style="width:35%;"></div><div class="skeleton-line" style="width:75%;"></div></div>
        <div class="skeleton-card"><div class="skeleton-avatar"></div><div class="skeleton-line" style="width:70%;"></div><div class="skeleton-line" style="width:50%;"></div><div class="skeleton-line" style="width:85%;"></div></div>
    `;

    try {
        const searchVal = document.getElementById('partnerSearchInput')?.value.trim() || '';
        const deptVal = document.getElementById('partnerDeptFilter')?.value || '';
        const sortVal = document.getElementById('partnerSortSelect')?.value || 'best_match';

        let query = `?tab=${encodeURIComponent(CURRENT_PARTNER_TAB)}`;
        if (searchVal) query += `&search=${encodeURIComponent(searchVal)}`;
        if (deptVal) query += `&department=${encodeURIComponent(deptVal)}`;
        if (sortVal) query += `&sort=${encodeURIComponent(sortVal)}`;

        const res = await api('/match/' + STUDENT_ID + query);
        const matches = Array.isArray(res) ? res : (res.data || []);
        CACHED_PARTNERS = matches;

        const countEl = document.getElementById('partnerResultCount');
        if (countEl) {
            countEl.textContent = `Showing ${matches.length} recommended student${matches.length === 1 ? '' : 's'}`;
        }

        if (!matches.length) {
            el.innerHTML = `
                <div class="empty-state" style="grid-column: 1 / -1; padding: 40px 20px;">
                    <h3 style="font-size:16px; margin-bottom:6px;">No study partners found yet.</h3>
                    <p style="color:var(--ink-soft); font-size:13px; max-width:440px; margin:0 auto 16px;">
                        Try switching tabs, clearing search filters, or adding more subjects to your profile to expand matching criteria.
                    </p>
                    <button class="btn small" onclick="resetPartnerFilters()">Clear Filters</button>
                </div>
            `;
            return;
        }

        el.innerHTML = matches.map(m => {
            const initials = getInitials(m.name || 'Student');
            const paletteIndex = (m.student_id || 0) % 4;
            const score = m.compatibility_score || m.match_score || 0;
            const isHigh = score >= 60;

            // Connect button state
            let connectButtonHtml = '';
            if (m.connection_status === 'accepted') {
                connectButtonHtml = `<button class="btn small btn-connected" disabled>✓ Connected</button>`;
            } else if (m.connection_status === 'pending_sent') {
                connectButtonHtml = `<button class="btn small btn-pending" disabled>⏳ Request Sent</button>`;
            } else if (m.connection_status === 'pending_received') {
                connectButtonHtml = `<button class="btn small teal" onclick="respondRequest('${m.request_id}', 'accepted')">Respond</button>`;
            } else {
                connectButtonHtml = `<button class="btn small" onclick="sendChatRequest('${m.student_id}')">+ Connect</button>`;
            }

            return `
                <div class="partner-card" id="partner-card-${m.student_id}">
                    <div>
                        <!-- Header with Avatar and Basic Info -->
                        <div class="partner-card-header">
                            <div class="profile-avatar palette-${paletteIndex}" onclick="viewStudentProfile(${m.student_id})" style="cursor:pointer;" title="View Profile">
                                ${escapeHtml(initials)}
                            </div>
                            <div class="partner-info">
                                <h3 class="partner-name" onclick="viewStudentProfile(${m.student_id})" title="${escapeHtml(m.name || 'Student')}">
                                    ${escapeHtml(m.name || 'Student #' + m.student_id)}
                                </h3>
                                <p class="partner-sub">
                                    ${escapeHtml(m.department || 'Student')} ${m.year ? '· ' + escapeHtml(m.year) : ''}
                                </p>
                            </div>
                        </div>

                        <!-- Compatibility Score Pill -->
                        <div class="compatibility-badge ${isHigh ? '' : 'score-mid'}">
                            🎯 ${score}% Compatibility
                        </div>

                        <!-- Recommendation Reason Callout -->
                        <div class="recommendation-callout">
                            <strong>Why Recommended</strong>
                            ${escapeHtml(m.recommendation_reason || 'Shares campus curriculum and subjects with you')}
                        </div>

                        <!-- Availability & Bio Snippet -->
                        <div class="partner-meta-row">
                            <span>🕒 <strong>Study Time:</strong> ${escapeHtml(m.available_time || 'Flexible / On Request')}</span>
                        </div>

                        <!-- Common Subjects Badges -->
                        <div class="shared-subjects-wrap">
                            <span class="sec-label">Subjects</span>
                            <div>
                                ${(m.subjects && m.subjects.length ? m.subjects : ['General Curriculum']).slice(0, 4).map(s => {
                                    const isShared = (m.shared_subjects || []).includes(s);
                                    return `<span class="subject-pill ${isShared ? 'shared' : ''}" title="${isShared ? 'Shared Subject with you' : 'Subject'}">${isShared ? '★ ' : ''}${escapeHtml(s)}</span>`;
                                }).join('')}
                                ${(m.subjects && m.subjects.length > 4) ? `<span class="subject-pill">+${m.subjects.length - 4} more</span>` : ''}
                            </div>
                        </div>
                    </div>

                    <!-- Actions -->
                    <div class="partner-card-actions">
                        <button class="btn small secondary" onclick="viewStudentProfile(${m.student_id})">View Profile</button>
                        ${connectButtonHtml}
                    </div>
                </div>
            `;
        }).join('');
    } catch (err) {
        console.error('loadMatches error:', err);
        el.innerHTML = `
            <div class="empty-state" style="grid-column: 1 / -1;">
                <p style="color:var(--pin-red);">Could not load study partner recommendations.</p>
                <button class="btn small secondary" style="margin-top:10px;" onclick="loadMatches()">Retry</button>
            </div>
        `;
    }
}

function getInitials(name) {
    if (!name) return 'S';
    const parts = name.trim().split(/\s+/);
    if (parts.length === 1) return parts[0].substring(0, 2).toUpperCase();
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

function switchPartnerTab(tabName) {
    CURRENT_PARTNER_TAB = tabName;
    document.querySelectorAll('.discovery-nav-tabs .d-tab').forEach(t => {
        t.classList.toggle('active', t.dataset.tab === tabName);
    });
    loadMatches();
}

function debouncePartnerSearch() {
    clearTimeout(PARTNER_SEARCH_TIMEOUT);
    PARTNER_SEARCH_TIMEOUT = setTimeout(() => {
        loadMatches();
    }, 300);
}

function applyPartnerFilters() {
    loadMatches();
}

function resetPartnerFilters() {
    const s = document.getElementById('partnerSearchInput');
    const d = document.getElementById('partnerDeptFilter');
    const sort = document.getElementById('partnerSortSelect');
    if (s) s.value = '';
    if (d) d.value = '';
    if (sort) sort.value = 'best_match';
    CURRENT_PARTNER_TAB = 'for_you';
    document.querySelectorAll('.discovery-nav-tabs .d-tab').forEach(t => {
        t.classList.toggle('active', t.dataset.tab === 'for_you');
    });
    loadMatches();
}

async function refreshStudyPartners() {
    const btn = document.getElementById('refreshPartnersBtn');
    if (btn) {
        btn.textContent = '⏳ Updating…';
        btn.disabled = true;
    }
    await loadMatches();
    if (btn) {
        btn.textContent = '🔄 Refresh';
        btn.disabled = false;
    }
}

async function viewStudentProfile(studentId) {
    const candidate = CACHED_PARTNERS.find(c => c.student_id === studentId);
    let profileData = candidate;

    if (!profileData) {
        try {
            profileData = await api('/profile/' + studentId);
        } catch (e) {
            alert('Could not open profile: ' + e.message);
            return;
        }
    }

    const modal = document.getElementById('studentProfileModal');
    if (!modal) return;

    document.getElementById('pm_dept').textContent = `// ${profileData.department || 'Department'}`;
    document.getElementById('pm_name').textContent = profileData.name || 'Student #' + studentId;
    document.getElementById('pm_year').textContent = `${profileData.department || ''} · ${profileData.academic_year || profileData.year || ''}`;
    
    // Initials avatar
    const initials = getInitials(profileData.name || 'Student');
    const paletteIndex = (studentId || 0) % 4;
    const avatarEl = document.getElementById('pm_avatar');
    avatarEl.className = `profile-avatar large palette-${paletteIndex}`;
    avatarEl.textContent = initials;

    // Compatibility insight box
    const score = profileData.compatibility_score || profileData.match_score || 0;
    const reason = profileData.recommendation_reason || 'Fellow classmate in the academic study community';
    document.getElementById('pm_compatibility_box').innerHTML = `
        <div style="font-weight:600; color:var(--pin-teal); margin-bottom:4px;">🎯 ${score}% Study Match Score</div>
        <div>${escapeHtml(reason)}</div>
    `;

    // Subjects
    const subjects = profileData.subjects || [];
    document.getElementById('pm_subjects_list').innerHTML = subjects.length
        ? subjects.map(s => {
            const isShared = (profileData.shared_subjects || []).includes(s);
            return `<span class="subject-pill ${isShared ? 'shared' : ''}">${isShared ? '★ ' : ''}${escapeHtml(s)}</span>`;
        }).join('')
        : '<span style="font-size:12px; color:var(--ink-soft);">No subjects listed yet.</span>';

    // Availability & Bio
    document.getElementById('pm_availability').textContent = profileData.available_time || 'Flexible study hours';
    document.getElementById('pm_bio').textContent = profileData.bio || 'This student has not provided a bio description yet.';

    // Connect action inside modal
    const actionContainer = document.getElementById('pm_connect_action');
    if (profileData.connection_status === 'accepted') {
        actionContainer.innerHTML = `<button class="btn btn-connected" disabled>✓ Connected</button>`;
    } else if (profileData.connection_status === 'pending_sent') {
        actionContainer.innerHTML = `<button class="btn btn-pending" disabled>⏳ Request Sent</button>`;
    } else if (profileData.connection_status === 'pending_received') {
        actionContainer.innerHTML = `<button class="btn teal" onclick="respondRequest('${profileData.request_id}', 'accepted'); closeStudentProfileModal();">Respond to Request</button>`;
    } else {
        actionContainer.innerHTML = `<button class="btn" onclick="sendChatRequest('${studentId}'); closeStudentProfileModal();">+ Connect with Student</button>`;
    }

    modal.style.display = 'flex';
}

function closeStudentProfileModal() {
    const modal = document.getElementById('studentProfileModal');
    if (modal) modal.style.display = 'none';
}

async function sendChatRequest(receiverId) {
    showDashModal({
        title: '✉️ Send Study Partner Request',
        body: `Write a brief introduction for your study partner request (optional):`,
        inputPlaceholder: 'Hi! Would you like to study together and prepare for the upcoming exams?',
        confirmLabel: 'Send Request',
        cancelLabel: 'Cancel',
        onConfirm: async (introMessage) => {
            try {
                await api('/chat/requests', {
                    method: 'POST',
                    body: JSON.stringify({
                        receiver_id: receiverId,
                        intro_message: introMessage || undefined
                    })
                });
                showDashToast('Study partner request sent! They will receive an email notification.', 'success');
                loadMatches();
                if (window.ChatModule) window.ChatModule.refreshAll();
            } catch (err) {
                showDashToast('Could not send request: ' + err.message, 'error');
            }
        }
    });
}

async function loadRequests() {
    if (!STUDENT_ID) return;
    const data = await api('/requests/' + STUDENT_ID);
    const incomingPending = (data.incoming || []).filter(r => r.status === 'pending');

    // Prominently address who requested the user in Find Partner page
    const pendingBox = document.getElementById('partnerPendingRequestsBox');
    const pendingList = document.getElementById('partnerPendingRequestsList');
    if (pendingBox && pendingList) {
        if (incomingPending.length > 0) {
            pendingBox.style.display = 'block';
            pendingList.innerHTML = incomingPending.map(r => `
                <div class="pending-req-item">
                    <div>
                        <strong><i class="fa-solid fa-user-graduate" style="color:var(--pin-teal); margin-right:6px;"></i>${escapeHtml(r.sender_name || 'Classmate')}</strong>
                        <p>${r.intro_message ? escapeHtml(r.intro_message) : 'Sent you a study partner connection request to prepare for courses and exams.'}</p>
                    </div>
                    <div style="display:flex; gap:6px;">
                        <button class="btn small teal" onclick="respondRequest('${r.ROWID}', 'accepted')"><i class="fa-solid fa-check"></i> Accept</button>
                        <button class="btn small danger" onclick="respondRequest('${r.ROWID}', 'rejected')"><i class="fa-solid fa-xmark"></i> Decline</button>
                    </div>
                </div>
            `).join('');
        } else {
            pendingBox.style.display = 'none';
        }
    }

    const inEl = document.getElementById('incomingList');
    if (inEl) {
        inEl.innerHTML = data.incoming.length ? data.incoming.map(r => `
            <div class="card" style="margin-bottom:10px;">
                <strong>${escapeHtml(r.sender_name || 'Student')}</strong> <span class="pill ${r.status}">${r.status}</span>
                ${r.status === 'pending' ? `
                    <div style="margin-top:10px; display:flex; gap:6px;">
                        <button class="btn small teal" onclick="respondRequest('${r.ROWID}','accepted')"><i class="fa-solid fa-check"></i> Accept</button>
                        <button class="btn small danger" onclick="respondRequest('${r.ROWID}','rejected')"><i class="fa-solid fa-xmark"></i> Decline</button>
                    </div>` : ''}
            </div>
        `).join('') : '<div class="empty-state">No incoming requests.</div>';
    }

    const outEl = document.getElementById('outgoingList');
    if (outEl) {
        outEl.innerHTML = data.outgoing.length ? data.outgoing.map(r => `
            <div class="card" style="margin-bottom:10px;">
                <strong>${escapeHtml(r.receiver_name || 'Student')}</strong> <span class="pill ${r.status}">${r.status}</span>
            </div>
        `).join('') : '<div class="empty-state">You haven\'t sent any requests.</div>';
    }
}

async function respondRequest(id, status) {
    try {
        await api('/requests/' + id, { method: 'PUT', body: JSON.stringify({ status }) });
        showDashToast(status === 'accepted' ? '✅ Request accepted! You can now chat.' : 'Request declined.', status === 'accepted' ? 'success' : 'info');
        loadRequests();
        loadMatches();
        loadNotifications();
        if (window.ChatModule) window.ChatModule.refreshAll();
    } catch(err) {
        showDashToast('Could not update request: ' + err.message, 'error');
    }
}

function toggleCornerAiDrawer() {
    const modal = document.getElementById('cornerAiModal');
    if (modal) {
        modal.style.display = modal.style.display === 'none' ? 'block' : 'none';
    }
}

async function quickCornerAi(promptText) {
    const input = document.getElementById('cornerAiInput');
    if (input) input.value = promptText;
    await submitCornerAi();
}

async function submitCornerAi(e) {
    if (e) e.preventDefault();
    const input = document.getElementById('cornerAiInput');
    const output = document.getElementById('cornerAiOutput');
    if (!input || !output) return;
    const promptText = input.value.trim();
    if (!promptText) return;

    output.style.display = 'block';
    output.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> Consulting StudyMate AI...`;

    try {
        const res = await api('/chat/ai', {
            method: 'POST',
            body: JSON.stringify({ prompt: promptText, prompt_type: 'study_help' })
        });
        output.innerHTML = `<strong>StudyMate AI:</strong><br>${escapeHtml(res.response || 'Study response ready.')}`;
    } catch (err) {
        output.innerHTML = `<strong>StudyMate AI:</strong><br>For <em>${escapeHtml(promptText)}</em>: Make sure to review core lecture slides, break concepts down into active recall flashcards, and coordinate practice problem sessions with your connected study partners.`;
    }
}

async function loadGroups() {
    try {
        GROUPS_CACHE = await api('/groups');
    } catch(e) {
        GROUPS_CACHE = [];
    }

    const groupListEl = document.getElementById('groupList');
    if (groupListEl) {
        groupListEl.innerHTML = GROUPS_CACHE.length ? GROUPS_CACHE.map(g => {
            const memberCount = g.member_count || (g.members ? g.members.length : 0);
            const maxMembers = g.max_members || 6;
            const isMember = g.is_member;
            const isFull = memberCount >= maxMembers;
            const membersLabel = `${memberCount}/${maxMembers} Members`;

            let actionBtn = '';
            if (isMember) {
                // Find conversation_id for this group via STUDENT_ID and group info
                actionBtn = `
                    <span class="pill" style="background:#eaf3f2; color:var(--pin-teal); font-size:11px;">✅ Joined</span>
                    <button class="btn small teal" onclick="openGroupChat('${g.ROWID}')">
                        <i class="fa-solid fa-comments"></i> Open Group Chat
                    </button>
                `;
            } else if (isFull) {
                actionBtn = `<button class="btn small secondary" disabled title="Group is full">Group Full</button>`;
            } else {
                actionBtn = `<button class="btn small" onclick="joinGroup('${g.ROWID}')">Join Group</button>`;
            }

            const subjectPill = g.subject ? `<span class="subject-pill" style="font-size:11px;">${escapeHtml(g.subject)}</span>` : '';

            return `
                <div class="card" style="display:flex; flex-direction:column; justify-content:space-between; border-left:3px solid ${isMember ? 'var(--pin-teal)' : 'var(--line)'}; gap:10px;">
                    <div>
                        <div style="display:flex; align-items:flex-start; justify-content:space-between; gap:8px; margin-bottom:6px;">
                            <h3 style="font-size:15px; margin:0;">${escapeHtml(g.group_name)}</h3>
                            <span class="pill" style="font-size:10px; white-space:nowrap;">${membersLabel}</span>
                        </div>
                        ${subjectPill}
                        <p style="font-size:13px; color:var(--ink-soft); margin:6px 0 0;">${escapeHtml(g.description || 'Collaborative study pod')}</p>
                    </div>
                    <div style="display:flex; gap:8px; align-items:center; flex-wrap:wrap; padding-top:8px; border-top:1px dashed var(--line);">
                        ${actionBtn}
                    </div>
                </div>
            `;
        }).join('') : '<div class="empty-state"><span style="font-size:28px; display:block; margin-bottom:8px;">📚</span><p>No study groups yet. Create one to get started!</p></div>';
    }

    const notesGroupSelect = document.getElementById('notesGroupSelect');
    if (notesGroupSelect) {
        notesGroupSelect.innerHTML = '<option value="">Select a group</option>' +
            GROUPS_CACHE.map(g => `<option value="${g.ROWID}">${escapeHtml(g.group_name)}</option>`).join('');
    }

    // Populate Right Column Suggestions
    const groupsListEl = document.getElementById('newlyAddedGroupsList');
    if (groupsListEl && GROUPS_CACHE.length) {
        groupsListEl.innerHTML = GROUPS_CACHE.slice(0, 3).map(g => `
            <div class="mini-suggestion-item" onclick="switchMainTab('groups')">
                <div class="item-title"><span>${escapeHtml(g.group_name)}</span> <span class="pill" style="font-size:10px;">${g.member_count || (g.members ? g.members.length : 0)}/${g.max_members || 6}</span></div>
                <div class="item-sub">${escapeHtml(g.description || 'Collaborative study pod')}</div>
            </div>
        `).join('');
    }
}

async function joinGroup(id) {
    try {
        const res = await api('/groups/' + id + '/join', { method: 'POST', body: JSON.stringify({ student_id: STUDENT_ID }) });
        showDashToast('Successfully joined the study group! Opening group chat…', 'success');
        await loadGroups();
        // After joining, open the group chat automatically
        if (res && res.conversation_id) {
            setTimeout(() => openGroupChat(id, res.conversation_id), 600);
        } else {
            openGroupChat(id);
        }
    } catch(err) {
        showDashToast(err.message || 'Could not join group', 'error');
    }
}

async function openGroupChat(groupId, knownConvId) {
    // Switch to Chat Requests panel -> Conversations tab
    switchMainTab('requests');
    if (window.ChatModule) {
        await ChatModule.loadConversations();
        // Find the conversation for this group
        let conv = ChatModule.conversations.find(c => c.type === 'group' && String(c.group_id) === String(groupId));
        if (!conv && knownConvId) {
            conv = ChatModule.conversations.find(c => c.id === knownConvId);
        }
        if (conv) {
            ChatModule.switchSubTab('conversations');
            ChatModule.openConversation(conv.id);
        } else {
            ChatModule.switchSubTab('conversations');
        }
    }
}

function initSharedNotesHandlers() {
    const searchInput = document.getElementById('sharedNotesSearch');
    const domainFilter = document.getElementById('sharedNotesDomainFilter');
    const sortSelect = document.getElementById('sharedNotesSort');

    if (searchInput) searchInput.addEventListener('input', () => loadSharedNotes());
    if (domainFilter) domainFilter.addEventListener('change', () => loadSharedNotes());
    if (sortSelect) sortSelect.addEventListener('change', () => loadSharedNotes());
}

async function loadSharedNotes() {
    const container = document.getElementById('sharedNotesList');
    if (!container) return;

    const search = document.getElementById('sharedNotesSearch')?.value.trim() || '';
    const domain = document.getElementById('sharedNotesDomainFilter')?.value || '';
    const sort = document.getElementById('sharedNotesSort')?.value || 'newest';

    container.innerHTML = '<div class="empty-state">Loading shared notes...</div>';
    try {
        let path = `/notes/shared?sort=${sort}`;
        if (search) path += `&search=${encodeURIComponent(search)}`;
        if (domain) path += `&domain=${encodeURIComponent(domain)}`;

        const notes = await api(path);
        if (!notes.length) {
            container.innerHTML = '<div class="empty-state">No shared notes found for the selected criteria.</div>';
            return;
        }

        container.innerHTML = notes.map(n => `
            <div class="card" style="margin-bottom:12px;">
                <div style="display:flex; justify-content:space-between; align-items:flex-start;">
                    <div>
                        <span class="eyebrow">${escapeHtml(n.domain || 'Academic')} · ${escapeHtml(n.resource_type || 'Note')}</span>
                        <h3 style="font-size:16px; margin:4px 0 6px;">${escapeHtml(n.title)}</h3>
                        <p style="font-size:12px; color:var(--ink-soft); margin-bottom:8px;">
                            ${escapeHtml(n.subject_name || '')} · Shared by <strong>${escapeHtml(n.uploader_name || 'Classmate')}</strong>
                        </p>
                    </div>
                    <span class="pill">${escapeHtml(n.resource_type || 'Note')}</span>
                </div>
                <p style="font-size:13px; color:var(--ink); line-height:1.4; margin-bottom:10px;">
                    ${escapeHtml(n.description || '')}
                </p>
                <div style="display:flex; justify-content:space-between; align-items:center; border-top:1px solid var(--line); padding-top:8px;">
                    <span style="font-size:11px; color:var(--ink-soft);">${new Date(n.created_at).toLocaleDateString()}</span>
                    <div>
                        ${n.file_url ? `<a href="${escapeHtml(n.file_url)}" target="_blank" class="btn small secondary">Open Link ↗</a>` : ''}
                        ${n.file_path ? `<a href="/api/notes/download/${n.id}" class="btn small teal" target="_blank" download>Download File</a>` : ''}
                    </div>
                </div>
            </div>
        `).join('');

        // Populate Right Column Suggestions
        const notesListEl = document.getElementById('newlyAddedNotesList');
        if (notesListEl && notes.length) {
            notesListEl.innerHTML = notes.slice(0, 3).map(n => `
                <div class="mini-suggestion-item" onclick="switchMainTab('notes')">
                    <div class="item-title"><span>${escapeHtml(n.title)}</span> <span class="pill" style="font-size:10px;">${escapeHtml(n.resource_type || 'Note')}</span></div>
                    <div class="item-sub">${escapeHtml(n.subject || n.domain || 'Coursework')} · ${escapeHtml(n.uploader_name || 'Classmate')}</div>
                </div>
            `).join('');
        }
    } catch (err) {
        container.innerHTML = '<div class="empty-state">Failed to load shared notes.</div>';
    }
}

async function loadNotes(groupId) {
    const notes = await api('/notes/' + groupId);
    const container = document.getElementById('noteList');
    if (!container) return;
    container.innerHTML = notes.length ? notes.map(n => `
        <div class="card" style="margin-bottom:10px;">
            <strong>${escapeHtml(n.title)}</strong>
            <p style="font-size:12px;">shared by Student #${escapeHtml(n.uploader_name || '...')}</p>
            ${n.file_url ? `<a href="${escapeHtml(n.file_url)}" target="_blank" class="pill">Open</a>` : ''}
        </div>
    `).join('') : '<div class="empty-state">No group notes here yet.</div>';
}

async function loadGoals() {
    // API now returns { data: goals, streak: {...} }
    const res = await fetch(API + '/goals/' + STUDENT_ID, { headers: { 'Content-Type': 'application/json' } });
    const json = await res.json();
    const goals = Array.isArray(json.data) ? json.data : (Array.isArray(json) ? json : []);
    const streak = json.streak || { current: 0, longest: 0, lastCompletedDate: null };

    const container = document.getElementById('goalList');
    const alertBox = document.getElementById('goalReminderAlert');
    if (!container) return;

    // --- Streak Banner ---
    let streakBanner = document.getElementById('goalStreakBanner');
    if (!streakBanner) {
        streakBanner = document.createElement('div');
        streakBanner.id = 'goalStreakBanner';
        container.parentNode.insertBefore(streakBanner, container);
    }
    if (streak.current > 0) {
        streakBanner.innerHTML = `
            <div style="display:flex; align-items:center; gap:14px; background:linear-gradient(135deg,#ff6b35 0%,#f7c948 100%); border-radius:10px; padding:14px 20px; margin-bottom:16px; color:#fff; box-shadow:0 4px 14px rgba(255,107,53,0.3);">
                <div style="font-size:36px;">🔥</div>
                <div>
                    <div style="font-size:18px; font-weight:700;">Day ${streak.current} Streak!</div>
                    <div style="font-size:12px; opacity:0.9;">Keep it up! Complete a goal today to extend your streak. Longest: ${streak.longest} days</div>
                </div>
            </div>
        `;
    } else {
        streakBanner.innerHTML = `
            <div style="display:flex; align-items:center; gap:12px; background:var(--card); border:1px dashed var(--line); border-radius:8px; padding:12px 16px; margin-bottom:14px; color:var(--ink-soft); font-size:13px;">
                <span style="font-size:22px;">🎯</span>
                <span>Complete a daily goal to start your streak! Longest streak: <strong>${streak.longest || 0} days</strong></span>
            </div>
        `;
    }

    // Check for any due reminders
    const dueReminders = goals.filter(g => !g.is_completed && g.is_reminder_due);
    if (dueReminders.length && alertBox) {
        alertBox.style.display = 'block';
        alertBox.innerHTML = `🔔 <strong>Study Goal Reminder:</strong> You have ${dueReminders.length} target goal(s) reaching reminder time: <em>${escapeHtml(dueReminders.map(g => g.goal_text).join(', '))}</em>`;
    } else if (alertBox) {
        alertBox.style.display = 'none';
    }

    container.innerHTML = goals.length ? goals.map(g => `
        <div class="card" style="margin-bottom:10px; display:flex; justify-content:space-between; align-items:center; border-left:4px solid ${g.is_completed ? '#28a745' : g.is_overdue ? '#dc3545' : g.is_reminder_due ? '#ffc107' : '#0366d6'};">
            <div>
                <div style="display:flex; align-items:center; gap:8px;">
                    <strong style="${g.is_completed ? 'text-decoration:line-through; color:var(--ink-soft);' : ''}">${escapeHtml(g.goal_text)}</strong>
                    ${g.is_completed ? '<span class="pill accepted">✓ Done</span>' : ''}
                    ${!g.is_completed && g.is_overdue ? '<span class="pill" style="background:#fde8e8; color:#c53030;">⚠️ Overdue</span>' : ''}
                    ${!g.is_completed && g.is_reminder_due ? '<span class="pill" style="background:#fff3cd; color:#856404;">🔔 Reminder Due</span>' : ''}
                </div>
                <p style="font-size:12px; color:var(--ink-soft); margin-top:4px;">
                    ${g.target_date ? 'Target: ' + g.target_date : ''}
                    ${g.reminder_datetime ? ' · Reminder: ' + new Date(g.reminder_datetime).toLocaleString() : ''}
                </p>
            </div>
            <div style="display:flex; gap:6px;">
                <button class="btn small ${g.is_completed ? 'secondary' : 'teal'}" onclick="toggleGoal('${g.ROWID}', ${!g.is_completed})">
                    ${g.is_completed ? '↩ Undo' : '✓ Mark Done'}
                </button>
                <button class="btn small danger" onclick="deleteGoal('${g.ROWID}')">×</button>
            </div>
        </div>
    `).join('') : '<div class="empty-state">No goals set yet. Add daily focus goals from the <strong>Daily Goals</strong> section in the left panel!</div>';
}

async function toggleGoal(id, complete) {
    try {
        await api('/goals/' + id, { method: 'PUT', body: JSON.stringify({ is_completed: complete }) });
        if (complete) showDashToast('Goal completed! 🔥 Keep your streak going!', 'success');
        loadGoals();
    } catch(err) {
        showDashToast('Could not update goal: ' + err.message, 'error');
    }
}

async function deleteGoal(id) {
    showDashModal({
        title: 'Delete Goal',
        body: 'Are you sure you want to delete this study goal? This cannot be undone.',
        confirmLabel: 'Yes, Delete',
        cancelLabel: 'Cancel',
        onConfirm: async () => {
            try {
                await api('/goals/' + id, { method: 'DELETE' });
                showDashToast('Goal deleted.', 'info');
                loadGoals();
            } catch(err) {
                showDashToast('Could not delete goal: ' + err.message, 'error');
            }
        }
    });
}

async function submitNewCourse(event) {
    if (event) event.preventDefault();
    const nameEl = document.getElementById('cc_name');
    const codeEl = document.getElementById('cc_code');
    const domainEl = document.getElementById('cc_domain');
    const semEl = document.getElementById('cc_semester');
    const descEl = document.getElementById('cc_desc');

    const course_name = nameEl ? nameEl.value.trim() : '';
    const course_code = codeEl ? codeEl.value.trim() : '';
    if (!course_name || !course_code) {
        showDashToast('Please provide course name and course code', 'error');
        return;
    }

    try {
        await api('/catalogue/courses', {
            method: 'POST',
            body: JSON.stringify({
                course_name,
                course_code,
                domain: domainEl ? domainEl.value : 'Computer Science and Engineering',
                semester: semEl ? Number(semEl.value) : 1,
                description: descEl ? descEl.value : ''
            })
        });
        showDashToast('Course added to catalogue!', 'success');
        if (nameEl) nameEl.value = '';
        if (codeEl) codeEl.value = '';
        if (descEl) descEl.value = '';
        const formBox = document.getElementById('createCourseFormBox');
        if (formBox) formBox.style.display = 'none';
        if (window.CatalogueModule && window.CatalogueModule.loadCourses) {
            window.CatalogueModule.loadCourses();
        }
    } catch(e) {
        showDashToast('Could not save course: ' + e.message, 'error');
    }
}

window.openNewPartnerRequestModal = async function() {
    try {
        let students = [];
        try {
            students = await api('/students') || [];
        } catch(e) {
            students = [];
        }
        const currentStudentId = STUDENT_ID || (CURRENT_USER?.profileId);
        const candidates = students.filter(s => Number(s.id) !== Number(currentStudentId) && Number(s.user_id) !== Number(CURRENT_USER?.id));

        if (candidates.length === 0) {
            showDashModal({
                title: '✉️ Send Study Partner Request',
                body: '<p style="margin:0 0 10px;">No other student profiles are currently registered.</p><p style="color:var(--ink-soft); font-size:12px;">As new students sign up on StudyMate, they will appear here so you can connect with them!</p>',
                cancelLabel: 'Close'
            });
            return;
        }

        let selectHtml = `<div style="margin-bottom:14px;"><label style="display:block; font-size:12px; font-weight:600; margin-bottom:4px;">Select Classmate / Partner:</label><select id="dashPartnerSelectModal" style="width:100%; padding:9px 12px; border:1px solid var(--line); border-radius:4px; background:var(--input-bg); color:var(--ink);">`;
        candidates.forEach(c => {
            selectHtml += `<option value="${c.id}">${escapeHtml(c.name || 'Classmate')} (${escapeHtml(c.department || 'General')} · ${escapeHtml(c.academic_year || '')})</option>`;
        });
        selectHtml += `</select></div><label style="display:block; font-size:12px; font-weight:600; margin-bottom:4px;">Introduction Message:</label>`;

        showDashModal({
            title: '✉️ Send Study Partner Request',
            body: selectHtml,
            inputPlaceholder: 'Hi! Would you like to study together and prepare for the upcoming exams?',
            confirmLabel: 'Send Request',
            cancelLabel: 'Cancel',
            onConfirm: async (introMessage) => {
                const selectEl = document.getElementById('dashPartnerSelectModal');
                const receiverId = selectEl ? selectEl.value : null;
                if (!receiverId) return;
                try {
                    await api('/chat/requests', {
                        method: 'POST',
                        body: JSON.stringify({
                            receiver_id: receiverId,
                            intro_message: introMessage || undefined
                        })
                    });
                    showDashToast('Study partner request sent! They will receive an email notification.', 'success');
                    loadMatches();
                    if (window.ChatModule) {
                        window.ChatModule.refreshAll();
                        window.ChatModule.switchSubTab('outgoing');
                    }
                } catch (err) {
                    showDashToast('Could not send request: ' + err.message, 'error');
                }
            }
        });
    } catch(err) {
        showDashToast('Error opening partner request dialog: ' + err.message, 'error');
    }
};

function escapeHtml(str) {
    return String(str).replace(/[&<>"']/g, s => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[s]));
}

// =============================================
//   NOTIFICATION BELL FUNCTIONS
// =============================================
function toggleNotifDropdown() {
    const dropdown = document.getElementById('notifDropdown');
    if (!dropdown) return;
    const isVisible = dropdown.style.display === 'block';
    dropdown.style.display = isVisible ? 'none' : 'block';
    if (!isVisible) loadNotifications();
    // Close on click outside
    if (!isVisible) {
        setTimeout(() => {
            document.addEventListener('click', function closeNotif(e) {
                if (!dropdown.contains(e.target) && !document.getElementById('notifBellBtn')?.contains(e.target)) {
                    dropdown.style.display = 'none';
                    document.removeEventListener('click', closeNotif);
                }
            });
        }, 0);
    }
}

function clearAllNotifs() {
    const listEl = document.getElementById('notifDropdownList');
    if (listEl) listEl.innerHTML = '<div class="notif-item empty">No notifications</div>';
    const badge = document.getElementById('topNotifBadge');
    if (badge) badge.style.display = 'none';
}

async function loadNotifications() {
    try {
        const requests = await api('/chat/requests/incoming');
        const pending = (requests || []).filter(r => r.status === 'pending');

        const badge = document.getElementById('topNotifBadge');
        if (badge) {
            if (pending.length > 0) {
                badge.textContent = pending.length;
                badge.style.display = 'inline-block';
            } else {
                badge.style.display = 'none';
            }
        }

        const listEl = document.getElementById('notifDropdownList');
        if (!listEl) return;

        if (pending.length === 0) {
            listEl.innerHTML = '<div class="notif-item empty">No pending notifications</div>';
            return;
        }

        listEl.innerHTML = pending.map(r => `
            <div class="notif-item" onclick="switchMainTab('requests'); if(window.ChatModule) ChatModule.switchSubTab('incoming'); toggleNotifDropdown();" style="cursor:pointer;">
                <div style="display:flex; align-items:center; gap:10px;">
                    <div class="profile-avatar palette-${r.sender_id % 6}" style="width:34px; height:34px; font-size:13px; flex-shrink:0;">
                        ${(r.sender_name || 'S').charAt(0).toUpperCase()}
                    </div>
                    <div style="flex:1; min-width:0;">
                        <div style="font-size:13px; font-weight:600; color:var(--ink);">${escapeHtml(r.sender_name || 'A classmate')}</div>
                        <div style="font-size:11px; color:var(--ink-soft); margin-top:1px;">sent a study partner request</div>
                        <div style="font-size:10px; color:var(--pin-teal); margin-top:2px;">${escapeHtml(r.department || '')} ${r.department && r.academic_year ? '·' : ''} ${escapeHtml(r.academic_year || '')}</div>
                    </div>
                    <span style="width:8px; height:8px; background:var(--pin-teal); border-radius:50%; flex-shrink:0;"></span>
                </div>
            </div>
        `).join('');
    } catch(e) {
        // silent fail
    }
}

