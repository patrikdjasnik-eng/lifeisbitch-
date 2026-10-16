(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.FantasyWorld = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  const VERSION = 1;
  const BOUNDS = 238;
  const SAFE_RADIUS = 17;
  const TICK = 1 / 20;
  const MAX_BAG = 24;
  const CLASSES = Object.freeze({
    warrior: { name: 'Strážce', title: 'Ocel a odvaha', hp: 160, mana: 90, attack: 23, range: 3.1, cooldown: .72, color: '#c77b42', skill: 'Kruh oceli', description: 'Meč, těžká zbroj a úder do všech blízkých nepřátel.' },
    ranger: { name: 'Lovec', title: 'Ticho před šípem', hp: 125, mana: 110, attack: 19, range: 13, cooldown: .68, color: '#739e78', skill: 'Průrazný šíp', description: 'Luk, rychlost a silný výstřel, který zpomalí cíl.' },
    mystic: { name: 'Mystik', title: 'Oheň starých run', hp: 115, mana: 150, attack: 24, range: 11, cooldown: .92, color: '#a19bdb', skill: 'Hvězdný oheň', description: 'Magická hůl a ohnivá exploze kolem vybraného cíle.' }
  });
  const ITEMS = Object.freeze({
    ironSword: { name: 'Železný meč', slot: 'weapon', classId: 'warrior', attack: 4, level: 1, rarity: 'common' },
    jadeSword: { name: 'Meč zeleného úsvitu', slot: 'weapon', classId: 'warrior', attack: 14, level: 3, rarity: 'rare' },
    ashBow: { name: 'Jasanový luk', slot: 'weapon', classId: 'ranger', attack: 4, level: 1, rarity: 'common' },
    moonBow: { name: 'Luk měsíčního lovce', slot: 'weapon', classId: 'ranger', attack: 14, level: 3, rarity: 'rare' },
    oakStaff: { name: 'Runová hůl', slot: 'weapon', classId: 'mystic', attack: 4, level: 1, rarity: 'common' },
    emberStaff: { name: 'Hůl věčného žáru', slot: 'weapon', classId: 'mystic', attack: 14, level: 3, rarity: 'rare' },
    leatherArmor: { name: 'Zbroj poutníka', slot: 'armor', defense: 4, hp: 20, level: 1, rarity: 'common' },
    jadeArmor: { name: 'Lamely nefritové stráže', slot: 'armor', defense: 9, hp: 45, level: 5, rarity: 'rare' },
    spiritCharm: { name: 'Talisman řeky', slot: 'charm', attack: 3, hp: 15, level: 2, rarity: 'uncommon' }
  });
  const NPCS = Object.freeze([
    { id: 'aira', name: 'Mistryně Aira', role: 'Strážkyně údolí', x: -5, z: -5, color: '#d1b474', kind: 'quest' },
    { id: 'ren', name: 'Kovář Ren', role: 'Obchod a výkup', x: 8, z: -5, color: '#be7950', kind: 'merchant' },
    { id: 'nami', name: 'Léčitelka Nami', role: 'Obnova sil', x: -8, z: 7, color: '#91baba', kind: 'healer' }
  ]);
  const QUESTS = Object.freeze([
    { id: 'fangs', name: 'Neklid v údolí', text: 'Vlci se přiblížili k posvátnému kruhu. Poraz čtyři vlky a vrať se k Aiře.', target: 'wolf', count: 4, gold: 100, xp: 120 },
    { id: 'shard', name: 'První trhlina', text: 'Znič kámen trhliny východně od útočiště. Vyvolává další nepřátele.', target: 'shard', count: 1, gold: 180, xp: 240 },
    { id: 'sentinels', name: 'Strážci zapomenutých bran', text: 'V ruinách na severovýchodě poraz tři kamenné strážce.', target: 'golem', count: 3, gold: 300, xp: 480 }
  ]);
  const ZONES = Object.freeze([
    { id: 'sanctuary', name: 'Útočiště úsvitu', level: 'Bezpečná oblast', x: 0, z: 0, radius: 18, color: '#b6ba79' },
    { id: 'valley', name: 'Nefritové údolí', level: 'Úroveň 1–4', x: 38, z: 22, radius: 56, color: '#8caa72' },
    { id: 'forest', name: 'Šeptající les', level: 'Úroveň 4–7', x: -65, z: -55, radius: 65, color: '#527e69' },
    { id: 'ruins', name: 'Ruiny starých králů', level: 'Úroveň 7–11', x: 100, z: -65, radius: 63, color: '#b9ae83' },
    { id: 'frost', name: 'Stříbrné vrchy', level: 'Úroveň 10–15', x: -104, z: 110, radius: 70, color: '#bccdd0' },
    { id: 'rift', name: 'Srdce trhliny', level: 'Úroveň 16–20 · boss', x: 169, z: 126, radius: 67, color: '#9b7d8f' }
  ]);
  const ENEMIES = Object.freeze({
    wolf: { name: 'Hladový vlk', hp: 82, attack: 9, xp: 28, gold: 12, speed: 3.8, radius: .65, aggro: 9, respawn: 18, color: '#777f83' },
    boar: { name: 'Divoký kanec', hp: 125, attack: 12, xp: 40, gold: 19, speed: 3, radius: .8, aggro: 7, respawn: 22, color: '#6e5a49' },
    spider: { name: 'Stínový pavouk', hp: 150, attack: 16, xp: 60, gold: 26, speed: 3.5, radius: .85, aggro: 10, respawn: 25, color: '#53596a' },
    golem: { name: 'Kamenný strážce', hp: 260, attack: 21, xp: 100, gold: 42, speed: 2.2, radius: 1.15, aggro: 10, respawn: 32, color: '#918f80' },
    frostwolf: { name: 'Vlčí duch', hp: 330, attack: 27, xp: 135, gold: 55, speed: 4.2, radius: .8, aggro: 12, respawn: 28, color: '#b7d8dc' },
    shard: { name: 'Kámen trhliny', hp: 340, attack: 0, xp: 125, gold: 70, speed: 0, radius: 1.3, aggro: 0, respawn: 65, color: '#8879b5' },
    warden: { name: 'VARKH · Strážce trhliny', hp: 2400, attack: 42, xp: 1100, gold: 650, speed: 2.8, radius: 2, aggro: 15, respawn: 150, color: '#a57583' }
  });

  const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
  const finite = (value, fallback = 0) => typeof value === 'number' && Number.isFinite(value) ? value : fallback;
  const distance = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);
  const inSanctuary = entity => Math.hypot(entity.x, entity.z) < SAFE_RADIUS;
  function seeded(seed) {
    let state = seed >>> 0;
    return () => { state = (Math.imul(1664525, state) + 1013904223) >>> 0; return state / 4294967296; };
  }
  function riverZ(x) { return 78 + Math.sin(x * .018) * 19; }
  function heightAt(x, z) {
    const flat = clamp((Math.hypot(x, z) - 15) / 25, 0, 1);
    const hills = Math.sin(x * .023) * Math.cos(z * .021) * 2.1 + Math.sin((x + z) * .052) * .5;
    const boundary = Math.pow(clamp((Math.max(Math.abs(x), Math.abs(z)) - 185) / 58, 0, 1), 2) * 18;
    const river = Math.exp(-Math.pow((z - riverZ(x)) / 5, 2)) * 1.2;
    return flat * hills + boundary - river;
  }
  function zoneAt(x, z) {
    if (Math.hypot(x, z) < 18) return ZONES[0];
    const match = ZONES.slice(2).find(zone => Math.hypot(x - zone.x, z - zone.z) < zone.radius);
    return match || ZONES[1];
  }
  function onPath(x, z) {
    return Math.abs(z - (10 + Math.sin(x * .04) * 5)) < 2.6 && x > -12 && x < 115 || Math.abs(x - z * .8) < 2.6 && z < 2 && z > -75;
  }
  function structureArea(x, z) { return Math.hypot(x - 97, z + 68) < 24 || Math.hypot(x - 171, z - 137) < 16; }
  function createDecorations() {
    const random = seeded(74219);
    const trees = [], rocks = [], grass = [];
    for (let index = 0; index < 1280; index++) {
      const x = (random() - .5) * 466, z = (random() - .5) * 466;
      if (Math.hypot(x, z) < 23 || Math.abs(x) < 12 && z < 36 && z > 10 || onPath(x, z) || structureArea(x, z) || Math.abs(z - riverZ(x)) < 5) continue;
      trees.push({ x, z, scale: .7 + random() * 1.3, variant: Math.floor(random() * 4), rotation: random() * Math.PI * 2 });
    }
    for (let index = 0; index < 170; index++) {
      const x = (random() - .5) * 457, z = (random() - .5) * 457;
      if (Math.hypot(x, z) < 18 || onPath(x, z) || structureArea(x, z)) continue;
      rocks.push({ x, z, scale: .6 + random() * 1.8, rotation: random() * 6.28 });
    }
    for (let index = 0; index < 2300; index++) {
      const x = (random() - .5) * 470, z = (random() - .5) * 470;
      if (Math.hypot(x, z) > 17 && !onPath(x, z) && Math.abs(z - riverZ(x)) > 4) grass.push({ x, z, scale: .4 + random() * .8, rotation: random() * 6.28 });
    }
    return { trees, rocks, grass };
  }
  const DECOR = createDecorations();
  const obstacles = [...DECOR.trees.map(tree => ({ ...tree, radius: .43 * tree.scale })), ...DECOR.rocks.map(rock => ({ ...rock, radius: .65 * rock.scale }))];
  obstacles.push({ x: 0, z: 0, radius: 1.6 });
  for (let index = 0; index < 10; index++) obstacles.push({ x: Math.sin(index / 10 * Math.PI * 2) * 13.5, z: Math.cos(index / 10 * Math.PI * 2) * 13.5, radius: .6 });
  const ruinPillars = [...Array.from({ length: 7 }, (_, index) => [-14 + index * 4.6, -10]), [-7, 8], [7, 8], [-7, -2], [7, -2]];
  for (const [x, z] of ruinPillars) obstacles.push({ x: 97 + x * Math.cos(-.2) + z * Math.sin(-.2), z: -68 - x * Math.sin(-.2) + z * Math.cos(-.2), radius: .75 });
  const obstacleGrid = new Map();
  for (const obstacle of obstacles) {
    const key = `${Math.floor(obstacle.x / 16)},${Math.floor(obstacle.z / 16)}`;
    if (!obstacleGrid.has(key)) obstacleGrid.set(key, []);
    obstacleGrid.get(key).push(obstacle);
  }
  function walkable(x, z, radius = .45) {
    if (!Number.isFinite(x) || !Number.isFinite(z) || Math.abs(x) > BOUNDS - radius || Math.abs(z) > BOUNDS - radius) return false;
    const cellX = Math.floor(x / 16), cellZ = Math.floor(z / 16);
    for (let dx = -1; dx <= 1; dx++) for (let dz = -1; dz <= 1; dz++) {
      for (const obstacle of obstacleGrid.get(`${cellX + dx},${cellZ + dz}`) || []) {
        if (Math.hypot(x - obstacle.x, z - obstacle.z) < radius + obstacle.radius) return false;
      }
    }
    return true;
  }
  function move(entity, dx, dz, amount, radius = .45) {
    const length = Math.hypot(dx, dz);
    if (length < .001 || amount <= 0) return false;
    dx = dx / Math.max(1, length) * amount;
    dz = dz / Math.max(1, length) * amount;
    let moved = false;
    const steps = Math.max(1, Math.ceil(Math.hypot(dx, dz) / .35));
    for (let step = 0; step < steps; step++) {
      const nextX = entity.x + dx / steps, nextZ = entity.z + dz / steps;
      if (walkable(nextX, nextZ, radius)) { entity.x = nextX; entity.z = nextZ; moved = true; }
      else {
        if (walkable(nextX, entity.z, radius)) { entity.x = nextX; moved = true; }
        if (walkable(entity.x, nextZ, radius)) { entity.z = nextZ; moved = true; }
      }
    }
    if (moved) entity.angle = Math.atan2(dx, dz);
    return moved;
  }
  function validName(name) {
    return typeof name === 'string' && /^[\p{L}\p{N}][\p{L}\p{N} _'-]{1,22}[\p{L}\p{N}]$/u.test(name.normalize('NFC').trim());
  }
  function xpForLevel(level) { return 90 + (level - 1) * 65; }
  function stats(player) {
    const base = CLASSES[player.classId];
    const result = { maxHp: base.hp + (player.level - 1) * 16, maxMana: base.mana + (player.level - 1) * 5, attack: base.attack + (player.level - 1) * 4, defense: (player.level - 1) * 1.7, range: base.range };
    for (const uid of Object.values(player.gear)) {
      const item = player.bag.find(entry => entry.uid === uid), definition = item && ITEMS[item.typeId];
      if (!definition) continue;
      result.maxHp += definition.hp || 0;
      result.attack += definition.attack || 0;
      result.defense += definition.defense || 0;
    }
    return result;
  }
  function createCharacter(id, name, classId = 'warrior') {
    if (!validName(name)) throw new Error('Jméno musí mít 3–24 znaků, bez HTML a zvláštních symbolů.');
    if (!Object.hasOwn(CLASSES, classId)) throw new Error('Neplatné povolání.');
    const weapon = { warrior: 'ironSword', ranger: 'ashBow', mystic: 'oakStaff' }[classId];
    const player = {
      id, name: name.normalize('NFC').trim(), classId, x: 0, z: 11, angle: Math.PI,
      level: 1, xp: 0, gold: 120, hp: CLASSES[classId].hp + 20, mana: CLASSES[classId].mana,
      stamina: 100, potions: 5, kills: 0, deaths: 0,
      bag: [{ uid: `${id}-weapon`, typeId: weapon }, { uid: `${id}-armor`, typeId: 'leatherArmor' }],
      gear: { weapon: `${id}-weapon`, armor: `${id}-armor`, charm: null },
      questIndex: 0, questActive: false, questProgress: 0,
      attackAt: 0, skillAt: 0, dashAt: 0, potionAt: 0, lastHit: -20, deadUntil: 0,
      attackUntil: 0, skillUntil: 0, dashUntil: 0, moving: false, targetId: null,
      input: { dx: 0, dz: 0, attack: false, sprint: false, targetId: null, destination: null }
    };
    return player;
  }
  function serializeCharacter(player) {
    const keys = ['id', 'name', 'classId', 'x', 'z', 'angle', 'level', 'xp', 'gold', 'hp', 'mana', 'stamina', 'potions', 'kills', 'deaths', 'bag', 'gear', 'questIndex', 'questActive', 'questProgress'];
    return Object.fromEntries(keys.map(key => [key, JSON.parse(JSON.stringify(player[key]))]));
  }
  function restoreCharacter(saved, id = saved?.id) {
    if (!saved || typeof saved !== 'object' || !validName(saved.name) || !Object.hasOwn(CLASSES, saved.classId) || typeof id !== 'string') return null;
    const player = createCharacter(id, saved.name, saved.classId);
    const integer = (key, min, max) => Math.floor(clamp(finite(saved[key], player[key]), min, max));
    for (const key of ['level', 'xp', 'gold', 'potions', 'kills', 'deaths', 'questIndex', 'questProgress']) {
      const limits = { level: [1, 30], xp: [0, 100000], gold: [0, 9999999], potions: [0, 999], kills: [0, 9999999], deaths: [0, 9999999], questIndex: [0, QUESTS.length], questProgress: [0, 999] }[key];
      player[key] = integer(key, ...limits);
    }
    const seen = new Set();
    if (Array.isArray(saved.bag)) {
      player.bag = saved.bag.filter(item => item && typeof item.uid === 'string' && item.uid.length < 100 && !seen.has(item.uid) && Object.hasOwn(ITEMS, item.typeId) && (seen.add(item.uid), true)).slice(0, MAX_BAG).map(item => ({ uid: item.uid, typeId: item.typeId }));
      player.gear = { weapon: null, armor: null, charm: null };
      for (const slot of ['weapon', 'armor', 'charm']) {
        const item = player.bag.find(entry => entry.uid === saved.gear?.[slot]);
        const definition = item && ITEMS[item.typeId];
        if (definition && definition.slot === slot && definition.level <= player.level && (!definition.classId || definition.classId === player.classId)) player.gear[slot] = item.uid;
      }
    }
    player.questActive = saved.questActive === true && player.questIndex < QUESTS.length;
    player.questProgress = player.questActive ? Math.min(player.questProgress, QUESTS[player.questIndex].count) : 0;
    if (walkable(saved.x, saved.z)) { player.x = saved.x; player.z = saved.z; }
    player.angle = finite(saved.angle, Math.PI);
    const derived = stats(player);
    player.hp = clamp(finite(saved.hp, derived.maxHp), 1, derived.maxHp);
    player.mana = clamp(finite(saved.mana, derived.maxMana), 0, derived.maxMana);
    player.stamina = clamp(finite(saved.stamina, 100), 0, 100);
    return player;
  }
  function createWorld(seed = 8129) {
    const world = { time: 0, seed, players: new Map(), enemies: [], events: [], eventId: 0, itemId: 0, random: seeded(seed) };
    const packs = [
      ['wolf', 12, 1, 34, 18, 18], ['boar', 7, 2, 52, 43, 16],
      ['spider', 11, 4, -51, -43, 26], ['wolf', 7, 6, -93, -72, 18],
      ['golem', 10, 8, 93, -58, 24], ['frostwolf', 10, 12, -100, 111, 30],
      ['golem', 6, 16, 162, 116, 22], ['shard', 1, 3, 35, -13, 0],
      ['shard', 1, 7, -63, -64, 0], ['shard', 1, 11, 112, -80, 0], ['warden', 1, 18, 171, 137, 0]
    ];
    for (const [kind, count, level, centerX, centerZ, spread] of packs) {
      for (let index = 0; index < count; index++) {
        let x = centerX, z = centerZ;
        for (let attempt = 0; attempt < 80; attempt++) {
          const angle = world.random() * 6.28, radius = world.random() * (spread || attempt * .3);
          x = centerX + Math.cos(angle) * radius; z = centerZ + Math.sin(angle) * radius;
          if (walkable(x, z, ENEMIES[kind].radius) && Math.hypot(x, z) > 20) break;
          x += 2; z += 2;
        }
        const type = ENEMIES[kind];
        const maxHp = Math.round(type.hp * (1 + Math.max(0, level - 1) * .08));
        world.enemies.push({ id: `mob-${world.enemies.length}`, kind, level, name: type.name, x, z, homeX: x, homeZ: z, angle: world.random() * 6.28, hp: maxHp, maxHp, attackAt: 0, hitUntil: 0, deadUntil: 0, slowUntil: 0, moving: false, targetId: null, contributors: new Set() });
      }
    }
    return world;
  }
  function emit(world, type, data) {
    world.events.push({ id: ++world.eventId, time: world.time, type, ...data });
    if (world.events.length > 140) world.events.splice(0, world.events.length - 140);
  }
  function notice(world, player, text) { emit(world, 'notice', { playerId: player.id, x: player.x, z: player.z, text }); }
  function addPlayer(world, player) {
    if (world.players.has(player.id)) throw new Error('Tato postava je již připojená.');
    world.players.set(player.id, player);
    player.attackAt = world.time; player.skillAt = world.time; player.dashAt = world.time; player.potionAt = world.time;
    player.lastHit = world.time - 20;
    return player;
  }
  function setInput(world, id, payload) {
    const player = world.players.get(id);
    if (!player || !payload || typeof payload !== 'object') return false;
    let dx = clamp(finite(payload.dx), -1, 1), dz = clamp(finite(payload.dz), -1, 1);
    const length = Math.hypot(dx, dz);
    if (length > 1) { dx /= length; dz /= length; }
    const targetId = typeof payload.targetId === 'string' && /^mob-\d{1,3}$/.test(payload.targetId) ? payload.targetId : null;
    let destination = null;
    if (payload.destination && Number.isFinite(payload.destination.x) && Number.isFinite(payload.destination.z)) destination = { x: clamp(payload.destination.x, -BOUNDS + 1, BOUNDS - 1), z: clamp(payload.destination.z, -BOUNDS + 1, BOUNDS - 1) };
    player.input = { dx, dz, targetId, destination, attack: payload.attack === true, sprint: payload.sprint === true };
    player.targetId = targetId;
    return true;
  }
  function grantXp(world, player, amount) {
    if (player.level >= 30) return;
    player.xp += amount;
    while (player.level < 30 && player.xp >= xpForLevel(player.level)) {
      player.xp -= xpForLevel(player.level); player.level++;
      const derived = stats(player); player.hp = derived.maxHp; player.mana = derived.maxMana;
      emit(world, 'level', { playerId: player.id, x: player.x, z: player.z, level: player.level });
      notice(world, player, `Nová úroveň ${player.level}! Tvé zdraví i síla vzrostly.`);
    }
  }
  function defeat(world, enemy) {
    if (enemy.deadUntil > world.time || enemy.hp > 0) return;
    const type = ENEMIES[enemy.kind];
    enemy.deadUntil = world.time + type.respawn;
    const recipients = [...enemy.contributors].map(id => world.players.get(id)).filter(player => player && player.hp > 0 && distance(player, enemy) < 45);
    for (const player of recipients) {
      player.kills++;
      const gold = Math.round(type.gold * (1 + enemy.level * .08));
      player.gold += gold;
      grantXp(world, player, Math.round(type.xp * (1 + enemy.level * .06)));
      const quest = QUESTS[player.questIndex];
      if (player.questActive && quest && quest.target === enemy.kind) {
        player.questProgress = Math.min(quest.count, player.questProgress + 1);
        notice(world, player, `${quest.name}: ${player.questProgress}/${quest.count}${player.questProgress === quest.count ? ' · vrať se k Aiře' : ''}`);
      }
      if (world.random() < .3 || enemy.kind === 'shard' || enemy.kind === 'warden') {
        if (player.bag.length < MAX_BAG) {
          const special = { warrior: 'jadeSword', ranger: 'moonBow', mystic: 'emberStaff' }[player.classId];
          const typeId = enemy.level > 7 && world.random() < .5 ? 'jadeArmor' : world.random() < .45 ? special : world.random() < .5 ? 'spiritCharm' : 'leatherArmor';
          player.bag.push({ uid: `${player.id}-${++world.itemId}-${Math.floor(world.random() * 1e9)}`, typeId });
          notice(world, player, `Kořist: ${ITEMS[typeId].name} · +${gold} zlata`);
        } else notice(world, player, 'Inventář je plný. Prodej nepotřebnou výbavu u Rena.');
      }
    }
    emit(world, 'defeat', { enemyId: enemy.id, x: enemy.x, z: enemy.z, kind: enemy.kind });
    enemy.contributors.clear();
  }
  function damageEnemy(world, player, enemy, amount) {
    if (!enemy || enemy.hp <= 0 || inSanctuary(player)) return false;
    enemy.hp = Math.max(0, enemy.hp - amount); enemy.hitUntil = world.time + .18;
    enemy.contributors.add(player.id);
    if (ENEMIES[enemy.kind].speed) enemy.targetId = player.id;
    emit(world, 'damage', { enemyId: enemy.id, playerId: player.id, x: enemy.x, z: enemy.z, amount });
    if (enemy.hp === 0) defeat(world, enemy);
    return true;
  }
  function nearestEnemy(world, player, radius) {
    let nearest = null, best = radius;
    for (const enemy of world.enemies) {
      if (enemy.hp <= 0) continue;
      const d = distance(enemy, player);
      if (d < best) { nearest = enemy; best = d; }
    }
    return nearest;
  }
  function targetEnemy(world, player) {
    return world.enemies.find(enemy => enemy.id === player.targetId && enemy.hp > 0) || nearestEnemy(world, player, 16);
  }
  function attack(world, player) {
    if (player.hp <= 0 || inSanctuary(player) || world.time < player.attackAt) return false;
    const enemy = targetEnemy(world, player), derived = stats(player), type = enemy && ENEMIES[enemy.kind];
    if (!enemy || distance(player, enemy) > derived.range + type.radius) return false;
    player.attackAt = world.time + CLASSES[player.classId].cooldown;
    player.attackUntil = world.time + .32;
    player.angle = Math.atan2(enemy.x - player.x, enemy.z - player.z);
    const amount = Math.max(2, Math.round(derived.attack * (.92 + world.random() * .16) - enemy.level * .45));
    emit(world, 'attack', { playerId: player.id, x: player.x, z: player.z, targetX: enemy.x, targetZ: enemy.z, classId: player.classId });
    return damageEnemy(world, player, enemy, amount);
  }
  function nearNpc(player, kind) { return NPCS.find(npc => npc.kind === kind && distance(player, npc) <= 5); }
  function act(world, id, payload) {
    const player = world.players.get(id);
    if (!player || player.hp <= 0 || !payload || typeof payload !== 'object') return false;
    const derived = stats(player);
    if (payload.type === 'skill') {
      if (world.time < player.skillAt || player.mana < 28 || inSanctuary(player)) return false;
      const target = targetEnemy(world, player);
      if (!target || distance(player, target) > derived.range + 2) return false;
      player.mana -= 28; player.skillAt = world.time + 7; player.skillUntil = world.time + .65;
      player.angle = Math.atan2(target.x - player.x, target.z - player.z);
      const center = player.classId === 'warrior' ? player : target;
      emit(world, 'skill', { playerId: player.id, x: center.x, z: center.z, classId: player.classId });
      for (const enemy of world.enemies) {
        if (enemy.hp <= 0) continue;
        if (player.classId === 'ranger' ? enemy.id === target.id : distance(enemy, center) < (player.classId === 'warrior' ? 4.6 : 4)) {
          damageEnemy(world, player, enemy, Math.max(5, Math.round(derived.attack * (player.classId === 'ranger' ? 3.4 : 2.1) - enemy.level * .4)));
          if (player.classId === 'ranger') enemy.slowUntil = world.time + 3;
        }
      }
      return true;
    }
    if (payload.type === 'dash') {
      if (world.time < player.dashAt || player.stamina < 30) return false;
      player.stamina -= 30; player.dashAt = world.time + 4; player.dashUntil = world.time + .22;
      return true;
    }
    if (payload.type === 'potion') {
      if (world.time < player.potionAt || player.potions < 1 || player.hp >= derived.maxHp) return false;
      player.potions--; player.potionAt = world.time + 3;
      player.hp = Math.min(derived.maxHp, player.hp + 85);
      emit(world, 'heal', { playerId: player.id, x: player.x, z: player.z });
      return true;
    }
    if (payload.type === 'quest') {
      if (!nearNpc(player, 'quest') || player.questIndex >= QUESTS.length) return false;
      const quest = QUESTS[player.questIndex];
      if (!player.questActive) { player.questActive = true; player.questProgress = 0; notice(world, player, `Přijat úkol: ${quest.name}`); return true; }
      if (player.questProgress < quest.count) return false;
      player.questIndex++; player.questActive = false; player.questProgress = 0; player.gold += quest.gold;
      grantXp(world, player, quest.xp);
      notice(world, player, `Úkol dokončen · +${quest.xp} XP · +${quest.gold} zlata`);
      return true;
    }
    if (payload.type === 'buyPotion') {
      if (!nearNpc(player, 'merchant') || player.gold < 35 || player.potions >= 999) return false;
      player.gold -= 35; player.potions++; notice(world, player, 'Zakoupen léčivý lektvar.'); return true;
    }
    if (payload.type === 'heal') {
      if (!nearNpc(player, 'healer') || player.gold < 20 || player.hp === derived.maxHp && player.mana === derived.maxMana) return false;
      player.gold -= 20; player.hp = derived.maxHp; player.mana = derived.maxMana;
      emit(world, 'heal', { playerId: player.id, x: player.x, z: player.z }); return true;
    }
    if (payload.type === 'equip' || payload.type === 'sell') {
      if (typeof payload.uid !== 'string') return false;
      const item = player.bag.find(entry => entry.uid === payload.uid), definition = item && ITEMS[item.typeId];
      if (!definition) return false;
      if (payload.type === 'equip') {
        if (definition.level > player.level || definition.classId && definition.classId !== player.classId) return false;
        player.gear[definition.slot] = item.uid;
        const newStats = stats(player); player.hp = Math.min(player.hp, newStats.maxHp); player.mana = Math.min(player.mana, newStats.maxMana);
        return true;
      }
      if (!nearNpc(player, 'merchant') || Object.values(player.gear).includes(item.uid)) return false;
      player.bag = player.bag.filter(entry => entry.uid !== item.uid);
      player.gold += definition.rarity === 'rare' ? 75 : 20;
      return true;
    }
    return false;
  }
  function tickPlayer(world, player, dt) {
    if (player.hp <= 0) {
      player.moving = false;
      if (world.time >= player.deadUntil) {
        player.x = 0; player.z = 11; player.hp = stats(player).maxHp; player.mana = stats(player).maxMana;
        player.input = { dx: 0, dz: 0, attack: false, sprint: false, targetId: null, destination: null };
        player.targetId = null;
        notice(world, player, 'Vrátil ses do útočiště. Nami ti pomohla znovu vstát.');
      }
      return;
    }
    const input = player.input;
    let dx = input.dx, dz = input.dz;
    const manual = Math.hypot(dx, dz) > .01;
    if (!manual && input.destination && distance(player, input.destination) > .5) {
      dx = input.destination.x - player.x; dz = input.destination.z - player.z;
    }
    if (!manual && input.attack) {
      const enemy = targetEnemy(world, player);
      if (enemy && distance(player, enemy) > stats(player).range + ENEMIES[enemy.kind].radius - .2) { dx = enemy.x - player.x; dz = enemy.z - player.z; }
      else { dx = 0; dz = 0; }
    }
    const sprinting = input.sprint && player.stamina > 3 && Math.hypot(dx, dz) > .01;
    let speed = sprinting ? 8.2 : 5.8;
    if (Math.abs(player.z - riverZ(player.x)) < 3.7) speed *= .6;
    if (world.time < player.dashUntil) {
      speed = 23;
      if (Math.hypot(dx, dz) < .01) { dx = Math.sin(player.angle); dz = Math.cos(player.angle); }
    }
    player.moving = move(player, dx, dz, speed * dt);
    player.stamina = clamp(player.stamina + (sprinting ? -14 : 18) * dt, 0, 100);
    const derived = stats(player);
    player.mana = Math.min(derived.maxMana, player.mana + 4 * dt);
    if (inSanctuary(player) && world.time - player.lastHit > 5) player.hp = Math.min(derived.maxHp, player.hp + 9 * dt);
    if (input.attack) attack(world, player);
  }
  function tickEnemy(world, enemy, dt) {
    const type = ENEMIES[enemy.kind];
    if (enemy.hp <= 0) {
      enemy.moving = false;
      if (world.time >= enemy.deadUntil) { enemy.hp = enemy.maxHp; enemy.x = enemy.homeX; enemy.z = enemy.homeZ; enemy.targetId = null; enemy.contributors.clear(); }
      return;
    }
    if (!type.speed) return;
    let target = world.players.get(enemy.targetId);
    if (!target || target.hp <= 0 || inSanctuary(target) || distance(enemy, { x: enemy.homeX, z: enemy.homeZ }) > 24 || distance(enemy, target) > 25) {
      target = null; enemy.targetId = null;
      let best = type.aggro;
      for (const player of world.players.values()) {
        const d = distance(enemy, player);
        if (player.hp > 0 && !inSanctuary(player) && d < best && distance(player, { x: enemy.homeX, z: enemy.homeZ }) < 25) { target = player; best = d; enemy.targetId = player.id; }
      }
    }
    if (target) {
      const d = distance(enemy, target);
      enemy.angle = Math.atan2(target.x - enemy.x, target.z - enemy.z);
      enemy.moving = d > type.radius + .8 && move(enemy, target.x - enemy.x, target.z - enemy.z, type.speed * (world.time < enemy.slowUntil ? .4 : 1) * dt, type.radius * .65);
      if (d < type.radius + 1.25 && world.time >= enemy.attackAt) {
        enemy.attackAt = world.time + (enemy.kind === 'warden' ? 1.4 : 1.1);
        if (world.time < target.dashUntil) return;
        const amount = Math.max(2, Math.round(type.attack + enemy.level * 1.4 - stats(target).defense));
        target.hp = Math.max(0, target.hp - amount); target.lastHit = world.time;
        emit(world, 'hurt', { playerId: target.id, x: target.x, z: target.z, amount });
        if (target.hp === 0) {
          target.deaths++; target.deadUntil = world.time + 5; target.gold -= Math.floor(target.gold * .05);
          notice(world, target, 'Padl jsi. Za 5 sekund se probudíš v útočišti.');
        }
      }
    } else {
      const home = { x: enemy.homeX, z: enemy.homeZ };
      enemy.moving = distance(enemy, home) > .5 && move(enemy, home.x - enemy.x, home.z - enemy.z, type.speed * .65 * dt, type.radius * .65);
      if (enemy.hp < enemy.maxHp) enemy.hp = Math.min(enemy.maxHp, enemy.hp + enemy.maxHp * .08 * dt);
      if (distance(enemy, home) < 1) enemy.contributors.clear();
    }
  }
  function tick(world, delta = TICK) {
    const dt = clamp(finite(delta), 0, .1);
    world.time += dt;
    for (const player of world.players.values()) tickPlayer(world, player, dt);
    for (const enemy of world.enemies) tickEnemy(world, enemy, dt);
  }
  function publicPlayer(player) {
    const appearance = Object.fromEntries(['weapon', 'armor'].map(slot => [slot, player.bag.find(item => item.uid === player.gear[slot])?.typeId || null]));
    return { id: player.id, name: player.name, classId: player.classId, appearance, x: player.x, z: player.z, angle: player.angle, level: player.level, hp: player.hp, maxHp: stats(player).maxHp, moving: player.moving, attackUntil: player.attackUntil, skillUntil: player.skillUntil, dashUntil: player.dashUntil };
  }
  function snapshot(world, id, lastEventId = 0) {
    const player = world.players.get(id);
    if (!player) return null;
    return {
      version: VERSION, time: world.time,
      self: { ...serializeCharacter(player), ...stats(player), attackAt: player.attackAt, skillAt: player.skillAt, dashAt: player.dashAt, potionAt: player.potionAt, deadUntil: player.deadUntil },
      players: [...world.players.values()].filter(other => distance(other, player) < 100).map(publicPlayer),
      enemies: world.enemies.filter(enemy => distance(enemy, player) < 100).map(({ contributors, ...enemy }) => ({ ...enemy })),
      events: world.events.filter(event => event.id > lastEventId && (event.type === 'notice' ? event.playerId === id : distance(event, player) < 100)),
      population: world.players.size,
      lastEventId: world.eventId
    };
  }
  return { VERSION, BOUNDS, SAFE_RADIUS, TICK, MAX_BAG, CLASSES, ITEMS, NPCS, QUESTS, ZONES, ENEMIES, DECOR, clamp, distance, seeded, riverZ, heightAt, zoneAt, onPath, walkable, validName, xpForLevel, stats, createCharacter, serializeCharacter, restoreCharacter, createWorld, addPlayer, setInput, act, attack, tick, snapshot, nearestEnemy, inSanctuary };
});
