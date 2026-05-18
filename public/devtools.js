// ============================================================
// ODYSSEY DEVTOOLS - Cross-page diagnostics overlay
// ============================================================

(function () {
    'use strict';

    if (window.OdysseyDevTools) return;

    const VERSION = '1.0.0';
    const SETTINGS = {
        enabled: 'jsonAdventure_devToolsEnabled',
        showButton: 'jsonAdventure_devToolsShowButton',
        persistLogs: 'jsonAdventure_devToolsPersistLogs',
        captureFetch: 'jsonAdventure_devToolsCaptureFetch',
        captureConsole: 'jsonAdventure_devToolsCaptureConsole',
        captureStorage: 'jsonAdventure_devToolsCaptureStorage',
        captureBridge: 'jsonAdventure_devToolsCaptureBridge',
        captureRag: 'jsonAdventure_devToolsCaptureRag',
        redactSensitive: 'jsonAdventure_devToolsRedactSensitive',
        maxLogs: 'jsonAdventure_devToolsMaxLogs',
        tab: 'jsonAdventure_devToolsLastTab'
    };
    const LOGS_KEY = 'jsonAdventure_devToolsLogs';
    const INTERNAL_KEYS = new Set([LOGS_KEY, SETTINGS.tab]);
    const DEFAULTS = {
        enabled: false,
        showButton: true,
        persistLogs: true,
        captureFetch: true,
        captureConsole: true,
        captureStorage: true,
        captureBridge: true,
        captureRag: true,
        redactSensitive: true,
        maxLogs: 500
    };

    const native = {
        fetch: window.fetch ? window.fetch.bind(window) : null,
        console: {
            log: console.log.bind(console),
            info: console.info.bind(console),
            warn: console.warn.bind(console),
            error: console.error.bind(console),
            debug: console.debug ? console.debug.bind(console) : console.log.bind(console)
        },
        storageGet: Storage.prototype.getItem,
        storageSet: Storage.prototype.setItem,
        storageRemove: Storage.prototype.removeItem,
        storageClear: Storage.prototype.clear
    };

    const state = {
        logs: [],
        selectedLogId: null,
        selectedStorageKey: null,
        tab: native.storageGet.call(localStorage, SETTINGS.tab) || 'logs',
        paused: false,
        root: null,
        button: null,
        layer: null,
        main: null,
        detail: null,
        count: null,
        searchInput: null,
        categorySelect: null,
        levelSelect: null,
        pauseButton: null,
        coreInstalled: false,
        booted: false,
        internalWrite: false,
        renderQueued: false,
        wrapperPolls: 0,
        filters: {
            search: '',
            category: 'all',
            level: 'all'
        }
    };

    function storageGet(key) {
        try {
            return native.storageGet.call(localStorage, key);
        } catch (err) {
            return null;
        }
    }

    function storageSet(key, value) {
        state.internalWrite = true;
        try {
            native.storageSet.call(localStorage, key, String(value));
        } finally {
            state.internalWrite = false;
        }
    }

    function storageRemove(key) {
        state.internalWrite = true;
        try {
            native.storageRemove.call(localStorage, key);
        } finally {
            state.internalWrite = false;
        }
    }

    function readBool(name) {
        const key = SETTINGS[name];
        const raw = storageGet(key);
        if (raw === null || raw === undefined || raw === '') return DEFAULTS[name];
        return raw === 'true';
    }

    function readNumber(name) {
        const key = SETTINGS[name];
        const raw = storageGet(key);
        const fallback = DEFAULTS[name];
        const parsed = parseInt(raw, 10);
        if (!Number.isFinite(parsed)) return fallback;
        return Math.max(100, Math.min(parsed, 5000));
    }

    function isEnabled() {
        return readBool('enabled');
    }

    function canCapture(kind) {
        if (!isEnabled()) return false;
        if (kind === 'fetch') return readBool('captureFetch');
        if (kind === 'console') return readBool('captureConsole');
        if (kind === 'storage') return readBool('captureStorage');
        if (kind === 'bridge') return readBool('captureBridge');
        if (kind === 'rag' || kind === 'retrieval') return readBool('captureRag');
        return true;
    }

    function shouldPersist() {
        return readBool('persistLogs');
    }

    function isSensitiveKey(key) {
        return /api.?key|authorization|bearer|token|password|secret|subscription|credential/i.test(String(key || ''));
    }

    function maskToken(value) {
        const text = String(value || '');
        if (!text) return '';
        if (text.length <= 8) return '[redacted]';
        return `${text.slice(0, 4)}...${text.slice(-4)}`;
    }

    function redactString(value, keyHint = '') {
        let text = String(value);
        if (readBool('redactSensitive')) {
            if (isSensitiveKey(keyHint)) return maskToken(text);
            text = text
                .replace(/Bearer\s+([A-Za-z0-9._\-]{8,})/gi, function (_, token) {
                    return `Bearer ${maskToken(token)}`;
                })
                .replace(/\b(sk-[A-Za-z0-9_\-]{8,})\b/g, function (_, token) {
                    return maskToken(token);
                })
                .replace(/\b(BSA[A-Za-z0-9_\-]{8,})\b/g, function (_, token) {
                    return maskToken(token);
                });
        }
        if (/^data:image\/[^;]+;base64,/i.test(text)) {
            return text.slice(0, 42) + `...[${text.length} chars]`;
        }
        if (/^data:audio\/[^;]+;base64,/i.test(text)) {
            return text.slice(0, 42) + `...[${text.length} chars]`;
        }
        if (text.length > 6000) {
            return text.slice(0, 6000) + `...[truncated ${text.length - 6000} chars]`;
        }
        return text;
    }

    function summarize(value, depth = 0, keyHint = '') {
        if (value === null || value === undefined) return value;
        if (typeof value === 'string') return redactString(value, keyHint);
        if (typeof value === 'number' || typeof value === 'boolean') return value;
        if (typeof value === 'bigint') return value.toString();
        if (typeof value === 'function') return `[Function ${value.name || 'anonymous'}]`;
        if (value instanceof Error) {
            return {
                name: value.name,
                message: redactString(value.message || ''),
                stack: redactString(value.stack || '')
            };
        }
        if (typeof Response !== 'undefined' && value instanceof Response) {
            return {
                status: value.status,
                ok: value.ok,
                url: value.url,
                type: value.type
            };
        }
        if (typeof Request !== 'undefined' && value instanceof Request) {
            return {
                method: value.method,
                url: value.url,
                headers: summarizeHeaders(value.headers)
            };
        }
        if (typeof Headers !== 'undefined' && value instanceof Headers) {
            return summarizeHeaders(value);
        }
        if (typeof Blob !== 'undefined' && value instanceof Blob) {
            return `[Blob ${value.type || 'unknown'} ${value.size} bytes]`;
        }
        if (typeof FormData !== 'undefined' && value instanceof FormData) {
            const out = {};
            value.forEach((entry, key) => {
                out[key] = summarize(entry, depth + 1, key);
            });
            return out;
        }
        if (typeof URLSearchParams !== 'undefined' && value instanceof URLSearchParams) {
            const out = {};
            value.forEach((entry, key) => {
                out[key] = summarize(entry, depth + 1, key);
            });
            return out;
        }
        if (Array.isArray(value)) {
            if (depth > 4) return `[Array ${value.length}]`;
            return value.slice(0, 40).map((item, index) => summarize(item, depth + 1, String(index)));
        }
        if (typeof value === 'object') {
            if (depth > 4) return `[Object ${Object.keys(value).slice(0, 8).join(', ')}]`;
            const out = {};
            Object.keys(value).slice(0, 80).forEach(key => {
                out[key] = summarize(value[key], depth + 1, key);
            });
            return out;
        }
        return String(value);
    }

    function summarizeHeaders(headers) {
        const out = {};
        if (!headers) return out;
        try {
            if (typeof Headers !== 'undefined' && headers instanceof Headers) {
                headers.forEach((value, key) => {
                    out[key] = summarize(value, 0, key);
                });
                return out;
            }
            if (Array.isArray(headers)) {
                headers.forEach(pair => {
                    if (pair && pair.length >= 2) out[pair[0]] = summarize(pair[1], 0, pair[0]);
                });
                return out;
            }
            Object.keys(headers).forEach(key => {
                out[key] = summarize(headers[key], 0, key);
            });
        } catch (err) {
            out.error = 'Unable to read headers';
        }
        return out;
    }

    function summarizeBody(body) {
        if (body === undefined || body === null) return null;
        if (typeof body === 'string') {
            const text = redactString(body);
            try {
                return summarize(JSON.parse(text));
            } catch (err) {
                return text;
            }
        }
        return summarize(body);
    }

    function stableStringify(value) {
        const seen = new WeakSet();
        return JSON.stringify(value, function (key, item) {
            if (typeof item === 'object' && item !== null) {
                if (seen.has(item)) return '[Circular]';
                seen.add(item);
            }
            return item;
        }, 2);
    }

    function nowIso() {
        return new Date().toISOString();
    }

    function getPageName() {
        const path = window.location.pathname || '';
        return path.split('/').pop() || 'page';
    }

    function shortUrl(url) {
        try {
            const parsed = new URL(url, window.location.href);
            const path = parsed.pathname.length > 64 ? parsed.pathname.slice(0, 64) + '...' : parsed.pathname;
            return `${parsed.host}${path}${parsed.search ? '?' + parsed.searchParams.toString().slice(0, 48) : ''}`;
        } catch (err) {
            return String(url || '').slice(0, 96);
        }
    }

    function classifyUrl(url) {
        const lower = String(url || '').toLowerCase();
        if (lower.includes('/chat/completions') || lower.includes('/api/generate') || lower.includes('/api/chat')) return 'api';
        if (lower.includes('/embeddings') || lower.includes('/api/embed') || lower.includes('/embed')) return 'rag';
        if (lower.includes('wikipedia.org') || lower.includes('fandom.com') || lower.includes('westeros.org') || lower.includes('brave.com/res/v1/web/search')) return 'retrieval';
        if (lower.includes('/images/generations') || lower.includes('/images/edits') || lower.includes(':predict')) return 'image';
        if (lower.includes('/audio/') || lower.includes('/tts') || lower.includes('text:synthesize')) return 'tts';
        if (lower.includes('/api/')) return 'api';
        if (lower.includes('jsons/universe-vector-stores') || lower.endsWith('.json')) return 'storage';
        return 'network';
    }

    function getLogIcon(level) {
        if (level === 'error') return 'ERR';
        if (level === 'warning') return 'WARN';
        if (level === 'success') return 'OK';
        return 'INFO';
    }

    function loadLogs() {
        if (!shouldPersist()) return [];
        try {
            const raw = storageGet(LOGS_KEY);
            const parsed = raw ? JSON.parse(raw) : [];
            return Array.isArray(parsed) ? parsed.slice(-readNumber('maxLogs')) : [];
        } catch (err) {
            return [];
        }
    }

    function persistLogs() {
        if (!shouldPersist()) return;
        try {
            storageSet(LOGS_KEY, JSON.stringify(state.logs.slice(-readNumber('maxLogs'))));
        } catch (err) {
            // Storage quota should never break app execution.
        }
    }

    function addLog(entry) {
        if (!entry.force && (!isEnabled() || state.paused)) return null;

        const log = {
            id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
            timestamp: nowIso(),
            page: getPageName(),
            level: entry.level || 'info',
            category: entry.category || 'app',
            title: entry.title || 'Event',
            message: entry.message || '',
            detail: summarize(entry.detail || null),
            durationMs: entry.durationMs,
            status: entry.status,
            method: entry.method,
            url: entry.url
        };

        state.logs.push(log);
        state.logs = state.logs.slice(-readNumber('maxLogs'));
        if (!state.selectedLogId) state.selectedLogId = log.id;
        persistLogs();
        queueRender();
        return log;
    }

    function clearLogs() {
        state.logs = [];
        state.selectedLogId = null;
        storageRemove(LOGS_KEY);
        addLog({
            force: true,
            level: 'info',
            category: 'devtools',
            title: 'Logs cleared',
            message: 'The DevTools log buffer was cleared.'
        });
    }

    function queueRender() {
        if (!state.layer || state.layer.classList.contains('odyssey-devtools-hidden')) {
            updateButtonBadge();
            return;
        }
        if (state.renderQueued) return;
        state.renderQueued = true;
        requestAnimationFrame(() => {
            state.renderQueued = false;
            render();
        });
    }

    function patchFetch() {
        if (!native.fetch || window.fetch.__odysseyDevToolsWrapped) return;
        const wrappedFetch = async function (input, init = {}) {
            if (!canCapture('fetch')) return native.fetch(input, init);

            const started = performance.now();
            const url = typeof input === 'string' || input instanceof URL ? String(input) : input && input.url;
            const method = (init && init.method) || (input && input.method) || 'GET';
            const category = classifyUrl(url);
            const requestDetail = {
                method,
                url,
                headers: summarizeHeaders(init.headers || (input && input.headers)),
                body: summarizeBody(init.body)
            };

            addLog({
                level: 'info',
                category,
                title: `${method} ${shortUrl(url)}`,
                message: 'Fetch request started',
                method,
                url,
                detail: requestDetail
            });

            try {
                const response = await native.fetch(input, init);
                const durationMs = Math.round(performance.now() - started);
                const responseDetail = {
                    method,
                    url,
                    status: response.status,
                    ok: response.ok,
                    headers: summarizeHeaders(response.headers)
                };

                const contentType = response.headers ? response.headers.get('content-type') || '' : '';
                const readable = /json|text|javascript|xml|html/i.test(contentType);
                if (readable) {
                    try {
                        const text = await response.clone().text();
                        responseDetail.body = summarizeBody(text);
                    } catch (err) {
                        responseDetail.body = '[Unable to read response body]';
                    }
                } else if (contentType) {
                    responseDetail.body = `[${contentType} body omitted]`;
                }

                addLog({
                    level: response.ok ? 'success' : 'error',
                    category,
                    title: `${response.status} ${method} ${shortUrl(url)}`,
                    message: response.ok ? 'Fetch request completed' : 'Fetch request failed',
                    method,
                    url,
                    status: response.status,
                    durationMs,
                    detail: responseDetail
                });

                return response;
            } catch (error) {
                addLog({
                    level: 'error',
                    category,
                    title: `${method} ${shortUrl(url)}`,
                    message: 'Fetch request threw an error',
                    method,
                    url,
                    durationMs: Math.round(performance.now() - started),
                    detail: error
                });
                throw error;
            }
        };
        Object.defineProperty(wrappedFetch, '__odysseyDevToolsWrapped', { value: true });
        window.fetch = wrappedFetch;
    }

    function patchConsole() {
        ['log', 'info', 'warn', 'error', 'debug'].forEach(method => {
            if (console[method].__odysseyDevToolsWrapped) return;
            const wrapped = function (...args) {
                native.console[method](...args);
                if (!canCapture('console')) return;
                addLog({
                    level: method === 'error' ? 'error' : method === 'warn' ? 'warning' : 'info',
                    category: 'console',
                    title: `console.${method}`,
                    message: args.map(arg => typeof arg === 'string' ? redactString(arg) : stableStringify(summarize(arg))).join(' '),
                    detail: args
                });
            };
            Object.defineProperty(wrapped, '__odysseyDevToolsWrapped', { value: true });
            console[method] = wrapped;
        });
    }

    function patchStorage() {
        if (Storage.prototype.setItem.__odysseyDevToolsWrapped) return;

        const setItem = function (key, value) {
            const previous = native.storageGet.call(this, key);
            const result = native.storageSet.call(this, key, value);
            if (!state.internalWrite && canCapture('storage') && !INTERNAL_KEYS.has(String(key))) {
                addLog({
                    level: 'info',
                    category: 'storage',
                    title: `localStorage.setItem ${key}`,
                    message: 'Local storage value changed',
                    detail: {
                        key,
                        previous: summarize(previous, 0, key),
                        next: summarize(value, 0, key)
                    }
                });
            }
            return result;
        };

        const removeItem = function (key) {
            const previous = native.storageGet.call(this, key);
            const result = native.storageRemove.call(this, key);
            if (!state.internalWrite && canCapture('storage') && !INTERNAL_KEYS.has(String(key))) {
                addLog({
                    level: 'warning',
                    category: 'storage',
                    title: `localStorage.removeItem ${key}`,
                    message: 'Local storage key removed',
                    detail: { key, previous: summarize(previous, 0, key) }
                });
            }
            return result;
        };

        const clear = function () {
            const result = native.storageClear.call(this);
            if (!state.internalWrite && canCapture('storage')) {
                addLog({
                    level: 'warning',
                    category: 'storage',
                    title: 'localStorage.clear',
                    message: 'Local storage was cleared'
                });
            }
            return result;
        };

        Object.defineProperty(setItem, '__odysseyDevToolsWrapped', { value: true });
        Object.defineProperty(removeItem, '__odysseyDevToolsWrapped', { value: true });
        Object.defineProperty(clear, '__odysseyDevToolsWrapped', { value: true });
        Storage.prototype.setItem = setItem;
        Storage.prototype.removeItem = removeItem;
        Storage.prototype.clear = clear;
    }

    function patchGlobalErrors() {
        window.addEventListener('error', event => {
            addLog({
                level: 'error',
                category: 'runtime',
                title: 'Window error',
                message: event.message || 'Unhandled browser error',
                detail: {
                    filename: event.filename,
                    lineno: event.lineno,
                    colno: event.colno,
                    error: event.error
                }
            });
        });
        window.addEventListener('unhandledrejection', event => {
            addLog({
                level: 'error',
                category: 'runtime',
                title: 'Unhandled promise rejection',
                message: event.reason && event.reason.message ? event.reason.message : String(event.reason || ''),
                detail: event.reason
            });
        });
    }

    function wrapAsync(owner, name, category, label) {
        if (!owner || typeof owner[name] !== 'function' || owner[name].__odysseyDevToolsWrapped) return false;
        const original = owner[name];
        const wrapped = async function (...args) {
            const captureKind = category === 'bridge' ? 'bridge' : category === 'rag' || category === 'retrieval' ? 'rag' : category;
            if (!canCapture(captureKind)) return original.apply(this, args);

            const started = performance.now();
            addLog({
                level: 'info',
                category,
                title: `${label || name} started`,
                message: `Calling ${name}`,
                detail: { args: summarize(args) }
            });

            try {
                const result = await original.apply(this, args);
                addLog({
                    level: 'success',
                    category,
                    title: `${label || name} completed`,
                    message: `${name} completed`,
                    durationMs: Math.round(performance.now() - started),
                    detail: { result: summarize(result) }
                });
                return result;
            } catch (error) {
                addLog({
                    level: 'error',
                    category,
                    title: `${label || name} failed`,
                    message: error && error.message ? error.message : String(error),
                    durationMs: Math.round(performance.now() - started),
                    detail: error
                });
                throw error;
            }
        };
        Object.defineProperty(wrapped, '__odysseyDevToolsWrapped', { value: true });
        Object.defineProperty(wrapped, '__odysseyDevToolsOriginal', { value: original });
        owner[name] = wrapped;
        return true;
    }

    function wrapAvailableFunctions() {
        const chatFunctions = [
            ['runPrompter', 'api', 'Prompter'],
            ['runWikipediaPreCheck', 'retrieval', 'Wikipedia pre-check'],
            ['performWikipediaSearch', 'retrieval', 'Wikipedia search'],
            ['runFandomPreCheck', 'retrieval', 'Fandom pre-check'],
            ['performFandomSearch', 'retrieval', 'Fandom search'],
            ['performBraveSearch', 'retrieval', 'Brave search'],
            ['retrieveVectorRagContext', 'rag', 'Vector RAG'],
            ['sendChatMessage', 'api', 'Game turn'],
            ['regenerateLastAI', 'api', 'Regenerate turn'],
            ['generatePlayerImagePromptText', 'image', 'Image prompt'],
            ['performImageGeneration', 'image', 'Image generation'],
            ['triggerImageGeneration', 'image', 'Image refresh'],
            ['playTTS', 'tts', 'TTS playback'],
            ['saveCurrentGame', 'bridge', 'Save game'],
            ['summarizeOldMessages', 'api', 'Chat summarization']
        ];
        chatFunctions.forEach(([name, category, label]) => wrapAsync(window, name, category, label));

        const setupFunctions = [
            ['initSetupMode', 'app', 'Setup mode'],
            ['autoGenerateForField', 'api', 'Setup auto-generate'],
            ['processWithAI', 'api', 'Setup refine'],
            ['renderPlayerImageStep', 'image', 'Player image step'],
            ['generateSummary', 'api', 'Setup summary'],
            ['generateGameSaveName', 'api', 'Save name generation'],
            ['finishSetup', 'bridge', 'Finish setup'],
            ['launchGame', 'bridge', 'Launch game']
        ];
        setupFunctions.forEach(([name, category, label]) => wrapAsync(window, name, category, label));

        if (window.OdysseyRetrieval && !window.OdysseyRetrieval.__odysseyDevToolsWrapped) {
            [
                ['searchWikipedia', 'retrieval', 'Wikipedia search'],
                ['searchFandom', 'retrieval', 'Fandom search'],
                ['searchBrave', 'retrieval', 'Brave search'],
                ['buildRagContext', 'rag', 'Build RAG context'],
                ['cacheSearchResults', 'rag', 'Cache search results'],
                ['primeUniverseVectorStore', 'rag', 'Prime universe vectors'],
                ['testEmbedding', 'rag', 'Embedding test']
            ].forEach(([name, category, label]) => wrapAsync(window.OdysseyRetrieval, name, category, label));
            Object.defineProperty(window.OdysseyRetrieval, '__odysseyDevToolsWrapped', { value: true });
        }

        if (window.tauriBridge && !window.tauriBridge.__odysseyDevToolsWrapped) {
            Object.keys(window.tauriBridge).forEach(name => {
                if (typeof window.tauriBridge[name] === 'function') {
                    wrapAsync(window.tauriBridge, name, 'bridge', `Tauri ${name}`);
                }
            });
            Object.defineProperty(window.tauriBridge, '__odysseyDevToolsWrapped', { value: true });
        }
    }

    function startWrapperPoll() {
        wrapAvailableFunctions();
        const timer = setInterval(() => {
            state.wrapperPolls += 1;
            wrapAvailableFunctions();
            if (state.wrapperPolls > 80) clearInterval(timer);
        }, 250);
    }

    function injectStyles() {
        if (document.getElementById('odyssey-devtools-style')) return;
        const style = document.createElement('style');
        style.id = 'odyssey-devtools-style';
        style.textContent = `
.odyssey-devtools-button {
    position: fixed;
    right: 20px;
    bottom: 20px;
    width: 54px;
    height: 42px;
    border: 1px solid rgba(255,255,255,0.18);
    border-radius: 8px;
    background: rgba(18, 20, 24, 0.92);
    color: #f4f4f5;
    font: 700 12px/1 system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
    letter-spacing: 0;
    cursor: pointer;
    z-index: 10020;
    box-shadow: 0 12px 28px rgba(0,0,0,0.45);
    backdrop-filter: blur(14px);
}
.odyssey-devtools-button:hover,
.odyssey-devtools-button:focus-visible {
    border-color: #77d4ff;
    color: #ffffff;
}
.odyssey-devtools-button[data-count]::after {
    content: attr(data-count);
    position: absolute;
    top: -8px;
    right: -8px;
    min-width: 18px;
    height: 18px;
    padding: 0 5px;
    border-radius: 999px;
    background: #77d4ff;
    color: #071116;
    font-size: 10px;
    line-height: 18px;
}
.odyssey-devtools-button.odyssey-devtools-hidden,
.odyssey-devtools-layer.odyssey-devtools-hidden {
    display: none !important;
}
.odyssey-devtools-layer {
    position: fixed;
    inset: 0;
    z-index: 10030;
    background: rgba(0,0,0,0.62);
    backdrop-filter: blur(6px);
    color: #e4e4e7;
    font: 13px/1.45 system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
}
.odyssey-devtools-panel {
    position: absolute;
    inset: 28px;
    display: grid;
    grid-template-rows: auto auto 1fr;
    min-width: 0;
    min-height: 0;
    overflow: hidden;
    border: 1px solid rgba(255,255,255,0.15);
    border-radius: 8px;
    background: #101216;
    box-shadow: 0 28px 80px rgba(0,0,0,0.65);
}
.odyssey-devtools-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 16px;
    padding: 14px 16px;
    border-bottom: 1px solid rgba(255,255,255,0.11);
    background: #15191f;
}
.odyssey-devtools-title {
    display: flex;
    align-items: baseline;
    gap: 10px;
    min-width: 0;
}
.odyssey-devtools-title strong {
    color: #ffffff;
    font-size: 15px;
}
.odyssey-devtools-muted {
    color: #9ca3af;
    font-size: 12px;
}
.odyssey-devtools-actions,
.odyssey-devtools-tabs,
.odyssey-devtools-toolbar {
    display: flex;
    align-items: center;
    gap: 8px;
    flex-wrap: wrap;
}
.odyssey-devtools-tabs {
    padding: 10px 16px;
    border-bottom: 1px solid rgba(255,255,255,0.09);
    background: #111419;
}
.odyssey-devtools-tab,
.odyssey-devtools-action,
.odyssey-devtools-tool {
    border: 1px solid rgba(255,255,255,0.13);
    border-radius: 6px;
    background: #1b2028;
    color: #e5e7eb;
    min-height: 32px;
    padding: 0 10px;
    cursor: pointer;
    font: 600 12px/1 system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
}
.odyssey-devtools-tab[aria-selected="true"] {
    border-color: #77d4ff;
    color: #ffffff;
    background: #203140;
}
.odyssey-devtools-action:hover,
.odyssey-devtools-tool:hover,
.odyssey-devtools-tab:hover {
    border-color: rgba(119,212,255,0.75);
}
.odyssey-devtools-body {
    display: grid;
    grid-template-columns: minmax(0, 1fr) minmax(300px, 34%);
    min-height: 0;
}
.odyssey-devtools-main,
.odyssey-devtools-detail {
    min-height: 0;
    overflow: auto;
}
.odyssey-devtools-main {
    border-right: 1px solid rgba(255,255,255,0.09);
}
.odyssey-devtools-detail {
    background: #0d0f13;
}
.odyssey-devtools-toolbar {
    position: sticky;
    top: 0;
    z-index: 1;
    padding: 10px 12px;
    background: #101216;
    border-bottom: 1px solid rgba(255,255,255,0.08);
}
.odyssey-devtools-input,
.odyssey-devtools-select {
    min-height: 32px;
    border: 1px solid rgba(255,255,255,0.13);
    border-radius: 6px;
    background: #0d0f13;
    color: #f4f4f5;
    padding: 0 9px;
    font: 12px/1 system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
}
.odyssey-devtools-input {
    min-width: 240px;
    flex: 1 1 260px;
}
.odyssey-devtools-list {
    display: flex;
    flex-direction: column;
}
.odyssey-devtools-row {
    display: grid;
    grid-template-columns: 84px 58px 92px minmax(0, 1fr) 86px;
    gap: 10px;
    align-items: center;
    width: 100%;
    min-height: 42px;
    padding: 7px 12px;
    border: 0;
    border-bottom: 1px solid rgba(255,255,255,0.07);
    background: transparent;
    color: #e5e7eb;
    text-align: left;
    cursor: pointer;
}
.odyssey-devtools-row:hover,
.odyssey-devtools-row.is-selected {
    background: #171c24;
}
.odyssey-devtools-row-title {
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
}
.odyssey-devtools-pill {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    min-width: 42px;
    height: 20px;
    padding: 0 6px;
    border-radius: 999px;
    font-size: 10px;
    font-weight: 800;
    color: #111827;
    background: #d4d4d8;
}
.odyssey-devtools-pill.info { background: #bae6fd; }
.odyssey-devtools-pill.success { background: #bbf7d0; }
.odyssey-devtools-pill.warning { background: #fde68a; }
.odyssey-devtools-pill.error { background: #fecaca; }
.odyssey-devtools-pre {
    margin: 0;
    padding: 14px;
    color: #e5e7eb;
    white-space: pre-wrap;
    word-break: break-word;
    font: 12px/1.45 ui-monospace, SFMono-Regular, Consolas, "Liberation Mono", monospace;
}
.odyssey-devtools-detail h3,
.odyssey-devtools-section h3 {
    margin: 0;
    padding: 12px 14px;
    color: #ffffff;
    font-size: 13px;
    border-bottom: 1px solid rgba(255,255,255,0.08);
}
.odyssey-devtools-section {
    padding: 12px;
}
.odyssey-devtools-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(190px, 1fr));
    gap: 10px;
}
.odyssey-devtools-kv {
    border: 1px solid rgba(255,255,255,0.09);
    border-radius: 6px;
    background: #15191f;
    padding: 10px;
    min-width: 0;
}
.odyssey-devtools-kv span {
    display: block;
    color: #9ca3af;
    font-size: 11px;
    margin-bottom: 4px;
}
.odyssey-devtools-kv strong {
    display: block;
    color: #ffffff;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
}
.odyssey-devtools-tools {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(210px, 1fr));
    gap: 10px;
    padding: 12px;
}
.odyssey-devtools-tool {
    width: 100%;
    min-height: 42px;
    text-align: left;
}
.odyssey-devtools-empty {
    padding: 24px;
    color: #9ca3af;
}
@media (max-width: 900px) {
    .odyssey-devtools-panel {
        inset: 10px;
    }
    .odyssey-devtools-body {
        grid-template-columns: 1fr;
    }
    .odyssey-devtools-detail {
        display: none;
    }
    .odyssey-devtools-row {
        grid-template-columns: 74px 52px minmax(0, 1fr);
    }
    .odyssey-devtools-row .odyssey-devtools-category,
    .odyssey-devtools-row .odyssey-devtools-duration {
        display: none;
    }
}
`;
        document.head.appendChild(style);
    }

    function ensureUi() {
        if (!document.body) return;
        injectStyles();

        if (!state.button) {
            const button = document.createElement('button');
            button.type = 'button';
            button.className = 'odyssey-devtools-button';
            button.textContent = 'Dev';
            button.title = 'Open Odyssey DevTools';
            button.addEventListener('click', () => open());
            document.body.appendChild(button);
            state.button = button;
        }

        if (!state.layer) {
            const layer = document.createElement('div');
            layer.className = 'odyssey-devtools-layer odyssey-devtools-hidden';
            layer.setAttribute('role', 'dialog');
            layer.setAttribute('aria-modal', 'true');
            layer.setAttribute('aria-label', 'Odyssey DevTools');
            layer.innerHTML = `
<section class="odyssey-devtools-panel">
    <header class="odyssey-devtools-header">
        <div class="odyssey-devtools-title">
            <strong>Odyssey DevTools</strong>
            <span class="odyssey-devtools-muted" id="odyssey-devtools-version">v${VERSION}</span>
            <span class="odyssey-devtools-muted" id="odyssey-devtools-count">0 events</span>
        </div>
        <div class="odyssey-devtools-actions">
            <button type="button" class="odyssey-devtools-action" id="odyssey-devtools-pause">Pause</button>
            <button type="button" class="odyssey-devtools-action" id="odyssey-devtools-export">Export</button>
            <button type="button" class="odyssey-devtools-action" id="odyssey-devtools-clear">Clear</button>
            <button type="button" class="odyssey-devtools-action" id="odyssey-devtools-close">Close</button>
        </div>
    </header>
    <nav class="odyssey-devtools-tabs" aria-label="DevTools sections">
        <button type="button" class="odyssey-devtools-tab" data-tab="logs">Logs</button>
        <button type="button" class="odyssey-devtools-tab" data-tab="api">API</button>
        <button type="button" class="odyssey-devtools-tab" data-tab="rag">RAG</button>
        <button type="button" class="odyssey-devtools-tab" data-tab="state">State</button>
        <button type="button" class="odyssey-devtools-tab" data-tab="storage">Storage</button>
        <button type="button" class="odyssey-devtools-tab" data-tab="tools">Tools</button>
    </nav>
    <div class="odyssey-devtools-body">
        <main class="odyssey-devtools-main" id="odyssey-devtools-main"></main>
        <aside class="odyssey-devtools-detail" id="odyssey-devtools-detail"></aside>
    </div>
</section>`;
            document.body.appendChild(layer);
            state.layer = layer;
            state.main = layer.querySelector('#odyssey-devtools-main');
            state.detail = layer.querySelector('#odyssey-devtools-detail');
            state.count = layer.querySelector('#odyssey-devtools-count');
            state.pauseButton = layer.querySelector('#odyssey-devtools-pause');

            layer.querySelector('#odyssey-devtools-close').addEventListener('click', close);
            layer.querySelector('#odyssey-devtools-clear').addEventListener('click', clearLogs);
            layer.querySelector('#odyssey-devtools-export').addEventListener('click', exportLogs);
            state.pauseButton.addEventListener('click', () => {
                state.paused = !state.paused;
                addLog({
                    force: true,
                    level: 'info',
                    category: 'devtools',
                    title: state.paused ? 'Capture paused' : 'Capture resumed'
                });
                render();
            });
            layer.querySelectorAll('.odyssey-devtools-tab').forEach(button => {
                button.addEventListener('click', () => {
                    state.tab = button.dataset.tab;
                    storageSet(SETTINGS.tab, state.tab);
                    render();
                });
            });
            layer.addEventListener('click', event => {
                if (event.target === layer) close();
            });
        }

        syncVisibility();
    }

    function syncVisibility() {
        if (state.button) {
            const visible = isEnabled() && readBool('showButton');
            state.button.classList.toggle('odyssey-devtools-hidden', !visible);
            updateButtonBadge();
        }
    }

    function updateButtonBadge() {
        if (!state.button) return;
        const errors = state.logs.filter(log => log.level === 'error').length;
        if (errors > 0) state.button.setAttribute('data-count', errors > 99 ? '99+' : String(errors));
        else state.button.removeAttribute('data-count');
    }

    function open() {
        ensureUi();
        if (!state.layer) return;
        state.layer.classList.remove('odyssey-devtools-hidden');
        render();
    }

    function close() {
        if (state.layer) state.layer.classList.add('odyssey-devtools-hidden');
    }

    function setEnabled(value) {
        storageSet(SETTINGS.enabled, value ? 'true' : 'false');
        syncVisibility();
        addLog({
            force: true,
            level: value ? 'success' : 'warning',
            category: 'devtools',
            title: value ? 'DevTools enabled' : 'DevTools disabled',
            message: `Capture is now ${value ? 'enabled' : 'disabled'}.`
        });
    }

    function setSetting(name, value) {
        if (!SETTINGS[name]) return;
        storageSet(SETTINGS[name], typeof value === 'boolean' ? String(value) : value);
        syncVisibility();
        queueRender();
    }

    function getSettingsSnapshot() {
        return {
            enabled: isEnabled(),
            showButton: readBool('showButton'),
            persistLogs: readBool('persistLogs'),
            captureFetch: readBool('captureFetch'),
            captureConsole: readBool('captureConsole'),
            captureStorage: readBool('captureStorage'),
            captureBridge: readBool('captureBridge'),
            captureRag: readBool('captureRag'),
            redactSensitive: readBool('redactSensitive'),
            maxLogs: readNumber('maxLogs')
        };
    }

    function getFilteredLogs() {
        let logs = state.logs;
        if (state.tab === 'api') {
            logs = logs.filter(log => ['api', 'network', 'image', 'tts'].includes(log.category) || log.url);
        } else if (state.tab === 'rag') {
            logs = logs.filter(log => ['rag', 'retrieval'].includes(log.category));
        }
        if (state.filters.category !== 'all') logs = logs.filter(log => log.category === state.filters.category);
        if (state.filters.level !== 'all') logs = logs.filter(log => log.level === state.filters.level);
        const query = state.filters.search.trim().toLowerCase();
        if (query) {
            logs = logs.filter(log => {
                const haystack = `${log.title} ${log.message} ${log.category} ${log.url || ''} ${stableStringify(log.detail || {})}`.toLowerCase();
                return haystack.includes(query);
            });
        }
        return logs.slice().reverse();
    }

    function render() {
        if (!state.layer || state.layer.classList.contains('odyssey-devtools-hidden')) return;
        state.count.textContent = `${state.logs.length} event${state.logs.length === 1 ? '' : 's'}`;
        state.pauseButton.textContent = state.paused ? 'Resume' : 'Pause';

        state.layer.querySelectorAll('.odyssey-devtools-tab').forEach(button => {
            button.setAttribute('aria-selected', button.dataset.tab === state.tab ? 'true' : 'false');
        });

        if (state.tab === 'state') renderStateTab();
        else if (state.tab === 'storage') renderStorageTab();
        else if (state.tab === 'tools') renderToolsTab();
        else renderLogTab();

        updateButtonBadge();
    }

    function renderToolbar(parent) {
        const toolbar = document.createElement('div');
        toolbar.className = 'odyssey-devtools-toolbar';

        const search = document.createElement('input');
        search.className = 'odyssey-devtools-input';
        search.type = 'search';
        search.placeholder = 'Search logs';
        search.value = state.filters.search;
        search.addEventListener('input', () => {
            state.filters.search = search.value;
            render();
        });

        const category = document.createElement('select');
        category.className = 'odyssey-devtools-select';
        const categories = ['all'].concat(Array.from(new Set(state.logs.map(log => log.category))).sort());
        categories.forEach(value => {
            const option = document.createElement('option');
            option.value = value;
            option.textContent = value === 'all' ? 'All categories' : value;
            category.appendChild(option);
        });
        category.value = state.filters.category;
        category.addEventListener('change', () => {
            state.filters.category = category.value;
            render();
        });

        const level = document.createElement('select');
        level.className = 'odyssey-devtools-select';
        ['all', 'info', 'success', 'warning', 'error'].forEach(value => {
            const option = document.createElement('option');
            option.value = value;
            option.textContent = value === 'all' ? 'All levels' : value;
            level.appendChild(option);
        });
        level.value = state.filters.level;
        level.addEventListener('change', () => {
            state.filters.level = level.value;
            render();
        });

        toolbar.append(search, category, level);
        parent.appendChild(toolbar);
    }

    function renderLogTab() {
        state.main.innerHTML = '';
        renderToolbar(state.main);

        const list = document.createElement('div');
        list.className = 'odyssey-devtools-list';
        const logs = getFilteredLogs();

        if (logs.length === 0) {
            const empty = document.createElement('div');
            empty.className = 'odyssey-devtools-empty';
            empty.textContent = 'No matching events.';
            list.appendChild(empty);
        }

        logs.forEach(log => {
            const row = document.createElement('button');
            row.type = 'button';
            row.className = 'odyssey-devtools-row';
            if (log.id === state.selectedLogId) row.classList.add('is-selected');
            row.addEventListener('click', () => {
                state.selectedLogId = log.id;
                renderDetail(log);
                state.main.querySelectorAll('.odyssey-devtools-row').forEach(el => el.classList.remove('is-selected'));
                row.classList.add('is-selected');
            });

            const time = document.createElement('span');
            time.textContent = new Date(log.timestamp).toLocaleTimeString();
            time.className = 'odyssey-devtools-muted';

            const pill = document.createElement('span');
            pill.className = `odyssey-devtools-pill ${log.level}`;
            pill.textContent = getLogIcon(log.level);

            const category = document.createElement('span');
            category.className = 'odyssey-devtools-muted odyssey-devtools-category';
            category.textContent = log.category;

            const title = document.createElement('span');
            title.className = 'odyssey-devtools-row-title';
            title.textContent = log.title;

            const duration = document.createElement('span');
            duration.className = 'odyssey-devtools-muted odyssey-devtools-duration';
            duration.textContent = log.durationMs !== undefined ? `${log.durationMs} ms` : (log.status ? String(log.status) : '');

            row.append(time, pill, category, title, duration);
            list.appendChild(row);
        });

        state.main.appendChild(list);
        const selected = logs.find(log => log.id === state.selectedLogId) || logs[0] || null;
        if (selected) {
            state.selectedLogId = selected.id;
            renderDetail(selected);
        } else {
            renderDetail(null);
        }
    }

    function renderDetail(log) {
        state.detail.innerHTML = '';
        if (!log) {
            const empty = document.createElement('div');
            empty.className = 'odyssey-devtools-empty';
            empty.textContent = 'Select an event to inspect details.';
            state.detail.appendChild(empty);
            return;
        }

        const title = document.createElement('h3');
        title.textContent = log.title;
        const pre = document.createElement('pre');
        pre.className = 'odyssey-devtools-pre';
        pre.textContent = stableStringify(log);
        state.detail.append(title, pre);
    }

    function getStateSnapshot() {
        const currentGameId = (typeof window.currentGameFolder !== 'undefined' && window.currentGameFolder)
            || (typeof currentGameFolder !== 'undefined' && currentGameFolder)
            || '';
        let embeddingSettings = null;
        try {
            embeddingSettings = window.OdysseyRetrieval && window.OdysseyRetrieval.getEmbeddingSettings
                ? window.OdysseyRetrieval.getEmbeddingSettings()
                : null;
        } catch (err) {
            embeddingSettings = { error: err.message };
        }

        const chatHistory = Array.isArray(window.chatHistory) ? window.chatHistory : [];
        const lastUser = chatHistory.slice().reverse().find(item => item && item.role === 'user');
        const lastAssistant = chatHistory.slice().reverse().find(item => item && item.role === 'assistant');

        return summarize({
            devTools: getSettingsSnapshot(),
            page: {
                name: getPageName(),
                href: window.location.href,
                userAgent: navigator.userAgent
            },
            api: {
                provider: storageGet('jsonAdventure_apiProvider') || 'openrouter',
                baseUrl: storageGet('jsonAdventure_apiBaseUrl') || '',
                model: storageGet('jsonAdventure_openRouterModel') || '',
                imageModel: storageGet('jsonAdventure_openRouterImageModel') || '',
                temperature: storageGet('jsonAdventure_apiTemperature') || '',
                maxTokens: storageGet('jsonAdventure_apiMaxTokens') || ''
            },
            features: {
                image: storageGet('jsonAdventure_enableImage') === 'true',
                autoImage: storageGet('jsonAdventure_enableAutoImage') === 'true',
                webSearch: storageGet('jsonAdventure_enableWebSearch') === 'true',
                fandomSearch: storageGet('jsonAdventure_enableFandomSearch') === 'true',
                braveSearch: storageGet('jsonAdventure_enableBraveSearch') === 'true',
                vectorRag: storageGet('jsonAdventure_enableVectorRag') === 'true'
            },
            retrieval: embeddingSettings,
            game: {
                currentGameId,
                chatHistoryCount: chatHistory.length,
                lastUser,
                lastAssistant,
                summary: window.gameSummaryText || '',
                gameState: window.gamestate || null,
                playerInfo: window.playerInfo || null,
                worldInfo: window.worldInfo || null
            }
        });
    }

    function renderStateTab() {
        state.main.innerHTML = '';
        const snapshot = getStateSnapshot();

        const section = document.createElement('div');
        section.className = 'odyssey-devtools-section';
        const grid = document.createElement('div');
        grid.className = 'odyssey-devtools-grid';

        [
            ['Page', snapshot.page.name],
            ['Provider', snapshot.api.provider],
            ['Model', snapshot.api.model || 'unset'],
            ['Game', snapshot.game.currentGameId || 'none'],
            ['Chat messages', snapshot.game.chatHistoryCount],
            ['Vector RAG', snapshot.features.vectorRag ? 'enabled' : 'disabled']
        ].forEach(([label, value]) => {
            const item = document.createElement('div');
            item.className = 'odyssey-devtools-kv';
            const key = document.createElement('span');
            key.textContent = label;
            const val = document.createElement('strong');
            val.textContent = String(value);
            item.append(key, val);
            grid.appendChild(item);
        });

        section.appendChild(grid);
        const pre = document.createElement('pre');
        pre.className = 'odyssey-devtools-pre';
        pre.textContent = stableStringify(snapshot);
        state.main.append(section, pre);

        state.detail.innerHTML = '<h3>State Snapshot</h3>';
        const detail = document.createElement('pre');
        detail.className = 'odyssey-devtools-pre';
        detail.textContent = stableStringify(snapshot.devTools);
        state.detail.appendChild(detail);
    }

    function getActiveGameId() {
        return (typeof window.currentGameFolder !== 'undefined' && window.currentGameFolder)
            || (typeof currentGameFolder !== 'undefined' && currentGameFolder)
            || '';
    }

    function setActiveGameId(gameId) {
        window.currentGameFolder = gameId;
        try {
            if (typeof currentGameFolder !== 'undefined') currentGameFolder = gameId;
        } catch (err) {
            // Some pages do not load creation.js, so the lexical binding may not exist.
        }
    }

    function updateGameIdInUrl(gameId) {
        try {
            const url = new URL(window.location.href);
            if (url.searchParams.has('id')) {
                url.searchParams.set('id', gameId);
                window.history.replaceState({}, document.title, `${url.pathname}${url.search}${url.hash}`);
            }
        } catch (err) {
        }
    }

    function buildSaveNamePayload() {
        const scenarioText = window.startingScenarioText || '';
        return {
            worldInfo: window.worldInfo || {},
            playerInfo: window.playerInfo || {},
            gameState: window.gamestate || {},
            startingScenario: scenarioText,
            summary: window.gameSummaryText || ''
        };
    }

    async function regenerateActiveSaveName() {
        const currentId = getActiveGameId();
        if (!currentId) throw new Error('No active game save is loaded.');
        if (!window.tauriBridge || typeof window.tauriBridge.renameGame !== 'function') {
            throw new Error('Save folder renaming is only available in the Tauri app.');
        }
        if (typeof window.generateGameSaveName !== 'function') {
            throw new Error('Save name generation is not available on this page.');
        }

        const payload = buildSaveNamePayload();
        const generatedName = await window.generateGameSaveName(payload.summary || '', payload);
        if (!generatedName) throw new Error('The model did not produce a save name.');

        const confirmed = await window.Odyssey.confirm(`Rename the active save from "${currentId}" to "${generatedName}"?`, {
            title: 'Rename Save',
            confirmText: 'Rename'
        });
        if (!confirmed) {
            addLog({
                force: true,
                level: 'warning',
                category: 'devtools',
                title: 'Save rename cancelled',
                message: generatedName
            });
            return;
        }

        const result = await window.tauriBridge.renameGame(currentId, generatedName);
        if (!result || !result.success) {
            throw new Error(result && result.error ? result.error : 'Save rename failed.');
        }

        setActiveGameId(result.folder);
        updateGameIdInUrl(result.folder);
        addLog({
            force: true,
            level: 'success',
            category: 'bridge',
            title: 'Game save name regenerated',
            message: `${result.previous} -> ${result.folder}`,
            detail: result
        });
        window.alert(`Save renamed to "${result.folder}".`);
    }

    function getStorageSnapshot() {
        const out = {};
        try {
            for (let i = 0; i < localStorage.length; i++) {
                const key = localStorage.key(i);
                if (!key || !key.startsWith('jsonAdventure_')) continue;
                out[key] = summarize(storageGet(key), 0, key);
            }
        } catch (err) {
            out.error = err.message;
        }
        return out;
    }

    function renderStorageTab() {
        state.main.innerHTML = '';
        const toolbar = document.createElement('div');
        toolbar.className = 'odyssey-devtools-toolbar';
        const search = document.createElement('input');
        search.className = 'odyssey-devtools-input';
        search.type = 'search';
        search.placeholder = 'Search storage keys';
        search.value = state.filters.search;
        search.addEventListener('input', () => {
            state.filters.search = search.value;
            renderStorageTab();
        });
        toolbar.appendChild(search);
        state.main.appendChild(toolbar);

        const snapshot = getStorageSnapshot();
        const query = state.filters.search.toLowerCase();
        const keys = Object.keys(snapshot)
            .filter(key => !query || key.toLowerCase().includes(query) || String(snapshot[key]).toLowerCase().includes(query))
            .sort();

        const list = document.createElement('div');
        list.className = 'odyssey-devtools-list';
        if (keys.length === 0) {
            const empty = document.createElement('div');
            empty.className = 'odyssey-devtools-empty';
            empty.textContent = 'No matching Odyssey storage keys.';
            list.appendChild(empty);
        }

        keys.forEach(key => {
            const row = document.createElement('button');
            row.type = 'button';
            row.className = 'odyssey-devtools-row';
            row.style.gridTemplateColumns = 'minmax(220px, 34%) minmax(0, 1fr)';
            if (key === state.selectedStorageKey) row.classList.add('is-selected');
            row.addEventListener('click', () => {
                state.selectedStorageKey = key;
                renderStorageDetail(key, snapshot[key]);
                state.main.querySelectorAll('.odyssey-devtools-row').forEach(el => el.classList.remove('is-selected'));
                row.classList.add('is-selected');
            });
            const keyEl = document.createElement('span');
            keyEl.className = 'odyssey-devtools-row-title';
            keyEl.textContent = key;
            const valueEl = document.createElement('span');
            valueEl.className = 'odyssey-devtools-muted odyssey-devtools-row-title';
            valueEl.textContent = typeof snapshot[key] === 'string' ? snapshot[key] : stableStringify(snapshot[key]).slice(0, 180);
            row.append(keyEl, valueEl);
            list.appendChild(row);
        });
        state.main.appendChild(list);

        const selectedKey = state.selectedStorageKey && Object.prototype.hasOwnProperty.call(snapshot, state.selectedStorageKey)
            ? state.selectedStorageKey
            : keys[0];
        if (selectedKey) {
            state.selectedStorageKey = selectedKey;
            renderStorageDetail(selectedKey, snapshot[selectedKey]);
        } else {
            renderStorageDetail(null, null);
        }
    }

    function renderStorageDetail(key, value) {
        state.detail.innerHTML = '';
        if (!key) {
            state.detail.innerHTML = '<div class="odyssey-devtools-empty">Select a key to inspect its value.</div>';
            return;
        }
        const title = document.createElement('h3');
        title.textContent = key;
        const pre = document.createElement('pre');
        pre.className = 'odyssey-devtools-pre';
        pre.textContent = stableStringify(value);
        state.detail.append(title, pre);
    }

    function makeToolButton(label, handler) {
        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'odyssey-devtools-tool';
        button.textContent = label;
        button.addEventListener('click', async () => {
            const original = button.textContent;
            button.disabled = true;
            button.textContent = `${label}...`;
            try {
                await handler();
            } catch (error) {
                addLog({
                    force: true,
                    level: 'error',
                    category: 'devtools',
                    title: `${label} failed`,
                    message: error && error.message ? error.message : String(error),
                    detail: error
                });
            } finally {
                button.disabled = false;
                button.textContent = original;
                render();
            }
        });
        return button;
    }

    function renderToolsTab() {
        state.main.innerHTML = '';
        const tools = document.createElement('div');
        tools.className = 'odyssey-devtools-tools';

        tools.append(
            makeToolButton('Add marker', async () => {
                addLog({
                    force: true,
                    level: 'info',
                    category: 'marker',
                    title: 'Developer marker',
                    message: 'Manual inspection marker',
                    detail: getStateSnapshot()
                });
            }),
            makeToolButton('Copy state snapshot', async () => {
                await copyText(stableStringify(getStateSnapshot()));
            }),
            makeToolButton('Copy storage snapshot', async () => {
                await copyText(stableStringify(getStorageSnapshot()));
            }),
            makeToolButton('Copy system prompt', async () => {
                const prompt = Array.isArray(window.chatHistory) && window.chatHistory[0] ? window.chatHistory[0].content : '';
                if (!prompt) throw new Error('No system prompt is loaded on this page.');
                await copyText(prompt);
            }),
            makeToolButton('Copy last assistant JSON', async () => {
                const item = Array.isArray(window.chatHistory)
                    ? window.chatHistory.slice().reverse().find(entry => entry && entry.role === 'assistant')
                    : null;
                if (!item) throw new Error('No assistant message is loaded on this page.');
                await copyText(item.content || '');
            }),
            makeToolButton('Run embedding test', async () => {
                if (!window.OdysseyRetrieval || !window.OdysseyRetrieval.testEmbedding) throw new Error('Retrieval layer is not available.');
                const result = await window.OdysseyRetrieval.testEmbedding();
                addLog({
                    force: true,
                    level: result && result.success ? 'success' : 'warning',
                    category: 'rag',
                    title: 'Embedding test result',
                    detail: result
                });
            }),
            makeToolButton('Force save game', async () => {
                if (typeof window.saveCurrentGame !== 'function') throw new Error('saveCurrentGame is not available.');
                await window.saveCurrentGame();
            }),
            makeToolButton('Regenerate save name', async () => regenerateActiveSaveName()),
            makeToolButton('Trigger image refresh', async () => {
                if (typeof window.triggerImageGeneration !== 'function') throw new Error('triggerImageGeneration is not available.');
                await window.triggerImageGeneration();
            }),
            makeToolButton('Regenerate last AI turn', async () => {
                if (typeof window.regenerateLastAI !== 'function') throw new Error('regenerateLastAI is not available.');
                if (!await window.Odyssey.confirm('Regenerate the last AI response? This changes the active game history.', {
                    title: 'Regenerate AI Turn',
                    confirmText: 'Regenerate',
                    danger: true
                })) return;
                await window.regenerateLastAI();
            }),
            makeToolButton('Open settings', async () => {
                if (getPageName() === 'settings.html') return;
                window.location.href = 'settings.html?from=mainmenu';
            }),
            makeToolButton('Export logs', async () => exportLogs()),
            makeToolButton('Clear logs', async () => clearLogs())
        );

        state.main.appendChild(tools);
        state.detail.innerHTML = '<h3>Tools</h3>';
        const pre = document.createElement('pre');
        pre.className = 'odyssey-devtools-pre';
        pre.textContent = stableStringify({
            available: {
                retrieval: !!window.OdysseyRetrieval,
                tauriBridge: !!window.tauriBridge,
                chatHistory: Array.isArray(window.chatHistory),
                saveCurrentGame: typeof window.saveCurrentGame === 'function',
                generateGameSaveName: typeof window.generateGameSaveName === 'function',
                renameGame: typeof window.tauriBridge?.renameGame === 'function',
                triggerImageGeneration: typeof window.triggerImageGeneration === 'function'
            },
            settings: getSettingsSnapshot()
        });
        state.detail.appendChild(pre);
    }

    async function copyText(text) {
        if (navigator.clipboard && navigator.clipboard.writeText) {
            await navigator.clipboard.writeText(text);
        } else {
            const textarea = document.createElement('textarea');
            textarea.value = text;
            textarea.style.position = 'fixed';
            textarea.style.left = '-9999px';
            document.body.appendChild(textarea);
            textarea.select();
            document.execCommand('copy');
            textarea.remove();
        }
        addLog({
            force: true,
            level: 'success',
            category: 'devtools',
            title: 'Copied to clipboard',
            message: `${text.length} characters copied`
        });
    }

    function exportLogs() {
        const payload = {
            exportedAt: nowIso(),
            page: window.location.href,
            settings: getSettingsSnapshot(),
            logs: state.logs
        };
        const blob = new Blob([stableStringify(payload)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `odyssey-devtools-${Date.now()}.json`;
        document.body.appendChild(link);
        link.click();
        link.remove();
        setTimeout(() => URL.revokeObjectURL(url), 1000);
    }

    function setupKeyboardShortcut() {
        window.addEventListener('keydown', event => {
            if (event.ctrlKey && event.shiftKey && event.key.toLowerCase() === 'd') {
                if (!isEnabled()) return;
                event.preventDefault();
                if (state.layer && !state.layer.classList.contains('odyssey-devtools-hidden')) close();
                else open();
            }
            if (event.key === 'Escape' && state.layer && !state.layer.classList.contains('odyssey-devtools-hidden')) {
                close();
            }
        });
    }

    function installCore() {
        if (state.coreInstalled) return;
        state.coreInstalled = true;
        state.logs = loadLogs();
        patchFetch();
        patchConsole();
        patchStorage();
        patchGlobalErrors();
        setupKeyboardShortcut();
        startWrapperPoll();
    }

    function boot() {
        if (state.booted) return;
        state.booted = true;
        installCore();
        ensureUi();
        addLog({
            level: 'info',
            category: 'app',
            title: 'Page loaded',
            message: window.location.href,
            detail: {
                page: getPageName(),
                devTools: getSettingsSnapshot()
            }
        });
    }

    window.OdysseyDevTools = {
        version: VERSION,
        open,
        close,
        addLog,
        clearLogs,
        exportLogs,
        setEnabled,
        setSetting,
        getSettings: getSettingsSnapshot,
        getLogs: () => state.logs.slice(),
        getStateSnapshot,
        syncVisibility,
        settingsKeys: { ...SETTINGS }
    };

    installCore();

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', boot);
    } else {
        boot();
    }
}());
