/**
 * Feature Module 1: Multi-Domain Course Discovery
 * Allows students to browse courses across domains, departments, and academic levels
 * with direct linkages to library materials, quizzes, and flashcards.
 */

window.CatalogueModule = {
    currentSearch: '',
    selectedDomain: '',
    selectedLevel: '',

    async init() {
        const domainSelect = document.getElementById('cat_domain_select');
        const levelSelect = document.getElementById('cat_level_select');
        const searchInput = document.getElementById('cat_search_input');

        try {
            // Load domains into catalogue domain filter and shared notes domain filter
            const domains = await api('/catalogue/domains');
            if (domainSelect) {
                domainSelect.innerHTML = '<option value="">All Domains</option>' + 
                    domains.map(d => `<option value="${escapeHtml(d.domain_name)}">${escapeHtml(d.domain_name)}</option>`).join('');
                
                domainSelect.addEventListener('change', (e) => {
                    this.selectedDomain = e.target.value;
                    this.loadCourses();
                });
            }

            const sharedNotesDomain = document.getElementById('sharedNotesDomainFilter');
            if (sharedNotesDomain) {
                sharedNotesDomain.innerHTML = '<option value="">All Domains</option>' + 
                    domains.map(d => `<option value="${escapeHtml(d.domain_name)}">${escapeHtml(d.domain_name)}</option>`).join('');
            }

            const libraryDomainFilter = document.getElementById('mat_domain_filter');
            if (libraryDomainFilter) {
                libraryDomainFilter.innerHTML = '<option value="">All Domains</option>' + 
                    domains.map(d => `<option value="${escapeHtml(d.domain_name)}">${escapeHtml(d.domain_name)}</option>`).join('');
            }

            // Populate upload note course dropdown
            const upCourseSelect = document.getElementById('up_course_id');
            const allCourses = await api('/catalogue/courses');
            if (upCourseSelect) {
                upCourseSelect.innerHTML = '<option value="">Select Associated Course (Optional)</option>' + 
                    allCourses.map(c => `<option value="${c.id}">${escapeHtml(c.course_code)} - ${escapeHtml(c.course_name)} (${escapeHtml(c.domain || '')})</option>`).join('');
            }

            if (levelSelect) {
                levelSelect.addEventListener('change', (e) => {
                    this.selectedLevel = e.target.value;
                    this.loadCourses();
                });
            }

            if (searchInput) {
                searchInput.addEventListener('input', (e) => {
                    this.currentSearch = e.target.value.trim();
                    this.loadCourses();
                });
            }

            await this.loadCourses();
        } catch (err) {
            console.error('Catalogue init error:', err);
        }
    },

    async loadCourses() {
        const container = document.getElementById('cat_courses_container');
        if (!container) return;

        container.innerHTML = '<div class="empty-state">Loading courses...</div>';
        try {
            let path = '/catalogue/courses?';
            if (this.currentSearch) path += `&search=${encodeURIComponent(this.currentSearch)}`;
            if (this.selectedDomain) path += `&domain=${encodeURIComponent(this.selectedDomain)}`;
            if (this.selectedLevel) path += `&academic_level=${encodeURIComponent(this.selectedLevel)}`;

            const courses = await api(path);

            if (!courses.length) {
                container.innerHTML = '<div class="empty-state">No courses found matching criteria. Adjust filters or search terms.</div>';
                return;
            }

            container.innerHTML = courses.map(c => `
                <div class="card course-card" onclick="CatalogueModule.openCourseDetail(${c.id})" style="cursor:pointer;">
                    <div style="display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:6px;">
                        <span class="eyebrow">${escapeHtml(c.course_code || 'GEN')} · ${escapeHtml(c.academic_level || 'Undergraduate')}</span>
                        <span class="pill">${escapeHtml(c.domain || 'Engineering')}</span>
                    </div>
                    <h3 style="font-size:16px; margin:4px 0 8px;">${escapeHtml(c.course_name)}</h3>
                    <p style="font-size:13px; color:var(--ink-soft); line-height:1.4; margin-bottom:12px;">
                        ${escapeHtml(c.description || 'Comprehensive curriculum modules, core concepts, and associated study resources.')}
                    </p>
                    <div style="display:flex; justify-content:space-between; align-items:center; font-size:12px; color:var(--ink-soft); border-top:1px solid var(--line); padding-top:8px;">
                        <span>📚 ${c.resource_count || 0} Resources</span>
                        <span style="color:var(--pin-teal); font-weight:600;">View Curriculum →</span>
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
                if (window.MaterialsModule) {
                    window.MaterialsModule.currentSearch = course.course_name;
                    window.MaterialsModule.loadMaterials();
                    window.MaterialsModule.loadBooks();
                }
            }
        } catch (err) {
            console.error('Failed to open course detail', err);
        }
    }
};
