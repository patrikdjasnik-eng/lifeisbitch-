const W = globalThis.FantasyWorld;
const $ = id => document.getElementById(id);
const keys = new Set();
let renderer, world, playerId, socket, state, mode = 'offline', classId = 'warrior';
let targetId = null, destination = null, autoAttack = false, pendingNpc = null;
let savedCharacter = null, credentials = null, lastEventId = 0, lastSnapshotAt = 0, toastTimer, currentPanel = null;
let accumulator = 0, lastSimulation = performance.now(), lastFrame = performance.now(), hudAt = 0, drawAt = 0, saving = false, storageAvailable = true, inventorySignature = '';
window.started = false; window.paused = false; window.dialogOpen = false;

const storage = (() => {
  let database;
  const open = () => database ||= new Promise((resolve, reject) => {
    const request = indexedDB.open('rift-chronicles-v1', 1);
    request.onupgradeneeded = () => request.result.createObjectStore('saves');
    request.onsuccess = () => resolve(request.result); request.onerror = () => reject(request.error);
  });
  return {
    async get(key) {
      try {
        const db = await open(); return await new Promise((resolve, reject) => { const request = db.transaction('saves').objectStore('saves').get(key); request.onsuccess = () => resolve(request.result); request.onerror = () => reject(request.error); });
      } catch {
        try { return JSON.parse(localStorage.getItem('rift-' + key) || 'null'); } catch { storageAvailable = false; return null; }
      }
    },
    async put(key, value) {
      try {
        const db = await open(); await new Promise((resolve, reject) => { const transaction = db.transaction('saves', 'readwrite'); transaction.objectStore('saves').put(value, key); transaction.oncomplete = resolve; transaction.onerror = () => reject(transaction.error); transaction.onabort = () => reject(transaction.error); });
      } catch {
        try { localStorage.setItem('rift-' + key, JSON.stringify(value)); } catch { storageAvailable = false; throw Error('Ukládání je v tomto prohlížeči zablokované.'); }
      }
    }
  };
})();
function log(text, name) {
  const line = document.createElement('p');
  if (name) { const sender = document.createElement('b'); sender.textContent = name + ': '; line.append(sender); }
  else line.className = 'system';
  line.append(document.createTextNode(text)); $('chatLog').append(line);
  while ($('chatLog').childElementCount > 45) $('chatLog').firstChild.remove();
  $('chatLog').scrollTop = $('chatLog').scrollHeight;
}
function toast(text) { $('toast').textContent = text; $('toast').hidden = false; clearTimeout(toastTimer); toastTimer = setTimeout(() => { $('toast').hidden = true; }, 3600); }
function make(tag, text, className) { const element = document.createElement(tag); if (text !== undefined) element.textContent = text; if (className) element.className = className; return element; }
function button(text, handler, primary = false) { const element = make('button', text, primary ? 'primary' : 'action'); element.type = 'button'; element.addEventListener('click', handler); return element; }
function self() { return state?.self; }
function applySnapshot(snapshot) {
  if (!snapshot?.self) return;
  state = snapshot; lastSnapshotAt = performance.now();
  if (snapshot.self.hp <= 0) { targetId = null; autoAttack = false; destination = null; pendingNpc = null; keys.clear(); }
  for (const event of snapshot.events) if (event.type === 'notice') { log(event.text); toast(event.text); }
  if (targetId && !W.NPCS.some(npc => npc.id === targetId) && !snapshot.enemies.some(enemy => enemy.id === targetId && enemy.hp > 0)) { targetId = null; autoAttack = false; }
  renderer.sync(snapshot, targetId);
  if (currentPanel === 'inventory') renderInventory();
}
function action(type, extra = {}) {
  if (!window.started || window.paused || !state) return;
  const payload = { type, ...extra };
  if (mode === 'online') {
    if (socket?.readyState === WebSocket.OPEN) socket.send(JSON.stringify({ type: 'action', action: payload }));
  } else {
    const accepted = W.act(world, playerId, payload);
    if (!accepted && ['skill', 'potion'].includes(type)) toast(type === 'skill' ? 'Přibliž se k cíli mimo útočiště a ověř manu i obnovu schopnosti.' : 'Lektvar použiješ, když ti chybí zdraví.');
    updateOffline(); saveOffline();
  }
}
function updateOffline() { const snapshot = W.snapshot(world, playerId, lastEventId); lastEventId = world.eventId; applySnapshot(snapshot); }
function input() {
  if (!window.started || window.paused || self()?.hp <= 0 || $('panel').open || document.activeElement === $('chatInput') || document.hidden) return { dx: 0, dz: 0, attack: false, sprint: false, targetId: null, destination: null };
  let x = Number(keys.has('d') || keys.has('arrowright')) - Number(keys.has('a') || keys.has('arrowleft'));
  let z = Number(keys.has('s') || keys.has('arrowdown')) - Number(keys.has('w') || keys.has('arrowup'));
  const yaw = renderer.yaw, dx = x * Math.cos(yaw) + z * Math.sin(yaw), dz = z * Math.cos(yaw) - x * Math.sin(yaw);
  if (x || z) { destination = null; pendingNpc = null; autoAttack = false; }
  return { dx, dz, attack: autoAttack || keys.has(' '), sprint: keys.has('shift'), targetId, destination };
}
function sendInput() { if (mode === 'online' && socket?.readyState === WebSocket.OPEN && window.started) socket.send(JSON.stringify({ type: 'input', ...input() })); }
async function saveOffline() {
  if (!world || mode !== 'offline' || saving) return;
  saving = true;
  try { savedCharacter = { ...W.serializeCharacter(world.players.get(playerId)), savedAt: Date.now() }; await storage.put('offline', savedCharacter); $('saveStatus').textContent = 'Uloženo v zařízení'; }
  catch (error) { $('saveStatus').textContent = 'Uložení selhalo'; toast(error.message); }
  finally { saving = false; }
}
function defaultServer() {
  if (location.hostname === 'appassets.androidplatform.net') return '';
  return ['http:', 'https:'].includes(location.protocol) ? `${location.protocol === 'https:' ? 'wss:' : 'ws:'}//${location.host}/world` : 'ws://127.0.0.1:8790/world';
}
function parseServer(value) {
  const url = new URL(value);
  if (!['ws:', 'wss:'].includes(url.protocol) || url.username || url.password || url.search || url.hash) throw Error('Použij adresu ws:// nebo wss:// bez hesla a parametrů.');
  const local = ['127.0.0.1', 'localhost', '[::1]'].includes(url.hostname);
  if (url.protocol === 'ws:' && !local && location.protocol === 'https:') throw Error('Na zabezpečené stránce použij server s adresou wss://.');
  if (url.pathname === '/') url.pathname = '/world';
  return url.href;
}
async function connect(url, name, selectedClass) {
  const serverKey = 'online:' + url;
  credentials = await storage.get(serverKey);
  await new Promise((resolve, reject) => {
    let welcomed = false, settled = false, failure = 'Server není dostupný. Spusť npm start nebo zvol samostatné dobrodružství.';
    const ws = new WebSocket(url); socket = ws;
    const timeout = setTimeout(() => { ws.close(); if (!settled) { settled = true; reject(Error('Server neodpověděl včas.')); } }, 9000);
    ws.addEventListener('open', () => ws.send(JSON.stringify({ type: 'hello', version: W.VERSION, name, classId: selectedClass, ...(credentials ? { id: credentials.id, token: credentials.token } : {}) })));
    ws.addEventListener('message', async event => {
      let message;
      try { message = JSON.parse(event.data); } catch { return; }
      if (message.type === 'error') { failure = message.message; if (!settled) { settled = true; clearTimeout(timeout); reject(Error(failure)); } return; }
      if (message.type === 'welcome') {
        playerId = message.id; welcomed = true;
        if (message.token) {
          credentials = { id: message.id, token: message.token };
          try { await storage.put(serverKey, credentials); } catch { toast('Klíč online postavy se nepodařilo uložit. Po zavření ji nemusíš obnovit.'); }
        }
      }
      if (message.type === 'snapshot' && welcomed) {
        applySnapshot(message);
        if (!settled) { settled = true; clearTimeout(timeout); resolve(); }
      }
      if (message.type === 'chat') log(message.text, message.name);
    });
    ws.addEventListener('close', () => {
      clearTimeout(timeout);
      if (!settled) { settled = true; reject(Error(failure)); }
      else if (window.started && mode === 'online' && socket === ws) {
        $('connection').textContent = 'Spojení přerušeno'; $('connection').className = 'connection lost';
        openPanel('disconnect', 'Spojení se světem se přerušilo');
        $('panelBody').append(make('p', 'Postava zůstává uložená na serveru. Vrať se do výběru a připoj se znovu stejným prohlížečem.'), button('Zpět k postavě', leaveGame, true));
      }
    });
    ws.addEventListener('error', () => { /* Close reports the actionable error. */ });
  });
}
async function start(event) {
  event.preventDefault(); $('menuStatus').textContent = ''; $('start').disabled = true;
  try {
    const name = $('characterName').value;
    if (!W.validName(name)) throw Error('Jméno musí mít 3–24 znaků. Použij písmena, číslice, mezeru nebo pomlčku.');
    mode = new FormData($('characterForm')).get('mode');
    classId = new FormData($('characterForm')).get('classId');
    lastEventId = 0; targetId = null; destination = null; autoAttack = false; pendingNpc = null; keys.clear();
    if (mode === 'online') {
      const url = parseServer($('serverUrl').value); await storage.put('server', url); $('menuStatus').textContent = 'Připojuji se do světa…';
      await connect(url, name, classId);
    } else {
      world = W.createWorld();
      const restored = savedCharacter && W.restoreCharacter(savedCharacter);
      const player = restored || W.createCharacter(crypto.randomUUID?.() || 'offline-' + Date.now(), name, classId);
      playerId = player.id; W.addPlayer(world, player); updateOffline();
    }
    classId = self().classId;
    $('menu').hidden = true; $('hud').hidden = false; window.started = true; window.paused = false;
    $('chatForm').hidden = mode !== 'online';
    $('connection').textContent = mode === 'online' ? 'Online svět · připojeno' : 'Samostatné dobrodružství'; $('connection').className = 'connection' + (mode === 'online' ? ' online' : '');
    $('saveStatus').textContent = mode === 'online' ? 'Postava na serveru' : storageAvailable ? 'Automatické ukládání' : 'Ukládání nedostupné';
    log('Vítej v Útočišti úsvitu. Vyhledej mistryni Airu a přijmi první úkol.');
    if (mode === 'online') log('Sdílený svět běží i při otevřeném menu. Postava se ukládá na tomto serveru.');
    renderHud(); saveOffline();
  } catch (error) { $('menuStatus').textContent = error.message; if (socket && !window.started) { socket.close(); socket = null; } }
  finally { $('start').disabled = false; }
}
async function leaveGame() {
  await saveOffline(); window.started = false; window.paused = false; keys.clear(); autoAttack = false; destination = null;
  const old = socket; socket = null; old?.close(); world = null; state = null;
  closePanel(); $('hud').hidden = true; $('menu').hidden = false; $('menuStatus').textContent = ''; await loadMenu();
}
function selectTarget(pick) {
  if (!window.started || window.paused || $('panel').open) return;
  if (pick.id === playerId) return;
  const npc = W.NPCS.find(entry => entry.id === pick.id);
  if (npc) {
    targetId = npc.id; autoAttack = false;
    if (W.distance(self(), npc) < 5) showNpc(npc);
    else { destination = { x: npc.x, z: npc.z + 2 }; pendingNpc = npc.id; }
  } else if (pick.id && state.enemies.some(enemy => enemy.id === pick.id && enemy.hp > 0)) { targetId = pick.id; autoAttack = true; destination = null; pendingNpc = null; }
  else if (Number.isFinite(pick.x)) { targetId = null; destination = pick; autoAttack = false; pendingNpc = null; }
}
function nearestNpc() { return self() && W.NPCS.filter(npc => W.distance(npc, self()) < 5).sort((a, b) => W.distance(a, self()) - W.distance(b, self()))[0]; }
function interact() { const npc = nearestNpc(); if (npc) showNpc(npc); else toast('Přibliž se k postavě v útočišti.'); }
function openPanel(kind, title) {
  currentPanel = kind; keys.clear(); pendingNpc = null; autoAttack = false; destination = null;
  $('panelTitle').textContent = title; $('panelBody').replaceChildren(); $('panelEyebrow').textContent = 'KRONIKY TRHLINY';
  window.dialogOpen = true; if (!$('panel').open) $('panel').showModal(); sendInput();
}
function closePanel() { if ($('panel').open) $('panel').close(); currentPanel = null; window.dialogOpen = false; window.paused = false; }
function showNpc(npc) {
  if (!self() || W.distance(self(), npc) >= 5) return;
  openPanel(npc.id, npc.name); $('panelEyebrow').textContent = npc.role.toUpperCase();
  const body = $('panelBody');
  if (npc.kind === 'quest') {
    const quest = W.QUESTS[self().questIndex];
    if (!quest) { body.append(make('p', 'Údolí si bude pamatovat tvé jméno. Prozkoumej Stříbrné vrchy a najdi Varkha v Srdci trhliny.')); return; }
    body.append(make('h3', quest.name), make('p', quest.text), make('p', `Odměna: ${quest.xp} XP · ${quest.gold} zlatých`));
    if (!self().questActive) body.append(button('Přijmout úkol', () => { action('quest'); closePanel(); }, true));
    else if (self().questProgress >= quest.count) body.append(button('Dokončit úkol', () => { action('quest'); closePanel(); }, true));
    else body.append(make('p', `Postup: ${self().questProgress} / ${quest.count}. Vrať se, až bude tvá práce hotová.`));
  } else if (npc.kind === 'merchant') {
    body.append(make('p', 'Ostrá čepel tě zachrání jednou. Zásoba lektvarů i podruhé.'), button('Léčivý lektvar · 35 zlatých', () => { if (self().gold < 35) toast('Nemáš dost zlata.'); else action('buyPotion'); }), button('Otevřít výbavu a prodat kořist', showInventory));
  } else body.append(make('p', 'Světlo úsvitu uzdraví tělo i mysl. V bezpečí útočiště se zdraví také postupně obnovuje.'), button('Obnovit zdraví a manu · 20 zlatých', () => { if (self().gold < 20) toast('Nemáš dost zlata.'); else action('heal'); closePanel(); }, true));
}
function showInventory() { if (!self()) return; inventorySignature = ''; openPanel('inventory', 'Výbava poutníka'); renderInventory(); }
function renderInventory() {
  if (currentPanel !== 'inventory' || !self()) return;
  const signature = JSON.stringify([self().gear, self().bag, self().gold, self().level]);
  if (inventorySignature === signature) return;
  inventorySignature = signature;
  const active = document.activeElement?.dataset.uid;
  const body = $('panelBody'), p = self(); body.replaceChildren();
  const attributes = make('dl');
  for (const [name, value] of [['Povolání', W.CLASSES[p.classId].name], ['Úroveň', p.level], ['Útok', p.attack], ['Obrana', Math.round(p.defense)], ['Zlato', p.gold], ['Inventář', `${p.bag.length} / ${W.MAX_BAG}`]]) attributes.append(make('dt', name), make('dd', String(value)));
  body.append(attributes); const list = make('div', undefined, 'item-list');
  for (const entry of p.bag) {
    const item = W.ITEMS[entry.typeId], equipped = Object.values(p.gear).includes(entry.uid), card = make('article', undefined, 'item ' + item.rarity);
    card.append(make('strong', item.name), make('p', `Úroveň ${item.level}${item.attack ? ' · +' + item.attack + ' útok' : ''}${item.defense ? ' · +' + item.defense + ' obrana' : ''}${item.hp ? ' · +' + item.hp + ' zdraví' : ''}`));
    if (equipped) card.append(make('small', '◆ Nasazeno'));
    else {
      const equip = button('Nasadit', () => action('equip', { uid: entry.uid })); equip.dataset.uid = entry.uid;
      equip.disabled = item.level > p.level || !!item.classId && item.classId !== p.classId; card.append(equip);
      if (W.distance(p, W.NPCS[1]) < 5) card.append(button(`Prodat · ${item.rarity === 'rare' ? 75 : 20}`, () => action('sell', { uid: entry.uid })));
    }
    list.append(card);
  }
  body.append(list, make('p', 'Novou výbavu získáš z nepřátel a kamenů trhliny. Nepotřebné předměty vykupuje Ren v útočišti.'));
  if (active) [...list.querySelectorAll('button')].find(element => element.dataset.uid === active)?.focus({ preventScroll: true });
}
function showQuests() {
  if (!self()) return; openPanel('quests', 'Cesta hrdiny'); const body = $('panelBody'), p = self();
  W.QUESTS.forEach((quest, index) => { body.append(make('h3', `${index < p.questIndex ? '◆ ' : ''}${quest.name}`), make('p', index < p.questIndex ? 'Dokončeno' : index === p.questIndex ? quest.text : 'Odemkne se po předchozím úkolu.'), make('p', `${quest.xp} XP · ${quest.gold} zlatých`)); });
  body.append(make('p', 'Úkoly přijímá a odměňuje mistryně Aira v Útočišti úsvitu.'));
}
function drawMap(canvas, full = false) {
  if (!self()) return;
  const context = canvas.getContext('2d'), size = canvas.width, p = self(), scale = full ? size / 500 : size / 125;
  const cx = full ? 0 : p.x, cz = full ? 0 : p.z, point = (x, z) => [(x - cx) * scale + size / 2, (z - cz) * scale + size / 2];
  context.fillStyle = '#465649'; context.fillRect(0, 0, size, size);
  for (const zone of W.ZONES.slice(1)) { const [x, z] = point(zone.x, zone.z); context.beginPath(); context.arc(x, z, zone.radius * scale, 0, Math.PI * 2); context.fillStyle = { valley: '#687358', forest: '#2e5044', ruins: '#7a7d6d', frost: '#899d99', rift: '#645969' }[zone.id]; context.fill(); }
  context.strokeStyle = '#7ba6aa'; context.lineWidth = 7 * scale; context.beginPath(); for (let x = -250; x <= 250; x += 5) { const [px, pz] = point(x, W.riverZ(x)); x === -250 ? context.moveTo(px, pz) : context.lineTo(px, pz); } context.stroke();
  context.fillStyle = '#718566'; for (const tree of W.DECOR.trees) { const [x, z] = point(tree.x, tree.z); if (x >= 0 && z >= 0 && x < size && z < size) context.fillRect(x, z, full ? 1.4 : 2, full ? 1.4 : 2); }
  const [sx, sz] = point(0, 0); context.beginPath(); context.arc(sx, sz, 16 * scale, 0, Math.PI * 2); context.fillStyle = '#b0aa80'; context.fill(); context.strokeStyle = '#d9cba0'; context.lineWidth = 1; context.stroke();
  for (const npc of W.NPCS) { const [x, z] = point(npc.x, npc.z); context.fillStyle = '#f6d68d'; context.fillRect(x - 1.5, z - 1.5, 3, 3); }
  for (const enemy of state.enemies) if (enemy.hp > 0) { const [x, z] = point(enemy.x, enemy.z); context.fillStyle = enemy.kind === 'shard' ? '#d3a0dd' : '#d69a89'; context.beginPath(); context.arc(x, z, enemy.kind === 'warden' ? 4 : 1.6, 0, Math.PI * 2); context.fill(); }
  for (const other of state.players) if (other.id !== playerId) { const [x, z] = point(other.x, other.z); context.fillStyle = '#b2d3ed'; context.fillRect(x - 2, z - 2, 4, 4); }
  if (full) {
    context.textAlign = 'center'; context.font = `${Math.max(10, size / 50)}px Georgia`;
    for (const zone of W.ZONES) { const [x, z] = point(zone.x, zone.z); context.fillStyle = '#eee6cb'; context.shadowColor = '#162126'; context.shadowBlur = 4; context.fillText(zone.name, x, z - 9); context.fillStyle = '#c4d2c5'; context.font = `${Math.max(8, size / 62)}px Arial`; context.fillText(zone.level, x, z + 5); context.font = `${Math.max(10, size / 50)}px Georgia`; } context.shadowBlur = 0;
  }
  const [px, pz] = point(p.x, p.z); context.save(); context.translate(px, pz); context.rotate(-p.angle); context.fillStyle = '#fff1c1'; context.strokeStyle = '#34433d'; context.lineWidth = 1;
  context.beginPath(); context.moveTo(0, 6); context.lineTo(-4, -4); context.lineTo(0, -2); context.lineTo(4, -4); context.closePath(); context.fill(); context.stroke(); context.restore();
}
function showMap() { if (!self()) return; openPanel('map', 'Země za trhlinou'); const canvas = make('canvas', undefined, 'map-canvas'); canvas.width = canvas.height = 600; $('panelBody').append(canvas, make('p', 'Zlatá: ty a útočiště · Modrá: hráči · Červená: blízcí nepřátelé · Fialová: kameny trhliny. Sever je nahoře.')); drawMap(canvas, true); }
function showSettings() {
  if (!window.started) return;
  openPanel('settings', 'Chvíle u táborového ohně'); window.paused = true;
  const body = $('panelBody'); body.append(make('p', mode === 'online' ? 'Online svět pokračuje i při otevřeném menu. Pro odpočinek se vrať do bezpečí útočiště.' : 'Dobrodružství je pozastavené. Postup se ukládá do tohoto zařízení.'));
  const row = make('label', undefined, 'settings-row'), checkbox = document.createElement('input'); checkbox.type = 'checkbox'; checkbox.checked = !renderer.renderer.shadowMap.enabled;
  checkbox.addEventListener('change', () => { renderer.setQuality(checkbox.checked); storage.put('lowQuality', checkbox.checked).catch(() => {}); }); row.append(checkbox, document.createTextNode('Úsporná grafika · nižší rozlišení a bez stínů')); body.append(row);
  body.append(make('p', 'WASD / šipky: pohyb · Shift: běh · levé kliknutí: cíl nebo cesta · pravé tažení: kamera · kolečko: přiblížení · mezerník: útok · Q: schopnost · R: úskok · 1: lektvar · E: rozhovor · I: inventář · J: úkoly · M: mapa · Enter: chat.'), button('Pokračovat', closePanel, true), button('Uložit a vrátit se k postavě', leaveGame));
}
function renderHud() {
  const p = self(); if (!p) return;
  $('heroName').textContent = p.name; $('heroClass').textContent = W.CLASSES[p.classId].name.toUpperCase(); $('level').textContent = p.level;
  for (const [key, value, max] of [['hp', p.hp, p.maxHp], ['mana', p.mana, p.maxMana]]) { $(key + 'Fill').style.transform = `scaleX(${Math.max(0, value / max)})`; $(key + 'Text').textContent = `${Math.ceil(value)} / ${max}`; }
  $('staminaFill').style.transform = `scaleX(${p.stamina / 100})`; $('xpFill').style.transform = `scaleX(${p.xp / W.xpForLevel(p.level)})`;
  $('gold').textContent = `${p.gold.toLocaleString('cs')} zlatých`; $('potionCount').textContent = `${p.potions} lektvarů`; $('skillName').textContent = W.CLASSES[p.classId].skill;
  $('attackButton').classList.toggle('active', autoAttack || keys.has(' '));
  for (const [name, field] of [['skill', 'skillAt'], ['dash', 'dashAt'], ['potion', 'potionAt']]) { const remaining = Math.ceil(p[field] - state.time); $(name + 'Cooldown').textContent = remaining > 0 ? remaining : ''; }
  const zone = W.zoneAt(p.x, p.z); $('zoneName').textContent = zone.name; $('zoneLevel').textContent = zone.level; $('coordinates').textContent = `${Math.round(p.x)} : ${Math.round(p.z)}`;
  const target = state.enemies.find(enemy => enemy.id === targetId && enemy.hp > 0); $('targetPanel').hidden = !target;
  if (target) { $('targetName').textContent = `Lv. ${target.level} · ${target.name}`; $('targetFill').style.transform = `scaleX(${target.hp / target.maxHp})`; $('targetText').textContent = `${Math.ceil(target.hp)} / ${target.maxHp}`; }
  const quest = W.QUESTS[p.questIndex]; $('questName').textContent = quest ? quest.name : 'Za hranice známého světa';
  $('questText').textContent = quest ? p.questActive ? quest.text : 'Promluv s mistryní Airou v útočišti.' : 'Najdi Varkha v Srdci trhliny a poraz strážce.';
  $('questProgress').textContent = quest && p.questActive ? `${p.questProgress} / ${quest.count}${p.questProgress >= quest.count ? ' · Vrať se k Aiře' : ''}` : '';
  const npc = nearestNpc(); $('interaction').hidden = !npc || $('panel').open;
  if (npc) $('interactionText').textContent = `Promluvit · ${npc.name}`;
  if (pendingNpc && npc?.id === pendingNpc && !window.paused) { pendingNpc = null; showNpc(npc); }
  $('death').hidden = p.hp > 0;
  if (p.hp <= 0) $('deathText').textContent = `Návrat do útočiště za ${Math.max(1, Math.ceil(p.deadUntil - state.time))} s · Ztráta 5 % zlata`;
  if (mode === 'online' && socket?.readyState === WebSocket.OPEN) { const stale = performance.now() - lastSnapshotAt > 1800; $('connection').textContent = stale ? 'Čekám na server…' : `Online svět · ${state.population} ${state.population === 1 ? 'hráč' : 'hráčů'}`; $('connection').className = stale ? 'connection lost' : 'connection online'; }
  drawMap($('minimap')); if (currentPanel === 'map') drawMap($('panelBody').querySelector('canvas'), true);
}
async function loadMenu() {
  savedCharacter = await storage.get('offline');
  try { const backup = JSON.parse(localStorage.getItem('rift-offline') || 'null'); if (backup?.savedAt > (savedCharacter?.savedAt || 0)) savedCharacter = backup; } catch { /* IndexedDB remains the primary save. */ }
  if (savedCharacter && !W.restoreCharacter(savedCharacter)) savedCharacter = null;
  if (savedCharacter) { $('characterName').value = savedCharacter.name; $('characterForm').elements.classId.value = savedCharacter.classId; $('start').firstChild.textContent = 'POKRAČOVAT V DOBRODRUŽSTVÍ '; }
  else $('start').firstChild.textContent = 'VSTOUPIT DO SVĚTA ';
  $('newCharacter').hidden = !savedCharacter;
  classId = $('characterForm').elements.classId.value; $('classDescription').textContent = W.CLASSES[classId].description;
  $('characterForm').dispatchEvent(new Event('change'));
}
$('characterForm').addEventListener('submit', start);
$('characterForm').addEventListener('change', () => {
  classId = $('characterForm').elements.classId.value; $('classDescription').textContent = W.CLASSES[classId].description;
  const online = $('characterForm').elements.mode.value === 'online'; $('serverRow').hidden = !online;
  $('characterName').readOnly = !!savedCharacter && !online;
  for (const radio of $('characterForm').querySelectorAll('[name="classId"]')) radio.disabled = !!savedCharacter && !online;
  $('start').firstChild.textContent = online ? 'PŘIPOJIT DO SVĚTA ' : savedCharacter ? 'POKRAČOVAT V DOBRODRUŽSTVÍ ' : 'VSTOUPIT DO SVĚTA ';
});
$('newCharacter').addEventListener('click', () => {
  openPanel('new', 'Nová cesta'); $('panelBody').append(make('p', 'Vytvořením nové offline postavy přepíšeš stávající offline dobrodružství v tomto zařízení. Online postavy na serverech zůstanou zachované.'), button('Zrušit', closePanel), button('Smazat offline postup a vytvořit postavu', async () => { try { await storage.put('offline', null); try { localStorage.removeItem('rift-offline'); } catch {} savedCharacter = null; closePanel(); await loadMenu(); $('characterForm').dispatchEvent(new Event('change')); } catch (error) { toast(error.message); } }));
});
for (const [id, handler] of Object.entries({ inventoryButton: showInventory, questButton: showQuests, mapButton: showMap, minimapButton: showMap, pause: showSettings, closePanel, touchInteract: interact, retry: () => location.reload(), skillButton: () => action('skill'), dashButton: () => action('dash'), potionButton: () => action('potion'), attackButton: () => { autoAttack = !autoAttack; destination = null; } })) $(id).addEventListener('click', handler);
$('panel').addEventListener('cancel', event => { event.preventDefault(); closePanel(); });
$('chatForm').addEventListener('submit', event => { event.preventDefault(); const text = $('chatInput').value.trim(); if (text && socket?.readyState === WebSocket.OPEN) socket.send(JSON.stringify({ type: 'chat', text })); $('chatInput').value = ''; $('chatInput').blur(); });
addEventListener('keydown', event => {
  if (!window.started || event.ctrlKey || event.metaKey || event.altKey) return;
  const key = event.key.toLowerCase();
  if (event.target instanceof HTMLInputElement) { if (key === 'escape') event.target.blur(); return; }
  if ([' ', 'arrowup', 'arrowdown', 'arrowleft', 'arrowright', 'tab'].includes(key)) event.preventDefault();
  if (key === 'escape') { $('panel').open ? closePanel() : showSettings(); return; }
  if ($('panel').open) return;
  keys.add(key); if (event.repeat) return;
  const handlers = { q: () => action('skill'), r: () => action('dash'), '1': () => action('potion'), i: showInventory, j: showQuests, m: showMap, e: interact, enter: () => { if (mode === 'online') $('chatInput').focus(); }, tab: () => { const nearest = state.enemies.filter(enemy => enemy.hp > 0 && W.distance(enemy, self()) < 25).sort((a, b) => W.distance(a, self()) - W.distance(b, self()))[0]; if (nearest) targetId = nearest.id; } };
  handlers[key]?.();
});
addEventListener('keyup', event => keys.delete(event.key.toLowerCase()));
addEventListener('error', event => {
  if (!window.started || !event.error) return;
  keys.clear(); autoAttack = false; destination = null; saveOffline(); window.started = false;
  socket?.close(); $('fatal').hidden = false; $('fatalText').textContent = 'Hra se zastavila: ' + event.error.message + '. Zkus ji znovu načíst.';
});
addEventListener('blur', () => { keys.clear(); autoAttack = false; destination = null; sendInput(); if (window.started && !$('panel').open && mode === 'offline') showSettings(); saveOffline(); });
addEventListener('pagehide', () => { if (world && mode === 'offline') { try { localStorage.setItem('rift-offline', JSON.stringify({ ...W.serializeCharacter(world.players.get(playerId)), savedAt: Date.now() })); } catch { /* Periodic IndexedDB save remains available. */ } } });
document.addEventListener('visibilitychange', () => { keys.clear(); destination = null; autoAttack = false; sendInput(); if (document.hidden) saveOffline(); });
for (const control of document.querySelectorAll('[data-move]')) {
  control.addEventListener('pointerdown', event => { event.preventDefault(); control.setPointerCapture(event.pointerId); keys.add(control.dataset.move); });
  for (const type of ['pointerup', 'pointercancel', 'lostpointercapture']) control.addEventListener(type, () => keys.delete(control.dataset.move));
}
function frame(now) {
  const dt = Math.min(.1, (now - lastFrame) / 1000); lastFrame = now;
  const frameDelay = $('panel').open ? 200 : renderer?.lowQuality ? 1000 / 30 : 1000 / 60;
  if (renderer && !document.hidden && now - drawAt >= frameDelay) { renderer.render(Math.min(.1, (now - drawAt) / 1000), now / 1000); drawAt = now; }
  if (window.started && now - hudAt > 100) { renderHud(); hudAt = now; }
  requestAnimationFrame(frame);
}
async function initialize() {
  try {
    const { FantasyRenderer } = await import('./renderer3d.js'); renderer = new FantasyRenderer($('game'), selectTarget);
    const savedQuality = await storage.get('lowQuality');
    renderer.setQuality(new URLSearchParams(location.search).get('quality') === 'low' || (savedQuality ?? matchMedia('(pointer:coarse)').matches));
    $('serverUrl').value = await storage.get('server') || defaultServer(); await loadMenu(); $('characterForm').dispatchEvent(new Event('change'));
    $('loading').hidden = true; requestAnimationFrame(frame);
    setInterval(() => {
      const now = performance.now(), elapsed = Math.min(.25, (now - lastSimulation) / 1000); lastSimulation = now;
      if (window.started && mode === 'offline' && !window.paused && !document.hidden) {
        accumulator += elapsed; W.setInput(world, playerId, input());
        while (accumulator >= W.TICK) { W.tick(world); accumulator -= W.TICK; }
        updateOffline();
      } else accumulator = 0;
      sendInput();
    }, 50);
    setInterval(saveOffline, 5000);
    window.fantasyGame = Object.freeze({ inspect: () => ({ started: window.started, paused: window.paused, mode, snapshot: state, draws: renderer.renderer.info.render.calls }) });
  } catch (error) { $('loading').hidden = true; $('fatal').hidden = false; $('fatalText').textContent = `${error.message}. Ověř podporu WebGL 2 a hardwarovou akceleraci v prohlížeči. V desktopové verzi můžeš zkusit --safe-mode.`; console.error(error); }
}
initialize();
