// Theme-aware replacement for UI emoji glyphs.
// Native color emoji are rendered by the OS and cannot be recolored with CSS.
// This swaps common UI emoji with currentColor SVGs so theme variables control them.
(function () {
    const SVG_NS = 'http://www.w3.org/2000/svg';

    const iconPaths = {
        ai: '<path d="M12 3l1.7 5.1L19 10l-5.3 1.9L12 17l-1.7-5.1L5 10l5.3-1.9L12 3z"/><path d="M19 3l.8 2.2L22 6l-2.2.8L19 9l-.8-2.2L16 6l2.2-.8L19 3z"/><path d="M5 15l.9 2.6L8.5 18l-2.6.9L5 21l-.9-2.1L1.5 18l2.6-.4L5 15z"/>',
        chart: '<path d="M4 19V5"/><path d="M4 19h16"/><path d="M8 16v-5"/><path d="M12 16V8"/><path d="M16 16v-3"/>',
        check: '<path d="M20 6 9 17l-5-5"/>',
        clipboard: '<path d="M9 4h6"/><path d="M9 4a3 3 0 0 1 6 0"/><path d="M9 5H7a2 2 0 0 0-2 2v11a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-2"/><path d="M9 9h6"/><path d="M9 13h6"/><path d="M9 17h3"/>',
        dice: '<rect x="4" y="4" width="16" height="16" rx="3"/><circle cx="8.5" cy="8.5" r=".8"/><circle cx="15.5" cy="8.5" r=".8"/><circle cx="12" cy="12" r=".8"/><circle cx="8.5" cy="15.5" r=".8"/><circle cx="15.5" cy="15.5" r=".8"/>',
        download: '<path d="M12 3v10"/><path d="m7 9 5 5 5-5"/><path d="M5 19h14"/>',
        edit: '<path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4 12.5-12.5z"/>',
        gamepad: '<path d="M6.5 10h11a4.5 4.5 0 0 1 4.2 6.1l-.7 1.9a2.5 2.5 0 0 1-4.1.9l-1.8-1.9H8.9l-1.8 1.9a2.5 2.5 0 0 1-4.1-.9l-.7-1.9A4.5 4.5 0 0 1 6.5 10z"/><path d="M8 13v4"/><path d="M6 15h4"/><circle cx="16.5" cy="14" r=".8"/><circle cx="19" cy="16" r=".8"/>',
        globe: '<circle cx="12" cy="12" r="9"/><path d="M3 12h18"/><path d="M12 3a14 14 0 0 1 0 18"/><path d="M12 3a14 14 0 0 0 0 18"/>',
        home: '<path d="M3 11 12 4l9 7"/><path d="M5 10v10h14V10"/><path d="M9 20v-6h6v6"/>',
        hourglass: '<path d="M6 3h12"/><path d="M6 21h12"/><path d="M7 3c0 5 10 5 10 10s-10 5-10 8"/><path d="M17 3c0 3-10 5-10 10s10 5 10 8"/>',
        image: '<rect x="3" y="5" width="18" height="14" rx="2"/><circle cx="8" cy="10" r="1.5"/><path d="m21 15-5-5L5 19"/>',
        pen: '<path d="M12 20h9"/><path d="M16 4l4 4L8 20H4v-4L16 4z"/>',
        play: '<path d="M8 5v14l11-7-11-7z" fill="currentColor" stroke="none"/>',
        refresh: '<path d="M20 12a8 8 0 1 1-2.3-5.7"/><path d="M20 4v6h-6"/>',
        rocket: '<path d="M5 15c-1.5 1-2 3-2 6 3 0 5-1 6-2"/><path d="M9 15 5 11l4-4c3-3 7-4 12-4 0 5-1 9-4 12l-4 4-4-4z"/><path d="M14 8h.01"/><path d="M7 17l-3 3"/>',
        scroll: '<path d="M8 4h11v14a3 3 0 0 1-3 3H7"/><path d="M8 4a3 3 0 0 0-3 3v13a2 2 0 1 0 4 0V7a3 3 0 0 0-3-3"/><path d="M11 8h5"/><path d="M11 12h5"/>',
        settings: '<path d="M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8z"/><path d="M4.9 9.1l1.3-.8.6-1.5-.4-1.5 1.8-1 1.2 1 1.6-.2L12 3h2l.7 1.4 1.6.4 1.3-.8 1.4 1.4-.8 1.3.6 1.5 1.4.8v2l-1.4.8-.6 1.5.8 1.3-1.4 1.4-1.3-.8-1.6.4L14 21h-2l-.7-1.4-1.6-.4-1.3.8-1.4-1.4.8-1.3-.6-1.5-1.4-.8v-2z"/>',
        speaker: '<path d="M4 10v4h4l5 4V6l-5 4H4z"/><path d="M16 9a5 5 0 0 1 0 6"/><path d="M18.5 6.5a8.5 8.5 0 0 1 0 11"/>',
        sword: '<path d="M14.5 4.5 20 3l-1.5 5.5L8 19l-3-3L14.5 4.5z"/><path d="m7 15 2 2"/><path d="M3 21l4-4"/>',
        target: '<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1"/>',
        trash: '<path d="M4 7h16"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M6 7l1 14h10l1-14"/><path d="M9 7V4h6v3"/>',
        user: '<circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/>',
        warning: '<path d="M12 3 2 21h20L12 3z"/><path d="M12 9v5"/><path d="M12 17h.01"/>',
        x: '<path d="M18 6 6 18"/><path d="m6 6 12 12"/>'
    };

    const emojiMap = new Map([
        ['✨', 'ai'], ['🎲', 'dice'], ['📊', 'chart'], ['✍️', 'pen'], ['✍', 'pen'],
        ['🔄', 'refresh'], ['📋', 'clipboard'], ['🔊', 'speaker'], ['✏️', 'edit'], ['✏', 'edit'],
        ['⚠️', 'warning'], ['⚠', 'warning'], ['📥', 'download'], ['🗑️', 'trash'], ['🗑', 'trash'],
        ['🏠', 'home'], ['🎮', 'gamepad'], ['⚙️', 'settings'], ['⚙', 'settings'],
        ['🌍', 'globe'], ['🧑‍🎤', 'user'], ['🖼️', 'image'], ['🖼', 'image'], ['📜', 'scroll'],
        ['🎯', 'target'], ['⚔️', 'sword'], ['⚔', 'sword'], ['✅', 'check'], ['✓', 'check'],
        ['❌', 'x'], ['✗', 'x'], ['▶', 'play'], ['⏳', 'hourglass'], ['🚀', 'rocket']
    ]);

    const selector = 'button, .prompt-card-icon, .world-choice-icon, .msg-action-btn, .error-card strong, [id$="-status"]';
    const emojiPattern = Array.from(emojiMap.keys()).sort((a, b) => b.length - a.length).map(escapeRegExp).join('|');
    const leadingIconPattern = new RegExp(`^\\s*(${emojiPattern})(?:\\s+)?`);

    function escapeRegExp(value) {
        return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    }

    function injectStyles() {
        if (document.getElementById('odyssey-theme-icon-styles')) return;
        const style = document.createElement('style');
        style.id = 'odyssey-theme-icon-styles';
        style.textContent = `
            .theme-icon {
                width: 1em;
                height: 1em;
                display: inline-block;
                flex: 0 0 auto;
                color: currentColor;
                fill: none;
                stroke: currentColor;
                stroke-width: 2;
                stroke-linecap: round;
                stroke-linejoin: round;
                vertical-align: -0.125em;
            }
            button .theme-icon { margin-right: 0.4em; }
            button .theme-icon:only-child,
            .msg-action-btn .theme-icon:only-child,
            .btn-top-right .theme-icon:only-child,
            .btn-settings-square .theme-icon:only-child { margin-right: 0; }
            .prompt-card-icon,
            .world-choice-icon {
                color: var(--accent-color);
                display: inline-flex;
                align-items: center;
                justify-content: center;
            }
        `;
        document.head.appendChild(style);
    }

    function createIcon(name) {
        const svg = document.createElementNS(SVG_NS, 'svg');
        svg.setAttribute('viewBox', '0 0 24 24');
        svg.setAttribute('aria-hidden', 'true');
        svg.setAttribute('focusable', 'false');
        svg.classList.add('theme-icon');
        svg.innerHTML = iconPaths[name] || iconPaths.ai;
        return svg;
    }

    function replaceIconText(element) {
        if (!element || element.nodeType !== Node.ELEMENT_NODE || element.dataset.themeIconsSkip === 'true') return;
        if (element.querySelector(':scope > .theme-icon')) return;

        const text = element.textContent || '';
        const trimmed = text.trim();
        const exactName = emojiMap.get(trimmed);
        const match = exactName ? [trimmed, trimmed] : text.match(leadingIconPattern);
        if (!match) return;

        const iconName = exactName || emojiMap.get(match[1]);
        const rest = exactName ? '' : text.slice(match[0].length);
        element.textContent = '';
        element.appendChild(createIcon(iconName));
        if (rest) element.appendChild(document.createTextNode(rest));
    }

    function upgrade(root = document) {
        injectStyles();
        if (root.nodeType === Node.ELEMENT_NODE && root.matches(selector)) {
            replaceIconText(root);
        }
        const elements = root.querySelectorAll ? root.querySelectorAll(selector) : [];
        elements.forEach(replaceIconText);
    }

    function startObserver() {
        const observer = new MutationObserver(mutations => {
            for (const mutation of mutations) {
                if (mutation.target && mutation.target.nodeType === Node.ELEMENT_NODE) {
                    upgrade(mutation.target);
                }
                mutation.addedNodes.forEach(node => {
                    if (node.nodeType === Node.ELEMENT_NODE) upgrade(node);
                });
            }
        });

        observer.observe(document.body, { childList: true, characterData: true, subtree: true });
    }

    function init() {
        upgrade();
        startObserver();
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

    window.OdysseyThemeIcons = { upgrade, createIcon };
})();
