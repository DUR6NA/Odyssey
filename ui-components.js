// ============================================================
// UI COMPONENTS - Custom Dropdown, Number Spinner, etc.
// Shared across settings.html, setup.js, and game.html
// ============================================================

// SVG icons for arrows
const UI_ICONS = {
    chevronDown: '<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path d="M7.41 8.59L12 13.17l4.59-4.58L18 10l-6 6-6-6z"/></svg>',
    arrowUp: '<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path d="M7.41 15.41L12 10.83l4.59 4.58L18 14l-6-6-6 6z"/></svg>',
    arrowDown: '<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path d="M7.41 8.59L12 13.17l4.59-4.58L18 10l-6 6-6-6z"/></svg>'
};

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
