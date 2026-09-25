// ============================================================
// USAGE-TRACKER.JS - OpenRouter token usage and spend tracking
// ============================================================
// OpenRouter returns a `usage` object (tokens and `cost` in USD credits) on every response,
// in the last SSE message when streaming. Wrapping fetch here records it for every call the
// app makes (game turns, helper checks, summaries, images, speech, embeddings) without each
// call site having to remember to.

(function () {
    if (window.OdysseyUsage) return;

    const LIFETIME_KEY = 'jsonAdventure_usageLifetime';
    const SESSION_KEY = 'jsonAdventure_usageSession';
    const TOTAL_FIELDS = ['cost', 'promptTokens', 'completionTokens', 'reasoningTokens', 'cachedTokens', 'calls'];
    const listeners = new Set();
    let activeScope = null;

    function emptyTotals() {
        return { cost: 0, promptTokens: 0, completionTokens: 0, reasoningTokens: 0, cachedTokens: 0, calls: 0 };
    }

    function addTotals(target, usage) {
        TOTAL_FIELDS.forEach(field => {
            target[field] = (Number(target[field]) || 0) + (Number(usage?.[field]) || 0);
        });
        return target;
    }

    function normalizeUsage(raw) {
        if (!raw || typeof raw !== 'object') return null;
        const num = value => (Number.isFinite(Number(value)) ? Number(value) : 0);
        const usage = {
            cost: num(raw.cost),
            promptTokens: num(raw.prompt_tokens),
            completionTokens: num(raw.completion_tokens),
            reasoningTokens: num(raw.completion_tokens_details?.reasoning_tokens),
            cachedTokens: num(raw.prompt_tokens_details?.cached_tokens),
            calls: 1
        };
        return usage.cost || usage.promptTokens || usage.completionTokens ? usage : null;
    }

    function readStored(storage, key) {
        try {
            return addTotals(emptyTotals(), JSON.parse(storage.getItem(key) || '{}'));
        } catch (e) {
            return emptyTotals();
        }
    }

    function writeStored(storage, key, totals) {
        try {
            storage.setItem(key, JSON.stringify(totals));
        } catch (e) { /* storage unavailable */ }
    }

    function record(usage, meta) {
        writeStored(localStorage, LIFETIME_KEY, addTotals(readStored(localStorage, LIFETIME_KEY), usage));
        writeStored(sessionStorage, SESSION_KEY, addTotals(readStored(sessionStorage, SESSION_KEY), usage));
        if (meta.scope) addTotals(meta.scope.totals, usage);
        listeners.forEach(listener => {
            try {
                listener(usage, meta);
            } catch (err) {
                console.warn('Usage listener failed:', err);
            }
        });
    }

    function isOpenRouterUrl(url) {
        try {
            return new URL(url, window.location.href).hostname.endsWith('openrouter.ai');
        } catch (e) {
            return false;
        }
    }

    async function readUsageFromResponse(response) {
        const type = response.headers.get('content-type') || '';
        if (type.includes('text/event-stream')) {
            const text = await response.text();
            let usage = null;
            text.split('\n').forEach(line => {
                const trimmed = line.trim();
                if (!trimmed.startsWith('data:') || !trimmed.includes('"usage"')) return;
                try {
                    const chunk = JSON.parse(trimmed.slice(5).trim());
                    if (chunk.usage) usage = chunk.usage;
                } catch (e) { /* partial or non-JSON line */ }
            });
            return usage;
        }
        if (type.includes('json')) {
            const data = await response.json();
            return data?.usage || null;
        }
        return null;
    }

    const originalFetch = window.fetch ? window.fetch.bind(window) : null;
    if (originalFetch) {
        window.fetch = async function (input, init) {
            const scope = activeScope;
            const response = await originalFetch(input, init);
            const url = typeof input === 'string' ? input : input?.url;
            if (response && response.ok && isOpenRouterUrl(url) && typeof response.clone === 'function') {
                const pending = readUsageFromResponse(response.clone())
                    .then(raw => {
                        const usage = normalizeUsage(raw);
                        if (usage) record(usage, { url, scope });
                    })
                    .catch(err => console.warn('Usage tracking failed:', err));
                if (scope) scope.pending.push(pending);
            }
            return response;
        };
    }

    // A scope collects the usage of every request started while it is active (e.g. one game
    // turn: prompter, lookups, and the main model call). endScope waits for streamed usage.
    function beginScope(kind = 'turn') {
        activeScope = { kind, totals: emptyTotals(), pending: [] };
        return activeScope;
    }

    async function endScope(scope) {
        if (!scope) return null;
        if (activeScope === scope) activeScope = null;
        await Promise.allSettled(scope.pending);
        return scope.totals.calls ? scope.totals : null;
    }

    function formatCost(cost) {
        const value = Number(cost) || 0;
        if (value === 0) return '$0.00';
        if (value < 0.01) return `$${value.toFixed(4)}`;
        if (value < 1) return `$${value.toFixed(3)}`;
        return `$${value.toFixed(2)}`;
    }

    function formatTokens(count) {
        const value = Number(count) || 0;
        if (value >= 1e6) return `${(value / 1e6).toFixed(value >= 1e7 ? 0 : 1)}M`;
        if (value >= 1e3) return `${(value / 1e3).toFixed(value >= 1e4 ? 0 : 1)}k`;
        return String(Math.round(value));
    }

    function describeTotals(totals) {
        if (!totals) return '';
        const lines = [
            `Cost: ${formatCost(totals.cost)}`,
            `Input tokens: ${Math.round(totals.promptTokens).toLocaleString()}`,
            `Output tokens: ${Math.round(totals.completionTokens).toLocaleString()}`
        ];
        if (totals.reasoningTokens) lines.push(`  of which reasoning: ${Math.round(totals.reasoningTokens).toLocaleString()}`);
        if (totals.cachedTokens) lines.push(`Cached input tokens: ${Math.round(totals.cachedTokens).toLocaleString()}`);
        lines.push(`API calls: ${totals.calls}`);
        return lines.join('\n');
    }

    window.OdysseyUsage = {
        emptyTotals,
        addTotals,
        beginScope,
        endScope,
        formatCost,
        formatTokens,
        describeTotals,
        isVisible: () => localStorage.getItem('jsonAdventure_showUsage') !== 'false',
        onRecord(listener) {
            listeners.add(listener);
            return () => listeners.delete(listener);
        },
        getLifetime: () => readStored(localStorage, LIFETIME_KEY),
        getSession: () => readStored(sessionStorage, SESSION_KEY),
        resetLifetime() {
            localStorage.removeItem(LIFETIME_KEY);
            sessionStorage.removeItem(SESSION_KEY);
        }
    };
})();
