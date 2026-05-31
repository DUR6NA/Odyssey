#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  WORLD_PRESETS,
  buildGameStateJson,
  buildPlayerJson,
  buildWorldJson,
  canUseAi,
  createNewGame,
  generateGameSaveName,
  generateGameSummary,
  getLatestNarration,
  getOdysseyBaseDir,
  getTelegramStatePath,
  loadTelegramSettings,
  listGames,
  listPresets,
  listRewindPoints,
  loadGameSession,
  loadSettings,
  editLastTurn,
  readJsonFile,
  rewindLastTurn,
  runGameTurn,
  runOpeningTurn,
  normalizePairingPhraseForStorage,
  parseTelegramUserIds,
  writeJsonFile
} from './odyssey-core.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, '..');

loadEnvFile(path.join(repoRoot, '.env.local'));
loadEnvFile(path.join(repoRoot, '.env'));

let telegramSettings = await loadTelegramSettings();
const token = telegramSettings.botToken || '';
if (!token) {
  console.error('Missing Telegram bot token. Open Odyssey Settings > Telegram, paste the BotFather token, and save.');
  process.exit(1);
}

let allowedUsers = new Set();
let pairingPhrase = '';
let authEnabled = false;
let webAppUrl = '';
refreshAuthConfig();

const TELEGRAM_COMMANDS = [
  { command: 'start', description: 'Open the Odyssey menu' },
  { command: 'help', description: 'Show help and controls' },
  { command: 'verify', description: 'Verify this Telegram account' },
  { command: 'load', description: 'Load an Odyssey save' },
  { command: 'new', description: 'Create a new campaign' },
  { command: 'back', description: 'Go back one turn' },
  { command: 'edit', description: 'Edit and regenerate the last turn' },
  { command: 'history', description: 'Show rewind points' },
  { command: 'player', description: 'Show player and inventory' },
  { command: 'codex', description: 'Show NPC and location ledger' },
  { command: 'stats', description: 'Show clock and stats' },
  { command: 'settings', description: 'Show Telegram runtime settings' },
  { command: 'menu', description: 'Show main menu' },
  { command: 'cancel', description: 'Cancel current setup' }
];

function loadEnvFile(filePath) {
  if (!fs.existsSync(filePath)) return;
  const content = fs.readFileSync(filePath, 'utf8');
  for (const rawLine of content.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;
    const match = line.match(/^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/);
    if (!match) continue;
    const key = match[1];
    let value = match[2].trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    if (!process.env[key]) process.env[key] = value;
  }
}

function refreshAuthConfig() {
  const configuredUsers = parseTelegramUserIds(telegramSettings.allowedUsers || []);
  const envUsers = parseTelegramUserIds(process.env.ODYSSEY_TELEGRAM_ALLOWED_USERS || '');
  allowedUsers = new Set([...configuredUsers, ...envUsers].map(String));
  pairingPhrase = normalizePairingPhraseForStorage(
    process.env.ODYSSEY_TELEGRAM_PAIRING_PHRASE || telegramSettings.pairingPhrase || ''
  );
  if (process.env.ODYSSEY_TELEGRAM_AUTH_ENABLED) {
    authEnabled = String(process.env.ODYSSEY_TELEGRAM_AUTH_ENABLED).toLowerCase() === 'true';
  } else {
    authEnabled = Boolean(
      telegramSettings.authEnabled
        || envUsers.length
        || process.env.ODYSSEY_TELEGRAM_PAIRING_PHRASE
    );
  }
  webAppUrl = String(
    process.env.ODYSSEY_TELEGRAM_WEB_APP_URL
      || process.env.TELEGRAM_WEB_APP_URL
      || telegramSettings.webAppUrl
      || ''
  ).trim();
}

async function reloadTelegramSettings() {
  telegramSettings = await loadTelegramSettings();
  refreshAuthConfig();
}

class TelegramBotApi {
  constructor(botToken) {
    this.baseUrl = `https://api.telegram.org/bot${botToken}`;
  }

  async call(method, payload = {}) {
    const response = await fetch(`${this.baseUrl}/${method}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    const data = await response.json().catch(() => null);
    if (!response.ok || !data?.ok) {
      throw new Error(data?.description || `Telegram ${method} failed with ${response.status}`);
    }
    return data.result;
  }

  async sendMessage(chatId, text, options = {}) {
    const chunks = splitTelegramText(text);
    let last;
    const baseOptions = { ...options };
    const replyMarkup = baseOptions.reply_markup;
    delete baseOptions.reply_markup;
    for (let index = 0; index < chunks.length; index += 1) {
      const chunk = chunks[index];
      last = await this.call('sendMessage', {
        chat_id: chatId,
        text: chunk,
        link_preview_options: { is_disabled: true },
        ...baseOptions,
        ...(replyMarkup && index === chunks.length - 1 ? { reply_markup: replyMarkup } : {})
      });
    }
    return last;
  }

  async sendHtml(chatId, html, options = {}) {
    return this.sendMessage(chatId, html, { parse_mode: 'HTML', ...options });
  }

  async sendMessageDraft(chatId, text = 'Thinking...') {
    const draftId = Math.max(1, Math.floor(Date.now() % 2147483647));
    return this.call('sendMessageDraft', { chat_id: chatId, draft_id: draftId, text }).catch(() => null);
  }

  async sendChatAction(chatId, action = 'typing') {
    return this.call('sendChatAction', { chat_id: chatId, action }).catch(() => null);
  }

  async setMessageReaction(chatId, messageId, emoji = '👀') {
    if (!messageId) return null;
    return this.call('setMessageReaction', {
      chat_id: chatId,
      message_id: messageId,
      reaction: [{ type: 'emoji', emoji }],
      is_big: false
    }).catch(() => null);
  }

  async answerCallbackQuery(id, text = '') {
    return this.call('answerCallbackQuery', { callback_query_id: id, text }).catch(() => null);
  }
}

const api = new TelegramBotApi(token);

if (process.argv.includes('--setup')) {
  await setupBot();
  process.exit(0);
}

let state = await loadState();
let settings = await loadSettings();
let offset = Number(state.offset || 0);

console.log('Odyssey Telegram bot is polling. Press Ctrl+C to stop.');

while (true) {
  try {
    const updates = await api.call('getUpdates', {
      offset,
      timeout: 30,
      allowed_updates: ['message', 'callback_query']
    });

    for (const update of updates) {
      offset = Math.max(offset, update.update_id + 1);
      state.offset = offset;
      await handleUpdate(update);
      await saveState();
    }
  } catch (err) {
    console.error(`Polling error: ${err.message}`);
    await sleep(1500);
  }
}

async function setupBot() {
  await reloadTelegramSettings();
  await api.call('deleteWebhook', { drop_pending_updates: false });
  const me = await api.call('getMe');
  await api.call('setMyCommands', { commands: TELEGRAM_COMMANDS });
  await api.call('setMyShortDescription', {
    short_description: 'Play Odyssey saves with rich Telegram controls.'
  }).catch(() => null);
  await api.call('setMyDescription', {
    description: [
      'Odyssey turns your local desktop saves into a Telegram-playable text adventure.',
      'Use styled controls, rewind/edit tools, and local saves while the bot stays locked behind the pairing phrase from Settings > Telegram.'
    ].join('\n')
  }).catch(() => null);
  if (webAppUrl) {
    await api.call('setChatMenuButton', {
      menu_button: {
        type: 'web_app',
        text: 'Open Odyssey',
        web_app: { url: webAppUrl }
      }
    }).catch(() => null);
  } else {
    await api.call('setChatMenuButton', { menu_button: { type: 'commands' } }).catch(() => null);
  }
  console.log(`Verified Telegram bot @${me.username || me.first_name}. Commands, description, and menu registered.`);
  if (authEnabled) {
    console.log('Private pairing is enabled. Pair from Telegram by sending the words shown in Odyssey Settings > Telegram.');
  }
}

async function loadState() {
  const loaded = await readJsonFile(await getTelegramStatePath(), { offset: 0, chats: {}, pairedUsers: {}, verifiedUsers: {} });
  loaded.chats ||= {};
  loaded.pairedUsers ||= {};
  loaded.verifiedUsers ||= {};
  return loaded;
}

async function saveState() {
  await writeJsonFile(await getTelegramStatePath(), state);
}

function getChatState(chatId) {
  const key = String(chatId);
  if (!state.chats[key]) {
    state.chats[key] = {
      activeGameId: '',
      lastGames: [],
      lastPresets: [],
      mode: '',
      step: '',
      draft: {}
    };
  }
  return state.chats[key];
}

function resetChatFlow(chat) {
  chat.mode = '';
  chat.step = '';
  chat.draft = {};
}

function getTelegramUserId(from) {
  return String(from?.id || '');
}

function isVerificationRequired() {
  return Boolean(authEnabled);
}

function isVerified(from) {
  if (!isVerificationRequired()) return true;
  const id = getTelegramUserId(from);
  if (!id) return false;
  return allowedUsers.has(id) || Boolean(state.verifiedUsers?.[id]);
}

function verifyTelegramUser(from) {
  const id = getTelegramUserId(from);
  if (!id) return null;
  state.verifiedUsers ||= {};
  state.verifiedUsers[id] = {
    id,
    username: from?.username || '',
    firstName: from?.first_name || '',
    lastName: from?.last_name || '',
    verifiedAt: new Date().toISOString()
  };
  return state.verifiedUsers[id];
}

function verificationKeyboard() {
  return {
    reply_markup: {
      inline_keyboard: [[button('Verify account', 'verify', 'primary')]]
    }
  };
}

async function sendVerificationRequired(chatId, chat, reason = '') {
  if (chat) {
    chat.mode = 'verify';
    chat.step = 'pairingPhrase';
  }
  const body = pairingPhrase
    ? [
        reason || 'This Odyssey bot is private.',
        'Send /verify, then reply with the pairing words shown in Odyssey Settings > Telegram.'
      ].join('\n')
    : 'This Odyssey bot is private, but no pairing phrase is configured yet. Open Odyssey Settings > Telegram and save a pairing phrase.';
  await api.sendHtml(chatId, statusHtml('LOCK', 'Verification required', body), verificationKeyboard());
}

async function startVerification(chatId, chat, from = null) {
  if (!isVerificationRequired()) {
    resetChatFlow(chat);
    await api.sendHtml(chatId, statusHtml('OK', 'Verification off', 'This bot is not currently requiring verification.'), mainKeyboard());
    return;
  }

  if (from && isVerified(from)) {
    resetChatFlow(chat);
    await api.sendHtml(chatId, statusHtml('OK', 'Already verified', 'This Telegram account is already allowed to use this Odyssey bot.'), mainKeyboard());
    return;
  }

  if (!pairingPhrase) {
    resetChatFlow(chat);
    await api.sendHtml(chatId, statusHtml('LOCK', 'No pairing phrase', 'Open Odyssey Settings > Telegram and save a pairing phrase before verifying accounts.'));
    return;
  }

  chat.mode = 'verify';
  chat.step = 'pairingPhrase';
  chat.draft = {};
  await sendPrompt(
    chatId,
    'KEY',
    'Verify Odyssey bot',
    'Reply with the pairing words from Odyssey Settings > Telegram. This account will stay verified until pairings are reset.',
    'pairing words'
  );
}

async function handleVerificationText(chatId, chat, from, text) {
  if (canPairWithText(text)) {
    verifyTelegramUser(from);
    resetChatFlow(chat);
    await saveState();
    await api.sendHtml(chatId, statusHtml('OK', 'Verified', 'This Telegram account can now use the Odyssey bot.'), mainKeyboard());
    return;
  }

  chat.mode = 'verify';
  chat.step = 'pairingPhrase';
  await api.sendHtml(chatId, errorHtml('Verification failed', 'Those words did not match. Send /verify to try again, then copy the pairing words exactly from Settings > Telegram.'), verificationKeyboard());
}

async function handleUpdate(update) {
  await reloadTelegramSettings();
  if (update.message) return handleMessage(update.message);
  if (update.callback_query) return handleCallback(update.callback_query);
  return null;
}

function canPairWithText(text) {
  if (!authEnabled || !pairingPhrase) return false;
  return normalizePairingPhraseForStorage(text) === pairingPhrase;
}

async function rejectIfUnauthorized(chatId, from, text = '') {
  if (isVerified(from)) return false;
  await sendVerificationRequired(chatId, null);
  return true;
}

async function handleMessage(message) {
  const chatId = message.chat.id;
  const text = String(message.text || parseWebAppAction(message.web_app_data?.data) || '').trim();
  if (!text) return;

  const chat = getChatState(chatId);
  const command = text.startsWith('/')
    ? text.split(/\s+/)[0].toLowerCase().replace(/@.+$/, '')
    : '';

  if (isVerificationRequired() && !isVerified(message.from)) {
    if (command === '/start' || command === '/help' || command === '/menu') {
      resetChatFlow(chat);
      await sendVerificationRequired(chatId, chat);
      return;
    }
    if (command === '/verify') return startVerification(chatId, chat, message.from);
    if (command === '/cancel') {
      resetChatFlow(chat);
      await sendVerificationRequired(chatId, chat, 'Verification is still required.');
      return;
    }
    if (chat.mode === 'verify' && chat.step === 'pairingPhrase') {
      return handleVerificationText(chatId, chat, message.from, text);
    }
    await sendVerificationRequired(chatId, chat);
    return;
  }

  settings = await loadSettings();

  if (command) {
    return handleCommand(chatId, chat, command);
  }

  if (chat.mode === 'new') {
    return handleNewWizardText(chatId, chat, text);
  }

  if (chat.mode === 'editLast') {
    return handleEditLastText(chatId, chat, text);
  }

  if (!chat.activeGameId) {
    await api.sendHtml(chatId, statusHtml('🧭', 'Choose a save', 'Load an existing game or create a new campaign before sending player actions.'), mainKeyboard());
    return;
  }

  await api.setMessageReaction(chatId, message.message_id, '👀');
  return playTurn(chatId, chat, text);
}

async function playTurn(chatId, chat, action) {
  await api.sendChatAction(chatId);
  await api.sendMessageDraft(chatId, '🎲 Resolving your Odyssey turn...');
  try {
    const result = await runGameTurn(chat.activeGameId, action, settings);
    await api.sendHtml(chatId, formatTurnResult(result), playKeyboard());
  } catch (err) {
    await api.sendHtml(chatId, errorHtml('Turn failed', err.message), playKeyboard());
  }
}

async function handleCommand(chatId, chat, command) {
  if (command === '/start' || command === '/menu' || command === '/help') {
    resetChatFlow(chat);
    await api.sendHtml(chatId, helpText(), mainKeyboard());
    return;
  }

  if (command === '/verify') {
    resetChatFlow(chat);
    await api.sendHtml(chatId, statusHtml('OK', 'Already verified', 'This Telegram account is already allowed to use this Odyssey bot.'), mainKeyboard());
    return;
  }

  if (command === '/cancel') {
    resetChatFlow(chat);
    await api.sendHtml(chatId, statusHtml('✅', 'Cancelled', 'The current setup flow is cleared.'), mainKeyboard());
    return;
  }

  if (command === '/games' || command === '/load') return showLoadMenu(chatId, chat);
  if (command === '/new') return showNewWorldMenu(chatId, chat);
  if (command === '/back' || command === '/undo') return goBackOneTurn(chatId, chat);
  if (command === '/edit') return startEditLastTurn(chatId, chat);
  if (command === '/history') return sendRewindHistory(chatId, chat);
  if (command === '/player') return sendPlayer(chatId, chat);
  if (command === '/codex') return sendCodex(chatId, chat);
  if (command === '/stats') return sendStats(chatId, chat);
  if (command === '/settings') {
    await sendTelegramSettings(chatId, chat);
    return;
  }

  await api.sendHtml(chatId, helpText(), mainKeyboard());
}

async function handleCallback(query) {
  const chatId = query.message?.chat?.id;
  if (!chatId) return api.answerCallbackQuery(query.id, 'That button is no longer attached to a chat.');
  const chat = getChatState(chatId);
  const data = String(query.data || '');
  await api.answerCallbackQuery(query.id);

  if (isVerificationRequired() && !isVerified(query.from)) {
    if (data === 'verify') return startVerification(chatId, chat, query.from);
    await sendVerificationRequired(chatId, chat);
    return;
  }

  if (data === 'menu') return api.sendHtml(chatId, helpText(), mainKeyboard());
  if (data === 'verify') return startVerification(chatId, chat, query.from);
  if (data === 'load') return showLoadMenu(chatId, chat);
  if (data === 'new') return showNewWorldMenu(chatId, chat);
  if (data === 'back') return goBackOneTurn(chatId, chat);
  if (data === 'edit') return startEditLastTurn(chatId, chat);
  if (data === 'history') return sendRewindHistory(chatId, chat);
  if (data === 'player') return sendPlayer(chatId, chat);
  if (data === 'codex') return sendCodex(chatId, chat);
  if (data === 'stats') return sendStats(chatId, chat);
  if (data === 'settings') return sendTelegramSettings(chatId, chat);
  if (data.startsWith('act:')) {
    if (!chat.activeGameId) {
      await api.sendHtml(chatId, statusHtml('🧭', 'Choose a save', 'Load or create a game before using quick actions.'), mainKeyboard());
      return;
    }
    return playTurn(chatId, chat, data.slice('act:'.length));
  }

  if (data.startsWith('load:')) {
    const index = Number(data.slice('load:'.length));
    const id = chat.lastGames[index];
    if (!id) return api.sendHtml(chatId, errorHtml('Save unavailable', 'That save is no longer in the current list.'), mainKeyboard());
    chat.activeGameId = id;
    chat.mode = '';
    const session = await loadGameSession(id);
    await api.sendHtml(chatId, formatLoadedGame(session, id), playKeyboard());
    return;
  }

  if (data.startsWith('world:')) {
    return startNewWizardWithWorld(chatId, chat, data.slice('world:'.length));
  }

  if (data.startsWith('preset:')) {
    return startPlayerFromPreset(chatId, chat, data.slice('preset:'.length));
  }

  return null;
}

async function showLoadMenu(chatId, chat) {
  const games = await listGames();
  if (!games.length) {
    await api.sendHtml(chatId, statusHtml('📂', 'No saves yet', 'Create a new campaign and it will appear here.'), mainKeyboard());
    return;
  }

  const shown = games.slice(0, 10);
  chat.lastGames = shown.map(game => game.id);
  const text = [
    '📂 <b>Load Game</b>',
    '',
    ...shown.map((game, index) => {
      const player = game.playerName ? ` — ${game.playerName}` : '';
      return `${index + 1}. <b>${escapeHtml(game.saveName)}</b>${escapeHtml(player)}`;
    })
  ].join('\n');
  await api.sendHtml(chatId, text, {
    reply_markup: {
      inline_keyboard: shown.map((game, index) => [button(`📖 ${index + 1}. ${game.saveName}`.slice(0, 60), `load:${index}`, 'primary')])
        .concat([[button('🧭 Menu', 'menu')]])
    }
  });
}

async function showNewWorldMenu(chatId, chat) {
  chat.mode = 'new';
  chat.step = 'world';
  chat.draft = {};
  await api.sendHtml(chatId, statusHtml('✨', 'New Campaign', 'Choose a world for the next Odyssey save.'), {
    reply_markup: {
      inline_keyboard: [
        [button('🌎 Real World', 'world:real', 'primary'), button('🛠️ Custom', 'world:custom', 'success')],
        ...Object.keys(WORLD_PRESETS).map((name, index) => [button(`${worldEmoji(name)} ${name}`, `world:p${index}`, 'primary')]),
        [button('✖️ Cancel', 'menu', 'danger')]
      ]
    }
  });
}

async function showPlayerPresetMenu(chatId, chat) {
  const presets = await listPresets();
  const shown = presets.slice(0, 10);
  chat.lastPresets = shown;
  chat.step = 'playerPreset';

  const rows = [[button('🧑 Create New Character', 'preset:new', 'success')]];
  rows.push(...shown.map((preset, index) => [{
    text: `🎭 ${(preset.presetName || preset.name || `Preset ${index + 1}`).slice(0, 54)}`,
    callback_data: `preset:${index}`
  }]));
  rows.push([button('✖️ Cancel', 'menu', 'danger')]);

  await api.sendHtml(chatId, statusHtml('🎭', 'Player Preset', 'Pick a saved character, or make a new one. Preset answers can be kept with “skip”.'), {
    reply_markup: { inline_keyboard: rows }
  });
}

async function startPlayerFromPreset(chatId, chat, choice) {
  if (chat.mode !== 'new') {
    await api.sendHtml(chatId, statusHtml('✨', 'Start a new game first', 'Use /new, then choose a world and character preset.'), mainKeyboard());
    return;
  }

  const defaults = choice === 'new' ? {} : (chat.lastPresets?.[Number(choice)] || {});
  chat.draft.playerDefaults = defaults;
  chat.draft.playerAnswers = {
    age: defaults.age || 25,
    gender: defaults.gender || 'Other',
    height: defaults.height || '',
    weight: defaults.weight || '',
    athleticism: defaults.athleticism || 'average',
    intelligence: defaults.intelligence || 'average',
    family: normalizeTelegramList(defaults.family),
    friends: normalizeTelegramList(defaults.friends)
  };
  chat.step = 'playerName';
  await askPresetField(chatId, 'Player name?', defaults.name || 'Unknown');
}

async function startNewWizardWithWorld(chatId, chat, choice) {
  const presetNames = Object.keys(WORLD_PRESETS);
  chat.mode = 'new';
  chat.draft = {
    worldChoice: choice,
    worldAnswers: {},
    playerAnswers: {}
  };

  if (choice === 'real') {
    chat.draft.worldAnswers = {
      type: 'real',
      name: 'Earth',
      setting: 'The real world as we know it.',
      era: 'Modern day',
      factions: []
    };
    chat.step = 'date';
    await sendPrompt(chatId, '📅', 'Start date?', 'Send YYYY-MM-DD, or send “skip” for today.', 'YYYY-MM-DD or skip');
    return;
  }

  if (choice === 'custom') {
    chat.step = 'worldName';
    await sendPrompt(chatId, '🌌', 'World name?', 'Name the setting for this campaign.', 'World name');
    return;
  }

  if (choice.startsWith('p')) {
    const preset = WORLD_PRESETS[presetNames[Number(choice.slice(1))]];
    chat.draft.worldAnswers = {
      type: 'custom',
      preset: presetNames[Number(choice.slice(1))],
      ...preset
    };
    chat.step = 'date';
    await sendPrompt(chatId, worldEmoji(presetNames[Number(choice.slice(1))]), `Using ${preset.name}`, 'Start date? Send YYYY-MM-DD, or send “skip” for today.', 'YYYY-MM-DD or skip');
  }
}

async function handleNewWizardText(chatId, chat, text) {
  const draft = chat.draft || {};
  draft.worldAnswers ||= {};
  draft.playerAnswers ||= {};

  switch (chat.step) {
    case 'worldName':
      draft.worldAnswers = { type: 'custom', name: text };
      chat.step = 'worldSetting';
      await sendPrompt(chatId, '🗺️', 'World setting', 'Describe the places, rules, genre, and conflicts that define the world.', 'Describe the world');
      break;
    case 'worldSetting':
      draft.worldAnswers.setting = text;
      chat.step = 'tone';
      await sendPrompt(chatId, '🎨', 'Tone or mood?', 'Tell Odyssey how this campaign should feel.', 'Tone or mood');
      break;
    case 'date':
      draft.worldAnswers.startDate = text.toLowerCase() === 'skip' ? todayDate() : parseDate(text);
      chat.step = 'tone';
      await sendPrompt(chatId, '🎨', 'Tone or mood?', 'Tell Odyssey how this campaign should feel.', 'Tone or mood');
      break;
    case 'tone':
      draft.worldAnswers.tone = text;
      if (!draft.worldAnswers.startDate) draft.worldAnswers.startDate = todayDate();
      await showPlayerPresetMenu(chatId, chat);
      break;
    case 'playerName':
      draft.playerAnswers.name = valueOrDefault(text, draft.playerDefaults?.name || '');
      chat.step = 'age';
      await askPresetField(chatId, 'Age?', String(draft.playerDefaults?.age || '25'));
      break;
    case 'age':
      draft.playerAnswers.age = valueOrDefault(text, String(draft.playerDefaults?.age || '25'));
      chat.step = 'gender';
      await askPresetField(chatId, 'Gender?', draft.playerDefaults?.gender || 'Other');
      break;
    case 'gender':
      draft.playerAnswers.gender = valueOrDefault(text, draft.playerDefaults?.gender || 'Other');
      chat.step = 'height';
      await askPresetField(chatId, 'Height?', draft.playerDefaults?.height || '');
      break;
    case 'height':
      draft.playerAnswers.height = valueOrDefault(text, draft.playerDefaults?.height || '');
      chat.step = 'weight';
      await askPresetField(chatId, 'Weight?', draft.playerDefaults?.weight || '');
      break;
    case 'weight':
      draft.playerAnswers.weight = valueOrDefault(text, draft.playerDefaults?.weight || '');
      chat.step = 'athleticism';
      await askPresetField(chatId, 'Athleticism?', draft.playerDefaults?.athleticism || 'average');
      break;
    case 'athleticism':
      draft.playerAnswers.athleticism = valueOrDefault(text, draft.playerDefaults?.athleticism || 'average');
      chat.step = 'intelligence';
      await askPresetField(chatId, 'Intelligence?', draft.playerDefaults?.intelligence || 'average');
      break;
    case 'intelligence':
      draft.playerAnswers.intelligence = valueOrDefault(text, draft.playerDefaults?.intelligence || 'average');
      chat.step = 'playerDescription';
      await askPresetField(chatId, 'Describe the player character.', draft.playerDefaults?.appearance || '');
      break;
    case 'playerDescription':
      draft.playerAnswers.appearance = valueOrDefault(text, draft.playerDefaults?.appearance || '');
      chat.step = 'personality';
      await askPresetField(chatId, 'Personality?', draft.playerDefaults?.personality || '');
      break;
    case 'personality':
      draft.playerAnswers.personality = valueOrDefault(text, draft.playerDefaults?.personality || '');
      chat.step = 'backstory';
      await askPresetField(chatId, 'Backstory?', draft.playerDefaults?.backstory || '');
      break;
    case 'backstory':
      draft.playerAnswers.backstory = valueOrDefault(text, draft.playerDefaults?.backstory || '');
      chat.step = 'family';
      await askPresetField(chatId, 'Family? Send comma-separated entries, "none", or "skip" to keep.', formatPresetList(draft.playerDefaults?.family));
      break;
    case 'family':
      draft.playerAnswers.family = text.toLowerCase() === 'skip' || text.toLowerCase() === 'keep'
        ? normalizeTelegramList(draft.playerDefaults?.family)
        : text.toLowerCase() === 'none'
        ? []
        : normalizeTelegramList(text);
      chat.step = 'friends';
      await askPresetField(chatId, 'Friends? Send comma-separated entries, "none", or "skip" to keep.', formatPresetList(draft.playerDefaults?.friends));
      break;
    case 'friends':
      draft.playerAnswers.friends = text.toLowerCase() === 'skip' || text.toLowerCase() === 'keep'
        ? normalizeTelegramList(draft.playerDefaults?.friends)
        : text.toLowerCase() === 'none'
        ? []
        : normalizeTelegramList(text);
      chat.step = 'inventory';
      await askPresetField(chatId, 'Starting inventory? Send comma-separated items, "none", or "skip" to keep.', formatPresetList(draft.playerDefaults?.inventory));
      break;
    case 'inventory':
      draft.playerAnswers.inventory = text.toLowerCase() === 'skip' || text.toLowerCase() === 'keep'
        ? normalizeTelegramList(draft.playerDefaults?.inventory)
        : text.toLowerCase() === 'none'
        ? []
        : text.split(',').map(part => part.trim()).filter(Boolean);
      chat.step = 'scenario';
      await sendPrompt(chatId, '🎬', 'Opening scenario', 'Describe where the character is and what is happening.', 'Opening scene');
      break;
    case 'scenario':
      draft.startingScenario = text;
      await finishTelegramNewGame(chatId, chat);
      break;
    default:
      await api.sendHtml(chatId, errorHtml('Wizard state was lost', 'Start again with /new.'), mainKeyboard());
      chat.mode = '';
      chat.step = '';
      break;
  }
}

async function askPresetField(chatId, question, defaultValue = '') {
  if (defaultValue) {
    await sendPrompt(
      chatId,
      '✏️',
      question,
      `Current:\n${defaultValue}\n\nSend a replacement, or send “skip” to keep it.`,
      'Replacement or skip'
    );
  } else {
    await sendPrompt(chatId, '✏️', question, 'Send your answer.', 'Your answer');
  }
}

function valueOrDefault(text, defaultValue = '') {
  const normalized = String(text || '').trim();
  if ((normalized.toLowerCase() === 'skip' || normalized.toLowerCase() === 'keep') && defaultValue) {
    return defaultValue;
  }
  return normalized || defaultValue;
}

function normalizeTelegramList(value) {
  if (!value) return [];
  if (Array.isArray(value)) {
    return value.map(item => typeof item === 'string' ? item : item?.name || '').map(item => String(item).trim()).filter(Boolean);
  }
  return String(value).split(',').map(part => part.trim()).filter(Boolean);
}

function formatPresetList(value) {
  return normalizeTelegramList(value).join(', ');
}

async function finishTelegramNewGame(chatId, chat) {
  settings = await loadSettings();
  const draft = chat.draft;
  draft.playerAnswers = {
    age: 25,
    gender: 'Other',
    athleticism: 'average',
    intelligence: 'average',
    ...draft.playerAnswers
  };

  const worldInfo = buildWorldJson(draft.worldAnswers);
  const playerInfo = buildPlayerJson(draft.playerAnswers);
  const gameState = buildGameStateJson(draft.worldAnswers, playerInfo);
  const allData = {
    worldInfo,
    playerInfo,
    gameState,
    startingScenario: draft.startingScenario
  };

  await api.sendChatAction(chatId);
  await api.sendMessageDraft(chatId, '✨ Creating the Odyssey save...');
  let summary = draft.startingScenario;
  let saveName = '';
  if (canUseAi(settings)) {
    await api.sendHtml(chatId, statusHtml('✨', 'Creating the save', 'Odyssey is naming the campaign and opening the first scene.'));
    summary = await generateGameSummary(settings, allData).catch(() => draft.startingScenario);
    saveName = await generateGameSaveName(settings, summary, { ...allData, summary });
  }

  const result = await createNewGame({
    worldInfo,
    playerInfo,
    gameState,
    startingScenario: draft.startingScenario,
    summary,
    saveName
  });

  chat.activeGameId = result.folder;
  chat.mode = '';
  chat.step = '';
  chat.draft = {};

  if (canUseAi(settings)) {
    try {
      const opening = await runOpeningTurn(result.folder, settings);
      await api.sendHtml(chatId, formatCreatedGame(result.folder, opening), playKeyboard());
      return;
    } catch (err) {
      await api.sendHtml(chatId, `${statusHtml('✅', 'Created save', result.folder)}\n\n${errorHtml('Opening turn failed', err.message)}`, playKeyboard());
      return;
    }
  }

  await api.sendHtml(chatId, statusHtml('✅', 'Created save', `${result.folder}\n\nConfigure AI settings in the CLI before playing turns.`), playKeyboard());
}

async function sendRewindHistory(chatId, chat) {
  if (!chat.activeGameId) return api.sendHtml(chatId, noActiveGameHtml(), mainKeyboard());
  const points = await listRewindPoints(chat.activeGameId, 10);
  if (!points.length) {
    await api.sendHtml(chatId, statusHtml('↩️', 'No rewind snapshots yet', 'New turns will be rewindable from now on.'), playKeyboard());
    return;
  }
  await api.sendHtml(chatId, formatHistoryHtml(points), playKeyboard());
}

async function goBackOneTurn(chatId, chat) {
  if (!chat.activeGameId) return api.sendHtml(chatId, noActiveGameHtml(), mainKeyboard());
  const result = await rewindLastTurn(chat.activeGameId);
  if (!result.success) {
    await api.sendHtml(chatId, errorHtml('Could not rewind', result.error), playKeyboard());
    return;
  }

  await api.sendHtml(chatId, formatRewindResult(result), playKeyboard());
}

async function startEditLastTurn(chatId, chat) {
  if (!chat.activeGameId) return api.sendHtml(chatId, noActiveGameHtml(), mainKeyboard());
  const points = await listRewindPoints(chat.activeGameId, 1);
  if (!points.length) {
    await api.sendHtml(chatId, statusHtml('✏️', 'Nothing editable yet', 'New turns will be editable from now on.'), playKeyboard());
    return;
  }

  chat.mode = 'editLast';
  chat.step = '';
  chat.draft = { editingAction: points[0].action || points[0].label };
  await sendPrompt(chatId, '✏️', 'Editing the last action', `${chat.draft.editingAction}\n\nSend the replacement action, or /cancel.`, 'Replacement action');
}

async function handleEditLastText(chatId, chat, text) {
  if (!chat.activeGameId) return api.sendHtml(chatId, noActiveGameHtml(), mainKeyboard());
  chat.mode = '';
  chat.step = '';
  await api.sendChatAction(chatId);
  await api.sendMessageDraft(chatId, '✏️ Regenerating the edited turn...');

  const result = await editLastTurn(chat.activeGameId, text, settings);
  if (!result.success) {
    await api.sendHtml(chatId, errorHtml('Edit failed', result.error || 'Edit failed.'), playKeyboard());
    return;
  }

  chat.draft = {};
  await api.sendHtml(chatId, formatTurnResult(result, 'Edited and Regenerated'), playKeyboard());
}

async function sendPlayer(chatId, chat) {
  if (!chat.activeGameId) return api.sendHtml(chatId, noActiveGameHtml(), mainKeyboard());
  const session = await loadGameSession(chat.activeGameId);
  await api.sendHtml(chatId, formatPlayerHtml(session), playKeyboard());
}

async function sendCodex(chatId, chat) {
  if (!chat.activeGameId) return api.sendHtml(chatId, noActiveGameHtml(), mainKeyboard());
  const session = await loadGameSession(chat.activeGameId);
  await api.sendHtml(chatId, formatCodexHtml(session), playKeyboard());
}

async function sendStats(chatId, chat) {
  if (!chat.activeGameId) return api.sendHtml(chatId, noActiveGameHtml(), mainKeyboard());
  const session = await loadGameSession(chat.activeGameId);
  await api.sendHtml(chatId, formatStatsHtml(session), playKeyboard());
}

async function sendTelegramSettings(chatId, chat) {
  settings = await loadSettings();
  await api.sendHtml(chatId, formatTelegramSettingsHtml(chat), mainKeyboard());
}

function helpText() {
  return [
    '🌌 <b>Odyssey Telegram</b>',
    '',
    'Play your local Odyssey saves through Telegram with rich controls, styled buttons, rewind/edit tools, and status cards.',
    '',
    '<b>Commands</b>',
    'KEY /verify - verify this Telegram account',
    '📂 /load - choose an existing save',
    '✨ /new - create a campaign',
    '↩️ /back - go back one turn',
    '✏️ /edit - edit and regenerate the last turn',
    '📜 /history - show rewind points',
    '🧍 /player - player and inventory',
    '📚 /codex - NPC and location ledger',
    '📊 /stats - clock and tracked stats',
    '⚙️ /settings - show provider and Telegram runtime settings',
    '✖️ /cancel - cancel setup',
    '',
    '<i>Once a game is loaded, send any normal message as your player action.</i>'
  ].join('\n');
}

function mainKeyboard() {
  const rows = [
    [button('📂 Load Game', 'load', 'primary'), button('✨ New Game', 'new', 'success')],
    [button('↩️ Back', 'back'), button('✏️ Edit Last', 'edit'), button('📜 History', 'history')],
    [button('🧍 Player', 'player'), button('📚 Codex', 'codex'), button('📊 Stats', 'stats')],
    [button('⚙️ Settings', 'settings')]
  ];
  const appButton = webAppButton();
  if (appButton) rows.push([appButton]);
  return {
    reply_markup: {
      inline_keyboard: rows
    }
  };
}

function playKeyboard() {
  const rows = [
    [button('🔎 Look', 'act:look around', 'primary'), button('⏳ Wait', 'act:wait and observe')],
    [button('↩️ Back', 'back'), button('✏️ Edit Last', 'edit'), button('📜 History', 'history')],
    [button('🧍 Player', 'player'), button('📚 Codex', 'codex'), button('📊 Stats', 'stats')],
    [button('📂 Load', 'load'), button('🧭 Menu', 'menu')]
  ];
  const appButton = webAppButton();
  if (appButton) rows.push([appButton]);
  return {
    reply_markup: {
      inline_keyboard: rows
    }
  };
}

function button(text, callbackData, style = '') {
  return {
    text,
    callback_data: callbackData,
    ...(style ? { style } : {})
  };
}

function webAppButton() {
  if (!webAppUrl) return null;
  return {
    text: '🖥️ Open Odyssey App',
    web_app: { url: webAppUrl },
    style: 'primary'
  };
}

async function sendPrompt(chatId, icon, title, body, placeholder = 'Reply') {
  const text = [
    `${icon} <b>${escapeHtml(title)}</b>`,
    '',
    escapeHtml(body)
  ].join('\n');
  return api.sendHtml(chatId, text, {
    reply_markup: {
      force_reply: true,
      input_field_placeholder: String(placeholder || 'Reply').slice(0, 64)
    }
  });
}

function formatTelegramSettingsHtml(chat) {
  const activeGame = chat?.activeGameId || 'None loaded';
  const provider = settings.provider || 'unknown';
  const baseUrl = settings.baseUrl || providerDefaultBaseUrl(provider);
  const apiKeyStatus = settings.apiKey ? 'Configured' : 'Missing';
  const reasoning = settings.enableReasoning ? settings.reasoningEffort : 'off';
  return [
    '⚙️ <b>Telegram Runtime Settings</b>',
    '',
    `🎮 <b>Active save:</b> ${escapeHtml(activeGame)}`,
    `🤖 <b>Provider:</b> ${escapeHtml(provider)}`,
    `🧠 <b>Model:</b> ${escapeHtml(settings.model || 'Not set')}`,
    `🔑 <b>API key:</b> ${escapeHtml(apiKeyStatus)}`,
    `🌐 <b>Base URL:</b> ${escapeHtml(baseUrl)}`,
    `🎚️ <b>Temperature:</b> ${escapeHtml(settings.temperature)}`,
    `📏 <b>Max tokens:</b> ${escapeHtml(settings.maxTokens)}`,
    `💭 <b>Reasoning:</b> ${escapeHtml(reasoning)}`,
    '',
    `LOCK <b>Private mode:</b> ${authEnabled ? 'On' : 'Off'}`,
    `LINK <b>Verified users:</b> ${Object.keys(state.verifiedUsers || {}).length}`,
    `ID <b>Explicit allowed IDs:</b> ${allowedUsers.size}`,
    `KEY <b>Pairing phrase:</b> ${pairingPhrase ? 'Configured' : 'Missing'}`,
    `🖥️ <b>Mini App URL:</b> ${escapeHtml(webAppUrl || 'Not configured')}`,
    `📁 <b>Data folder:</b> ${escapeHtml(getOdysseyBaseDir())}`,
    '',
    '<i>Edit model and Telegram settings in the desktop app. Restart this runner after changing the bot token.</i>'
  ].join('\n');
}

function providerDefaultBaseUrl(provider) {
  if (provider === 'openrouter') return 'https://openrouter.ai/api/v1/chat/completions';
  if (provider === 'xai') return 'https://api.x.ai/v1/chat/completions';
  if (provider === 'googleai') return 'https://generativelanguage.googleapis.com/v1beta/openai/chat/completions';
  return 'Not set';
}

function formatTurnResult(result, title = 'Odyssey') {
  const narration = cleanNarration(result?.text);
  const parts = [
    `🎲 <b>${escapeHtml(title)}</b>`,
    escapeHtml(narration)
  ];
  const pulse = formatTurnPulse(result?.aiJson);
  if (pulse) parts.push(pulse);
  return parts.join('\n\n');
}

function formatCreatedGame(folder, opening) {
  return `${statusHtml('✅', 'Created save', folder)}\n\n${formatTurnResult(opening, 'Opening Scene')}`;
}

function formatLoadedGame(session, fallbackId) {
  const saveName = session.files?.['scenario.json']?.saveName || fallbackId;
  return [
    statusHtml('📖', 'Loaded save', saveName),
    formatNarrationCard(getLatestNarration(session), 'Latest Scene')
  ].join('\n\n');
}

function formatNarrationCard(text, title = 'Scene') {
  return [
    `🌌 <b>${escapeHtml(title)}</b>`,
    '',
    escapeHtml(cleanNarration(text))
  ].join('\n');
}

function formatTurnPulse(aiJson = {}) {
  if (!aiJson || typeof aiJson !== 'object') return '';
  const lines = [];
  const clock = formatClock(aiJson.time || {});
  if (clock) lines.push(`🕰️ <b>Time:</b> ${escapeHtml(clock)}`);
  const statsLine = formatStatsLine(aiJson.stats || {});
  if (statsLine) lines.push(statsLine);
  const inventory = summarizeChanges(aiJson.inventory_changes, '🎒 Inventory');
  if (inventory) lines.push(inventory);
  const npcs = summarizeChanges(aiJson.npc_changes, '👥 NPCs');
  if (npcs) lines.push(npcs);
  const locations = summarizeChanges(aiJson.location_changes, '🗺️ Locations');
  if (locations) lines.push(locations);
  return lines.length ? ['<b>Scene Pulse</b>', ...lines].join('\n') : '';
}

function summarizeChanges(changes, label) {
  const total = Array.isArray(changes) ? changes.length : 0;
  const usable = Array.isArray(changes)
    ? changes.filter(change => change && (change.name || change.newName || change.description || change.notes)).slice(0, 3)
    : [];
  if (!usable.length) return '';
  const summary = usable.map(change => {
    const action = String(change.action || 'update').toLowerCase();
    const icon = action === 'add' ? '🟢' : action === 'remove' ? '🔴' : '🟡';
    const name = change.newName || change.name || change.description || change.notes || 'Updated';
    return `${icon} ${escapeHtml(name)}`;
  }).join(', ');
  const suffix = total > usable.length ? ` +${total - usable.length} more` : '';
  return `<b>${label}:</b> ${summary}${escapeHtml(suffix)}`;
}

function formatPlayerHtml(session) {
  const player = session.playerInfo?.player || {};
  const inventory = session.gameState?.inventory || [];
  const rows = [
    ['🪪 Name', player.name],
    ['🎂 Age', player.age],
    ['⚧ Gender', player.gender],
    ['📏 Height', player.height],
    ['⚖️ Weight', player.weight],
    ['💪 Athleticism', player.athleticism],
    ['🧠 Intelligence', player.intelligence]
  ].filter(([, value]) => value !== undefined && value !== null && value !== '');
  const sections = ['🧍 <b>Player</b>'];
  sections.push(rows.length ? rows.map(([key, value]) => `<b>${key}:</b> ${escapeHtml(value)}`).join('\n') : 'No player details recorded.');
  if (player.appearance) sections.push(`\n👁️ <b>Description</b>\n${escapeHtml(player.appearance)}`);
  if (player.personality) sections.push(`\n✨ <b>Personality</b>\n${escapeHtml(player.personality)}`);
  if (player.backstory) sections.push(`\n📖 <b>Backstory</b>\n${escapeHtml(player.backstory)}`);
  sections.push('\n🎒 <b>Inventory</b>');
  sections.push(inventory.length
    ? inventory.map(item => `• <b>${escapeHtml(item.name || 'Unnamed item')}</b>${item.description ? ` — ${escapeHtml(item.description)}` : ''}`).join('\n')
    : '• Inventory is empty.');
  return sections.join('\n');
}

function formatCodexHtml(session) {
  const npcs = session.gameState?.npcs || [];
  const locations = session.gameState?.locations || [];
  return [
    '📚 <b>Game Codex</b>',
    '',
    formatEntityList('👥 NPC Ledger', npcs, 'No NPC knowledge recorded.'),
    '',
    formatEntityList('🗺️ Location Ledger', locations, 'No location knowledge recorded.')
  ].join('\n');
}

function formatEntityList(title, entries, emptyText) {
  if (!entries.length) return `<b>${title}</b>\n• ${escapeHtml(emptyText)}`;
  return [
    `<b>${title}</b>`,
    ...entries.slice(0, 12).map(entry => {
      const notes = entry.notes || entry.status_or_history || entry.history_with_player || '';
      const body = [
        `• <b>${escapeHtml(entry.name || 'Unnamed')}</b>`,
        entry.description ? `  ${escapeHtml(entry.description)}` : '  No description recorded.',
        notes ? `  <i>Notes:</i> ${escapeHtml(notes)}` : ''
      ].filter(Boolean);
      return body.join('\n');
    }),
    entries.length > 12 ? `…and ${entries.length - 12} more.` : ''
  ].filter(Boolean).join('\n');
}

function formatStatsHtml(session) {
  const stats = session.gameState?.stats || {};
  const time = session.gameState?.time || {};
  return [
    '📊 <b>Stats</b>',
    `🕰️ <b>Time:</b> ${escapeHtml(formatClock(time) || 'Unknown')}`,
    formatStatsLine(stats) || 'No stats recorded.'
  ].join('\n');
}

function formatStatsLine(stats) {
  const parts = [
    ['❤️', 'Health', stats.health],
    ['💰', 'Money', stats.money],
    ['🍗', 'Hunger', stats.hunger],
    ['💧', 'Thirst', stats.thirst],
    ['⚡', 'Energy', stats.energy]
  ].filter(([, , value]) => value !== undefined && value !== null && value !== '');
  return parts.length ? parts.map(([icon, label, value]) => `${icon} <b>${label}:</b> ${escapeHtml(value)}`).join('  ') : '';
}

function formatClock(time = {}) {
  const date = time.month && time.day && time.year ? `${time.month}/${time.day}/${time.year}` : '';
  const clock = time.hour !== undefined ? `${String(time.hour).padStart(2, '0')}:${String(time.minute || 0).padStart(2, '0')} ${time.period || ''}`.trim() : '';
  return [time.dayOfWeek, date, clock, time.era].filter(Boolean).join(' ');
}

function formatHistoryHtml(points) {
  return [
    '📜 <b>Rewind History</b>',
    '',
    ...points.map((point, index) => `${index + 1}. ${escapeHtml(point.label || point.action || point.kind || 'Saved point')}`)
  ].join('\n');
}

function formatRewindResult(result) {
  return [
    statusHtml('↩️', 'Went back before', result.snapshot?.action || result.snapshot?.kind || 'the previous turn'),
    formatNarrationCard(getLatestNarration(result.session), 'Restored Scene')
  ].join('\n\n');
}

function statusHtml(icon, title, body = '') {
  return [
    `${icon} <b>${escapeHtml(title)}</b>`,
    body ? escapeHtml(body) : ''
  ].filter(Boolean).join('\n');
}

function errorHtml(title, body = '') {
  return statusHtml('⚠️', title, body || 'Something went wrong.');
}

function noActiveGameHtml() {
  return statusHtml('🧭', 'No active game', 'Use /load or /new first.');
}

function cleanNarration(text) {
  return String(text || '')
    .replace(/!\[[^\]]*]\([^)]*\)/g, '')
    .replace(/\[([^\]]+)]\(([^)]+)\)/g, '$1')
    .replace(/```[\s\S]*?```/g, block => block.replace(/```[a-zA-Z]*|```/g, ''))
    .replace(/`([^`]+)`/g, '$1')
    .replace(/\r\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim() || 'No narration returned.';
}

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function parseWebAppAction(data) {
  const text = String(data || '').trim();
  if (!text) return '';
  try {
    const parsed = JSON.parse(text);
    return String(parsed.action || parsed.prompt || parsed.text || '').trim();
  } catch {
    return text;
  }
}

function worldEmoji(name) {
  const text = String(name || '').toLowerCase();
  if (text.includes('harry')) return '🪄';
  if (text.includes('star wars')) return '🚀';
  if (text.includes('narnia')) return '🦁';
  if (text.includes('rings')) return '🧝';
  if (text.includes('ice and fire')) return '🐉';
  return '🌌';
}

function splitTelegramText(text) {
  const max = 3900;
  const raw = String(text || '');
  if (raw.length <= max) return [raw];
  const chunks = [];
  let rest = raw;
  while (rest.length > max) {
    let cut = rest.lastIndexOf('\n\n', max);
    if (cut < 500) cut = rest.lastIndexOf('\n', max);
    if (cut < 500) cut = max;
    chunks.push(rest.slice(0, cut));
    rest = rest.slice(cut).trimStart();
  }
  if (rest) chunks.push(rest);
  return chunks;
}

function parseDate(value) {
  const text = String(value || '').trim();
  const match = text.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  if (!match) return todayDate();
  return { year: Number(match[1]), month: Number(match[2]), day: Number(match[3]), calendarType: 'gregorian' };
}

function todayDate() {
  const now = new Date();
  return { year: now.getFullYear(), month: now.getMonth() + 1, day: now.getDate(), calendarType: 'gregorian' };
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}
