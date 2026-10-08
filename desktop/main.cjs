const { app, BrowserWindow, protocol, net, dialog } = require('electron');
const path = require('node:path');
const { pathToFileURL } = require('node:url');

protocol.registerSchemesAsPrivileged([{ scheme: 'game', privileges: { standard: true, secure: true, supportFetchAPI: true } }]);
const smoke = process.argv.includes('--smoke');
let gameWindow;

function assetPath(url) {
  const request = new URL(url);
  if (request.host !== 'local') throw new Error('Unknown game host');
  const root = path.join(app.getAppPath(), 'web');
  const file = path.resolve(root, '.' + decodeURIComponent(request.pathname === '/' ? '/index.html' : request.pathname));
  const relative = path.relative(root, file);
  if (!relative || relative.startsWith('..') || path.isAbsolute(relative)) throw new Error('Invalid asset path');
  return file;
}

async function createWindow() {
  gameWindow = new BrowserWindow({
    width: 1280, height: 800, minWidth: 960, minHeight: 600,
    title: 'Life Is Bitch · Betonové sny', backgroundColor: '#080c11',
    show: false, autoHideMenuBar: true, icon: path.join(__dirname, 'icon-beta.ico'),
    webPreferences: { nodeIntegration: false, contextIsolation: true, sandbox: true }
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
  await gameWindow.loadURL('game://local/index.html');
  gameWindow.show();
  if (smoke) {
    const result = await gameWindow.webContents.executeJavaScript(`new Promise(resolve => {
      document.getElementById('start').click();
      setTimeout(() => resolve({
        scene: !!window.streetLifeScene,
        started: typeof started !== 'undefined' && started,
        canvas: document.getElementById('game').width > 0,
        renderer: !!window.streetLifeRenderer
      }), 3000);
    })`);
    console.log('Desktop smoke:', JSON.stringify(result));
    app.exit(result.scene && result.started && result.canvas ? 0 : 1);
  }
}

app.whenReady().then(async () => {
  protocol.handle('game', async request => {
    try { return await net.fetch(pathToFileURL(assetPath(request.url)).toString()); }
    catch (error) { console.error(error); return new Response('Not found', { status: 404 }); }
  });
  await createWindow();
}).catch(error => {
  console.error(error);
  if (!smoke) dialog.showErrorBox('Hru nelze spustit', error.message);
  app.exit(1);
});
app.on('window-all-closed', () => app.quit());
if (smoke) setTimeout(() => app.exit(1), 30000).unref();
