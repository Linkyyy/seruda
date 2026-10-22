import test from 'node:test';
import assert from 'node:assert/strict';
import { MAPS, SHRINES, createMap, createShrine, validateWorld } from '../src/world.js';

test('ten regions form one traversable route and every shrine belongs to its region', () => {
  assert.equal(MAPS.length, 10);
  assert.equal(new Set(MAPS.map(map => map.id)).size, 10);
  const reached = new Set();
  let id = 'map-01';
  let previous = null;
  while (id) {
    assert.ok(!reached.has(id), `region route cycles at ${id}`);
    reached.add(id);
    const map = createMap(id);
    assert.equal(map.exits.left, previous);
    assert.ok(map.width >= 2400);
    assert.ok(map.platforms.some(p => p.x <= map.spawn.x && p.x + p.w >= map.spawn.x + 18 && p.y >= map.spawn.y), `${id}: spawn must have a floor`);
    for (const entry of map.shrines) {
      const shrine = SHRINES.find(s => s.id === entry.id);
      assert.ok(shrine, `${entry.id}: metadata missing`);
      assert.equal(shrine.mapId, map.id);
      assert.ok(entry.x >= 0 && entry.x + 40 < map.width, `${entry.id}: entrance outside region`);
      assert.ok(map.platforms.some(p => p.x <= entry.x + 20 && p.x + p.w >= entry.x + 20 && p.y >= entry.y - 4), `${entry.id}: entrance needs accessible floor`);
    }
    previous = id;
    id = map.exits.right;
  }
  assert.equal(reached.size, 10);
  const entrances = MAPS.flatMap(map => createMap(map.id).shrines.map(s => s.id));
  assert.equal(entrances.length, 15);
  assert.equal(new Set(entrances).size, 15);
  assert.deepEqual(new Set(entrances), new Set(SHRINES.map(s => s.id)));
  assert.deepEqual(validateWorld(), []);
});

test('fifteen authored shrines have five rune puzzle families and reachable reward areas', () => {
  assert.equal(SHRINES.length, 15);
  assert.equal(new Set(SHRINES.map(s => s.name)).size, 15);
  assert.deepEqual(new Set(SHRINES.map(s => s.rune)), new Set(['wind', 'magnet', 'stasis', 'bomb', 'flame']));
  for (const meta of SHRINES) {
    const room = createShrine(meta.id);
    assert.equal(room.id, meta.id);
    assert.equal(room.puzzle.type, meta.puzzle);
    assert.equal(room.puzzle.solved, false);
    assert.ok(meta.hint.length > 3);
    assert.ok(room.altar.x > room.spawn.x + 500, `${meta.id}: reward requires traversal`);
    assert.ok(room.altar.x + room.altar.w <= room.width, `${meta.id}: altar in bounds`);
    assert.ok(room.objects.some(o => o.type === 'gate'), `${meta.id}: rune puzzle must gate reward`);
    assert.ok(room.platforms.some(p => p.x <= room.altar.x && p.x + p.w >= room.altar.x + room.altar.w && p.y >= room.altar.y), `${meta.id}: altar needs floor`);
  }
});

test('factories isolate mutable enemies, items and shrine puzzle progress', () => {
  const first = createMap('map-01');
  const second = createMap('map-01');
  first.enemies[0].hp = -99;
  first.items[0].collected = true;
  first.platforms[0].w = 1;
  assert.notEqual(second.enemies[0].hp, -99);
  assert.notEqual(second.items[0].collected, true);
  assert.notEqual(second.platforms[0].w, 1);
  const shrine = createShrine('shrine-01');
  shrine.puzzle.solved = true;
  shrine.objects[0].active = true;
  assert.equal(createShrine('shrine-01').puzzle.solved, false);
});
