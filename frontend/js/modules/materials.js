/**
 * Feature Module 2 & 9: Study Material Library, Ratings, Bookmarks, and Preview
 */

window.MaterialsModule = {
    currentSearch: '',
    currentType: '',
    currentSort: 'newest',
    cachedMaterials: [],

    async init() {
        const searchInput = document.getElementById('mat_search_input');
        const typeFilter = document.getElementById('mat_type_filter');
        const sortSelect = document.getElementById('mat_sort_select');

        if (searchInput) {
            searchInput.addEventListener('input', (e) => {
                this.currentSearch = e.target.value.trim();
                this.loadMaterials();
            });
        }

        if (typeFilter) {
            typeFilter.addEventListener('change', (e) => {
                this.currentType = e.target.value;
                this.loadMaterials();
            });
        }

        if (sortSelect) {
            sortSelect.addEventListener('change', (e) => {
                this.currentSort = e.target.value;
                this.loadMaterials();
            });
        }

        await this.loadMaterials();
    },

    async loadMaterials() {
        const container = document.getElementById('materialsList');
        if (!container) return;

        container.innerHTML = '<div class="empty-state">Searching academic library...</div>';
        try {
            let query = `?sort=${this.currentSort}`;
            if (this.currentSearch) query += `&search=${encodeURIComponent(this.currentSearch)}`;
            if (this.currentType) query += `&resource_type=${encodeURIComponent(this.currentType)}`;

            const materials = await api(`/materials${query}`);
            this.cachedMaterials = materials;

            if (!materials.length) {
                container.innerHTML = '<div class="empty-state">No academic materials found matching your criteria. Be the first to upload one!</div>';
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
                        <span>📚 ${escapeHtml(m.subject_name)}</span>
                        <span>👤 ${escapeHtml(m.uploader_name || 'Student')}</span>
                        <span>⭐ ${m.average_rating > 0 ? m.average_rating + '/5 (' + m.total_ratings + ')' : 'No ratings yet'}</span>
                        <span>👁️ ${m.views_count || 1} views</span>
                    </div>

                    ${(m.tags || []).length ? `
                        <div style="margin-bottom:12px; display:flex; flex-wrap:wrap; gap:4px;">
                            ${m.tags.map(t => `<span class="pill tag-pill">${escapeHtml(t)}</span>`).join('')}
                        </div>
                    ` : ''}

                    <div class="material-action-row">
                        <button class="btn small teal" onclick="MaterialsModule.openPreview(${m.id})">Preview & Study</button>
                        <a href="/api/materials/${m.id}/download" class="btn small secondary" target="_blank" download>Download</a>
                        <button class="btn small" onclick="MaterialsModule.useInAiAssistant(${m.id})">Ask AI</button>
                    </div>
                </div>
            `).join('');
        } catch (err) {
            container.innerHTML = '<div class="empty-state">Failed to load study materials.</div>';
        }
    },

    async toggleBookmark(materialId) {
        try {
            const res = await api(`/materials/${materialId}/bookmark`, { method: 'POST' });
            await this.loadMaterials();
            if (window.LearningHubModule) window.LearningHubModule.loadMetrics();
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
            document.getElementById('modal_mat_subject').textContent = `${material.subject_name} · ${formatResourceType(material.resource_type)}`;
            document.getElementById('modal_mat_desc').textContent = material.description || 'No extended description available.';
            document.getElementById('modal_mat_uploader').textContent = `Uploaded by ${material.uploader_name || 'Student'} on ${new Date(material.created_at).toLocaleDateString()}`;
            document.getElementById('modal_mat_stats').textContent = `${material.views_count} views · ${material.downloads_count} downloads · Rating: ${material.average_rating}/5`;
            
            document.getElementById('modal_download_link').href = `/api/materials/${material.id}/download`;

            // Setup Rating button
            const rateBtn = document.getElementById('modal_rate_btn');
            rateBtn.onclick = () => MaterialsModule.rateMaterialPrompt(material.id);

            // Setup Report button
            const reportBtn = document.getElementById('modal_report_btn');
            reportBtn.onclick = () => MaterialsModule.reportMaterialPrompt(material.id);

            // Quick actions
            document.getElementById('modal_ai_btn').onclick = () => {
                modal.style.display = 'none';
                MaterialsModule.useInAiAssistant(material.id);
            };

            document.getElementById('modal_quiz_btn').onclick = () => {
                modal.style.display = 'none';
                QuizzesModule.generateFromMaterial(material.id);
            };

            document.getElementById('modal_flashcard_btn').onclick = () => {
                modal.style.display = 'none';
                FlashcardsModule.generateFromMaterial(material.id);
            };

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
        const review = prompt('Optional comments or review notes:', '') || '';
        try {
            await api(`/materials/${id}/rate`, {
                method: 'POST',
                body: JSON.stringify({ rating, review })
            });
            alert('Thank you for rating this resource!');
            this.openPreview(id);
            this.loadMaterials();
        } catch (err) {
            alert(err.message);
        }
    },

    async reportMaterialPrompt(id) {
        const reason = prompt('Please specify reason for reporting this material (e.g. Inappropriate content, copyright violation, inaccurate syllabus):');
        if (!reason) return;
        const details = prompt('Additional details (optional):') || '';
        try {
            await api(`/materials/${id}/report`, {
                method: 'POST',
                body: JSON.stringify({ reason, details })
            });
            alert('Report submitted for moderator review.');
        } catch (err) {
            alert(err.message);
        }
    },

    useInAiAssistant(materialId) {
        const aiTab = document.querySelector('.tab[data-tab="ai"]');
        if (aiTab) aiTab.click();

        const docSelect = document.getElementById('ai_doc_select');
        if (docSelect) {
            docSelect.value = String(materialId);
        }
    }
};

function formatResourceType(type) {
    if (!type) return 'Document';
    return type.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
}
