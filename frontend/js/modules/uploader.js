/**
 * Feature Module 3: Document Upload and Management
 * Upload form with progress, validation, category selection, and instant library sync.
 * Also handles viewing, editing, and deleting the authenticated user's uploaded materials.
 */

window.UploaderModule = {
    init() {
        const form = document.getElementById('uploadMaterialForm');
        if (!form) return;

        form.addEventListener('submit', async (e) => {
            e.preventDefault();
            await this.handleUpload(form);
        });

        this.populateSubjectOptions();
        this.loadMyUploads();
    },

    async populateSubjectOptions() {
        const select = document.getElementById('up_course_id');
        if (!select) return;

        try {
            const courses = await api('/catalogue/courses');
            select.innerHTML = '<option value="">-- Link to Subject Catalogue (Optional) --</option>' +
                courses.map(c => `<option value="${c.id}" data-subject="${escapeHtml(c.course_name)}" data-domain="${escapeHtml(c.domain || '')}">${escapeHtml(c.course_code)}: ${escapeHtml(c.course_name)} (${escapeHtml(c.domain || '')})</option>`).join('');

            select.addEventListener('change', (e) => {
                const opt = select.options[select.selectedIndex];
                const subjInput = document.getElementById('up_subject_name');
                const domainSelect = document.getElementById('up_domain_select');
                if (opt && opt.dataset.subject && subjInput) {
                    subjInput.value = opt.dataset.subject;
                }
                if (opt && opt.dataset.domain && domainSelect) {
                    domainSelect.value = opt.dataset.domain;
                }
            });
        } catch (err) {
            console.error('Failed to populate courses for upload', err);
        }
    },

    async handleUpload(form) {
        const statusBox = document.getElementById('uploadStatus');
        const submitBtn = form.querySelector('button[type="submit"]');

        statusBox.style.display = 'block';
        statusBox.className = 'status-msg info';
        statusBox.textContent = 'Validating and uploading academic document...';
        submitBtn.disabled = true;

        const formData = new FormData(form);

        try {
            const res = await fetch(`${API}/materials/upload`, {
                method: 'POST',
                body: formData
            });

            const json = await res.json();
            if (!res.ok || json.status !== 'success') {
                throw new Error(json.message || 'Upload failed');
            }

            statusBox.className = 'status-msg success';
            statusBox.textContent = '✓ Document uploaded and indexed successfully in StudyMate Library!';
            form.reset();

            // Refresh materials in library & my uploads
            if (window.MaterialsModule) window.MaterialsModule.loadMaterials();
            await this.loadMyUploads();
            if (window.loadSharedNotes) window.loadSharedNotes();

            setTimeout(() => {
                statusBox.style.display = 'none';
            }, 3000);
        } catch (err) {
            statusBox.className = 'status-msg error';
            statusBox.textContent = 'Upload failed: ' + err.message;
        } finally {
            submitBtn.disabled = false;
        }
    },

    async loadMyUploads() {
        const container = document.getElementById('myUploadsList');
        if (!container) return;

        container.innerHTML = '<div class="empty-state">Loading your uploaded resources...</div>';
        try {
            const uploads = await api('/notes/my-uploads');

            if (!uploads.length) {
                container.innerHTML = '<div class="empty-state">You have not uploaded any study resources yet. Upload notes using the form above.</div>';
                return;
            }

            container.innerHTML = uploads.map(u => `
                <div class="card" style="margin-bottom:12px;">
                    <div style="display:flex; justify-content:space-between; align-items:flex-start;">
                        <div>
                            <span class="eyebrow">${escapeHtml(u.domain || 'Academic')} · ${escapeHtml(u.resource_type || 'Note')}</span>
                            <h3 style="font-size:16px; margin:4px 0 6px;">${escapeHtml(u.title)}</h3>
                            <p style="font-size:12px; color:var(--ink-soft); margin-bottom:8px;">
                                ${escapeHtml(u.subject_name || '')} · Uploaded on ${new Date(u.created_at).toLocaleDateString()}
                            </p>
                        </div>
                        <span class="pill">${escapeHtml(u.resource_type || 'Note')}</span>
                    </div>
                    <p style="font-size:13px; color:var(--ink); line-height:1.4; margin-bottom:10px;">
                        ${escapeHtml(u.description || 'No description.')}
                    </p>
                    <div style="display:flex; gap:8px; justify-content:flex-end; border-top:1px solid var(--line); padding-top:8px;">
                        <a href="/api/notes/download/${u.id}" class="btn small" target="_blank" download>Download</a>
                        <button class="btn small secondary" onclick="UploaderModule.editUpload(${u.id})">Edit</button>
                        <button class="btn small danger" onclick="UploaderModule.deleteUpload(${u.id})">Delete</button>
                    </div>
                </div>
            `).join('');
        } catch (err) {
            container.innerHTML = '<div class="empty-state">Could not load uploads.</div>';
        }
    },

    async editUpload(id) {
        const newTitle = prompt('Enter updated title:');
        if (!newTitle) return;
        const newDesc = prompt('Enter updated description (optional):');

        try {
            await api(`/notes/${id}`, {
                method: 'PUT',
                body: JSON.stringify({ title: newTitle, description: newDesc || '' })
            });
            alert('Upload updated successfully.');
            this.loadMyUploads();
            if (window.MaterialsModule) window.MaterialsModule.loadMaterials();
            if (window.loadSharedNotes) window.loadSharedNotes();
        } catch (err) {
            alert('Failed to update upload: ' + err.message);
        }
    },

    async deleteUpload(id) {
        if (!confirm('Are you sure you want to delete this resource? This action cannot be undone.')) return;
        try {
            await api(`/notes/${id}`, { method: 'DELETE' });
            alert('Resource deleted successfully.');
            this.loadMyUploads();
            if (window.MaterialsModule) window.MaterialsModule.loadMaterials();
            if (window.loadSharedNotes) window.loadSharedNotes();
        } catch (err) {
            alert('Failed to delete upload: ' + err.message);
        }
    }
};
