import test from 'node:test';
import assert from 'node:assert/strict';
import { Game } from '../src/game.js';
import { SHRINES } from '../src/world.js';

function createStorage() {
  const values = new Map();
  return {
    getItem: key => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, String(value)),
    removeItem: key => values.delete(key),
    clear: () => values.clear(),
  };
}

function makeGame(t, storage = createStorage()) {
  globalThis.localStorage = storage;
  globalThis.window = { localStorage: storage, addEventListener() {}, removeEventListener() {} };
  globalThis.document = { hidden: false, activeElement: { tagName: 'BODY' }, addEventListener() {}, removeEventListener() {} };
  globalThis.requestAnimationFrame = () => 1;
  globalThis.cancelAnimationFrame = () => {};
  const canvas = { width: 960, height: 540, addEventListener() {}, removeEventListener() {} };
  const events = [];
  const game = new Game(canvas, { autoLoop: false, renderer: { render() {} }, onEvent: event => events.push(event) });
  t.after(() => game.destroy());
  game.start();
  return { game, events, storage };
}

function advance(game, seconds = 1) {
  for (let i = 0; i < Math.ceil(seconds * 60); i++) game.update(1 / 60);
}

test('gravity, collision and movement operate in the real simulation', t => {
  const { game } = makeGame(t);
  game.enemies = [];
  game.player.x = 50;
  game.player.y = 20;
  game.player.vx = 0;
  game.player.vy = 0;
  advance(game, 2);
  assert.ok(game.player.onGround, 'falling player must land');
  assert.ok(Math.abs(game.player.y + game.player.h - game.map.groundY) < 2, 'player should stand on the ground');
  const x = game.player.x;
  game.setInput('ArrowRight', true);
  advance(game, 0.4);
  game.setInput('ArrowRight', false);
  assert.ok(game.player.x > x + 30, 'movement must translate the player');
  assert.ok(game.player.y + game.player.h <= game.map.groundY + 1, 'movement may not fall through floor');
});

test('fast travel requires discovery and map exits discover neighboring regions', t => {
  const { game } = makeGame(t);
  const initial = game.state.mapId;
  game.travel('map-10');
  assert.equal(game.state.mapId, initial, 'unvisited final region cannot be selected');
  game.enemies = [];
  game.player.x = game.map.width - game.player.w - 1;
  game.player.y = game.map.groundY - game.player.h;
  game.setInput('ArrowRight', true);
  advance(game, 0.6);
  game.setInput('ArrowRight', false);
  assert.equal(game.state.mapId, 'map-02');
  assert.ok(game.state.visited.includes('map-02'));
  game.travel('map-01');
  assert.equal(game.state.mapId, 'map-01');
});

test('sprinting, climbing and gliding consume stamina, and resting restores it', t => {
  const { game } = makeGame(t);
  game.enemies = [];
  game.player.x = 100;
  game.player.y = game.map.groundY - game.player.h;
  game.player.onGround = true;
  game.setInput('ArrowRight', true);
  game.setInput('ShiftLeft', true);
  advance(game, 0.8);
  game.setInput('ShiftLeft', false);
  game.setInput('ArrowRight', false);
  assert.ok(game.player.x > 285, 'sprinting must move faster than a walk');
  assert.ok(game.player.stamina < game.player.maxStamina, 'sprinting consumes stamina');
  advance(game, 1.5);
  assert.equal(game.player.stamina, game.player.maxStamina, 'stationary ground recovery restores stamina');
  game.player.x = 100;
  assert.equal(game.jump(), true);
  advance(game, 0.1);
  assert.ok(game.player.y < 400, 'jump must leave the ground');
  assert.equal(game.jump(), true);
  assert.ok(game.player.gliding, 'airborne second jump deploys glider');
  advance(game, 0.4);
  assert.ok(game.player.gliding);
  assert.ok(game.player.vy <= 64, 'glider must limit falling speed');
  assert.ok(game.player.stamina < game.player.maxStamina, 'glider consumes stamina');
  const tree = game.map.objects.find(object => object.type === 'tree');
  game.player.x = tree.x + 8;
  game.player.y = game.map.groundY - game.player.h;
  game.player.vx = 0;
  game.player.vy = 0;
  game.player.gliding = false;
  game.player.stamina = game.player.maxStamina;
  game.setInput('ArrowUp', true);
  advance(game, 0.3);
  game.setInput('ArrowUp', false);
  assert.ok(game.player.y < 390, 'climbing must move up the tree');
  assert.ok(game.player.stamina < game.player.maxStamina, 'climbing consumes stamina');
});

test('pause freezes simulation and a distant or exhausted rune cannot solve a shrine', t => {
  const { game } = makeGame(t);
  const before = { x: game.player.x, y: game.player.y, time: game.state.playTime };
  game.pause(true);
  game.setInput('ArrowRight', true);
  advance(game, 1);
  assert.deepEqual({ x: game.player.x, y: game.player.y, time: game.state.playTime }, before);
  game.pause(false);
  game.enterShrine('shrine-01');
  game.state.rune = 'wind';
  game.useRune();
  assert.equal(game.map.puzzle.solved, false, 'distant rune cannot activate shrine device');
  advance(game, 1);
  const mechanism = game.map.objects.find(object => object.id === game.map.puzzle.targetId);
  game.player.x = mechanism.x;
  game.player.y = mechanism.y;
  game.player.stamina = 0;
  game.useRune();
  assert.equal(game.map.puzzle.solved, false, 'exhausted player must recover before using rune');
});

test('food heals, consumes inventory, and arrows cannot be fired with an empty quiver', t => {
  const { game } = makeGame(t);
  game.player.hp = 1;
  game.state.inventory.food = 1;
  game.state.inventory.apple = 0;
  game.eat();
  assert.ok(game.player.hp > 1);
  assert.ok(game.player.hp <= game.player.maxHp);
  assert.equal(game.state.inventory.food, 0);
  const hp = game.player.hp;
  game.eat();
  assert.equal(game.player.hp, hp, 'empty inventory cannot heal');
  game.player.arrows = 0;
  const arrows = game.projectiles.length;
  game.shoot();
  assert.equal(game.projectiles.length, arrows);
  assert.equal(game.player.arrows, 0);
});

test('cooking requires a nearby campfire and trades gathered resources for food', t => {
  const { game } = makeGame(t);
  const fire = game.map.objects.find(object => object.type === 'campfire');
  assert.ok(fire, 'initial region should introduce cooking');
  game.state.inventory.apple = 3;
  game.state.inventory.wood = 3;
  game.state.inventory.food = 0;
  game.player.x = game.map.width - 160;
  game.cook();
  assert.equal(game.state.inventory.food, 0, 'remote cooking is disallowed');
  game.player.x = fire.x;
  game.player.y = game.map.groundY - game.player.h;
  game.cook();
  assert.ok(game.state.inventory.food > 0, 'campfire should create a meal');
  assert.ok(game.state.inventory.apple < 3 || game.state.inventory.wood < 3, 'cooking consumes supplies');
});

test('shrine treasure advertises interaction, opens once, and stays collected after revisit and reload', t => {
  const { game, storage } = makeGame(t);
  game.enterShrine('shrine-01');
  const chest = game.items.find(item => item.type === 'chest');
  assert.ok(chest, 'shrine must contain its optional treasure');
  const approach = (current, treasure) => {
    current.player.x = treasure.x;
    current.player.y = treasure.y;
  };
  const supplies = current => ({ rupees: current.player.rupees, arrows: current.player.arrows, apples: current.state.inventory.apple });
  approach(game, chest);
  assert.match(game.getSnapshot().interaction, /打开宝箱/, 'nearby treasure needs an actionable prompt');
  const before = supplies(game);
  game.interact();
  assert.equal(chest.collected, true);
  const rewarded = supplies(game);
  assert.deepEqual(rewarded, { rupees: before.rupees + 25, arrows: before.arrows + 6, apples: before.apples + 2 });
  assert.doesNotMatch(game.getSnapshot().interaction, /打开宝箱/, 'opened treasure should no longer prompt opening');
  game.interact();
  assert.deepEqual(supplies(game), rewarded, 'repeated E cannot grant rewards twice');
  game.exitShrine();
  game.enterShrine('shrine-01');
  const revisited = game.items.find(item => item.id === chest.id);
  assert.equal(revisited.collected, true, 'leaving a shrine cannot reset its treasure');
  approach(game, revisited);
  game.interact();
  assert.deepEqual(supplies(game), rewarded);
  game.save();
  const restored = makeGame(t, storage).game;
  assert.equal(restored.state.shrineId, 'shrine-01');
  const loadedChest = restored.items.find(item => item.id === chest.id);
  assert.equal(loadedChest.collected, true, 'saved treasure progress must survive reload');
  approach(restored, loadedChest);
  restored.interact();
  assert.deepEqual(supplies(restored), rewarded, 'reload cannot duplicate shrine treasure rewards');
});

test('the adventure remains playable when browser storage is missing or blocked', t => {
  const missing = makeGame(t, null).game;
  assert.doesNotThrow(() => { missing.save(); missing.reset(); advance(missing, 0.1); });
  assert.ok(missing.started && missing.player.hp > 0);
  const blockedStorage = {
    getItem() { throw new Error('Storage access blocked'); },
    setItem() { throw new Error('Storage access blocked'); },
    removeItem() { throw new Error('Storage access blocked'); },
  };
  const blocked = makeGame(t, blockedStorage).game;
  assert.equal(blocked.save(), false);
  assert.doesNotThrow(() => { blocked.reset(); advance(blocked, 0.1); });
  assert.ok(blocked.started && blocked.player.hp > 0);
});

test('all fifteen shrine puzzles reject a wrong rune and reward completion exactly once', t => {
  const { game } = makeGame(t);
  const runes = ['wind', 'magnet', 'stasis', 'bomb', 'flame'];
  for (const shrine of SHRINES) {
    game.enterMap(shrine.mapId);
    game.enterShrine(shrine.id);
    assert.equal(game.state.shrineId, shrine.id);
    assert.equal(game.map.puzzle.solved, false);
    game.player.x = game.map.altar.x;
    game.player.y = game.map.altar.y;
    game.interact();
    assert.ok(!game.state.completedShrines.includes(shrine.id), `${shrine.id}: unsolved altar cannot grant reward`);
    const target = game.map.objects.find(object => object.id === game.map.puzzle.targetId)
      ?? game.map.objects.find(object => object.type !== 'gate' && object.target)
      ?? game.map.objects.find(object => ['wind', 'metal', 'switch', 'crate', 'ice', 'torch', 'rock'].includes(object.type));
    assert.ok(target, `${shrine.id}: rune target missing`);
    game.player.x = target.x;
    game.player.y = target.y;
    game.player.stamina = game.player.maxStamina;
    game.state.rune = runes.find(rune => rune !== shrine.rune);
    game.useRune();
    assert.equal(game.map.puzzle.solved, false, `${shrine.id}: wrong rune must not solve puzzle`);
    game.player.stamina = game.player.maxStamina;
    game.state.rune = shrine.rune;
    advance(game, 1);
    game.player.x = target.x;
    game.player.y = target.y;
    game.useRune();
    if (shrine.rune === 'bomb') advance(game, 1);
    assert.equal(game.map.puzzle.solved, true, `${shrine.id}: matching rune should solve nearby device`);
    game.player.x = game.map.altar.x;
    game.player.y = game.map.altar.y;
    game.interact();
    assert.ok(game.state.completedShrines.includes(shrine.id), `${shrine.id}: altar must grant completion`);
    assert.equal(game.state.shrineId, null, `${shrine.id}: completion returns to overworld`);
    const completed = game.state.completedShrines.length;
    game.enterShrine(shrine.id);
    game.player.x = game.map.altar.x;
    game.player.y = game.map.altar.y;
    game.interact();
    assert.equal(game.state.completedShrines.length, completed, `${shrine.id}: no duplicate reward`);
    if (game.state.shrineId) game.exitShrine();
  }
  assert.equal(game.state.completedShrines.length, 15);
  assert.ok(game.player.maxHp > 6, 'shrine orbs should upgrade health');
  assert.equal(game.state.gameWon, false, 'all shrine rewards should unlock the finale, not skip the final battle');
  game.enterMap('map-10');
  const boss = game.enemies.find(enemy => enemy.isBoss);
  assert.ok(boss?.alive && !boss.dormant, 'final guardian must awaken after fifteen shrines');
  game.damageEnemy(boss, 999);
  assert.equal(game.state.gameWon, true, 'defeating the awakened guardian completes the story');
});

test('melee and arrows damage enemies, while the final guardian requires all shrines', t => {
  const { game } = makeGame(t);
  const enemy = game.enemies[0];
  game.enemies = [enemy];
  enemy.x = 600;
  enemy.y = 415;
  enemy.hp = 8;
  enemy.maxHp = 8;
  enemy.hurtTimer = 0;
  game.player.x = 555;
  game.player.y = 410;
  game.player.facing = 1;
  game.attack();
  assert.ok(enemy.hp < 8, 'sword must hit the nearby opponent');
  const afterAttack = enemy.hp;
  game.attack();
  assert.equal(enemy.hp, afterAttack, 'attack cooldown must prevent repeated instant hits');
  advance(game, 0.4);
  game.player.x = enemy.x - 80;
  game.player.y = enemy.y;
  game.player.facing = 1;
  const arrows = game.player.arrows;
  game.shoot();
  assert.equal(game.player.arrows, arrows - 1);
  advance(game, 0.3);
  assert.ok(enemy.hp < afterAttack, 'projectile collision must damage the enemy');
  game.enterMap('map-10');
  const boss = game.enemies.find(candidate => candidate.isBoss);
  assert.ok(boss?.dormant, 'guardian should be sealed until all shrine rewards are obtained');
  const hp = boss.hp;
  game.damageEnemy(boss, 999);
  assert.equal(boss.hp, hp);
  assert.equal(game.state.gameWon, false);
});

test('progress survives saving and death without unlocking unseen locations', t => {
  const { game, storage } = makeGame(t);
  game.enterMap('map-02');
  game.player.rupees = 37;
  game.state.inventory.ore = 4;
  game.state.completedShrines = ['shrine-01'];
  game.save();
  const restored = makeGame(t, storage).game;
  assert.equal(restored.player.rupees, 37);
  assert.equal(restored.state.inventory.ore, 4);
  assert.ok(restored.state.completedShrines.includes('shrine-01'));
  assert.ok(restored.state.visited.includes('map-02'));
  assert.ok(!restored.state.visited.includes('map-10'));
  restored.player.invuln = 0;
  restored.damagePlayer(999);
  advance(restored, 3);
  assert.ok(restored.player.hp > 0, 'death must recover to a living playable character');
  assert.ok(restored.state.completedShrines.includes('shrine-01'), 'death preserves shrine progress');
});
