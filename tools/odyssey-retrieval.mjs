/**
 * Node retrieval for CLI / Telegram.
 * Game-memory vector RAG via embedding APIs + live wiki/web search.
 * Does NOT load premade universe vector stores (e.g. Harry Potter packs).
 */
import path from 'node:path';
import {
  WORLD_PRESETS,
  applyOpenRouterAttributionHeaders,
  callChatCompletions,
  canUseAi,
  getChoiceContentOrThrow,
  getCompletionBudget,
  getOdysseyBaseDir,
  getReasoningPayloadOptions,
  isOpenRouterUrl,
  parseStructuredModelOutput,
  readJsonFile,
  resolveGameDir,
  writeJsonFile
} from './odyssey-core.mjs';

const VECTOR_STORE_VERSION = 1;
const MAX_CHUNK_CHARS = 1200;
const CHUNK_OVERLAP_CHARS = 180;
const GAME_INFO_SOURCE_TYPES = new Set([
  'game-world',
  'game-player',
  'game-state',
  'game-summary',
  'game-inventory',
  'game-npc',
  'game-location'
]);

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
  narnia: {
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

const EMBEDDING_DEFAULT_BASES = {
  lmstudio: 'http://localhost:1234/v1',
  openrouter: 'https://openrouter.ai/api/v1',
  openai: 'https://api.openai.com/v1',
  openai_compatible: 'http://localhost:1234/v1',
  ollama: 'http://localhost:11434'
};

function cleanText(value) {
  return String(value || '')
    .replace(/<\/?[^>]+(>|$)/g, ' ')
    .replace(/\[[0-9]+\]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function truncateText(value, maxChars) {
  const text = cleanText(value);
  if (text.length <= maxChars) return text;
  return `${text.slice(0, maxChars - 1).trimEnd()}...`;
}

function readableValue(value) {
  if (value === undefined || value === null || value === '') return '';
  if (Array.isArray(value)) {
    return value.map(item => readableValue(item)).filter(Boolean).join('; ');
  }
  if (typeof value === 'object') {
    const named = cleanText(value.name || value.title || '');
    const described = cleanText(value.description || value.notes || value.summary || '');
    if (named && described) return `${named}: ${described}`;
    if (named) return named;
    return Object.entries(value)
      .map(([key, nested]) => {
        const text = readableValue(nested);
        return text ? `${key}: ${text}` : '';
      })
      .filter(Boolean)
      .join('; ');
  }
  return cleanText(value);
}

function readableLines(fields) {
  return fields
    .map(([label, value]) => {
      const text = readableValue(value);
      return text ? `${label}: ${text}` : '';
    })
    .filter(Boolean)
    .join('\n');
}

function normalizePresetKey(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/^none\s*\(custom\)$/i, '');
}

export function getRetrievalFlags(settings = {}) {
  return {
    enableVectorRag: Boolean(settings.enableVectorRag),
    enableWebSearch: Boolean(settings.enableWebSearch),
    enableFandomSearch: Boolean(settings.enableFandomSearch),
    enableBraveSearch: Boolean(settings.enableBraveSearch)
  };
}

export function getEmbeddingSettings(settings = {}) {
  const provider = String(settings.embeddingProvider || 'lmstudio').trim().toLowerCase() || 'lmstudio';
  const baseUrl = String(
    settings.embeddingBaseUrl || EMBEDDING_DEFAULT_BASES[provider] || EMBEDDING_DEFAULT_BASES.lmstudio
  ).trim();
  let apiKey = String(settings.embeddingApiKey || '').trim();
  if (!apiKey && (provider === 'openrouter' || isOpenRouterUrl(baseUrl))) {
    apiKey = String(settings.apiKey || '').trim();
  }
  return {
    enabled: Boolean(settings.enableVectorRag),
    provider,
    baseUrl,
    apiKey,
    model: String(settings.embeddingModel || '').trim(),
    topK: Math.max(1, Math.min(Number(settings.vectorTopK || 5), 12)),
    minScore: Math.max(-1, Math.min(Number(settings.vectorMinScore ?? 0.18), 1))
  };
}

async function fetchJson(url, options = {}) {
  const response = await fetch(url, options);
  if (!response.ok) {
    const detail = await response.text().catch(() => '');
    throw new Error(`HTTP ${response.status}${detail ? `: ${detail.slice(0, 240)}` : ''}`);
  }
  return response.json();
}

function titleToWikiPath(title) {
  return encodeURIComponent(String(title || '').replace(/\s+/g, '_')).replace(/%2F/g, '/');
}

function mediaWikiPageUrl(config, title, fallbackUrl) {
  if (fallbackUrl) return fallbackUrl;
  if (!config?.pageUrlBase) return '';
  return `${config.pageUrlBase}${titleToWikiPath(title)}`;
}

function mediaWikiApiFromUrl(wikiUrl) {
  if (!wikiUrl) return '';
  try {
    const url = new URL(wikiUrl);
    if (url.pathname.endsWith('/api.php')) return url.href;
    return `${url.origin}/api.php`;
  } catch {
    return '';
  }
}

export function getWorldWikiConfig(presetKey, worldInfo = {}) {
  const world = worldInfo.world || worldInfo || {};
  const key = normalizePresetKey(presetKey || world.preset || world.name || '');
  const fromPreset = MEDIA_WIKI_PRESETS[key] || null;
  const apiUrl = world.mediaWikiApiUrl || fromPreset?.apiUrl || mediaWikiApiFromUrl(world.wikiUrl);
  if (!apiUrl) return null;
  return {
    key: key || 'custom',
    name: world.wikiName || fromPreset?.name || 'World Wiki',
    apiUrl,
    pageUrlBase: world.wikiUrl || fromPreset?.pageUrlBase || ''
  };
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

export async function searchMediaWiki(query, config, options = {}) {
  const count = Math.max(1, Math.min(Number(options.count || 3), 8));
  if (!query || !config?.apiUrl) return [];

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
  } catch {
    // fall through to snippet search
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
  } catch {
    return [];
  }
}

export async function searchWikipedia(query, count = 3) {
  return searchMediaWiki(query, {
    key: 'wikipedia',
    name: 'Wikipedia',
    apiUrl: 'https://en.wikipedia.org/w/api.php',
    pageUrlBase: 'https://en.wikipedia.org/wiki/'
  }, { count, sourceType: 'wikipedia' });
}

export async function searchFandomLive(query, worldInfo = {}, count = 3) {
  const world = worldInfo.world || worldInfo || {};
  const config = getWorldWikiConfig(world.preset || world.name, worldInfo);
  if (!config) return [];
  return searchMediaWiki(query, config, { count, sourceType: 'fandom' });
}

export async function searchBrave(query, settings = {}, count = null) {
  if (!settings.enableBraveSearch) return [];
  const apiKey = String(settings.braveSearchApiKey || '').trim();
  if (!apiKey || !query) return [];

  const resultCount = Math.max(1, Math.min(Number(count || settings.braveSearchCount || 3), 10));
  const params = new URLSearchParams({
    q: query,
    count: String(resultCount),
    country: settings.braveSearchCountry || 'us',
    search_lang: settings.braveSearchLang || 'en'
  });

  try {
    const data = await fetchJson(`https://api.search.brave.com/res/v1/web/search?${params.toString()}`, {
      method: 'GET',
      headers: {
        Accept: 'application/json',
        'X-Subscription-Token': apiKey
      }
    });
    return (data?.web?.results || []).slice(0, resultCount).map(hit => {
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
  } catch {
    return [];
  }
}

export function formatSearchResults(label, results, maxResults = 3) {
  const usable = (results || []).filter(result => result && (result.text || result.snippet));
  if (!usable.length) return '';
  return usable.slice(0, maxResults).map((result, index) => {
    const body = truncateText(result.text || result.snippet, 1100);
    const source = result.url ? `\nSource: ${result.url}` : '';
    return `${label} ${index + 1}: ${result.title}${source}\n${body}`;
  }).join('\n\n');
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

export async function embedTexts(texts, settings, role = 'document') {
  const inputs = (Array.isArray(texts) ? texts : [texts]).map(text => formatEmbeddingInput(text, role, settings.model));
  if (!settings.model) throw new Error('No embedding model configured.');
  if (!inputs.length) return [];

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
  if (settings.apiKey) headers.Authorization = `Bearer ${settings.apiKey}`;
  applyOpenRouterAttributionHeaders(headers, settings.provider === 'openrouter' ? 'openrouter' : settings.baseUrl);

  const data = await fetchJson(buildOpenAiEmbeddingUrl(settings.baseUrl), {
    method: 'POST',
    headers,
    body: JSON.stringify({ model: settings.model, input: inputs })
  });
  return (data?.data || []).map(item => item.embedding).filter(Array.isArray);
}

function createEmptyStore(scopeId) {
  return {
    version: VECTOR_STORE_VERSION,
    scopeId,
    documents: [],
    updatedAt: new Date().toISOString()
  };
}

function normalizeStore(store, scopeId) {
  if (!store || typeof store !== 'object') return createEmptyStore(scopeId);
  return {
    version: store.version || VECTOR_STORE_VERSION,
    scopeId: store.scopeId || scopeId,
    documents: Array.isArray(store.documents) ? store.documents : [],
    updatedAt: store.updatedAt || new Date().toISOString()
  };
}

async function getGameVectorStorePath(gameId) {
  const gamesDir = path.join(getOdysseyBaseDir(), 'games');
  const gameDir = resolveGameDir(gamesDir, gameId);
  return path.join(gameDir, 'vector_store.json');
}

export async function loadGameVectorStore(gameId) {
  const filePath = await getGameVectorStorePath(gameId);
  const raw = await readJsonFile(filePath, null);
  return normalizeStore(raw, `game:${gameId}`);
}

export async function saveGameVectorStore(store, gameId) {
  const filePath = await getGameVectorStorePath(gameId);
  const next = {
    ...normalizeStore(store, `game:${gameId}`),
    updatedAt: new Date().toISOString()
  };
  await writeJsonFile(filePath, next);
  return next;
}

function hashString(value) {
  let hash = 5381;
  const text = String(value || '');
  for (let i = 0; i < text.length; i += 1) {
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
  return hashString([
    doc.scope || 'unknown',
    doc.sourceType || 'document',
    doc.url || '',
    doc.title || '',
    doc.id || ''
  ].join('|'));
}

function documentRecordBaseId(doc) {
  if (doc?.baseId) return String(doc.baseId);
  const id = String(doc?.id || '');
  const lastColon = id.lastIndexOf(':');
  return lastColon >= 0 ? id.slice(0, lastColon) : id;
}

function embeddingModelMatches(record, settings) {
  const recordModel = String(record?.embeddingModel || '').trim().toLowerCase();
  const settingsModel = String(settings?.model || '').trim().toLowerCase();
  return Boolean(recordModel && settingsModel && recordModel === settingsModel);
}

function buildEmbeddingText(doc, chunk) {
  return [
    doc.title ? `Title: ${doc.title}` : '',
    doc.sourceType ? `Type: ${doc.sourceType}` : '',
    doc.sourceName ? `Source: ${doc.sourceName}` : '',
    doc.query ? `Matched query: ${doc.query}` : '',
    chunk
  ].filter(Boolean).join('\n');
}

async function upsertDocuments(store, documents, settings) {
  if (!settings.enabled || !settings.model) return false;

  const prepared = [];
  for (const doc of documents || []) {
    const title = cleanText(doc.title || 'Untitled');
    const fullText = cleanText(doc.text || doc.snippet || '');
    if (!fullText) continue;
    const chunks = chunkText(fullText);
    const baseId = documentBaseId({ ...doc, title });
    chunks.forEach((chunk, chunkIndex) => {
      const embeddingText = buildEmbeddingText({ ...doc, title }, chunk);
      const textHash = hashString(embeddingText);
      const id = `${baseId}:${chunkIndex}`;
      const existing = store.documents.find(item => item.id === id);
      if (existing && existing.textHash === textHash && Array.isArray(existing.embedding) && embeddingModelMatches(existing, settings)) {
        return;
      }
      prepared.push({
        id,
        baseId,
        textHash,
        embeddingText,
        record: {
          id,
          baseId,
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

  if (!prepared.length) return false;

  const embeddings = await embedTexts(prepared.map(item => item.embeddingText), settings, 'document');
  let changed = false;
  prepared.forEach((item, index) => {
    const embedding = embeddings[index];
    if (!Array.isArray(embedding) || !embedding.length) return;
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

function pruneStoreDocuments(store, scope, sourceTypes, allowedBaseIds) {
  if (!store || !Array.isArray(store.documents)) return false;
  const before = store.documents.length;
  store.documents = store.documents.filter(doc => {
    if (doc.scope !== scope || !sourceTypes.has(doc.sourceType)) return true;
    return allowedBaseIds.has(documentRecordBaseId(doc));
  });
  return store.documents.length !== before;
}

export function buildGameInfoDocuments(allData, gameId) {
  const docs = [];
  const worldInfo = allData?.worldInfo || {};
  const playerInfo = allData?.playerInfo || {};
  const gameState = allData?.gameState || {};
  const summary = allData?.summaryText || allData?.summary || '';
  const scope = `game:${gameId}`;
  const world = worldInfo.world || worldInfo || {};
  const player = playerInfo.player || playerInfo || {};

  if (Object.keys(worldInfo || {}).length > 0) {
    const worldText = readableLines([
      ['World', world.name],
      ['Type', world.type],
      ['Preset', world.preset],
      ['Era', world.era],
      ['Setting', world.setting],
      ['Tone', world.tone],
      ['Rules', world.rules],
      ['Magic or technology', world.magicOrTech],
      ['Dangers', world.dangers],
      ['Factions', world.factions],
      ['Wiki', world.wikiUrl]
    ]) || JSON.stringify(worldInfo, null, 2);
    docs.push({
      id: `${scope}:world`,
      scope,
      sourceType: 'game-world',
      title: 'World Info',
      text: worldText
    });
  }

  if (Object.keys(playerInfo || {}).length > 0) {
    const playerText = readableLines([
      ['Player', player.name],
      ['Age', player.age],
      ['Gender', player.gender],
      ['Height', player.height],
      ['Weight', player.weight],
      ['Athleticism', player.athleticism],
      ['Intelligence', player.intelligence],
      ['Appearance', player.appearance || player.description],
      ['Personality', player.personality],
      ['Backstory', player.backstory],
      ['Family', player.family],
      ['Friends', player.friends],
      ['Starting inventory', player.inventory]
    ]) || JSON.stringify(playerInfo, null, 2);
    docs.push({
      id: `${scope}:player`,
      scope,
      sourceType: 'game-player',
      title: 'Player Character',
      text: playerText
    });
  }

  const stateText = readableLines([
    ['Current time', gameState.time],
    ['Stats', gameState.stats]
  ]);
  if (stateText) {
    docs.push({
      id: `${scope}:state`,
      scope,
      sourceType: 'game-state',
      title: 'Current Game State',
      text: stateText
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

  (gameState.inventory || []).forEach(item => {
    const name = cleanText(item?.name || item?.title || item);
    const itemText = readableLines([
      ['Item', name],
      ['Description', item?.description],
      ['Notes', item?.notes],
      ['Details', item]
    ]);
    if (!itemText) return;
    docs.push({
      id: `${scope}:inventory:${name}`,
      scope,
      sourceType: 'game-inventory',
      title: `Inventory - ${name || 'Unknown Item'}`,
      text: itemText
    });
  });

  (gameState.npcs || []).forEach(npc => {
    const name = cleanText(npc.name || 'Unknown NPC');
    const npcText = readableLines([
      ['NPC', name],
      ['Description', npc.description],
      ['Notes', npc.notes],
      ['Status or history', npc.status_or_history],
      ['History with player', npc.history_with_player],
      ['Inventory', npc.inventory]
    ]);
    if (!npcText) return;
    docs.push({
      id: `${scope}:npc:${name}`,
      scope,
      sourceType: 'game-npc',
      title: `NPC - ${name}`,
      text: npcText
    });
  });

  (gameState.locations || []).forEach(location => {
    const name = cleanText(location.name || 'Unknown Location');
    const subrooms = (location.subrooms || []).map(room => readableLines([
      ['Name', room.name],
      ['Description', room.description],
      ['Items', room.items]
    ])).filter(Boolean);
    const locationText = readableLines([
      ['Location', name],
      ['Description', location.description],
      ['Notes', location.notes],
      ['Items', location.items],
      ['Subrooms', subrooms]
    ]);
    if (!locationText) return;
    docs.push({
      id: `${scope}:location:${name}`,
      scope,
      sourceType: 'game-location',
      title: `Location - ${name}`,
      text: locationText
    });
  });

  return docs;
}

function cosineSimilarity(a, b) {
  if (!Array.isArray(a) || !Array.isArray(b) || a.length !== b.length || a.length === 0) return null;
  let dot = 0;
  let aMag = 0;
  let bMag = 0;
  for (let i = 0; i < a.length; i += 1) {
    dot += a[i] * b[i];
    aMag += a[i] * a[i];
    bMag += b[i] * b[i];
  }
  if (!aMag || !bMag) return null;
  return dot / (Math.sqrt(aMag) * Math.sqrt(bMag));
}

function searchStore(store, queryVector, settings) {
  return (store?.documents || [])
    .filter(doc => embeddingModelMatches(doc, settings))
    .map(doc => ({ doc, score: cosineSimilarity(queryVector, doc.embedding) }))
    .filter(item => item.score !== null && item.score >= settings.minScore)
    .sort((a, b) => b.score - a.score);
}

function ragSourceLabel(doc) {
  if (doc.sourceType === 'fandom') return 'Fandom lore';
  if (doc.sourceType === 'wikipedia') return 'Wikipedia context';
  if (doc.sourceType === 'brave') return 'Web context';
  if (doc.sourceType === 'game-npc') return 'Game NPC';
  if (doc.sourceType === 'game-location') return 'Game location';
  if (doc.sourceType === 'game-inventory') return 'Game inventory';
  if (doc.sourceType === 'game-summary') return 'Adventure summary';
  if (doc.sourceType === 'game-player') return 'Player memory';
  if (doc.sourceType === 'game-world') return 'World memory';
  if (doc.sourceType === 'game-state') return 'Current state';
  return 'Memory';
}

function formatRagMatches(matches, topK) {
  const used = new Set();
  const lines = [];
  for (const match of matches) {
    const dedupeKey = `${match.doc.title}|${match.doc.text}`;
    if (used.has(dedupeKey)) continue;
    used.add(dedupeKey);
    const source = match.doc.url ? `\nSource: ${match.doc.url}` : '';
    lines.push(`${ragSourceLabel(match.doc)} ${lines.length + 1} (${match.score.toFixed(2)}) - ${match.doc.title}${source}\n${truncateText(match.doc.text, 900)}`);
    if (lines.length >= topK) break;
  }
  return lines.join('\n\n');
}

/** Game-store only. Never loads premade universe vector packs. */
export async function buildGameRagContext(userInput, session, settings = {}) {
  const embedding = getEmbeddingSettings(settings);
  if (!embedding.enabled || !embedding.model || !userInput) return '';

  const gameId = session?.id || session?.folder || session?.gameId;
  if (!gameId) return '';

  try {
    const allData = {
      worldInfo: session.worldInfo || {},
      playerInfo: session.playerInfo || {},
      gameState: session.gameState || {},
      summaryText: session.summary || ''
    };
    const store = await loadGameVectorStore(gameId);
    const docs = buildGameInfoDocuments(allData, gameId);
    const allowedBaseIds = new Set(docs.map(doc => documentBaseId(doc)));
    const changed = await upsertDocuments(store, docs, embedding);
    const pruned = pruneStoreDocuments(store, `game:${gameId}`, GAME_INFO_SOURCE_TYPES, allowedBaseIds);
    if (changed || pruned) await saveGameVectorStore(store, gameId);

    const vectors = await embedTexts([userInput], embedding, 'query');
    const queryVector = vectors[0];
    if (!Array.isArray(queryVector)) return '';

    const matches = searchStore(store, queryVector, embedding);
    return formatRagMatches(matches, embedding.topK);
  } catch (err) {
    console.warn(`Game vector RAG failed: ${err.message}`);
    return '';
  }
}

export function buildMatchedCodexLore(session, userInput) {
  const gameState = session?.gameState || {};
  const npcs = gameState.npcs || [];
  const locations = gameState.locations || [];
  const lowerInput = String(userInput || '').toLowerCase();
  if (!lowerInput) return '';

  const loreLines = [];
  for (const npc of npcs) {
    if (npc.name && lowerInput.includes(String(npc.name).toLowerCase())) {
      const npcLore = [
        npc.description ? `Description: ${npc.description}` : '',
        (npc.notes || npc.status_or_history || npc.history_with_player)
          ? `Notes: ${npc.notes || npc.status_or_history || npc.history_with_player}`
          : ''
      ].filter(Boolean).join(' ');
      loreLines.push(`NPC - ${npc.name}: ${npcLore}`);
    }
  }
  for (const loc of locations) {
    if (loc.name && lowerInput.includes(String(loc.name).toLowerCase())) {
      const locationLore = [
        loc.description ? `Description: ${loc.description}` : '',
        loc.notes ? `Notes: ${loc.notes}` : ''
      ].filter(Boolean).join(' ');
      loreLines.push(`Location - ${loc.name}: ${locationLore}`);
    }
  }
  return loreLines.length ? loreLines.join('\n') : '';
}

async function runSearchPrecheck(settings, userInput, kind, universeName = '') {
  if (!canUseAi(settings)) return { needs_search: false, query: '' };

  const prompt = kind === 'fandom'
    ? `You are a search analysis tool analyzing the latest player action in a "${universeName}" universe text-adventure game.
Determine if the user's action involves or mentions a specific lore entity, character, location, faction, or item from this specific universe where the Game Master might need accurate wiki context.

If lore context is needed, set "needs_search" to true and extract a short optimal search query into "search_query".
If the message is a general game action, set "needs_search" to false and leave "search_query" empty.

USER MESSAGE: "${String(userInput).replace(/"/g, '\\"')}"

Output ONLY valid JSON:
{"needs_search": true/false, "search_query": "search terms here or empty"}`
    : `You are a search analysis tool analyzing the latest player action in a modern-day text-adventure game.
Determine if the user's action involves or mentions a specific REAL-WORLD factual entity where the Game Master might need accurate real-world context.

If real-world context is needed, set "needs_search" to true and extract a short optimal search query into "search_query".
If the message is a general game action or fictional content, set "needs_search" to false and leave "search_query" empty.

USER MESSAGE: "${String(userInput).replace(/"/g, '\\"')}"

Output ONLY valid JSON:
{"needs_search": true/false, "search_query": "search terms here or empty"}`;

  try {
    const payloadOptions = getReasoningPayloadOptions(settings, 'helper');
    const helperSettings = {
      ...settings,
      temperature: 0.1,
      maxTokens: getCompletionBudget(Math.min(settings.maxTokens || 1200, 1200), settings, payloadOptions, 400)
    };
    const data = await callChatCompletions(helperSettings, [{ role: 'user', content: prompt }], {
      jsonSchema: {
        type: 'object',
        properties: {
          needs_search: { type: 'boolean' },
          search_query: { type: 'string' }
        },
        required: ['needs_search', 'search_query'],
        additionalProperties: false
      },
      payloadOptions
    });
    const parsed = parseStructuredModelOutput(getChoiceContentOrThrow(data, `${kind} precheck`), [
      'needs_search',
      'search_query'
    ]);
    return {
      needs_search: Boolean(parsed.needs_search),
      query: String(parsed.search_query || '').trim()
    };
  } catch (err) {
    console.warn(`${kind} precheck failed: ${err.message}`);
    return { needs_search: false, query: '' };
  }
}

export async function buildLiveSearchContext(userInput, session, settings = {}) {
  const out = { wikipediaData: '', braveData: '', fandomData: '' };
  const action = String(userInput || '').trim();
  if (!action) return out;

  const tasks = [];

  if (settings.enableWebSearch || settings.enableBraveSearch) {
    tasks.push((async () => {
      const precheck = await runSearchPrecheck(settings, action, 'wikipedia');
      if (!precheck.needs_search || !precheck.query) return;
      const jobs = [];
      if (settings.enableWebSearch) {
        jobs.push(searchWikipedia(precheck.query, 3).then(results => {
          out.wikipediaData = formatSearchResults('WIKIPEDIA RESULT', results);
        }));
      }
      if (settings.enableBraveSearch) {
        jobs.push(searchBrave(precheck.query, settings).then(results => {
          out.braveData = formatSearchResults('BRAVE WEB RESULT', results);
        }));
      }
      await Promise.all(jobs);
    })());
  }

  if (settings.enableFandomSearch) {
    tasks.push((async () => {
      const worldInfo = session?.worldInfo || {};
      const world = worldInfo.world || worldInfo || {};
      const presetKey = normalizePresetKey(world.preset || world.name || '');
      const presetData = WORLD_PRESETS[Object.keys(WORLD_PRESETS).find(key => normalizePresetKey(key) === presetKey)]
        || getWorldWikiConfig(presetKey, worldInfo);
      if (!presetData) return;
      const universeName = presetData.name || world.name || presetKey;
      const precheck = await runSearchPrecheck(settings, action, 'fandom', universeName);
      if (!precheck.needs_search || !precheck.query) return;
      const results = await searchFandomLive(precheck.query, worldInfo, 3);
      out.fandomData = formatSearchResults('LORE WIKI RESULT', results);
    })());
  }

  await Promise.all(tasks);
  return out;
}

/**
 * Build all retrieval channels for a turn (game RAG + live search).
 * Never touches premade universe vector stores.
 */
export async function buildTurnRetrievalContext(userInput, session, settings = {}) {
  const action = String(userInput || '').trim();
  const [ragData, live] = await Promise.all([
    buildGameRagContext(action, session, settings),
    buildLiveSearchContext(action, session, settings)
  ]);
  const matched = buildMatchedCodexLore(session, action);
  return {
    relevantLore: matched,
    ragData: ragData || '',
    wikipediaData: live.wikipediaData || '',
    braveData: live.braveData || '',
    fandomData: live.fandomData || ''
  };
}

