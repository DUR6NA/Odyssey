#!/usr/bin/env node
// Generate distributable Odyssey universe vector stores from MediaWiki APIs.
//
// Example:
//   node tools/generate-universe-vector-store.mjs --universe star-wars --provider ollama --model embeddinggemma
//   node tools/generate-universe-vector-store.mjs --all --provider lmstudio --model text-embedding-nomic-embed-text-v1.5 --limit-pages 0

import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';

const STORE_VERSION = 1;
const DEFAULT_OUTPUT_DIR = path.join('.rag-vector-generation', 'output', 'universe-vector-stores');
const DEFAULT_CACHE_DIR = path.join('.rag-vector-generation', 'cache');
const USER_AGENT = 'OdysseyVectorGenerator/0.6.1-alpha.1 (https://github.com/DUR6NA/Odyssey)';
const MAX_CHUNK_CHARS = 1200;
const CHUNK_OVERLAP_CHARS = 180;
const DEFAULT_SHARD_TARGET_MB = 25;
const DEFAULT_EMBEDDING_DECIMALS = 6;

const ALWAYS_EXCLUDE_TITLE_PATTERNS = [
  /\(disambiguation\)/i,
  /^list(s)? of\b/i,
  /^timeline of\b/i,
  /^user blog:/i,
  /^forum:/i,
  /^\d{1,4}(s)?$/i,
  /^template:/i,
  /^category:/i,
  /^file:/i,
  /^module:/i,
  /^mediawiki:/i,
  /^help:/i,
  /^special:/i,
  /^talk:/i,
  /\/(gallery|appearances|quotes|transcript|credits)$/i,
  /\b(gallery|image gallery|soundtrack|album|credits|transcript)\b/i
];

const ALWAYS_EXCLUDE_CATEGORY_PATTERNS = [
  /disambiguation/i,
  /maintenance/i,
  /cleanup/i,
  /templates/i,
  /images/i,
  /files/i,
  /galleries/i,
  /transcripts/i,
  /soundtracks/i,
  /credits/i,
  /real[- ]world people/i,
  /actors/i,
  /voice actors/i,
  /staff/i,
  /authors/i,
  /artists/i,
  /candidates? for deletion/i,
  /non[- ]notable/i,
  /articles? for improvement/i,
  /stubs?/i
];

const ALWAYS_EXCLUDE_TEXT_PATTERNS = [
  /^"[^"]*"\s*this page is a candidate for deletion/i,
  /\bthis page is a candidate for deletion\b/i,
  /\bthe subject of this article may not meet our notability standards\b/i,
  /\bnot notable\b/i
];

const SIDE_MATERIAL_TITLE_PATTERNS = [
  /\bLEGO\b/i,
  /\bAngry Birds\b/i,
  /\bDisney Infinity\b/i,
  /\bFunko\b/i,
  /\bMinifigures?\b/i,
  /\bTrading Card Game\b/i,
  /\bCollectible Card Game\b/i,
  /\bCustomizable Card Game\b/i,
  /\bMiniatures\b/i,
  /\bboard game\b/i,
  /\bmobile game\b/i,
  /\bvideo game level\b/i,
  /\bwalkthrough\b/i,
  /\bachievement\b/i,
  /\btrophy\b/i
];

const SIDE_MATERIAL_CATEGORY_PATTERNS = [
  /non[- ]canon/i,
  /alternate universe/i,
  /infinities/i,
  /parod(y|ies)/i,
  /lego/i,
  /video games?/i,
  /mobile games?/i,
  /board games?/i,
  /card games?/i,
  /roleplaying game mechanics/i,
  /game mechanics/i,
  /merchandise/i,
  /toys/i,
  /collectibles/i,
  /miniatures/i
];

const UNIVERSES = {
  'harry-potter': {
    key: 'harry-potter',
    aliases: ['harry potter', 'wizarding-world', 'wizarding world'],
    name: 'The Wizarding World',
    wikiName: 'Harry Potter Wiki',
    apiUrl: 'https://harrypotter.fandom.com/api.php',
    pageUrlBase: 'https://harrypotter.fandom.com/wiki/',
    seedQueries: ['Hogwarts', 'Harry Potter', 'Ministry of Magic', 'Death Eaters', 'Diagon Alley'],
    excludeTitlePatterns: [
      /\bHogwarts Mystery\b/i,
      /\bMagic Awakened\b/i,
      /\bWizards Unite\b/i,
      /\bPuzzles? & Spells\b/i,
      /\bQuidditch Champions\b/i
    ],
    excludeCategoryPatterns: [
      /Hogwarts Mystery/i,
      /Magic Awakened/i,
      /Wizards Unite/i,
      /Puzzles? & Spells/i,
      /Quidditch Champions/i
    ]
  },
  'star-wars': {
    key: 'star-wars',
    aliases: ['star wars', 'wookieepedia'],
    name: 'The Star Wars Galaxy',
    wikiName: 'Wookieepedia',
    apiUrl: 'https://starwars.fandom.com/api.php',
    pageUrlBase: 'https://starwars.fandom.com/wiki/',
    seedQueries: ['Darth Vader', 'Jedi Order', 'Sith', 'Tatooine', 'The Force'],
    excludeTitlePatterns: [
      /\bGalaxy of Heroes\b/i,
      /\bForce Arena\b/i,
      /\bStar Wars Commander\b/i,
      /\bStar Wars Uprising\b/i,
      /\bStar Wars Galaxies\b/i,
      /\bStar Wars Miniatures\b/i,
      /\bStar Wars Detours\b/i,
      /\bVisions\b/i
    ],
    excludeCategoryPatterns: [
      /Galaxy of Heroes/i,
      /Force Arena/i,
      /Star Wars Commander/i,
      /Star Wars Uprising/i,
      /Star Wars Galaxies/i,
      /Star Wars Miniatures/i,
      /Star Wars Detours/i,
      /Star Wars Visions/i,
      /Infinities/i
    ]
  },
  'the-chronicles-of-narnia': {
    key: 'the-chronicles-of-narnia',
    aliases: ['the chronicles of narnia', 'chronicles of narnia', 'narnia'],
    name: 'Narnia',
    wikiName: 'The Chronicles of Narnia Wiki',
    apiUrl: 'https://narnia.fandom.com/api.php',
    pageUrlBase: 'https://narnia.fandom.com/wiki/',
    seedQueries: ['Aslan', 'Narnia', 'White Witch', 'Cair Paravel', 'Deep Magic'],
    excludeTitlePatterns: [
      /\bvideo game\b/i
    ],
    excludeCategoryPatterns: [
      /video games?/i
    ]
  },
  'lord-of-the-rings': {
    key: 'lord-of-the-rings',
    aliases: ['lord of the rings', 'lotr', 'middle-earth', 'middle earth'],
    name: 'Middle-earth',
    wikiName: 'The One Wiki to Rule Them All',
    apiUrl: 'https://lotr.fandom.com/api.php',
    pageUrlBase: 'https://lotr.fandom.com/wiki/',
    seedQueries: ['Frodo Baggins', 'Gandalf', 'Sauron', 'Mordor', 'One Ring'],
    excludeTitlePatterns: [
      /\bThe Lord of the Rings Online\b/i,
      /\bShadow of Mordor\b/i,
      /\bShadow of War\b/i,
      /\bBattle for Middle-earth\b/i,
      /\bWar in the North\b/i,
      /\bConquest\b/i,
      /\bMiddle-earth Strategy Battle Game\b/i
    ],
    excludeCategoryPatterns: [
      /The Lord of the Rings Online/i,
      /Shadow of Mordor/i,
      /Shadow of War/i,
      /Battle for Middle-earth/i,
      /War in the North/i,
      /Conquest/i,
      /Strategy Battle Game/i
    ]
  },
  'a-song-of-ice-and-fire': {
    key: 'a-song-of-ice-and-fire',
    aliases: ['a song of ice and fire', 'asoiaf', 'game of thrones', 'westeros'],
    name: 'The Known World (Westeros & Essos)',
    wikiName: 'A Wiki of Ice and Fire',
    apiUrl: 'https://awoiaf.westeros.org/api.php',
    pageUrlBase: 'https://awoiaf.westeros.org/index.php/',
    seedQueries: ['House Stark', 'House Lannister', 'Daenerys Targaryen', 'The Wall', 'Others'],
    excludeTitlePatterns: [
      /^Game of Thrones:/i,
      /^House of the Dragon:/i
    ],
    excludeCategoryPatterns: [
      /Game of Thrones \(TV\)/i,
      /House of the Dragon/i
    ]
  }
};

function printHelp() {
  console.log(`
Generate Odyssey universe vector stores.

Usage:
  node tools/generate-universe-vector-store.mjs --universe star-wars --provider ollama --model embeddinggemma
  node tools/generate-universe-vector-store.mjs --all --provider lmstudio --model text-embedding-nomic-embed-text-v1.5

Universe selection:
  --universe <key>        One universe key or alias. Keys: ${Object.keys(UNIVERSES).join(', ')}
  --all                  Generate every predefined universe.

Embedding options:
  --provider <name>       lmstudio, ollama, openai, openai-compatible. Default: lmstudio
  --base-url <url>        Embedding server base URL.
  --model <id>            Embedding model ID. Defaults: LM Studio text-embedding-nomic-embed-text-v1.5, Ollama embeddinggemma, OpenAI text-embedding-3-small.
  --api-key <key>         Optional API key. Falls back to EMBEDDING_API_KEY or OPENAI_API_KEY.

Scraping options:
  --limit-pages <n>       Max pages per universe. Use 0 for no limit. Default: 250
  --batch-size <n>        MediaWiki allpages batch size. Default: 25
  --embedding-batch <n>   Text chunks per embedding request. Default: 12
  --delay-ms <n>          Delay after MediaWiki requests. Default: 1500
  --embed-delay-ms <n>    Delay after embedding requests. Default: 250
  --min-chars <n>         Skip pages with less plain text. Default: 450
  --include-side-material Include pages that are usually side/non-canon media, such as LEGO/video-game/card-game pages.
  --embedding-decimals <n> Round embedding values to shrink JSON. Default: ${DEFAULT_EMBEDDING_DECIMALS}
  --shard-target-mb <n>   Split distributable store shards around this size. Default: ${DEFAULT_SHARD_TARGET_MB}
  --no-shards             Write one compact JSON file instead of a shard manifest.
  --fresh                 Ignore checkpoint and existing output for the selected universe.
  --dry-run               Print resolved config without making network requests.

Output:
  --output-dir <path>     Default: ${DEFAULT_OUTPUT_DIR}
  --cache-dir <path>      Checkpoints. Default: ${DEFAULT_CACHE_DIR}

Generated stores are written to the ignored .rag-vector-generation workspace by default.
Run "npm run publish:vectors" to copy finished stores into public/jsons/universe-vector-stores for distribution.
`);
}

function parseArgs(argv) {
  const args = {
    universe: '',
    all: false,
    provider: 'lmstudio',
    baseUrl: '',
    model: '',
    apiKey: process.env.EMBEDDING_API_KEY || process.env.OPENAI_API_KEY || '',
    limitPages: 250,
    batchSize: 25,
    embeddingBatch: 12,
    delayMs: 1500,
    embedDelayMs: 250,
    minChars: 450,
    includeSideMaterial: false,
    embeddingDecimals: DEFAULT_EMBEDDING_DECIMALS,
    shardTargetMb: DEFAULT_SHARD_TARGET_MB,
    outputDir: DEFAULT_OUTPUT_DIR,
    cacheDir: DEFAULT_CACHE_DIR,
    fresh: false,
    dryRun: false,
    help: false
  };

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    const next = () => {
      if (i + 1 >= argv.length) throw new Error(`Missing value for ${arg}`);
      return argv[++i];
    };

    switch (arg) {
      case '--help':
      case '-h':
        args.help = true;
        break;
      case '--all':
        args.all = true;
        break;
      case '--universe':
      case '-u':
        args.universe = next();
        break;
      case '--provider':
        args.provider = next();
        break;
      case '--base-url':
        args.baseUrl = next();
        break;
      case '--model':
        args.model = next();
        break;
      case '--api-key':
        args.apiKey = next();
        break;
      case '--limit-pages':
      case '--max-pages':
        args.limitPages = Number(next());
        break;
      case '--batch-size':
        args.batchSize = Number(next());
        break;
      case '--embedding-batch':
      case '--embedding-batch-size':
        args.embeddingBatch = Number(next());
        break;
      case '--delay-ms':
        args.delayMs = Number(next());
        break;
      case '--embed-delay-ms':
        args.embedDelayMs = Number(next());
        break;
      case '--min-chars':
        args.minChars = Number(next());
        break;
      case '--include-side-material':
        args.includeSideMaterial = true;
        break;
      case '--embedding-decimals':
        args.embeddingDecimals = Number(next());
        break;
      case '--shard-target-mb':
        args.shardTargetMb = Number(next());
        break;
      case '--no-shards':
        args.shardTargetMb = 0;
        break;
      case '--output-dir':
        args.outputDir = next();
        break;
      case '--cache-dir':
        args.cacheDir = next();
        break;
      case '--fresh':
        args.fresh = true;
        break;
      case '--dry-run':
        args.dryRun = true;
        break;
      default:
        throw new Error(`Unknown argument: ${arg}`);
    }
  }

  const providerDefaults = {
    lmstudio: {
      baseUrl: 'http://localhost:1234/v1',
      model: 'text-embedding-nomic-embed-text-v1.5'
    },
    ollama: {
      baseUrl: 'http://localhost:11434',
      model: 'embeddinggemma'
    },
    openai: {
      baseUrl: 'https://api.openai.com/v1',
      model: 'text-embedding-3-small'
    },
    'openai-compatible': {
      baseUrl: 'http://localhost:1234/v1',
      model: 'text-embedding-nomic-embed-text-v1.5'
    }
  };

  if (!providerDefaults[args.provider]) {
    throw new Error(`Unsupported provider "${args.provider}". Use lmstudio, ollama, openai, or openai-compatible.`);
  }

  args.baseUrl ||= providerDefaults[args.provider].baseUrl;
  args.model ||= providerDefaults[args.provider].model;
  args.limitPages = Number.isFinite(args.limitPages) ? args.limitPages : 250;
  args.batchSize = clampInt(args.batchSize, 1, 50, 25);
  args.embeddingBatch = clampInt(args.embeddingBatch, 1, 64, 12);
  args.delayMs = clampInt(args.delayMs, 0, 60000, 1500);
  args.embedDelayMs = clampInt(args.embedDelayMs, 0, 60000, 250);
  args.minChars = clampInt(args.minChars, 0, 10000, 450);
  args.embeddingDecimals = clampInt(args.embeddingDecimals, 3, 10, DEFAULT_EMBEDDING_DECIMALS);
  args.shardTargetMb = clampInt(args.shardTargetMb, 0, 100, DEFAULT_SHARD_TARGET_MB);

  return args;
}

function clampInt(value, min, max, fallback) {
  const number = Number(value);
  if (!Number.isFinite(number)) return fallback;
  return Math.max(min, Math.min(Math.trunc(number), max));
}

function resolveUniverses(args) {
  if (args.all) return Object.values(UNIVERSES);
  if (!args.universe) throw new Error('Choose --universe <key> or --all.');

  const wanted = normalizeKey(args.universe);
  const exact = UNIVERSES[wanted];
  if (exact) return [exact];

  const matched = Object.values(UNIVERSES).find(config =>
    config.aliases.some(alias => normalizeKey(alias) === wanted)
  );
  if (!matched) throw new Error(`Unknown universe "${args.universe}". Run --help for keys.`);
  return [matched];
}

function normalizeKey(value) {
  return String(value || '')
    .toLowerCase()
    .replace(/&/g, 'and')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function sleep(ms) {
  return ms > 0 ? new Promise(resolve => setTimeout(resolve, ms)) : Promise.resolve();
}

function titleToPath(title) {
  return encodeURIComponent(String(title || '').replace(/\s+/g, '_')).replace(/%2F/g, '/');
}

function pageUrl(config, title, fullurl) {
  if (fullurl) return fullurl;
  return config.pageUrlBase + titleToPath(title);
}

function cleanHtml(html) {
  return String(html || '')
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<sup[^>]*class="[^"]*reference[^"]*"[\s\S]*?<\/sup>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#039;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/\s+/g, ' ')
    .trim();
}

function cleanText(text) {
  return String(text || '')
    .replace(/\[[0-9]+\]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function matchesPattern(value, patterns = []) {
  return patterns.some(pattern => pattern.test(String(value || '')));
}

function categoryNames(page) {
  return (page.categories || [])
    .map(category => category.title || '')
    .filter(Boolean);
}

function skipReasonForTitle(title, config, args) {
  if (!title) return 'missing title';
  if (matchesPattern(title, ALWAYS_EXCLUDE_TITLE_PATTERNS)) return 'meta/list title';
  if (!args.includeSideMaterial && matchesPattern(title, SIDE_MATERIAL_TITLE_PATTERNS)) return 'side-material title';
  if (!args.includeSideMaterial && matchesPattern(title, config.excludeTitlePatterns || [])) return 'universe side-material title';
  return '';
}

function skipReasonForPage(page, config, args) {
  const titleReason = skipReasonForTitle(page.title, config, args);
  if (titleReason) return titleReason;

  const categories = categoryNames(page);
  if (categories.some(category => matchesPattern(category, ALWAYS_EXCLUDE_CATEGORY_PATTERNS))) {
    return 'meta/maintenance category';
  }
  if (!args.includeSideMaterial && categories.some(category => matchesPattern(category, SIDE_MATERIAL_CATEGORY_PATTERNS))) {
    return 'side-material category';
  }
  if (!args.includeSideMaterial && categories.some(category => matchesPattern(category, config.excludeCategoryPatterns || []))) {
    return 'universe side-material category';
  }
  return '';
}

function skipReasonForText(text) {
  const head = cleanText(text).slice(0, 1200);
  if (matchesPattern(head, ALWAYS_EXCLUDE_TEXT_PATTERNS)) return 'low-notability/delete notice';
  return '';
}

function filterExistingDocuments(store, config, args) {
  if (!Array.isArray(store.documents) || store.documents.length === 0) return 0;
  const before = store.documents.length;
  store.documents = store.documents.filter(doc => {
    if (skipReasonForTitle(doc.title, config, args)) return false;
    if (skipReasonForText(doc.text || '')) return false;
    return true;
  });
  const removed = before - store.documents.length;
  if (removed > 0) {
    store.stats ||= {};
    store.stats.chunksEmbedded = store.documents.length;
    store.stats.chunksRemovedByFilter = (store.stats.chunksRemovedByFilter || 0) + removed;
  }
  return removed;
}

function chunkText(text) {
  const clean = cleanText(text);
  if (!clean) return [];
  if (clean.length <= MAX_CHUNK_CHARS) return [clean];

  const chunks = [];
  let index = 0;
  while (index < clean.length) {
    const targetEnd = Math.min(index + MAX_CHUNK_CHARS, clean.length);
    let end = targetEnd;
    const sentenceBreak = clean.lastIndexOf('. ', targetEnd);
    if (sentenceBreak > index + 400) end = sentenceBreak + 1;

    chunks.push(clean.slice(index, end).trim());
    if (end >= clean.length) break;
    index = Math.max(end - CHUNK_OVERLAP_CHARS, index + 1);
  }
  return chunks.filter(Boolean);
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

async function fetchJson(url, options = {}) {
  const response = await fetch(url, {
    ...options,
    headers: {
      'User-Agent': USER_AGENT,
      Accept: 'application/json',
      ...(options.headers || {})
    }
  });

  if (!response.ok) {
    const detail = await response.text().catch(() => '');
    throw new Error(`HTTP ${response.status}${detail ? ': ' + detail.slice(0, 240) : ''}`);
  }
  return response.json();
}

async function mediaWikiQuery(config, params, delayMs) {
  const url = `${config.apiUrl}?${new URLSearchParams({
    ...params,
    format: 'json',
    origin: '*'
  }).toString()}`;
  const json = await fetchJson(url);
  await sleep(delayMs);
  return json;
}

async function listPages(config, apcontinue, args) {
  const params = {
    action: 'query',
    list: 'allpages',
    apnamespace: '0',
    aplimit: String(args.batchSize),
    apfilterredir: 'nonredirects'
  };
  if (apcontinue) params.apcontinue = apcontinue;
  return mediaWikiQuery(config, params, args.delayMs);
}

async function fetchExtractPages(config, pageIds, args) {
  if (pageIds.length === 0) return [];
  const data = await mediaWikiQuery(config, {
    action: 'query',
    pageids: pageIds.join('|'),
    prop: 'extracts|info|categories',
    explaintext: '1',
    exsectionformat: 'plain',
    exlimit: 'max',
    inprop: 'url',
    cllimit: 'max',
    clshow: '!hidden',
    redirects: '1'
  }, args.delayMs);

  return Object.values(data.query?.pages || {});
}

async function fetchParseFallback(config, page, args) {
  try {
    const data = await mediaWikiQuery(config, {
      action: 'parse',
      pageid: String(page.pageid),
      prop: 'text|displaytitle'
    }, args.delayMs);
    return cleanHtml(data.parse?.text?.['*'] || '');
  } catch (error) {
    console.warn(`    fallback parse failed for "${page.title}": ${error.message}`);
    return '';
  }
}

function createEmptyStore(config, args) {
  const now = new Date().toISOString();
  return {
    version: STORE_VERSION,
    scopeId: `universe:${config.key}`,
    createdAt: now,
    updatedAt: now,
    generatedBy: 'tools/generate-universe-vector-store.mjs',
    source: {
      type: 'mediawiki',
      universeKey: config.key,
      universeName: config.name,
      wikiName: config.wikiName,
      apiUrl: config.apiUrl,
      pageUrlBase: config.pageUrlBase
    },
    filtering: {
      mode: args.includeSideMaterial ? 'broad' : 'core-lore',
      includeSideMaterial: args.includeSideMaterial
    },
    embedding: {
      provider: args.provider,
      model: args.model,
      dimensions: 0,
      precision: args.embeddingDecimals
    },
    stats: {
      pagesProcessed: 0,
      pagesSkipped: 0,
      pagesFiltered: 0,
      chunksEmbedded: 0
    },
    documents: []
  };
}

async function readJsonFile(filePath, fallback = null) {
  try {
    return JSON.parse(await fs.readFile(filePath, 'utf8'));
  } catch {
    return fallback;
  }
}

async function writeJsonFile(filePath, data) {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, JSON.stringify(data, null, 2) + '\n', 'utf8');
}

async function replaceFile(tmpPath, filePath) {
  try {
    await fs.rename(tmpPath, filePath);
  } catch (error) {
    if (error.code !== 'EEXIST' && error.code !== 'EPERM') throw error;
    await fs.rm(filePath, { force: true });
    await fs.rename(tmpPath, filePath);
  }
}

function roundEmbeddingValue(value, decimals) {
  const number = Number(value);
  if (!Number.isFinite(number)) return 0;
  return Number(number.toFixed(decimals));
}

function compactDocumentForWrite(doc, args) {
  const next = { ...doc };
  if (Array.isArray(next.embedding)) {
    next.embedding = next.embedding.map(value => roundEmbeddingValue(value, args.embeddingDecimals));
  }
  return next;
}

function stringifyDocumentForWrite(doc, args) {
  return JSON.stringify(compactDocumentForWrite(doc, args));
}

function storeMetadataForWrite(store) {
  const { documents, shards, documentCount, ...metadata } = store;
  return {
    ...metadata,
    documentCount: Array.isArray(documents) ? documents.length : Number(documentCount || 0)
  };
}

function normalizeStoreStats(store) {
  const documents = Array.isArray(store.documents) ? store.documents : [];
  const pageIds = new Set(
    documents
      .map(doc => doc.sourcePageId)
      .filter(value => value !== undefined && value !== null)
      .map(String)
  );

  store.stats ||= {};
  store.stats.pagesProcessed = pageIds.size || store.stats.pagesProcessed || 0;
  store.stats.chunksEmbedded = documents.length;
}

async function writeObjectWithDocumentJson(filePath, metadata, documentJsons) {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  const tmpPath = `${filePath}.tmp`;
  const handle = await fs.open(tmpPath, 'w');
  try {
    await handle.writeFile('{\n', 'utf8');
    const entries = Object.entries(metadata);
    for (const [key, value] of entries) {
      await handle.writeFile(`  ${JSON.stringify(key)}: ${JSON.stringify(value)},\n`, 'utf8');
    }
    await handle.writeFile('  "documents": [\n', 'utf8');
    for (let i = 0; i < documentJsons.length; i++) {
      await handle.writeFile(`    ${documentJsons[i]}${i + 1 < documentJsons.length ? ',' : ''}\n`, 'utf8');
    }
    await handle.writeFile('  ]\n}\n', 'utf8');
  } finally {
    await handle.close();
  }
  await replaceFile(tmpPath, filePath);
}

async function writeCompactStoreFile(filePath, store, args) {
  const metadata = storeMetadataForWrite(store);
  const documentJsons = (store.documents || []).map(doc => stringifyDocumentForWrite(doc, args));
  await writeObjectWithDocumentJson(filePath, metadata, documentJsons);
  return { shardCount: 0, documentCount: documentJsons.length };
}

async function writeShardedStoreFile(filePath, store, args) {
  const documents = store.documents || [];
  const baseDir = path.dirname(filePath);
  const shardDirName = path.basename(filePath, '.json');
  const shardDir = path.join(baseDir, shardDirName);
  const targetBytes = Math.max(1, args.shardTargetMb) * 1024 * 1024;
  const metadata = storeMetadataForWrite(store);
  const shards = [];
  let shardJsons = [];
  let shardBytes = 0;

  await fs.rm(shardDir, { recursive: true, force: true });
  await fs.mkdir(shardDir, { recursive: true });

  async function flushShard() {
    if (shardJsons.length === 0) return;
    const shardIndex = shards.length;
    const file = `${shardDirName}/part-${String(shardIndex + 1).padStart(4, '0')}.json`;
    const absolutePath = path.join(baseDir, ...file.split('/'));
    const shardMetadata = {
      ...metadata,
      shardIndex,
      shardDocumentCount: shardJsons.length
    };
    await writeObjectWithDocumentJson(absolutePath, shardMetadata, shardJsons);
    const stats = await fs.stat(absolutePath);
    shards.push({
      file,
      documents: shardJsons.length,
      bytes: stats.size
    });
    shardJsons = [];
    shardBytes = 0;
  }

  for (const doc of documents) {
    const docJson = stringifyDocumentForWrite(doc, args);
    const docBytes = Buffer.byteLength(docJson, 'utf8') + 8;
    if (shardJsons.length > 0 && shardBytes + docBytes > targetBytes) {
      await flushShard();
    }
    shardJsons.push(docJson);
    shardBytes += docBytes;
  }
  await flushShard();

  const manifest = {
    ...metadata,
    shardFormat: 'odyssey-universe-vector-store-shards-v1',
    shardTargetMb: args.shardTargetMb,
    shards,
    documents: []
  };
  store.shards = shards;
  store.documentCount = documents.length;
  await writeJsonFile(filePath, manifest);
  return { shardCount: shards.length, documentCount: documents.length };
}

async function writeStoreFile(filePath, store, args) {
  store.embedding ||= {};
  store.embedding.precision = args.embeddingDecimals;
  normalizeStoreStats(store);
  if (args.shardTargetMb > 0) return writeShardedStoreFile(filePath, store, args);
  return writeCompactStoreFile(filePath, store, args);
}

async function readStoreFile(filePath, fallback = null) {
  const store = await readJsonFile(filePath, fallback);
  if (!store || !Array.isArray(store.shards) || (Array.isArray(store.documents) && store.documents.length > 0)) {
    return store;
  }

  const baseDir = path.dirname(filePath);
  const documents = [];
  for (const shard of store.shards) {
    if (!shard?.file) continue;
    const shardPath = path.join(baseDir, ...String(shard.file).split('/'));
    const shardStore = await readJsonFile(shardPath, null);
    if (Array.isArray(shardStore?.documents)) documents.push(...shardStore.documents);
  }
  return { ...store, documents };
}

function buildOpenAiEmbeddingUrl(baseUrl) {
  const base = String(baseUrl || 'https://api.openai.com/v1')
    .replace(/\/embeddings\/?$/, '')
    .replace(/\/+$/, '');
  return `${base}/embeddings`;
}

function buildOllamaEmbedUrl(baseUrl) {
  const base = String(baseUrl || 'http://localhost:11434')
    .replace(/\/api\/embed\/?$/, '')
    .replace(/\/embed\/?$/, '')
    .replace(/\/+$/, '');
  return base.endsWith('/api') ? `${base}/embed` : `${base}/api/embed`;
}

function formatEmbeddingInput(text, role, model) {
  const clean = cleanText(text).slice(0, 6000);
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

function buildDocumentEmbeddingText(config, page, chunk) {
  return [
    `Title: ${cleanText(page.title)}`,
    'Type: fandom',
    config.wikiName ? `Source: ${config.wikiName}` : '',
    chunk
  ].filter(Boolean).join('\n');
}

async function embedTexts(texts, args, role = 'document') {
  if (texts.length === 0) return [];
  const inputs = texts.map(text => formatEmbeddingInput(text, role, args.model));

  if (args.provider === 'ollama') {
    const data = await fetchJson(buildOllamaEmbedUrl(args.baseUrl), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: args.model, input: inputs })
    });
    await sleep(args.embedDelayMs);
    if (Array.isArray(data.embeddings)) return data.embeddings;
    if (Array.isArray(data.embedding)) return [data.embedding];
    return [];
  }

  const headers = { 'Content-Type': 'application/json' };
  if (args.apiKey) headers.Authorization = `Bearer ${args.apiKey}`;

  const data = await fetchJson(buildOpenAiEmbeddingUrl(args.baseUrl), {
    method: 'POST',
    headers,
    body: JSON.stringify({ model: args.model, input: inputs })
  });
  await sleep(args.embedDelayMs);
  return (data.data || []).map(item => item.embedding).filter(Array.isArray);
}

function existingPageIds(store) {
  return new Set(
    (store.documents || [])
      .map(doc => doc.sourcePageId)
      .filter(value => value !== undefined && value !== null)
      .map(String)
  );
}

function nextRecordsForPage(config, page, text, embeddings, chunks, args) {
  const now = new Date().toISOString();
  return chunks.map((chunk, chunkIndex) => {
    const textHash = hashString(buildDocumentEmbeddingText(config, page, chunk));
    const titleHash = hashString(`${page.pageid}|${page.title}|${chunkIndex}|${textHash}`);
    return {
      id: `${config.key}:${page.pageid}:${chunkIndex}:${titleHash}`,
      textHash,
      title: cleanText(page.title),
      url: pageUrl(config, page.title, page.fullurl),
      sourceType: 'fandom',
      sourceName: config.wikiName,
      scope: `universe:${config.key}`,
      sourcePageId: page.pageid,
      chunkIndex,
      text: chunk,
      query: '',
      embeddingProvider: args.provider,
      embeddingModel: args.model,
      updatedAt: now,
      embedding: (embeddings[chunkIndex] || []).map(value => roundEmbeddingValue(value, args.embeddingDecimals))
    };
  });
}

async function embedAndAddPages(config, pages, store, args) {
  let addedPages = 0;
  let skippedPages = 0;
  let filteredPages = 0;
  let chunksEmbedded = 0;

  for (const page of pages) {
    const skipReason = skipReasonForPage(page, config, args);
    if (skipReason) {
      filteredPages++;
      continue;
    }

    let text = cleanText(page.extract || '');
    if (text.length < args.minChars) {
      const fallbackText = await fetchParseFallback(config, page, args);
      if (fallbackText.length > text.length) text = fallbackText;
    }

    const textSkipReason = skipReasonForText(text);
    if (textSkipReason) {
      filteredPages++;
      continue;
    }

    if (text.length < args.minChars) {
      skippedPages++;
      continue;
    }

    const chunks = chunkText(text);
    if (chunks.length === 0) {
      skippedPages++;
      continue;
    }

    const embeddings = [];
    for (let i = 0; i < chunks.length; i += args.embeddingBatch) {
      const batch = chunks.slice(i, i + args.embeddingBatch);
      const batchEmbeddings = await embedTexts(batch.map(chunk => buildDocumentEmbeddingText(config, page, chunk)), args);
      embeddings.push(...batchEmbeddings);
      process.stdout.write('.');
    }

    if (embeddings.length !== chunks.length) {
      throw new Error(`Embedding count mismatch for "${page.title}" (${embeddings.length}/${chunks.length})`);
    }

    if (!store.embedding.dimensions && embeddings[0]) {
      store.embedding.dimensions = embeddings[0].length;
    }

    store.documents.push(...nextRecordsForPage(config, page, text, embeddings, chunks, args));
    addedPages++;
    chunksEmbedded += chunks.length;
  }

  return { addedPages, skippedPages, filteredPages, chunksEmbedded };
}

async function generateUniverse(config, args) {
  const outputPath = path.join(args.outputDir, `${config.key}.json`);
  const checkpointPath = path.join(args.cacheDir, `${config.key}.checkpoint.json`);

  let store = args.fresh ? null : await readStoreFile(outputPath, null);
  if (!store || !Array.isArray(store.documents)) {
    store = createEmptyStore(config, args);
  } else if (
    store.embedding &&
    store.documents.length > 0 &&
    (store.embedding.provider !== args.provider || store.embedding.model !== args.model)
  ) {
    throw new Error(
      `${outputPath} was generated with ${store.embedding.provider}/${store.embedding.model}. ` +
      `Use --fresh or a different --output-dir before generating with ${args.provider}/${args.model}.`
    );
  }
  store.stats.pagesFiltered ||= 0;
  store.embedding ||= {
    provider: args.provider,
    model: args.model,
    dimensions: 0,
    precision: args.embeddingDecimals
  };
  store.embedding.precision = args.embeddingDecimals;
  store.filtering ||= {
    mode: args.includeSideMaterial ? 'broad' : 'core-lore',
    includeSideMaterial: args.includeSideMaterial
  };
  const removedExistingChunks = filterExistingDocuments(store, config, args);

  let checkpoint = args.fresh ? null : await readJsonFile(checkpointPath, null);
  if (!checkpoint || checkpoint.universeKey !== config.key) {
    checkpoint = {
      universeKey: config.key,
      apcontinue: '',
      done: false,
      seenPageIds: []
    };
  }

  const seen = new Set([...checkpoint.seenPageIds.map(String), ...existingPageIds(store)]);
  const pageLimit = args.limitPages === 0 ? Number.POSITIVE_INFINITY : args.limitPages;
  let apcontinue = checkpoint.apcontinue || '';
  let processedThisRun = 0;

  console.log(`\n== ${config.name} (${config.wikiName}) ==`);
  console.log(`Output: ${outputPath}`);
  console.log(`Already embedded pages: ${seen.size}`);
  if (removedExistingChunks > 0) {
    console.log(`Removed ${removedExistingChunks} existing chunks that now match the core-lore filters.`);
  }

  while (!checkpoint.done && store.stats.pagesProcessed < pageLimit) {
    const data = await listPages(config, apcontinue, args);
    const allPages = data.query?.allpages || [];
    apcontinue = data.continue?.apcontinue || '';

    const pageBatch = allPages
      .filter(page => !seen.has(String(page.pageid)))
      .filter(page => {
        const reason = skipReasonForTitle(page.title, config, args);
        if (reason) {
          seen.add(String(page.pageid));
          store.stats.pagesFiltered++;
          return false;
        }
        return true;
      });

    if (pageBatch.length === 0) {
      if (!apcontinue) checkpoint.done = true;
      checkpoint.apcontinue = apcontinue;
      checkpoint.seenPageIds = [...seen];
      await writeJsonFile(checkpointPath, checkpoint);
      continue;
    }

    const remaining = Math.max(0, pageLimit - store.stats.pagesProcessed);
    const limitedBatch = pageBatch.slice(0, remaining);
    const pages = await fetchExtractPages(config, limitedBatch.map(page => page.pageid), args);

    process.stdout.write(`  embedding ${pages.length} pages `);
    const result = await embedAndAddPages(config, pages, store, args);
    process.stdout.write('\n');

    for (const page of limitedBatch) seen.add(String(page.pageid));

    store.updatedAt = new Date().toISOString();
    store.stats.pagesProcessed += result.addedPages;
    store.stats.pagesSkipped += result.skippedPages;
    store.stats.pagesFiltered += result.filteredPages;
    store.stats.chunksEmbedded += result.chunksEmbedded;
    processedThisRun += result.addedPages;

    checkpoint.apcontinue = apcontinue;
    checkpoint.done = !apcontinue;
    checkpoint.seenPageIds = [...seen];

    const writeResult = await writeStoreFile(outputPath, store, args);
    await writeJsonFile(checkpointPath, checkpoint);

    const shardNote = writeResult.shardCount ? `, shards: ${writeResult.shardCount}` : '';
    console.log(`  total pages: ${store.stats.pagesProcessed}, chunks: ${store.stats.chunksEmbedded}, skipped: ${store.stats.pagesSkipped}, filtered: ${store.stats.pagesFiltered}${shardNote}`);

    if (!apcontinue) {
      checkpoint.done = true;
      await writeJsonFile(checkpointPath, checkpoint);
      break;
    }
  }

  const finalWrite = await writeStoreFile(outputPath, store, args);
  const finalShardNote = finalWrite.shardCount ? ` across ${finalWrite.shardCount} shard files` : '';
  console.log(`Finished ${config.key}: +${processedThisRun} pages this run, ${store.documents.length} vector chunks total${finalShardNote}.`);
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) {
    printHelp();
    return;
  }

  const universes = resolveUniverses(args);

  if (args.dryRun) {
    console.log(JSON.stringify({
      universes: universes.map(universe => universe.key),
      provider: args.provider,
      baseUrl: args.baseUrl,
      model: args.model,
      outputDir: args.outputDir,
      cacheDir: args.cacheDir,
      limitPages: args.limitPages,
      batchSize: args.batchSize,
      delayMs: args.delayMs,
      embeddingDecimals: args.embeddingDecimals,
      shardTargetMb: args.shardTargetMb
    }, null, 2));
    return;
  }

  await fs.mkdir(args.outputDir, { recursive: true });
  await fs.mkdir(args.cacheDir, { recursive: true });

  for (const universe of universes) {
    await generateUniverse(universe, args);
  }
}

main().catch(error => {
  console.error(`\nVector generation failed: ${error.message}`);
  process.exitCode = 1;
});
