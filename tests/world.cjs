const test = require('node:test');
const assert = require('node:assert/strict');
const W = require('../web/world.js');
function setup(classId = 'warrior') {
  const world = W.createWorld(), player = W.createCharacter('test', 'Zkouška hrdiny', classId);
  W.addPlayer(world, player); return { world, player };
}
function advance(world, seconds) { for (let tick = 0; tick < Math.ceil(seconds / W.TICK); tick++) W.tick(world); }

test('deterministic open world has traversable spawns and bounded collision', () => {
  const first = W.createWorld(), second = W.createWorld();
  assert.deepEqual(first.enemies.map(e => [e.x, e.z]), second.enemies.map(e => [e.x, e.z]));
  assert.equal(first.enemies.length, 67);
  assert(first.enemies.every(e => W.walkable(e.x, e.z, W.ENEMIES[e.kind].radius)));
  assert.equal(W.walkable(Infinity, 0), false); assert.equal(W.walkable(999, 0), false);
  assert.equal(W.walkable(W.DECOR.trees[0].x, W.DECOR.trees[0].z), false);
});
test('names, classes and restored inventory are validated', () => {
  assert(W.validName('Železný Strážce')); assert(!W.validName('<script>')); assert(!W.validName('ab'));
  assert.throws(() => W.createCharacter('x', 'Hrdina', 'constructor'));
  const { player } = setup(); const save = W.serializeCharacter(player);
  save.level = 999; save.gold = -5; save.x = Infinity; save.z = NaN;
  save.bag.push(save.bag[0], { uid: 'bad', typeId: '__proto__' }); save.gear.charm = 'bad';
  const restored = W.restoreCharacter(save);
  assert.equal(restored.level, 30); assert.equal(restored.gold, 0); assert.equal(restored.x, 0);
  assert.equal(restored.bag.length, 2); assert.equal(restored.gear.charm, null);
  assert(!Object.hasOwn(save, 'input')); assert(!Object.hasOwn(save, 'attackAt'));
});
test('input cannot set position, health or inventory; diagonals have bounded speed', () => {
  const { world, player } = setup(); const hp = player.hp;
  W.setInput(world, player.id, { dx: 999, dz: 999, hp: 9999, x: 200, bag: [], attack: 'yes' });
  const origin = { x: player.x, z: player.z }; W.tick(world);
  assert(W.distance(player, origin) <= 5.8 * W.TICK + .001);
  assert.equal(player.hp, hp); assert.equal(player.bag.length, 2); assert.equal(player.input.attack, false);
  player.x = 237; player.z = 0; W.setInput(world, player.id, { dx: 1, dz: 0, sprint: true }); advance(world, 4);
  assert(player.x <= W.BOUNDS - .45); assert(W.walkable(player.x, player.z));
});
test('safe zone, range, mana and cooldown gate attacks and skills', () => {
  const { world, player } = setup('mystic'), enemy = world.enemies[0];
  W.setInput(world, player.id, { targetId: enemy.id });
  assert.equal(W.attack(world, player), false); assert.equal(W.act(world, player.id, { type: 'skill' }), false);
  player.x = enemy.x; player.z = enemy.z - 5;
  const hp = enemy.hp, mana = player.mana;
  assert(W.act(world, player.id, { type: 'skill' })); assert(enemy.hp < hp); assert.equal(player.mana, mana - 28);
  assert.equal(W.act(world, player.id, { type: 'skill' }), false);
  assert(W.attack(world, player)); assert.equal(W.attack(world, player), false);
});
test('kills award shared contribution once and private state stays private', () => {
  const { world, player } = setup('ranger'), other = W.createCharacter('other', 'Druhý hráč', 'mystic'), enemy = world.enemies[0];
  W.addPlayer(world, other);
  for (const actor of [player, other]) { actor.x = enemy.x; actor.z = enemy.z - 3; W.setInput(world, actor.id, { targetId: enemy.id }); }
  assert(W.attack(world, player)); enemy.hp = 1; assert(W.attack(world, other));
  assert.equal(player.kills, 1); assert.equal(other.kills, 1); assert(player.gold > 120);
  const gold = player.gold; assert.equal(W.attack(world, player), false); assert.equal(player.gold, gold);
  const snapshot = W.snapshot(world, player.id); const publicOther = snapshot.players.find(p => p.id === other.id);
  assert(!Object.hasOwn(publicOther, 'bag')); assert(!Object.hasOwn(publicOther, 'gold')); assert(snapshot.self.bag.length >= 2);
  assert(snapshot.enemies.every(e => !Object.hasOwn(e, 'contributors')));
});
test('quest progress comes from kills and reward cannot be claimed twice', () => {
  const { world, player } = setup(); player.x = -5; player.z = -4;
  assert(W.act(world, player.id, { type: 'quest' })); assert.equal(player.questProgress, 0);
  assert.equal(W.act(world, player.id, { type: 'quest' }), false);
  for (const enemy of world.enemies.filter(e => e.kind === 'wolf').slice(0, 4)) {
    player.x = enemy.x; player.z = enemy.z - 1; player.attackAt = 0; enemy.hp = 1;
    W.setInput(world, player.id, { targetId: enemy.id }); assert(W.attack(world, player));
  }
  assert.equal(player.questProgress, 4); player.x = -5; player.z = -4;
  const gold = player.gold; assert(W.act(world, player.id, { type: 'quest' })); assert.equal(player.gold, gold + 100);
  assert.equal(player.questIndex, 1); W.act(world, player.id, { type: 'quest' }); assert.equal(player.gold, gold + 100);
});
test('merchant, equipment restrictions and potion charges are authoritative', () => {
  const { world, player } = setup();
  assert.equal(W.act(world, player.id, { type: 'buyPotion' }), false);
  player.x = 8; player.z = -5;
  assert(W.act(world, player.id, { type: 'buyPotion' })); assert.equal(player.potions, 6); assert.equal(player.gold, 85);
  player.bag.push({ uid: 'bow', typeId: 'ashBow' }, { uid: 'rare', typeId: 'jadeArmor' });
  assert.equal(W.act(world, player.id, { type: 'equip', uid: 'bow' }), false);
  assert.equal(W.act(world, player.id, { type: 'equip', uid: 'rare' }), false);
  player.level = 5; assert(W.act(world, player.id, { type: 'equip', uid: 'rare' }));
  assert.equal(W.snapshot(world, player.id).players.find(p => p.id === player.id).appearance.armor, 'jadeArmor');
  assert.equal(W.act(world, player.id, { type: 'sell', uid: player.gear.weapon }), false);
  assert(W.act(world, player.id, { type: 'sell', uid: 'bow' })); assert.equal(player.gold, 105);
  assert.equal(W.act(world, player.id, { type: 'sell', uid: 'bow' }), false);
  player.hp = 1; assert(W.act(world, player.id, { type: 'potion' })); assert.equal(player.hp, 86); assert.equal(player.potions, 5);
  assert.equal(W.act(world, player.id, { type: 'potion' }), false);
});
test('death respawns in sanctuary and clears attack input', () => {
  const { world, player } = setup(), enemy = world.enemies[0];
  player.x = enemy.x; player.z = enemy.z; player.hp = 1;
  W.tick(world); assert.equal(player.hp, 0); assert.equal(player.deaths, 1); assert.equal(player.gold, 114);
  advance(world, 5.1); assert(player.hp > 0); assert(W.inSanctuary(player)); assert.equal(player.input.attack, false);
});
test('dash consumes stamina and cannot be spammed', () => {
  const { world, player } = setup(); assert(W.act(world, player.id, { type: 'dash' })); assert.equal(player.stamina, 70);
  assert.equal(W.act(world, player.id, { type: 'dash' }), false);
  advance(world, .2); assert(player.z < 8); assert(W.walkable(player.x, player.z));
});
