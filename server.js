const http = require('http');
const fs = require('fs');
const path = require('path');
const os = require('os');

const PORT = 3001;

const mimeTypes = {
    '.html': 'text/html',
    '.js': 'text/javascript',
    '.css': 'text/css',
    '.json': 'application/json',
    '.png': 'image/png',
    '.jpg': 'image/jpg',
    '.gif': 'image/gif',
    '.mp3': 'audio/mpeg'
};

const server = http.createServer((req, res) => {
    // CORS headers
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
        res.writeHead(204);
        res.end();
        return;
    }
    if (req.method === 'POST' && req.url === '/api/shutdown') {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: true, message: 'Server is shutting down.' }));
        console.log("Shutting down server requested by user...");
        setTimeout(() => process.exit(0), 100);
        return;
    }

    if (req.method === 'POST' && req.url === '/api/save-preset') {
        let body = '';
        req.on('data', chunk => body += chunk.toString());
        req.on('end', () => {
            try {
                const data = JSON.parse(body);
                const presetsDir = path.join(__dirname, 'presets');

                if (!fs.existsSync(presetsDir)) {
                    fs.mkdirSync(presetsDir);
                }

                if (!data.presetName) {
                    throw new Error("Missing preset name.");
                }

                // Sanitize filename
                const safeName = data.presetName.replace(/[^a-z0-9]/gi, '_').toLowerCase();
                const filePath = path.join(presetsDir, `${safeName}.json`);

                fs.writeFileSync(filePath, JSON.stringify(data, null, 4));

                console.log(`Saved character preset: ${safeName}`);
                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ success: true, preset: safeName }));
            } catch (error) {
                console.error("Error saving preset:", error);
                res.writeHead(500, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ success: false, error: error.message }));
            }
        });
        return;
    }

    if (req.method === 'GET' && req.url === '/api/list-presets') {
        try {
            const presetsDir = path.join(__dirname, 'presets');
            if (!fs.existsSync(presetsDir)) {
                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify([]));
                return;
            }
            const files = fs.readdirSync(presetsDir).filter(f => f.endsWith('.json'));
            const presets = [];

            for (const file of files) {
                try {
                    const content = JSON.parse(fs.readFileSync(path.join(presetsDir, file), 'utf8'));
                    presets.push(content);
                } catch (e) {
                    console.error(`Error reading preset ${file}:`, e);
                }
            }

            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify(presets));
        } catch (error) {
            res.writeHead(500, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: error.message }));
        }
        return;
    }

    if (req.method === 'POST' && req.url === '/api/delete-preset') {
        let body = '';
        req.on('data', chunk => body += chunk.toString());
        req.on('end', () => {
            try {
                const data = JSON.parse(body);
                if (!data.presetName) throw new Error("Missing preset name");

                const presetsDir = path.join(__dirname, 'presets');
                const safeName = data.presetName.replace(/[^a-z0-9]/gi, '_').toLowerCase();
                const filePath = path.join(presetsDir, `${safeName}.json`);

                if (fs.existsSync(filePath)) {
                    fs.unlinkSync(filePath);
                    res.writeHead(200, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ success: true }));
                } else {
                    res.writeHead(404, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ success: false, error: "Preset not found" }));
                }
            } catch (error) {
                console.error("Error deleting preset:", error);
                res.writeHead(500, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ success: false, error: error.message }));
            }
        });
        return;
    }

    if (req.method === 'POST' && req.url === '/api/save-new-game') {
        let body = '';
        req.on('data', chunk => body += chunk.toString());
        req.on('end', () => {
            try {
                const data = JSON.parse(body);
                const gamesDir = path.join(__dirname, 'games');

                if (!fs.existsSync(gamesDir)) {
                    fs.mkdirSync(gamesDir);
                }

                // Find next available number
                let i = 1;
                while (fs.existsSync(path.join(gamesDir, i.toString()))) {
                    i++;
                }

                const newGameDir = path.join(gamesDir, i.toString());
                fs.mkdirSync(newGameDir);

                // Save world info
                if (data.worldInfo) {
                    fs.writeFileSync(
                        path.join(newGameDir, 'worldinfo.json'),
                        JSON.stringify(data.worldInfo, null, 4)
                    );
                }

                // Save player info
                if (data.playerInfo) {
                    fs.writeFileSync(
                        path.join(newGameDir, 'player.json'),
                        JSON.stringify(data.playerInfo, null, 4)
                    );
                }

                // Save game state
                if (data.gameState) {
                    fs.writeFileSync(
                        path.join(newGameDir, 'gamestate.json'),
                        JSON.stringify(data.gameState, null, 4)
                    );
                }

                // Save starting scenario & summary
                if (data.startingScenario || data.summary) {
                    const scenarioData = {
                        startingScenario: data.startingScenario || '',
                        summary: data.summary || ''
                    };
                    fs.writeFileSync(
                        path.join(newGameDir, 'scenario.json'),
                        JSON.stringify(scenarioData, null, 4)
                    );
                }

                if (data.playerImage) {
                    fs.writeFileSync(
                        path.join(newGameDir, 'player_image.json'),
                        JSON.stringify({ url: data.playerImage }, null, 4)
                    );
                }

                // Create default files based on user request
                fs.writeFileSync(path.join(newGameDir, 'locationsledger.json'), JSON.stringify({ locations: [] }, null, 4));
                fs.writeFileSync(path.join(newGameDir, 'npc-ledger.json'), JSON.stringify({ npcs: [] }, null, 4));
                fs.writeFileSync(path.join(newGameDir, 'mainoutput.json'), JSON.stringify({ time: {}, textoutput: "", inventory_changes: [], location_changes: [], npc_changes: [], stats: {} }, null, 4));
                fs.writeFileSync(path.join(newGameDir, 'chat_history.json'), JSON.stringify([], null, 4));

                console.log(`New game saved to folder: ${i}`);
                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ success: true, folder: i }));
            } catch (error) {
                console.error("Error saving game:", error);
                res.writeHead(500, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ success: false, error: error.message }));
            }
        });
        return;
    }

    if (req.method === 'GET' && req.url === '/api/list-games') {
        try {
            const gamesDir = path.join(__dirname, 'games');
            if (!fs.existsSync(gamesDir)) {
                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify([]));
                return;
            }
            const games = fs.readdirSync(gamesDir).filter(f => fs.statSync(path.join(gamesDir, f)).isDirectory());
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify(games));
        } catch (error) {
            res.writeHead(500, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: error.message }));
        }
        return;
    }

    if (req.method === 'GET' && req.url.startsWith('/api/load-game?id=')) {
        try {
            const url = new URL(req.url, `http://${req.headers.host}`);
            const id = url.searchParams.get('id');
            const newGameDir = path.join(__dirname, 'games', id);

            if (!fs.existsSync(newGameDir)) {
                res.writeHead(404, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ error: 'Game not found' }));
                return;
            }

            const filesToLoad = ['worldinfo.json', 'player.json', 'gamestate.json', 'scenario.json', 'locationsledger.json', 'npc-ledger.json', 'mainoutput.json', 'chat_history.json', 'player_image.json'];
            const gameData = {};

            for (const file of filesToLoad) {
                const filePath = path.join(newGameDir, file);
                if (fs.existsSync(filePath)) {
                    gameData[file] = JSON.parse(fs.readFileSync(filePath, 'utf8'));
                }
            }

            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify(gameData));
        } catch (error) {
            res.writeHead(500, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: error.message }));
        }
        return;
    }

    if (req.method === 'POST' && req.url === '/api/update-game') {
        let body = '';
        req.on('data', chunk => body += chunk.toString());
        req.on('end', () => {
            try {
                const data = JSON.parse(body);
                const id = data.id;
                const gameDir = path.join(__dirname, 'games', id.toString());

                if (!fs.existsSync(gameDir)) {
                    res.writeHead(404, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ error: 'Game not found' }));
                    return;
                }

                if (data.gameState) {
                    fs.writeFileSync(path.join(gameDir, 'gamestate.json'), JSON.stringify(data.gameState, null, 4));
                }
                if (data.chatHistory) {
                    fs.writeFileSync(path.join(gameDir, 'chat_history.json'), JSON.stringify(data.chatHistory, null, 4));
                }
                if (data.npcLedger) {
                    fs.writeFileSync(path.join(gameDir, 'npc-ledger.json'), JSON.stringify(data.npcLedger, null, 4));
                }
                if (data.locationsLedger) {
                    fs.writeFileSync(path.join(gameDir, 'locationsledger.json'), JSON.stringify(data.locationsLedger, null, 4));
                }
                if (data.summary !== undefined) {
                    const scenarioPath = path.join(gameDir, 'scenario.json');
                    let scenarioData = { startingScenario: '', summary: '' };
                    if (fs.existsSync(scenarioPath)) {
                        try {
                            scenarioData = JSON.parse(fs.readFileSync(scenarioPath, 'utf8'));
                        } catch (e) { }
                    }
                    scenarioData.summary = data.summary;
                    fs.writeFileSync(scenarioPath, JSON.stringify(scenarioData, null, 4));
                }

                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ success: true }));
            } catch (error) {
                console.error("Error updating game:", error);
                res.writeHead(500, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ success: false, error: error.message }));
            }
        });
        return;
    }

    if (req.method === 'POST' && req.url === '/api/update-image') {
        let body = '';
        req.on('data', chunk => body += chunk.toString());
        req.on('end', () => {
            try {
                const data = JSON.parse(body);
                const id = data.id;
                const gameDir = path.join(__dirname, 'games', id.toString());

                if (!fs.existsSync(gameDir)) {
                    res.writeHead(404, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ error: 'Game not found' }));
                    return;
                }

                if (data.url) {
                    fs.writeFileSync(path.join(gameDir, 'player_image.json'), JSON.stringify({ url: data.url }, null, 4));
                }

                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ success: true }));
            } catch (error) {
                console.error("Error updating image:", error);
                res.writeHead(500, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ success: false, error: error.message }));
            }
        });
        return;
    }

    if (req.method === 'POST' && req.url === '/api/download-image') {
        let body = '';
        req.on('data', chunk => body += chunk.toString());
        req.on('end', () => {
            try {
                const data = JSON.parse(body);
                const id = data.id;
                const imageUrl = data.url;
                const gameDir = path.join(__dirname, 'games', id.toString());

                if (!fs.existsSync(gameDir)) {
                    res.writeHead(404, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ error: 'Game not found' }));
                    return;
                }

                const destPath = path.join(gameDir, 'player_base.png');

                // Handle base64 data URIs directly
                if (imageUrl.startsWith('data:image')) {
                    const base64Data = imageUrl.replace(/^data:image\/\w+;base64,/, '');
                    fs.writeFileSync(destPath, Buffer.from(base64Data, 'base64'));
                    console.log(`Base image saved for game ${id}`);
                    res.writeHead(200, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ success: true, path: 'player_base.png' }));
                    return;
                }

                // Download from URL
                const protocol = imageUrl.startsWith('https') ? require('https') : require('http');
                protocol.get(imageUrl, (imgRes) => {
                    if (imgRes.statusCode !== 200) {
                        res.writeHead(500, { 'Content-Type': 'application/json' });
                        res.end(JSON.stringify({ error: `Image download failed with status ${imgRes.statusCode}` }));
                        return;
                    }
                    const fileStream = fs.createWriteStream(destPath);
                    imgRes.pipe(fileStream);
                    fileStream.on('finish', () => {
                        fileStream.close();
                        console.log(`Base image saved for game ${id}`);
                        res.writeHead(200, { 'Content-Type': 'application/json' });
                        res.end(JSON.stringify({ success: true, path: 'player_base.png' }));
                    });
                    fileStream.on('error', (err) => {
                        res.writeHead(500, { 'Content-Type': 'application/json' });
                        res.end(JSON.stringify({ error: err.message }));
                    });
                }).on('error', (err) => {
                    res.writeHead(500, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ error: err.message }));
                });
            } catch (error) {
                console.error("Error downloading image:", error);
                res.writeHead(500, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ success: false, error: error.message }));
            }
        });
        return;
    }

    if (req.method === 'GET' && req.url.startsWith('/api/get-base-image?id=')) {
        try {
            const url = new URL(req.url, `http://${req.headers.host}`);
            const id = url.searchParams.get('id');
            const imgPath = path.join(__dirname, 'games', id, 'player_base.png');

            if (!fs.existsSync(imgPath)) {
                res.writeHead(404, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ error: 'Base image not found' }));
                return;
            }

            const imgBuffer = fs.readFileSync(imgPath);
            const base64 = imgBuffer.toString('base64');
            const dataUri = `data:image/png;base64,${base64}`;

            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ success: true, dataUri: dataUri }));
        } catch (error) {
            console.error("Error reading base image:", error);
            res.writeHead(500, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: error.message }));
        }
        return;
    }


    // Proxy for xAI to bypass CORS
    if (req.url.startsWith('/api/xai-proxy/')) {
        const targetUrl = 'https://api.x.ai/' + req.url.substring('/api/xai-proxy/'.length);
        const https = require('https');

        const options = {
            method: req.method,
            headers: {}
        };

        // Forward standard headers
        for (const h of ['authorization', 'content-type', 'accept', 'content-length']) {
            if (req.headers[h]) options.headers[h] = req.headers[h];
        }

        const proxyReq = https.request(targetUrl, options, (proxyRes) => {
            // Forward the response headers except those that might cause issues
            const resHeaders = { ...proxyRes.headers };
            delete resHeaders['access-control-allow-origin'];
            delete resHeaders['access-control-allow-headers'];
            delete resHeaders['access-control-allow-methods'];

            res.writeHead(proxyRes.statusCode, resHeaders);
            proxyRes.pipe(res, { end: true });
        });

        proxyReq.on('error', (err) => {
            console.error('XAI Proxy Error:', err);
            res.writeHead(500, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: err.message }));
        });

        if (req.method === 'POST' || req.method === 'PUT') {
            req.pipe(proxyReq, { end: true });
        } else {
            proxyReq.end();
        }
        return;
    }

    // Static file serving — strip query strings for cache-busting support
    const urlPath = req.url.split('?')[0];
    let filePath = path.join(__dirname, urlPath === '/' ? 'Welcome.html' : urlPath);
    const extname = String(path.extname(filePath)).toLowerCase();
    const contentType = mimeTypes[extname] || 'application/octet-stream';

    fs.readFile(filePath, (error, content) => {
        if (error) {
            if (error.code == 'ENOENT') {
                res.writeHead(404);
                res.end('File not found');
            } else {
                res.writeHead(500);
                res.end('Server error: ' + error.code);
            }
        } else {
            res.writeHead(200, {
                'Content-Type': contentType,
                'Cache-Control': 'no-cache, no-store, must-revalidate'
            });
            res.end(content, 'utf-8');
        }
    });
});

server.on('error', (e) => {
    if (e.code === 'EADDRINUSE') {
        console.error(`\n======================================================`);
        console.error(` Error: The server is already running!`);
        console.error(` Port ${PORT} is currently in use.`);
        console.error(` Please close any other command windows running the game,`);
        console.error(` or use the shutdown option before restarting.`);
        console.error(`======================================================\n`);
        process.exit(1);
    } else {
        console.error('Server error:', e);
        process.exit(1);
    }
});

server.listen(PORT, '0.0.0.0', () => {
    console.log(`\n======================================================`);
    console.log(` JSON Adventure is running!`);
    console.log(` - Local:   http://localhost:${PORT}/`);

    const networkInterfaces = os.networkInterfaces();
    console.log(` - Network IPs (try these from your phone/macbook):`);
    for (const interfaceName in networkInterfaces) {
        for (const net of networkInterfaces[interfaceName]) {
            // Ignore internal addresses and IPv6
            if (net.family === 'IPv4' && !net.internal) {
                // Ignore typical virtual adapter IPs (like Hyper-V or WSL)
                if (!interfaceName.toLowerCase().includes('wsl') && !interfaceName.toLowerCase().includes('virtual') && !interfaceName.toLowerCase().includes('vethernet')) {
                    console.log(`      * http://${net.address}:${PORT}/  (${interfaceName})`);
                }
            }
        }
    }
    console.log(`======================================================\n`);
});
