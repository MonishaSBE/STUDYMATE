/**
 * Feature Module 1: University and Course Discovery
 * Allows students to browse institutions, departments, semesters, and course subjects
 * with direct linkages to library materials.
 */

window.CatalogueModule = {
    selectedInstitutionId: 1,
    selectedDeptId: null,
    selectedSemester: null,

    async init() {
        const instSelect = document.getElementById('cat_institution_select');
        const deptSelect = document.getElementById('cat_dept_select');
        const semSelect = document.getElementById('cat_sem_select');

        if (!instSelect) return;

        try {
            const insts = await api('/catalogue/institutions');
            instSelect.innerHTML = insts.map(i => `<option value="${i.id}">${escapeHtml(i.name)} (${escapeHtml(i.code)})</option>`).join('');
            this.selectedInstitutionId = insts[0]?.id || 1;

            await this.loadDepartments(this.selectedInstitutionId);

            instSelect.addEventListener('change', async (e) => {
                this.selectedInstitutionId = Number(e.target.value);
                await this.loadDepartments(this.selectedInstitutionId);
            });

            deptSelect.addEventListener('change', async (e) => {
                this.selectedDeptId = Number(e.target.value);
                await this.loadCourses();
            });

            semSelect.addEventListener('change', async (e) => {
                this.selectedSemester = e.target.value ? Number(e.target.value) : null;
                await this.loadCourses();
            });
        } catch (err) {
            console.error('Catalogue init error:', err);
        }
    },

    async loadDepartments(instId) {
        const deptSelect = document.getElementById('cat_dept_select');
        try {
            const depts = await api(`/catalogue/institutions/${instId}/departments`);
            deptSelect.innerHTML = depts.map(d => `<option value="${d.id}">${escapeHtml(d.name)}</option>`).join('');
            this.selectedDeptId = depts[0]?.id || null;
            await this.loadCourses();
        } catch (err) {
            console.error('Failed to load departments', err);
        }
    },

    async loadCourses() {
        const container = document.getElementById('cat_courses_container');
        if (!this.selectedDeptId) {
            container.innerHTML = '<div class="empty-state">Select a department to view courses.</div>';
            return;
        }

        container.innerHTML = '<div class="empty-state">Loading courses...</div>';
        try {
            let path = `/catalogue/departments/${this.selectedDeptId}/courses`;
            if (this.selectedSemester) {
                path += `?semester=${this.selectedSemester}`;
            }
            const courses = await api(path);

            if (!courses.length) {
                container.innerHTML = '<div class="empty-state">No subjects found for this semester.</div>';
                return;
            }

            container.innerHTML = courses.map(c => `
                <div class="card course-card" onclick="CatalogueModule.openCourseDetail(${c.id})">
                    <span class="eyebrow">${escapeHtml(c.course_code)} · Semester ${c.semester}</span>
                    <h3 style="font-size:16px; margin:4px 0 8px;">${escapeHtml(c.course_name)}</h3>
                    <p style="font-size:12px; color:var(--ink-soft); margin-bottom:12px;">${escapeHtml(c.academic_year || '')}</p>
                    <div style="display:flex; justify-content:space-between; align-items:center;">
                        <span class="pill" style="font-size:11px;">View Resources</span>
                        <span style="font-size:12px; color:var(--pin-teal);">Explore →</span>
                    </div>
                </div>
            `).join('');
        } catch (err) {
            container.innerHTML = '<div class="empty-state">Failed to load courses.</div>';
        }
    },

    async openCourseDetail(courseId) {
        try {
            const data = await api(`/catalogue/courses/${courseId}`);
            const { course, materials } = data;

            // Switch to Study Materials tab and filter by this course
            const matTab = document.querySelector('.tab[data-tab="library"]');
            if (matTab) matTab.click();

            const searchInput = document.getElementById('mat_search_input');
            if (searchInput) {
                searchInput.value = course.course_name;
                MaterialsModule.currentSearch = course.course_name;
                MaterialsModule.loadMaterials();
            }
        } catch (err) {
            alert('Failed to open subject resources: ' + err.message);
        }
    }
};
