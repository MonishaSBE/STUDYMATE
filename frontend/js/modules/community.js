/**
 * Feature Module 8: Community Questions & Answers
 * Academic peer discussion forum with question creation, answer submission,
 * upvoting, accepted answer resolution, and moderation reporting.
 */

window.CommunityModule = {
    currentSearch: '',
    selectedSubject: '',

    async init() {
        const searchInput = document.getElementById('comm_search_input');
        const askForm = document.getElementById('communityAskForm');

        if (searchInput) {
            searchInput.addEventListener('input', (e) => {
                this.currentSearch = e.target.value.trim();
                this.loadQuestions();
            });
        }

        if (askForm) {
            askForm.addEventListener('submit', (e) => {
                e.preventDefault();
                this.handleAskQuestion(askForm);
            });
        }

        await this.loadQuestions();
    },

    async loadQuestions() {
        const container = document.getElementById('communityQuestionsList');
        if (!container) return;

        container.innerHTML = '<div class="empty-state">Loading academic discussions...</div>';

        try {
            let query = '';
            if (this.currentSearch) query += `?search=${encodeURIComponent(this.currentSearch)}`;

            const questions = await api(`/community/questions${query}`);

            if (!questions.length) {
                container.innerHTML = '<div class="empty-state">No academic discussions found. Ask a question to get help from peers!</div>';
                return;
            }

            container.innerHTML = questions.map(q => `
                <div class="card community-question-card" style="margin-bottom:14px;">
                    <div style="display:flex; justify-content:space-between; align-items:flex-start;">
                        <div>
                            <span class="eyebrow">${escapeHtml(q.subject)}</span>
                            <h3 style="font-size:16px; margin:4px 0 6px;" class="clickable-title" onclick="CommunityModule.openQuestionThread(${q.id})">
                                ${escapeHtml(q.title)}
                            </h3>
                        </div>
                        <span class="pill ${q.is_resolved ? 'accepted' : ''}">
                            ${q.is_resolved ? '✓ Solved' : 'Open'}
                        </span>
                    </div>

                    <p style="font-size:13px; color:var(--ink-soft); line-height:1.4; margin-bottom:10px;">
                        ${escapeHtml(q.content.substring(0, 180))}${q.content.length > 180 ? '...' : ''}
                    </p>

                    <div style="display:flex; justify-content:space-between; align-items:center; font-size:12px; color:var(--ink-soft);">
                        <div>
                            <span>👤 ${escapeHtml(q.author_name)}</span> ·
                            <span>💬 ${q.answer_count} Answers</span> ·
                            <span>👁️ ${q.views_count} Views</span>
                        </div>
                        <button class="btn small teal" onclick="CommunityModule.openQuestionThread(${q.id})">View Discussion →</button>
                    </div>
                </div>
            `).join('');
        } catch (err) {
            container.innerHTML = '<div class="empty-state">Failed to load discussions.</div>';
        }
    },

    async handleAskQuestion(form) {
        const title = document.getElementById('comm_title').value;
        const subject = document.getElementById('comm_subject').value;
        const content = document.getElementById('comm_content').value;
        const tags = document.getElementById('comm_tags').value;

        try {
            await api('/community/questions', {
                method: 'POST',
                body: JSON.stringify({ title, subject, content, tags })
            });

            form.reset();
            alert('Your question has been posted to the study community!');
            this.loadQuestions();
        } catch (err) {
            alert('Failed to post question: ' + err.message);
        }
    },

    async openQuestionThread(questionId) {
        const threadContainer = document.getElementById('community_thread_container');
        if (!threadContainer) return;

        try {
            const q = await api(`/community/questions/${questionId}`);
            threadContainer.style.display = 'block';
            threadContainer.scrollIntoView({ behavior: 'smooth' });

            threadContainer.innerHTML = `
                <div class="card" style="border: 2px solid var(--cork); margin-bottom:20px;">
                    <div style="display:flex; justify-content:space-between; align-items:flex-start;">
                        <div>
                            <span class="eyebrow">${escapeHtml(q.subject)} · Asked by ${escapeHtml(q.author_name)}</span>
                            <h2 style="font-size:20px; margin:4px 0 10px;">${escapeHtml(q.title)}</h2>
                        </div>
                        <button class="btn small secondary" onclick="CommunityModule.closeThread()">Close Discussion</button>
                    </div>

                    <div class="question-body" style="font-size:14px; line-height:1.6; margin-bottom:14px; white-space:pre-wrap;">${escapeHtml(q.content)}</div>

                    ${q.tags ? `<div style="margin-bottom:16px;"><span class="pill">${escapeHtml(q.tags)}</span></div>` : ''}

                    <hr style="border:0; border-top:1px solid var(--line); margin:16px 0;" />

                    <h3 style="font-size:16px; margin-bottom:12px;">Answers (${(q.answers || []).length})</h3>

                    <div class="answers-list">
                        ${(q.answers || []).length ? q.answers.map(a => `
                            <div class="card answer-card" style="margin-bottom:12px; border-left: 4px solid ${a.is_accepted ? 'var(--pin-teal)' : '#e2e5dc'};">
                                <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:6px;">
                                    <strong>👤 ${escapeHtml(a.author_name)}</strong>
                                    ${a.is_accepted ? '<span class="pill accepted">✓ Accepted Solution</span>' : ''}
                                </div>
                                <div style="font-size:13px; line-height:1.5; white-space:pre-wrap; margin-bottom:10px;">${escapeHtml(a.content)}</div>

                                <div style="display:flex; justify-content:space-between; align-items:center;">
                                    <div style="display:flex; align-items:center; gap:8px;">
                                        <button class="vote-btn ${a.user_vote === 'up' ? 'active' : ''}" onclick="CommunityModule.voteAnswer(${q.id}, ${a.id}, 'up')">
                                            ▲ ${a.upvotes || 0} Upvotes
                                        </button>
                                    </div>
                                    ${q.is_author && !a.is_accepted ? `
                                        <button class="btn small teal" onclick="CommunityModule.acceptAnswer(${q.id}, ${a.id})">Mark as Accepted Solution</button>
                                    ` : ''}
                                </div>
                            </div>
                        `).join('') : '<div class="empty-state">No answers submitted yet. Be the first to share an explanation!</div>'}
                    </div>

                    <div class="card" style="margin-top:20px; background:#fafbf8;">
                        <h4 style="font-size:14px; margin-bottom:8px;">Contribute Your Answer</h4>
                        <textarea id="reply_content" placeholder="Write a detailed, constructive answer..." style="width:100%; min-height:80px;"></textarea>
                        <div style="margin-top:10px;">
                            <button class="btn small" onclick="CommunityModule.submitAnswer(${q.id})">Post Answer</button>
                        </div>
                    </div>
                </div>
            `;
        } catch (err) {
            alert('Failed to load discussion thread: ' + err.message);
        }
    },

    async submitAnswer(questionId) {
        const textarea = document.getElementById('reply_content');
        const content = textarea.value.trim();
        if (!content) return alert('Please enter your answer text.');

        try {
            await api(`/community/questions/${questionId}/answers`, {
                method: 'POST',
                body: JSON.stringify({ content })
            });

            this.openQuestionThread(questionId);
            this.loadQuestions();
        } catch (err) {
            alert('Failed to submit answer: ' + err.message);
        }
    },

    async voteAnswer(qId, aId, voteType) {
        try {
            await api(`/community/answers/${aId}/vote`, {
                method: 'POST',
                body: JSON.stringify({ vote_type: voteType })
            });
            this.openQuestionThread(qId);
        } catch (err) {
            alert('Voting error: ' + err.message);
        }
    },

    async acceptAnswer(qId, aId) {
        try {
            await api(`/community/questions/${qId}/answers/${aId}/accept`, { method: 'POST' });
            alert('Answer marked as accepted solution!');
            this.openQuestionThread(qId);
            this.loadQuestions();
        } catch (err) {
            alert('Accept error: ' + err.message);
        }
    },

    closeThread() {
        const threadContainer = document.getElementById('community_thread_container');
        if (threadContainer) threadContainer.style.display = 'none';
    }
};
