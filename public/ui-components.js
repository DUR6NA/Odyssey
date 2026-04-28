// ============================================================
// UI COMPONENTS - Custom Dropdown, Number Spinner, etc.
// Shared across settings.html, creation.js, chat.js, and game.html
// ============================================================

// SVG icons for arrows
const UI_ICONS = {
    chevronDown: '<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path d="M7.41 8.59L12 13.17l4.59-4.58L18 10l-6 6-6-6z"/></svg>',
    arrowUp: '<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path d="M7.41 15.41L12 10.83l4.59 4.58L18 14l-6-6-6 6z"/></svg>',
    arrowDown: '<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path d="M7.41 8.59L12 13.17l4.59-4.58L18 10l-6 6-6-6z"/></svg>',
    check: '<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path d="M9 16.2 4.8 12l-1.4 1.4L9 19 21 7l-1.4-1.4z"/></svg>',
    info: '<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path d="M11 17h2v-6h-2v6zm1-16C6.48 1 2 5.48 2 11s4.48 10 10 10 10-4.48 10-10S17.52 1 12 1zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8zM11 9h2V7h-2v2z"/></svg>',
    warning: '<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path d="M1 21h22L12 2 1 21zm12-3h-2v-2h2v2zm0-4h-2v-4h2v4z"/></svg>',
    close: '<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path d="M18.3 5.71 12 12l6.3 6.29-1.41 1.41L10.59 13.41 4.29 19.71 2.88 18.3 9.17 12 2.88 5.71 4.29 4.29l6.3 6.3 6.29-6.3z"/></svg>'
};

// ============================================================
// ODYSSEY NOTIFICATIONS AND CONFIRMATION POPUPS
// ============================================================
(function initOdysseyNotifications() {
    if (window.Odyssey && window.Odyssey.notify && window.Odyssey.confirm) return;

    const notificationIcons = {
        success: UI_ICONS.check,
        error: UI_ICONS.warning,
        warning: UI_ICONS.warning,
        info: UI_ICONS.info
    };

    function ensureNotificationStyles() {
        if (document.getElementById('odyssey-notification-styles')) return;

        const style = document.createElement('style');
        style.id = 'odyssey-notification-styles';
        style.textContent = `
            .odyssey-toast-region {
                position: fixed;
                top: 50%;
                left: 50%;
                width: min(420px, calc(100vw - 32px));
                max-height: calc(100vh - var(--titlebar-height, 0px) - 32px);
                display: flex;
                flex-direction: column;
                gap: 10px;
                z-index: 2147483647;
                pointer-events: none;
                transform: translate(-50%, -50%);
            }

            .odyssey-toast {
                --toast-tone: var(--accent-color, #fff);
                --notification-bg: var(--bg-secondary, rgba(17,24,44,.94));
                --notification-panel: var(--bg-tertiary, rgba(0,0,0,.72));
                --notification-border: var(--border-color, rgba(255,255,255,.16));
                --notification-heading: var(--text-heading, #fff);
                --notification-text: var(--text-main, #e5e7eb);
                --notification-muted: var(--text-muted, #9ca3af);
                position: relative;
                display: grid;
                grid-template-columns: 34px minmax(0, 1fr) 28px;
                gap: 12px;
                align-items: start;
                width: 100%;
                padding: 16px 16px 14px;
                overflow: hidden;
                pointer-events: auto;
                color: var(--notification-text);
                background: var(--notification-bg);
                border: 1px solid color-mix(in srgb, var(--toast-tone) 42%, var(--notification-border));
                border-radius: var(--radius-md, 8px);
                box-shadow: var(--shadow-xl, 0 16px 48px rgba(0,0,0,.55)), inset 0 0 0 1px var(--notification-panel);
                backdrop-filter: blur(12px);
                transform: translateY(8px) scale(.98);
                opacity: 0;
                transition: transform 180ms ease, opacity 160ms ease;
            }

            .odyssey-toast::before,
            .odyssey-dialog::before {
                content: "";
                position: absolute;
                inset: 6px;
                border: 1px solid color-mix(in srgb, var(--accent-color, #fff) 24%, transparent);
                border-radius: calc(var(--radius-md, 8px) - 2px);
                pointer-events: none;
            }

            .odyssey-toast.is-visible {
                transform: translateY(0) scale(1);
                opacity: 1;
            }

            .odyssey-toast.is-leaving {
                transform: translateY(8px) scale(.98);
                opacity: 0;
            }

            .odyssey-toast[data-type="success"] { --toast-tone: var(--color-success, #2e7d32); }
            .odyssey-toast[data-type="error"] { --toast-tone: var(--color-danger, #dc3545); }
            .odyssey-toast[data-type="warning"] { --toast-tone: var(--color-warning, #f57f17); }
            .odyssey-toast[data-type="info"] { --toast-tone: var(--color-info, var(--accent-color, #fff)); }

            .odyssey-toast-icon {
                width: 34px;
                height: 34px;
                display: inline-flex;
                align-items: center;
                justify-content: center;
                color: var(--toast-tone);
                background: var(--notification-panel);
                border: 1px solid color-mix(in srgb, var(--toast-tone) 36%, var(--notification-border));
                border-radius: var(--radius-sm, 4px);
            }

            .odyssey-toast-icon svg,
            .odyssey-toast-close svg {
                width: 18px;
                height: 18px;
                fill: currentColor;
            }

            .odyssey-toast-title {
                color: var(--notification-heading);
                font-family: var(--font-primary, 'Cinzel', serif);
                font-size: 0.86rem;
                font-weight: 700;
                letter-spacing: 0.06em;
                line-height: 1.2;
                margin-bottom: 6px;
                overflow-wrap: anywhere;
                text-transform: uppercase;
            }

            .odyssey-toast-message {
                color: var(--notification-text);
                font-family: var(--font-secondary, 'Merriweather', serif);
                font-size: 0.9rem;
                line-height: 1.42;
                overflow-wrap: anywhere;
            }

            .odyssey-toast-close {
                width: 28px;
                height: 28px;
                display: inline-flex;
                align-items: center;
                justify-content: center;
                border: 1px solid transparent;
                border-radius: var(--radius-sm, 4px);
                color: var(--notification-muted);
                background: transparent;
                cursor: pointer;
            }

            .odyssey-toast-close:hover {
                color: var(--notification-heading);
                border-color: var(--notification-border);
                background: var(--notification-panel);
            }

            .odyssey-toast-progress {
                position: absolute;
                left: 0;
                right: 0;
                bottom: 0;
                height: 2px;
                background: var(--toast-tone);
                transform-origin: left;
                animation: odysseyToastProgress var(--toast-duration, 4200ms) linear forwards;
            }

            .odyssey-dialog-backdrop {
                position: fixed;
                inset: 0;
                z-index: 2147483647;
                display: flex;
                align-items: center;
                justify-content: center;
                padding: 24px;
                background: color-mix(in srgb, var(--bg-main, #000) 72%, transparent);
                backdrop-filter: blur(8px);
                opacity: 0;
                transition: opacity 160ms ease;
            }

            .odyssey-dialog-backdrop.is-visible {
                opacity: 1;
            }

            .odyssey-dialog {
                --dialog-bg: var(--bg-secondary, rgba(17,24,44,.96));
                --dialog-panel: var(--bg-tertiary, rgba(0,0,0,.72));
                --dialog-border: var(--border-color, rgba(255,255,255,.16));
                width: min(460px, 100%);
                position: relative;
                color: var(--text-main, #e5e7eb);
                background: var(--dialog-bg);
                border: 1px solid color-mix(in srgb, var(--accent-color, #fff) 38%, var(--dialog-border));
                border-radius: var(--radius-md, 8px);
                box-shadow: var(--shadow-xl, 0 18px 56px rgba(0,0,0,.62)), inset 0 0 0 1px var(--dialog-panel);
                padding: 22px;
                transform: translateY(10px) scale(.98);
                transition: transform 180ms ease;
            }

            .odyssey-dialog-backdrop.is-visible .odyssey-dialog {
                transform: translateY(0) scale(1);
            }

            .odyssey-dialog-title {
                color: var(--text-heading, #fff);
                font-family: var(--font-primary, 'Cinzel', serif);
                font-size: 1.12rem;
                font-weight: 700;
                letter-spacing: 0.07em;
                margin: 0 0 12px;
                padding-bottom: 10px;
                border-bottom: 1px solid color-mix(in srgb, var(--accent-color, #fff) 28%, var(--border-color, rgba(255,255,255,.16)));
                text-transform: uppercase;
            }

            .odyssey-dialog-message {
                color: var(--text-main, #e5e7eb);
                font-family: var(--font-secondary, 'Merriweather', serif);
                font-size: 0.98rem;
                line-height: 1.55;
                margin: 0;
                overflow-wrap: anywhere;
            }

            .odyssey-dialog-actions {
                display: flex;
                justify-content: flex-end;
                gap: 10px;
                margin-top: 22px;
            }

            .odyssey-dialog-btn {
                min-width: 96px;
                padding: 10px 16px;
                border-radius: var(--radius-sm, 4px);
                border: 1px solid var(--border-color, rgba(255,255,255,.14));
                font-family: var(--font-primary, 'Cinzel', serif);
                font-weight: 700;
                letter-spacing: 0.05em;
                cursor: pointer;
                transition: transform 140ms ease, background 140ms ease, border-color 140ms ease;
                text-transform: uppercase;
            }

            .odyssey-dialog-btn:hover {
                transform: translateY(-1px);
            }

            .odyssey-dialog-btn.secondary {
                color: var(--text-main, #e5e7eb);
                background: var(--dialog-panel);
            }

            .odyssey-dialog-btn.primary {
                color: var(--btn-text, #000);
                background: var(--accent-color, #fff);
                border-color: var(--accent-color, #fff);
            }

            .odyssey-dialog-btn.danger {
                color: #fff;
                background: var(--color-danger, #dc3545);
                border-color: var(--color-danger, #dc3545);
            }

            html[data-theme="matrix"] .odyssey-toast,
            html[data-theme="matrix"] .odyssey-dialog,
            html[data-theme="matrix"] .odyssey-dialog-btn {
                border-radius: 0;
            }

            html[data-theme="bliss"] .odyssey-toast,
            html[data-theme="bliss"] .odyssey-dialog {
                background: var(--bg-secondary, rgba(255,255,255,.74));
                box-shadow: 0 12px 40px rgba(0, 100, 200, .24);
            }

            @keyframes odysseyToastProgress {
                from { transform: scaleX(1); }
                to { transform: scaleX(0); }
            }

            @media (prefers-reduced-motion: reduce) {
                .odyssey-toast,
                .odyssey-dialog-backdrop,
                .odyssey-dialog {
                    transition: none;
                }

                .odyssey-toast-progress {
                    animation: none;
                }
            }

            html[data-reduce-motion="true"] .odyssey-toast,
            html[data-reduce-motion="true"] .odyssey-dialog-backdrop,
            html[data-reduce-motion="true"] .odyssey-dialog {
                transition: none;
            }

            html[data-reduce-motion="true"] .odyssey-toast-progress {
                animation: none;
            }

            @media (max-width: 520px) {
                .odyssey-toast-region {
                    width: min(420px, calc(100vw - 24px));
                }

                .odyssey-dialog-actions {
                    flex-direction: column-reverse;
                }

                .odyssey-dialog-btn {
                    width: 100%;
                }
            }
        `;
        document.head.appendChild(style);
    }

    function getToastRegion() {
        ensureNotificationStyles();
        let region = document.querySelector('.odyssey-toast-region');
        if (!region) {
            region = document.createElement('div');
            region.className = 'odyssey-toast-region';
            region.setAttribute('aria-live', 'polite');
            region.setAttribute('aria-atomic', 'false');
            (document.body || document.documentElement).appendChild(region);
        }
        return region;
    }

    function guessNotificationType(message) {
        const text = String(message || '').toLowerCase();
        if (text.includes('failed') || text.includes('error')) return 'error';
        if (text.includes('disabled') || text.includes('required') || text.includes('please ')) return 'warning';
        if (text.includes('saved') || text.includes('success') || text.includes('imported') || text.includes('exported')) return 'success';
        return 'info';
    }

    function removeToast(toast) {
        if (!toast || toast.classList.contains('is-leaving')) return;
        toast.classList.remove('is-visible');
        toast.classList.add('is-leaving');
        window.setTimeout(() => toast.remove(), 220);
    }

    function notify(message, options = {}) {
        const type = options.type || guessNotificationType(message);
        const duration = Number.isFinite(options.duration) ? options.duration : 4200;
        const region = getToastRegion();

        const toast = document.createElement('div');
        toast.className = 'odyssey-toast';
        toast.dataset.type = type;
        toast.setAttribute('role', type === 'error' || type === 'warning' ? 'alert' : 'status');
        toast.style.setProperty('--toast-duration', `${Math.max(duration, 800)}ms`);

        const icon = document.createElement('div');
        icon.className = 'odyssey-toast-icon';
        icon.innerHTML = notificationIcons[type] || notificationIcons.info;

        const content = document.createElement('div');
        content.className = 'odyssey-toast-content';
        const title = document.createElement('div');
        title.className = 'odyssey-toast-title';
        title.textContent = options.title || (type === 'success' ? 'Success' : type === 'error' ? 'Problem' : type === 'warning' ? 'Notice' : 'Odyssey');
        const text = document.createElement('div');
        text.className = 'odyssey-toast-message';
        text.textContent = String(message ?? '');
        content.appendChild(title);
        content.appendChild(text);

        const close = document.createElement('button');
        close.type = 'button';
        close.className = 'odyssey-toast-close';
        close.setAttribute('aria-label', 'Dismiss notification');
        close.innerHTML = UI_ICONS.close;
        close.addEventListener('click', () => removeToast(toast));

        const progress = document.createElement('div');
        progress.className = 'odyssey-toast-progress';

        toast.appendChild(icon);
        toast.appendChild(content);
        toast.appendChild(close);
        toast.appendChild(progress);
        region.prepend(toast);

        window.requestAnimationFrame(() => toast.classList.add('is-visible'));
        if (duration > 0) window.setTimeout(() => removeToast(toast), duration);

        return toast;
    }

    function confirmDialog(message, options = {}) {
        ensureNotificationStyles();

        return new Promise(resolve => {
            const backdrop = document.createElement('div');
            backdrop.className = 'odyssey-dialog-backdrop';
            backdrop.setAttribute('role', 'presentation');

            const dialog = document.createElement('div');
            dialog.className = 'odyssey-dialog';
            dialog.setAttribute('role', 'dialog');
            dialog.setAttribute('aria-modal', 'true');
            dialog.setAttribute('aria-labelledby', 'odyssey-dialog-title');
            dialog.setAttribute('aria-describedby', 'odyssey-dialog-message');

            const title = document.createElement('h2');
            title.id = 'odyssey-dialog-title';
            title.className = 'odyssey-dialog-title';
            title.textContent = options.title || 'Confirm Action';

            const body = document.createElement('p');
            body.id = 'odyssey-dialog-message';
            body.className = 'odyssey-dialog-message';
            body.textContent = String(message ?? '');

            const actions = document.createElement('div');
            actions.className = 'odyssey-dialog-actions';

            const cancel = document.createElement('button');
            cancel.type = 'button';
            cancel.className = 'odyssey-dialog-btn secondary';
            cancel.textContent = options.cancelText || 'Cancel';

            const confirm = document.createElement('button');
            confirm.type = 'button';
            confirm.className = `odyssey-dialog-btn ${options.danger ? 'danger' : 'primary'}`;
            confirm.textContent = options.confirmText || 'Confirm';

            let settled = false;
            function close(value) {
                if (settled) return;
                settled = true;
                backdrop.classList.remove('is-visible');
                window.setTimeout(() => {
                    backdrop.remove();
                    resolve(value);
                }, 170);
            }

            cancel.addEventListener('click', () => close(false));
            confirm.addEventListener('click', () => close(true));
            backdrop.addEventListener('click', event => {
                if (event.target === backdrop) close(false);
            });
            backdrop.addEventListener('keydown', event => {
                if (event.key === 'Escape') {
                    event.preventDefault();
                    close(false);
                }
            });

            actions.appendChild(cancel);
            actions.appendChild(confirm);
            dialog.appendChild(title);
            dialog.appendChild(body);
            dialog.appendChild(actions);
            backdrop.appendChild(dialog);
            (document.body || document.documentElement).appendChild(backdrop);

            window.requestAnimationFrame(() => {
                backdrop.classList.add('is-visible');
                confirm.focus();
            });
        });
    }

    window.Odyssey = window.Odyssey || {};
    window.Odyssey.notify = notify;
    window.Odyssey.confirm = confirmDialog;
    window.odysseyNotify = notify;
    window.odysseyConfirm = confirmDialog;

    window.alert = function odysseyAlert(message) {
        notify(message);
    };

    window.confirm = function odysseyLegacyConfirm(message) {
        notify('This action uses a confirmation popup. Please retry once the custom dialog opens.', { type: 'warning', title: 'Confirmation' });
        confirmDialog(message);
        return false;
    };
})();

// ============================================================
// CUSTOM SELECT DROPDOWN
// ============================================================
/**
 * Creates a custom dropdown to replace a native <select> element.
 * @param {HTMLSelectElement} nativeSelect - The native select to replace
 * @param {Object} opts - Options { enableSearch: bool, width: string }
 * @returns {HTMLElement} The custom select wrapper
 */
function createCustomSelect(nativeSelect, opts = {}) {
    const { enableSearch = false, width = null } = opts;

    // Hide native select
    nativeSelect.style.display = 'none';

    // Wrapper
    const wrapper = document.createElement('div');
    wrapper.className = 'custom-select-wrapper';
    if (width) wrapper.style.width = width;
    else if (nativeSelect.style.width) wrapper.style.width = nativeSelect.style.width;
    else if (nativeSelect.style.maxWidth) wrapper.style.maxWidth = nativeSelect.style.maxWidth;
    if (nativeSelect.style.flex) wrapper.style.flex = nativeSelect.style.flex;

    // Trigger button
    const trigger = document.createElement('div');
    trigger.className = 'custom-select-trigger';
    trigger.tabIndex = 0;
    trigger.setAttribute('role', 'combobox');
    trigger.setAttribute('aria-expanded', 'false');

    const triggerText = document.createElement('span');
    triggerText.className = 'custom-select-trigger-text';

    const arrow = document.createElement('span');
    arrow.className = 'custom-select-arrow';
    arrow.innerHTML = UI_ICONS.chevronDown;

    trigger.appendChild(triggerText);
    trigger.appendChild(arrow);
    wrapper.appendChild(trigger);

    // Dropdown panel
    const dropdown = document.createElement('div');
    dropdown.className = 'custom-select-dropdown';
    dropdown.setAttribute('role', 'listbox');

    // Search bar (opt-in) — stays fixed at top, outside scrollable area
    let searchInput = null;
    if (enableSearch) {
        const searchWrap = document.createElement('div');
        searchWrap.className = 'custom-select-search';
        searchInput = document.createElement('input');
        searchInput.type = 'text';
        searchInput.placeholder = 'Search...';
        searchWrap.appendChild(searchInput);
        dropdown.appendChild(searchWrap);
    }

    // Scrollable options container
    const optionsContainer = document.createElement('div');
    optionsContainer.className = 'custom-select-options';

    // Build options from native select
    function buildOptions() {
        optionsContainer.innerHTML = '';
        const children = nativeSelect.children;

        for (let i = 0; i < children.length; i++) {
            const child = children[i];

            if (child.tagName === 'OPTGROUP') {
                const groupLabel = document.createElement('div');
                groupLabel.className = 'custom-select-group-label';
                groupLabel.textContent = child.label;
                optionsContainer.appendChild(groupLabel);

                for (let j = 0; j < child.children.length; j++) {
                    const opt = child.children[j];
                    const optEl = createOptionElement(opt.value, opt.textContent, opt.selected, opt.style.fontFamily);
                    optionsContainer.appendChild(optEl);
                }
            } else if (child.tagName === 'OPTION') {
                const optEl = createOptionElement(child.value, child.textContent, child.selected, child.style.fontFamily);
                optionsContainer.appendChild(optEl);
            }
        }
    }

    function createOptionElement(value, text, selected, fontFamily) {
        const optEl = document.createElement('div');
        optEl.className = 'custom-select-option' + (selected ? ' selected' : '');
        optEl.dataset.value = value;
        optEl.textContent = text;
        optEl.setAttribute('role', 'option');

        // Preserve per-option font-family (for font preview dropdowns)
        if (fontFamily) {
            optEl.style.fontFamily = fontFamily;
        }

        optEl.addEventListener('click', (e) => {
            e.stopPropagation();
            selectOption(value, text, fontFamily);
            closeDropdown();
        });

        return optEl;
    }

    function selectOption(value, text, fontFamily) {
        nativeSelect.value = value;
        triggerText.textContent = text;

        // Apply font preview to trigger text if available
        if (fontFamily) {
            triggerText.style.fontFamily = fontFamily;
        }

        // Update selected class
        optionsContainer.querySelectorAll('.custom-select-option').forEach(o => {
            o.classList.toggle('selected', o.dataset.value === value);
        });

        // Fire change event on native select
        nativeSelect.dispatchEvent(new Event('change', { bubbles: true }));
    }

    // No results message
    const noResults = document.createElement('div');
    noResults.className = 'custom-select-no-results';
    noResults.textContent = 'No results found';
    noResults.style.display = 'none';

    dropdown.appendChild(optionsContainer);
    dropdown.appendChild(noResults);
    wrapper.appendChild(dropdown);

    // Search filtering
    if (searchInput) {
        searchInput.addEventListener('input', () => {
            const query = searchInput.value.toLowerCase();
            let anyVisible = false;

            optionsContainer.querySelectorAll('.custom-select-option').forEach(opt => {
                const match = opt.textContent.toLowerCase().includes(query);
                opt.classList.toggle('hidden', !match);
                if (match) anyVisible = true;
            });

            // Show/hide group labels based on visible children
            optionsContainer.querySelectorAll('.custom-select-group-label').forEach(label => {
                let nextSibling = label.nextElementSibling;
                let groupHasVisible = false;
                while (nextSibling && !nextSibling.classList.contains('custom-select-group-label')) {
                    if (nextSibling.classList.contains('custom-select-option') && !nextSibling.classList.contains('hidden')) {
                        groupHasVisible = true;
                    }
                    nextSibling = nextSibling.nextElementSibling;
                }
                label.style.display = groupHasVisible ? '' : 'none';
            });

            noResults.style.display = anyVisible ? 'none' : '';
        });

        searchInput.addEventListener('click', (e) => e.stopPropagation());

        // Escape key closes dropdown from search input
        searchInput.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                closeDropdown();
                trigger.focus();
            }
        });
    }

    // Open/close logic
    function openDropdown() {
        wrapper.classList.add('open');
        trigger.setAttribute('aria-expanded', 'true');
        if (searchInput) {
            searchInput.value = '';
            searchInput.dispatchEvent(new Event('input'));
            setTimeout(() => searchInput.focus(), 50);
        }

        // Scroll selected into view within the options container
        const selectedEl = optionsContainer.querySelector('.custom-select-option.selected');
        if (selectedEl) {
            setTimeout(() => selectedEl.scrollIntoView({ block: 'nearest' }), 60);
        }
    }

    function closeDropdown() {
        wrapper.classList.remove('open');
        trigger.setAttribute('aria-expanded', 'false');
    }

    trigger.addEventListener('click', (e) => {
        e.stopPropagation();
        if (wrapper.classList.contains('open')) closeDropdown();
        else openDropdown();
    });

    trigger.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            if (wrapper.classList.contains('open')) closeDropdown();
            else openDropdown();
        } else if (e.key === 'Escape') {
            closeDropdown();
        }
    });

    // Close on outside click
    document.addEventListener('click', (e) => {
        if (!wrapper.contains(e.target)) closeDropdown();
    });

    // Insert after native select
    nativeSelect.parentNode.insertBefore(wrapper, nativeSelect.nextSibling);

    // Initialize display text and font preview
    buildOptions();
    const selectedOpt = nativeSelect.options[nativeSelect.selectedIndex];
    if (selectedOpt) {
        triggerText.textContent = selectedOpt.textContent;
        if (selectedOpt.style.fontFamily) {
            triggerText.style.fontFamily = selectedOpt.style.fontFamily;
        }
    }

    // Expose refresh method
    wrapper._refresh = () => {
        buildOptions();
        const sel = nativeSelect.options[nativeSelect.selectedIndex];
        if (sel) {
            triggerText.textContent = sel.textContent;
            if (sel.style.fontFamily) {
                triggerText.style.fontFamily = sel.style.fontFamily;
            }
        } else {
            triggerText.textContent = '';
            triggerText.style.fontFamily = '';
        }
    };

    wrapper._nativeSelect = nativeSelect;

    return wrapper;
}


// ============================================================
// CUSTOM NUMBER INPUT WITH SPINNER ARROWS
// ============================================================
/**
 * Wraps a native <input type="number"> with custom up/down buttons.
 * @param {HTMLInputElement} nativeInput - The native number input
 * @returns {HTMLElement} The custom wrapper
 */
function createCustomNumberInput(nativeInput) {
    // Don't double-wrap
    if (nativeInput.parentElement && nativeInput.parentElement.classList.contains('custom-number-wrapper')) return null;

    const wrapper = document.createElement('div');
    wrapper.className = 'custom-number-wrapper';

    // Carry over width
    if (nativeInput.style.width) {
        wrapper.style.width = nativeInput.style.width;
        nativeInput.style.width = '100%';
    }
    if (nativeInput.style.flex) {
        wrapper.style.flex = nativeInput.style.flex;
    }

    // Insert wrapper in place of input
    nativeInput.parentNode.insertBefore(wrapper, nativeInput);
    wrapper.appendChild(nativeInput);

    // Remove native borders/styles (handled by wrapper)
    nativeInput.style.border = 'none';
    nativeInput.style.borderRadius = '0';
    nativeInput.style.background = 'transparent';
    nativeInput.style.boxShadow = 'none';

    // Controls column
    const controls = document.createElement('div');
    controls.className = 'custom-number-controls';

    const step = parseFloat(nativeInput.step) || 1;
    const min = nativeInput.min !== '' ? parseFloat(nativeInput.min) : -Infinity;
    const max = nativeInput.max !== '' ? parseFloat(nativeInput.max) : Infinity;

    // Up button
    const upBtn = document.createElement('button');
    upBtn.type = 'button';
    upBtn.className = 'custom-number-btn';
    upBtn.innerHTML = UI_ICONS.arrowUp;
    upBtn.title = 'Increase';
    upBtn.tabIndex = -1;

    let upInterval = null;
    const doUp = () => {
        let val = parseFloat(nativeInput.value) || 0;
        val = Math.round((val + step) * 1000) / 1000;
        if (val <= max) {
            nativeInput.value = val;
            nativeInput.dispatchEvent(new Event('change', { bubbles: true }));
            nativeInput.dispatchEvent(new Event('input', { bubbles: true }));
        }
    };
    upBtn.addEventListener('mousedown', (e) => {
        e.preventDefault();
        doUp();
        upInterval = setInterval(doUp, 120);
    });
    upBtn.addEventListener('mouseup', () => clearInterval(upInterval));
    upBtn.addEventListener('mouseleave', () => clearInterval(upInterval));
    // Touch support for mobile
    upBtn.addEventListener('touchstart', (e) => {
        e.preventDefault();
        doUp();
        upInterval = setInterval(doUp, 120);
    }, { passive: false });
    upBtn.addEventListener('touchend', () => clearInterval(upInterval));

    // Down button
    const downBtn = document.createElement('button');
    downBtn.type = 'button';
    downBtn.className = 'custom-number-btn';
    downBtn.innerHTML = UI_ICONS.arrowDown;
    downBtn.title = 'Decrease';
    downBtn.tabIndex = -1;

    let downInterval = null;
    const doDown = () => {
        let val = parseFloat(nativeInput.value) || 0;
        val = Math.round((val - step) * 1000) / 1000;
        if (val >= min) {
            nativeInput.value = val;
            nativeInput.dispatchEvent(new Event('change', { bubbles: true }));
            nativeInput.dispatchEvent(new Event('input', { bubbles: true }));
        }
    };
    downBtn.addEventListener('mousedown', (e) => {
        e.preventDefault();
        doDown();
        downInterval = setInterval(doDown, 120);
    });
    downBtn.addEventListener('mouseup', () => clearInterval(downInterval));
    downBtn.addEventListener('mouseleave', () => clearInterval(downInterval));
    // Touch support for mobile
    downBtn.addEventListener('touchstart', (e) => {
        e.preventDefault();
        doDown();
        downInterval = setInterval(doDown, 120);
    }, { passive: false });
    downBtn.addEventListener('touchend', () => clearInterval(downInterval));

    // Keyboard ArrowUp/ArrowDown support on the input
    nativeInput.addEventListener('keydown', (e) => {
        if (e.key === 'ArrowUp') {
            e.preventDefault();
            doUp();
        } else if (e.key === 'ArrowDown') {
            e.preventDefault();
            doDown();
        }
    });

    controls.appendChild(upBtn);
    controls.appendChild(downBtn);
    wrapper.appendChild(controls);

    return wrapper;
}


// ============================================================
// AUTO-INITIALIZATION
// ============================================================
/**
 * Upgrades all native selects and number inputs within a container.
 * @param {HTMLElement} container - The root element to scan (defaults to document.body)
 * @param {Object} opts - { searchSelects: string[] } - IDs of selects that should have search
 */
function initCustomUIComponents(container = document.body, opts = {}) {
    const searchSelects = opts.searchSelects || [];

    // Upgrade selects
    container.querySelectorAll('select:not([data-custom-init])').forEach(sel => {
        // Skip selects inside custom wrappers (already init)
        if (sel.closest('.custom-select-wrapper')) return;
        sel.dataset.customInit = '1';

        const enableSearch = searchSelects.includes(sel.id) ||
            sel.querySelectorAll('option').length > 10 ||
            sel.querySelectorAll('optgroup').length > 0;

        createCustomSelect(sel, { enableSearch });
    });

    // Upgrade number inputs
    container.querySelectorAll('input[type="number"]:not([data-custom-init])').forEach(inp => {
        if (inp.closest('.custom-number-wrapper')) return;
        // Skip inputs that are part of the attribute slider
        if (inp.classList.contains('attribute-slider')) return;
        inp.dataset.customInit = '1';
        createCustomNumberInput(inp);
    });
}

/**
 * Refreshes a custom select when its native options have changed.
 * @param {string} selectId - The ID of the native select element
 */
function refreshCustomSelect(selectId) {
    const nativeSelect = document.getElementById(selectId);
    if (!nativeSelect) return;

    const wrapper = nativeSelect.nextElementSibling;
    if (wrapper && wrapper.classList.contains('custom-select-wrapper') && wrapper._refresh) {
        wrapper._refresh();
    }
}
