/*
 * Odyssey — Menu music controller (thin frontend wrapper).
 *
 * The actual audio is played by the Rust backend via rodio, so it is
 * completely immune to page navigations and browser autoplay policies.
 * This script just tells the backend whether to play, stop, or change
 * volume based on which page is currently loaded.
 *
 * Rules:
 *   - mainmenu.html / presets.html / infowiki.html → play
 *   - settings.html?from=mainmenu                   → play
 *   - settings.html (any other origin)              → stop
 *   - anywhere else (e.g. game.html)                → stop
 */
(function () {
    const STORAGE_VOL_KEY = 'jsonAdventure_menuMusicVolume';
    const DEFAULT_VOL_PCT = 35;

    function getVolume() {
        const raw = parseFloat(localStorage.getItem(STORAGE_VOL_KEY));
        const pct = Number.isNaN(raw) ? DEFAULT_VOL_PCT : raw;
        return Math.max(0, Math.min(1, pct / 100));
    }

    function currentPage() {
        return (window.location.pathname.split('/').pop() || '').toLowerCase();
    }

    function shouldPlay() {
        const page = currentPage();
        if (page === 'mainmenu.html' || page === 'presets.html' || page === 'infowiki.html') {
            return true;
        }
        if (page === 'settings.html') {
            const params = new URLSearchParams(window.location.search);
            return params.get('from') === 'mainmenu';
        }
        return false;
    }

    function getInvoke() {
        // Tauri v2 exposes invoke on window.__TAURI__.core.invoke.
        // Older surface (v1-ish) was window.__TAURI__.invoke — keep a fallback.
        const t = window.__TAURI__;
        if (!t) return null;
        if (t.core && typeof t.core.invoke === 'function') return t.core.invoke;
        if (typeof t.invoke === 'function') return t.invoke;
        return null;
    }

    function invokeCmd(name, args) {
        const invoke = getInvoke();
        if (!invoke) return Promise.resolve(); // non-Tauri context: silently no-op
        try {
            return invoke(name, args || {});
        } catch (e) {
            console.warn('[menu-music] invoke failed:', e);
            return Promise.resolve();
        }
    }

    function apply() {
        if (shouldPlay()) {
            invokeCmd('menu_music_play', { volume: getVolume() });
        } else {
            invokeCmd('menu_music_stop');
        }
    }

    // Public helper used by the settings volume slider.
    window.setMenuMusicVolume = function (pct) {
        const vol = Math.max(0, Math.min(1, Number(pct) / 100));
        if (Number.isNaN(vol)) return;
        invokeCmd('menu_music_set_volume', { volume: vol });
    };

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', apply);
    } else {
        apply();
    }
})();
