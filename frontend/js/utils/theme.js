/**
 * Application Theme Manager
 * Allows students to choose from diverse themes:
 * - default: Chalkboard & Noticeboard (Classic campus aesthetic)
 * - dark: Dark Mode (High-contrast night study mode)
 * - midnight: Midnight Blue (Sleek deep-space navy)
 * - sepia: Warm Reading Room (Warm paper tone for long study sessions)
 * - forest: Emerald Green (Calm nature focus)
 * - lavender: Soft Violet (Creative twilight focus)
 *
 * Persists user preference in localStorage across the entire platform.
 */

(function () {
    const THEMES = [
        { id: 'default', name: 'Campus Classic', colors: ['#1c2b3a', '#eef1ea', '#f2b705'] },
        { id: 'dark', name: 'Dark Mode', colors: ['#0d1117', '#161b22', '#3fb950'] },
        { id: 'midnight', name: 'Midnight Blue', colors: ['#0a0f1d', '#111827', '#38bdf8'] },
        { id: 'sepia', name: 'Warm Sepia', colors: ['#2b1f1d', '#f4ecd8', '#d97706'] },
        { id: 'forest', name: 'Emerald Forest', colors: ['#0c281e', '#eef7f2', '#10b981'] },
        { id: 'lavender', name: 'Lavender Focus', colors: ['#1e1b4b', '#f5f3ff', '#8b5cf6'] }
    ];

    const STORAGE_KEY = 'studymate_app_theme';

    function getSavedTheme() {
        try {
            return localStorage.getItem(STORAGE_KEY) || 'default';
        } catch (e) {
            return 'default';
        }
    }

    function applyTheme(themeId) {
        const theme = THEMES.find(t => t.id === themeId) ? themeId : 'default';
        document.documentElement.setAttribute('data-theme', theme);
        try {
            localStorage.setItem(STORAGE_KEY, theme);
        } catch (e) {}

        // Update active status in any open theme modals
        document.querySelectorAll('.theme-card-option').forEach(el => {
            el.classList.toggle('active', el.dataset.theme === theme);
        });

        // Update theme button text or icon if present
        document.querySelectorAll('.theme-current-name').forEach(el => {
            const current = THEMES.find(t => t.id === theme);
            el.textContent = current ? current.name : 'Theme';
        });
    }

    window.StudyMateTheme = {
        getThemes() {
            return THEMES;
        },
        getCurrentTheme() {
            return getSavedTheme();
        },
        setTheme(themeId) {
            applyTheme(themeId);
        },
        openThemeModal() {
            let modal = document.getElementById('themeModal');
            if (!modal) {
                modal = document.createElement('div');
                modal.id = 'themeModal';
                modal.className = 'modal-overlay';
                modal.innerHTML = `
                    <div class="modal-card" style="max-width: 480px;">
                        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:12px;">
                            <div>
                                <span class="eyebrow">// appearance</span>
                                <h2 style="font-size:18px; margin:0;">Customize Study Theme</h2>
                            </div>
                            <button class="modal-close-btn" onclick="StudyMateTheme.closeThemeModal()">×</button>
                        </div>
                        <p style="font-size:13px; color:var(--ink-soft); margin-top:-4px; margin-bottom:14px;">
                            Select a visual theme tailored for day study, night focus, or relaxed reading.
                        </p>
                        <div class="theme-palette-grid" id="themeGridContainer"></div>
                        <div style="margin-top:20px; text-align:right;">
                            <button class="btn small" onclick="StudyMateTheme.closeThemeModal()">Done</button>
                        </div>
                    </div>
                `;
                document.body.appendChild(modal);

                const container = modal.querySelector('#themeGridContainer');
                const cur = getSavedTheme();
                container.innerHTML = THEMES.map(t => `
                    <div class="theme-card-option ${t.id === cur ? 'active' : ''}" data-theme="${t.id}" onclick="StudyMateTheme.setTheme('${t.id}')">
                        <div class="theme-color-preview">
                            <span style="background:${t.colors[0]};"></span>
                            <span style="background:${t.colors[1]};"></span>
                            <span style="background:${t.colors[2]};"></span>
                        </div>
                        <div class="theme-name-label">${t.name}</div>
                    </div>
                `).join('');
            }
            modal.style.display = 'flex';
        },
        closeThemeModal() {
            const modal = document.getElementById('themeModal');
            if (modal) modal.style.display = 'none';
        }
    };

    // Apply theme immediately to prevent screen flash
    applyTheme(getSavedTheme());

    document.addEventListener('DOMContentLoaded', () => {
        applyTheme(getSavedTheme());
    });
})();
