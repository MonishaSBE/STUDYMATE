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

    // Strip remaining LaTeX dollar-sign math notation (inline & block)
    text = text
        .replace(/\$\$([\s\S]*?)\$\$/g, (_, m) => m.trim())
        .replace(/\$((?:[^$\\]|\\.)*?)\$/g, '$1')
        .replace(/\\to\b/g, '->')
        .replace(/\\rightarrow\b/g, '->')
        .replace(/\\leftarrow\b/g, '<-')
        .replace(/\\le\b/g, '<=')
        .replace(/\\ge\b/g, '>=')
        .replace(/\\neq\b/g, '!=')
        .replace(/\\cdot\b/g, ' · ')
        .replace(/\\times\b/g, ' × ')
        .replace(/\\log\b/g, 'log')
        .replace(/\\sqrt\{([^}]+)\}/g, 'sqrt($1)')
        .replace(/\\frac\{([^}]+)\}\{([^}]+)\}/g, '($1)/($2)');

    // Process code blocks (``` ... ```) BEFORE line-by-line processing
    text = text.replace(/```(\w+)?\n?([\s\S]*?)```/g, (_, lang, code) => {
        return `<pre class="ai-code-block"><code>${escapeHtmlInline(code.trim())}</code></pre>`;
    });
    // Inline code `code`
    text = text.replace(/`([^`]+)`/g, '<code class="ai-inline-code">$1</code>');

    const lines = text.split('\n');
    let html = '';
    let inList = false;
    let inOrderedList = false;

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];

        // Skip pre-processed code blocks
        if (line.startsWith('<pre ')) { html += line + '\n'; continue; }

        // Headings
        if (/^### (.+)/.test(line)) { if (inList) { html += '</ul>'; inList = false; } if (inOrderedList) { html += '</ol>'; inOrderedList = false; } html += `<h3 style="font-size:14px; font-weight:700; color:var(--ink); margin:14px 0 6px;">${inline(line.replace(/^### /, ''))}</h3>`; continue; }
        if (/^## (.+)/.test(line)) { if (inList) { html += '</ul>'; inList = false; } if (inOrderedList) { html += '</ol>'; inOrderedList = false; } html += `<h2 style="font-size:16px; font-weight:700; color:var(--ink); margin:16px 0 8px;">${inline(line.replace(/^## /, ''))}</h2>`; continue; }
        if (/^# (.+)/.test(line)) { if (inList) { html += '</ul>'; inList = false; } if (inOrderedList) { html += '</ol>'; inOrderedList = false; } html += `<h1 style="font-size:18px; font-weight:700; color:var(--ink); margin:18px 0 10px;">${inline(line.replace(/^# /, ''))}</h1>`; continue; }

        // Horizontal rule
        if (/^---+$/.test(line.trim())) { html += '<hr style="border:none; border-top:1px solid var(--line); margin:12px 0;" />'; continue; }

        // Blockquote
        if (/^> (.+)/.test(line)) { html += `<blockquote class="ai-quote">${inline(line.replace(/^> /, ''))}</blockquote>`; continue; }

        // Ordered list
        const olMatch = line.match(/^(\d+)\. (.+)/);
        if (olMatch) {
            if (inList) { html += '</ul>'; inList = false; }
            if (!inOrderedList) { html += '<ol style="margin:6px 0 6px 18px; padding:0;">'; inOrderedList = true; }
            html += `<li style="margin-bottom:4px; line-height:1.6;">${inline(olMatch[2])}</li>`;
            continue;
        }

        // Unordered list
        if (/^[-*] (.+)/.test(line)) {
            if (inOrderedList) { html += '</ol>'; inOrderedList = false; }
            if (!inList) { html += '<ul style="margin:6px 0 6px 18px; padding:0; list-style:disc;">'; inList = true; }
            html += `<li style="margin-bottom:4px; line-height:1.6;">${inline(line.replace(/^[-*] /, ''))}</li>`;
            continue;
        }

        // Close open lists
        if (inList) { html += '</ul>'; inList = false; }
        if (inOrderedList) { html += '</ol>'; inOrderedList = false; }

        // Empty line
        if (line.trim() === '') { html += '<br>'; continue; }

        // Regular paragraph
        html += `<p style="margin:4px 0; line-height:1.7;">${inline(line)}</p>`;
    }

    if (inList) html += '</ul>';
    if (inOrderedList) html += '</ol>';

    return html;
}

function inline(text) {
    return text
        .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
        .replace(/\*(.+?)\*/g, '<em>$1</em>')
        .replace(/__(.+?)__/g, '<strong>$1</strong>')
        .replace(/_(.+?)_/g, '<em>$1</em>')
        .replace(/`([^`]+)`/g, '<code class="ai-inline-code">$1</code>');
}

function escapeHtmlInline(str) {
    return String(str).replace(/[&<>"']/g, s => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[s]));
}
