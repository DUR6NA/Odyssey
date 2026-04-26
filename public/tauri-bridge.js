// Tauri Bridge - Uses window.__TAURI__ injected by withGlobalTauri: true
// No dynamic imports needed — APIs are available synchronously on page load.

// Normalize any error to a string. Tauri invoke errors are often plain strings,
// not Error objects, so e.message would be undefined without this.
function errMsg(e) {
  if (typeof e === 'string') return e;
  if (e instanceof Error) return e.message;
  try { return JSON.stringify(e); } catch (_) { return String(e); }
}

(function () {
  if (!window.__TAURI__) {
    console.log('Not in Tauri - bridge disabled');
    window.tauriBridgeReady = Promise.resolve();
    return;
  }

  // Log what Tauri exposed so we can diagnose missing modules
  console.log('window.__TAURI__ keys:', Object.keys(window.__TAURI__));

  const fs     = window.__TAURI__.fs;
  const path   = window.__TAURI__.path;
  const dialog = window.__TAURI__.dialog;

  if (!fs || !path) {
    console.error(
      'Tauri fs or path module missing from window.__TAURI__.',
      'Available keys:', Object.keys(window.__TAURI__)
    );
    window.tauriBridgeReady = Promise.resolve();
    return;
  }

  let baseDir = null;

  async function getBaseDir() {
    if (!baseDir) {
      const appDir = await path.appDataDir();
      baseDir = await path.join(appDir, 'odyssey');
      if (!(await fs.exists(baseDir))) {
        await fs.mkdir(baseDir, { recursive: true });
      }
    }
    return baseDir;
  }

  async function ensureDir(p) {
    if (!(await fs.exists(p))) {
      await fs.mkdir(p, { recursive: true });
    }
  }

  function sanitizeGameFolderName(name) {
    const cleaned = String(name || '')
      .replace(/[_]+/g, ' ')
      .replace(/[<>:"/\\|?*\x00-\x1F]/g, '')
      .replace(/\s+/g, ' ')
      .trim()
      .replace(/^[.\-\s]+|[.\-\s]+$/g, '')
      .slice(0, 48)
      .trim();

    const reservedWindowsNames = /^(con|prn|aux|nul|com[1-9]|lpt[1-9])$/i;
    if (!cleaned || reservedWindowsNames.test(cleaned)) return null;
    return cleaned;
  }

  function sanitizeVectorStoreName(name) {
    return String(name || 'default')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '') || 'default';
  }

  async function getUniqueGameFolderName(gamesDir, requestedName) {
    const baseName = sanitizeGameFolderName(requestedName);
    if (baseName) {
      let candidate = baseName;
      let suffix = 2;
      while (await fs.exists(await path.join(gamesDir, candidate))) {
        candidate = `${baseName} ${suffix}`;
        suffix++;
      }
      return candidate;
    }

    let i = 1;
    while (await fs.exists(await path.join(gamesDir, String(i)))) {
      i++;
    }
    return String(i);
  }

  window.tauriBridge = {
    async listPresets() {
      try {
        const base = await getBaseDir();
        const presetsDir = await path.join(base, 'presets');
        await ensureDir(presetsDir);
        const entries = await fs.readDir(presetsDir);
        const presets = [];
        for (const entry of entries) {
          if (entry.isFile && entry.name.endsWith('.json')) {
            try {
              const content = await fs.readTextFile(await path.join(presetsDir, entry.name));
              presets.push(JSON.parse(content));
            } catch (e) { console.warn('Failed to parse preset:', entry.name, e); }
          }
        }
        return presets;
      } catch (e) { console.error('listPresets error:', e); return []; }
    },

    async savePreset(data) {
      try {
        const base = await getBaseDir();
        const presetsDir = await path.join(base, 'presets');
        await ensureDir(presetsDir);
        const safeName = (data.presetName || 'unnamed').replace(/[^a-z0-9]/gi, '_').toLowerCase();
        const filePath = await path.join(presetsDir, `${safeName}.json`);
        await fs.writeTextFile(filePath, JSON.stringify(data, null, 2));
        return { success: true, preset: safeName };
      } catch (e) {
        console.error('savePreset error:', e);
        return { success: false, error: errMsg(e) };
      }
    },

    async deletePreset(name) {
      try {
        const base = await getBaseDir();
        const presetsDir = await path.join(base, 'presets');
        const safeName = name.replace(/[^a-z0-9]/gi, '_').toLowerCase();
        const filePath = await path.join(presetsDir, `${safeName}.json`);
        if (await fs.exists(filePath)) {
          await fs.remove(filePath);
          return { success: true };
        }
        return { success: false, error: 'Not found' };
      } catch (e) {
        console.error('deletePreset error:', e);
        return { success: false, error: errMsg(e) };
      }
    },

    async listGames() {
      try {
        const base = await getBaseDir();
        const gamesDir = await path.join(base, 'games');
        await ensureDir(gamesDir);
        const entries = await fs.readDir(gamesDir);
        return entries.filter(e => e.isDirectory).map(e => e.name);
      } catch (e) { console.error('listGames error:', e); return []; }
    },

    async loadGame(id) {
      try {
        const base = await getBaseDir();
        const gameDir = await path.join(base, 'games', String(id));
        if (!(await fs.exists(gameDir))) return {};
        const files = await fs.readDir(gameDir);
        const result = {};
        for (const file of files) {
          if (file.isFile && file.name.endsWith('.json')) {
            try {
              const content = await fs.readTextFile(await path.join(gameDir, file.name));
              result[file.name] = JSON.parse(content);
            } catch (e) { console.warn('Failed to read game file:', file.name, e); }
          }
        }
        return result;
      } catch (e) { console.error('loadGame error:', e); return {}; }
    },

    async loadVectorStore(id) {
      try {
        const base = await getBaseDir();
        const filePath = await path.join(base, 'games', String(id), 'vector_store.json');
        if (!(await fs.exists(filePath))) return null;
        return JSON.parse(await fs.readTextFile(filePath));
      } catch (e) {
        console.error('loadVectorStore error:', e);
        return null;
      }
    },

    async saveVectorStore(id, store) {
      try {
        const base = await getBaseDir();
        const gameDir = await path.join(base, 'games', String(id));
        await ensureDir(gameDir);
        await fs.writeTextFile(await path.join(gameDir, 'vector_store.json'), JSON.stringify(store || {}, null, 2));
        return { success: true };
      } catch (e) {
        console.error('saveVectorStore error:', e);
        return { success: false, error: errMsg(e) };
      }
    },

    async loadUniverseVectorStore(key) {
      try {
        const safeKey = sanitizeVectorStoreName(key);
        const base = await getBaseDir();
        const dir = await path.join(base, 'vector-stores', 'universes');
        const filePath = await path.join(dir, `${safeKey}.json`);
        if (!(await fs.exists(filePath))) return null;
        return JSON.parse(await fs.readTextFile(filePath));
      } catch (e) {
        console.error('loadUniverseVectorStore error:', e);
        return null;
      }
    },

    async saveUniverseVectorStore(key, store) {
      try {
        const safeKey = sanitizeVectorStoreName(key);
        const base = await getBaseDir();
        const dir = await path.join(base, 'vector-stores', 'universes');
        await ensureDir(dir);
        await fs.writeTextFile(await path.join(dir, `${safeKey}.json`), JSON.stringify(store || {}, null, 2));
        return { success: true };
      } catch (e) {
        console.error('saveUniverseVectorStore error:', e);
        return { success: false, error: errMsg(e) };
      }
    },

    async saveNewGame(data) {
      try {
        const base = await getBaseDir();
        const gamesDir = await path.join(base, 'games');
        await ensureDir(gamesDir);
        const folderName = await getUniqueGameFolderName(gamesDir, data.saveName || data.gameName || '');
        const newGameDir = await path.join(gamesDir, folderName);
        await fs.mkdir(newGameDir);
        if (data.worldInfo)  await fs.writeTextFile(await path.join(newGameDir, 'worldinfo.json'),       JSON.stringify(data.worldInfo, null, 2));
        if (data.playerInfo) await fs.writeTextFile(await path.join(newGameDir, 'player.json'),          JSON.stringify(data.playerInfo, null, 2));
        if (data.gameState)  await fs.writeTextFile(await path.join(newGameDir, 'gamestate.json'),       JSON.stringify(data.gameState, null, 2));
        const scenario = { startingScenario: data.startingScenario || '', summary: data.summary || '', saveName: folderName };
        await fs.writeTextFile(await path.join(newGameDir, 'scenario.json'),        JSON.stringify(scenario, null, 2));
        await fs.writeTextFile(await path.join(newGameDir, 'locationsledger.json'), JSON.stringify({ locations: [] }, null, 2));
        await fs.writeTextFile(await path.join(newGameDir, 'npc-ledger.json'),      JSON.stringify({ npcs: [] }, null, 2));
        await fs.writeTextFile(await path.join(newGameDir, 'mainoutput.json'),      JSON.stringify({ time: {}, textoutput: '', inventory_changes: [], location_changes: [], npc_changes: [], stats: {} }, null, 2));
        await fs.writeTextFile(await path.join(newGameDir, 'chat_history.json'),    JSON.stringify([], null, 2));
        return { success: true, folder: folderName };
      } catch (e) {
        console.error('saveNewGame error:', e);
        return { success: false, error: errMsg(e) };
      }
    },

    async deleteGame(id) {
      try {
        const base = await getBaseDir();
        const gameDir = await path.join(base, 'games', String(id));
        if (await fs.exists(gameDir)) {
          await fs.remove(gameDir, { recursive: true });
          return { success: true };
        }
        return { success: false, error: 'Not found' };
      } catch (e) {
        console.error('deleteGame error:', e);
        return { success: false, error: errMsg(e) };
      }
    },

    async updateGame(data) {
      try {
        const base = await getBaseDir();
        const gameDir = await path.join(base, 'games', String(data.id));
        await ensureDir(gameDir);
        if (data.gameState)   await fs.writeTextFile(await path.join(gameDir, 'gamestate.json'),    JSON.stringify(data.gameState, null, 2));
        if (data.chatHistory) await fs.writeTextFile(await path.join(gameDir, 'chat_history.json'), JSON.stringify(data.chatHistory, null, 2));
        if (data.summary !== undefined) {
          const scenarioPath = await path.join(gameDir, 'scenario.json');
          let scenario = {};
          try { scenario = JSON.parse(await fs.readTextFile(scenarioPath)); } catch (e) {}
          scenario.summary = data.summary;
          await fs.writeTextFile(scenarioPath, JSON.stringify(scenario, null, 2));
        }
        if (data.npcLedger)       await fs.writeTextFile(await path.join(gameDir, 'npc-ledger.json'),      JSON.stringify(data.npcLedger, null, 2));
        if (data.locationsLedger) await fs.writeTextFile(await path.join(gameDir, 'locationsledger.json'), JSON.stringify(data.locationsLedger, null, 2));
        return { success: true };
      } catch (e) {
        console.error('updateGame error:', e);
        return { success: false, error: errMsg(e) };
      }
    },

    async downloadImage(id, url) {
      try {
        const response = await fetch(url);
        const blob = await response.blob();
        const dataUri = await new Promise((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve(reader.result);
          reader.onerror = reject;
          reader.readAsDataURL(blob);
        });
        const base = await getBaseDir();
        const gameDir = await path.join(base, 'games', String(id));
        await ensureDir(gameDir);
        await fs.writeTextFile(await path.join(gameDir, 'base_image.json'), JSON.stringify({ dataUri }));
        return { success: true };
      } catch (e) {
        console.error('downloadImage error:', e);
        return { success: false, error: errMsg(e) };
      }
    },

    async getBaseImage(id) {
      try {
        const base = await getBaseDir();
        const filePath = await path.join(base, 'games', String(id), 'base_image.json');
        if (!(await fs.exists(filePath))) return { dataUri: null };
        const content = JSON.parse(await fs.readTextFile(filePath));
        return { dataUri: content.dataUri || null };
      } catch (e) { console.error('getBaseImage error:', e); return { dataUri: null }; }
    },

    async updateImage(id, url) {
      try {
        const base = await getBaseDir();
        const gameDir = await path.join(base, 'games', String(id));
        await ensureDir(gameDir);
        await fs.writeTextFile(await path.join(gameDir, 'current_image.json'), JSON.stringify({ url }));
        return { success: true };
      } catch (e) {
        console.error('updateImage error:', e);
        return { success: false, error: errMsg(e) };
      }
    },

    async exportGame(id) {
      const data = await this.loadGame(id);
      if (!data || Object.keys(data).length === 0) return { success: false, error: 'No game data found' };
      try {
        if (!dialog) throw new Error('Dialog plugin not available');
        const savePath = await dialog.save({
          title: 'Export Odyssey Save',
          defaultPath: `odyssey_save_${id}.json`,
          filters: [{ name: 'JSON', extensions: ['json'] }]
        });
        if (savePath) {
          await fs.writeTextFile(savePath, JSON.stringify({ ...data, _backupVersion: 1, id: String(id) }, null, 2));
          return { success: true };
        }
        return { success: false, error: 'Cancelled' };
      } catch (e) {
        console.error('exportGame error:', e);
        return { success: false, error: errMsg(e) };
      }
    },

    // importGameData: caller reads the file via browser FileReader, passes parsed JSON here.
    async importGameData(importData) {
      try {
        const base = await getBaseDir();
        const gamesDir = await path.join(base, 'games');
        await ensureDir(gamesDir);
        const importedName = importData?.['scenario.json']?.saveName || importData?.id || '';
        const folderName = await getUniqueGameFolderName(gamesDir, importedName);
        const newGameDir = await path.join(gamesDir, folderName);
        await fs.mkdir(newGameDir);
        const skipKeys = new Set(['_backupVersion', 'id']);
        for (const [filename, fileData] of Object.entries(importData)) {
          if (skipKeys.has(filename) || !filename.endsWith('.json')) continue;
          const outputData = filename === 'scenario.json' ? { ...fileData, saveName: folderName } : fileData;
          await fs.writeTextFile(await path.join(newGameDir, filename), JSON.stringify(outputData, null, 2));
        }
        return { success: true, folder: folderName };
      } catch (e) {
        console.error('importGameData error:', e);
        return { success: false, error: errMsg(e) };
      }
    }
  };

  // Synchronous init — resolve immediately.
  window.tauriBridgeReady = Promise.resolve(window.tauriBridge);
  console.log('✅ Tauri Bridge ready - window.tauriBridge available');
}());
