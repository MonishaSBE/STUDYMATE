/**
 * Feature Module 10: Personal Study Dashboard (Learning Hub)
 * Aggregates study progress, recently viewed/saved documents, uploaded materials,
 * quiz attempts, flashcard deck mastery, and community contributions.
 */

window.LearningHubModule = {
    async init() {
        await this.loadMetrics();
    },

    async loadMetrics() {
        const statsContainer = document.getElementById('hub_stats_grid');
        const savedContainer = document.getElementById('hub_saved_materials');
        const uploadsContainer = document.getElementById('hub_uploaded_materials');
        const quizzesContainer = document.getElementById('hub_quiz_history');

        if (!statsContainer) return;

        try {
            const data = await api('/hub/metrics');
            const { stats, uploaded_materials, saved_materials, recent_quiz_attempts } = data;

            statsContainer.innerHTML = `
                <div class="card stat-card">
                    <span class="stat-num">${stats.materials_uploaded}</span>
                    <span class="stat-label">Uploaded Notes</span>
                </div>
                <div class="card stat-card">
                    <span class="stat-num">${stats.bookmarks_count}</span>
                    <span class="stat-label">Saved Documents</span>
                </div>
                <div class="card stat-card">
                    <span class="stat-num">${stats.quizzes_completed}</span>
                    <span class="stat-label">Quizzes Completed</span>
                </div>
                <div class="card stat-card">
                    <span class="stat-num">${stats.cards_mastered}</span>
                    <span class="stat-label">Cards Mastered</span>
                </div>
            `;

            // Saved Materials List
            if (savedContainer) {
                savedContainer.innerHTML = saved_materials.length ? saved_materials.map(m => `
                    <div class="card" style="margin-bottom:8px; display:flex; justify-content:space-between; align-items:center;">
                        <div>
                            <strong>${escapeHtml(m.title)}</strong>
                            <p style="font-size:12px; color:var(--ink-soft);">${escapeHtml(m.subject_name)} · ${escapeHtml(m.resource_type)}</p>
                        </div>
                        <button class="btn small teal" onclick="MaterialsModule.openPreview(${m.id})">Study</button>
                    </div>
                `).join('') : '<div class="empty-state">No saved materials yet. Bookmark documents in the library to access them quickly here.</div>';
            }

            // Uploaded Materials List
            if (uploadsContainer) {
                uploadsContainer.innerHTML = uploaded_materials.length ? uploaded_materials.map(m => `
                    <div class="card" style="margin-bottom:8px; display:flex; justify-content:space-between; align-items:center;">
                        <div>
                            <strong>${escapeHtml(m.title)}</strong>
                            <p style="font-size:12px; color:var(--ink-soft);">${m.views_count} views · ${m.downloads_count} downloads · ${new Date(m.created_at).toLocaleDateString()}</p>
                        </div>
                        <div style="display:flex; gap:6px;">
                            <button class="btn small teal" onclick="MaterialsModule.openPreview(${m.id})">View</button>
                            <button class="btn small danger" onclick="LearningHubModule.deleteUploaded(${m.id})">Delete</button>
                        </div>
                    </div>
                `).join('') : '<div class="empty-state">You have not uploaded any study documents yet.</div>';
            }

            // Recent Quiz History
            if (quizzesContainer) {
                quizzesContainer.innerHTML = recent_quiz_attempts.length ? recent_quiz_attempts.map(a => `
                    <div class="card" style="margin-bottom:8px; display:flex; justify-content:space-between; align-items:center;">
                        <div>
                            <strong>${escapeHtml(a.quiz_title || 'Assessment')}</strong>
                            <p style="font-size:12px; color:var(--ink-soft);">${new Date(a.attempted_at).toLocaleDateString()}</p>
                        </div>
                        <span class="pill ${a.percentage >= 70 ? 'accepted' : ''}">${a.score} / ${a.total_questions} (${a.percentage}%)</span>
                    </div>
                `).join('') : '<div class="empty-state">No quiz attempts recorded yet.</div>';
            }
        } catch (err) {
            console.error('Failed to load learning hub metrics', err);
        }
    },

    async deleteUploaded(materialId) {
        if (!confirm('Are you sure you want to delete this uploaded document?')) return;
        try {
            await api(`/materials/${materialId}`, { method: 'DELETE' });
            this.loadMetrics();
            if (window.MaterialsModule) window.MaterialsModule.loadMaterials();
        } catch (err) {
            alert('Delete failed: ' + err.message);
        }
    }
};
