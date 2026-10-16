const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const { chromium } = require('playwright');
const W = require('../web/world.js');
const { createWorldServer } = require('../server/world-server.cjs');

// Isolated offline fixtures for art review. These never touch a real player's save.
async function main() {
  const server = createWorldServer({ dbPath: ':memory:' }); const address = await server.listen(0);
  const browser = await chromium.launch({ headless: true, ...(process.env.BROWSER_EXECUTABLE_PATH ? { executablePath: process.env.BROWSER_EXECUTABLE_PATH } : {}), args: ['--no-sandbox', '--disable-gpu', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  const output = path.resolve(__dirname, '../test-results'); fs.mkdirSync(output, { recursive: true });
  try {
    for (const location of [{ name: 'forest', x: 34, z: 9, level: 1 }, { name: 'ruins', x: 97, z: -42, level: 8 }]) {
      assert(W.walkable(location.x, location.z));
      const profile = W.createCharacter('visual-' + location.name, 'Strážce úsvitu');
      Object.assign(profile, { x: location.x, z: location.z, level: location.level, questActive: true });
      if (location.level > 1) {
        profile.bag.push({ uid: 'jade-armor', typeId: 'jadeArmor' }, { uid: 'jade-sword', typeId: 'jadeSword' });
        profile.gear.armor = 'jade-armor'; profile.gear.weapon = 'jade-sword';
      }
      profile.hp = W.stats(profile).maxHp; profile.mana = W.stats(profile).maxMana;
      const context = await browser.newContext({ viewport: { width: 1440, height: 900 } }); const page = await context.newPage();
      page.setDefaultTimeout(60000); const errors = [];
      page.on('pageerror', error => errors.push(error.message)); page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
      await page.goto(`http://127.0.0.1:${address.port}/?quality=low`); await page.waitForFunction(() => window.fantasyGame);
      await page.evaluate(async profile => {
        await new Promise((resolve, reject) => {
          const request = indexedDB.open('rift-chronicles-v1', 1);
          request.onsuccess = () => { const transaction = request.result.transaction('saves', 'readwrite'); transaction.objectStore('saves').put({ ...profile, savedAt: Date.now() }, 'offline'); transaction.oncomplete = resolve; transaction.onerror = reject; };
          request.onerror = reject;
        });
      }, W.serializeCharacter(profile));
      await page.reload(); await page.waitForFunction(() => window.fantasyGame); await page.locator('#start').click(); await page.waitForFunction(() => window.started);
      await page.evaluate(name => {
        window.paused = true;
        if (name === 'ruins') { const r = window.streetLifeRenderer; r.yaw = -.08; r.pitch = .3; r.distance = 32; r.setQuality(false); }
      }, location.name);
      await page.waitForFunction(() => {
        const r = window.streetLifeRenderer, s = window.fantasyGame.inspect().snapshot.self;
        return Math.hypot(r.target.x - s.x, r.target.z - s.z) < .1;
      });
      const session = await context.newCDPSession(page), shot = await session.send('Page.captureScreenshot', { format: 'png', fromSurface: false, captureBeyondViewport: false });
      fs.writeFileSync(path.join(output, location.name + '.png'), Buffer.from(shot.data, 'base64'));
      assert.deepEqual(errors, []); console.log('PASS: visual fixture', location.name); await context.close();
    }
  } finally { await browser.close(); await server.close(); }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
