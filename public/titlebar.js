/*
 * Odyssey — Custom Title Bar
 * ---------------------------------------------------------------
 * Seamless, theme-aware window chrome. Reads colors exclusively
 * from the CSS custom properties that `theme.js` already sets on
 * <html>, so switching themes retints the title bar for free.
 *
 * Safe to load on every page:
 *   - No-ops outside of Tauri (web preview still works)
 *   - Idempotent: multiple script tags won't stack bars
 *   - Injects its own CSS once, scoped with an `odyssey-` prefix
 *   - Exposes `window.odysseyTitlebar.setTitle(string)` for pages
 *     that want to override the default document.title display.
 */
(function () {
  'use strict';

  const BAR_HEIGHT = 32; // px — tweak here if you want it chunkier / thinner

  if (window.__odysseyTitlebarInstalled) return;
  window.__odysseyTitlebarInstalled = true;

  // --- Styles -----------------------------------------------------------
  const css = `
  :root {
    --odyssey-titlebar-height: ${BAR_HEIGHT}px;
  }
  html, body {
    box-sizing: border-box;
  }
  /* Make <html> non-scrollable so the browser's scroll container is <body>.
     This is what keeps the scroll track from running up under the title bar:
     body is offset by the bar's height, so its scrollbar starts BELOW it. */
  html {
    height: 100%;
    overflow: hidden !important;
  }
  body {
    /* Forced: body must sit below the titlebar and fill the rest of the viewport. */
    margin: 0 !important;
    margin-top: var(--odyssey-titlebar-height) !important;
    padding-top: 0 !important;
    height: calc(100vh - var(--odyssey-titlebar-height)) !important;
    /* Default (not !important) so pages that intentionally set overflow:hidden
       on body — e.g. full-screen intro animations — can still opt out. */
    overflow-y: auto;
  }
  /* Keep full-viewport background canvases (theme.js) behind the bar
     so the chrome visually sits ON the scene rather than above it.
     Fixed positioning keeps them relative to the viewport regardless of
     body's margin-top. */
  #bg-canvas {
    top: 0 !important;
    height: 100vh !important;
  }

  .odyssey-titlebar {
    position: fixed;
    top: 0; left: 0; right: 0;
    height: var(--odyssey-titlebar-height);
    z-index: 2147483646; /* just below modal/alerts scripts might spawn */
    display: flex;
    align-items: stretch;
    justify-content: space-between;
    font-family: var(--font-secondary, system-ui, sans-serif);
    font-size: 12px;
    color: var(--menu-title-color, var(--text-heading, #fff));
    user-select: none;
    -webkit-user-select: none;
    background:
      linear-gradient(
        180deg,
        color-mix(in srgb, var(--bg-secondary, rgba(0,0,0,0.55)) 95%, transparent) 0%,
        color-mix(in srgb, var(--bg-secondary, rgba(0,0,0,0.35)) 70%, transparent) 100%
      );
    backdrop-filter: blur(14px) saturate(140%);
    -webkit-backdrop-filter: blur(14px) saturate(140%);
    border-bottom: 1px solid var(--border-color, rgba(255,255,255,0.08));
    box-shadow: 0 1px 0 rgba(255,255,255,0.04) inset, 0 4px 18px rgba(0,0,0,0.18);
    transition: background 0.4s ease, border-color 0.4s ease, color 0.4s ease;
  }

  /* Subtle accent line that picks up the theme accent color. */
  .odyssey-titlebar::after {
    content: "";
    position: absolute;
    left: 0; right: 0; bottom: -1px;
    height: 1px;
    background: linear-gradient(
      90deg,
      transparent 0%,
      color-mix(in srgb, var(--accent-color, #fff) 55%, transparent) 50%,
      transparent 100%
    );
    opacity: 0.6;
    pointer-events: none;
  }

  .odyssey-titlebar__drag {
    flex: 1 1 auto;
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 0 12px;
    min-width: 0;
    cursor: default;
  }

  .odyssey-titlebar__icon {
    width: 16px;
    height: 16px;
    flex-shrink: 0;
    border-radius: 3px;
    object-fit: contain;
    filter: drop-shadow(0 1px 2px rgba(0,0,0,0.45));
    pointer-events: none;
  }

  .odyssey-titlebar__title {
    font-family: var(--font-primary, var(--font-secondary, serif));
    font-size: 13px;
    font-weight: 500;
    letter-spacing: 0.04em;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    color: var(--menu-title-color, var(--text-heading, #fff));
    text-shadow: 0 1px 2px rgba(0,0,0,0.5);
    opacity: 0.92;
    pointer-events: none;
  }

  .odyssey-titlebar__controls {
    display: flex;
    align-items: stretch;
    flex-shrink: 0;
  }

  .odyssey-titlebar__btn {
    width: 46px;
    height: 100%;
    background: transparent;
    border: 0;
    margin: 0;
    padding: 0;
    color: inherit;
    opacity: 0.8;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: background 0.15s ease, color 0.15s ease, opacity 0.15s ease;
    -webkit-app-region: no-drag;
  }
  .odyssey-titlebar__btn:hover,
  .odyssey-titlebar__btn:focus-visible {
    background: color-mix(in srgb, var(--accent-color, #fff) 18%, transparent);
    opacity: 1;
    outline: none;
  }
  .odyssey-titlebar__btn:active {
    background: color-mix(in srgb, var(--accent-color, #fff) 28%, transparent);
  }
  .odyssey-titlebar__btn--close:hover,
  .odyssey-titlebar__btn--close:focus-visible {
    background: var(--color-danger, #dc3545);
    color: #fff;
  }
  .odyssey-titlebar__btn--close:active {
    background: var(--color-danger-hover, #c82333);
  }

  .odyssey-titlebar__btn svg {
    width: 10px;
    height: 10px;
    stroke: currentColor;
    fill: none;
    stroke-width: 1.2;
    shape-rendering: geometricPrecision;
  }

  /* Theme-specific flourishes keyed off data-theme on <html>. These
     piggy-back on whatever theme.js has already set, so no JS needed. */
  html[data-theme="matrix"] .odyssey-titlebar {
    border-bottom-color: rgba(0,255,0,0.35);
    font-family: monospace;
  }
  html[data-theme="matrix"] .odyssey-titlebar__title {
    font-family: monospace;
    text-shadow: 0 0 6px rgba(0,255,0,0.7);
  }
  html[data-theme="bliss"] .odyssey-titlebar {
    background:
      linear-gradient(
        180deg,
        rgba(255,255,255,0.55) 0%,
        rgba(255,255,255,0.20) 100%
      );
    border-bottom-color: rgba(255,255,255,0.75);
  }
  html[data-theme="starry"] .odyssey-titlebar::after {
    opacity: 0.85;
  }
  html[data-theme="light"] .odyssey-titlebar {
    color: var(--text-heading, #000);
  }

  @media (prefers-reduced-motion: reduce) {
    .odyssey-titlebar,
    .odyssey-titlebar__btn { transition: none; }
  }
  `;

  function injectStyle() {
    if (document.getElementById('odyssey-titlebar-style')) return;
    const style = document.createElement('style');
    style.id = 'odyssey-titlebar-style';
    style.textContent = css;
    // Prepend so authors can override if they really want to.
    (document.head || document.documentElement).prepend(style);
  }

  // --- Markup -----------------------------------------------------------
  function buildBar() {
    const bar = document.createElement('div');
    bar.className = 'odyssey-titlebar';
    bar.setAttribute('role', 'toolbar');
    bar.setAttribute('aria-label', 'Window controls');

    const drag = document.createElement('div');
    drag.className = 'odyssey-titlebar__drag';
    // Tauri 2 honors this attribute for native drag + double-click maximize.
    drag.setAttribute('data-tauri-drag-region', '');

    const icon = document.createElement('img');
    icon.className = 'odyssey-titlebar__icon';
    icon.alt = '';
    icon.src = 'assets/odyssey.ico';
    icon.setAttribute('data-tauri-drag-region', '');
    icon.onerror = () => { icon.remove(); };

    const title = document.createElement('span');
    title.className = 'odyssey-titlebar__title';
    title.setAttribute('data-tauri-drag-region', '');
    title.textContent = document.title || 'Odyssey';

    drag.appendChild(icon);
    drag.appendChild(title);

    const controls = document.createElement('div');
    controls.className = 'odyssey-titlebar__controls';

    const svgMin = `<svg viewBox="0 0 10 10"><line x1="1.5" y1="5" x2="8.5" y2="5"/></svg>`;
    const svgMaxRestore = `<svg class="odyssey-ic-max"   viewBox="0 0 10 10"><rect x="1.5" y="1.5" width="7" height="7"/></svg>
                            <svg class="odyssey-ic-restore" viewBox="0 0 10 10" style="display:none">
                              <rect x="1" y="3" width="6" height="6"/>
                              <path d="M3 3 V1 H9 V7 H7"/>
                            </svg>`;
    const svgClose = `<svg viewBox="0 0 10 10"><line x1="1.5" y1="1.5" x2="8.5" y2="8.5"/><line x1="8.5" y1="1.5" x2="1.5" y2="8.5"/></svg>`;

    const btnMin = document.createElement('button');
    btnMin.type = 'button';
    btnMin.className = 'odyssey-titlebar__btn odyssey-titlebar__btn--min';
    btnMin.setAttribute('aria-label', 'Minimize');
    btnMin.title = 'Minimize';
    btnMin.innerHTML = svgMin;

    const btnMax = document.createElement('button');
    btnMax.type = 'button';
    btnMax.className = 'odyssey-titlebar__btn odyssey-titlebar__btn--max';
    btnMax.setAttribute('aria-label', 'Maximize');
    btnMax.title = 'Maximize';
    btnMax.innerHTML = svgMaxRestore;

    const btnClose = document.createElement('button');
    btnClose.type = 'button';
    btnClose.className = 'odyssey-titlebar__btn odyssey-titlebar__btn--close';
    btnClose.setAttribute('aria-label', 'Close');
    btnClose.title = 'Close';
    btnClose.innerHTML = svgClose;

    controls.append(btnMin, btnMax, btnClose);
    bar.append(drag, controls);

    return { bar, title, btnMin, btnMax, btnClose };
  }

  // --- Tauri wiring ------------------------------------------------------
  function getWindow() {
    const t = window.__TAURI__;
    if (!t) return null;
    // Tauri v2 path
    if (t.window && typeof t.window.getCurrentWindow === 'function') {
      try { return t.window.getCurrentWindow(); } catch (_) { /* noop */ }
    }
    // Fallback: older exposed helpers
    if (t.window && typeof t.window.getCurrent === 'function') {
      try { return t.window.getCurrent(); } catch (_) { /* noop */ }
    }
    return null;
  }

  async function wireControls(els) {
    const w = getWindow();
    if (!w) {
      // Browser preview — keep the bar visible (looks nice) but disable buttons.
      els.btnMin.disabled = true;
      els.btnMax.disabled = true;
      els.btnClose.disabled = true;
      [els.btnMin, els.btnMax, els.btnClose].forEach(b => { b.style.opacity = 0.35; b.style.cursor = 'not-allowed'; });
      return;
    }

    els.btnMin.addEventListener('click', () => { w.minimize().catch(console.error); });
    els.btnClose.addEventListener('click', () => { w.close().catch(console.error); });
    els.btnMax.addEventListener('click', () => { w.toggleMaximize().catch(console.error); });

    const icMax = els.btnMax.querySelector('.odyssey-ic-max');
    const icRestore = els.btnMax.querySelector('.odyssey-ic-restore');

    async function syncMaxState() {
      try {
        const isMax = await w.isMaximized();
        if (icMax && icRestore) {
          icMax.style.display     = isMax ? 'none'  : '';
          icRestore.style.display = isMax ? ''      : 'none';
        }
        els.btnMax.setAttribute('aria-label', isMax ? 'Restore' : 'Maximize');
        els.btnMax.title = isMax ? 'Restore' : 'Maximize';
        document.documentElement.toggleAttribute('data-window-maximized', isMax);
      } catch (_) { /* ignore */ }
    }

    syncMaxState();
    // Listen for resize events from Tauri so the max/restore glyph stays accurate.
    try {
      await w.onResized(() => syncMaxState());
    } catch (_) {
      // Fallback: poll cheaply on window resize.
      window.addEventListener('resize', syncMaxState);
    }
  }

  // --- Lifecycle --------------------------------------------------------
  function boot() {
    injectStyle();
    if (document.querySelector('.odyssey-titlebar')) return; // already installed

    const els = buildBar();
    // Put the bar first in <body> so it never fights z-index wars with
    // modals that sit at the end of the DOM.
    document.body.prepend(els.bar);

    // Keep the title label in sync with document.title if pages change it.
    const onTitleChange = () => { els.title.textContent = document.title || 'Odyssey'; };
    const titleEl = document.querySelector('head > title');
    if (titleEl && 'MutationObserver' in window) {
      new MutationObserver(onTitleChange).observe(titleEl, { childList: true });
    }

    wireControls(els);

    // Public API for pages that want a different display label.
    window.odysseyTitlebar = {
      setTitle(text) { els.title.textContent = String(text ?? document.title); },
      element: els.bar
    };
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot, { once: true });
  } else {
    boot();
  }
})();
