// ============================================================
// RETRIEVAL.JS - Web/wiki search, embeddings, and vector RAG
// ============================================================

(function () {
    const VECTOR_STORE_VERSION = 1;
    const MAX_CHUNK_CHARS = 1200;
    const CHUNK_OVERLAP_CHARS = 180;
    const universeStoreMemoryCache = new Map();

    const MEDIA_WIKI_PRESETS = {
        'harry potter': {
            name: 'Harry Potter Wiki',
            apiUrl: 'https://harrypotter.fandom.com/api.php',
            pageUrlBase: 'https://harrypotter.fandom.com/wiki/'
        },
        'star wars': {
            name: 'Wookieepedia',
            apiUrl: 'https://starwars.fandom.com/api.php',
            pageUrlBase: 'https://starwars.fandom.com/wiki/'
        },
        'the chronicles of narnia': {
            name: 'The Chronicles of Narnia Wiki',
            apiUrl: 'https://narnia.fandom.com/api.php',
            pageUrlBase: 'https://narnia.fandom.com/wiki/'
        },
        'lord of the rings': {
            name: 'The One Wiki to Rule Them All',
            apiUrl: 'https://lotr.fandom.com/api.php',
            pageUrlBase: 'https://lotr.fandom.com/wiki/'
        },
        'a song of ice and fire': {
            name: 'A Wiki of Ice and Fire',
            apiUrl: 'https://awoiaf.westeros.org/api.php',
            pageUrlBase: 'https://awoiaf.westeros.org/index.php/'
        }
    };

    function normalizePresetKey(value) {
        return String(value || '')
            .trim()
            .toLowerCase()
            .replace(/^none\s*\(custom\)$/i, '');
    }

    function getCurrentGameId() {
        if (typeof currentGameFolder !== 'undefined' && currentGameFolder) return currentGameFolder;
        return window.currentGameFolder || '';
    }

    function cleanHtml(value) {
        const text = String(value || '').replace(/<\/?[^>]+(>|$)/g, ' ');
        const textarea = document.createElement('textarea');
        textarea.innerHTML = text;
        return textarea.value.replace(/\s+/g, ' ').trim();
    }

    function cleanText(value) {
        return cleanHtml(value)
            .replace(/\[[0-9]+\]/g, '')
            .replace(/\s+/g, ' ')
            .trim();
    }

    function truncateText(value, maxChars) {
        const text = cleanText(value);
        if (text.length <= maxChars) return text;
        return text.slice(0, maxChars - 1).trimEnd() + '...';
    }

    function titleToWikiPath(title) {
        return encodeURIComponent(String(title || '').replace(/\s+/g, '_')).replace(/%2F/g, '/');
    }

    function mediaWikiApiFromUrl(wikiUrl) {
        if (!wikiUrl) return '';
        try {
            const url = new URL(wikiUrl);
            if (url.pathname.endsWith('/api.php')) return url.href;
            return `${url.origin}/api.php`;
        } catch (err) {
            return '';
        }
    }

    function mediaWikiPageUrl(config, title, fallbackUrl) {
        if (fallbackUrl) return fallbackUrl;
        if (config && config.pageUrlBase) return config.pageUrlBase + titleToWikiPath(title);
        return '';
    }

    function getWorldWikiConfig(presetKey, worldInfo = window.worldInfo || {}) {
        const key = normalizePresetKey(presetKey || worldInfo?.world?.preset);
        if (MEDIA_WIKI_PRESETS[key]) return { key, ...MEDIA_WIKI_PRESETS[key] };

        const world = worldInfo?.world || {};
        const apiUrl = world.mediaWikiApiUrl || mediaWikiApiFromUrl(world.wikiUrl);
        if (!apiUrl) return null;

        return {
            key: key || cleanStoreKey(world.name || 'custom-world'),
            name: world.wikiName || world.name || 'Custom MediaWiki',
            apiUrl,
            pageUrlBase: world.wikiUrl || ''
        };
    }

    async function fetchJson(url, options = {}) {
        const response = await fetch(url, options);
        if (!response.ok) {
            const detail = await response.text().catch(() => '');
            throw new Error(`HTTP ${response.status}${detail ? ': ' + detail.slice(0, 240) : ''}`);
        }
        return response.json();
    }

    function normalizeSearchResult(result) {
        return {
            sourceType: result.sourceType || 'search',
            sourceName: result.sourceName || result.provider || '',
            title: cleanText(result.title || ''),
            url: result.url || '',
            snippet: truncateText(result.snippet || result.description || '', 700),
            text: truncateText(result.text || result.snippet || result.description || '', 2200),
            query: result.query || '',
            retrievedAt: result.retrievedAt || new Date().toISOString()
        };
    }

    function sortMediaWikiPages(pages) {
        return pages.sort((a, b) => {
            const aIndex = typeof a.index === 'number' ? a.index : 9999;
            const bIndex = typeof b.index === 'number' ? b.index : 9999;
            return aIndex - bIndex;
        });
    }

    async function searchMediaWiki(query, config, options = {}) {
        const count = Math.max(1, Math.min(Number(options.count || 3), 8));
        if (!query || !config || !config.apiUrl) return [];

        const params = new URLSearchParams({
            action: 'query',
            generator: 'search',
            gsrsearch: query,
            gsrlimit: String(count),
            gsrnamespace: '0',
            prop: 'extracts|info',
            exintro: '1',
            explaintext: '1',
            exlimit: 'max',
            inprop: 'url',
            format: 'json',
            origin: '*'
        });

        try {
            const data = await fetchJson(`${config.apiUrl}?${params.toString()}`);
            const pages = sortMediaWikiPages(Object.values(data?.query?.pages || {}));
            if (pages.length > 0) {
                return pages.map(page => normalizeSearchResult({
                    sourceType: options.sourceType || 'mediawiki',
                    sourceName: config.name || 'MediaWiki',
                    title: page.title,
                    url: mediaWikiPageUrl(config, page.title, page.fullurl),
                    snippet: page.extract || '',
                    text: page.extract || '',
                    query
                })).filter(result => result.title && (result.text || result.snippet));
            }
        } catch (err) {
            console.warn('MediaWiki extract search failed, falling back to snippets:', err);
        }

        const fallbackParams = new URLSearchParams({
            action: 'query',
            list: 'search',
            srsearch: query,
            srlimit: String(count),
            srnamespace: '0',
            utf8: '1',
            format: 'json',
            origin: '*'
        });

        try {
            const data = await fetchJson(`${config.apiUrl}?${fallbackParams.toString()}`);
            return (data?.query?.search || []).slice(0, count).map(hit => normalizeSearchResult({
                sourceType: options.sourceType || 'mediawiki',
                sourceName: config.name || 'MediaWiki',
                title: hit.title,
                url: mediaWikiPageUrl(config, hit.title, ''),
                snippet: hit.snippet || '',
                text: hit.snippet || '',
                query
            })).filter(result => result.title && (result.text || result.snippet));
        } catch (err) {
            console.warn('MediaWiki snippet search failed:', err);
            return [];
        }
    }

    async function searchWikipedia(query, count = 3) {
        const config = {
            key: 'wikipedia',
            name: 'Wikipedia',
            apiUrl: 'https://en.wikipedia.org/w/api.php',
            pageUrlBase: 'https://en.wikipedia.org/wiki/'
        };
        const results = await searchMediaWiki(query, config, { count, sourceType: 'wikipedia' });
        await cacheSearchResults(results, { scope: 'game' });
        return results;
    }

    async function searchFandom(query, presetKey, count = 3, worldInfo = window.worldInfo || {}) {
        const config = getWorldWikiConfig(presetKey, worldInfo);
        if (!config) return [];
        const results = await searchMediaWiki(query, config, { count, sourceType: 'fandom' });
        await cacheSearchResults(results, { scope: 'universe', presetKey: config.key });
        return results;
    }

    async function searchBrave(query, count = null) {
        if (localStorage.getItem('jsonAdventure_enableBraveSearch') !== 'true') return [];
        const apiKey = localStorage.getItem('jsonAdventure_braveSearchApiKey') || '';
        if (!apiKey || !query) return [];

        const resultCount = Math.max(1, Math.min(Number(count || localStorage.getItem('jsonAdventure_braveSearchCount') || 3), 10));
        const params = new URLSearchParams({
            q: query,
            count: String(resultCount),
            country: localStorage.getItem('jsonAdventure_braveSearchCountry') || 'us',
            search_lang: localStorage.getItem('jsonAdventure_braveSearchLang') || 'en'
        });

        try {
            const data = await fetchJson(`https://api.search.brave.com/res/v1/web/search?${params.toString()}`, {
                method: 'GET',
                headers: {
                    Accept: 'application/json',
                    'X-Subscription-Token': apiKey
                }
            });

            const results = (data?.web?.results || []).slice(0, resultCount).map(hit => {
                const snippets = Array.isArray(hit.extra_snippets) ? hit.extra_snippets.join(' ') : '';
                return normalizeSearchResult({
                    sourceType: 'brave',
                    sourceName: hit.profile?.long_name || 'Brave Search',
                    title: hit.title,
                    url: hit.url,
                    snippet: hit.description || snippets,
                    text: [hit.description, snippets].filter(Boolean).join('\n'),
                    query
                });
            }).filter(result => result.title && (result.url || result.text));

            await cacheSearchResults(results, { scope: 'game' });
            return results;
        } catch (err) {
            console.warn('Brave search failed:', err);
            return [];
        }
    }

    function formatSearchResults(label, results, maxResults = 3) {
        const usable = (results || []).filter(result => result && (result.text || result.snippet));
        if (usable.length === 0) return '';
        return usable.slice(0, maxResults).map((result, index) => {
            const body = truncateText(result.text || result.snippet, 1100);
            const source = result.url ? `\nSource: ${result.url}` : '';
            return `${label} ${index + 1}: ${result.title}${source}\n${body}`;
        }).join('\n\n');
    }

    function getEmbeddingSettings() {
        const provider = localStorage.getItem('jsonAdventure_embeddingProvider') || 'lmstudio';
        const defaults = {
            lmstudio: 'http://localhost:1234/v1',
            openai: 'https://api.openai.com/v1',
            openai_compatible: 'http://localhost:1234/v1',
            ollama: 'http://localhost:11434'
        };

        return {
            enabled: localStorage.getItem('jsonAdventure_enableVectorRag') === 'true',
            provider,
            baseUrl: (localStorage.getItem('jsonAdventure_embeddingBaseUrl') || defaults[provider] || defaults.lmstudio).trim(),
            apiKey: localStorage.getItem('jsonAdventure_embeddingApiKey') || '',
            model: (localStorage.getItem('jsonAdventure_embeddingModel') || '').trim(),
            topK: Math.max(1, Math.min(Number(localStorage.getItem('jsonAdventure_vectorTopK') || 5), 12)),
            minScore: Math.max(-1, Math.min(Number(localStorage.getItem('jsonAdventure_vectorMinScore') || 0.18), 1))
        };
    }

    function buildOpenAiEmbeddingUrl(baseUrl) {
        const base = (baseUrl || 'https://api.openai.com/v1')
            .replace(/\/embeddings\/?$/, '')
            .replace(/\/+$/, '');
        return `${base}/embeddings`;
    }

    function buildOllamaEmbedUrl(baseUrl) {
        const base = (baseUrl || 'http://localhost:11434')
            .replace(/\/api\/embed\/?$/, '')
            .replace(/\/embed\/?$/, '')
            .replace(/\/+$/, '');
        return base.endsWith('/api') ? `${base}/embed` : `${base}/api/embed`;
    }

    function formatEmbeddingInput(text, role, model) {
        const clean = truncateText(text, 6000);
        const modelId = String(model || '').toLowerCase();
        const prefixPattern = /^(search_document:|search_query:|query:|passage:|represent this sentence for searching relevant passages:)/i;
        if (prefixPattern.test(clean)) return clean;

        if (modelId.includes('nomic')) {
            return role === 'query' ? `search_query: ${clean}` : `search_document: ${clean}`;
        }
        if (modelId.includes('mxbai') || modelId.includes('mixedbread')) {
            return role === 'query' ? `Represent this sentence for searching relevant passages: ${clean}` : clean;
        }
        if (modelId.includes('e5')) {
            return role === 'query' ? `query: ${clean}` : `passage: ${clean}`;
        }
        return clean;
    }

    async function embedTexts(texts, settings = getEmbeddingSettings(), role = 'document') {
        const inputs = (Array.isArray(texts) ? texts : [texts]).map(text => formatEmbeddingInput(text, role, settings.model));
        if (!settings.model) throw new Error('No embedding model configured.');
        if (inputs.length === 0) return [];

        if (settings.provider === 'ollama') {
            const data = await fetchJson(buildOllamaEmbedUrl(settings.baseUrl), {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ model: settings.model, input: inputs })
            });
            if (Array.isArray(data.embeddings)) return data.embeddings;
            if (Array.isArray(data.embedding)) return [data.embedding];
            return [];
        }

        const headers = { 'Content-Type': 'application/json' };
        if (settings.apiKey && String(settings.apiKey).trim()) {
            headers.Authorization = `Bearer ${settings.apiKey}`;
        }

        const data = await fetchJson(buildOpenAiEmbeddingUrl(settings.baseUrl), {
            method: 'POST',
            headers,
            body: JSON.stringify({ model: settings.model, input: inputs })
        });
        return (data?.data || []).map(item => item.embedding).filter(Array.isArray);
    }

    function cleanStoreKey(value) {
        return String(value || 'default')
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, '-')
            .replace(/^-+|-+$/g, '') || 'default';
    }

    function createEmptyStore(scopeId) {
        return {
            version: VECTOR_STORE_VERSION,
            scopeId,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            documents: []
        };
    }

    function normalizeStore(store, scopeId) {
        if (!store || typeof store !== 'object') return createEmptyStore(scopeId);
        if (!Array.isArray(store.documents)) store.documents = [];
        store.version = store.version || VECTOR_STORE_VERSION;
        store.scopeId = store.scopeId || scopeId;
        return store;
    }

    async function loadPremadeUniverseStore(key) {
        const basePath = `jsons/universe-vector-stores/${key}.json`;
        const res = await fetch(basePath, { cache: 'no-store' });
        if (!res.ok) return null;

        const manifest = await res.json();
        let documents = Array.isArray(manifest.documents) ? manifest.documents : [];

        if (Array.isArray(manifest.shards) && manifest.shards.length > 0) {
            const loaded = [];
            for (const shard of manifest.shards) {
                if (!shard?.file) continue;
                const shardRes = await fetch(`jsons/universe-vector-stores/${shard.file}`, { cache: 'no-store' });
                if (!shardRes.ok) continue;
                const shardStore = await shardRes.json();
                if (Array.isArray(shardStore.documents)) loaded.push(...shardStore.documents);
            }
            documents = loaded;
        }

        const store = normalizeStore({ ...manifest, documents }, `universe:${key}`);
        store._premadeStore = true;
        return store;
    }

    async function loadGameVectorStore(gameId = getCurrentGameId()) {
        if (!gameId) return createEmptyStore('game:unsaved');
        if (window.tauriBridge?.loadVectorStore) {
            return normalizeStore(await window.tauriBridge.loadVectorStore(gameId), `game:${gameId}`);
        }
        const raw = localStorage.getItem(`jsonAdventure_vectorStore_game_${gameId}`);
        return normalizeStore(raw ? JSON.parse(raw) : null, `game:${gameId}`);
    }

    async function saveGameVectorStore(store, gameId = getCurrentGameId()) {
        if (!gameId) return;
        store.updatedAt = new Date().toISOString();
        if (window.tauriBridge?.saveVectorStore) {
            await window.tauriBridge.saveVectorStore(gameId, store);
            return;
        }
        localStorage.setItem(`jsonAdventure_vectorStore_game_${gameId}`, JSON.stringify(store));
    }

    async function loadUniverseVectorStore(presetKey) {
        const key = cleanStoreKey(normalizePresetKey(presetKey));
        if (!key) return createEmptyStore('universe:default');
        if (universeStoreMemoryCache.has(key)) return universeStoreMemoryCache.get(key);

        if (window.tauriBridge?.loadUniverseVectorStore) {
            const stored = await window.tauriBridge.loadUniverseVectorStore(key);
            if (stored && Array.isArray(stored.documents) && stored.documents.length > 0) {
                return normalizeStore(stored, `universe:${key}`);
            }
        }

        try {
            const premade = await loadPremadeUniverseStore(key);
            if (premade && premade.documents.length > 0) {
                universeStoreMemoryCache.set(key, premade);
                return premade;
            }
        } catch (err) {
        }

        const raw = localStorage.getItem(`jsonAdventure_vectorStore_universe_${key}`);
        return normalizeStore(raw ? JSON.parse(raw) : null, `universe:${key}`);
    }

    async function saveUniverseVectorStore(presetKey, store) {
        if (store?._premadeStore) return;
        const key = cleanStoreKey(normalizePresetKey(presetKey));
        if (!key) return;
        store.updatedAt = new Date().toISOString();
        if (window.tauriBridge?.saveUniverseVectorStore) {
            await window.tauriBridge.saveUniverseVectorStore(key, store);
            return;
        }
        localStorage.setItem(`jsonAdventure_vectorStore_universe_${key}`, JSON.stringify(store));
    }

    function hashString(value) {
        let hash = 5381;
        const text = String(value || '');
        for (let i = 0; i < text.length; i++) {
            hash = ((hash << 5) + hash) + text.charCodeAt(i);
            hash |= 0;
        }
        return Math.abs(hash).toString(36);
    }

    function chunkText(text) {
        const clean = truncateText(text, 12000);
        if (!clean) return [];
        if (clean.length <= MAX_CHUNK_CHARS) return [clean];

        const chunks = [];
        let index = 0;
        while (index < clean.length) {
            const targetEnd = Math.min(index + MAX_CHUNK_CHARS, clean.length);
            let end = targetEnd;
            const breakPoint = clean.lastIndexOf('. ', targetEnd);
            if (breakPoint > index + 400) end = breakPoint + 1;
            chunks.push(clean.slice(index, end).trim());
            if (end >= clean.length) break;
            index = Math.max(end - CHUNK_OVERLAP_CHARS, index + 1);
        }
        return chunks.filter(Boolean);
    }

    function documentBaseId(doc) {
        const keyParts = [
            doc.scope || 'unknown',
            doc.sourceType || 'document',
            doc.url || '',
            doc.title || '',
            doc.id || ''
        ];
        return hashString(keyParts.join('|'));
    }

    async function upsertDocuments(store, documents, settings = getEmbeddingSettings()) {
        if (!settings.enabled || !settings.model) return false;

        const prepared = [];
        for (const doc of documents || []) {
            const title = cleanText(doc.title || 'Untitled');
            const fullText = cleanText(doc.text || doc.snippet || '');
            if (!fullText) continue;
            const chunks = chunkText(fullText);
            const baseId = documentBaseId({ ...doc, title });
            chunks.forEach((chunk, chunkIndex) => {
                const textHash = hashString(chunk);
                const id = `${baseId}:${chunkIndex}`;
                const existing = store.documents.find(item => item.id === id);
                if (existing && existing.textHash === textHash && Array.isArray(existing.embedding)) return;
                prepared.push({
                    id,
                    textHash,
                    chunk,
                    record: {
                        id,
                        textHash,
                        title,
                        url: doc.url || '',
                        sourceType: doc.sourceType || 'document',
                        sourceName: doc.sourceName || '',
                        scope: doc.scope || store.scopeId || 'game',
                        chunkIndex,
                        text: chunk,
                        query: doc.query || '',
                        embeddingProvider: settings.provider,
                        embeddingModel: settings.model,
                        updatedAt: new Date().toISOString()
                    }
                });
            });
        }

        if (prepared.length === 0) return false;

        const embeddings = await embedTexts(prepared.map(item => item.chunk), settings, 'document');
        let changed = false;
        prepared.forEach((item, index) => {
            const embedding = embeddings[index];
            if (!Array.isArray(embedding) || embedding.length === 0) return;
            const nextRecord = { ...item.record, embedding };
            const existingIndex = store.documents.findIndex(doc => doc.id === item.id);
            if (existingIndex >= 0) store.documents[existingIndex] = nextRecord;
            else store.documents.push(nextRecord);
            changed = true;
        });

        if (store.documents.length > 600) {
            store.documents = store.documents
                .sort((a, b) => String(b.updatedAt || '').localeCompare(String(a.updatedAt || '')))
                .slice(0, 600);
        }

        return changed;
    }

    function sourceDocFromSearchResult(result, scope) {
        return {
            scope,
            sourceType: result.sourceType || 'search',
            sourceName: result.sourceName || '',
            title: result.title || '',
            url: result.url || '',
            text: result.text || result.snippet || '',
            query: result.query || ''
        };
    }

    async function cacheSearchResults(results, options = {}) {
        const settings = getEmbeddingSettings();
        if (!settings.enabled || !settings.model || !Array.isArray(results) || results.length === 0) return;

        try {
            if (options.scope === 'universe') {
                const presetKey = options.presetKey || normalizePresetKey(window.worldInfo?.world?.preset);
                if (!presetKey) return;
                const store = await loadUniverseVectorStore(presetKey);
                if (store?._premadeStore) return;
                const changed = await upsertDocuments(store, results.map(result => sourceDocFromSearchResult(result, `universe:${presetKey}`)), settings);
                if (changed) await saveUniverseVectorStore(presetKey, store);
                return;
            }

            const gameId = getCurrentGameId();
            if (!gameId) return;
            const store = await loadGameVectorStore(gameId);
            const changed = await upsertDocuments(store, results.map(result => sourceDocFromSearchResult(result, `game:${gameId}`)), settings);
            if (changed) await saveGameVectorStore(store, gameId);
        } catch (err) {
            console.warn('Vector cache failed:', err);
        }
    }

    function buildGameInfoDocuments(allData, gameId) {
        const docs = [];
        const worldInfo = allData?.worldInfo || window.worldInfo || {};
        const playerInfo = allData?.playerInfo || window.playerInfo || {};
        const gameState = allData?.gameState || window.gamestate || {};
        const summary = allData?.summaryText || window.gameSummaryText || '';
        const scope = `game:${gameId}`;

        if (Object.keys(worldInfo || {}).length > 0) {
            docs.push({
                id: `${scope}:world`,
                scope,
                sourceType: 'game-world',
                title: 'World Info',
                text: JSON.stringify(worldInfo, null, 2)
            });
        }
        if (Object.keys(playerInfo || {}).length > 0) {
            docs.push({
                id: `${scope}:player`,
                scope,
                sourceType: 'game-player',
                title: 'Player Character',
                text: JSON.stringify(playerInfo, null, 2)
            });
        }
        if (summary) {
            docs.push({
                id: `${scope}:summary`,
                scope,
                sourceType: 'game-summary',
                title: 'Adventure Summary',
                text: summary
            });
        }
        (gameState.npcs || []).forEach(npc => {
            docs.push({
                id: `${scope}:npc:${npc.name}`,
                scope,
                sourceType: 'game-npc',
                title: `NPC - ${npc.name}`,
                text: npc.status_or_history || ''
            });
        });
        (gameState.locations || []).forEach(location => {
            docs.push({
                id: `${scope}:location:${location.name}`,
                scope,
                sourceType: 'game-location',
                title: `Location - ${location.name}`,
                text: location.description || ''
            });
        });

        return docs;
    }

    async function syncGameInfoToVectorStore(allData, settings = getEmbeddingSettings()) {
        const gameId = getCurrentGameId();
        if (!gameId || !settings.enabled || !settings.model) return;
        const store = await loadGameVectorStore(gameId);
        const changed = await upsertDocuments(store, buildGameInfoDocuments(allData, gameId), settings);
        if (changed) await saveGameVectorStore(store, gameId);
    }

    function cosineSimilarity(a, b) {
        if (!Array.isArray(a) || !Array.isArray(b) || a.length !== b.length || a.length === 0) return null;
        let dot = 0;
        let aMag = 0;
        let bMag = 0;
        for (let i = 0; i < a.length; i++) {
            dot += a[i] * b[i];
            aMag += a[i] * a[i];
            bMag += b[i] * b[i];
        }
        if (!aMag || !bMag) return null;
        return dot / (Math.sqrt(aMag) * Math.sqrt(bMag));
    }

    function searchStore(store, queryVector, settings) {
        return (store?.documents || [])
            .map(doc => ({ doc, score: cosineSimilarity(queryVector, doc.embedding) }))
            .filter(item => item.score !== null && item.score >= settings.minScore)
            .sort((a, b) => b.score - a.score);
    }

    function formatRagMatches(matches, topK) {
        const used = new Set();
        const lines = [];
        for (const match of matches) {
            const dedupeKey = `${match.doc.title}|${match.doc.text}`;
            if (used.has(dedupeKey)) continue;
            used.add(dedupeKey);
            const source = match.doc.url ? `\nSource: ${match.doc.url}` : '';
            lines.push(`Memory ${lines.length + 1} (${match.score.toFixed(2)}) - ${match.doc.title}${source}\n${truncateText(match.doc.text, 900)}`);
            if (lines.length >= topK) break;
        }
        return lines.join('\n\n');
    }

    async function buildRagContext(userInput, allData = {}) {
        const settings = getEmbeddingSettings();
        if (!settings.enabled || !settings.model || !userInput) return '';

        try {
            await syncGameInfoToVectorStore(allData, settings);
            const vectors = await embedTexts([userInput], settings, 'query');
            const queryVector = vectors[0];
            if (!Array.isArray(queryVector)) return '';

            const stores = [];
            const gameId = getCurrentGameId();
            if (gameId) stores.push(await loadGameVectorStore(gameId));

            const presetKey = normalizePresetKey(allData?.worldInfo?.world?.preset || window.worldInfo?.world?.preset);
            if (presetKey) stores.push(await loadUniverseVectorStore(presetKey));

            const matches = stores.flatMap(store => searchStore(store, queryVector, settings))
                .sort((a, b) => b.score - a.score);
            return formatRagMatches(matches, settings.topK);
        } catch (err) {
            console.warn('Vector RAG failed:', err);
            return '';
        }
    }

    async function primeUniverseVectorStore(presetKey, queries = []) {
        const key = normalizePresetKey(presetKey);
        if (!key || !MEDIA_WIKI_PRESETS[key]) return { success: false, count: 0 };
        let count = 0;
        for (const query of queries) {
            const results = await searchFandom(query, key, 5);
            count += results.length;
        }
        return { success: true, count };
    }

    async function testEmbedding() {
        const settings = getEmbeddingSettings();
        const vectors = await embedTexts(['Odyssey vector retrieval test.'], { ...settings, enabled: true }, 'query');
        const first = vectors[0] || [];
        return { success: Array.isArray(first) && first.length > 0, dimensions: first.length };
    }

    window.OdysseyRetrieval = {
        MEDIA_WIKI_PRESETS,
        cleanStoreKey,
        getEmbeddingSettings,
        getWorldWikiConfig,
        searchWikipedia,
        searchFandom,
        searchBrave,
        formatSearchResults,
        buildRagContext,
        cacheSearchResults,
        primeUniverseVectorStore,
        testEmbedding
    };
}());
