/**
 * Application Window Zoom Controller
 * Ensures default standard 100% window scale while empowering users
 * to zoom out (down to 70%) or zoom in (up to 150%) smoothly.
 * Persists user's zoom preference in localStorage across pages and sessions.
 */

(function () {
    const MIN_ZOOM = 0.7;   // 70%
    const MAX_ZOOM = 1.5;   // 150%
    const STEP = 0.1;       // 10% steps
    const DEFAULT_ZOOM = 1.0;

    function getSavedZoom() {
        try {
            const saved = localStorage.getItem('studymate_zoom_level');
            if (saved) {
                const val = parseFloat(saved);
                if (!isNaN(val) && val >= MIN_ZOOM && val <= MAX_ZOOM) return val;
            }
        } catch (e) {}
        return DEFAULT_ZOOM;
    }

    let currentZoom = getSavedZoom();

    function applyZoom(zoom) {
        currentZoom = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, Math.round(zoom * 10) / 10));
        try {
            localStorage.setItem('studymate_zoom_level', currentZoom);
        } catch (e) {}

        // Apply via modern CSS zoom or transform fallback
        if ('zoom' in document.body.style) {
            document.body.style.zoom = currentZoom;
        } else {
            document.body.style.transform = `scale(${currentZoom})`;
            document.body.style.transformOrigin = 'top center';
        }

        // Update all zoom percentage indicators on the page
        document.querySelectorAll('.zoom-level-label').forEach(el => {
            el.textContent = `${Math.round(currentZoom * 100)}%`;
            el.title = 'Click to reset to default 100%';
        });
    }

    window.StudyMateZoom = {
        zoomIn() {
            applyZoom(currentZoom + STEP);
        },
        zoomOut() {
            applyZoom(currentZoom - STEP);
        },
        resetZoom() {
            applyZoom(DEFAULT_ZOOM);
        },
        getZoom() {
            return currentZoom;
        }
    };

    // Apply on DOM ready
    document.addEventListener('DOMContentLoaded', () => {
        applyZoom(currentZoom);

        // Bind keyboard shortcuts: Ctrl/Cmd + Plus, Minus, Zero
        window.addEventListener('keydown', (e) => {
            if ((e.ctrlKey || e.metaKey) && (e.key === '=' || e.key === '+')) {
                e.preventDefault();
                window.StudyMateZoom.zoomIn();
            } else if ((e.ctrlKey || e.metaKey) && e.key === '-') {
                e.preventDefault();
                window.StudyMateZoom.zoomOut();
            } else if ((e.ctrlKey || e.metaKey) && e.key === '0') {
                e.preventDefault();
                window.StudyMateZoom.resetZoom();
            }
        });
    });
})();
