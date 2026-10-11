/**
 * Feature Module 2 & 9: Study Material Library, Open Educational Textbooks, Ratings, and Bookmarks
 */

window.MaterialsModule = {
    currentSearch: '',
    currentDomain: '',
    currentType: '',
    currentSort: 'newest',
    cachedMaterials: [],
    cachedBooks: [],

    async init() {
        const searchInput = document.getElementById('mat_search_input');
        const domainFilter = document.getElementById('mat_domain_filter');
        const typeFilter = document.getElementById('mat_type_filter');

        if (searchInput) {
            searchInput.addEventListener('input', (e) => {
                this.currentSearch = e.target.value.trim();
                this.loadMaterials();
                this.loadBooks();
            });
        }

        if (domainFilter) {
            domainFilter.addEventListener('change', (e) => {
                this.currentDomain = e.target.value;
                this.loadMaterials();
                this.loadBooks();
            });
        }

        if (typeFilter) {
            typeFilter.addEventListener('change', (e) => {
                this.currentType = e.target.value;
                this.loadMaterials();
                this.loadBooks();
            });
        }

        await this.loadBooks();
        await this.loadMaterials();
    },

    async loadBooks() {
        const container = document.getElementById('libraryBooksList');
        if (!container) return;

        container.innerHTML = '<div class="empty-state">Loading educational textbooks...</div>';
        try {
            let query = '?';
            if (this.currentSearch) query += `&search=${encodeURIComponent(this.currentSearch)}`;
            if (this.currentDomain) query += `&domain=${encodeURIComponent(this.currentDomain)}`;

            const books = await api(`/materials/books${query}`);
            this.cachedBooks = books;

            if (!books.length) {
                container.innerHTML = '<div class="empty-state">No library books match your query.</div>';
                return;
            }

            container.innerHTML = books.map(b => `
                <div class="card material-item-card" style="display:flex; flex-direction:column; justify-content:space-between;">
                    <div>
                        <div style="display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:6px;">
                            <span class="pill" style="background:#e8f0fe; color:#1967d2;">📖 ${escapeHtml(b.category || 'Textbook')}</span>
                            <span class="pill accepted" style="font-size:11px;">${escapeHtml(b.license || 'Open Access')}</span>
                        </div>

                        <h3 style="font-size:16px; margin:6px 0;">${escapeHtml(b.title)}</h3>
                        <p style="font-size:12px; color:var(--ink-soft); margin-bottom:8px;">
                            <strong>Author:</strong> ${escapeHtml(b.author || 'Academic Authors')} ${b.publication_year ? `(${b.publication_year})` : ''}
                        </p>
                        <p style="font-size:13px; color:var(--ink); line-height:1.4; margin-bottom:12px;">
                            ${escapeHtml(b.description || '')}
                        </p>
                    </div>

                    <div style="border-top:1px solid var(--line); padding-top:10px; display:flex; justify-content:space-between; align-items:center;">
                        <span style="font-size:11px; color:var(--ink-soft);">${escapeHtml(b.publisher || 'Open Publishing')}</span>
                        ${b.access_url ? `
                            <a href="${escapeHtml(b.access_url)}" target="_blank" rel="noopener noreferrer" class="btn small teal">Access Resource ↗</a>
                        ` : '<span style="font-size:12px; color:var(--ink-soft);">In Library</span>'}
                    </div>
                </div>
            `).join('');
        } catch (err) {
            container.innerHTML = '<div class="empty-state">Could not load library books.</div>';
        }
    },

    async loadMaterials() {
        const container = document.getElementById('materialsList');
        if (!container) return;

        container.innerHTML = '<div class="empty-state">Searching academic library...</div>';
        try {
            let query = `?sort=${this.currentSort}`;
            if (this.currentSearch) query += `&search=${encodeURIComponent(this.currentSearch)}`;
            if (this.currentDomain) query += `&domain=${encodeURIComponent(this.currentDomain)}`;
            if (this.currentType && this.currentType !== 'textbook') query += `&resource_type=${encodeURIComponent(this.currentType)}`;

            const materials = await api(`/materials${query}`);
            this.cachedMaterials = materials;

            if (!materials.length) {
                container.innerHTML = '<div class="empty-state">No academic notes found matching criteria.</div>';
                return;
            }

            container.innerHTML = materials.map(m => `
                <div class="card material-item-card">
                    <div style="display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:6px;">
                        <span class="pill ${m.resource_type}">${formatResourceType(m.resource_type)}</span>
                        <button class="bookmark-btn ${m.is_bookmarked ? 'active' : ''}" onclick="MaterialsModule.toggleBookmark(${m.id})">
                            ${m.is_bookmarked ? '★ Bookmarked' : '☆ Bookmark'}
                        </button>
                    </div>

                    <h3 style="font-size:16px; margin:6px 0;" onclick="MaterialsModule.openPreview(${m.id})" class="clickable-title">
                        ${escapeHtml(m.title)}
                    </h3>
                    <p style="font-size:13px; color:var(--ink-soft); line-height:1.4; margin-bottom:10px;">
                        ${escapeHtml(m.description || 'No description provided.')}
                    </p>

                    <div style="font-size:12px; color:var(--ink-soft); margin-bottom:10px; display:flex; flex-wrap:wrap; gap:8px;">
                        <span>📚 ${escapeHtml(m.subject_name || m.domain || '')}</span>
                        <span>👤 ${escapeHtml(m.uploader_name || 'Student')}</span>
                        <span>⭐ ${m.average_rating > 0 ? m.average_rating + '/5' : 'No ratings'}</span>
                        <span>👁️ ${m.views_count || 1} views</span>
                    </div>

                    <div class="material-action-row" style="display:flex; gap:8px;">
                        <button class="btn small teal" onclick="MaterialsModule.openPreview(${m.id})">Preview & Study</button>
                        <a href="/api/materials/${m.id}/download" class="btn small secondary" target="_blank" download>Download</a>
                    </div>
                </div>
            `).join('');
        } catch (err) {
            container.innerHTML = '<div class="empty-state">Failed to load study materials.</div>';
        }
    },

    async toggleBookmark(materialId) {
        try {
            await api(`/materials/${materialId}/bookmark`, { method: 'POST' });
            await this.loadMaterials();
        } catch (err) {
            alert('Failed to update bookmark: ' + err.message);
        }
    },

    async openPreview(materialId) {
        try {
            const material = await api(`/materials/${materialId}`);
            const modal = document.getElementById('materialModal');
            if (!modal) return;

            document.getElementById('modal_mat_title').textContent = material.title;
            document.getElementById('modal_mat_subject').textContent = `${material.subject_name || material.domain || ''} · ${formatResourceType(material.resource_type)}`;
            document.getElementById('modal_mat_desc').textContent = material.description || 'No extended description available.';
            document.getElementById('modal_mat_uploader').textContent = `Uploaded by ${material.uploader_name || 'Student'} on ${new Date(material.created_at).toLocaleDateString()}`;
            document.getElementById('modal_mat_stats').textContent = `${material.views_count} views · ${material.downloads_count} downloads · Rating: ${material.average_rating}/5`;
            
            document.getElementById('modal_download_link').href = `/api/materials/${material.id}/download`;

            // Setup Rating button
            const rateBtn = document.getElementById('modal_rate_btn');
            if (rateBtn) rateBtn.onclick = () => MaterialsModule.rateMaterialPrompt(material.id);

            // Setup Report button
            const reportBtn = document.getElementById('modal_report_btn');
            if (reportBtn) reportBtn.onclick = () => MaterialsModule.reportMaterialPrompt(material.id);

            // Quick actions
            const quizBtn = document.getElementById('modal_quiz_btn');
            if (quizBtn) {
                quizBtn.onclick = () => {
                    modal.style.display = 'none';
                    if (window.QuizzesModule) window.QuizzesModule.generateFromMaterial(material.id);
                };
            }

            const fcBtn = document.getElementById('modal_flashcard_btn');
            if (fcBtn) {
                fcBtn.onclick = () => {
                    modal.style.display = 'none';
                    if (window.FlashcardsModule) window.FlashcardsModule.generateFromMaterial(material.id);
                };
            }

            modal.style.display = 'flex';
        } catch (err) {
            alert('Could not load material details: ' + err.message);
        }
    },

    async rateMaterialPrompt(id) {
        const ratingStr = prompt('Rate this academic resource (1 to 5 stars):', '5');
        if (!ratingStr) return;
        const rating = Number(ratingStr);
        if (isNaN(rating) || rating < 1 || rating > 5) {
            alert('Please enter a valid rating between 1 and 5.');
            return;
        }
        try {
            await api(`/materials/${id}/rate`, { method: 'POST', body: JSON.stringify({ rating }) });
            alert('Rating submitted. Thank you!');
            this.openPreview(id);
        } catch (err) {
            alert('Failed to rate: ' + err.message);
        }
    },

    async reportMaterialPrompt(id) {
        const reason = prompt('Please explain the issue (e.g. incorrect syllabus, copyright, illegible):');
        if (!reason) return;
        try {
            await api(`/materials/${id}/report`, { method: 'POST', body: JSON.stringify({ reason }) });
            alert('Report submitted for admin review.');
        } catch (err) {
            alert('Failed to submit report: ' + err.message);
        }
    }
};

function formatResourceType(type) {
    const map = {
        lecture_notes: 'Lecture Notes',
        question_bank: 'Question Bank',
        previous_exam: 'Previous Exam Paper',
        revision_sheet: 'Revision Sheet',
        subject_summary: 'Subject Summary',
        lab_record: 'Lab Record',
        study_guide: 'Study Guide',
        textbook: 'Textbook'
    };
    return map[type] || 'Study Note';
}
