/**
 * Feature Module 4: AI Study Assistant
 * Summaries, Grounded Q&A with source references, and Structured Notes.
 */

window.AiAssistantModule = {
    async init() {
        const docSelect = document.getElementById('ai_doc_select');
        const summarizeBtn = document.getElementById('ai_summarize_btn');
        const notesBtn = document.getElementById('ai_notes_btn');
        const askForm = document.getElementById('ai_ask_form');

        if (docSelect) {
            await this.refreshDocList();
        }

        if (summarizeBtn) {
            summarizeBtn.addEventListener('click', () => this.handleSummarize());
        }

        if (notesBtn) {
            notesBtn.addEventListener('click', () => this.handleGenerateNotes());
        }

        if (askForm) {
            askForm.addEventListener('submit', (e) => {
                e.preventDefault();
                this.handleAskQuestion();
            });
        }

        this.checkStatus();
    },

    async checkStatus() {
        try {
            const res = await api('/ai/status');
            const statusBadge = document.getElementById('ai_status_badge');
            if (statusBadge) {
                statusBadge.textContent = res.model;
                statusBadge.title = res.message;
            }
        } catch (e) {}
    },

    async refreshDocList() {
        const select = document.getElementById('ai_doc_select');
        if (!select) return;

        try {
            const materials = await api('/materials');
            select.innerHTML = '<option value="">-- Choose a Document to Study --</option>' +
                materials.map(m => `<option value="${m.id}">${escapeHtml(m.title)} (${escapeHtml(m.subject_name)})</option>`).join('');
        } catch (e) {
            console.error('Failed to load doc options for AI assistant', e);
        }
    },

    async handleSummarize() {
        const docId = document.getElementById('ai_doc_select').value;
        const type = document.getElementById('ai_summary_type').value || 'detailed';
        const output = document.getElementById('ai_output_panel');

        if (!docId) return alert('Please select a study document first.');

        output.innerHTML = '<div class="empty-state">Synthesizing document with AI Study Assistant...</div>';

        try {
            const res = await api('/ai/summarize', {
                method: 'POST',
                body: JSON.stringify({ material_id: docId, type })
            });

            output.innerHTML = `
                <div class="ai-result-box">
                    <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:10px;">
                        <span class="eyebrow">// ${escapeHtml(res.ai_provider)}</span>
                        <span class="pill">${escapeHtml(res.summary_type)} summary</span>
                    </div>
                    <div class="markdown-body">${formatMarkdown(res.summary)}</div>
                </div>
            `;
        } catch (err) {
            output.innerHTML = `<div class="status-msg error">AI assistant error: ${escapeHtml(err.message)}</div>`;
        }
    },

    async handleAskQuestion() {
        const docId = document.getElementById('ai_doc_select').value;
        const qInput = document.getElementById('ai_question_input');
        const question = qInput.value.trim();
        const chatFeed = document.getElementById('ai_chat_feed');

        if (!docId) return alert('Please select a document to ask questions about.');
        if (!question) return;

        // Append user question
        const userBubble = document.createElement('div');
        userBubble.className = 'ai-chat-bubble user';
        userBubble.innerHTML = `<strong>You:</strong><p>${escapeHtml(question)}</p>`;
        chatFeed.appendChild(userBubble);
        qInput.value = '';

        // Temporary bot loading bubble
        const botBubble = document.createElement('div');
        botBubble.className = 'ai-chat-bubble bot';
        botBubble.innerHTML = '<strong>Study Assistant:</strong><p>Analyzing document content...</p>';
        chatFeed.appendChild(botBubble);
        chatFeed.scrollTop = chatFeed.scrollHeight;

        try {
            const res = await api('/ai/qa', {
                method: 'POST',
                body: JSON.stringify({ material_id: docId, question })
            });

            botBubble.innerHTML = `
                <strong>Study Assistant:</strong>
                <div style="margin-top:4px;">${formatMarkdown(res.answer)}</div>
                <div style="font-size:11px; color:var(--ink-soft); margin-top:8px;">
                    📌 Grounding: ${escapeHtml(res.sourceReference)}
                </div>
            `;
        } catch (err) {
            botBubble.innerHTML = `<strong>Study Assistant:</strong><p style="color:var(--pin-red);">Error: ${escapeHtml(err.message)}</p>`;
        }

        chatFeed.scrollTop = chatFeed.scrollHeight;
    },

    async handleGenerateNotes() {
        const docId = document.getElementById('ai_doc_select').value;
        const output = document.getElementById('ai_output_panel');

        if (!docId) return alert('Please select a study document first.');

        output.innerHTML = '<div class="empty-state">Extracting structured revision notes...</div>';

        try {
            const res = await api('/ai/notes', {
                method: 'POST',
                body: JSON.stringify({ material_id: docId })
            });

            output.innerHTML = `
                <div class="ai-result-box">
                    <span class="eyebrow">// Structured Revision Notes</span>
                    <div class="markdown-body">${formatMarkdown(res.notes)}</div>
                </div>
            `;
        } catch (err) {
            output.innerHTML = `<div class="status-msg error">Notes generation error: ${escapeHtml(err.message)}</div>`;
        }
    }
};

function formatMarkdown(text) {
    if (!text) return '';
    return text
        .replace(/^### (.*$)/gim, '<h3 style="font-size:15px; margin:12px 0 6px;">$1</h3>')
        .replace(/^## (.*$)/gim, '<h2 style="font-size:17px; margin:14px 0 8px;">$1</h2>')
        .replace(/^# (.*$)/gim, '<h1 style="font-size:19px; margin:16px 0 10px;">$1</h1>')
        .replace(/^\> (.*$)/gim, '<blockquote class="ai-quote">$1</blockquote>')
        .replace(/\*\*(.*?)\*\*/gim, '<strong>$1</strong>')
        .replace(/\*(.*?)\*/gim, '<em>$1</em>')
        .replace(/^\* (.*$)/gim, '<li>$1</li>')
        .replace(/^\- (.*$)/gim, '<li>$1</li>')
        .replace(/\n/gim, '<br>');
}
