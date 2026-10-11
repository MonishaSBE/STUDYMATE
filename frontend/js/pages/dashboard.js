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
        initAcademicModules();
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
        const reminderVal = document.getElementById('goal_reminder') ? document.getElementById('goal_reminder').value : null;
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
        loadGoals();
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

function refreshAll() {
    if (window.ChatModule) window.ChatModule.refreshAll();
    loadSharedNotes();
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
    try {
        const introMessage = prompt(
            "Write a brief introduction for your study partner request (optional):", 
            "Hi! Would you like to study together and prepare for the upcoming exams?"
        );
        if (introMessage === null) return; // User cancelled

        await api('/chat/requests', { 
            method: 'POST', 
            body: JSON.stringify({ 
                receiver_id: receiverId,
                intro_message: introMessage.trim() || undefined
            }) 
        });
        alert('Study partner request sent successfully!');
        loadMatches();
        if (window.ChatModule) window.ChatModule.refreshAll();
    } catch (err) {
        alert('Could not send request: ' + err.message);
    }
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
    const goals = await api('/goals/' + STUDENT_ID);
    const container = document.getElementById('goalList');
    const alertBox = document.getElementById('goalReminderAlert');
    if (!container) return;

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
                    ${g.is_completed ? 'Undo' : 'Mark done'}
                </button>
                <button class="btn small danger" onclick="deleteGoal('${g.ROWID}')">×</button>
            </div>
        </div>
    `).join('') : '<div class="empty-state">No goals set yet. Set daily focus goals with reminders above!</div>';
}

async function toggleGoal(id, complete) {
    await api('/goals/' + id, { method: 'PUT', body: JSON.stringify({ is_completed: complete }) });
    loadGoals();
}

async function deleteGoal(id) {
    if (!confirm('Delete this study goal?')) return;
    await api('/goals/' + id, { method: 'DELETE' });
    loadGoals();
}

function escapeHtml(str) {
    return String(str).replace(/[&<>"']/g, s => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[s]));
}

