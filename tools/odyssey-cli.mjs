#!/usr/bin/env node
import readline from 'node:readline';
import { stdin as input, stdout as output } from 'node:process';
import {
  WORLD_PRESETS,
  buildFallbackSaveName,
  buildGameStateJson,
  buildPlayerJson,
  buildStatsText,
  buildWorldJson,
  canUseAi,
  createNewGame,
  generateGameSaveName,
  generateGameSummary,
  getLatestNarration,
  getOdysseyBaseDir,
  listGames,
  listPresets,
  listRewindPoints,
  loadGameSession,
  loadSettings,
  editLastTurn,
  rewindLastTurn,
  runGameTurn,
  runOpeningTurn,
  saveSettings,
  stripMarkdownForPlainText,
  wrapText
} from './odyssey-core.mjs';

const WIDTH = Math.max(72, Math.min(process.stdout.columns || 96, 112));

readline.emitKeypressEvents(input);

let cachedSettings = await loadSettings();

function asciiTitle() {
  return [
    '  ___      _',
    ' / _ \\  __| |_   _ ___ ___  ___ _   _',
    '| | | |/ _` | | | / __/ __|/ _ \\ | | |',
    '| |_| | (_| | |_| \\__ \\__ \\  __/ |_| |',
    ' \\___/ \\__,_|\\__, |___/___/\\___|\\__, |',
    '             |___/              |___/',
    ''
  ].join('\n');
}

function clearScreen() {
  output.write('\x1b[2J\x1b[H');
}

function divider() {
  return '-'.repeat(Math.min(WIDTH, 96));
}

function printHeader(subtitle = '') {
  clearScreen();
  console.log(asciiTitle());
  if (subtitle) console.log(wrapText(subtitle, WIDTH));
  console.log(divider());
}

function printBox(title, body) {
  console.log(`\n${title}`);
  console.log(divider());
  console.log(wrapText(stripMarkdownForPlainText(body), WIDTH));
  console.log(divider());
}

async function pause(label = 'Press Enter to continue...') {
  await ask(label);
}

function withRawMode(enabled) {
  if (input.isTTY) input.setRawMode(Boolean(enabled));
}

async function ask(question, defaultValue = '') {
  withRawMode(false);
  const rl = readline.createInterface({ input, output });
  const suffix = defaultValue ? ` [${defaultValue}]` : '';
  const answer = await new Promise(resolve => rl.question(`${question}${suffix}: `, resolve));
  rl.close();
  return answer.trim() || defaultValue;
}

async function askHidden(question, defaultValue = '') {
  withRawMode(false);
  const rl = readline.createInterface({ input, output });
  const stdin = process.stdin;
  const onData = char => {
    char = String(char);
    switch (char) {
      case '\n':
      case '\r':
      case '\u0004':
        stdin.pause();
        break;
      default:
        output.write('\x1b[2K\x1b[200D');
        output.write(`${question}${defaultValue ? ' [saved]' : ''}: ${'*'.repeat(rl.line.length)}`);
        break;
    }
  };
  stdin.on('data', onData);
  const answer = await new Promise(resolve => rl.question(`${question}${defaultValue ? ' [saved]' : ''}: `, resolve));
  stdin.off('data', onData);
  rl.close();
  console.log('');
  return answer.trim() || defaultValue;
}

async function confirm(question, defaultYes = true) {
  const answer = (await ask(`${question} ${defaultYes ? '[Y/n]' : '[y/N]'}`)).toLowerCase();
  if (!answer) return defaultYes;
  return answer === 'y' || answer === 'yes';
}

async function selectMenu(title, items, options = {}) {
  const enabledItems = items.filter(item => !item.hidden);
  if (!enabledItems.length) return null;

  if (!input.isTTY) {
    printHeader(title);
    enabledItems.forEach((item, index) => console.log(`${index + 1}. ${item.label}${item.disabled ? ' (disabled)' : ''}`));
    const answer = Number(await ask('Choose'));
    const item = enabledItems[answer - 1];
    return item && !item.disabled
      ? (Object.prototype.hasOwnProperty.call(item, 'value') ? item.value : item)
      : null;
  }

  let index = Math.max(0, enabledItems.findIndex(item => !item.disabled));
  if (index < 0) index = 0;

  return new Promise(resolve => {
    const render = () => {
      printHeader(title);
      if (options.subtitle) {
        console.log(wrapText(options.subtitle, WIDTH));
        console.log('');
      }
      enabledItems.forEach((item, itemIndex) => {
        const pointer = itemIndex === index ? '>' : ' ';
        const disabled = item.disabled ? ' [unavailable]' : '';
        console.log(`${pointer} ${item.label}${disabled}`);
        if (item.description) {
          const description = wrapText(item.description, WIDTH - 4).split('\n').map(line => `    ${line}`).join('\n');
          console.log(description);
        }
      });
      console.log('');
      console.log('Use Up/Down, Enter to select, q/Esc to go back, Ctrl+C to quit.');
    };

    const move = direction => {
      if (enabledItems.every(item => item.disabled)) return;
      let next = index;
      do {
        next = (next + direction + enabledItems.length) % enabledItems.length;
      } while (enabledItems[next].disabled);
      index = next;
      render();
    };

    const cleanup = () => {
      input.off('keypress', onKeypress);
      withRawMode(false);
    };

    const onKeypress = (_str, key = {}) => {
      if (key.ctrl && key.name === 'c') {
        cleanup();
        console.log('\nGoodbye.');
        process.exit(0);
      }
      if (key.name === 'up' || key.name === 'k') move(-1);
      else if (key.name === 'down' || key.name === 'j') move(1);
      else if (key.name === 'return') {
        if (enabledItems[index].disabled) return;
        const selected = enabledItems[index];
        cleanup();
        resolve(Object.prototype.hasOwnProperty.call(selected, 'value') ? selected.value : selected);
      } else if (key.name === 'escape' || key.name === 'q') {
        cleanup();
        resolve(null);
      }
    };

    withRawMode(true);
    input.resume();
    input.on('keypress', onKeypress);
    render();
  });
}

async function main() {
  while (true) {
    cachedSettings = await loadSettings();
    const games = await listGames();
    const lastGame = cachedSettings.lastGameId && games.find(game => game.id === cachedSettings.lastGameId);
    const selected = await selectMenu('Main Menu', [
      {
        label: lastGame ? `Continue: ${lastGame.saveName}` : 'Continue',
        description: lastGame ? summarizeGame(lastGame) : 'Load a save first.',
        value: 'continue',
        disabled: !lastGame
      },
      { label: 'Load Game', description: 'Arrow-key save picker backed by the desktop Odyssey save folder.', value: 'load' },
      { label: 'New Game', description: 'Create a text-only Odyssey campaign. No images, only ASCII and prose.', value: 'new' },
      { label: 'Settings', description: 'Configure provider, model, API key, and endpoint for CLI and Telegram.', value: 'settings' },
      { label: 'Data Folder', description: getOdysseyBaseDir(), value: 'folder' },
      { label: 'Exit', value: 'exit' }
    ], {
      subtitle: 'Terminal Odyssey uses the same save folders as the desktop app and keeps all art/image features off.'
    });

    if (selected === 'continue') await gameLoop(cachedSettings.lastGameId);
    else if (selected === 'load') await loadGameFlow();
    else if (selected === 'new') await newGameFlow();
    else if (selected === 'settings') await settingsFlow();
    else if (selected === 'folder') {
      printHeader('Data Folder');
      console.log(getOdysseyBaseDir());
      await pause();
    } else if (selected === 'exit' || selected === null) {
      printHeader('Exit');
      console.log('Odyssey waits where you left it.');
      return;
    }
  }
}

function summarizeGame(game) {
  const bits = [];
  if (game.playerName) bits.push(`Player: ${game.playerName}`);
  if (game.time?.day || game.time?.year) bits.push(`Time: ${formatTime(game.time)}`);
  if (game.summary) bits.push(game.summary.slice(0, 120));
  return bits.filter(Boolean).join(' | ');
}

function formatTime(time = {}) {
  const date = time.month && time.day && time.year ? `${time.month}/${time.day}/${time.year}` : '';
  const clock = time.hour !== undefined ? `${String(time.hour).padStart(2, '0')}:${String(time.minute || 0).padStart(2, '0')} ${time.period || ''}`.trim() : '';
  return [time.dayOfWeek, date, clock].filter(Boolean).join(' ');
}

async function loadGameFlow() {
  const games = await listGames();
  if (!games.length) {
    printHeader('Load Game');
    console.log('No saves found yet.');
    await pause();
    return;
  }

  const selected = await selectMenu('Load Game', games.map(game => ({
    label: game.saveName,
    description: summarizeGame(game),
    value: game.id
  })).concat([{ label: 'Back', value: null }]));

  if (!selected) return;
  await setLastGame(selected);
  await gameLoop(selected);
}

async function setLastGame(id) {
  cachedSettings = await loadSettings();
  await saveSettings({ ...cachedSettings, lastGameId: id });
  cachedSettings.lastGameId = id;
}

async function settingsFlow() {
  cachedSettings = await loadSettings();
  const provider = await selectMenu('AI Provider', [
    { label: 'OpenRouter', description: 'Cloud router. Needs API key and model id.', value: 'openrouter' },
    { label: 'OpenAI-compatible', description: 'Custom OpenAI-compatible URL such as Ollama, LiteLLM, or a local proxy.', value: 'openai' },
    { label: 'LM Studio', description: 'Local LM Studio OpenAI-compatible endpoint.', value: 'lmstudio' },
    { label: 'xAI', description: 'Grok chat completions endpoint.', value: 'xai' },
    { label: 'Google AI compatibility', description: 'Gemini through Google OpenAI-compatible endpoint.', value: 'googleai' },
    { label: 'Back', value: null }
  ], { subtitle: `Current: ${cachedSettings.provider}` });

  if (!provider) return;

  const next = { ...cachedSettings, provider };
  if (provider === 'lmstudio') {
    next.baseUrl = await ask('Base URL', next.baseUrl || 'http://localhost:1234/v1');
    next.apiKey = await askHidden('API key (optional for local LM Studio)', next.apiKey);
  } else if (provider === 'openai') {
    next.baseUrl = await ask('Base URL', next.baseUrl || 'http://localhost:11434/v1');
    next.apiKey = await askHidden('API key (optional for some local servers)', next.apiKey);
  } else {
    next.baseUrl = provider === 'openrouter' ? '' : next.baseUrl;
    next.apiKey = await askHidden('API key', next.apiKey);
  }

  next.model = await ask('Model id', next.model);
  next.temperature = Number(await ask('Temperature', String(next.temperature)));
  next.maxTokens = Number(await ask('Max tokens', String(next.maxTokens)));
  next.topP = Number(await ask('Top P', String(next.topP)));
  next.presencePenalty = Number(await ask('Presence penalty', String(next.presencePenalty)));
  next.frequencyPenalty = Number(await ask('Frequency penalty', String(next.frequencyPenalty)));
  if (provider === 'openrouter') {
    next.enableReasoning = await confirm('Enable OpenRouter reasoning payload?', Boolean(next.enableReasoning));
    next.reasoningEffort = await ask('Reasoning effort (none/minimal/low/medium/high/xhigh)', next.reasoningEffort || 'low');
  }

  await saveSettings(next);
  cachedSettings = next;
  printHeader('Settings Saved');
  console.log('CLI and Telegram will use these settings unless ODYSSEY_* environment variables override them.');
  await pause();
}

async function newGameFlow() {
  cachedSettings = await loadSettings();
  const worldAnswers = await collectWorldAnswers();
  if (!worldAnswers) return;
  const playerAnswers = await collectPlayerAnswers();
  if (!playerAnswers) return;

  printHeader('Starting Scenario');
  const startingScenario = await askLong('Describe the opening situation');
  if (!startingScenario.trim()) return;

  const worldInfo = buildWorldJson(worldAnswers);
  const playerInfo = buildPlayerJson(playerAnswers);
  const gameState = buildGameStateJson(worldAnswers, playerInfo);
  const allData = { worldInfo, playerInfo, gameState, startingScenario };

  let summary = startingScenario;
  let saveName = buildFallbackSaveName(allData);
  if (canUseAi(cachedSettings) && await confirm('Generate campaign summary and save name with the model?', true)) {
    printHeader('Generating');
    console.log('Creating summary...');
    summary = await generateGameSummary(cachedSettings, allData).catch(err => {
      console.log(`Summary failed: ${err.message}`);
      return startingScenario;
    });
    console.log('Naming save...');
    saveName = await generateGameSaveName(cachedSettings, summary, { ...allData, summary });
  } else {
    saveName = await ask('Save name', saveName);
  }

  const result = await createNewGame({ worldInfo, playerInfo, gameState, startingScenario, summary, saveName });
  await setLastGame(result.folder);

  printHeader('Game Created');
  console.log(`Created save: ${result.folder}`);

  if (canUseAi(cachedSettings) && await confirm('Generate the opening turn now?', true)) {
    console.log('The model is opening the scene...');
    const opening = await runOpeningTurn(result.folder, cachedSettings);
    printBox('Opening Scene', opening.text);
    await pause();
    await gameLoop(result.folder);
  } else {
    console.log('Saved without an AI opening turn.');
    await pause();
  }
}

async function askLong(question) {
  console.log(`${question}. End with a blank line.`);
  const lines = [];
  while (true) {
    const line = await ask(lines.length ? '...' : '>');
    if (!line) break;
    lines.push(line);
  }
  return lines.join('\n');
}

async function collectWorldAnswers() {
  const worldChoice = await selectMenu('Choose World', [
    { label: 'Real World', description: 'Grounded real-world campaign.', value: 'real' },
    { label: 'Custom World', description: 'Write a new universe from scratch.', value: 'custom' },
    ...Object.keys(WORLD_PRESETS).map(name => ({
      label: name,
      description: WORLD_PRESETS[name].setting,
      value: `preset:${name}`
    })),
    { label: 'Back', value: null }
  ]);

  if (!worldChoice) return null;

  const now = new Date();
  const dateAnswer = await ask('Start date (YYYY-MM-DD)', `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`);
  const startDate = parseDate(dateAnswer);

  if (worldChoice === 'real') {
    return {
      type: 'real',
      name: 'Earth',
      startDate,
      tone: await ask('Tone / mood', 'grounded, intimate, and consequential'),
      setting: 'The real world as we know it.',
      era: 'Modern day',
      factions: []
    };
  }

  if (worldChoice.startsWith('preset:')) {
    const presetName = worldChoice.slice('preset:'.length);
    const preset = WORLD_PRESETS[presetName];
    return {
      type: 'custom',
      preset: presetName,
      startDate,
      ...preset,
      tone: await ask('Tone / mood', preset.tone)
    };
  }

  const factions = await ask('Major factions (comma-separated)', '');
  return {
    type: 'custom',
    startDate,
    name: await ask('World name', 'Unknown'),
    era: await ask('Era / time period', ''),
    setting: await askLong('Describe the world setting'),
    tone: await ask('Tone / mood', ''),
    magicOrTech: await askLong('Describe magic, technology, or special systems'),
    rules: await askLong('Describe special world rules or laws'),
    dangers: await askLong('Describe major dangers'),
    factions: factions.split(',').map(part => part.trim()).filter(Boolean)
  };
}

function parseDate(value) {
  const text = String(value || '').trim();
  const iso = text.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  const us = text.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  const match = iso || us;
  if (!match) {
    const now = new Date();
    return { day: now.getDate(), month: now.getMonth() + 1, year: now.getFullYear(), calendarType: 'gregorian' };
  }
  if (iso) return { year: Number(match[1]), month: Number(match[2]), day: Number(match[3]), calendarType: 'gregorian' };
  return { month: Number(match[1]), day: Number(match[2]), year: Number(match[3]), calendarType: 'gregorian' };
}

async function collectPlayerAnswers() {
  const presets = await listPresets();
  const presetChoice = await selectMenu('Player', [
    { label: 'Create New Character', value: null },
    ...presets.map((preset, index) => ({
      label: preset.presetName || preset.name || `Preset ${index + 1}`,
      description: preset.name ? `${preset.name} ${preset.backstory ? '- ' + preset.backstory.slice(0, 100) : ''}` : '',
      value: index
    }))
  ], { subtitle: 'Use a saved desktop preset or write a new character.' });

  const defaults = typeof presetChoice === 'number' ? { ...presets[presetChoice] } : {};
  if (typeof presetChoice === 'number') {
    printHeader('Review Preset');
    console.log(wrapText(`Loaded preset "${defaults.presetName || defaults.name || 'Character'}". Each normal setup question is pre-filled; press Enter to keep a value or type a replacement.`, WIDTH));
    await pause();
  }

  if (typeof presetChoice === 'number') {
    const genderChoice = await selectMenu('Gender', [
      { label: `Keep: ${defaults.gender || 'Other'}`, value: defaults.gender || 'Other' },
      { label: 'Male', value: 'Male' },
      { label: 'Female', value: 'Female' },
      { label: 'Other', value: 'Other' }
    ]);

    return {
      presetName: defaults.presetName || '',
      name: await ask('Name', defaults.name || 'Unknown'),
      age: await ask('Age', String(defaults.age || '25')),
      gender: genderChoice || defaults.gender || 'Other',
      height: await ask('Height', defaults.height || ''),
      weight: await ask('Weight', defaults.weight || ''),
      athleticism: await ask('Athleticism', defaults.athleticism || 'average'),
      intelligence: await ask('Intelligence', defaults.intelligence || 'average'),
      appearance: await askLongWithDefault('Describe appearance', defaults.appearance || ''),
      personality: await askLongWithDefault('Describe personality', defaults.personality || ''),
      backstory: await askLongWithDefault('Describe backstory', defaults.backstory || ''),
      family: parseList(await ask('Family (comma-separated)', formatList(defaults.family))),
      friends: parseList(await ask('Friends (comma-separated)', formatList(defaults.friends))),
      inventory: parseList(await ask('Inventory (comma-separated)', formatList(defaults.inventory)))
    };
  }

  const gender = await selectMenu('Gender', [
    { label: 'Male', value: 'Male' },
    { label: 'Female', value: 'Female' },
    { label: 'Other', value: 'Other' }
  ]);

  return {
    name: await ask('Name', 'Unknown'),
    age: await ask('Age', '25'),
    gender: gender || 'Other',
    height: await ask('Height', ''),
    weight: await ask('Weight', ''),
    athleticism: await ask('Athleticism', 'average'),
    intelligence: await ask('Intelligence', 'average'),
    appearance: await askLong('Describe appearance'),
    personality: await askLong('Describe personality'),
    backstory: await askLong('Describe backstory'),
    family: parseList(await ask('Family (comma-separated)', '')),
    friends: parseList(await ask('Friends (comma-separated)', '')),
    inventory: parseList(await ask('Inventory (comma-separated)', ''))
  };
}

async function askLongWithDefault(question, defaultValue = '') {
  if (!defaultValue) return askLong(question);
  console.log(`${question}. Press Enter on the first line to keep the preset value, or type a replacement. End replacements with a blank line.`);
  console.log(divider());
  console.log(wrapText(defaultValue, WIDTH));
  console.log(divider());
  const firstLine = await ask('>');
  if (!firstLine) return defaultValue;
  const lines = [firstLine];
  while (true) {
    const line = await ask('...');
    if (!line) break;
    lines.push(line);
  }
  return lines.join('\n');
}

function formatList(value) {
  if (!value) return '';
  if (Array.isArray(value)) {
    return value.map(item => typeof item === 'string' ? item : item?.name || '').filter(Boolean).join(', ');
  }
  return String(value);
}

function parseList(value) {
  if (Array.isArray(value)) return value;
  return String(value || '').split(',').map(part => part.trim()).filter(Boolean);
}

async function gameLoop(gameId) {
  while (true) {
    const session = await loadGameSession(gameId);
    printHeader(session.files?.['scenario.json']?.saveName || gameId);
    console.log(wrapText(stripMarkdownForPlainText(getLatestNarration(session)), WIDTH));
    console.log('');
    console.log(divider());
    console.log('Type an action, or use /menu, /player, /codex, /stats, /back, /edit, /load, /quit.');

    const action = await ask('>');
    if (!action) continue;
    const command = action.toLowerCase();

    if (command === '/quit' || command === '/exit') return;
    if (command === '/load') {
      await loadGameFlow();
      return;
    }
    if (command === '/menu') {
      const shouldLeave = await inGameMenu(gameId);
      if (shouldLeave) return;
      continue;
    }
    if (command === '/player') {
      printBox('Player Menu', (await loadGameSession(gameId)).playerInfo ? await playerText(gameId) : '');
      await pause();
      continue;
    }
    if (command === '/codex') {
      printBox('Game Codex', await codexText(gameId));
      await pause();
      continue;
    }
    if (command === '/stats') {
      printBox('Stats', buildStatsText(await loadGameSession(gameId)));
      await pause();
      continue;
    }
    if (command === '/history') {
      await showRewindHistory(gameId);
      continue;
    }
    if (command === '/back' || command === '/undo') {
      await rewindFlow(gameId);
      continue;
    }
    if (command === '/edit') {
      await editLastTurnFlow(gameId);
      continue;
    }

    printHeader('Thinking');
    console.log('The model is resolving your turn...');
    try {
      const result = await runGameTurn(gameId, action, cachedSettings);
      printBox('Odyssey', result.text);
      await pause();
    } catch (err) {
      printHeader('Turn Failed');
      console.log(wrapText(err.message, WIDTH));
      await pause();
    }
  }
}

async function playerText(gameId) {
  const { buildPlayerText } = await import('./odyssey-core.mjs');
  return buildPlayerText(await loadGameSession(gameId));
}

async function codexText(gameId) {
  const { buildCodexText } = await import('./odyssey-core.mjs');
  return buildCodexText(await loadGameSession(gameId));
}

async function inGameMenu(gameId) {
  while (true) {
    const selected = await selectMenu('Game Menu', [
      { label: 'Continue Adventure', value: 'continue' },
      { label: 'Go Back One Turn', value: 'back' },
      { label: 'Edit Last Action', value: 'edit' },
      { label: 'Rewind History', value: 'history' },
      { label: 'Player Menu', value: 'player' },
      { label: 'Game Codex', value: 'codex' },
      { label: 'Stats', value: 'stats' },
      { label: 'Load Another Game', value: 'load' },
      { label: 'Main Menu', value: 'main' }
    ]);

    if (!selected || selected === 'continue') return false;
    if (selected === 'main') return true;
    if (selected === 'load') {
      await loadGameFlow();
      return true;
    }
    if (selected === 'back') {
      await rewindFlow(gameId);
      return false;
    }
    if (selected === 'edit') {
      await editLastTurnFlow(gameId);
      return false;
    }
    if (selected === 'history') {
      await showRewindHistory(gameId);
      return false;
    }
    if (selected === 'player') {
      printBox('Player Menu', await playerText(gameId));
      await pause();
    } else if (selected === 'codex') {
      printBox('Game Codex', await codexText(gameId));
      await pause();
    } else if (selected === 'stats') {
      printBox('Stats', buildStatsText(await loadGameSession(gameId)));
      await pause();
    }
  }
}

async function showRewindHistory(gameId) {
  const points = await listRewindPoints(gameId, 10);
  printHeader('Rewind History');
  if (!points.length) {
    console.log('No rewind snapshots yet. New turns will be rewindable from now on.');
  } else {
    points.forEach((point, index) => {
      console.log(`${index + 1}. ${point.label}`);
    });
  }
  await pause();
}

async function rewindFlow(gameId) {
  const points = await listRewindPoints(gameId, 1);
  if (!points.length) {
    printHeader('Go Back');
    console.log('No rewind snapshots yet. New turns will be rewindable from now on.');
    await pause();
    return;
  }

  if (!await confirm(`Go back before "${points[0].label}"?`, true)) return;
  const result = await rewindLastTurn(gameId);
  printHeader('Went Back');
  if (!result.success) {
    console.log(result.error);
  } else {
    console.log(`Restored before: ${result.snapshot.action || result.snapshot.kind}`);
    console.log('');
    console.log(wrapText(stripMarkdownForPlainText(getLatestNarration(result.session)), WIDTH));
  }
  await pause();
}

async function editLastTurnFlow(gameId) {
  const points = await listRewindPoints(gameId, 1);
  printHeader('Edit Last Action');
  if (!points.length) {
    console.log('No rewind snapshots yet. New turns will be editable from now on.');
    await pause();
    return;
  }

  console.log(wrapText(`Editing the last saved action: ${points[0].action || points[0].label}`, WIDTH));
  const replacement = await askLong('Write the replacement action');
  if (!replacement.trim()) return;

  printHeader('Regenerating');
  console.log('Restoring the earlier state and resolving the edited action...');
  const result = await editLastTurn(gameId, replacement, cachedSettings);
  if (!result.success) {
    printHeader('Edit Failed');
    console.log(wrapText(result.error || 'Edit failed.', WIDTH));
    await pause();
    return;
  }

  printBox('Edited Turn', result.text);
  await pause();
}

main().catch(async err => {
  withRawMode(false);
  console.error(err);
  process.exitCode = 1;
});
