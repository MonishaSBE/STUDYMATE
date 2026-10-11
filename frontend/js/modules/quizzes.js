/**
 * Feature Module 5: Quiz Generator & Assessment
 * Generates quizzes from documents, provides interactive attempt mode,
 * and displays instant score breakdown with explanations.
 */

window.QuizzesModule = {
    currentQuiz: null,
    currentAnswers: {},

    async init() {
        const genForm = document.getElementById('quizGenForm');
        if (genForm) {
            genForm.addEventListener('submit', (e) => {
                e.preventDefault();
                this.handleGenerate();
            });
        }

        await this.loadQuizzesList();
        await this.populateDocSelect();
    },

    async populateDocSelect() {
        const select = document.getElementById('quiz_doc_select');
        if (!select) return;

        try {
            const materials = await api('/materials');
            select.innerHTML = '<option value="">-- Select Source Material --</option>' +
                materials.map(m => `<option value="${m.id}">${escapeHtml(m.title)} (${escapeHtml(m.subject_name)})</option>`).join('');
        } catch (e) {}
    },

    async loadQuizzesList() {
        const container = document.getElementById('quizzesList');
        if (!container) return;

        try {
            const list = await api('/quizzes');
            if (!list.length) {
                container.innerHTML = '<div class="empty-state">No quizzes generated yet. Generate your first quiz from a document above!</div>';
                return;
            }

            container.innerHTML = list.map(q => `
                <div class="card" style="margin-bottom:12px; display:flex; justify-content:space-between; align-items:center;">
                    <div>
                        <span class="eyebrow">${escapeHtml(q.subject || 'Assessment')} · ${q.difficulty}</span>
                        <h3 style="font-size:16px; margin:2px 0 4px;">${escapeHtml(q.title)}</h3>
                        <p style="font-size:12px; color:var(--ink-soft);">${q.num_questions} Questions</p>
                    </div>
                    <button class="btn small teal" onclick="QuizzesModule.startQuiz(${q.id})">Take Quiz</button>
                </div>
            `).join('');
        } catch (err) {
            container.innerHTML = '<div class="empty-state">Failed to load quizzes.</div>';
        }
    },

    async generateFromMaterial(materialId) {
        const quizTab = document.querySelector('.tab[data-tab="quizzes"]');
        if (quizTab) quizTab.click();

        const docSelect = document.getElementById('quiz_doc_select');
        if (docSelect) {
            docSelect.value = String(materialId);
        }
    },

    async handleGenerate() {
        const materialId = document.getElementById('quiz_doc_select').value;
        const difficulty = document.getElementById('quiz_difficulty').value;
        const numQuestions = document.getElementById('quiz_num_q').value;
        const title = document.getElementById('quiz_custom_title').value;

        if (!materialId) return alert('Please select a study document to base the quiz on.');

        try {
            const res = await api('/quizzes/generate', {
                method: 'POST',
                body: JSON.stringify({
                    material_id: materialId,
                    difficulty,
                    num_questions: numQuestions,
                    title
                })
            });

            alert('Quiz generated successfully!');
            await this.loadQuizzesList();
            this.startQuiz(res.id);
        } catch (err) {
            alert('Failed to generate quiz: ' + err.message);
        }
    },

    async startQuiz(quizId) {
        const container = document.getElementById('quiz_active_container');
        if (!container) return;

        try {
            const quiz = await api(`/quizzes/${quizId}/take`);
            this.currentQuiz = quiz;
            this.currentAnswers = {};

            container.style.display = 'block';
            container.scrollIntoView({ behavior: 'smooth' });

            container.innerHTML = `
                <div class="card" style="border: 2px solid var(--highlight);">
                    <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:12px;">
                        <span class="eyebrow">// Live Attempt Mode</span>
                        <span class="pill">${escapeHtml(quiz.difficulty)}</span>
                    </div>
                    <h2 style="font-size:18px;">${escapeHtml(quiz.title)}</h2>
                    <p style="font-size:13px; color:var(--ink-soft); margin-bottom:20px;">
                        Answer each question below and click submit to test your mastery.
                    </p>

                    <form id="activeQuizForm">
                        ${quiz.questions.map((q, idx) => `
                            <div class="quiz-question-box" style="margin-bottom:18px; padding:14px; background:rgba(0,0,0,0.02); border-radius:4px;">
                                <strong style="font-size:14px;">Q${idx + 1}. ${escapeHtml(q.question_text)}</strong>
                                <div style="margin-top:10px;">
                                    ${q.options && q.options.length ? q.options.map(opt => `
                                        <label class="quiz-option-label" style="display:block; margin-bottom:6px; cursor:pointer;">
                                            <input type="radio" name="q_${q.id}" value="${escapeHtml(opt)}" onchange="QuizzesModule.setAnswer(${q.id}, '${escapeHtml(opt)}')">
                                            <span>${escapeHtml(opt)}</span>
                                        </label>
                                    `).join('') : `
                                        <input type="text" class="quiz-text-input" placeholder="Type your answer here..." oninput="QuizzesModule.setAnswer(${q.id}, this.value)" style="width:100%; padding:8px;" />
                                    `}
                                </div>
                            </div>
                        `).join('')}

                        <div style="display:flex; gap:10px; margin-top:20px;">
                            <button type="button" class="btn" onclick="QuizzesModule.submitQuiz()">Submit Quiz</button>
                            <button type="button" class="btn secondary" onclick="QuizzesModule.closeQuiz()">Cancel</button>
                        </div>
                    </form>
                </div>
            `;
        } catch (err) {
            alert('Failed to start quiz: ' + err.message);
        }
    },

    setAnswer(questionId, value) {
        this.currentAnswers[questionId] = value;
    },

    async submitQuiz() {
        if (!this.currentQuiz) return;

        try {
            const res = await api(`/quizzes/${this.currentQuiz.id}/submit`, {
                method: 'POST',
                body: JSON.stringify({ answers: this.currentAnswers })
            });

            const container = document.getElementById('quiz_active_container');
            container.innerHTML = `
                <div class="card" style="border: 2px solid var(--pin-teal);">
                    <span class="eyebrow">// Quiz Results</span>
                    <h2 style="font-size:22px;">Score: ${res.score} / ${res.total_questions} (${res.percentage}%)</h2>
                    <p style="font-size:13px; color:var(--ink-soft); margin-bottom:16px;">
                        ${res.percentage >= 70 ? '🎉 Excellent performance! You have grasped the key concepts.' : '💡 Review the explanations below to reinforce difficult points.'}
                    </p>

                    <div class="quiz-review-list">
                        ${res.review.map((r, idx) => `
                            <div class="card" style="margin-bottom:10px; border-left: 4px solid ${r.is_correct ? 'var(--pin-teal)' : 'var(--pin-red)'};">
                                <p style="font-weight:600; margin-bottom:4px;">Q${idx + 1}. ${escapeHtml(r.question_text)}</p>
                                <p style="font-size:13px; color:${r.is_correct ? 'green' : 'var(--pin-red)'};">
                                    Your Answer: ${escapeHtml(r.user_answer || 'No answer submitted')} (${r.is_correct ? 'Correct' : 'Incorrect'})
                                </p>
                                ${!r.is_correct ? `<p style="font-size:13px; color:var(--ink);">Correct Answer: <strong>${escapeHtml(r.correct_answer)}</strong></p>` : ''}
                                ${r.explanation ? `<p style="font-size:12px; color:var(--ink-soft); margin-top:6px; background:#f9faf7; padding:8px; border-radius:4px;">💡 ${escapeHtml(r.explanation)}</p>` : ''}
                            </div>
                        `).join('')}
                    </div>

                    <div style="margin-top:16px; display:flex; gap:10px;">
                        <button class="btn" onclick="QuizzesModule.startQuiz(${this.currentQuiz.id})">Retry Quiz</button>
                        <button class="btn secondary" onclick="QuizzesModule.closeQuiz()">Done</button>
                    </div>
                </div>
            `;

            if (window.LearningHubModule) window.LearningHubModule.loadMetrics();
        } catch (err) {
            alert('Failed to submit quiz: ' + err.message);
        }
    },

    closeQuiz() {
        const container = document.getElementById('quiz_active_container');
        if (container) container.style.display = 'none';
        this.currentQuiz = null;
        this.currentAnswers = {};
    }
};
