// ============================================================
// THEME-ICONS.JS - SVG icon set
// ============================================================
// Icons are stroked with currentColor, so every theme recolors them through its text and
// accent variables (color emoji are drawn by the OS and ignore CSS).
//
// Usage:
//   Static HTML:  <button><span data-icon="settings"></span></button>
//   Scripts:      OdysseyIcons.html('refresh')            -> SVG markup string
//                 OdysseyIcons.setButton(btn, 'check', 'Approve')
//                 OdysseyIcons.setStatus(el, 'loader', 'Testing...')

(function () {
    const SVG_NS = 'http://www.w3.org/2000/svg';

    const iconPaths = {
        ai: '<path d="M12 3l1.7 5.1L19 10l-5.3 1.9L12 17l-1.7-5.1L5 10l5.3-1.9L12 3z"/><path d="M19 3l.8 2.2L22 6l-2.2.8L19 9l-.8-2.2L16 6l2.2-.8L19 3z"/><path d="M5 15l.9 2.6L8.5 18l-2.6.9L5 21l-.9-2.1L1.5 18l2.6-.4L5 15z"/>',
        arrowLeft: '<path d="M19 12H5"/><path d="m11 18-6-6 6-6"/>',
        arrowRight: '<path d="M5 12h14"/><path d="m13 6 6 6-6 6"/>',
        branch: '<circle cx="6" cy="5" r="2"/><circle cx="6" cy="19" r="2"/><circle cx="18" cy="7" r="2"/><path d="M6 7v10"/><path d="M18 9v1a5 5 0 0 1-5 5H6"/>',
        chart: '<path d="M4 19V5"/><path d="M4 19h16"/><path d="M8 16v-5"/><path d="M12 16V8"/><path d="M16 16v-3"/>',
        check: '<path d="M20 6 9 17l-5-5"/>',
        checkCircle: '<circle cx="12" cy="12" r="9"/><path d="m8 12.5 2.8 2.8L16.5 9.5"/>',
        chevronLeft: '<path d="m15 18-6-6 6-6"/>',
        chevronRight: '<path d="m9 18 6-6-6-6"/>',
        clipboard: '<path d="M9 4h6"/><path d="M9 4a3 3 0 0 1 6 0"/><path d="M9 5H7a2 2 0 0 0-2 2v11a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-2"/><path d="M9 9h6"/><path d="M9 13h6"/><path d="M9 17h3"/>',
        dice: '<rect x="4" y="4" width="16" height="16" rx="3"/><circle cx="8.5" cy="8.5" r=".8"/><circle cx="15.5" cy="8.5" r=".8"/><circle cx="12" cy="12" r=".8"/><circle cx="8.5" cy="15.5" r=".8"/><circle cx="15.5" cy="15.5" r=".8"/>',
        download: '<path d="M12 3v12"/><path d="m7 10 5 5 5-5"/><path d="M5 21h14"/>',
        edit: '<path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4 12.5-12.5z"/>',
        gamepad: '<path d="M6.5 10h11a4.5 4.5 0 0 1 4.2 6.1l-.7 1.9a2.5 2.5 0 0 1-4.1.9l-1.8-1.9H8.9l-1.8 1.9a2.5 2.5 0 0 1-4.1-.9l-.7-1.9A4.5 4.5 0 0 1 6.5 10z"/><path d="M8 13v4"/><path d="M6 15h4"/><circle cx="16.5" cy="14" r=".8"/><circle cx="19" cy="16" r=".8"/>',
        globe: '<circle cx="12" cy="12" r="9"/><path d="M3 12h18"/><path d="M12 3a14 14 0 0 1 0 18"/><path d="M12 3a14 14 0 0 0 0 18"/>',
        home: '<path d="M3 11 12 4l9 7"/><path d="M5 10v10h14V10"/><path d="M9 20v-6h6v6"/>',
        image: '<rect x="3" y="5" width="18" height="14" rx="2"/><circle cx="8" cy="10" r="1.5"/><path d="m21 15-5-5L5 19"/>',
        lightbulb: '<path d="M9 18h6"/><path d="M10 21h4"/><path d="M12 3a6 6 0 0 0-3.6 10.8c.7.5 1.1 1.3 1.1 2.1V16h5v-.1c0-.8.4-1.6 1.1-2.1A6 6 0 0 0 12 3z"/>',
        loader: '<path d="M21 12a9 9 0 1 1-6.2-8.6"/>',
        mic: '<path d="M12 2a3 3 0 0 0-3 3v6a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3z"/><path d="M19 10v1a7 7 0 0 1-14 0v-1"/><path d="M12 18v4"/><path d="M8 22h8"/>',
        pen: '<path d="M12 20h9"/><path d="M16 4l4 4L8 20H4v-4L16 4z"/>',
        play: '<path d="M8 5v14l11-7-11-7z" fill="currentColor" stroke="none"/>',
        refresh: '<path d="M20 12a8 8 0 1 1-2.3-5.7"/><path d="M20 4v6h-6"/>',
        rewind: '<path d="M11 18 3 12l8-6v12z"/><path d="M21 18l-8-6 8-6v12z"/>',
        scroll: '<path d="M8 4h11v14a3 3 0 0 1-3 3H7"/><path d="M8 4a3 3 0 0 0-3 3v13a2 2 0 1 0 4 0V7a3 3 0 0 0-3-3"/><path d="M11 8h5"/><path d="M11 12h5"/>',
        send: '<path d="M5 12h14"/><path d="m13 6 6 6-6 6"/>',
        settings: '<path d="M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8z"/><path d="M4.9 9.1l1.3-.8.6-1.5-.4-1.5 1.8-1 1.2 1 1.6-.2L12 3h2l.7 1.4 1.6.4 1.3-.8 1.4 1.4-.8 1.3.6 1.5 1.4.8v2l-1.4.8-.6 1.5.8 1.3-1.4 1.4-1.3-.8-1.6.4L14 21h-2l-.7-1.4-1.6-.4-1.3.8-1.4-1.4.8-1.3-.6-1.5-1.4-.8v-2z"/>',
        sliders: '<path d="M4 6h9"/><path d="M17 6h3"/><circle cx="15" cy="6" r="2"/><path d="M4 12h3"/><path d="M11 12h9"/><circle cx="9" cy="12" r="2"/><path d="M4 18h11"/><circle cx="17" cy="18" r="2"/><path d="M19 18h1"/>',
        speaker: '<path d="M4 10v4h4l5 4V6l-5 4H4z"/><path d="M16 9a5 5 0 0 1 0 6"/><path d="M18.5 6.5a8.5 8.5 0 0 1 0 11"/>',
        sword: '<path d="M14.5 4.5 20 3l-1.5 5.5L8 19l-3-3L14.5 4.5z"/><path d="m7 15 2 2"/><path d="M3 21l4-4"/>',
        target: '<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1"/>',
        trash: '<path d="M4 7h16"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M6 7l1 14h10l1-14"/><path d="M9 7V4h6v3"/>',
        upload: '<path d="M12 15V3"/><path d="m7 8 5-5 5 5"/><path d="M5 21h14"/>',
        user: '<circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/>',
        warning: '<path d="M12 3 2 21h20L12 3z"/><path d="M12 9v5"/><path d="M12 17h.01"/>',
        x: '<path d="M18 6 6 18"/><path d="m6 6 12 12"/>',
        xCircle: '<circle cx="12" cy="12" r="9"/><path d="m9 9 6 6"/><path d="m15 9-6 6"/>'
    };

    // Icons that animate on their own.
    const SPINNING = new Set(['loader']);

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
            .theme-icon + .icon-label { margin-left: 0.4em; }
            .icon-label + .theme-icon { margin-left: 0.4em; }
            .theme-icon.is-spinning { animation: odyssey-icon-spin 0.9s linear infinite; }
            @keyframes odyssey-icon-spin { to { transform: rotate(360deg); } }
            .prompt-card-icon,
            .world-choice-icon {
                color: var(--accent-color);
                display: inline-flex;
                align-items: center;
                justify-content: center;
            }
            .status-success { color: var(--color-success, #2e7d32); }
            .status-error { color: var(--color-danger, #dc3545); }
        `;
        document.head.appendChild(style);
    }

    function iconMarkup(name, options = {}) {
        const paths = iconPaths[name];
        if (!paths) {
            console.warn(`Unknown icon "${name}"`);
            return '';
        }
        const classes = ['theme-icon', SPINNING.has(name) ? 'is-spinning' : '', options.className || ''].filter(Boolean).join(' ');
        return `<svg class="${classes}" viewBox="0 0 24 24" aria-hidden="true" focusable="false" xmlns="${SVG_NS}">${paths}</svg>`;
    }

    function createIcon(name, options = {}) {
        const template = document.createElement('template');
        template.innerHTML = iconMarkup(name, options);
        return template.content.firstElementChild || document.createElementNS(SVG_NS, 'svg');
    }

    // Replaces an element's content with an icon and an optional text label.
    // Text is inserted as text (never parsed as HTML).
    function setIconContent(element, name, text = '', options = {}) {
        if (!element) return element;
        const nodes = [];
        if (name) nodes.push(createIcon(name));
        if (text !== '' && text !== null && text !== undefined) {
            const label = document.createElement('span');
            label.className = 'icon-label';
            label.textContent = String(text);
            if (options.trailing) nodes.unshift(label);
            else nodes.push(label);
        }
        element.replaceChildren(...nodes);
        return element;
    }

    const STATUS_CLASSES = { checkCircle: 'status-success', xCircle: 'status-error' };

    function setStatus(element, name, text = '') {
        if (!element) return element;
        setIconContent(element, name, text);
        element.classList.remove('status-success', 'status-error');
        if (STATUS_CLASSES[name]) element.classList.add(STATUS_CLASSES[name]);
        return element;
    }

    // Turns <span data-icon="name"></span> placeholders into SVG icons.
    function hydrate(root = document) {
        injectStyles();
        const nodes = root.querySelectorAll ? root.querySelectorAll('[data-icon]') : [];
        nodes.forEach(node => {
            const icon = createIcon(node.dataset.icon);
            node.replaceWith(icon);
        });
    }

    window.OdysseyIcons = {
        names: () => Object.keys(iconPaths),
        html: iconMarkup,
        el: createIcon,
        setButton: setIconContent,
        setStatus,
        hydrate
    };

    injectStyles();
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => hydrate());
    } else {
        hydrate();
    }
})();
