const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const sqlite = require('node:sqlite');
const { WebSocketServer, WebSocket } = require('ws');
const World = require('../web/world.js');

const Database = sqlite.Database || sqlite.DatabaseSync;
const hash = value => crypto.createHash('sha256').update(value).digest('hex');
const mime = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.png': 'image/png', '.jpg': 'image/jpeg', '.svg': 'image/svg+xml', '.txt': 'text/plain; charset=utf-8', '.webp': 'image/webp' };

function createWorldServer(options = {}) {
  const dbPath = options.dbPath || process.env.WORLD_DB || path.join(__dirname, 'data', 'world.sqlite');
  if (dbPath !== ':memory:') fs.mkdirSync(path.dirname(dbPath), { recursive: true });
  const db = new Database(dbPath);
  db.exec('PRAGMA journal_mode=WAL; CREATE TABLE IF NOT EXISTS characters (id TEXT PRIMARY KEY, token_hash TEXT NOT NULL, profile TEXT NOT NULL, updated_at INTEGER NOT NULL)');
  const find = db.prepare('SELECT * FROM characters WHERE id = ?');
  const save = db.prepare('INSERT INTO characters VALUES (?, ?, ?, ?) ON CONFLICT(id) DO UPDATE SET profile=excluded.profile, updated_at=excluded.updated_at');
  const world = World.createWorld();
  const peers = new Map();
  const maxPlayers = options.maxPlayers || 128;
  const root = path.resolve(__dirname, '../web');
  const allowedOrigins = new Set(options.origins || (process.env.WORLD_ORIGINS || '').split(',').filter(Boolean));
  const headers = { 'X-Content-Type-Options': 'nosniff', 'Referrer-Policy': 'no-referrer', 'Content-Security-Policy': "default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data: blob:; connect-src 'self' ws: wss:; font-src 'self'; object-src 'none'; base-uri 'none'; frame-ancestors 'none'" };
  const server = http.createServer((request, response) => {
    if (!['GET', 'HEAD'].includes(request.method)) { response.writeHead(405, headers).end(); return; }
    let pathname;
    try { pathname = decodeURIComponent(new URL(request.url, 'http://local').pathname); }
    catch { response.writeHead(400, headers).end(); return; }
    if (pathname === '/health') {
      response.writeHead(200, { ...headers, 'Content-Type': 'application/json' }).end(JSON.stringify({ ok: true, version: World.VERSION, players: world.players.size })); return;
    }
    const file = path.resolve(root, '.' + (pathname === '/' ? '/index.html' : pathname));
    const relative = path.relative(root, file);
    if (!relative || relative.startsWith('..') || path.isAbsolute(relative) || !mime[path.extname(file)]) { response.writeHead(404, headers).end(); return; }
    fs.stat(file, (error, stat) => {
      if (error || !stat.isFile()) { response.writeHead(404, headers).end(); return; }
      response.writeHead(200, { ...headers, 'Content-Type': mime[path.extname(file)], 'Content-Length': stat.size, 'Cache-Control': 'no-cache' });
      if (request.method === 'HEAD') response.end();
      else fs.createReadStream(file).on('error', () => response.destroy()).pipe(response);
    });
  });
  const sockets = new WebSocketServer({ noServer: true, maxPayload: 4096, perMessageDeflate: false });
  server.on('upgrade', (request, socket, head) => {
    const origin = request.headers.origin;
    let validOrigin = !origin || origin === 'game://local' || origin === 'https://appassets.androidplatform.net' || allowedOrigins.has(origin);
    try { validOrigin ||= new URL(origin).host === request.headers.host; } catch { /* Non-browser clients may omit Origin. */ }
    const ipCount = [...peers.values()].filter(peer => peer.ip === request.socket.remoteAddress).length;
    if (request.url !== '/world' || !validOrigin || peers.size >= maxPlayers || ipCount >= 8) {
      socket.end('HTTP/1.1 403 Forbidden\r\nConnection: close\r\n\r\n'); return;
    }
    sockets.handleUpgrade(request, socket, head, ws => sockets.emit('connection', ws, request));
  });

  function send(ws, message) {
    if (ws.readyState !== WebSocket.OPEN) return;
    if (ws.bufferedAmount > 512 * 1024) { ws.close(1013, 'Connection too slow'); return; }
    ws.send(JSON.stringify(message));
  }
  function persist(peer) {
    const player = peer.id && world.players.get(peer.id);
    if (player) {
      const now = Date.now(), profile = World.serializeCharacter(player);
      profile.serverTimers = Object.fromEntries(['attackAt', 'skillAt', 'dashAt', 'potionAt', 'deadUntil'].map(key => [key, now + Math.max(0, player[key] - world.time) * 1000]));
      profile.wasDead = player.hp <= 0;
      save.run(peer.id, peer.tokenHash, JSON.stringify(profile), now);
    }
  }
  function fail(ws, message) { send(ws, { type: 'error', message }); ws.close(1008, message.slice(0, 100)); }
  sockets.on('connection', (ws, request) => {
    const peer = { ip: request.socket.remoteAddress, id: null, lastEventId: 0, lastInput: Date.now(), alive: true, window: Date.now(), messages: 0, actions: 0, chats: 0, tokenHash: '' };
    peers.set(ws, peer);
    const joinTimeout = setTimeout(() => { if (!peer.id) fail(ws, 'Připojení vypršelo.'); }, 8000);
    ws.on('pong', () => { peer.alive = true; });
    ws.on('error', () => {});
    ws.on('message', raw => {
      try {
      const now = Date.now();
      if (now - peer.window >= 1000) { peer.window = now; peer.messages = peer.actions = peer.chats = 0; }
      if (++peer.messages > 50) { fail(ws, 'Příliš mnoho zpráv.'); return; }
      let message;
      try { message = JSON.parse(raw.toString()); } catch { fail(ws, 'Neplatná zpráva.'); return; }
      if (!message || typeof message !== 'object' || Array.isArray(message)) { fail(ws, 'Neplatná zpráva.'); return; }
      if (!peer.id) {
        if (message.type !== 'hello' || message.version !== World.VERSION) { fail(ws, 'Nekompatibilní verze hry.'); return; }
        let player, token, saved;
        if (message.id || message.token) {
          if (typeof message.id !== 'string' || typeof message.token !== 'string' || !/^[a-f0-9]{64}$/.test(message.token)) { fail(ws, 'Neplatný klíč postavy.'); return; }
          const row = find.get(message.id);
          if (!row || !crypto.timingSafeEqual(Buffer.from(row.token_hash, 'hex'), Buffer.from(hash(message.token), 'hex'))) { fail(ws, 'Klíč postavy není platný.'); return; }
          if (world.players.has(row.id)) { fail(ws, 'Tato postava už je připojená.'); return; }
          saved = JSON.parse(row.profile);
          player = World.restoreCharacter(saved, row.id);
          if (!player) { fail(ws, 'Uloženou postavu nelze načíst. Kontaktuj správce serveru.'); return; }
          peer.tokenHash = row.token_hash;
        } else {
          if (!World.validName(message.name) || !Object.hasOwn(World.CLASSES, message.classId)) { fail(ws, 'Vyplň jméno (3–24 znaků) a povolání.'); return; }
          const id = crypto.randomUUID();
          token = crypto.randomBytes(32).toString('hex'); peer.tokenHash = hash(token);
          player = World.createCharacter(id, message.name, message.classId);
        }
        peer.id = player.id; World.addPlayer(world, player); clearTimeout(joinTimeout);
        if (saved?.serverTimers) {
          for (const key of ['attackAt', 'skillAt', 'dashAt', 'potionAt', 'deadUntil']) {
            const remaining = Number(saved.serverTimers[key]) - Date.now();
            if (Number.isFinite(remaining) && remaining > 0) player[key] = world.time + Math.min(10000, remaining) / 1000;
          }
          if (saved.wasDead) {
            if (player.deadUntil > world.time) player.hp = 0;
            else { player.x = 0; player.z = 11; player.hp = World.stats(player).maxHp; player.mana = World.stats(player).maxMana; }
          }
        }
        persist(peer);
        send(ws, { type: 'welcome', id: player.id, token, version: World.VERSION });
        send(ws, { type: 'snapshot', ...World.snapshot(world, peer.id) });
        peer.lastEventId = world.eventId;
        return;
      }
      const player = world.players.get(peer.id);
      if (message.type === 'input') {
        World.setInput(world, peer.id, message); peer.lastInput = now;
      } else if (message.type === 'action' && ++peer.actions <= 8) {
        World.act(world, peer.id, message.action);
      } else if (message.type === 'chat' && ++peer.chats <= 2 && typeof message.text === 'string') {
        const text = message.text.replace(/[\x00-\x1f\x7f]/g, '').trim().slice(0, 160);
        if (text) for (const [other, receiver] of peers) if (receiver.id) send(other, { type: 'chat', name: player.name, text });
      }
      } catch (error) {
        console.error('World request failed:', error.message);
        fail(ws, 'Server nemohl dokončit požadavek.');
      }
    });
    ws.on('close', () => {
      clearTimeout(joinTimeout);
      try { persist(peer); } catch (error) { console.error('Character save failed:', error.message); }
      if (peer.id) world.players.delete(peer.id);
      peers.delete(ws);
    });
  });
  const simulation = setInterval(() => {
    for (const peer of peers.values()) if (peer.id && Date.now() - peer.lastInput > 800) World.setInput(world, peer.id, {});
    World.tick(world);
  }, 50);
  const snapshots = setInterval(() => {
    for (const [ws, peer] of peers) if (peer.id) {
      const snapshot = World.snapshot(world, peer.id, peer.lastEventId);
      send(ws, { type: 'snapshot', ...snapshot }); peer.lastEventId = world.eventId;
    }
  }, 100);
  const saves = setInterval(() => {
    for (const peer of peers.values()) try { persist(peer); } catch (error) { console.error('Character save failed:', error.message); }
  }, 15000);
  const heartbeat = setInterval(() => {
    for (const [ws, peer] of peers) {
      if (!peer.alive) { ws.terminate(); continue; }
      peer.alive = false; ws.ping();
    }
  }, 15000);
  let closing = false;
  return {
    server, world,
    listen(port = Number(process.env.PORT || 8790), host = process.env.HOST || '127.0.0.1') {
      return new Promise((resolve, reject) => {
        server.once('error', reject);
        server.listen(port, host, () => { server.removeListener('error', reject); resolve(server.address()); });
      });
    },
    async close() {
      if (closing) return; closing = true;
      [simulation, snapshots, saves, heartbeat].forEach(clearInterval);
      for (const [ws, peer] of peers) { persist(peer); ws.terminate(); }
      await new Promise(resolve => sockets.close(resolve));
      if (server.listening) await new Promise(resolve => server.close(resolve));
      db.close();
    }
  };
}
if (require.main === module) {
  const game = createWorldServer();
  game.listen().then(address => console.log(`Kroniky trhliny · http://${address.address}:${address.port}`)).catch(error => { console.error(error); process.exit(1); });
  for (const signal of ['SIGINT', 'SIGTERM']) process.once(signal, () => game.close().then(() => process.exit(0)));
}
module.exports = { createWorldServer };
