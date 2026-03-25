const test = require('node:test');
const assert = require('node:assert');
const { spawn } = require('child_process');

test('Server API Tests', async (t) => {
    // Start server on a specific port for testing
    const server = spawn('node', ['server.js'], { 
        cwd: __dirname,
        env: { ...process.env, PORT: '3002' }
    });
    
    // wait 3s for server to start
    await new Promise(r => setTimeout(r, 3000));

    try {
        const res = await fetch('http://localhost:3002/');
        assert.strictEqual(res.status, 200, 'Home page should return 200 OK');

        const presets = await fetch('http://localhost:3002/api/list-presets');
        assert.strictEqual(presets.status, 200, 'list-presets endpoint should return 200 OK');
        
        const models = await fetch('http://localhost:3002/models.json');
        assert.ok(models.status === 200 || models.status === 404, 'models.json should return 200 or 404');
    } finally {
        server.kill();
    }
});
