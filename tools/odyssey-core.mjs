import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import crypto from 'node:crypto';

export const APP_IDENTIFIER = 'com.dur6na.odyssey';
export const APP_DATA_FOLDER = 'odyssey';
export const CLI_SETTINGS_FILE = 'cli-settings.json';
export const TELEGRAM_STATE_FILE = 'telegram-sessions.json';
export const TELEGRAM_SETTINGS_FILE = 'telegram-settings.json';
export const DESKTOP_WEBVIEW_STORAGE_OVERRIDE = 'ODYSSEY_WEBVIEW_LOCAL_STORAGE_DIR';
export const TURN_SNAPSHOTS_FILE = 'turn_snapshots.json';
export const MAX_TURN_SNAPSHOTS = 80;
export const OPENROUTER_APP_URL = 'https://github.com/DUR6NA/Odyssey';
export const OPENROUTER_APP_TITLE = 'Odyssey';
export const OPENROUTER_APP_CATEGORIES = 'game,roleplay';

export const DEFAULT_SETTINGS = {
  provider: 'openrouter',
  baseUrl: '',
  apiKey: '',
  model: 'openai/gpt-4o-mini',
  temperature: 0.85,
  maxTokens: 8000,
  topP: 1,
  presencePenalty: 0,
  frequencyPenalty: 0,
  enableReasoning: false,
  reasoningEffort: 'low',
  promptGame: '',
  enableVectorRag: false,
  embeddingProvider: 'lmstudio',
  embeddingBaseUrl: '',
  embeddingApiKey: '',
  embeddingModel: '',
  vectorTopK: 5,
  vectorMinScore: 0.18,
  enableWebSearch: false,
  enableFandomSearch: false,
  enableBraveSearch: false,
  braveSearchApiKey: '',
  braveSearchCount: 3,
  braveSearchCountry: 'us',
  braveSearchLang: 'en'
};

export const DEFAULT_TELEGRAM_SETTINGS = {
  botToken: '',
  authEnabled: true,
  pairingPhrase: '',
  allowedUsers: [],
  webAppUrl: ''
};

export const WORLD_PRESETS = {
  'Harry Potter': {
    name: 'The Wizarding World',
    era: 'Modern era, with a hidden magical society beside the Muggle world.',
    setting: 'Hogwarts, Diagon Alley, Hogsmeade, the Ministry of Magic, and the concealed magical world of Britain.',
    tone: 'Whimsical and adventurous, with mystery, school drama, and darker danger when Dark Magic enters the story.',
    magicOrTech: 'Wand magic, potions, charms, transfiguration, magical creatures, enchanted objects, and defensive spells.',
    rules: 'The Statute of Secrecy hides magic from Muggles. Underage magic is restricted. The Unforgivable Curses are illegal.',
    dangers: 'Dark wizards, cursed artifacts, dangerous creatures, political pressure, and the risks of secret magic.',
    factions: ['Hogwarts Houses', 'The Ministry of Magic', 'The Order of the Phoenix', 'Death Eaters'],
    wikiUrl: 'https://harrypotter.fandom.com/wiki/',
    wikiName: 'Harry Potter Wiki',
    mediaWikiApiUrl: 'https://harrypotter.fandom.com/api.php'
  },
  'Star Wars': {
    name: 'The Star Wars Galaxy',
    era: 'A galaxy-spanning age of hyperspace travel, war, and shifting political orders.',
    setting: 'A vast galaxy of core worlds, frontier systems, starships, droids, cantinas, temples, and imperial outposts.',
    tone: 'Epic space opera with moral conflict, danger, friendship, and adventure.',
    magicOrTech: 'The Force, lightsabers, blasters, droids, hyperdrives, starships, and advanced galactic technology.',
    rules: 'The Force has light and dark sides. Hyperspace needs routes. Public law shifts with the active regime.',
    dangers: 'Sith, bounty hunters, crime syndicates, warlords, imperial patrols, hostile planets, and ancient ruins.',
    factions: ['Jedi', 'Sith', 'Republic', 'Empire', 'Rebels', 'Mandalorians', 'Hutt Cartel'],
    wikiUrl: 'https://starwars.fandom.com/wiki/',
    wikiName: 'Wookieepedia',
    mediaWikiApiUrl: 'https://starwars.fandom.com/api.php'
  },
  'Narnia': {
    name: 'Narnia',
    era: 'A magical realm with its own eras, rulers, prophecies, and portals to Earth.',
    setting: 'Forests, castles, talking animals, mythic beings, wild frontiers, seas, islands, and ancient magic.',
    tone: 'Wonder, courage, temptation, faith, and high adventure.',
    magicOrTech: 'Deep Magic, enchanted objects, portals, prophecies, and the living magic of Narnia.',
    rules: 'Aslan shapes the moral order. Time may flow differently from Earth. Some portals open only by calling or fate.',
    dangers: 'Witches, invaders, curses, betrayals, hostile creatures, wild weather, and corrupting magic.',
    factions: ['Narnians', 'Calormenes', 'Telmarines', 'Followers of the White Witch', 'Cair Paravel'],
    wikiUrl: 'https://narnia.fandom.com/wiki/',
    wikiName: 'The Chronicles of Narnia Wiki',
    mediaWikiApiUrl: 'https://narnia.fandom.com/api.php'
  },
  'Lord of the Rings': {
    name: 'Middle-earth',
    era: 'The Third Age, when old powers fade and shadow rises again.',
    setting: 'The Shire, Rivendell, Moria, Rohan, Gondor, Mordor, forests, ruins, roads, and mountain passes.',
    tone: 'Epic high fantasy with friendship, sacrifice, corruption, hope, and ancient sorrow.',
    magicOrTech: 'Subtle wizardry, Elven craft, rings of power, old blades, seeing stones, and the influence of Maiar.',
    rules: 'Great power corrupts. Oaths matter. Ancient evil leaves marks. The world has deep memory.',
    dangers: 'Orcs, trolls, spies, corrupted rulers, Nazgul, ancient monsters, cursed places, and the shadow of Sauron.',
    factions: ['Free Peoples', 'Sauron\'s Forces', 'Rohan', 'Gondor', 'Elves', 'Dwarves', 'Isengard'],
    wikiUrl: 'https://lotr.fandom.com/wiki/',
    wikiName: 'The One Wiki to Rule Them All',
    mediaWikiApiUrl: 'https://lotr.fandom.com/api.php'
  },
  'A Song of Ice and Fire': {
    name: 'The Known World',
    era: 'A brutal feudal age of dynastic conflict, old magic, and long winters.',
    setting: 'Westeros and Essos, from keeps and courts to roads, ports, ruins, and dangerous wild lands.',
    tone: 'Political, grounded, morally gray, tense, and consequence-driven.',
    magicOrTech: 'Rare dragons, blood magic, prophecy, warging, wildfire, Valyrian steel, and half-forgotten powers.',
    rules: 'Oaths, guest right, inheritance, reputation, and family loyalty carry real consequences.',
    dangers: 'Civil war, betrayal, famine, assassins, dragons, wildfire, raiders, and supernatural threats in the cold.',
    factions: ['Stark', 'Lannister', 'Targaryen', 'Baratheon', 'Night\'s Watch', 'Free Folk', 'Faceless Men'],
    wikiUrl: 'https://awoiaf.westeros.org/index.php/',
    wikiName: 'A Wiki of Ice and Fire',
    mediaWikiApiUrl: 'https://awoiaf.westeros.org/api.php'
  }
};

export const GAME_OUTPUT_SCHEMA = {
  type: 'object',
  properties: {
    time: {
      type: 'object',
      properties: {
        hour: { type: 'integer' },
        minute: { type: 'integer' },
        period: { type: 'string' },
        dayOfWeek: { type: 'string' },
        day: { type: 'integer' },
        month: { type: 'integer' },
        year: { type: 'integer' },
        era: { type: 'string' },
        calendarType: { type: 'string' }
      },
      required: ['hour', 'minute', 'period', 'dayOfWeek', 'day', 'month', 'year', 'era', 'calendarType'],
      additionalProperties: false
    },
    textoutput: { type: 'string' },
    inventory_changes: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          action: { type: 'string', enum: ['add', 'remove', 'update'] },
          name: { type: 'string' },
          newName: { type: 'string' },
          description: { type: 'string' }
        },
        required: ['action', 'name', 'newName', 'description'],
        additionalProperties: false
      }
    },
    location_changes: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          action: { type: 'string', enum: ['add', 'remove', 'update'] },
          name: { type: 'string' },
          newName: { type: 'string' },
          description: { type: 'string' },
          notes: { type: 'string' }
        },
        required: ['action', 'name', 'newName', 'description', 'notes'],
        additionalProperties: false
      }
    },
    npc_changes: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          action: { type: 'string', enum: ['add', 'remove', 'update'] },
          name: { type: 'string' },
          newName: { type: 'string' },
          description: { type: 'string' },
          notes: { type: 'string' }
        },
        required: ['action', 'name', 'newName', 'description', 'notes'],
        additionalProperties: false
      }
    },
    player_changes: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          action: { type: 'string', enum: ['update'] },
          field: { type: 'string', enum: ['description', 'appearance', 'personality', 'backstory'] },
          value: { type: 'string' }
        },
        required: ['action', 'field', 'value'],
        additionalProperties: false
      }
    },
    stats: {
      type: 'object',
      properties: {
        health: { type: 'integer' },
        money: { type: 'integer' },
        hunger: { type: 'integer' },
        thirst: { type: 'integer' },
        energy: { type: 'integer' }
      },
      required: ['health', 'money', 'hunger', 'thirst', 'energy'],
      additionalProperties: false
    }
  },
  required: ['time', 'textoutput', 'inventory_changes', 'location_changes', 'npc_changes', 'player_changes', 'stats'],
  additionalProperties: false
};

const REASONING_EFFORT_ORDER = ['none', 'minimal', 'low', 'medium', 'high', 'xhigh'];
const REASONING_EFFORT_RATIOS = {
  none: 0,
  minimal: 0.1,
  low: 0.2,
  medium: 0.5,
  high: 0.8,
  xhigh: 0.95
};

export function getOdysseyBaseDir() {
  if (process.env.ODYSSEY_DATA_DIR) {
    return path.resolve(process.env.ODYSSEY_DATA_DIR);
  }

  if (process.platform === 'win32') {
    const roaming = process.env.APPDATA || path.join(os.homedir(), 'AppData', 'Roaming');
    return path.join(roaming, APP_IDENTIFIER, APP_DATA_FOLDER);
  }

  if (process.platform === 'darwin') {
    return path.join(os.homedir(), 'Library', 'Application Support', APP_IDENTIFIER, APP_DATA_FOLDER);
  }

  const dataHome = process.env.XDG_DATA_HOME || path.join(os.homedir(), '.local', 'share');
  return path.join(dataHome, APP_IDENTIFIER, APP_DATA_FOLDER);
}

export async function ensureDir(dir) {
  await fs.mkdir(dir, { recursive: true });
}

export async function pathExists(target) {
  try {
    await fs.access(target);
    return true;
  } catch {
    return false;
  }
}

export async function readJsonFile(filePath, fallback = null) {
  try {
    return JSON.parse(await fs.readFile(filePath, 'utf8'));
  } catch {
    return fallback;
  }
}

export async function writeJsonFile(filePath, value) {
  await ensureDir(path.dirname(filePath));
  const payload = `${JSON.stringify(value, null, 2)}\n`;
  const tempPath = `${filePath}.${process.pid}.${Date.now()}.tmp`;
  await fs.writeFile(tempPath, payload, 'utf8');
  try {
    await fs.rename(tempPath, filePath);
  } catch {
    // Windows may refuse rename over an existing file; fall back to replace.
    await fs.writeFile(filePath, payload, 'utf8');
    await fs.unlink(tempPath).catch(() => {});
  }
}

/** Reject path traversal / absolute segments; keep resolved path under gamesDir. */
export function resolveGameDir(gamesDir, id) {
  const raw = String(id || '').trim();
  if (!raw || raw === '.' || raw === '..' || /[\\/]/.test(raw) || raw.includes('..')) {
    throw new Error(`Invalid game id: ${id}`);
  }
  const root = path.resolve(gamesDir);
  const resolved = path.resolve(root, raw);
  const prefix = root.endsWith(path.sep) ? root : root + path.sep;
  if (resolved !== root && !resolved.startsWith(prefix)) {
    throw new Error(`Invalid game id: ${id}`);
  }
  return resolved;
}

export function hashPairingPhrase(phrase) {
  const normalized = normalizePairingPhraseForStorage(phrase);
  if (!normalized) return '';
  return crypto.createHash('sha256').update(normalized, 'utf8').digest('hex');
}

export async function getGamesDir() {
  const gamesDir = path.join(getOdysseyBaseDir(), 'games');
  await ensureDir(gamesDir);
  return gamesDir;
}

export async function getPresetsDir() {
  const presetsDir = path.join(getOdysseyBaseDir(), 'presets');
  await ensureDir(presetsDir);
  return presetsDir;
}

export async function getSettingsPath() {
  const base = getOdysseyBaseDir();
  await ensureDir(base);
  return path.join(base, CLI_SETTINGS_FILE);
}

export async function getTelegramStatePath() {
  const base = getOdysseyBaseDir();
  await ensureDir(base);
  return path.join(base, TELEGRAM_STATE_FILE);
}

export async function getTelegramSettingsPath() {
  const base = getOdysseyBaseDir();
  await ensureDir(base);
  return path.join(base, TELEGRAM_SETTINGS_FILE);
}

export function sanitizeGameFolderName(name) {
  const cleaned = String(name || '')
    .replace(/[_]+/g, ' ')
    .replace(/[<>:"/\\|?*\x00-\x1F]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/^[.\-\s]+|[.\-\s]+$/g, '')
    .slice(0, 48)
    .trim();

  if (!cleaned) return null;
  if (/^(con|prn|aux|nul|com[1-9]|lpt[1-9])$/i.test(cleaned)) return null;
  return cleaned;
}

export async function getUniqueGameFolderName(gamesDir, requestedName) {
  const baseName = sanitizeGameFolderName(requestedName) || 'New Odyssey';
  let candidate = baseName;
  let suffix = 2;

  while (await pathExists(path.join(gamesDir, candidate))) {
    candidate = `${baseName} ${suffix}`;
    suffix += 1;
  }

  return candidate;
}

export function cleanGeneratedSaveName(name) {
  const cleaned = String(name || '')
    .replace(/[_]+/g, ' ')
    .replace(/[^a-zA-Z0-9 \-']/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/^[.\-\s']+|[.\-\s']+$/g, '');
  return cleaned.slice(0, 48).trim();
}

export function buildFallbackSaveName(allData) {
  const playerName = cleanGeneratedSaveName(allData?.playerInfo?.player?.name || '');
  const worldName = cleanGeneratedSaveName(allData?.worldInfo?.world?.name || '');
  if (playerName && worldName) return cleanGeneratedSaveName(`${playerName} in ${worldName}`);
  if (playerName) return playerName;
  if (worldName) return worldName;
  return 'New Odyssey';
}

export async function loadSettings() {
  const settingsPath = await getSettingsPath();
  const saved = await readJsonFile(settingsPath, null);
  const desktop = await loadDesktopWebViewSettings();
  const settings = { ...DEFAULT_SETTINGS, ...desktop };
  applySavedSettings(settings, saved, desktop);

  if (process.env.ODYSSEY_PROVIDER) settings.provider = process.env.ODYSSEY_PROVIDER;
  if (process.env.ODYSSEY_API_KEY) settings.apiKey = process.env.ODYSSEY_API_KEY;
  if (process.env.ODYSSEY_MODEL) settings.model = process.env.ODYSSEY_MODEL;
  if (process.env.ODYSSEY_BASE_URL) settings.baseUrl = process.env.ODYSSEY_BASE_URL;
  if (process.env.ODYSSEY_MAX_TOKENS) settings.maxTokens = Number(process.env.ODYSSEY_MAX_TOKENS);
  if (process.env.ODYSSEY_TEMPERATURE) settings.temperature = Number(process.env.ODYSSEY_TEMPERATURE);
  if (process.env.ODYSSEY_TOP_P) settings.topP = Number(process.env.ODYSSEY_TOP_P);
  if (process.env.ODYSSEY_PRESENCE_PENALTY) settings.presencePenalty = Number(process.env.ODYSSEY_PRESENCE_PENALTY);
  if (process.env.ODYSSEY_FREQUENCY_PENALTY) settings.frequencyPenalty = Number(process.env.ODYSSEY_FREQUENCY_PENALTY);
  if (process.env.ODYSSEY_ENABLE_REASONING) settings.enableReasoning = process.env.ODYSSEY_ENABLE_REASONING === 'true';
  if (process.env.ODYSSEY_REASONING_EFFORT) settings.reasoningEffort = process.env.ODYSSEY_REASONING_EFFORT;
  if (process.env.ODYSSEY_ENABLE_VECTOR_RAG) settings.enableVectorRag = process.env.ODYSSEY_ENABLE_VECTOR_RAG === 'true';
  if (process.env.ODYSSEY_ENABLE_WEB_SEARCH) settings.enableWebSearch = process.env.ODYSSEY_ENABLE_WEB_SEARCH === 'true';
  if (process.env.ODYSSEY_ENABLE_FANDOM_SEARCH) settings.enableFandomSearch = process.env.ODYSSEY_ENABLE_FANDOM_SEARCH === 'true';
  if (process.env.ODYSSEY_ENABLE_BRAVE_SEARCH) settings.enableBraveSearch = process.env.ODYSSEY_ENABLE_BRAVE_SEARCH === 'true';
  if (process.env.ODYSSEY_EMBEDDING_PROVIDER) settings.embeddingProvider = process.env.ODYSSEY_EMBEDDING_PROVIDER;
  if (process.env.ODYSSEY_EMBEDDING_BASE_URL) settings.embeddingBaseUrl = process.env.ODYSSEY_EMBEDDING_BASE_URL;
  if (process.env.ODYSSEY_EMBEDDING_API_KEY) settings.embeddingApiKey = process.env.ODYSSEY_EMBEDDING_API_KEY;
  if (process.env.ODYSSEY_EMBEDDING_MODEL) settings.embeddingModel = process.env.ODYSSEY_EMBEDDING_MODEL;
  if (process.env.ODYSSEY_VECTOR_TOP_K) settings.vectorTopK = Number(process.env.ODYSSEY_VECTOR_TOP_K);
  if (process.env.ODYSSEY_VECTOR_MIN_SCORE) settings.vectorMinScore = Number(process.env.ODYSSEY_VECTOR_MIN_SCORE);
  if (process.env.ODYSSEY_BRAVE_SEARCH_API_KEY) settings.braveSearchApiKey = process.env.ODYSSEY_BRAVE_SEARCH_API_KEY;

  settings.temperature = finiteNumber(settings.temperature, DEFAULT_SETTINGS.temperature);
  settings.maxTokens = Math.max(finiteNumber(settings.maxTokens, DEFAULT_SETTINGS.maxTokens), 1200);
  settings.topP = finiteNumber(settings.topP, DEFAULT_SETTINGS.topP);
  settings.presencePenalty = finiteNumber(settings.presencePenalty, DEFAULT_SETTINGS.presencePenalty);
  settings.frequencyPenalty = finiteNumber(settings.frequencyPenalty, DEFAULT_SETTINGS.frequencyPenalty);
  settings.provider = String(settings.provider || DEFAULT_SETTINGS.provider).trim().toLowerCase();
  settings.model = String(settings.model || DEFAULT_SETTINGS.model).trim();
  settings.baseUrl = String(settings.baseUrl || '').trim();
  settings.apiKey = String(settings.apiKey || '').trim();
  settings.reasoningEffort = normalizeReasoningEffort(settings.reasoningEffort);
  settings.promptGame = String(settings.promptGame || '');
  settings.enableVectorRag = Boolean(settings.enableVectorRag);
  settings.enableWebSearch = Boolean(settings.enableWebSearch);
  settings.enableFandomSearch = Boolean(settings.enableFandomSearch);
  settings.enableBraveSearch = Boolean(settings.enableBraveSearch);
  settings.embeddingProvider = String(settings.embeddingProvider || DEFAULT_SETTINGS.embeddingProvider).trim().toLowerCase();
  settings.embeddingBaseUrl = String(settings.embeddingBaseUrl || '').trim();
  settings.embeddingApiKey = String(settings.embeddingApiKey || '').trim();
  settings.embeddingModel = String(settings.embeddingModel || '').trim();
  settings.vectorTopK = Math.max(1, Math.min(finiteNumber(settings.vectorTopK, DEFAULT_SETTINGS.vectorTopK), 12));
  settings.vectorMinScore = Math.max(-1, Math.min(finiteNumber(settings.vectorMinScore, DEFAULT_SETTINGS.vectorMinScore), 1));
  settings.braveSearchApiKey = String(settings.braveSearchApiKey || '').trim();
  settings.braveSearchCount = Math.max(1, Math.min(finiteNumber(settings.braveSearchCount, DEFAULT_SETTINGS.braveSearchCount), 10));
  settings.braveSearchCountry = String(settings.braveSearchCountry || DEFAULT_SETTINGS.braveSearchCountry).trim() || 'us';
  settings.braveSearchLang = String(settings.braveSearchLang || DEFAULT_SETTINGS.braveSearchLang).trim() || 'en';
  return settings;
}

function applySavedSettings(settings, saved, desktop) {
  if (!saved || typeof saved !== 'object') return;

  for (const [key, value] of Object.entries(saved)) {
    if (value === undefined || value === null) continue;
    if (typeof value === 'string' && value.trim() === '') continue;

    if (key === 'model' && desktop?.model && value === DEFAULT_SETTINGS.model) continue;
    if (key === 'provider' && desktop?.provider && value === DEFAULT_SETTINGS.provider) continue;
    settings[key] = value;
  }
}

export async function loadDesktopWebViewSettings() {
  const storage = await readDesktopLocalStorage();
  if (!storage || Object.keys(storage).length === 0) return {};

  const provider = (storage.jsonAdventure_apiProvider || DEFAULT_SETTINGS.provider).trim().toLowerCase();
  const model = storage[`jsonAdventure_manualModel_${provider}`]
    || storage[`jsonAdventure_savedModel_${provider}`]
    || (provider === 'openrouter' ? storage.jsonAdventure_openRouterModel : '')
    || storage.jsonAdventure_openRouterModel
    || DEFAULT_SETTINGS.model;
  const apiKey = storage[`jsonAdventure_apiKey_${provider}`]
    || (provider === 'openrouter' ? storage.jsonAdventure_openRouterApiKey : '')
    || storage.jsonAdventure_openRouterApiKey
    || '';

  const embeddingProvider = (storage.jsonAdventure_embeddingProvider || DEFAULT_SETTINGS.embeddingProvider).trim().toLowerCase();
  let embeddingApiKey = storage.jsonAdventure_embeddingApiKey || '';
  if (!embeddingApiKey && (embeddingProvider === 'openrouter')) {
    embeddingApiKey = storage.jsonAdventure_openRouterApiKey || storage.jsonAdventure_apiKey_openrouter || apiKey || '';
  }

  return {
    provider,
    baseUrl: storage.jsonAdventure_apiBaseUrl || '',
    apiKey,
    model,
    temperature: parseSettingNumber(storage.jsonAdventure_apiTemperature, DEFAULT_SETTINGS.temperature),
    maxTokens: parseSettingNumber(storage.jsonAdventure_apiMaxTokens, DEFAULT_SETTINGS.maxTokens),
    topP: parseSettingNumber(storage.jsonAdventure_apiTopP, DEFAULT_SETTINGS.topP),
    presencePenalty: parseSettingNumber(storage.jsonAdventure_apiPresencePenalty, DEFAULT_SETTINGS.presencePenalty),
    frequencyPenalty: parseSettingNumber(storage.jsonAdventure_apiFrequencyPenalty, DEFAULT_SETTINGS.frequencyPenalty),
    enableReasoning: parseSettingBoolean(storage.jsonAdventure_apiEnableReasoning, DEFAULT_SETTINGS.enableReasoning),
    reasoningEffort: storage.jsonAdventure_apiReasoningEffort || DEFAULT_SETTINGS.reasoningEffort,
    promptGame: storage.jsonAdventure_promptGame || '',
    enableVectorRag: parseSettingBoolean(storage.jsonAdventure_enableVectorRag, DEFAULT_SETTINGS.enableVectorRag),
    embeddingProvider,
    embeddingBaseUrl: storage.jsonAdventure_embeddingBaseUrl || '',
    embeddingApiKey,
    embeddingModel: storage.jsonAdventure_embeddingModel || '',
    vectorTopK: parseSettingNumber(storage.jsonAdventure_vectorTopK, DEFAULT_SETTINGS.vectorTopK),
    vectorMinScore: parseSettingNumber(storage.jsonAdventure_vectorMinScore, DEFAULT_SETTINGS.vectorMinScore),
    enableWebSearch: parseSettingBoolean(storage.jsonAdventure_enableWebSearch, DEFAULT_SETTINGS.enableWebSearch),
    enableFandomSearch: parseSettingBoolean(storage.jsonAdventure_enableFandomSearch, DEFAULT_SETTINGS.enableFandomSearch),
    enableBraveSearch: parseSettingBoolean(storage.jsonAdventure_enableBraveSearch, DEFAULT_SETTINGS.enableBraveSearch),
    braveSearchApiKey: storage.jsonAdventure_braveSearchApiKey || '',
    braveSearchCount: parseSettingNumber(storage.jsonAdventure_braveSearchCount, DEFAULT_SETTINGS.braveSearchCount),
    braveSearchCountry: storage.jsonAdventure_braveSearchCountry || DEFAULT_SETTINGS.braveSearchCountry,
    braveSearchLang: storage.jsonAdventure_braveSearchLang || DEFAULT_SETTINGS.braveSearchLang
  };
}

function parseSettingNumber(value, fallback) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function parseSettingBoolean(value, fallback) {
  if (value === true || value === 'true') return true;
  if (value === false || value === 'false') return false;
  return fallback;
}

export async function saveSettings(nextSettings) {
  const settingsPath = await getSettingsPath();
  const sanitized = { ...DEFAULT_SETTINGS, ...nextSettings };
  await writeJsonFile(settingsPath, sanitized);
  return sanitized;
}

export async function loadTelegramSettings() {
  const settingsPath = await getTelegramSettingsPath();
  const saved = await readJsonFile(settingsPath, null);
  const desktop = await loadDesktopTelegramSettings();
  const settings = normalizeTelegramSettings({ ...DEFAULT_TELEGRAM_SETTINGS, ...desktop, ...(saved || {}) });

  if (process.env.TELEGRAM_BOT_TOKEN) settings.botToken = process.env.TELEGRAM_BOT_TOKEN;
  if (process.env.ODYSSEY_TELEGRAM_BOT_TOKEN) settings.botToken = process.env.ODYSSEY_TELEGRAM_BOT_TOKEN;
  if (process.env.ODYSSEY_TELEGRAM_PAIRING_PHRASE) {
    settings.pairingPhrase = process.env.ODYSSEY_TELEGRAM_PAIRING_PHRASE;
  }
  if (process.env.ODYSSEY_TELEGRAM_WEB_APP_URL) settings.webAppUrl = process.env.ODYSSEY_TELEGRAM_WEB_APP_URL;
  if (process.env.TELEGRAM_WEB_APP_URL) settings.webAppUrl = process.env.TELEGRAM_WEB_APP_URL;
  if (process.env.ODYSSEY_TELEGRAM_AUTH_ENABLED) {
    settings.authEnabled = parseSettingBoolean(process.env.ODYSSEY_TELEGRAM_AUTH_ENABLED, settings.authEnabled);
  }

  const envAllowedUsers = parseTelegramUserIds(process.env.ODYSSEY_TELEGRAM_ALLOWED_USERS || '');
  settings.allowedUsers = Array.from(new Set([...settings.allowedUsers, ...envAllowedUsers]));
  settings.botToken = String(settings.botToken || '').trim();
  settings.pairingPhrase = String(settings.pairingPhrase || '').trim();
  settings.webAppUrl = String(settings.webAppUrl || '').trim();
  return settings;
}

export async function saveTelegramSettings(nextSettings) {
  const settingsPath = await getTelegramSettingsPath();
  const sanitized = normalizeTelegramSettings({ ...DEFAULT_TELEGRAM_SETTINGS, ...nextSettings });
  await writeJsonFile(settingsPath, sanitized);
  return sanitized;
}

async function loadDesktopTelegramSettings() {
  const storage = await readDesktopLocalStorage();
  if (!storage || Object.keys(storage).length === 0) return {};

  return normalizeTelegramSettings({
    botToken: storage.jsonAdventure_telegramBotToken || '',
    authEnabled: parseSettingBoolean(storage.jsonAdventure_telegramAuthEnabled, DEFAULT_TELEGRAM_SETTINGS.authEnabled),
    pairingPhrase: storage.jsonAdventure_telegramPairingPhrase || '',
    allowedUsers: storage.jsonAdventure_telegramAllowedUsers || '',
    webAppUrl: storage.jsonAdventure_telegramWebAppUrl || ''
  });
}

function normalizeTelegramSettings(settings = {}) {
  return {
    botToken: String(settings.botToken || '').trim(),
    authEnabled: parseSettingBoolean(settings.authEnabled, DEFAULT_TELEGRAM_SETTINGS.authEnabled),
    pairingPhrase: normalizePairingPhraseForStorage(settings.pairingPhrase || ''),
    allowedUsers: parseTelegramUserIds(settings.allowedUsers || []),
    webAppUrl: String(settings.webAppUrl || '').trim()
  };
}

export function parseTelegramUserIds(value) {
  if (Array.isArray(value)) {
    return value.map(item => String(item || '').trim()).filter(Boolean);
  }
  return String(value || '')
    .split(/[\s,;]+/)
    .map(item => item.trim())
    .filter(Boolean);
}

export function normalizePairingPhraseForStorage(value) {
  return String(value || '')
    .toLowerCase()
    .match(/[a-z0-9]+/g)
    ?.join(' ') || '';
}

export async function readDesktopLocalStorage() {
  const dir = getDesktopLocalStorageLevelDbDir();
  if (!dir || !(await pathExists(dir))) return {};

  const entries = await fs.readdir(dir, { withFileTypes: true }).catch(() => []);
  const records = new Map();

  for (const entry of entries) {
    if (!entry.isFile() || !/\.(ldb|log)$/i.test(entry.name)) continue;
    const filePath = path.join(dir, entry.name);
    const buffer = await fs.readFile(filePath).catch(() => null);
    if (!buffer) continue;

    const parsed = entry.name.endsWith('.log')
      ? parseLevelDbLog(buffer)
      : parseLevelDbTable(buffer);
    for (const item of parsed) {
      if (item.deleted) continue;
      const decoded = decodeLocalStorageRecord(item.key, item.value);
      if (!decoded || !decoded.key.startsWith('jsonAdventure_')) continue;

      const existing = records.get(decoded.key);
      if (!existing || decoded.priority > existing.priority || item.sequence > existing.sequence) {
        records.set(decoded.key, { ...decoded, sequence: item.sequence || 0 });
      }
    }
  }

  const result = {};
  for (const [key, record] of records.entries()) {
    result[key] = record.value;
  }
  return result;
}

export function getDesktopLocalStorageLevelDbDir() {
  if (process.env[DESKTOP_WEBVIEW_STORAGE_OVERRIDE]) {
    return path.resolve(process.env[DESKTOP_WEBVIEW_STORAGE_OVERRIDE]);
  }

  if (process.platform === 'win32') {
    const localAppData = process.env.LOCALAPPDATA || path.join(os.homedir(), 'AppData', 'Local');
    return path.join(localAppData, APP_IDENTIFIER, 'EBWebView', 'Default', 'Local Storage', 'leveldb');
  }

  if (process.platform === 'darwin') {
    return path.join(os.homedir(), 'Library', 'Application Support', APP_IDENTIFIER, 'EBWebView', 'Default', 'Local Storage', 'leveldb');
  }

  const dataHome = process.env.XDG_DATA_HOME || path.join(os.homedir(), '.local', 'share');
  return path.join(dataHome, APP_IDENTIFIER, 'EBWebView', 'Default', 'Local Storage', 'leveldb');
}

function parseLevelDbTable(buffer) {
  try {
    if (buffer.length < 48) return [];
    const footer = buffer.subarray(buffer.length - 48);
    const [metaHandle, metaEnd] = readVarintHandle(footer, 0);
    const [indexHandle] = readVarintHandle(footer, metaEnd);
    if (!metaHandle || !indexHandle) return [];

    const indexEntries = parseLevelDbBlock(buffer, indexHandle.offset, indexHandle.size);
    const output = [];
    for (const indexEntry of indexEntries) {
      const [dataHandle] = readVarintHandle(indexEntry.value, 0);
      if (!dataHandle) continue;
      for (const dataEntry of parseLevelDbBlock(buffer, dataHandle.offset, dataHandle.size)) {
        const parsedKey = splitInternalLevelDbKey(dataEntry.key);
        if (!parsedKey) continue;
        output.push({
          key: parsedKey.userKey,
          value: dataEntry.value,
          sequence: parsedKey.sequence,
          deleted: parsedKey.valueType === 0
        });
      }
    }
    return output;
  } catch {
    return [];
  }
}

function parseLevelDbBlock(fileBuffer, offset, size) {
  let data = fileBuffer.subarray(offset, offset + size);
  const trailer = fileBuffer.subarray(offset + size, offset + size + 5);
  if (trailer[0] === 1) {
    data = snappyRawUncompress(data);
  } else if (trailer[0] !== 0) {
    return [];
  }

  if (data.length < 4) return [];
  const restartCount = data.readUInt32LE(data.length - 4);
  const restartsOffset = data.length - 4 - (restartCount * 4);
  if (restartsOffset < 0) return [];

  let position = 0;
  let lastKey = Buffer.alloc(0);
  const entries = [];

  while (position < restartsOffset) {
    const sharedResult = readVarint32(data, position);
    const nonSharedResult = readVarint32(data, sharedResult.next);
    const valueLengthResult = readVarint32(data, nonSharedResult.next);
    if (!sharedResult.ok || !nonSharedResult.ok || !valueLengthResult.ok) break;

    const shared = sharedResult.value;
    const nonShared = nonSharedResult.value;
    const valueLength = valueLengthResult.value;
    position = valueLengthResult.next;
    if (shared > lastKey.length || position + nonShared + valueLength > restartsOffset) break;

    const key = Buffer.concat([lastKey.subarray(0, shared), data.subarray(position, position + nonShared)]);
    position += nonShared;
    const value = data.subarray(position, position + valueLength);
    position += valueLength;
    lastKey = key;
    entries.push({ key, value });
  }

  return entries;
}

function parseLevelDbLog(buffer) {
  const output = [];
  let physical = Buffer.alloc(0);
  let position = 0;

  while (position + 7 <= buffer.length) {
    const length = buffer.readUInt16LE(position + 4);
    const recordType = buffer[position + 6];
    position += 7;
    if (!length || position + length > buffer.length) break;

    const fragment = buffer.subarray(position, position + length);
    position += length;

    if (recordType === 1) {
      output.push(...parseWriteBatch(fragment));
      physical = Buffer.alloc(0);
    } else if (recordType === 2) {
      physical = Buffer.from(fragment);
    } else if (recordType === 3 && physical.length) {
      physical = Buffer.concat([physical, fragment]);
    } else if (recordType === 4 && physical.length) {
      output.push(...parseWriteBatch(Buffer.concat([physical, fragment])));
      physical = Buffer.alloc(0);
    }
  }

  return output;
}

function parseWriteBatch(payload) {
  const output = [];
  if (payload.length < 12) return output;
  const sequence = Number(payload.readBigUInt64LE(0));
  const count = payload.readUInt32LE(8);
  let position = 12;

  for (let i = 0; i < count && position < payload.length; i += 1) {
    const tag = payload[position++];
    const keyResult = readLengthPrefixedSlice(payload, position);
    if (!keyResult) break;
    position = keyResult.next;

    if (tag === 0) {
      output.push({ key: keyResult.value, value: Buffer.alloc(0), sequence: sequence + i, deleted: true });
    } else if (tag === 1) {
      const valueResult = readLengthPrefixedSlice(payload, position);
      if (!valueResult) break;
      position = valueResult.next;
      output.push({ key: keyResult.value, value: valueResult.value, sequence: sequence + i, deleted: false });
    } else {
      break;
    }
  }

  return output;
}

function readLengthPrefixedSlice(buffer, position) {
  const lengthResult = readVarint32(buffer, position);
  if (!lengthResult.ok) return null;
  const start = lengthResult.next;
  const end = start + lengthResult.value;
  if (end > buffer.length) return null;
  return { value: buffer.subarray(start, end), next: end };
}

function splitInternalLevelDbKey(key) {
  if (!key || key.length <= 8) return null;
  const packed = key.readBigUInt64LE(key.length - 8);
  return {
    userKey: key.subarray(0, key.length - 8),
    sequence: Number(packed >> 8n),
    valueType: Number(packed & 0xffn)
  };
}

function decodeLocalStorageRecord(keyBuffer, valueBuffer) {
  const keyText = keyBuffer.toString('latin1');
  const marker = 'jsonAdventure_';
  const index = keyText.indexOf(marker);
  if (index < 0) return null;

  const origin = keyText.slice(0, index).replace(/[\x00-\x1F\x7F-\x9F]/g, '');
  const localKey = keyText.slice(index).match(/^jsonAdventure_[A-Za-z0-9_%]+/)?.[0] || '';
  if (!localKey) return null;

  return {
    key: localKey,
    value: decodeChromiumLocalStorageValue(valueBuffer),
    priority: getOriginPriority(origin),
    origin
  };
}

function getOriginPriority(origin) {
  if (/tauri\.localhost/i.test(origin)) return 4;
  if (/127\.0\.0\.1|localhost/i.test(origin)) return 3;
  if (/file:\/\//i.test(origin)) return 2;
  return 1;
}

function decodeChromiumLocalStorageValue(buffer) {
  if (!buffer || buffer.length === 0) return '';
  let value = buffer;
  if (value[0] === 0 || value[0] === 1) value = value.subarray(1);

  let zeroCount = 0;
  for (const byte of value) {
    if (byte === 0) zeroCount += 1;
  }

  if (zeroCount > value.length / 4) {
    return value.toString('utf16le').replace(/\u0000/g, '');
  }

  return value.toString('utf8').replace(/\u0000/g, '');
}

function readVarintHandle(buffer, position) {
  const offsetResult = readVarint32(buffer, position);
  if (!offsetResult.ok) return [null, offsetResult.next];
  const sizeResult = readVarint32(buffer, offsetResult.next);
  if (!sizeResult.ok) return [null, sizeResult.next];
  return [{ offset: offsetResult.value, size: sizeResult.value }, sizeResult.next];
}

function readVarint32(buffer, position) {
  let result = 0;
  let shift = 0;
  let next = position;
  while (next < buffer.length && shift <= 28) {
    const byte = buffer[next++];
    result |= (byte & 0x7f) << shift;
    if ((byte & 0x80) === 0) {
      return { ok: true, value: result >>> 0, next };
    }
    shift += 7;
  }
  return { ok: false, value: 0, next };
}

function snappyRawUncompress(input) {
  let position = 0;
  const lengthResult = readVarint32(input, position);
  if (!lengthResult.ok) return Buffer.alloc(0);
  position = lengthResult.next;
  const output = Buffer.alloc(lengthResult.value);
  let outputPosition = 0;

  while (position < input.length && outputPosition < output.length) {
    const tag = input[position++];
    const type = tag & 3;

    if (type === 0) {
      let literalLength = tag >> 2;
      if (literalLength < 60) {
        literalLength += 1;
      } else {
        const byteCount = literalLength - 59;
        literalLength = 0;
        for (let i = 0; i < byteCount; i += 1) {
          literalLength |= input[position++] << (8 * i);
        }
        literalLength += 1;
      }
      input.copy(output, outputPosition, position, position + literalLength);
      position += literalLength;
      outputPosition += literalLength;
    } else {
      let length;
      let offset;
      if (type === 1) {
        length = 4 + ((tag >> 2) & 0x7);
        offset = ((tag & 0xe0) << 3) | input[position++];
      } else if (type === 2) {
        length = 1 + (tag >> 2);
        offset = input[position] | (input[position + 1] << 8);
        position += 2;
      } else {
        length = 1 + (tag >> 2);
        offset = (input[position] | (input[position + 1] << 8) | (input[position + 2] << 16) | (input[position + 3] << 24)) >>> 0;
        position += 4;
      }

      for (let i = 0; i < length; i += 1) {
        output[outputPosition + i] = output[outputPosition - offset + i];
      }
      outputPosition += length;
    }
  }

  return output;
}

function finiteNumber(value, fallback) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

export async function listGames() {
  const gamesDir = await getGamesDir();
  const entries = await fs.readdir(gamesDir, { withFileTypes: true }).catch(() => []);
  const games = [];

  for (const entry of entries) {
    if (!entry.isDirectory()) continue;

    const id = entry.name;
    const dir = path.join(gamesDir, id);
    const scenario = await readJsonFile(path.join(dir, 'scenario.json'), {});
    const player = await readJsonFile(path.join(dir, 'player.json'), {});
    const gamestate = await readJsonFile(path.join(dir, 'gamestate.json'), {});
    const stat = await fs.stat(dir).catch(() => null);
    games.push({
      id,
      saveName: scenario.saveName || id,
      summary: scenario.summary || '',
      startingScenario: scenario.startingScenario || '',
      playerName: player?.player?.name || '',
      worldName: scenario?.worldName || '',
      time: gamestate.time || {},
      modifiedMs: stat?.mtimeMs || 0,
      modifiedAt: stat?.mtime || null
    });
  }

  games.sort((a, b) => b.modifiedMs - a.modifiedMs || a.id.localeCompare(b.id));
  return games;
}

export async function loadGameFiles(id) {
  const gamesDir = await getGamesDir();
  const gameDir = resolveGameDir(gamesDir, id);
  if (!(await pathExists(gameDir))) {
    throw new Error(`Game save not found: ${id}`);
  }

  const entries = await fs.readdir(gameDir, { withFileTypes: true });
  const result = {};
  for (const entry of entries) {
    if (!entry.isFile() || !entry.name.endsWith('.json')) continue;
    result[entry.name] = await readJsonFile(path.join(gameDir, entry.name), {});
  }
  return result;
}

export async function loadGameSession(id) {
  const files = await loadGameFiles(id);
  const gameState = files['gamestate.json'] || { time: {}, stats: {}, inventory: [], locations: [], npcs: [] };
  if (files['locationsledger.json']) gameState.locations = files['locationsledger.json'].locations || [];
  if (files['npc-ledger.json']) gameState.npcs = files['npc-ledger.json'].npcs || [];

  return {
    id: String(id),
    files,
    gameState,
    playerInfo: files['player.json'] || { player: {} },
    worldInfo: files['worldinfo.json'] || { world: {} },
    summary: files['scenario.json']?.summary || '',
    startingScenario: files['scenario.json']?.startingScenario || '',
    chatHistory: Array.isArray(files['chat_history.json']) ? files['chat_history.json'] : []
  };
}

export async function loadTurnSnapshots(id) {
  const gamesDir = await getGamesDir();
  const gameDir = resolveGameDir(gamesDir, id);
  const snapshotPath = path.join(gameDir, TURN_SNAPSHOTS_FILE);
  const data = await readJsonFile(snapshotPath, { version: 1, snapshots: [] });
  const snapshots = Array.isArray(data?.snapshots) ? data.snapshots : [];
  return { version: 1, snapshots };
}

export async function saveTurnSnapshots(id, snapshots) {
  const gamesDir = await getGamesDir();
  const gameDir = resolveGameDir(gamesDir, id);
  const snapshotPath = path.join(gameDir, TURN_SNAPSHOTS_FILE);
  await writeJsonFile(snapshotPath, {
    version: 1,
    snapshots: snapshots.slice(-MAX_TURN_SNAPSHOTS)
  });
}

export async function listRewindPoints(id, limit = 10) {
  const { snapshots } = await loadTurnSnapshots(id);
  return snapshots.slice(-limit).reverse().map((snapshot, index) => ({
    index,
    id: snapshot.id,
    kind: snapshot.kind || 'turn',
    action: snapshot.action || '',
    createdAt: snapshot.createdAt || '',
    label: snapshotLabel(snapshot)
  }));
}

function snapshotLabel(snapshot) {
  const prefix = snapshot.kind === 'opening' ? 'Opening' : 'Turn';
  const action = String(snapshot.action || '').replace(/\s+/g, ' ').trim();
  return action ? `${prefix}: ${action.slice(0, 120)}` : prefix;
}

function createTurnSnapshot(session, action, kind = 'turn') {
  return {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`,
    version: 1,
    kind,
    createdAt: new Date().toISOString(),
    action: String(action || '').trim(),
    before: {
      gameState: deepClone(session.gameState || {}),
      playerInfo: deepClone(session.playerInfo || { player: {} }),
      summary: session.summary || '',
      startingScenario: session.startingScenario || '',
      chatHistory: deepClone(session.chatHistory || [])
    }
  };
}

function restoreSnapshotToSession(session, snapshot) {
  const before = snapshot?.before || {};
  session.gameState = deepClone(before.gameState || {});
  session.playerInfo = deepClone(before.playerInfo || { player: {} });
  session.summary = before.summary || '';
  session.startingScenario = before.startingScenario || session.startingScenario || '';
  session.chatHistory = deepClone(before.chatHistory || []);
  return session;
}

export async function rewindLastTurn(gameId) {
  const history = await loadTurnSnapshots(gameId);
  const snapshot = history.snapshots.pop();
  if (!snapshot) {
    return { success: false, error: 'No rewind snapshots yet. New turns will be rewindable from now on.' };
  }

  const session = await loadGameSession(gameId);
  restoreSnapshotToSession(session, snapshot);
  await saveGameSession(session);
  await saveTurnSnapshots(gameId, history.snapshots);
  return { success: true, session, snapshot };
}

export async function editLastTurn(gameId, replacementAction, settings = null) {
  const rewind = await rewindLastTurn(gameId);
  if (!rewind.success) return rewind;

  try {
    const result = await runGameTurn(gameId, replacementAction, settings);
    return { ...result, success: true, editedSnapshot: rewind.snapshot };
  } catch (err) {
    return {
      success: false,
      error: `Rewound before "${rewind.snapshot.action || 'the previous turn'}", but regeneration failed: ${err.message}`,
      session: rewind.session,
      snapshot: rewind.snapshot
    };
  }
}

function deepClone(value) {
  return JSON.parse(JSON.stringify(value ?? null));
}

export async function saveGameSession(session) {
  const gamesDir = await getGamesDir();
  const gameDir = resolveGameDir(gamesDir, session.id);
  await ensureDir(gameDir);

  // Atomic per-file writes (temp + rename). Concurrent desktop + Telegram play on the same
  // save is still unsupported — one writer at a time.
  await writeJsonFile(path.join(gameDir, 'gamestate.json'), session.gameState || {});
  await writeJsonFile(path.join(gameDir, 'player.json'), session.playerInfo || { player: {} });
  await writeJsonFile(path.join(gameDir, 'chat_history.json'), session.chatHistory || []);
  await writeJsonFile(path.join(gameDir, 'npc-ledger.json'), { npcs: session.gameState?.npcs || [] });
  await writeJsonFile(path.join(gameDir, 'locationsledger.json'), { locations: session.gameState?.locations || [] });

  const scenarioPath = path.join(gameDir, 'scenario.json');
  const scenario = await readJsonFile(scenarioPath, {});
  scenario.summary = session.summary || '';
  if (session.startingScenario !== undefined) scenario.startingScenario = session.startingScenario || '';
  scenario.saveName = scenario.saveName || String(session.id);
  await writeJsonFile(scenarioPath, scenario);
}

export async function listPresets() {
  const presetsDir = await getPresetsDir();
  const entries = await fs.readdir(presetsDir, { withFileTypes: true }).catch(() => []);
  const presets = [];
  for (const entry of entries) {
    if (!entry.isFile() || !entry.name.endsWith('.json')) continue;
    const preset = await readJsonFile(path.join(presetsDir, entry.name), null);
    if (preset) presets.push(preset);
  }
  presets.sort((a, b) => String(a.presetName || '').localeCompare(String(b.presetName || '')));
  return presets;
}

export function buildWorldJson(answers) {
  return {
    world: {
      type: answers.type || 'real',
      preset: answers.preset || '',
      name: answers.name || (answers.type === 'real' ? 'Earth' : 'Unknown'),
      startDate: answers.startDate || { day: 1, month: 1, year: new Date().getFullYear(), calendarType: 'gregorian' },
      tone: answers.tone || '',
      setting: answers.setting || (answers.type === 'real' ? 'The real world as we know it.' : ''),
      era: answers.era || (answers.type === 'real' ? 'Modern day' : ''),
      rules: answers.rules || '',
      magicOrTech: answers.magicOrTech || '',
      dangers: answers.dangers || '',
      factions: answers.factions || [],
      wikiUrl: answers.wikiUrl || '',
      wikiName: answers.wikiName || '',
      mediaWikiApiUrl: answers.mediaWikiApiUrl || ''
    }
  };
}

export function buildPlayerJson(answers) {
  return {
    player: {
      name: answers.name || 'Unknown',
      age: Number(answers.age) || 25,
      gender: answers.gender || 'Other',
      height: answers.height || '',
      weight: answers.weight || '',
      athleticism: answers.athleticism || 'average',
      intelligence: answers.intelligence || 'average',
      appearance: answers.appearance || answers.description || '',
      personality: answers.personality || '',
      backstory: answers.backstory || '',
      family: normalizeList(answers.family),
      friends: normalizeList(answers.friends),
      inventory: normalizeInventory(answers.inventory)
    }
  };
}

export function buildGameStateJson(worldAnswers, playerInfo = { player: {} }) {
  const startDate = worldAnswers.startDate || { day: 1, month: 1, year: new Date().getFullYear(), calendarType: 'gregorian' };
  const calendarType = startDate.calendarType || 'gregorian';
  const inventory = normalizeInventory(playerInfo?.player?.inventory || []);

  return {
    time: {
      hour: 8,
      minute: 0,
      period: 'AM',
      dayOfWeek: calendarType === 'gregorian'
        ? getDayOfWeek(startDate.year, startDate.month, startDate.day)
        : 'Day 1',
      day: Number(startDate.day) || 1,
      month: Number(startDate.month) || 1,
      year: Number(startDate.year) || new Date().getFullYear(),
      era: startDate.era || '',
      calendarType
    },
    stats: { health: 100, money: 0, hunger: 100, thirst: 100, energy: 100 },
    inventory,
    locations: [],
    npcs: []
  };
}

function getDayOfWeek(year, month, day) {
  try {
    const date = new Date(Number(year), Number(month) - 1, Number(day));
    if (Number.isNaN(date.getTime())) return 'Day 1';
    return ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][date.getDay()];
  } catch {
    return 'Day 1';
  }
}

function normalizeList(value) {
  if (Array.isArray(value)) return value.map(item => String(item).trim()).filter(Boolean);
  if (!value) return [];
  return String(value).split(',').map(item => item.trim()).filter(Boolean);
}

function normalizeInventory(value) {
  if (Array.isArray(value)) {
    return value.map(item => {
      if (typeof item === 'string') return { name: item.trim(), description: '' };
      return {
        name: String(item?.name || '').trim(),
        description: String(item?.description || '').trim()
      };
    }).filter(item => item.name);
  }
  return normalizeList(value).map(name => ({ name, description: '' }));
}

export async function createNewGame(payload) {
  const gamesDir = await getGamesDir();
  const folderName = await getUniqueGameFolderName(gamesDir, payload.saveName || payload.gameName || buildFallbackSaveName(payload));
  const gameDir = path.join(gamesDir, folderName);
  await ensureDir(gameDir);

  await writeJsonFile(path.join(gameDir, 'worldinfo.json'), payload.worldInfo || { world: {} });
  await writeJsonFile(path.join(gameDir, 'player.json'), payload.playerInfo || { player: {} });
  await writeJsonFile(path.join(gameDir, 'gamestate.json'), payload.gameState || {});
  await writeJsonFile(path.join(gameDir, 'scenario.json'), {
    startingScenario: payload.startingScenario || '',
    summary: payload.summary || '',
    saveName: folderName
  });
  await writeJsonFile(path.join(gameDir, 'locationsledger.json'), { locations: [] });
  await writeJsonFile(path.join(gameDir, 'npc-ledger.json'), { npcs: [] });
  await writeJsonFile(path.join(gameDir, 'mainoutput.json'), {
    time: {},
    textoutput: '',
    inventory_changes: [],
    location_changes: [],
    npc_changes: [],
    player_changes: [],
    stats: {}
  });
  await writeJsonFile(path.join(gameDir, 'chat_history.json'), []);
  await writeJsonFile(path.join(gameDir, TURN_SNAPSHOTS_FILE), { version: 1, snapshots: [] });

  return { success: true, folder: folderName };
}

export async function createGameFromAnswers({ worldAnswers, playerAnswers, startingScenario, summary = '', saveName = '' }) {
  const worldInfo = buildWorldJson(worldAnswers);
  const playerInfo = buildPlayerJson(playerAnswers);
  const gameState = buildGameStateJson(worldAnswers, playerInfo);
  const payload = { worldInfo, playerInfo, gameState, startingScenario, summary, saveName };
  if (!payload.saveName) payload.saveName = buildFallbackSaveName(payload);
  return createNewGame(payload);
}

export function buildGameSystemPrompt(allData, summaryText, relevantLore = '', settings = {}, extraContext = {}) {
  const provider = settings.provider || '';
  const ragData = extraContext.ragData || '';
  const wikipediaData = extraContext.wikipediaData || '';
  const braveData = extraContext.braveData || '';
  const fandomData = extraContext.fandomData || '';
  const defaultGamePrompt = `You are now a seasoned novelist acting as the Game Master. Write a dynamic, immersive, and grounded text-based adventure. You are impartial: you do not break character, do not summarize when you should roleplay, and do not skip time unless the player explicitly asks to wait, rest, travel, or otherwise advance time.

INTERNAL REASONING (never shown to the player — complete silently before writing):
1. PHYSICS — Is the player's action physically possible given their state, inventory, location, and surroundings?
2. TIME — How much time does this action realistically consume? Update the time fields accordingly.
3. STATE — How do Health, Hunger, Thirst, Energy, money, inventory, NPCs, and location change as a result? Express those changes only through the required JSON fields, not as numbers in the prose.
4. NPC LOGIC — What do present NPCs know, want, remember, and do right now?
5. CONSEQUENCES — Immediate, short-term, and plausible long-term fallout of the action.
6. NARRATIVE HOOK — What sensory detail, tension, or intrigue best serves immersion?

CRITICAL NARRATIVE RULES:
1. Grounded & Natural Prose: Write like a high-quality, traditionally published novel. The prose should flow naturally. Put the player inside a breathing world. The world exists on its own; the player is simply the protagonist navigating it.
2. Realistic Dialogue: ALL dialogue MUST be enclosed in proper double quotation marks (e.g., "Hello there," she said.). Characters must speak like normal, grounded humans. Absolutely NO hammy, hyper-stylized slang, forced era-specific jargon, or excessive "quippy" banter. Dialogue should sound like a real conversation, placed on its own line when a new character speaks. Play dialogue verbatim — never write "the guard agrees" when you can write what the guard actually says.
3. No Meta-References: Do not constantly remind the player of the setting or throw out random historical/world facts unless it makes strict narrative sense.
4. Clean Readability: Break your response into several short paragraphs (2-4 sentences max). Use standard Markdown formatting (bolding, italics).
5. No Stats or Lists in Text: NEVER output numbers for stat changes, and NEVER output a numbered list of options at the end. Describe consequences naturally in the prose, and end by presenting an open-ended situation or a subtle hook. Let the player decide what to do next without dictating a menu of choices. Stats, inventory, and time belong in the JSON systems — not in the narrative.
6. Player Agency: NEVER speak for the player character or take actions for them.
7. This client is text-only. Do not refer to images, portraits, UI buttons, audio, or visual generation.

SIMULATION DISCIPLINE:
- Time is real. Walking, talking, eating, fighting, and sleeping each consume appropriate time. Conversation plays line by line; do not collapse whole scenes into a summary unless the player asks to skip or wait.
- Failure, injury, social fallout, and death are real possibilities. Do not protect the player from bad decisions. Illegal or dangerous acts draw realistic reactions: people flee, alert others, refuse, bargain, or fight back.
- Outcomes come from logical simulation of the situation, not from arbitrary luck or soft plot armor.
- NPCs have memory. Rudeness, kindness, violence, and deception change how they treat the player going forward. Reflect lasting disposition shifts through npc_changes notes and natural behavior, not through exposition dumps.
- Present the consequences of the player's last action before fully opening the new situation.

CURRENCY RULE: Always track the player's money through the stats.money field (as an integer). Do NOT create inventory items for money, credits, coins, gold, or any form of currency. When the player earns or spends money, update stats.money to the new total. Only use inventory_changes for physical items.

INVENTORY UPDATE RULE: When an existing inventory item changes (e.g. quantity, condition, or name), use the "update" action with the item's current name and set newName/description to the updated values. Do NOT remove and re-add items to change them — use "update" instead.

Rely on the background JSON systems to handle stats, inventory, time, NPCs, and locations. Your ONLY job in the text output is to write a beautiful, grounded, and engaging story.`;

  const customBase = settings.promptGame || defaultGamePrompt;
  const stateUpdateContract = `STATE UPDATE CONTRACT:
- Always express state changes in JSON arrays, not in narrative prose.
- inventory_changes supports action "add", "update", or "remove".
- location_changes supports action "add", "update", or "remove".
- npc_changes supports action "add", "update", or "remove". Put current status, relationship history, or GM notes in notes.
- player_changes supports action "update" for field "description", "appearance", "personality", or "backstory".
- If nothing changed for a system, output an empty array for that system.`;

  const contextUseRules = `CONTEXT USE RULES:
- Use retrieved memory, codex entries, web results, and fandom lore as references only when they are relevant to the player's current action.
- Current game state and player/world facts override older retrieved memory if they conflict.
- Keep canon/lore references natural; do not dump unrelated facts.`;

  const baseParts = `${customBase}

${stateUpdateContract}

${contextUseRules}

=== WORLD INFO ===
${JSON.stringify(allData.worldInfo || {}, null, 2)}

=== PLAYER CHARACTER ===
${JSON.stringify(allData.playerInfo || {}, null, 2)}

=== GAME STATE ===
${JSON.stringify(allData.gameState || {}, null, 2)}

=== ADVENTURE SUMMARY ===
${summaryText || ''}

=== RELEVANT CODEX ENTRIES ===
${relevantLore || ''}

=== RETRIEVED MEMORY ===
${ragData}

=== WIKIPEDIA ===
${wikipediaData}

=== BRAVE WEB SEARCH ===
${braveData}

=== LORE WIKI ===
${fandomData}`;

  if (provider === 'openai') {
    return `${baseParts}

=== REQUIRED OUTPUT FORMAT ===
Your entire response must be valid JSON only. No markdown, no prose outside the JSON object. Use this shape:
{"time":{"hour":0,"minute":0,"period":"AM","dayOfWeek":"Monday","day":1,"month":1,"year":1,"era":"CE","calendarType":"gregorian"},"textoutput":"Your full narrative here.","inventory_changes":[],"location_changes":[],"npc_changes":[],"player_changes":[],"stats":{"health":100,"money":0,"hunger":100,"thirst":100,"energy":100}}`;
  }

  return baseParts;
}

async function buildTurnSystemPrompt(session, userInput, settings) {
  const allData = {
    worldInfo: session.worldInfo,
    playerInfo: session.playerInfo,
    gameState: session.gameState
  };
  let retrieval = {
    relevantLore: '',
    ragData: '',
    wikipediaData: '',
    braveData: '',
    fandomData: ''
  };
  try {
    const mod = await import('./odyssey-retrieval.mjs');
    retrieval = await mod.buildTurnRetrievalContext(userInput, session, settings);
  } catch (err) {
    console.warn(`Retrieval context failed: ${err.message}`);
  }
  const relevantLore = retrieval.relevantLore || buildRelevantLore(session);
  return buildGameSystemPrompt(allData, session.summary, relevantLore, settings, {
    ragData: retrieval.ragData,
    wikipediaData: retrieval.wikipediaData,
    braveData: retrieval.braveData,
    fandomData: retrieval.fandomData
  });
}

export function isOpenRouterProvider(value) {
  return String(value || '').trim().toLowerCase() === 'openrouter';
}

export function isOpenRouterUrl(value) {
  try {
    return new URL(String(value || '')).hostname.toLowerCase().includes('openrouter.ai');
  } catch {
    return String(value || '').toLowerCase().includes('openrouter.ai');
  }
}

export function applyOpenRouterAttributionHeaders(headers, providerOrUrl) {
  if (!headers || (!isOpenRouterProvider(providerOrUrl) && !isOpenRouterUrl(providerOrUrl))) return headers;
  headers['HTTP-Referer'] = OPENROUTER_APP_URL;
  headers['X-OpenRouter-Title'] = OPENROUTER_APP_TITLE;
  headers['X-Title'] = OPENROUTER_APP_TITLE;
  headers['X-OpenRouter-Categories'] = OPENROUTER_APP_CATEGORIES;
  return headers;
}

export function buildAuthHeaders(apiKey, providerOrUrl = 'openrouter') {
  const headers = { 'Content-Type': 'application/json' };
  if (apiKey && String(apiKey).trim()) headers.Authorization = `Bearer ${apiKey}`;
  return applyOpenRouterAttributionHeaders(headers, providerOrUrl);
}

export function getChatCompletionsUrl(settings) {
  const provider = settings.provider || 'openrouter';
  const baseUrl = settings.baseUrl || '';

  if (provider === 'xai') return 'https://api.x.ai/v1/chat/completions';
  if (provider === 'googleai') return 'https://generativelanguage.googleapis.com/v1beta/openai/chat/completions';
  if (provider === 'lmstudio' || provider === 'openai') {
    if (!baseUrl) throw new Error(`Provider "${provider}" needs a base URL.`);
    return baseUrl.endsWith('/') ? `${baseUrl}chat/completions` : `${baseUrl}/chat/completions`;
  }
  return 'https://openrouter.ai/api/v1/chat/completions';
}

export function normalizeReasoningEffort(value, fallback = 'low') {
  const normalized = String(value || '').trim().toLowerCase();
  return REASONING_EFFORT_ORDER.includes(normalized) ? normalized : fallback;
}

export function getReasoningPayloadOptions(settings, purpose = 'main') {
  if (settings.provider !== 'openrouter') return {};
  const configuredEffort = normalizeReasoningEffort(settings.reasoningEffort, 'low');
  if (purpose === 'helper' || purpose === 'summary' || purpose === 'repair') {
    return { reasoning: { effort: 'low', exclude: true } };
  }
  return {
    reasoning: {
      effort: settings.enableReasoning ? configuredEffort : 'low',
      exclude: true
    }
  };
}

export function getCompletionBudget(maxTokens, settings, payloadOptions = {}, minFinalTokens = 3500) {
  const requested = Math.max(Number(maxTokens) || 0, minFinalTokens);
  if (settings.provider !== 'openrouter' || !payloadOptions?.reasoning) return requested;

  const effort = normalizeReasoningEffort(payloadOptions.reasoning.effort, 'low');
  const finalRatio = Math.max(0.05, 1 - (REASONING_EFFORT_RATIOS[effort] ?? 0.2));
  const needed = Math.ceil(minFinalTokens / finalRatio);
  return Math.min(Math.max(requested, needed), 32000);
}

export function buildFetchPayload(settings, messages, jsonSchema = null, options = {}) {
  const provider = settings.provider || 'openrouter';
  const payload = {
    model: settings.model,
    messages,
    temperature: Number(settings.temperature),
    max_tokens: Number(settings.maxTokens),
    top_p: Number(settings.topP)
  };

  if (Number(settings.presencePenalty) !== 0 && provider !== 'xai') {
    payload.presence_penalty = Number(settings.presencePenalty);
  }
  if (Number(settings.frequencyPenalty) !== 0 && provider !== 'xai') {
    payload.frequency_penalty = Number(settings.frequencyPenalty);
  }
  if (options?.reasoning) payload.reasoning = options.reasoning;

  if (provider === 'lmstudio') {
    payload.response_format = {
      type: 'json_schema',
      json_schema: {
        name: 'game_turn',
        schema: jsonSchema || GAME_OUTPUT_SCHEMA
      }
    };
  } else if (provider !== 'openai' && jsonSchema && typeof jsonSchema === 'object') {
    payload.response_format = {
      type: 'json_schema',
      json_schema: {
        name: 'game_turn',
        strict: true,
        schema: jsonSchema
      }
    };
  }

  return JSON.stringify(payload);
}

export function stripJsonCodeFences(content) {
  if (typeof content !== 'string') return '';
  let sanitized = content.trim();
  if (/^```json/i.test(sanitized)) {
    sanitized = sanitized.replace(/^```json\s*/i, '').replace(/\s*```$/, '').trim();
  } else if (sanitized.startsWith('```')) {
    sanitized = sanitized.replace(/^```\s*/, '').replace(/\s*```$/, '').trim();
  }
  return sanitized;
}

export function extractBalancedJsonSegment(text, openChar, closeChar) {
  if (typeof text !== 'string') return null;
  let start = -1;
  let depth = 0;
  let inString = false;
  let escaped = false;

  for (let i = 0; i < text.length; i += 1) {
    const ch = text[i];

    if (inString) {
      if (escaped) escaped = false;
      else if (ch === '\\') escaped = true;
      else if (ch === '"') inString = false;
      continue;
    }

    if (ch === '"') {
      inString = true;
      continue;
    }

    if (ch === openChar) {
      if (depth === 0) start = i;
      depth += 1;
    } else if (ch === closeChar && depth > 0) {
      depth -= 1;
      if (depth === 0 && start !== -1) return text.slice(start, i + 1);
    }
  }

  return null;
}

export function tryParseJsonObject(rawContent) {
  const sanitized = stripJsonCodeFences(rawContent);
  const candidates = [
    sanitized,
    extractBalancedJsonSegment(sanitized, '{', '}'),
    extractBalancedJsonSegment(sanitized, '[', ']')
  ].filter(Boolean);

  for (const candidate of candidates) {
    try {
      return JSON.parse(candidate);
    } catch {
      // Continue through candidates.
    }
  }

  return null;
}

export function getChoiceContentOrThrow(data, label = 'response') {
  const choice = data?.choices?.[0];
  const content = choice?.message?.content;
  if (typeof content === 'string' && content.trim()) return content;

  const finishReason = choice?.finish_reason || choice?.native_finish_reason || '';
  const hasReasoning = Boolean(choice?.message?.reasoning || choice?.message?.reasoning_details);
  const finishHint = finishReason ? ` Finish reason: ${finishReason}.` : '';
  const reasoningHint = hasReasoning ? ' The model returned reasoning but no final content.' : '';
  const budgetHint = finishReason === 'length' ? ' Increase max tokens or lower reasoning effort.' : '';
  throw new Error(`The AI returned no ${label} content.${finishHint}${reasoningHint}${budgetHint}`);
}

export function parseStructuredModelOutput(rawContent, requiredKeys = []) {
  const parsed = tryParseJsonObject(rawContent);
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new Error('The AI returned invalid JSON.');
  }

  for (const key of requiredKeys) {
    if (!Object.prototype.hasOwnProperty.call(parsed, key)) {
      throw new Error(`The AI response is missing required key "${key}".`);
    }
  }

  return parsed;
}

export async function callChatCompletions(settings, messages, options = {}) {
  const url = getChatCompletionsUrl(settings);
  const response = await fetch(url, {
    method: 'POST',
    headers: buildAuthHeaders(settings.apiKey, settings.provider === 'openrouter' ? settings.provider : url),
    body: buildFetchPayload(settings, messages, options.jsonSchema || null, options.payloadOptions || {})
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`API returned status ${response.status}: ${text}`);
  }

  return response.json();
}

export async function requestGameTurn(settings, messages) {
  const payloadOptions = getReasoningPayloadOptions(settings, 'main');
  const turnSettings = {
    ...settings,
    maxTokens: getCompletionBudget(settings.maxTokens, settings, payloadOptions, 3500)
  };
  const data = await callChatCompletions(turnSettings, messages, {
    jsonSchema: GAME_OUTPUT_SCHEMA,
    payloadOptions
  });
  const raw = getChoiceContentOrThrow(data, 'game turn');
  return parseStructuredModelOutput(raw, [
    'time',
    'textoutput',
    'inventory_changes',
    'location_changes',
    'npc_changes',
    'player_changes',
    'stats'
  ]);
}

export async function generateGameSummary(settings, allData) {
  if (!canUseAi(settings)) return allData.startingScenario || '';

  const prompt = `Create a concise adventure summary for an Odyssey text RPG campaign.

WORLD INFO:
${JSON.stringify(allData.worldInfo, null, 2)}

PLAYER INFO:
${JSON.stringify(allData.playerInfo, null, 2)}

STARTING SCENARIO:
${allData.startingScenario || ''}

Return only the summary text.`;

  const data = await callChatCompletions({ ...settings, maxTokens: Math.max(settings.maxTokens, 2000), temperature: 0.5 }, [
    { role: 'user', content: prompt }
  ]);
  return getChoiceContentOrThrow(data, 'summary').trim();
}

export async function generateGameSaveName(settings, summaryText, allData) {
  if (!canUseAi(settings)) return buildFallbackSaveName(allData);

  const prompt = `Generate one short distinctive save-game name for this Odyssey campaign.

Use ASCII letters, numbers, spaces, hyphens, and apostrophes only. Keep it under 36 characters.

WORLD INFO:
${JSON.stringify(allData.worldInfo, null, 2)}

PLAYER INFO:
${JSON.stringify(allData.playerInfo, null, 2)}

STARTING SCENARIO:
${allData.startingScenario || ''}

SUMMARY:
${summaryText || ''}

Output only JSON: {"saveName":"Distinctive Short Name"}`;

  try {
    const data = await callChatCompletions({ ...settings, maxTokens: 120, temperature: 0.55 }, [
      { role: 'user', content: prompt }
    ], { jsonSchema: null });
    const parsed = tryParseJsonObject(getChoiceContentOrThrow(data, 'save name'));
    return cleanGeneratedSaveName(parsed?.saveName) || buildFallbackSaveName(allData);
  } catch {
    return buildFallbackSaveName(allData);
  }
}

export function canUseAi(settings) {
  if (!settings?.model) return false;
  if (settings.provider === 'openai' || settings.provider === 'lmstudio') return Boolean(settings.baseUrl);
  return Boolean(settings.apiKey);
}

function findGameEntityByName(list, name) {
  const needle = String(name || '').trim().toLowerCase();
  if (!needle) return null;
  return list.find(entry => String(entry?.name || '').trim().toLowerCase() === needle) || null;
}

function removeGameEntityByName(list, name) {
  const needle = String(name || '').trim().toLowerCase();
  if (!needle) return list;
  return list.filter(entry => String(entry?.name || '').trim().toLowerCase() !== needle);
}

function getGameChangeAction(change, fallback = 'update') {
  const action = String(change?.action || fallback).trim().toLowerCase();
  return ['add', 'remove', 'update'].includes(action) ? action : fallback;
}

function getNpcChangeNotes(change) {
  return change?.notes || change?.status_or_history || change?.history_with_player || '';
}

function applyNpcNotes(npc, notes) {
  npc.notes = notes || '';
  npc.status_or_history = notes || '';
  if (Object.prototype.hasOwnProperty.call(npc, 'history_with_player')) {
    npc.history_with_player = notes || '';
  }
}

export function getMutableGamePlayer(session) {
  if (!session.playerInfo || typeof session.playerInfo !== 'object') session.playerInfo = { player: {} };
  if (!session.playerInfo.player || typeof session.playerInfo.player !== 'object') {
    session.playerInfo = { player: { ...session.playerInfo } };
  }
  return session.playerInfo.player;
}

export function applyGameTurn(session, aiJsonOrText) {
  const aiJson = typeof aiJsonOrText === 'string'
    ? (tryParseJsonObject(aiJsonOrText) || { textoutput: aiJsonOrText })
    : aiJsonOrText;
  const displayText = aiJson.textoutput || String(aiJsonOrText || '');

  if (!session.gameState) session.gameState = {};

  if (aiJson.time) session.gameState.time = aiJson.time;
  if (aiJson.stats) {
    if (!session.gameState.stats) session.gameState.stats = {};
    Object.assign(session.gameState.stats, aiJson.stats);
  }

  if (Array.isArray(aiJson.inventory_changes)) {
    if (!session.gameState.inventory) session.gameState.inventory = [];
    for (const change of aiJson.inventory_changes) {
      const action = getGameChangeAction(change, 'update');
      const name = String(change.name || '').trim();
      const newName = String(change.newName || '').trim();
      const description = String(change.description || '').trim();
      if (!name && !newName) continue;

      if (action === 'remove') {
        session.gameState.inventory = removeGameEntityByName(session.gameState.inventory, name);
      } else if (action === 'add') {
        const item = findGameEntityByName(session.gameState.inventory, newName || name) || findGameEntityByName(session.gameState.inventory, name);
        if (item) {
          item.name = newName || name;
          if (description) item.description = description;
        } else {
          session.gameState.inventory.push({ name: newName || name, description });
        }
      } else if (action === 'update') {
        const item = findGameEntityByName(session.gameState.inventory, name);
        if (item) {
          if (newName) item.name = newName;
          if (description) item.description = description;
        }
      }
    }
  }

  if (Array.isArray(aiJson.location_changes)) {
    if (!session.gameState.locations) session.gameState.locations = [];
    for (const change of aiJson.location_changes) {
      const action = getGameChangeAction(change, change.action ? 'update' : 'add');
      const name = String(change.name || '').trim();
      const newName = String(change.newName || '').trim();
      const description = String(change.description || '').trim();
      const notes = String(change.notes || '').trim();
      if (!name && !newName) continue;

      if (action === 'remove') {
        session.gameState.locations = removeGameEntityByName(session.gameState.locations, name);
        continue;
      }

      let location = findGameEntityByName(session.gameState.locations, name) || findGameEntityByName(session.gameState.locations, newName);
      if (!location) {
        location = { name: newName || name, description: '' };
        session.gameState.locations.push(location);
      }
      if (newName) location.name = newName;
      if (description) location.description = description;
      if (notes) location.notes = notes;
    }
  }

  if (Array.isArray(aiJson.npc_changes)) {
    if (!session.gameState.npcs) session.gameState.npcs = [];
    for (const change of aiJson.npc_changes) {
      const action = getGameChangeAction(change, change.action ? 'update' : 'add');
      const name = String(change.name || '').trim();
      const newName = String(change.newName || '').trim();
      const description = String(change.description || '').trim();
      const notes = String(getNpcChangeNotes(change)).trim();
      if (!name && !newName) continue;

      if (action === 'remove') {
        session.gameState.npcs = removeGameEntityByName(session.gameState.npcs, name);
        continue;
      }

      let npc = findGameEntityByName(session.gameState.npcs, name) || findGameEntityByName(session.gameState.npcs, newName);
      if (!npc) {
        npc = { name: newName || name, description: '', notes: '', status_or_history: '' };
        session.gameState.npcs.push(npc);
      }
      if (newName) npc.name = newName;
      if (description) npc.description = description;
      if (notes) applyNpcNotes(npc, notes);
    }
  }

  if (Array.isArray(aiJson.player_changes)) {
    const player = getMutableGamePlayer(session);
    for (const change of aiJson.player_changes) {
      if (getGameChangeAction(change, 'update') !== 'update') continue;
      const rawField = String(change.field || '').trim();
      const field = rawField === 'description' ? 'appearance' : rawField;
      if (!['appearance', 'personality', 'backstory'].includes(field)) continue;
      const value = String(change.value || '').trim();
      if (!value) continue;
      player[field] = value;
      if (field === 'appearance' && Object.prototype.hasOwnProperty.call(player, 'description')) player.description = value;
    }
  }

  return displayText;
}

export function buildCodexText(session) {
  const npcs = session.gameState?.npcs || [];
  const locations = session.gameState?.locations || [];
  const chunks = [];

  chunks.push('NPC Ledger');
  chunks.push(npcs.length ? npcs.map(npc => {
    const notes = npc.notes || npc.status_or_history || npc.history_with_player || '';
    return `- ${npc.name || 'Unnamed NPC'}\n  ${npc.description || 'No description recorded.'}${notes ? `\n  Notes: ${notes}` : ''}`;
  }).join('\n') : '- No NPC knowledge recorded.');

  chunks.push('');
  chunks.push('Location Ledger');
  chunks.push(locations.length ? locations.map(location => {
    return `- ${location.name || 'Unnamed Location'}\n  ${location.description || 'No description recorded.'}${location.notes ? `\n  Notes: ${location.notes}` : ''}`;
  }).join('\n') : '- No location knowledge recorded.');

  return chunks.join('\n');
}

export function buildPlayerText(session) {
  const player = session.playerInfo?.player || {};
  const inventory = session.gameState?.inventory || [];
  const rows = [
    ['Name', player.name],
    ['Age', player.age],
    ['Gender', player.gender],
    ['Height', player.height],
    ['Weight', player.weight],
    ['Athleticism', player.athleticism],
    ['Intelligence', player.intelligence]
  ].filter(([, value]) => value !== undefined && value !== null && value !== '');

  const sections = [];
  sections.push('Player');
  sections.push(rows.map(([key, value]) => `${key}: ${value}`).join('\n') || 'No player details recorded.');
  if (player.appearance) sections.push(`\nDescription:\n${player.appearance}`);
  if (player.personality) sections.push(`\nPersonality:\n${player.personality}`);
  if (player.backstory) sections.push(`\nBackstory:\n${player.backstory}`);
  sections.push('\nInventory:');
  sections.push(inventory.length ? inventory.map(item => `- ${item.name || 'Unnamed item'}${item.description ? `: ${item.description}` : ''}`).join('\n') : '- Inventory is empty.');
  return sections.join('\n');
}

export function buildStatsText(session) {
  const stats = session.gameState?.stats || {};
  const time = session.gameState?.time || {};
  const clock = [
    time.dayOfWeek,
    time.month && time.day && time.year ? `${time.month}/${time.day}/${time.year}` : '',
    time.hour !== undefined ? `${String(time.hour).padStart(2, '0')}:${String(time.minute || 0).padStart(2, '0')} ${time.period || ''}`.trim() : ''
  ].filter(Boolean).join(' ');

  const statText = ['health', 'money', 'hunger', 'thirst', 'energy']
    .filter(key => stats[key] !== undefined)
    .map(key => `${capitalize(key)}: ${stats[key]}`)
    .join('\n');
  return `Time: ${clock || 'Unknown'}\n${statText || 'No stats recorded.'}`;
}

export function getLatestNarration(session) {
  const history = Array.isArray(session.chatHistory) ? [...session.chatHistory].reverse() : [];
  for (const message of history) {
    if (message.role !== 'assistant') continue;
    const parsed = tryParseJsonObject(message.content);
    if (parsed?.textoutput) return parsed.textoutput;
    if (message.content) return message.content;
  }
  return session.startingScenario || session.summary || 'No narration yet.';
}

export function stripMarkdownForPlainText(text) {
  return String(text || '')
    .replace(/!\[[^\]]*]\([^)]*\)/g, '')
    .replace(/\[([^\]]+)]\(([^)]+)\)/g, '$1')
    .replace(/```[\s\S]*?```/g, block => block.replace(/```[a-zA-Z]*|```/g, ''))
    .replace(/`([^`]+)`/g, '$1')
    .replace(/[*_~#>]/g, '')
    .replace(/\r\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

export function wrapText(text, width = 88) {
  const paragraphs = String(text || '').split(/\n{2,}/);
  return paragraphs.map(paragraph => {
    const lines = paragraph.split('\n');
    return lines.map(line => wrapLine(line, width)).join('\n');
  }).join('\n\n');
}

function wrapLine(line, width) {
  const words = String(line || '').split(/\s+/).filter(Boolean);
  if (!words.length) return '';
  const output = [];
  let current = '';
  for (const word of words) {
    if (!current) {
      current = word;
    } else if ((current.length + word.length + 1) <= width) {
      current += ` ${word}`;
    } else {
      output.push(current);
      current = word;
    }
  }
  if (current) output.push(current);
  return output.join('\n');
}

function capitalize(value) {
  const text = String(value || '');
  return text ? text[0].toUpperCase() + text.slice(1) : text;
}

export function buildRelevantLore(session) {
  const npcs = session.gameState?.npcs || [];
  const locations = session.gameState?.locations || [];
  const inventory = session.gameState?.inventory || [];
  const chunks = [];
  if (npcs.length) chunks.push(`NPCS:\n${npcs.map(npc => `- ${npc.name}: ${npc.description || ''} ${npc.notes || npc.status_or_history || ''}`.trim()).join('\n')}`);
  if (locations.length) chunks.push(`LOCATIONS:\n${locations.map(location => `- ${location.name}: ${location.description || ''} ${location.notes || ''}`.trim()).join('\n')}`);
  if (inventory.length) chunks.push(`INVENTORY:\n${inventory.map(item => `- ${item.name}: ${item.description || ''}`.trim()).join('\n')}`);
  return chunks.join('\n\n');
}

function compactHistoryForTurn(history, maxMessages = 24) {
  const nonSystem = (history || []).filter(message => message.role !== 'system');
  return nonSystem.slice(Math.max(0, nonSystem.length - maxMessages));
}

export async function runOpeningTurn(gameId, _settings = null) {
  // Always refresh so Telegram/CLI pick up desktop RAG and model changes mid-session.
  const activeSettings = await loadSettings();
  if (!canUseAi(activeSettings)) {
    throw new Error('AI settings are not configured. Run `npm run odyssey:cli`, open Settings, and save a provider/model/API key first.');
  }

  const session = await loadGameSession(gameId);
  const snapshot = createTurnSnapshot(session, 'Opening scene', 'opening');
  const opening = `Begin the adventure. Here is the opening scenario:\n\n${session.startingScenario}\n\nNarrate this opening scene immersively and then present the player with their first choice or opportunity to act.`;
  const system = await buildTurnSystemPrompt(session, opening, activeSettings);
  const messages = [
    { role: 'system', content: system },
    { role: 'user', content: opening }
  ];
  const aiJson = await requestGameTurn(activeSettings, messages);
  const aiText = JSON.stringify(aiJson);
  const displayText = applyGameTurn(session, aiJson);
  session.chatHistory = [
    { role: 'system', content: system },
    { role: 'user', content: opening },
    { role: 'assistant', content: aiText }
  ];
  await saveGameSession(session);
  const timeline = await loadTurnSnapshots(gameId);
  timeline.snapshots.push(snapshot);
  await saveTurnSnapshots(gameId, timeline.snapshots);
  return { session, text: displayText, aiJson };
}

export async function runGameTurn(gameId, playerAction, _settings = null) {
  // Always refresh so Telegram/CLI pick up desktop RAG and model changes mid-session.
  const activeSettings = await loadSettings();
  if (!canUseAi(activeSettings)) {
    throw new Error('AI settings are not configured. Run `npm run odyssey:cli`, open Settings, and save a provider/model/API key first.');
  }

  const session = await loadGameSession(gameId);
  const cleanAction = String(playerAction || '').trim();
  const snapshot = createTurnSnapshot(session, cleanAction, 'turn');
  const system = await buildTurnSystemPrompt(session, cleanAction, activeSettings);
  const prior = compactHistoryForTurn(session.chatHistory);
  const userMessage = { role: 'user', content: cleanAction };
  const messages = [
    { role: 'system', content: system },
    ...prior,
    userMessage
  ];

  const aiJson = await requestGameTurn(activeSettings, messages);
  const aiText = JSON.stringify(aiJson);
  const displayText = applyGameTurn(session, aiJson);
  session.chatHistory = [
    { role: 'system', content: system },
    ...prior,
    userMessage,
    { role: 'assistant', content: aiText }
  ];

  await maybeSummarizeHistory(session, activeSettings);
  await saveGameSession(session);
  const timeline = await loadTurnSnapshots(gameId);
  timeline.snapshots.push(snapshot);
  await saveTurnSnapshots(gameId, timeline.snapshots);
  return { session, text: displayText, aiJson };
}

export async function maybeSummarizeHistory(session, settings) {
  const nonSystem = (session.chatHistory || []).filter(message => message.role !== 'system');
  if (nonSystem.length <= 24 || !canUseAi(settings)) return false;

  const oldMessages = nonSystem.slice(0, 8);
  const recentMessages = nonSystem.slice(8);
  const historyText = oldMessages.map(message => `${message.role.toUpperCase()}: ${message.content}`).join('\n\n');
  const prompt = `You are a chronicler. Merge these older Odyssey events into the existing adventure summary.

EXISTING SUMMARY:
${session.summary || 'None'}

OLDER EVENTS:
${historyText}

Return only the new merged summary.`;

  try {
    const payloadOptions = getReasoningPayloadOptions(settings, 'summary');
    const summarySettings = {
      ...settings,
      temperature: 0.3,
      maxTokens: getCompletionBudget(Math.max(settings.maxTokens, 2500), settings, payloadOptions, 2500)
    };
    const data = await callChatCompletions(summarySettings, [{ role: 'user', content: prompt }], { payloadOptions });
    const summary = getChoiceContentOrThrow(data, 'summary').trim();
    if (summary) {
      session.summary = summary;
      session.chatHistory = [session.chatHistory.find(message => message.role === 'system')].filter(Boolean).concat(recentMessages);
      return true;
    }
  } catch {
    return false;
  }

  return false;
}
