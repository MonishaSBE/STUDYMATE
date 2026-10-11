/**
 * Feature Module 3: Document Upload and Management
 * Upload form with progress, validation, category selection, and instant library sync.
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
    },

    async populateSubjectOptions() {
        const select = document.getElementById('up_course_id');
        if (!select) return;

        try {
            const depts = await api('/catalogue/institutions/1/departments');
            if (depts.length) {
                const courses = await api(`/catalogue/departments/${depts[0].id}/courses`);
                select.innerHTML = '<option value="">-- Link to Subject Catalogue (Optional) --</option>' +
                    courses.map(c => `<option value="${c.id}" data-subject="${escapeHtml(c.course_name)}">${escapeHtml(c.course_code)}: ${escapeHtml(c.course_name)} (Sem ${c.semester})</option>`).join('');

                select.addEventListener('change', (e) => {
                    const opt = select.options[select.selectedIndex];
                    const subjInput = document.getElementById('up_subject_name');
                    if (opt && opt.dataset.subject && subjInput) {
                        subjInput.value = opt.dataset.subject;
                    }
                });
            }
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

            // Refresh materials in library & learning hub
            if (window.MaterialsModule) window.MaterialsModule.loadMaterials();
            if (window.LearningHubModule) window.LearningHubModule.loadMetrics();

            // Switch to Library tab after brief notification
            setTimeout(() => {
                const libTab = document.querySelector('.tab[data-tab="library"]');
                if (libTab) libTab.click();
                statusBox.style.display = 'none';
            }, 1800);
        } catch (err) {
            statusBox.className = 'status-msg error';
            statusBox.textContent = 'Upload failed: ' + err.message;
        } finally {
            submitBtn.disabled = false;
        }
    }
};
