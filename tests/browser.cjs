const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { chromium } = require('playwright');
const { createWorldServer } = require('../server/world-server.cjs');

async function main() {
  const game = createWorldServer({ dbPath: ':memory:' });
  const address = await game.listen(0);
  const base = `http://127.0.0.1:${address.port}`;
  const browser = await chromium.launch({
    headless: true,
    ...(process.env.BROWSER_EXECUTABLE_PATH ? { executablePath: process.env.BROWSER_EXECUTABLE_PATH } : {}),
    args: ['--no-sandbox', '--disable-gpu', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader']
  });
  const errors = [];
  fs.mkdirSync(path.resolve(__dirname, '../test-results'), { recursive: true });
  async function pageFor(context, viewport) {
    const page = await context.newPage();
    if (viewport) await page.setViewportSize(viewport);
    page.setDefaultTimeout(60000);
    page.on('pageerror', error => { errors.push(error.message); console.error('Browser error:', error.message); });
    page.on('console', message => { if (message.type() === 'error') { errors.push(message.text()); console.error('Browser console:', message.text()); } });
    await page.goto(base + '/?quality=low');
    await page.waitForFunction(() => window.fantasyGame || !document.getElementById('fatal').hidden, null, { timeout: 45000 });
    if (await page.locator('#fatal').isVisible()) throw Error(await page.locator('#fatalText').innerText());
    assert.equal(await page.locator('#fatal').isVisible(), false);
    return page;
  }
  async function capture(page, name) {
    // Capture the viewport directly; this also works on software-rendered WebGL.
    const session = await page.context().newCDPSession(page);
    const shot = await session.send('Page.captureScreenshot', { format: 'png', fromSurface: false, captureBeyondViewport: false });
    fs.writeFileSync(path.resolve(__dirname, '../test-results', name + '.png'), Buffer.from(shot.data, 'base64'));
    await session.detach();
  }
  async function startOnline(page, name) {
    await page.bringToFront();
    await page.locator('#characterName').fill(name);
    await page.locator('[name="mode"][value="online"]').check();
    await page.locator('#serverUrl').fill(base.replace('http:', 'ws:') + '/world');
    await page.locator('#start').click();
    await page.waitForFunction(() => window.started && window.fantasyGame.inspect().mode === 'online');
  }
  try {
    const context = await browser.newContext({ viewport: { width: 1000, height: 700 } });
    const page = await pageFor(context);
    await capture(page, 'menu');
    await page.locator('#characterName').fill('Strážce testů'); await page.locator('#start').click();
    await page.waitForFunction(() => window.started);
    await page.keyboard.down('w');
    try { await page.waitForFunction(() => window.fantasyGame.inspect().snapshot.self.z < 9); }
    finally { await page.keyboard.up('w'); }
    console.log('PASS: offline entry, rendering and keyboard movement');
    await page.waitForFunction(() => {
      const renderer = window.streetLifeRenderer, actor = renderer.actors.get(window.fantasyGame.inspect().snapshot.self.id);
      return Math.abs(renderer.target.z - actor.object.position.z) < .05;
    });
    const npc = await page.evaluate(() => {
      const renderer = window.streetLifeRenderer, point = renderer.actors.get('aira').object.position.clone();
      point.y += 1.2; point.project(renderer.camera);
      return { x: (point.x * .5 + .5) * innerWidth, y: (-point.y * .5 + .5) * innerHeight };
    });
    await page.mouse.click(npc.x, npc.y);
    try { await page.waitForFunction(() => document.getElementById('panel').open && document.getElementById('panelTitle').textContent === 'Mistryně Aira', null, { timeout: 35000 }); }
    catch (error) { console.error('NPC state', await page.evaluate(() => ({ self: window.fantasyGame.inspect().snapshot.self, target: window.streetLifeRenderer.targetId }))); await capture(page, 'npc-failure'); throw error; }
    await page.getByRole('button', { name: 'Přijmout úkol', exact: true }).click();
    await page.waitForFunction(() => window.fantasyGame.inspect().snapshot.self.questActive);
    await page.locator('#inventoryButton').click();
    assert.match(await page.locator('#panelBody').innerText(), /Železný meč/);
    await capture(page, 'inventory'); await page.locator('#closePanel').click();
    await page.locator('#mapButton').click(); assert.equal(await page.locator('.map-canvas').count(), 1); await page.locator('#closePanel').click();
    console.log('PASS: 3D NPC picking, click movement, quest acceptance, inventory and map');
    await page.keyboard.down('d');
    try { await page.waitForFunction(() => window.fantasyGame.inspect().snapshot.self.x > 30, null, { timeout: 35000 }); }
    finally { await page.keyboard.up('d'); }
    await page.keyboard.down('s');
    try { await page.waitForFunction(() => window.fantasyGame.inspect().snapshot.self.z > 8, null, { timeout: 25000 }); }
    finally { await page.keyboard.up('s'); }
    await page.keyboard.press('Tab'); await page.locator('#attackButton').click();
    await page.waitForFunction(() => window.fantasyGame.inspect().snapshot.self.kills > 0, null, { timeout: 35000 });
    assert((await page.evaluate(() => window.fantasyGame.inspect().snapshot.self.questProgress)) > 0);
    await capture(page, 'combat');
    await page.locator('#pause').click();
    await page.getByRole('button', { name: 'Uložit a vrátit se k postavě', exact: true }).click();
    await page.waitForFunction(() => !window.started);
    await page.reload(); await page.waitForFunction(() => window.fantasyGame);
    await page.locator('#start').click(); await page.waitForFunction(() => window.started);
    assert((await page.evaluate(() => window.fantasyGame.inspect().snapshot.self.kills)) > 0);
    assert.equal(await page.evaluate(() => window.fantasyGame.inspect().snapshot.self.name), 'Strážce testů');
    console.log('PASS: UI combat and saved offline quest/inventory/progress restored after reload');
    await context.close();

    const firstContext = await browser.newContext({ viewport: { width: 1000, height: 700 } });
    const secondContext = await browser.newContext({ viewport: { width: 1000, height: 700 } });
    const first = await pageFor(firstContext), second = await pageFor(secondContext);
    await startOnline(first, 'První poutník'); await startOnline(second, 'Druhý poutník');
    await first.waitForFunction(() => window.fantasyGame.inspect().snapshot.population === 2, null, { polling: 100 });
    assert.equal(await first.evaluate(() => window.fantasyGame.inspect().snapshot.players.length), 2);
    await first.bringToFront(); await first.locator('#chatInput').fill('Setkání pod starou bránou'); await first.locator('#chatInput').press('Enter');
    await second.getByText('Setkání pod starou bránou', { exact: false }).waitFor();
    await second.bringToFront(); await capture(second, 'online');
    const id = await first.evaluate(() => window.fantasyGame.inspect().snapshot.self.id);
    await first.reload(); await first.waitForFunction(() => window.fantasyGame);
    await startOnline(first, 'Jiné jméno');
    assert.equal(await first.evaluate(() => window.fantasyGame.inspect().snapshot.self.id), id);
    assert.equal(await first.evaluate(() => window.fantasyGame.inspect().snapshot.self.name), 'První poutník');
    console.log('PASS: two browser clients, shared population, chat and online credential resume');
    await firstContext.close(); await secondContext.close();

    const mobileContext = await browser.newContext({ viewport: { width: 844, height: 390 }, isMobile: true, hasTouch: true });
    const mobile = await pageFor(mobileContext);
    await mobile.locator('#start').click(); await mobile.waitForFunction(() => window.started);
    assert.equal(await mobile.locator('#touchPad').isVisible(), true);
    await mobile.locator('#questButton').click(); assert.match(await mobile.locator('#panelTitle').innerText(), /Cesta hrdiny/);
    await capture(mobile, 'mobile'); await mobileContext.close();
    assert.deepEqual(errors, []);
    console.log('PASS: mobile controls, modal layout and no browser errors');
  } finally { await browser.close(); await game.close(); }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
