const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { WebSocket } = require('ws');
const { createWorldServer } = require('../server/world-server.cjs');
const W = require('../web/world.js');
const delay = milliseconds => new Promise(resolve => setTimeout(resolve, milliseconds));
async function peer(url, hello = {}, origin) {
  const ws = new WebSocket(url, origin ? { origin } : undefined), messages = [];
  ws.on('message', data => messages.push(JSON.parse(data.toString()))); ws.on('error', () => {});
  await new Promise((resolve, reject) => { ws.once('open', resolve); ws.once('error', reject); });
  ws.send(JSON.stringify({ type: 'hello', version: W.VERSION, name: 'Testovací hráč', classId: 'warrior', ...hello }));
  return { ws, messages, send: message => ws.send(JSON.stringify(message)), async wait(predicate) {
    const end = Date.now() + 3500;
    while (Date.now() < end) { const result = messages.find(predicate); if (result) return result; await delay(15); }
    throw Error('Timed out waiting for server message');
  } };
}
test('HTTP serves only game assets and rejects foreign browser origins', async t => {
  const game = createWorldServer({ dbPath: ':memory:' }); t.after(() => game.close());
  const address = await game.listen(0); const base = `http://127.0.0.1:${address.port}`;
  const response = await fetch(base); assert.equal(response.status, 200); assert((await response.text()).includes('Kroniky trhliny'));
  assert((await fetch(base + '/health')).ok);
  for (const file of ['/server/data/world.sqlite', '/%2e%2e%2fpackage.json', '/vendor/../../../package.json', '/missing.js']) assert.equal((await fetch(base + file)).status, 404);
  await assert.rejects(peer(base.replace('http:', 'ws:') + '/world', {}, 'https://unrelated.example'), /403/);
  const invalid = await peer(base.replace('http:', 'ws:') + '/world', { classId: 'constructor' });
  assert.equal((await invalid.wait(m => m.type === 'error')).type, 'error'); invalid.ws.close();
});
test('two clients share combat, ignore forged stats, resume saved profiles and stop stale input', async t => {
  const folder = fs.mkdtempSync(path.join(os.tmpdir(), 'rift-world-')), dbPath = path.join(folder, 'world.sqlite');
  let game = createWorldServer({ dbPath });
  t.after(async () => { await game.close(); fs.rmSync(folder, { recursive: true, force: true }); });
  let address = await game.listen(0); let url = `ws://127.0.0.1:${address.port}/world`;
  const first = await peer(url, { name: 'První strážce' }), second = await peer(url, { name: 'Druhý strážce' });
  const welcome = await first.wait(m => m.type === 'welcome'), other = await second.wait(m => m.type === 'welcome');
  assert.match(welcome.token, /^[a-f0-9]{64}$/);
  const visible = await first.wait(m => m.type === 'snapshot' && m.population === 2);
  assert(visible.players.some(p => p.id === other.id)); assert(!JSON.stringify(visible).includes(welcome.token));
  first.send({ type: 'input', dx: 1, dz: 0, x: 200, hp: 99999, gold: 99999, level: 30, bag: [] });
  const moved = await first.wait(m => m.type === 'snapshot' && m.self.x > .5);
  assert(moved.self.x < 20); assert.equal(moved.self.level, 1); assert.equal(moved.self.gold, 120); assert.equal(moved.self.maxHp, 180);
  await delay(1100); const stoppedAt = game.world.players.get(welcome.id).x; await delay(300);
  assert.equal(game.world.players.get(welcome.id).x, stoppedAt);
  const enemy = game.world.enemies[0], actor = game.world.players.get(welcome.id), ally = game.world.players.get(other.id);
  actor.x = ally.x = enemy.x; actor.z = enemy.z - 1; ally.z = enemy.z - 2;
  const hp = enemy.hp;
  first.send({ type: 'input', dx: 0, dz: 0, targetId: enemy.id, attack: true });
  const hit = await second.wait(m => m.type === 'snapshot' && m.enemies.some(e => e.id === enemy.id && e.hp < hp));
  assert(hit.enemies.find(e => e.id === enemy.id).hp < hp);
  enemy.hp = 1; actor.attackAt = 0;
  const defeated = await first.wait(m => m.type === 'snapshot' && m.self.kills > 0);
  assert(defeated.self.gold > 120); first.send({ type: 'input' });
  first.send({ type: 'chat', text: '<script>test</script>' });
  const chat = await second.wait(m => m.type === 'chat'); assert.equal(chat.text, '<script>test</script>');
  first.send({ type: 'action', action: { type: 'dash' } });
  await first.wait(m => m.type === 'snapshot' && m.self.dashAt > m.time + 2);
  first.ws.close(); second.ws.close(); await delay(80); await game.close();
  game = createWorldServer({ dbPath }); address = await game.listen(0); url = `ws://127.0.0.1:${address.port}/world`;
  const bad = await peer(url, { id: welcome.id, token: '0'.repeat(64) }); assert.match((await bad.wait(m => m.type === 'error')).message, /platný/); bad.ws.close();
  const resumed = await peer(url, { id: welcome.id, token: welcome.token });
  const restored = await resumed.wait(m => m.type === 'snapshot');
  assert.equal(restored.self.name, 'První strážce'); assert(restored.self.kills >= 1); assert(restored.self.gold > 120);
  assert(restored.self.dashAt > restored.time, 'reconnecting must not reset active cooldowns');
  const duplicate = await peer(url, { id: welcome.id, token: welcome.token }); assert.match((await duplicate.wait(m => m.type === 'error')).message, /připojená/); duplicate.ws.close(); resumed.ws.close();
});
