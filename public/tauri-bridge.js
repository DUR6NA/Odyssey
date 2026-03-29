// Tauri Bridge for Classic Scripts - Replaces /api/ calls
// Exposes window.tauriBridge with the same functions as before

(async function() {
  if (typeof window === 'undefined' || !window.__TAURI__) {
    console.log('Not in Tauri - bridge disabled');
    return;
  }

  console.log('Initializing Tauri Bridge...');

  const { readDir, readTextFile, writeTextFile, remove, createDir, exists } = await import('@tauri-apps/plugin-fs');
  const { appDataDir, join } = await import('@tauri-apps/api/path');
  const { open } = await import('@tauri-apps/plugin-dialog');

  let baseDir = null;

  async function getBaseDir() {
    if (!baseDir) {
      const appDir = await appDataDir();
      baseDir = await join(appDir, 'odyssey');
      if (!(await exists(baseDir))) {
        await createDir(baseDir, { recursive: true });
      }
    }
    return baseDir;
  }

  async function ensureDir(path) {
    if (!(await exists(path))) {
      await createDir(path, { recursive: true });
    }
  }

  window.tauriBridge = {
    async listPresets() {
      try {
        const base = await getBaseDir();
        const presetsDir = await join(base, 'presets');
        await ensureDir(presetsDir);
        const entries = await readDir(presetsDir);
        const presets = [];
        for (const entry of entries) {
          if (entry.isFile && entry.name.endsWith('.json')) {
            try {
              const content = await readTextFile(await join(presetsDir, entry.name));
              presets.push(JSON.parse(content));
            } catch (e) {}
          }
        }
        return presets;
      } catch (e) { return []; }
    },

    async savePreset(data) {
      try {
        const base = await getBaseDir();
        const presetsDir = await join(base, 'presets');
        await ensureDir(presetsDir);
        const safeName = (data.presetName || 'unnamed').replace(/[^a-z0-9]/gi, '_').toLowerCase();
        const filePath = await join(presetsDir, `${safeName}.json`);
        await writeTextFile(filePath, JSON.stringify(data, null, 2));
        return { success: true, preset: safeName };
      } catch (e) {
        return { success: false, error: e.message };
      }
    },

    async deletePreset(name) {
      try {
        const base = await getBaseDir();
        const presetsDir = await join(base, 'presets');
        const safeName = name.replace(/[^a-z0-9]/gi, '_').toLowerCase();
        const filePath = await join(presetsDir, `${safeName}.json`);
        if (await exists(filePath)) {
          await remove(filePath);
          return { success: true };
        }
        return { success: false, error: 'Not found' };
      } catch (e) {
        return { success: false, error: e.message };
      }
    },

    async listGames() {
      try {
        const base = await getBaseDir();
        const gamesDir = await join(base, 'games');
        await ensureDir(gamesDir);
        const entries = await readDir(gamesDir);
        return entries.filter(e => e.isDir).map(e => e.name);
      } catch (e) { return []; }
    },

    async loadGame(id) {
      try {
        const base = await getBaseDir();
        const gameDir = await join(base, 'games', String(id));
        if (!(await exists(gameDir))) return {};
        const files = await readDir(gameDir);
        const result = {};
        for (const file of files) {
          if (file.isFile && file.name.endsWith('.json')) {
            const content = await readTextFile(await join(gameDir, file.name));
            result[file.name] = JSON.parse(content);
          }
        }
        return result;
      } catch (e) { return {}; }
    },

    async saveNewGame(data) {
      try {
        const base = await getBaseDir();
        const gamesDir = await join(base, 'games');
        await ensureDir(gamesDir);
        let i = 1;
        let newGameDir;
        while (true) {
          newGameDir = await join(gamesDir, String(i));
          if (!(await exists(newGameDir))) break;
          i++;
        }
        await createDir(newGameDir);
        if (data.worldInfo) await writeTextFile(await join(newGameDir, 'worldinfo.json'), JSON.stringify(data.worldInfo, null, 2));
        if (data.playerInfo) await writeTextFile(await join(newGameDir, 'player.json'), JSON.stringify(data.playerInfo, null, 2));
        if (data.gameState) await writeTextFile(await join(newGameDir, 'gamestate.json'), JSON.stringify(data.gameState, null, 2));
        const scenario = { startingScenario: data.startingScenario || '', summary: data.summary || '' };
        await writeTextFile(await join(newGameDir, 'scenario.json'), JSON.stringify(scenario, null, 2));
        await writeTextFile(await join(newGameDir, 'locationsledger.json'), JSON.stringify({ locations: [] }, null, 2));
        await writeTextFile(await join(newGameDir, 'npc-ledger.json'), JSON.stringify({ npcs: [] }, null, 2));
        await writeTextFile(await join(newGameDir, 'mainoutput.json'), JSON.stringify({ time: {}, textoutput: "", inventory_changes: [], location_changes: [], npc_changes: [], stats: {} }, null, 2));
        await writeTextFile(await join(newGameDir, 'chat_history.json'), JSON.stringify([], null, 2));
        return { success: true, folder: i };
      } catch (e) {
        return { success: false, error: e.message };
      }
    },

    async deleteGame(id) {
      try {
        const base = await getBaseDir();
        const gameDir = await join(base, 'games', String(id));
        if (await exists(gameDir)) {
          await remove(gameDir);
          return { success: true };
        }
        return { success: false, error: 'Not found' };
      } catch (e) {
        return { success: false, error: e.message };
      }
    },

    async exportGame(id) {
      const data = await this.loadGame(id);
      if (!data || Object.keys(data).length === 0) return { success: false };
      try {
        const savePath = await open({
          title: 'Export Odyssey Save',
          defaultPath: `odyssey_save_${id}.json`,
          filters: [{ name: 'JSON', extensions: ['json'] }]
        });
        if (savePath) {
          await writeTextFile(savePath, JSON.stringify({ ...data, _backupVersion: 1, id: String(id) }, null, 2));
          return { success: true };
        }
      } catch (e) {}
      return { success: false };
    }
  };

  console.log('✅ Tauri Bridge ready - window.tauriBridge available');
})().catch(console.error);
