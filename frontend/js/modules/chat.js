/**
 * StudyMate Real-Time Messaging & Chat Request Controller
 * WhatsApp-inspired layout, persistent message history, incoming/outgoing request management,
 * and integrated AI study co-pilot.
 */

window.ChatModule = {
    conversations: [],
    activeConversationId: null,
    activePartner: null,
    activeMessages: [],
    pollingInterval: null,
    currentSubTab: 'conversations',
    isSending: false,

    async init() {
        this.setupEventListeners();
        await this.loadConversations();
        await this.loadIncomingRequests();
        await this.loadOutgoingRequests();
        this.startRealTimeSync();
    },

    setupEventListeners() {
        const searchInput = document.getElementById('chatSearchInput');
        if (searchInput) {
            searchInput.addEventListener('input', () => this.filterConversations());
        }

        const msgInput = document.getElementById('chatMessageInput');
        if (msgInput) {
            msgInput.addEventListener('keydown', (e) => this.handleKeySend(e));
        }

        const aiForm = document.getElementById('chatAiForm');
        if (aiForm) {
            aiForm.addEventListener('submit', (e) => this.submitAiCoPilot(e));
        }
    },

    // Sub-tab switching: Chats, Requests, Sent Requests, AI Assistant
    switchSubTab(tabName) {
        this.currentSubTab = tabName;
        document.querySelectorAll('.chat-tab-btn').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.subtab === tabName);
        });

        const viewConvs = document.getElementById('chatViewConversations');
        const viewIncoming = document.getElementById('chatViewIncoming');
        const viewOutgoing = document.getElementById('chatViewOutgoing');
        const viewAi = document.getElementById('chatViewAiCopilot');

        if (viewConvs) viewConvs.style.display = tabName === 'conversations' ? 'block' : 'none';
        if (viewIncoming) viewIncoming.style.display = tabName === 'incoming' ? 'block' : 'none';
        if (viewOutgoing) viewOutgoing.style.display = tabName === 'outgoing' ? 'block' : 'none';
        if (viewAi) viewAi.style.display = tabName === 'ai_copilot' ? 'block' : 'none';

        if (tabName === 'conversations') this.loadConversations();
        if (tabName === 'incoming') this.loadIncomingRequests();
        if (tabName === 'outgoing') this.loadOutgoingRequests();
    },

    // Real-time synchronization via robust polling with session authorization
    startRealTimeSync() {
        if (this.pollingInterval) clearInterval(this.pollingInterval);
        this.pollingInterval = setInterval(async () => {
            if (this.currentSubTab === 'conversations') {
                if (this.activeConversationId) {
                    await this.fetchMessagesSilently(this.activeConversationId);
                }
                await this.loadConversationsSilently();
            } else if (this.currentSubTab === 'incoming') {
                await this.loadIncomingRequestsSilently();
            }
        }, 3500);
    },

    async refreshAll() {
        await Promise.all([
            this.loadConversations(),
            this.loadIncomingRequests(),
            this.loadOutgoingRequests()
        ]);
        if (this.activeConversationId) {
            await this.loadMessages(this.activeConversationId);
        }
    },

    // 1. CONVERSATIONS MANAGEMENT
    async loadConversations() {
        const listEl = document.getElementById('chatConversationsList');
        if (!listEl) return;

        try {
            const res = await api('/chat/conversations');
            this.conversations = res || [];
            this.renderConversationList();
            this.updateBadges();
        } catch (err) {
            listEl.innerHTML = `<div class="empty-state" style="padding:24px 10px; color:var(--pin-red);">Failed to load chats: ${escapeHtml(err.message)}</div>`;
        }
    },

    async loadConversationsSilently() {
        try {
            const res = await api('/chat/conversations');
            this.conversations = res || [];
            this.renderConversationList();
            this.updateBadges();
        } catch (e) {
            // silent sync
        }
    },

    renderConversationList() {
        const listEl = document.getElementById('chatConversationsList');
        if (!listEl) return;

        const query = (document.getElementById('chatSearchInput')?.value || '').toLowerCase().trim();
        const filtered = this.conversations.filter(c => {
            if (!query) return true;
            const name = (c.partner?.name || '').toLowerCase();
            const dept = (c.partner?.department || '').toLowerCase();
            const lastMsg = (c.last_message?.content || '').toLowerCase();
            return name.includes(query) || dept.includes(query) || lastMsg.includes(query);
        });

        if (filtered.length === 0) {
            listEl.innerHTML = `
                <div class="empty-state" style="padding:32px 14px;">
                    <p style="font-size:13px; margin-bottom:8px;">No active conversations.</p>
                    <p style="font-size:11px; color:var(--ink-soft); line-height:1.4;">
                        Accept study partner requests from the <strong>Requests</strong> tab or connect with peers in <strong>Find Partner</strong> to start chatting!
                    </p>
                </div>
            `;
            return;
        }

        listEl.innerHTML = filtered.map(c => {
            const isSelected = c.id === this.activeConversationId;
            const initial = (c.partner?.name || 'S').charAt(0).toUpperCase();
            const lastMsgPreview = c.last_message ? escapeHtml(c.last_message.content) : '<em>No messages yet · Say hello!</em>';
            const timePreview = c.last_message ? this.formatTime(c.last_message.created_at) : '';
            const unreadBadge = c.unread_count > 0 ? `<span class="chat-conv-unread">${c.unread_count}</span>` : '';
            const statusTicks = c.last_message && c.last_message.sender_id === STUDENT_ID ? 
                `<span class="chat-status-tick ${c.last_message.status}">${c.last_message.status === 'read' ? '✓✓' : '✓'}</span> ` : '';

            return `
                <div class="chat-conv-item ${isSelected ? 'active' : ''}" onclick="ChatModule.openConversation(${c.id})">
                    <div class="profile-avatar palette-${(c.partner?.student_id || 1) % 6}" style="width:42px; height:42px; font-size:15px; flex-shrink:0;">
                        ${initial}
                    </div>
                    <div class="chat-conv-info">
                        <div class="chat-conv-top">
                            <span class="chat-conv-name">${escapeHtml(c.partner?.name || 'Study Partner')}</span>
                            <span class="chat-conv-time">${timePreview}</span>
                        </div>
                        <div class="chat-conv-bottom">
                            <span class="chat-conv-last-msg">${statusTicks}${lastMsgPreview}</span>
                            ${unreadBadge}
                        </div>
                    </div>
                </div>
            `;
        }).join('');
    },

    filterConversations() {
        this.renderConversationList();
    },

    async openConversation(convId) {
        this.activeConversationId = convId;
        const conv = this.conversations.find(c => c.id === convId);
        if (conv) {
            this.activePartner = conv.partner;
            conv.unread_count = 0;
            this.updateBadges();
        }

        // Show conversation window in DOM
        const noChatState = document.getElementById('noChatSelectedState');
        const activeChatContent = document.getElementById('activeChatContent');
        if (noChatState) noChatState.style.display = 'none';
        if (activeChatContent) {
            activeChatContent.style.display = 'flex';
        }

        // On mobile: toggle panel class to show active chat
        const twoPanel = document.querySelector('.chat-two-panel');
        if (twoPanel) twoPanel.classList.add('mobile-chat-open');

        // Update active header
        if (this.activePartner) {
            const avatarEl = document.getElementById('activePartnerAvatar');
            const nameEl = document.getElementById('activePartnerName');
            const statusEl = document.getElementById('activePartnerStatus');

            if (avatarEl) {
                avatarEl.textContent = (this.activePartner.name || 'S').charAt(0).toUpperCase();
                avatarEl.className = `profile-avatar palette-${(this.activePartner.student_id || 1) % 6}`;
            }
            if (nameEl) nameEl.textContent = this.activePartner.name || 'Study Partner';
            if (statusEl) {
                const dept = this.activePartner.department ? `${this.activePartner.department} · ` : '';
                statusEl.textContent = `${dept}Active Study Partner`;
            }
        }

        this.renderConversationList();
        await this.loadMessages(convId);
    },

    backToSidebar() {
        const twoPanel = document.querySelector('.chat-two-panel');
        if (twoPanel) twoPanel.classList.remove('mobile-chat-open');
    },

    async loadMessages(convId) {
        const stream = document.getElementById('chatMessagesStream');
        if (!stream) return;

        stream.innerHTML = '<div class="empty-state" style="padding:40px 10px;">Loading messages...</div>';

        try {
            const res = await api(`/chat/conversations/${convId}/messages`);
            this.activeMessages = res.messages || [];
            this.renderMessageStream();
        } catch (err) {
            stream.innerHTML = `<div class="empty-state" style="color:var(--pin-red); padding:30px;">Error loading messages: ${escapeHtml(err.message)}</div>`;
        }
    },

    async fetchMessagesSilently(convId) {
        try {
            const res = await api(`/chat/conversations/${convId}/messages`);
            const incoming = res.messages || [];
            if (incoming.length !== this.activeMessages.length) {
                this.activeMessages = incoming;
                this.renderMessageStream();
            }
        } catch (e) {
            // silent sync
        }
    },

    renderMessageStream() {
        const stream = document.getElementById('chatMessagesStream');
        if (!stream) return;

        if (this.activeMessages.length === 0) {
            stream.innerHTML = `
                <div class="empty-state" style="margin:auto; padding:40px 20px;">
                    <span style="font-size:32px; display:block; margin-bottom:8px;">👋</span>
                    <h4 style="font-size:14px; margin-bottom:4px;">No messages in this study chat yet</h4>
                    <p style="font-size:12px; color:var(--ink-soft); max-width:280px; margin:0 auto;">
                        Say hi to ${escapeHtml(this.activePartner?.name || 'your partner')}, propose a study topic, or prepare for exams together!
                    </p>
                </div>
            `;
            return;
        }

        stream.innerHTML = this.activeMessages.map(msg => {
            const isMine = msg.sender_id === STUDENT_ID;
            const timeStr = this.formatTime(msg.created_at);
            const statusIndicator = isMine ? 
                `<span class="msg-status-mark ${msg.status}">${msg.status === 'read' ? '✓✓' : '✓'}</span>` : '';

            return `
                <div class="chat-msg-row ${isMine ? 'sent' : 'received'}">
                    <div class="chat-bubble">
                        ${!isMine ? `<span class="chat-sender-label">${escapeHtml(msg.sender_name || 'Partner')}</span>` : ''}
                        <div class="chat-msg-text">${escapeHtml(msg.content)}</div>
                        <div class="chat-msg-meta">
                            <span class="chat-msg-time">${timeStr}</span>
                            ${statusIndicator}
                        </div>
                    </div>
                </div>
            `;
        }).join('');

        // Scroll to bottom smoothly
        stream.scrollTop = stream.scrollHeight;
    },

    handleKeySend(e) {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            this.sendMessage();
        }
    },

    async sendMessage() {
        if (this.isSending || !this.activeConversationId) return;

        const input = document.getElementById('chatMessageInput');
        const content = input?.value?.trim();
        if (!content) return;

        const sendBtn = document.getElementById('chatSendBtn');
        this.isSending = true;
        if (sendBtn) {
            sendBtn.disabled = true;
            sendBtn.textContent = '...';
        }

        try {
            const res = await api(`/chat/conversations/${this.activeConversationId}/messages`, {
                method: 'POST',
                body: JSON.stringify({ content })
            });

            if (input) input.value = '';
            this.activeMessages.push(res);
            this.renderMessageStream();
            await this.loadConversationsSilently();
        } catch (err) {
            alert('Failed to send message: ' + err.message);
        } finally {
            this.isSending = false;
            if (sendBtn) {
                sendBtn.disabled = false;
                sendBtn.textContent = 'Send';
            }
            if (input) input.focus();
        }
    },

    // 2. INCOMING REQUESTS
    async loadIncomingRequests() {
        const container = document.getElementById('incomingRequestsContainer');
        if (!container) return;

        try {
            const requests = await api('/chat/requests/incoming');
            this.renderIncomingRequests(requests || []);
            this.updateBadgeCount('chatBadgeRequests', (requests || []).filter(r => r.status === 'pending').length);
        } catch (err) {
            container.innerHTML = `<div class="empty-state" style="color:var(--pin-red);">Failed to load requests: ${escapeHtml(err.message)}</div>`;
        }
    },

    async loadIncomingRequestsSilently() {
        try {
            const requests = await api('/chat/requests/incoming');
            this.renderIncomingRequests(requests || []);
            this.updateBadgeCount('chatBadgeRequests', (requests || []).filter(r => r.status === 'pending').length);
        } catch (e) {
            // silent sync
        }
    },

    renderIncomingRequests(requests) {
        const container = document.getElementById('incomingRequestsContainer');
        if (!container) return;

        const pending = requests.filter(r => r.status === 'pending');
        if (pending.length === 0) {
            container.innerHTML = `
                <div class="card empty-state" style="grid-column: 1 / -1; padding:36px 20px;">
                    <span style="font-size:28px; display:block; margin-bottom:6px;">📭</span>
                    <p style="font-size:14px; font-weight:600; margin-bottom:4px;">No pending study requests</p>
                    <p style="font-size:12px; color:var(--ink-soft); margin:0;">
                        When classmates find you in <strong>Find Partner</strong>, their requests will appear here.
                    </p>
                </div>
            `;
            return;
        }

        container.innerHTML = pending.map(r => {
            const initial = (r.sender_name || 'S').charAt(0).toUpperCase();
            const subjectsHtml = (r.subjects || []).map(s => `<span class="subject-pill">${escapeHtml(s)}</span>`).join('');

            return `
                <div class="card request-card" style="display:flex; flex-direction:column; justify-content:space-between; border-left:3px solid var(--pin-teal);">
                    <div>
                        <div style="display:flex; align-items:center; gap:12px; margin-bottom:10px;">
                            <div class="profile-avatar palette-${r.sender_id % 6}" style="width:44px; height:44px; font-size:16px;">
                                ${initial}
                            </div>
                            <div>
                                <h4 style="font-size:15px; margin:0;">${escapeHtml(r.sender_name || 'Student')}</h4>
                                <p style="font-size:12px; color:var(--ink-soft); margin:2px 0 0;">
                                    ${escapeHtml(r.department || 'Department')} · ${escapeHtml(r.academic_year || 'Year')}
                                </p>
                            </div>
                        </div>

                        ${r.intro_message ? `
                            <div style="background:#f4f9f8; border:1px solid #dcece9; padding:8px 10px; border-radius:4px; margin-bottom:10px;">
                                <span style="font-size:10px; font-family:var(--font-mono); text-transform:uppercase; color:var(--pin-teal); display:block; margin-bottom:2px;">Introductory Message</span>
                                <p style="font-size:12px; color:var(--ink); margin:0; line-height:1.4;">"${escapeHtml(r.intro_message)}"</p>
                            </div>
                        ` : ''}

                        ${subjectsHtml ? `
                            <div style="margin-bottom:10px;">
                                <span style="font-size:10px; font-family:var(--font-mono); color:var(--ink-soft); text-transform:uppercase; display:block; margin-bottom:4px;">Subjects</span>
                                <div style="display:flex; flex-wrap:wrap; gap:4px;">${subjectsHtml}</div>
                            </div>
                        ` : ''}
                        <p style="font-size:11px; color:var(--ink-soft); margin:4px 0 12px;">Sent: ${this.formatTime(r.created_at)}</p>
                    </div>

                    <div style="display:flex; gap:8px; border-top:1px dashed var(--line); padding-top:12px;">
                        <button class="btn small teal" style="flex:1;" onclick="ChatModule.acceptRequest(${r.id})">Accept</button>
                        <button class="btn small danger" style="flex:1;" onclick="ChatModule.rejectRequest(${r.id})">Decline</button>
                        <button class="btn small secondary" onclick="openStudentProfileModal(${r.sender_id})">Profile</button>
                    </div>
                </div>
            `;
        }).join('');
    },

    async acceptRequest(reqId) {
        try {
            const res = await api(`/chat/requests/${reqId}/accept`, { method: 'POST' });
            if (window.showDashToast) {
                window.showDashToast('✅ ' + (res.message || 'Request accepted! Conversation unlocked.'), 'success');
            }
            await this.loadIncomingRequests();
            await this.loadConversations();
            if (typeof loadRequests === 'function') loadRequests();
            if (typeof loadMatches === 'function') loadMatches();
            if (res.conversation_id) {
                this.switchSubTab('conversations');
                this.openConversation(res.conversation_id);
            }
        } catch (err) {
            if (window.showDashToast) {
                window.showDashToast('Could not accept request: ' + err.message, 'error');
            } else {
                alert('Could not accept request: ' + err.message);
            }
        }
    },

    async rejectRequest(reqId) {
        const doReject = async () => {
            try {
                await api(`/chat/requests/${reqId}/reject`, { method: 'POST' });
                if (window.showDashToast) {
                    window.showDashToast('Request declined.', 'info');
                }
                await this.loadIncomingRequests();
                if (typeof loadRequests === 'function') loadRequests();
            } catch (err) {
                if (window.showDashToast) {
                    window.showDashToast('Could not decline request: ' + err.message, 'error');
                } else {
                    alert('Could not decline request: ' + err.message);
                }
            }
        };

        if (window.showDashModal) {
            window.showDashModal({
                title: 'Decline Study Request',
                body: 'Are you sure you want to decline this study partner request?',
                confirmLabel: 'Decline',
                cancelLabel: 'Cancel',
                onConfirm: doReject
            });
        } else {
            if (confirm('Are you sure you want to decline this study request?')) {
                doReject();
            }
        }
    },

    // 3. OUTGOING REQUESTS
    async loadOutgoingRequests() {
        const container = document.getElementById('outgoingRequestsContainer');
        if (!container) return;

        try {
            const requests = await api('/chat/requests/outgoing');
            this.renderOutgoingRequests(requests || []);
        } catch (err) {
            container.innerHTML = `<div class="empty-state" style="color:var(--pin-red);">Failed to load outgoing requests: ${escapeHtml(err.message)}</div>`;
        }
    },

    renderOutgoingRequests(requests) {
        const container = document.getElementById('outgoingRequestsContainer');
        if (!container) return;

        if (requests.length === 0) {
            container.innerHTML = `
                <div class="card empty-state" style="grid-column: 1 / -1; padding:36px 20px;">
                    <span style="font-size:28px; display:block; margin-bottom:6px;">✈️</span>
                    <p style="font-size:14px; font-weight:600; margin-bottom:4px;">No sent requests</p>
                    <p style="font-size:12px; color:var(--ink-soft); margin:0;">
                        Use the <strong>Find Partner</strong> tab to connect with peers and form study teams!
                    </p>
                </div>
            `;
            return;
        }

        container.innerHTML = requests.map(r => {
            const initial = (r.receiver_name || 'S').charAt(0).toUpperCase();
            const statusClass = r.status === 'accepted' ? 'accepted' : r.status === 'rejected' ? 'rejected' : 'pending';

            return `
                <div class="card request-card" style="display:flex; flex-direction:column; justify-content:space-between;">
                    <div>
                        <div style="display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:8px;">
                            <div style="display:flex; align-items:center; gap:10px;">
                                <div class="profile-avatar palette-${r.receiver_id % 6}" style="width:38px; height:38px; font-size:14px;">
                                    ${initial}
                                </div>
                                <div>
                                    <h4 style="font-size:14px; margin:0;">${escapeHtml(r.receiver_name || 'Classmate')}</h4>
                                    <p style="font-size:11px; color:var(--ink-soft); margin:0;">${escapeHtml(r.department || '')} · ${escapeHtml(r.academic_year || '')}</p>
                                </div>
                            </div>
                            <span class="pill ${statusClass}">${r.status}</span>
                        </div>

                        ${r.intro_message ? `
                            <p style="font-size:12px; color:var(--ink-soft); font-style:italic; margin:6px 0 10px;">"${escapeHtml(r.intro_message)}"</p>
                        ` : ''}
                        <p style="font-size:11px; color:var(--ink-soft); margin:0;">Sent: ${this.formatTime(r.created_at)}</p>
                    </div>

                    <div style="margin-top:12px; border-top:1px dashed var(--line); padding-top:10px; display:flex; justify-content:flex-end;">
                        ${r.status === 'accepted' ? `
                            <button class="btn small teal" onclick="ChatModule.switchSubTab('conversations'); ChatModule.loadConversations();">Go to Chat →</button>
                        ` : `
                            <button class="btn small secondary" onclick="openStudentProfileModal(${r.receiver_id})">View Profile</button>
                        `}
                    </div>
                </div>
            `;
        }).join('');
    },

    // 4. INTEGRATED AI COPILOT IN CHAT
    async submitAiCoPilot(e) {
        if (e) e.preventDefault();
        const input = document.getElementById('chatAiInput');
        const prompt = input?.value?.trim();
        if (!prompt) return;

        const stream = document.getElementById('chatAiStream');
        if (stream) {
            stream.innerHTML += `
                <div class="chat-msg-row sent">
                    <div class="chat-bubble">
                        <div class="chat-msg-text">${escapeHtml(prompt)}</div>
                        <div class="chat-msg-meta"><span class="chat-msg-time">Just now</span></div>
                    </div>
                </div>
                <div class="chat-msg-row received" id="aiStreamLoading">
                    <div class="profile-avatar palette-0" style="width:30px; height:30px; font-size:11px;">AI</div>
                    <div class="chat-bubble">
                        <p style="margin:0; font-size:12px; color:var(--ink-soft); font-style:italic;">Analyzing academic context...</p>
                    </div>
                </div>
            `;
            stream.scrollTop = stream.scrollHeight;
        }

        if (input) input.value = '';

        try {
            const res = await api('/chat/ai', {
                method: 'POST',
                body: JSON.stringify({ prompt, mode: 'study_help' })
            });

            const loadingEl = document.getElementById('aiStreamLoading');
            if (loadingEl) loadingEl.remove();

            if (stream) {
                stream.innerHTML += `
                    <div class="chat-msg-row received">
                        <div class="profile-avatar palette-0" style="width:30px; height:30px; font-size:11px;">AI</div>
                        <div class="chat-bubble" style="max-width:85%;">
                            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:4px;">
                                <strong style="font-size:12px; color:var(--pin-teal);">StudyMate Assistant (${escapeHtml(res.provider || 'AI')})</strong>
                            </div>
                            <div class="chat-msg-text" style="white-space:pre-wrap; line-height:1.5;">${escapeHtml(res.response)}</div>
                            <div style="margin-top:8px; display:flex; gap:6px;">
                                <button class="btn small secondary" style="padding:2px 8px; font-size:10px;" onclick="ChatModule.copyAiResponse(this)">Copy</button>
                                <button class="btn small teal" style="padding:2px 8px; font-size:10px;" onclick="ChatModule.insertAiIntoActiveChat(decodeURIComponent('${encodeURIComponent(res.response)}'))">Insert into Active Chat</button>
                            </div>
                        </div>
                    </div>
                `;
                stream.scrollTop = stream.scrollHeight;
            }
        } catch (err) {
            const loadingEl = document.getElementById('aiStreamLoading');
            if (loadingEl) loadingEl.remove();
            if (stream) {
                stream.innerHTML += `
                    <div class="chat-msg-row received">
                        <div class="chat-bubble" style="background:#fceeee; color:var(--pin-red);">
                            <strong>Assistant Error:</strong> ${escapeHtml(err.message)}
                        </div>
                    </div>
                `;
            }
        }
    },

    quickPromptAi(text, mode = 'study_help') {
        const input = document.getElementById('chatAiInput');
        if (input) {
            input.value = text;
            this.submitAiCoPilot(null);
        }
    },

    insertAiIntoActiveChat(text) {
        if (!this.activeConversationId) {
            alert('Please select an active conversation in the Chats tab first!');
            return;
        }
        this.switchSubTab('conversations');
        const input = document.getElementById('chatMessageInput');
        if (input) {
            input.value = text;
            input.focus();
        }
    },

    copyAiResponse(btn) {
        const text = btn.closest('.chat-bubble')?.querySelector('.chat-msg-text')?.innerText;
        if (text) {
            navigator.clipboard.writeText(text);
            const original = btn.textContent;
            btn.textContent = 'Copied!';
            setTimeout(() => { btn.textContent = original; }, 2000);
        }
    },

    // 5. AI MESSAGE DRAFTING MODAL
    openAiDraftModal(draftType = 'general') {
        const modal = document.getElementById('aiDraftModal');
        const promptInput = document.getElementById('aiDraftPromptInput');
        const resultArea = document.getElementById('aiDraftResultArea');

        if (!modal) return;
        modal.style.display = 'flex';

        if (resultArea) resultArea.value = '';

        if (promptInput) {
            if (draftType === 'draft_schedule') {
                promptInput.value = `Propose an online meeting this Thursday at 6 PM to revise exam topics together`;
            } else {
                promptInput.value = `Ask if they have notes on Data Structures Trees and are free to review them`;
            }
            promptInput.focus();
        }
    },

    async generateDraft() {
        const promptInput = document.getElementById('aiDraftPromptInput');
        const resultArea = document.getElementById('aiDraftResultArea');
        const prompt = promptInput?.value?.trim();
        if (!prompt) return;

        if (resultArea) resultArea.value = 'Generating professional draft...';

        try {
            const res = await api('/chat/ai', {
                method: 'POST',
                body: JSON.stringify({ prompt, mode: 'draft_intro' })
            });
            if (resultArea) {
                resultArea.value = res.response;
            }
        } catch (err) {
            if (resultArea) resultArea.value = 'Error generating draft: ' + err.message;
        }
    },

    applyDraftToChat() {
        const resultArea = document.getElementById('aiDraftResultArea');
        const text = resultArea?.value?.trim();
        if (!text) return;

        const chatInput = document.getElementById('chatMessageInput');
        if (chatInput) {
            chatInput.value = text;
            chatInput.focus();
        }
        document.getElementById('aiDraftModal').style.display = 'none';
    },

    viewActivePartnerProfile() {
        if (this.activePartner?.student_id) {
            openStudentProfileModal(this.activePartner.student_id);
        }
    },

    // Helpers
    updateBadges() {
        const unreadTotal = this.conversations.reduce((sum, c) => sum + (c.unread_count || 0), 0);
        this.updateBadgeCount('chatBadgeConvs', unreadTotal);
    },

    updateBadgeCount(id, count) {
        const badge = document.getElementById(id);
        if (!badge) return;
        if (count > 0) {
            badge.textContent = count;
            badge.style.display = 'inline-block';
        } else {
            badge.style.display = 'none';
        }
    },

    formatTime(isoString) {
        if (!isoString) return '';
        try {
            const date = new Date(isoString);
            const now = new Date();
            const diffHours = (now - date) / (1000 * 60 * 60);

            if (diffHours < 24 && date.getDate() === now.getDate()) {
                return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
            } else if (diffHours < 48) {
                return 'Yesterday';
            } else {
                return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
            }
        } catch (e) {
            return '';
        }
    }
};
