// OpenRouter app attribution headers. OpenRouter uses these to show requests
// under Odyssey in activity logs, rankings, and analytics.
(function () {
    const APP_URL = 'https://github.com/DUR6NA/Odyssey';
    const APP_TITLE = 'Odyssey';
    const APP_CATEGORIES = 'game,roleplay';

    function isOpenRouterProvider(value) {
        return String(value || '').trim().toLowerCase() === 'openrouter';
    }

    function isOpenRouterUrl(value) {
        try {
            const url = new URL(String(value || ''), window.location.href);
            return url.hostname.toLowerCase().includes('openrouter.ai');
        } catch (err) {
            return String(value || '').toLowerCase().includes('openrouter.ai');
        }
    }

    function shouldApply(value) {
        return isOpenRouterProvider(value) || isOpenRouterUrl(value);
    }

    function applyAttributionHeaders(headers, providerOrUrl) {
        if (!headers || !shouldApply(providerOrUrl)) return headers;

        headers['HTTP-Referer'] = APP_URL;
        headers['X-OpenRouter-Title'] = APP_TITLE;
        headers['X-Title'] = APP_TITLE;
        headers['X-OpenRouter-Categories'] = APP_CATEGORIES;
        return headers;
    }

    function buildAuthHeaders(apiKey, providerOrUrl = 'openrouter') {
        const headers = { 'Content-Type': 'application/json' };
        if (apiKey && String(apiKey).trim()) {
            headers.Authorization = `Bearer ${apiKey}`;
        }
        return applyAttributionHeaders(headers, providerOrUrl);
    }

    window.OdysseyOpenRouter = {
        appUrl: APP_URL,
        appTitle: APP_TITLE,
        appCategories: APP_CATEGORIES,
        applyAttributionHeaders,
        buildAuthHeaders,
        isOpenRouterUrl,
        isOpenRouterProvider
    };
})();
