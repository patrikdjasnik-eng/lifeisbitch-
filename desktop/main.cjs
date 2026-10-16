const { app, BrowserWindow, protocol, net, dialog, ipcMain } = require('electron');
const path = require('node:path');
const { pathToFileURL } = require('node:url');

protocol.registerSchemesAsPrivileged([{ scheme: 'game', privileges: { standard: true, secure: true, supportFetchAPI: true } }]);
const smoke = process.argv.includes('--smoke');
let gameWindow;
let launcherWindow;
let updateBusy = false;
let gameRoot;
const updater = require('./updater.cjs');
const fs = require('node:fs');
if (smoke) app.setPath('userData', fs.mkdtempSync(path.join(app.getPath('temp'), 'rift-smoke-')));
function log(message) {
  try { const folder = app.getPath('userData'); fs.mkdirSync(folder, { recursive: true }); fs.appendFileSync(path.join(folder, 'startup.log'), new Date().toISOString() + ' ' + message + '\n'); } catch (error) { console.error(error); }
}
if (process.argv.includes('--safe-mode')) app.disableHardwareAcceleration();
process.on('uncaughtException', error => { log(error.stack || error.message); if (!smoke) dialog.showErrorBox('Life Is Bitch — chyba', error.message); app.exit(1); });

function assetPath(url) {
  const request = new URL(url);
  if (request.host !== 'local') throw new Error('Unknown game host');
  const root = gameRoot || path.join(app.getAppPath(), 'web');
  const file = path.resolve(root, '.' + decodeURIComponent(request.pathname === '/' ? '/index.html' : request.pathname));
  const relative = path.relative(root, file);
  if (!relative || relative.startsWith('..') || path.isAbsolute(relative)) throw new Error('Invalid asset path');
  return file;
}

async function createWindow() {
  gameWindow = new BrowserWindow({
    width: 1280, height: 800, minWidth: 960, minHeight: 600,
    title: 'Life Is Bitch · Kroniky trhliny', backgroundColor: '#101c24',
    show: true, autoHideMenuBar: true, icon: path.join(__dirname, 'icon-beta.ico'),
    webPreferences: { preload: path.join(__dirname, 'game-preload.cjs'), nodeIntegration: false, contextIsolation: true, sandbox: true }
  });
  gameWindow.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  gameWindow.webContents.on('will-navigate', (event, url) => {
    if (url !== 'game://local/index.html') event.preventDefault();
  });
  gameWindow.webContents.on('before-input-event', (event, input) => {
    if (input.type === 'keyDown' && input.key === 'F11') {
      gameWindow.setFullScreen(!gameWindow.isFullScreen());
      event.preventDefault();
    }
  });
  gameWindow.on('blur', () => {
    gameWindow.webContents.executeJavaScript("if(typeof started !== 'undefined' && started && !paused && !dialogOpen) document.getElementById('pause').click();").catch(console.error);
  });
  gameWindow.webContents.on('render-process-gone', (_, details) => { log('Renderer stopped: ' + JSON.stringify(details)); if (!smoke) dialog.showErrorBox('Grafika hry se zastavila', 'Zkus spustit hru s parametrem --safe-mode.'); });
  log('Loading game; packaged=' + app.isPackaged);
  await gameWindow.loadURL('game://local/index.html');
  gameWindow.show();
  if (smoke) {
    const result = await gameWindow.webContents.executeJavaScript(`new Promise(resolve => {
      const deadline = Date.now() + 20000;
      let clicked = false;
      const poll = setInterval(() => {
        if (window.fantasyGame && !clicked) {
          document.getElementById('characterName').value = 'Smoke Tester';
          document.getElementById('start').click(); clicked = true;
        }
        if ((window.fantasyGame?.inspect().started && window.streetLifeRenderer.renderer.info.render.calls > 0) || Date.now() > deadline) {
          clearInterval(poll);
          resolve({ scene: !!window.streetLifeScene, started: !!window.started, canvas: document.getElementById('game').width > 0, renderer: !!window.streetLifeRenderer });
        }
      }, 100);
    })`);
    result.services = await gameWindow.webContents.executeJavaScript(`(() => {
      const game = window.fantasyGame?.inspect();
      document.getElementById('inventoryButton').click();
      return game?.snapshot?.self?.level === 1 && game.snapshot.enemies.length > 0 && document.getElementById('panel').open;
    })()`);
    log('Desktop smoke: ' + JSON.stringify(result));
    console.log('Desktop smoke:', JSON.stringify(result));
    app.exit(result.scene && result.started && result.canvas && result.services ? 0 : 1);
  }
}

ipcMain.handle('players:register', async (event, profile) => {
  if (smoke || event.sender !== gameWindow?.webContents || event.senderFrame?.url !== 'game://local/index.html') return { registered: false };
  if (!profile || typeof profile.name !== 'string' || profile.name.length > 40 || !/^LIB-[a-f0-9]{32}$/.test(profile.id) || !/^[a-f0-9]{64}$/.test(profile.token)) return { registered: false };
  try {
    const endpoint = new URL(process.env.LIB_REGISTRY_URL || 'http://127.0.0.1:8789');
    if (endpoint.protocol !== 'https:' && !(endpoint.protocol === 'http:' && ['127.0.0.1', 'localhost'].includes(endpoint.hostname))) throw Error('Registry requires HTTPS');
    endpoint.pathname = '/api/players/register'; endpoint.search = ''; endpoint.hash = '';
    const response = await fetch(endpoint, {
      method: 'POST', redirect: 'error', signal: AbortSignal.timeout(5000),
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: profile.id, name: profile.name, token: profile.token, platform: process.platform, version: app.getVersion() })
    });
    return { registered: response.ok };
  } catch { return { registered: false }; }
});

ipcMain.handle('accounts:request', async (event, action, payload) => {
  if (event.sender !== gameWindow?.webContents || event.senderFrame?.url !== 'game://local/index.html') return { ok: false, error: 'Neplatné okno.' };
  if (!['register', 'login', 'recover', 'session', 'logout'].includes(action) || !payload || JSON.stringify(payload).length > 1800) return { ok: false, error: 'Neplatná žádost.' };
  try {
    const endpoint = new URL(process.env.LIB_REGISTRY_URL || 'http://127.0.0.1:8789');
    if (endpoint.protocol !== 'https:' && !(endpoint.protocol === 'http:' && ['127.0.0.1', 'localhost'].includes(endpoint.hostname))) throw Error('HTTPS required');
    endpoint.pathname = '/api/accounts/' + action; endpoint.search = ''; endpoint.hash = '';
    const response = await fetch(endpoint, { method: 'POST', redirect: 'error', signal: AbortSignal.timeout(12000), headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
    const result = await response.json();
    return response.ok ? result : { ok: false, error: result.error || 'Žádost se nezdařila.' };
  } catch { return { ok: false, error: 'Server účtů není dostupný. Můžeš hrát offline.' }; }
});

app.whenReady().then(async () => {
  protocol.handle('game', async request => {
    try { return await net.fetch(pathToFileURL(assetPath(request.url)).toString()); }
    catch (error) { console.error(error); return new Response('Not found', { status: 404 }); }
  });
  gameRoot = path.join(app.getAppPath(), 'web');
  if (smoke || !app.isPackaged || process.argv.includes('--direct')) await createWindow();
  else await createLauncher();
}).catch(error => {
  log(error.stack || error.message);
  console.error(error);
  if (!smoke) dialog.showErrorBox('Hru nelze spustit', error.message);
  app.exit(1);
});
app.on('window-all-closed', () => app.quit());
if (smoke) setTimeout(() => app.exit(1), 30000).unref();

async function createLauncher() {
  const folder = path.join(app.getPath('userData'), 'updates-v1');
  const current = await updater.installed(folder);
  if (current) gameRoot = current.root;
  launcherWindow = new BrowserWindow({ width: 1000, height: 700, minWidth: 850, minHeight: 650, autoHideMenuBar: true, icon: path.join(__dirname, 'icon-beta.ico'), webPreferences: { preload: path.join(__dirname, 'launcher-preload.cjs'), nodeIntegration: false, contextIsolation: true, sandbox: true } });
  launcherWindow.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  launcherWindow.webContents.on('will-navigate', event => event.preventDefault());
  const trusted = event => event.sender === launcherWindow?.webContents;
  async function checkUpdate() {
    if (updateBusy) return;
    updateBusy = true;
    const report = (text, progress, busy = true, version = '') => {
      if (!launcherWindow?.isDestroyed()) launcherWindow.webContents.send('launcher:status', { text, progress, busy, version });
    };
    try {
      const result = await updater.update(folder, report);
      gameRoot = result.root;
      report('Hra je připravená.', 100, false, result.sha.slice(0, 7));
    } catch (error) {
      log('Update failed: ' + error.message);
      report('Aktualizace není dostupná. Můžeš hrát poslední nainstalovanou verzi offline.', 0, false);
    } finally { updateBusy = false; }
  }
  ipcMain.handle('launcher:check', async event => { if (!trusted(event)) throw Error('Unknown sender'); await checkUpdate(); });
  ipcMain.handle('launcher:play', async event => {
    if (!trusted(event) || updateBusy) return;
    await createWindow();
    launcherWindow.close();
  });
  await launcherWindow.loadFile(path.join(__dirname, 'launcher.html'));
  await checkUpdate();
}
