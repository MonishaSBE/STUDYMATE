/**
 * Feature Module 8: Community Academic Help & Private Query Management
 * Strict privacy enforcement: Students only view their own queries and admin responses.
 * Administrators view all student queries, update statuses, respond, and save confidential internal notes.
 */

window.CommunityModule = {
    currentStatusFilter: '',
    currentCategoryFilter: '',
    adminSearch: '',
    activeQueryId: null,

    async init() {
        const askForm = document.getElementById('communityAskForm');
        const adminSection = document.getElementById('adminSupportSection');
        const adminStatusFilter = document.getElementById('adminStatusFilter');
        const adminCategoryFilter = document.getElementById('adminCategoryFilter');
        const adminSearch = document.getElementById('adminQuerySearch');

        if (askForm) {
            askForm.addEventListener('submit', (e) => {
                e.preventDefault();
                this.handleAskQuestion(askForm);
            });
        }

        // Check if current user is an admin
        if (window.CURRENT_USER && window.CURRENT_USER.role === 'admin') {
            if (adminSection) adminSection.style.display = 'block';

            if (adminStatusFilter) {
                adminStatusFilter.addEventListener('change', (e) => {
                    this.currentStatusFilter = e.target.value;
                    this.loadAdminQueries();
                });
            }

            if (adminCategoryFilter) {
                adminCategoryFilter.addEventListener('change', (e) => {
                    this.currentCategoryFilter = e.target.value;
                    this.loadAdminQueries();
                });
            }

            if (adminSearch) {
                adminSearch.addEventListener('input', (e) => {
                    this.adminSearch = e.target.value.trim();
                    this.loadAdminQueries();
                });
            }

            await this.loadAdminQueries();
        }

        await this.loadStudentQueries();
    },

    async loadStudentQueries() {
        const container = document.getElementById('communityQuestionsList');
        if (!container) return;

        container.innerHTML = '<div class="empty-state">Loading your support queries...</div>';
        try {
            const queries = await api('/community/queries');

            if (!queries.length) {
                container.innerHTML = '<div class="empty-state">You have not submitted any queries yet. Use the form above to ask for academic or technical help.</div>';
                return;
            }

            container.innerHTML = queries.map(q => `
                <div class="card community-question-card" style="margin-bottom:14px; border-left:4px solid ${this.getStatusColor(q.status)};">
                    <div style="display:flex; justify-content:space-between; align-items:flex-start;">
                        <div>
                            <span class="eyebrow">${escapeHtml(q.category)} · Ref #${q.id}</span>
                            <h3 style="font-size:16px; margin:4px 0 6px;" class="clickable-title" onclick="CommunityModule.openQueryThread(${q.id})">
                                ${escapeHtml(q.title)}
                            </h3>
                        </div>
                        <span class="pill ${q.status === 'Resolved' || q.status === 'Answered' ? 'accepted' : ''}">
                            ${escapeHtml(q.status)}
                        </span>
                    </div>

                    <p style="font-size:13px; color:var(--ink-soft); line-height:1.4; margin-bottom:10px;">
                        ${escapeHtml(q.description.substring(0, 160))}${q.description.length > 160 ? '...' : ''}
                    </p>

                    <div style="display:flex; justify-content:space-between; align-items:center; font-size:12px; color:var(--ink-soft);">
                        <span>Submitted on ${new Date(q.created_at).toLocaleDateString()}</span>
                        <button class="btn small teal" onclick="CommunityModule.openQueryThread(${q.id})">View Conversation & Responses →</button>
                    </div>
                </div>
            `).join('');
        } catch (err) {
            container.innerHTML = '<div class="empty-state">Failed to load support queries.</div>';
        }
    },

    async loadAdminQueries() {
        const container = document.getElementById('adminQueriesList');
        if (!container) return;

        container.innerHTML = '<div class="empty-state">Loading all student queries...</div>';
        try {
            let path = '/community/admin/queries?';
            if (this.currentStatusFilter) path += `&status=${encodeURIComponent(this.currentStatusFilter)}`;
            if (this.currentCategoryFilter) path += `&category=${encodeURIComponent(this.currentCategoryFilter)}`;
            if (this.adminSearch) path += `&search=${encodeURIComponent(this.adminSearch)}`;

            const queries = await api(path);

            if (!queries.length) {
                container.innerHTML = '<div class="empty-state">No queries found matching the selected filters.</div>';
                return;
            }

            container.innerHTML = queries.map(q => `
                <div class="card" style="margin-bottom:12px; border-left:4px solid ${this.getStatusColor(q.status)};">
                    <div style="display:flex; justify-content:space-between; align-items:flex-start;">
                        <div>
                            <span class="eyebrow">${escapeHtml(q.category)} · From: <strong>${escapeHtml(q.student_name || 'Student')}</strong> (${escapeHtml(q.student_email || '')})</span>
                            <h3 style="font-size:16px; margin:4px 0 6px;" class="clickable-title" onclick="CommunityModule.openQueryThread(${q.id})">
                                ${escapeHtml(q.title)}
                            </h3>
                        </div>
                        <span class="pill ${q.status === 'Resolved' ? 'accepted' : ''}">${escapeHtml(q.status)}</span>
                    </div>
                    <p style="font-size:13px; color:var(--ink-soft); line-height:1.4; margin-bottom:10px;">
                        ${escapeHtml(q.description.substring(0, 150))}${q.description.length > 150 ? '...' : ''}
                    </p>
                    <div style="display:flex; justify-content:space-between; align-items:center;">
                        <span style="font-size:12px; color:var(--ink-soft);">${new Date(q.created_at).toLocaleString()}</span>
                        <button class="btn small teal" onclick="CommunityModule.openQueryThread(${q.id})">Manage & Respond →</button>
                    </div>
                </div>
            `).join('');
        } catch (err) {
            container.innerHTML = '<div class="empty-state">Failed to load admin query console.</div>';
        }
    },

    async handleAskQuestion(form) {
        const title = document.getElementById('comm_title').value.trim();
        const category = document.getElementById('comm_category').value;
        const description = document.getElementById('comm_content').value.trim();

        if (!title || !description) return alert('Please enter both title and description.');

        try {
            await api('/community/queries', {
                method: 'POST',
                body: JSON.stringify({ title, category, description })
            });

            form.reset();
            alert('Your private query has been submitted! Administrators will review and respond.');
            await this.loadStudentQueries();
            if (window.CURRENT_USER && window.CURRENT_USER.role === 'admin') {
                await this.loadAdminQueries();
            }
        } catch (err) {
            alert('Failed to submit query: ' + err.message);
        }
    },

    async openQueryThread(queryId) {
        const threadContainer = document.getElementById('community_thread_container');
        if (!threadContainer) return;
        this.activeQueryId = queryId;

        try {
            const data = await api(`/community/queries/${queryId}`);
            const { query, messages, internal_notes } = data;
            const isAdmin = window.CURRENT_USER && window.CURRENT_USER.role === 'admin';

            threadContainer.style.display = 'block';
            threadContainer.scrollIntoView({ behavior: 'smooth' });

            threadContainer.innerHTML = `
                <div class="card" style="border: 2px solid var(--cork); margin-bottom:20px;">
                    <div style="display:flex; justify-content:space-between; align-items:flex-start;">
                        <div>
                            <span class="eyebrow">${escapeHtml(query.category)} · Status: <strong>${escapeHtml(query.status)}</strong></span>
                            <h2 style="font-size:20px; margin:4px 0 10px;">${escapeHtml(query.title)}</h2>
                            <p style="font-size:12px; color:var(--ink-soft);">
                                Submitted by ${escapeHtml(query.student_name || 'Student')} on ${new Date(query.created_at).toLocaleString()}
                            </p>
                        </div>
                        <button class="btn small secondary" onclick="CommunityModule.closeThread()">Close Thread View</button>
                    </div>

                    <div style="background:#fafbf9; padding:12px 16px; border-radius:6px; font-size:14px; line-height:1.6; margin:14px 0; white-space:pre-wrap;">
                        ${escapeHtml(query.description)}
                    </div>

                    ${isAdmin ? `
                        <div style="background:#f0f4f8; border:1px solid #c8d7e6; border-radius:6px; padding:12px; margin-bottom:16px;">
                            <span class="eyebrow" style="color:#0969da;">// Admin Status Controls</span>
                            <div style="display:flex; gap:10px; align-items:center; margin-top:8px; flex-wrap:wrap;">
                                <label style="margin:0; font-size:13px;">Change Status:</label>
                                <select id="threadStatusSelect" style="max-width:200px; padding:4px 8px;">
                                    <option value="Open" ${query.status === 'Open' ? 'selected' : ''}>Open</option>
                                    <option value="In Progress" ${query.status === 'In Progress' ? 'selected' : ''}>In Progress</option>
                                    <option value="Waiting for Student" ${query.status === 'Waiting for Student' ? 'selected' : ''}>Waiting for Student</option>
                                    <option value="Answered" ${query.status === 'Answered' ? 'selected' : ''}>Answered</option>
                                    <option value="Resolved" ${query.status === 'Resolved' ? 'selected' : ''}>Resolved</option>
                                    <option value="Closed" ${query.status === 'Closed' ? 'selected' : ''}>Closed</option>
                                </select>
                                <button class="btn small" onclick="CommunityModule.updateStatus(${query.id})">Update Status</button>
                            </div>
                        </div>
                    ` : query.status !== 'Resolved' ? `
                        <div style="margin-bottom:16px;">
                            <button class="btn small teal" onclick="CommunityModule.resolveQuery(${query.id})">✓ Mark Issue Resolved</button>
                        </div>
                    ` : ''}

                    <!-- Official Responses and Conversation -->
                    <h3 style="font-size:16px; margin:16px 0 10px;">Responses & Communications</h3>
                    <div class="answers-list" style="margin-bottom:18px;">
                        ${(messages || []).length ? messages.map(m => `
                            <div class="card" style="margin-bottom:10px; border-left: 4px solid ${m.sender_role === 'admin' ? '#0969da' : 'var(--pin-teal)'}; background:${m.sender_role === 'admin' ? '#f8fafd' : '#fff'};">
                                <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:6px;">
                                    <strong>${m.sender_role === 'admin' ? '🛡️ Administrator (' + escapeHtml(m.sender_name) + ')' : '👤 ' + escapeHtml(m.sender_name)}</strong>
                                    <span style="font-size:11px; color:var(--ink-soft);">${new Date(m.created_at).toLocaleString()}</span>
                                </div>
                                <div style="font-size:13px; line-height:1.5; white-space:pre-wrap;">${escapeHtml(m.message)}</div>
                            </div>
                        `).join('') : '<div class="empty-state">No responses yet. An administrator will reply soon.</div>'}
                    </div>

                    <!-- Follow-up / Response Message Form -->
                    <div style="border-top:1px solid var(--line); padding-top:14px;">
                        <h4 style="font-size:14px; margin-bottom:8px;">${isAdmin ? 'Send Official Admin Response' : 'Add Follow-up Message'}</h4>
                        <textarea id="threadReplyMessage" placeholder="Type your response here..." style="width:100%; min-height:80px;"></textarea>
                        <div style="margin-top:8px;">
                            <button class="btn small" onclick="CommunityModule.sendReply(${query.id})">Send Message</button>
                        </div>
                    </div>

                    ${isAdmin ? `
                        <!-- Admin Internal Confidential Notes -->
                        <div style="border-top:2px dashed #f59e0b; margin-top:20px; padding-top:14px; background:#fffbeb; border-radius:6px; padding:12px;">
                            <h4 style="font-size:14px; margin:0 0 8px; color:#b45309;">🔒 Confidential Internal Notes (Hidden from Student)</h4>
                            <div style="margin-bottom:10px;">
                                ${(internal_notes || []).length ? internal_notes.map(n => `
                                    <div style="font-size:12px; margin-bottom:6px; padding:6px; background:#fff; border-radius:4px; border:1px solid #fde68a;">
                                        <strong>${escapeHtml(n.admin_name)}:</strong> ${escapeHtml(n.note)}
                                        <span style="font-size:10px; color:#78716c;">(${new Date(n.created_at).toLocaleString()})</span>
                                    </div>
                                `).join('') : '<p style="font-size:12px; color:#78716c;">No internal notes yet.</p>'}
                            </div>
                            <input type="text" id="adminNewInternalNote" placeholder="Write internal admin note..." style="width:calc(100% - 130px); margin-right:8px;" />
                            <button class="btn small secondary" onclick="CommunityModule.saveInternalNote(${query.id})">Save Note</button>
                        </div>
                    ` : ''}
                </div>
            `;
        } catch (err) {
            alert('Failed to load query thread: ' + err.message);
        }
    },

    async updateStatus(queryId) {
        const select = document.getElementById('threadStatusSelect');
        if (!select) return;
        try {
            await api(`/community/admin/queries/${queryId}/status`, {
                method: 'PUT',
                body: JSON.stringify({ status: select.value })
            });
            alert('Status updated successfully.');
            this.openQueryThread(queryId);
            this.loadAdminQueries();
        } catch (err) {
            alert('Failed to update status: ' + err.message);
        }
    },

    async resolveQuery(queryId) {
        if (!confirm('Are you sure you want to mark this issue as resolved?')) return;
        try {
            await api(`/community/queries/${queryId}/resolve`, { method: 'PUT' });
            alert('Issue marked as resolved.');
            this.openQueryThread(queryId);
            this.loadStudentQueries();
        } catch (err) {
            alert('Failed to mark resolved: ' + err.message);
        }
    },

    async sendReply(queryId) {
        const textarea = document.getElementById('threadReplyMessage');
        const message = textarea.value.trim();
        if (!message) return alert('Please enter a message before sending.');

        try {
            await api(`/community/queries/${queryId}/messages`, {
                method: 'POST',
                body: JSON.stringify({ message })
            });
            textarea.value = '';
            this.openQueryThread(queryId);
            this.loadStudentQueries();
            if (window.CURRENT_USER && window.CURRENT_USER.role === 'admin') {
                this.loadAdminQueries();
            }
        } catch (err) {
            alert('Failed to send response: ' + err.message);
        }
    },

    async saveInternalNote(queryId) {
        const input = document.getElementById('adminNewInternalNote');
        const note = input.value.trim();
        if (!note) return alert('Please enter a note.');

        try {
            await api(`/community/admin/queries/${queryId}/notes`, {
                method: 'POST',
                body: JSON.stringify({ note })
            });
            input.value = '';
            this.openQueryThread(queryId);
        } catch (err) {
            alert('Failed to save internal note: ' + err.message);
        }
    },

    closeThread() {
        const threadContainer = document.getElementById('community_thread_container');
        if (threadContainer) threadContainer.style.display = 'none';
        this.activeQueryId = null;
    },

    getStatusColor(status) {
        switch (status) {
            case 'Resolved': return '#28a745';
            case 'Answered': return '#0969da';
            case 'In Progress': return '#f59e0b';
            case 'Waiting for Student': return '#6f42c1';
            case 'Closed': return '#6c757d';
            default: return '#0366d6';
        }
    }
};
