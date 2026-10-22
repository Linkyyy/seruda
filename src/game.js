import { MAPS, SHRINES, createMap, createShrine } from './world.js';
import { Renderer } from './render.js';

const SAVE_KEY = 'wilds-of-the-wind-v1';
export const RUNES = ['wind', 'magnet', 'stasis', 'bomb', 'flame'];
const RUNE_NAMES = { wind: '乘风', magnet: '磁引', stasis: '时停', bomb: '遥控炸弹', flame: '焰息' };
const PUZZLE_OBJECTS = {
  wind: ['wind'], magnet: ['metal'], stasis: ['switch', 'rock'],
  bomb: ['crate', 'rock'], flame: ['ice', 'torch'],
};
const clamp = (n, min, max) => Math.max(min, Math.min(max, n));
const overlap = (a, b) => a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
const center = (a) => ({ x: a.x + (a.w || 0) / 2, y: a.y + (a.h || 0) / 2 });
const distance = (a, b) => Math.hypot(center(a).x - center(b).x, center(a).y - center(b).y);
const number = (n, fallback) => Number.isFinite(n) ? n : fallback;

function normalizeKey(key) {
  if (key === ' ' || key === 'Space' || key === 'Spacebar') return 'space';
  if (/^Key[A-Z]$/.test(key)) return key.slice(3).toLowerCase();
  if (/^Shift/.test(key)) return 'shift';
  return String(key).toLowerCase();
}

function freshState() {
  return {
    mapId: 'map-01', shrineId: null, visited: ['map-01'], completedShrines: [],
    inventory: { apple: 3, wood: 0, ore: 0, food: 2 }, rune: 'wind',
    questStage: 0, paused: false, started: false, weather: 'clear',
    gameWon: false, playTime: 0, mapProgress: {}, activatedTowers: [],
  };
}

function freshPlayer() {
  return {
    x: 100, y: 390, w: 18, h: 30, vx: 0, vy: 0, facing: 1,
    onGround: false, hp: 6, maxHp: 6, stamina: 100, maxStamina: 100,
    arrows: 24, rupees: 0, orbs: 0, gliding: false, climbing: false,
    attackTimer: 0, invuln: 0, hurtTimer: 0, climbTimer: 0,
  };
}

/** A dependency-free, fixed-world-pixel adventure simulation. */
export class Game {
  constructor(canvas, options = {}) {
    this.canvas = canvas;
    this.onUpdate = options.onUpdate || (() => {});
    this.onEvent = options.onEvent || (() => {});
    this.renderer = options.renderer || new Renderer(canvas);
    this.state = freshState();
    this.player = freshPlayer();
    this.camera = { x: 0, y: 0 };
    this.viewportWidth = 960;
    this.keys = new Set();
    this.effects = [];
    this.projectiles = [];
    this.enemies = [];
    this.items = [];
    this.worldCache = new Map();
    this.time = 0;
    this.started = false;
    this.destroyed = false;
    this.runeCooldown = 0;
    this.arrowCooldown = 0;
    this.staminaDelay = 0;
    this.notifyClock = 0;
    this.saveClock = 0;
    this.interaction = '';
    this.returnPosition = null;
    this.lastFrame = null;
    this._restore();
    this.enterMap(this.state.mapId, { spawn: this.savedPosition, silent: true });
    if (this.savedShrineId && SHRINES.some((s) => s.id === this.savedShrineId)) {
      this.enterShrine(this.savedShrineId, { silent: true });
    }
    this._keyDown = (event) => {
      if (/^(INPUT|TEXTAREA|SELECT)$/.test(event.target?.tagName) || event.target?.isContentEditable) return;
      const key = normalizeKey(event.code || event.key);
      if (['space', 'arrowleft', 'arrowright', 'arrowup', 'arrowdown'].includes(key) && this.started) event.preventDefault();
      if (!event.repeat) this.setInput(key, true);
    };
    this._keyUp = (event) => this.setInput(event.code || event.key, false);
    this._blur = () => { this.keys.clear(); if (this.started && !this.state.paused) this.pause(true); this.save(); };
    this._beforeUnload = () => this.save();
    if (typeof window !== 'undefined') {
      window.addEventListener('keydown', this._keyDown);
      window.addEventListener('keyup', this._keyUp);
      window.addEventListener('blur', this._blur);
      window.addEventListener('pagehide', this._beforeUnload);
    }
    this._frame = (timestamp) => {
      if (this.destroyed) return;
      const dt = this.lastFrame === null ? 1 / 60 : clamp((timestamp - this.lastFrame) / 1000, 0, 1 / 30);
      this.lastFrame = timestamp;
      this.time += dt;
      if (this.started && !this.state.paused) this.update(dt);
      this.renderer.render(this);
      this.notifyClock += dt;
      if (this.notifyClock > 0.1) { this.notifyClock = 0; this._notify(); }
      this.frameHandle = requestAnimationFrame(this._frame);
    };
    this.renderer.render(this);
    if (options.autoLoop !== false && typeof requestAnimationFrame === 'function') {
      this.frameHandle = requestAnimationFrame(this._frame);
    }
  }

  _restore() {
    try {
      const raw = globalThis.localStorage?.getItem(SAVE_KEY);
      if (!raw) return;
      const saved = JSON.parse(raw);
      if (saved.version !== 1 || !saved.state) return;
      const s = saved.state;
      if (!MAPS.some((m) => m.id === s.mapId)) return;
      this.state.mapId = s.mapId;
      this.state.visited = [...new Set(['map-01', ...(Array.isArray(s.visited) ? s.visited.filter((id) => MAPS.some((m) => m.id === id)) : [])])];
      this.state.completedShrines = [...new Set(Array.isArray(s.completedShrines) ? s.completedShrines.filter((id) => SHRINES.some((m) => m.id === id)) : [])];
      this.state.rune = RUNES.includes(s.rune) ? s.rune : 'wind';
      this.state.inventory = Object.fromEntries(['apple', 'wood', 'ore', 'food'].map((key) => [key, clamp(Math.floor(number(s.inventory?.[key], this.state.inventory[key])), 0, 999)]));
      this.state.gameWon = Boolean(s.gameWon && this.state.completedShrines.length === SHRINES.length);
      this.state.playTime = Math.max(0, number(s.playTime, 0));
      this.state.mapProgress = s.mapProgress && typeof s.mapProgress === 'object' ? s.mapProgress : {};
      this.state.activatedTowers = Array.isArray(s.activatedTowers) ? s.activatedTowers : [];
      const p = saved.player || {};
      this.player.orbs = this.state.completedShrines.length;
      this.player.maxHp = 6 + Math.floor(this.player.orbs / 4) * 2;
      this.player.hp = clamp(number(p.hp, this.player.maxHp), 1, this.player.maxHp);
      this.player.arrows = clamp(Math.floor(number(p.arrows, 24)), 0, 999);
      this.player.rupees = clamp(Math.floor(number(p.rupees, 0)), 0, 99999);
      if (Number.isFinite(p.x) && Number.isFinite(p.y)) this.savedPosition = { x: p.x, y: p.y };
      this.savedShrineId = s.shrineId;
      this.hasSave = true;
    } catch { /* Storage is optional; a malformed/blocked save never prevents play. */ }
  }

  _event(type, extra = {}) { this.onEvent({ type, ...extra }); }
  _sound(name) { this._event('sound', { name }); }
  _toast(text, kind = 'info') { this._event('toast', { text, kind }); }
  _notify() { this.onUpdate(this.getSnapshot()); }

  start() {
    this.started = true;
    this.state.started = true;
    this.state.paused = false;
    this.keys.clear();
    this._notify();
    this._toast(this.hasSave ? '风还记得你的旅途。欢迎回来。' : '向右踏上旅途。靠近石碑与神庙时按 E 探索。', 'success');
    this.hasSave = true;
    return this;
  }

  pause(value = true) {
    this.state.paused = Boolean(value);
    this.keys.clear();
    this._notify();
    if (value) this.save();
    return this.state.paused;
  }

  togglePause() { return this.pause(!this.state.paused); }

  setViewport(width = 960) {
    if (!Number.isFinite(width)) return;
    const next = clamp(Math.round(width / 2) * 2, 320, 960);
    if (next === this.viewportWidth) return;
    this.viewportWidth = next;
    this.renderer.resize?.(next);
    if (this.map) this.camera.x = this._cameraTarget();
  }

  _cameraTarget() {
    return clamp(this.player.x - this.viewportWidth * 0.35, 0, Math.max(0, this.map.width - this.viewportWidth));
  }

  setInput(key, pressed) {
    const normalized = normalizeKey(key);
    const wasPressed = this.keys.has(normalized);
    if (pressed) this.keys.add(normalized); else this.keys.delete(normalized);
    if (!pressed || wasPressed || !this.started || this.state.paused) return;
    const actions = {
      space: () => this.jump(), j: () => this.attack(), k: () => this.shoot(),
      e: () => this.interact(), f: () => this.useRune(), r: () => this.cycleRune(),
      q: () => this.eat(), c: () => this.cook(),
    };
    actions[normalized]?.();
  }

  _makeEnemies(map, progress = {}) {
    const defeated = progress.defeated || [];
    const enemies = (map.enemies || []).map((e, index) => {
      const guardian = e.type === 'guardian';
      const bat = e.type === 'bat';
      const hp = number(e.hp, guardian ? 12 : bat ? 3 : 4);
      return {
        ...e, id: e.id || `${map.id}-enemy-${index}`, x: e.x, y: e.y,
        startX: e.x, startY: e.y, w: number(e.w, guardian ? 42 : bat ? 23 : 24),
        h: number(e.h, guardian ? 40 : bat ? 18 : 25),
        vx: 0, vy: 0, hp, maxHp: hp, alive: !defeated.includes(e.id),
        facing: -1, onGround: false, hurtTimer: 0, attackTimer: 0,
        frozenTime: 0, shotTimer: 1.2 + index * 0.2, patrol: number(e.patrol, 130),
      };
    });
    if (map.id === 'map-10') {
      let boss = enemies.filter((e) => e.type === 'guardian').sort((a, b) => b.x - a.x)[0];
      if (!boss) {
        boss = { id: 'final-guardian', type: 'guardian', x: map.width - 270, y: map.groundY - 48, startX: map.width - 270, startY: map.groundY - 48, w: 48, h: 48, vx: 0, vy: 0, onGround: false, facing: -1, hp: 36, maxHp: 36, hurtTimer: 0, attackTimer: 0, frozenTime: 0, shotTimer: 1.5, patrol: 100, alive: true };
        enemies.push(boss);
      }
      boss.isBoss = true;
      boss.name = '遗迹守望者';
      boss.maxHp = 36;
      boss.hp = 36;
      boss.alive = !this.state.gameWon;
      boss.dormant = this.state.completedShrines.length < SHRINES.length;
    }
    return enemies;
  }

  _captureProgress() {
    if (!this.map) return;
    this.state.mapProgress[this.map.id] = {
      collected: this.items.filter((i) => i.collected).map((i) => i.id),
      defeated: this.enemies.filter((e) => !e.alive && !e.isBoss).map((e) => e.id),
      activated: (this.map.objects || []).filter((o) => o.active || o.destroyed || o.open).map((o) => o.id),
    };
  }

  enterMap(id, options = {}) {
    const metadata = MAPS.find((m) => m.id === id);
    if (!metadata) return false;
    this._captureProgress();
    if (this.map && !this.state.shrineId) this.worldCache.set(this.map.id, { map: this.map, enemies: this.enemies, items: this.items });
    this.state.mapId = id;
    this.state.shrineId = null;
    let cached = this.worldCache.get(id);
    if (!cached) {
      const map = createMap(id);
      if (!map) return false;
      const progress = this.state.mapProgress[id] || {};
      for (const o of map.objects || []) {
        if ((progress.activated || []).includes(o.id)) {
          o.active = true;
          if (['crate', 'ice'].includes(o.type)) o.destroyed = true;
          if (o.type === 'gate') o.open = true;
        }
      }
      cached = {
        map, enemies: this._makeEnemies(map, progress),
        items: (map.items || []).map((i, n) => ({ ...i, id: i.id || `${id}-item-${n}`, w: i.w || 13, h: i.h || 13, collected: (progress.collected || []).includes(i.id) })),
      };
      this.worldCache.set(id, cached);
    }
    this.map = cached.map;
    this.enemies = cached.enemies;
    this.items = cached.items;
    for (const boss of this.enemies.filter((e) => e.isBoss)) boss.dormant = this.state.completedShrines.length < SHRINES.length;
    for (const gate of (this.map.objects || []).filter((o) => o.type === 'gate' && o.final)) {
      gate.open = this.state.completedShrines.length >= (gate.requiredOrbs || SHRINES.length);
      gate.active = gate.open;
    }
    this.state.weather = this.map.weather || 'clear';
    if (!this.state.visited.includes(id)) {
      this.state.visited.push(id);
      if (!options.silent) this._toast(`发现新地域 · ${this.map.name}`, 'success');
    }
    const spawn = options.spawn || this.map.spawn || { x: 100, y: this.map.groundY - 50 };
    this._positionPlayer(spawn);
    this.camera.x = this._cameraTarget();
    this.projectiles.length = 0;
    this.effects.length = 0;
    this.runeCooldown = 0;
    this.interaction = this._getInteraction();
    if (!options.silent) { this._sound('travel'); this.save(); this._notify(); }
    return true;
  }

  _positionPlayer(spawn) {
    const p = this.player;
    p.x = clamp(number(spawn.x, 100), 2, this.map.width - p.w - 2);
    p.y = clamp(number(spawn.y, this.map.groundY - 50), -100, 470);
    p.vx = 0; p.vy = 0; p.onGround = false; p.climbing = false; p.gliding = false;
    p.stamina = p.maxStamina; p.invuln = 1;
  }

  enterShrine(id, options = {}) {
    const metadata = SHRINES.find((s) => s.id === id);
    if (!metadata || (metadata.mapId !== this.state.mapId && !options.silent)) return false;
    this._captureProgress();
    if (!this.state.shrineId) {
      this.returnPosition = { x: this.player.x, y: this.player.y };
      this.worldCache.set(this.map.id, { map: this.map, enemies: this.enemies, items: this.items });
    }
    this.map = createShrine(id);
    if (!this.map) return false;
    this.state.shrineId = id;
    this.state.weather = 'clear';
    const progress = this.state.mapProgress[id] || {};
    this.enemies = this._makeEnemies(this.map, progress);
    this.items = (this.map.items || []).map((i, n) => ({ ...i, id: i.id || `${id}-item-${n}`, w: i.w || 13, h: i.h || 13, collected: (progress.collected || []).includes(i.id) }));
    this.projectiles.length = 0;
    this.effects.length = 0;
    this._positionPlayer(this.map.spawn || { x: 100, y: 390 });
    this.camera.x = 0;
    this.runeCooldown = 0;
    if (this.state.completedShrines.includes(id)) this._openShrine();
    if (!options.silent) {
      this._sound('shrine');
      this._toast(`${metadata.name}：${metadata.hint}`, 'info');
      this.save();
      this._notify();
    }
    return true;
  }

  exitShrine() {
    if (!this.state.shrineId) return false;
    const entrance = this.worldCache.get(this.state.mapId)?.map.shrines.find((s) => s.id === this.state.shrineId);
    const spawn = this.returnPosition || (entrance ? { x: entrance.x - 40, y: entrance.y - 50 } : null);
    // Keep shrineId set until enterMap: shrine geometry must never replace an overworld cache.
    this.enterMap(this.state.mapId, { spawn, silent: true });
    this.returnPosition = null;
    this._sound('travel');
    this.save();
    this._notify();
    return true;
  }

  travel(id) {
    if (!this.state.visited.includes(id)) { this._toast('尚未抵达这片土地。沿着荒野向前探索吧。', 'warning'); return false; }
    if (!MAPS.some((m) => m.id === id)) return false;
    this.enterMap(id, { silent: true });
    this._toast(`传送抵达 · ${this.map.name}`, 'success');
    this._sound('travel');
    this.save();
    this._notify();
    return true;
  }

  jump() {
    const p = this.player;
    if (!this.started || this.state.paused) return false;
    if (p.onGround || p.climbing) {
      p.vy = -455; p.onGround = false; p.climbing = false; p.gliding = false;
      this._sound('jump');
      this._burst(p.x + 8, p.y + p.h, '#c8dd9f', 5, 'dust');
      return true;
    }
    if (p.stamina > 5) {
      p.gliding = !p.gliding;
      if (p.gliding) { p.vy = Math.min(p.vy, 35); this._sound('glider'); }
      return true;
    }
    return false;
  }

  attack() {
    const p = this.player;
    if (!this.started || this.state.paused || p.attackTimer > 0) return false;
    p.attackTimer = 0.31;
    this._sound('attack');
    const hitbox = { x: p.facing > 0 ? p.x + 4 : p.x - 60, y: p.y - 8, w: 74, h: p.h + 14 };
    this.effects.push({ type: 'slash', x: p.x + (p.facing > 0 ? 28 : -16), y: p.y + 12, facing: p.facing, life: 0.2, maxLife: 0.2, color: '#f9edbd', radius: 35 });
    for (const enemy of this.enemies) {
      if (enemy.alive && overlap(hitbox, enemy)) this.damageEnemy(enemy, enemy.frozenTime > 0 ? 4 : 2, p.facing * 90);
    }
    for (const object of this.map.objects || []) {
      if (object.destroyed || !overlap(hitbox, { ...object, w: object.w || 25, h: object.h || 35 })) continue;
      if (object.type === 'tree' && !object.harvested) {
        object.harvested = true;
        this._drop('apple', object.x + (object.w || 20) / 2, p.y - 10);
        this._drop('wood', object.x + (object.w || 20) / 2 + 18, p.y);
        this._burst(object.x + 10, p.y, '#8dbd66', 8);
      }
      if (object.type === 'rock' && !object.harvested && !this.state.shrineId) {
        object.harvested = true;
        this._drop('ore', object.x + 10, object.y - 8);
        this._burst(object.x + 10, object.y, '#b5c6c3', 5);
      }
      if (object.type === 'crate' && !this.state.shrineId) {
        object.destroyed = true; object.active = true;
        this._drop('rupee', object.x + 10, object.y);
        this._drop('arrow', object.x + 25, object.y - 6);
        this._burst(object.x + 10, object.y, '#ac8057', 8);
      }
    }
    return true;
  }

  shoot() {
    const p = this.player;
    if (!this.started || this.state.paused || this.arrowCooldown > 0) return false;
    if (p.arrows <= 0) { this._toast('箭袋空了。搜寻木箱，或在营火用木材制作箭矢。', 'warning'); return false; }
    p.arrows -= 1;
    this.arrowCooldown = 0.34;
    this.projectiles.push({ type: 'arrow', x: p.x + p.w / 2 + p.facing * 14, y: p.y + 12, w: 15, h: 4, vx: p.facing * 560, vy: -18, life: 1.8, owner: 'player' });
    this._sound('shoot');
    return true;
  }

  cycleRune() {
    this.state.rune = RUNES[(RUNES.indexOf(this.state.rune) + 1) % RUNES.length];
    this._sound('menu');
    this._toast(`已切换符文 · ${RUNE_NAMES[this.state.rune]}`);
    this._notify();
    return this.state.rune;
  }

  _puzzleTarget() {
    const type = this.map.puzzle?.type || this.map.puzzle?.rune;
    const types = PUZZLE_OBJECTS[type] || [];
    const candidates = (this.map.objects || []).filter((o) => !o.destroyed && types.includes(o.type));
    const explicit = candidates.filter((o) => o.id === this.map.puzzle?.targetId || o.puzzleTarget || (o.puzzle && (!o.rune || o.rune === type)));
    return (explicit.length ? explicit : candidates).sort((a, b) => distance(this.player, a) - distance(this.player, b))[0];
  }

  useRune() {
    if (!this.started || this.state.paused || this.runeCooldown > 0) return false;
    const p = this.player;
    const rune = this.state.rune;
    if (p.stamina < 8) { this._toast('体力不足，站稳脚步恢复片刻。', 'warning'); return false; }
    p.stamina = Math.max(0, p.stamina - 8);
    this.staminaDelay = 0.45;
    this.runeCooldown = rune === 'stasis' ? 2.2 : rune === 'bomb' ? 1.1 : 0.8;
    const colors = { wind: '#c6ffe3', magnet: '#db9cff', stasis: '#f5db73', bomb: '#7bd6f6', flame: '#ffb56a' };
    this.effects.push({ type: rune, x: p.x + p.w / 2, y: p.y + 8, radius: 70, life: 0.65, maxLife: 0.65, color: colors[rune], facing: p.facing });
    this._sound('rune');
    const target = this._puzzleTarget();
    const correctPuzzle = Boolean(this.state.shrineId && !this.map.puzzle?.solved && this.map.puzzle?.type === rune && target && distance(p, target) < 235);

    if (rune === 'wind') {
      p.vy = -360; p.onGround = false; p.gliding = true;
      for (const e of this.enemies) if (e.alive && distance(p, e) < 180) { this.damageEnemy(e, 1, p.facing * 170); e.vy = -180; }
    } else if (rune === 'magnet') {
      for (const item of this.items) if (!item.collected && item.type !== 'chest' && distance(p, item) < 260) this._collect(item);
      for (const object of this.map.objects || []) if (object.type === 'metal' && distance(p, object) < 235) {
        object.active = true;
        if (!this.state.shrineId) { object.x += p.facing * 70; object.y = Math.max(300, object.y - 24); }
      }
      for (const e of this.enemies) if (e.alive && e.type === 'guardian' && distance(p, e) < 170) this.damageEnemy(e, 3);
    } else if (rune === 'stasis') {
      for (const e of this.enemies) if (e.alive && distance(p, e) < 230 && !e.dormant) { e.frozenTime = e.isBoss ? 2.3 : 4; e.vx = 0; }
      for (const object of this.map.objects || []) if (distance(p, object) < 235) object.frozenTime = 4;
    } else if (rune === 'bomb') {
      this.projectiles.push({ type: 'bomb', x: p.x + p.w / 2 + p.facing * 15, y: p.y + 4, w: 13, h: 13, vx: p.facing * 180, vy: -190, life: 0.85, solveShrineId: correctPuzzle ? this.state.shrineId : null });
    } else if (rune === 'flame') {
      for (const e of this.enemies) if (e.alive && distance(p, e) < 160) this.damageEnemy(e, 3, p.facing * 50);
      for (const object of this.map.objects || []) if (distance(p, object) < 225) {
        if (object.type === 'ice') { object.active = true; object.destroyed = true; this._burst(object.x, object.y, '#bcecf3', 10); }
        if (object.type === 'torch' || object.type === 'campfire') object.active = true;
        if (object.type === 'grass') { object.burned = true; this._burst(object.x, object.y, '#ffb56a', 5); }
      }
    }
    if (correctPuzzle && rune !== 'bomb') this.solveShrine();
    else if (this.state.shrineId && !this.map.puzzle?.solved && rune !== this.map.puzzle?.type) {
      this._toast(`这里的机关需要「${RUNE_NAMES[this.map.puzzle?.type] || '对应'}」符文。按 R 切换。`, 'warning');
    } else if (this.state.shrineId && !this.map.puzzle?.solved && !correctPuzzle) {
      this._toast('靠近发光机关再施放符文。神庙入口的石碑记着线索。');
    }
    return true;
  }

  _openShrine() {
    if (!this.map.puzzle) this.map.puzzle = { type: 'wind', solved: false };
    this.map.puzzle.solved = true;
    for (const o of this.map.objects || []) {
      if (o.type === 'gate') { o.open = true; o.active = true; }
      if (['switch', 'wind', 'metal', 'torch'].includes(o.type)) o.active = true;
      if (['ice', 'crate'].includes(o.type)) { o.destroyed = true; o.active = true; }
    }
    // A powered causeway is the tangible result of solving the shrine's mechanism.
    // It also keeps every authored room accessible without pixel-perfect jumps.
    if (!this.map.platforms.some((p) => p.id === 'rune-causeway')) {
      this.map.platforms.push({ id: 'rune-causeway', x: 420, y: this.map.groundY || 440, w: this.map.width - 820, h: 28, kind: 'stone', magical: true });
    }
  }

  solveShrine() {
    if (!this.state.shrineId || !this.map.puzzle || this.map.puzzle.solved) return false;
    const target = this._puzzleTarget();
    if (this.state.rune !== this.map.puzzle.type || !target || distance(this.player, target) >= 235) return false;
    this._openShrine();
    this._sound('complete');
    this._toast('机关已苏醒 · 通路开启。前往尽头的祭坛，按 E 领取灵光。', 'success');
    this._burst(this.player.x + 10, this.player.y, '#b7eedb', 18);
    return true;
  }

  completeShrine() {
    const id = this.state.shrineId;
    if (!id || !this.map.altar || distance(this.player, this.map.altar) > 90) return false;
    if (!this.map.puzzle?.solved) { this._toast('祭坛尚未被唤醒。先解开这座神庙的符文机关。', 'warning'); return false; }
    if (this.state.completedShrines.includes(id)) {
      this._toast('这座神庙的灵光已被收集。');
      this.exitShrine();
      return false;
    }
    this.state.completedShrines.push(id);
    this.player.orbs = this.state.completedShrines.length;
    const oldMax = this.player.maxHp;
    this.player.maxHp = 6 + Math.floor(this.player.orbs / 4) * 2;
    this.player.hp = this.player.maxHp;
    this.player.stamina = this.player.maxStamina;
    this.player.arrows += 4;
    const name = SHRINES.find((s) => s.id === id)?.name || '神庙';
    this._event('shrineComplete', { id, name });
    this._sound('shrineComplete');
    this.exitShrine();
    this._toast(`${name} · 获得灵光 ${this.player.orbs}/${SHRINES.length}${this.player.maxHp > oldMax ? ' · 生命上限提升！' : ' · 生命已恢复'}`, 'success');
    if (this.state.completedShrines.length === SHRINES.length) this._toast(`十五道灵光汇聚。前往${MAPS[MAPS.length - 1].name}，唤醒并击败遗迹守望者！`, 'success');
    this.save();
    this._notify();
    return true;
  }

  _nearObject(type, range = 90) {
    return (this.map.objects || []).find((o) => o.type === type && !o.destroyed && distance(this.player, o) < range);
  }

  _nearShrine() {
    return (this.map.shrines || []).find((s) => Math.abs(this.player.x + this.player.w / 2 - s.x) < 90 && Math.abs(this.player.y + this.player.h - s.y) < 100);
  }

  _nearChest() {
    return this.items.find((item) => !item.collected && item.type === 'chest' && distance(this.player, item) < 65);
  }

  _openChest(chest = this._nearChest()) {
    if (!chest || chest.collected || !this.items.includes(chest) || distance(this.player, chest) >= 65) return false;
    chest.collected = true;
    this.player.rupees += 25;
    this.player.arrows += 6;
    this.state.inventory.apple += 2;
    this._sound('pickup');
    this._toast('打开宝箱 · 25 星币、6 支箭、2 枚苹果', 'success');
    this._burst(chest.x, chest.y, '#f9dc87', 12);
    this.save();
    this._notify();
    return true;
  }

  _getInteraction() {
    if (this.state.shrineId) {
      if (this.player.x < 145) return 'E  返回荒野';
      if (this.map.altar && distance(this.player, this.map.altar) < 90) return this.map.puzzle?.solved ? 'E  触碰祭坛 · 领取灵光' : '祭坛沉睡中 · 解开机关';
      if (this._nearChest()) return 'E  打开宝箱';
      const sign = this._nearObject('sign', 85);
      if (sign) return 'E  阅读机关线索';
      const target = this._puzzleTarget();
      if (!this.map.puzzle?.solved && target && distance(this.player, target) < 235) return `R 切换符文 · F 施放${RUNE_NAMES[this.map.puzzle.type] || '符文'}`;
      return this.map.puzzle?.solved ? '通路开启 · 前往右侧祭坛' : '寻找机关 · R 切换符文';
    }
    const shrine = this._nearShrine();
    if (shrine) return this.state.completedShrines.includes(shrine.id) ? 'E  重访已完成神庙' : 'E  进入神庙';
    if (this._nearChest()) return 'E  打开宝箱';
    if (this._nearObject('campfire', 100)) return 'C  烹饪 · E  营火休憩';
    if (this._nearObject('tower', 130)) return 'E  激活瞭望塔';
    if (this._nearObject('sign', 85)) return 'E  阅读路牌';
    return '';
  }

  interact() {
    if (!this.started || this.state.paused) return false;
    if (this.state.shrineId) {
      if (this.player.x < 145) return this.exitShrine();
      if (this.map.altar && distance(this.player, this.map.altar) < 90) return this.completeShrine();
      if (this._nearChest()) return this._openChest();
      const sign = this._nearObject('sign', 100);
      this._toast(sign?.text || this.map.puzzle?.hint || SHRINES.find((s) => s.id === this.state.shrineId)?.hint || '用符文唤醒机关，然后前往右侧祭坛。');
      return true;
    }
    const shrine = this._nearShrine();
    if (shrine) return this.enterShrine(shrine.id);
    if (this._nearChest()) return this._openChest();
    const fire = this._nearObject('campfire', 100);
    if (fire) {
      fire.active = true;
      this.player.stamina = this.player.maxStamina;
      if (!fire.rested) { this.player.hp = Math.min(this.player.maxHp, this.player.hp + 2); fire.rested = true; }
      this.checkpoint = { mapId: this.state.mapId, x: fire.x - 28, y: fire.y - this.player.h };
      this._toast('营火温暖了你 · 体力恢复。按 C 用两枚苹果烹饪，或用木材制作箭矢。', 'success');
      this._sound('cook');
      this.save();
      return true;
    }
    const tower = this._nearObject('tower', 130);
    if (tower) {
      tower.active = true;
      const id = `${this.state.mapId}:${tower.id}`;
      if (!this.state.activatedTowers.includes(id)) { this.state.activatedTowers.push(id); this.player.rupees += 10; }
      this.player.stamina = this.player.maxStamina;
      this._toast(`${this.map.name}瞭望塔已点亮。按 M 查看地图，可传送到已抵达地域。`, 'success');
      this._sound('shrine'); this.save();
      return true;
    }
    const sign = this._nearObject('sign', 100);
    if (sign) { this._toast(sign.text || this.map.description); return true; }
    this._toast('靠近神庙、路牌、宝箱或营火，再按 E 互动。');
    return false;
  }

  cook() {
    if (!this.started || this.state.paused) return false;
    if (!this._nearObject('campfire', 110)) { this._toast('烹饪和制箭需要营火。寻找荒野里的橙色火光。', 'warning'); return false; }
    const inventory = this.state.inventory;
    if (inventory.apple >= 2) {
      inventory.apple -= 2; inventory.food += 1;
      this._toast('烹饪成功 · 烤苹果餐 +1，可恢复 2 颗心。按 Q 食用。', 'success');
      this._sound('cook'); this._burst(this.player.x, this.player.y, '#ffc778', 8);
      this.save(); this._notify(); return true;
    }
    if (inventory.wood >= 2) {
      inventory.wood -= 2; this.player.arrows += 8;
      this._toast('制作成功 · 消耗 2 份木材，获得 8 支箭。', 'success');
      this._sound('cook'); this.save(); this._notify(); return true;
    }
    this._toast('材料不足：两枚苹果可烹饪一餐，两份木材可制作八支箭。', 'warning');
    return false;
  }

  eat() {
    if (!this.started || this.state.paused) return false;
    if (this.player.hp >= this.player.maxHp) { this._toast('生命已满，留些食物给下一段旅程吧。'); return false; }
    const inventory = this.state.inventory;
    let heal = 0;
    if (inventory.food > 0) { inventory.food -= 1; heal = 4; }
    else if (inventory.apple > 0) { inventory.apple -= 1; heal = 1; }
    else { this._toast('行囊里没有食物了。树下和木箱里也许藏着苹果。', 'warning'); return false; }
    this.player.hp = Math.min(this.player.maxHp, this.player.hp + heal);
    this._sound('eat'); this._toast(`食物让你恢复了 ${heal / 2} 颗心。`, 'success');
    this._burst(this.player.x + 9, this.player.y, '#f5b4a9', 8);
    this.save(); this._notify(); return true;
  }

  _collisionRects() {
    const objects = (this.map.objects || []).filter((o) => {
      if (o.destroyed || o.open) return false;
      if (o.type === 'gate') return !o.active;
      return Boolean(o.solid || ['metal', 'ice', 'crate'].includes(o.type));
    });
    return [...this.map.platforms, ...objects].filter((r) => r.w > 0 && r.h > 0);
  }

  _moveBody(entity, dt, rects, options = {}) {
    const oldY = entity.y;
    entity.x += entity.vx * dt;
    for (const rect of rects) {
      if (!overlap(entity, rect)) continue;
      // One-way platforms keep bridges and thin wooden shelves forgiving.
      if (rect.oneWay || rect.kind === 'wood' || rect.magical) continue;
      if (entity.vx > 0) entity.x = rect.x - entity.w;
      else if (entity.vx < 0) entity.x = rect.x + rect.w;
      entity.vx = 0;
    }
    entity.y += entity.vy * dt;
    entity.onGround = false;
    for (const rect of rects) {
      if (!overlap(entity, rect)) continue;
      const oneWay = rect.oneWay || rect.kind === 'wood' || rect.magical;
      if (entity.vy >= 0 && oldY + entity.h <= rect.y + Math.max(8, entity.vy * dt + 2)) {
        entity.y = rect.y - entity.h;
        entity.vy = 0;
        entity.onGround = true;
        if (options.player) entity.gliding = false;
      } else if (!oneWay && entity.vy < 0 && oldY >= rect.y + rect.h - 10) {
        entity.y = rect.y + rect.h;
        entity.vy = 0;
      }
    }
  }

  _canClimb() {
    const p = this.player;
    for (const o of this.map.objects || []) {
      if (o.destroyed || !['tree', 'tower', 'gate', 'metal', 'rock'].includes(o.type)) continue;
      const width = o.w || 28; const height = o.h || 70;
      if (p.x + p.w > o.x - 20 && p.x < o.x + width + 20 && p.y + p.h > o.y + 10 && p.y < o.y + height) return true;
    }
    return this.map.platforms.some((r) => r.h > 25 && (Math.abs(p.x + p.w - r.x) < 12 || Math.abs(p.x - (r.x + r.w)) < 12) && p.y + p.h > r.y + 4 && p.y < r.y + r.h);
  }

  update(dt) {
    if (!Number.isFinite(dt) || dt <= 0 || !this.started || this.state.paused || this.destroyed) return;
    dt = Math.min(dt, 0.05);
    const p = this.player;
    this.state.playTime += dt;
    p.attackTimer = Math.max(0, p.attackTimer - dt);
    p.invuln = Math.max(0, p.invuln - dt);
    p.hurtTimer = Math.max(0, p.hurtTimer - dt);
    this.runeCooldown = Math.max(0, this.runeCooldown - dt);
    this.arrowCooldown = Math.max(0, this.arrowCooldown - dt);
    this.staminaDelay = Math.max(0, this.staminaDelay - dt);

    const left = this.keys.has('a') || this.keys.has('arrowleft');
    const right = this.keys.has('d') || this.keys.has('arrowright');
    const up = this.keys.has('w') || this.keys.has('arrowup');
    const direction = Number(right) - Number(left);
    if (direction) p.facing = direction;
    const sprint = this.keys.has('shift') && direction && p.stamina > 2 && p.onGround;
    const climb = up && this._canClimb() && p.stamina > 1;
    p.climbing = Boolean(climb);
    let speed = sprint ? 272 : p.gliding ? 210 : 174;
    if (p.attackTimer > 0) speed *= 0.65;
    const water = this._nearObject('water', 90);
    if (water && p.y + p.h > water.y + 3) speed *= 0.65;
    const desiredVx = direction * speed;
    const acceleration = p.onGround ? 16 : 7;
    p.vx += (desiredVx - p.vx) * Math.min(1, dt * acceleration);
    if (Math.abs(p.vx) < 0.4) p.vx = 0;
    if (climb) {
      p.vy = -105; p.gliding = false; p.stamina -= dt * 19;
      p.vx *= 0.55; this.staminaDelay = 0.4;
    } else {
      p.vy += (p.gliding && p.stamina > 0 ? 270 : 1250) * dt;
      if (p.gliding && p.stamina > 0) { p.vy = Math.min(p.vy, 64); p.stamina -= dt * 11; this.staminaDelay = 0.3; }
    }
    if (sprint) { p.stamina -= dt * 15; this.staminaDelay = 0.45; }
    if (p.stamina <= 0) { p.stamina = 0; p.gliding = false; p.climbing = false; this.staminaDelay = 0.6; }
    const rects = this._collisionRects();
    this._moveBody(p, dt, rects, { player: true });
    if (p.onGround && !sprint && !climb && this.staminaDelay <= 0) p.stamina = Math.min(p.maxStamina, p.stamina + dt * 27);
    p.stamina = clamp(p.stamina, 0, p.maxStamina);
    if (p.y > 650) {
      this.damagePlayer(2, { ignoreInvuln: true, silent: true });
      if (p.hp > 0) {
        this._positionPlayer(this.state.shrineId ? this.map.spawn : this.checkpoint?.mapId === this.state.mapId ? this.checkpoint : this.map.spawn);
        this._toast('风接住了坠落的你。留意断崖，空中再按一次空格可展开滑翔伞。', 'warning');
      }
    }
    if (!this.state.shrineId) {
      if (p.x > this.map.width - p.w - 3 && this.map.exits?.right) {
        this.enterMap(this.map.exits.right, { spawn: { x: 35, y: 380 } });
        return;
      }
      if (p.x < 2 && this.map.exits?.left) {
        const next = MAPS.find((m) => m.id === this.map.exits.left);
        this.enterMap(next.id, { spawn: { x: next.width - p.w - 36, y: 380 } });
        return;
      }
    }
    p.x = clamp(p.x, 1, this.map.width - p.w - 1);
    this._updateEnemies(dt, rects);
    this._updateProjectiles(dt, rects);
    for (const item of this.items) if (!item.collected && item.type !== 'chest' && distance(p, item) < 29) this._collect(item);
    for (const object of this.map.objects || []) if (object.frozenTime) object.frozenTime = Math.max(0, object.frozenTime - dt);
    for (const effect of this.effects) {
      effect.life -= dt;
      if (effect.vx !== undefined) { effect.x += effect.vx * dt; effect.y += effect.vy * dt; effect.vy += 180 * dt; }
    }
    this.effects = this.effects.filter((e) => e.life > 0);
    this.camera.x += (this._cameraTarget() - this.camera.x) * Math.min(1, dt * 5);
    this.interaction = this._getInteraction();
    this.saveClock += dt;
    if (this.saveClock > 8) { this.saveClock = 0; this.save(); }
  }

  _updateEnemies(dt, rects) {
    const p = this.player;
    for (const e of this.enemies) {
      if (!e.alive) continue;
      e.hurtTimer = Math.max(0, e.hurtTimer - dt);
      e.attackTimer = Math.max(0, e.attackTimer - dt);
      if (e.isBoss) e.dormant = this.state.completedShrines.length < SHRINES.length;
      if (e.dormant) { e.vx = 0; continue; }
      if (e.frozenTime > 0) { e.frozenTime = Math.max(0, e.frozenTime - dt); continue; }
      const dx = center(p).x - center(e).x;
      const dy = center(p).y - center(e).y;
      const close = Math.abs(dx) < (e.isBoss ? 550 : e.type === 'guardian' ? 420 : 260) && Math.abs(dy) < 175;
      if (close) e.facing = dx > 0 ? 1 : -1;
      else if (e.x > e.startX + e.patrol) e.facing = -1;
      else if (e.x < e.startX - e.patrol) e.facing = 1;
      if (e.type === 'bat') {
        e.vx = (close ? e.facing * 100 : e.facing * 38);
        e.vy = close ? clamp(dy * 1.7, -95, 95) : Math.cos(this.state.playTime * 2 + e.startX) * 35;
        e.x += e.vx * dt; e.y += e.vy * dt;
      } else {
        const speed = e.type === 'guardian' ? (e.isBoss ? 46 : 27) : e.type === 'slime' ? 41 : 67;
        if (e.hurtTimer < 0.1) e.vx = e.facing * (close ? speed * 1.3 : speed * 0.45);
        e.vy += 1250 * dt;
        const oldX = e.x;
        this._moveBody(e, dt, rects);
        if (Math.abs(e.x - oldX) < dt && e.onGround && close) e.vy = -330;
        if (e.y > 650) { e.x = e.startX; e.y = e.startY; e.vy = 0; }
        if (e.type === 'slime' && e.onGround && close && Math.sin(this.state.playTime * 3 + e.startX) > 0.97) e.vy = -215;
      }
      e.x = clamp(e.x, 15, this.map.width - e.w - 15);
      if (e.type === 'guardian' && close) {
        e.shotTimer -= dt;
        if (e.shotTimer <= 0) {
          e.shotTimer = e.isBoss ? 1.6 : 2.3;
          const length = Math.max(1, Math.hypot(dx, dy));
          this.projectiles.push({ type: 'enemy', x: e.x + e.w / 2, y: e.y + 12, w: 9, h: 9, vx: dx / length * (e.isBoss ? 235 : 190), vy: dy / length * (e.isBoss ? 235 : 190), life: 3, owner: 'enemy' });
          e.attackTimer = 0.4;
        }
      }
      if (overlap(p, { x: e.x - 3, y: e.y - 2, w: e.w + 6, h: e.h + 4 }) && p.invuln <= 0) {
        this.damagePlayer(e.isBoss ? 2 : 1);
        p.vx = (dx > 0 ? 1 : -1) * 160; p.vy = -190;
        e.attackTimer = 0.35;
      }
    }
  }

  _updateProjectiles(dt, rects) {
    for (const shot of this.projectiles) {
      shot.life -= dt;
      if (shot.type === 'bomb') shot.vy += 650 * dt;
      if (shot.type === 'arrow') shot.vy += 26 * dt;
      shot.x += shot.vx * dt; shot.y += shot.vy * dt;
      if (shot.type === 'bomb') {
        for (const r of rects) if (overlap(shot, r) && shot.vy > 0) { shot.y = r.y - shot.h; shot.vy *= -0.35; shot.vx *= 0.7; break; }
        if (shot.life <= 0) this._explode(shot);
      } else if (shot.type === 'enemy') {
        if (overlap(shot, this.player)) { this.damagePlayer(1); shot.life = -1; }
        else if (rects.some((r) => overlap(shot, r))) shot.life = -1;
      } else {
        for (const enemy of this.enemies) if (enemy.alive && overlap(shot, enemy)) { this.damageEnemy(enemy, 2, Math.sign(shot.vx) * 60); shot.life = -1; break; }
        if (shot.life > 0 && rects.some((r) => overlap(shot, r))) shot.life = -1;
      }
    }
    this.projectiles = this.projectiles.filter((s) => s.life > 0 && s.x > -50 && s.x < this.map.width + 50 && s.y < 700);
  }

  _explode(bomb) {
    this.effects.push({ type: 'explosion', x: bomb.x, y: bomb.y, radius: 95, life: 0.6, maxLife: 0.6, color: '#99e8ff' });
    this._burst(bomb.x, bomb.y, '#e8f8eb', 18);
    this._sound('hit');
    for (const enemy of this.enemies) if (enemy.alive && distance(bomb, enemy) < 115) this.damageEnemy(enemy, 5, Math.sign(enemy.x - bomb.x) * 140);
    for (const object of this.map.objects || []) if (distance(bomb, object) < 150 && ['crate', 'rock'].includes(object.type)) {
      object.active = true; object.destroyed = true;
      if (!this.state.shrineId) { this._drop('ore', object.x, object.y); this._drop('rupee', object.x + 16, object.y); }
    }
    if (bomb.solveShrineId && bomb.solveShrineId === this.state.shrineId && !this.map.puzzle.solved) {
      // The target proximity was verified when throwing; walking away during a fuse is allowed.
      this._openShrine();
      this._toast('岩壁碎裂，古老的通路重新浮现。前往右侧祭坛领取灵光。', 'success');
      this._sound('complete');
    }
  }

  damageEnemy(enemy, amount, knockback = 0) {
    if (!enemy?.alive || enemy.hurtTimer > 0.12) return false;
    if (enemy.dormant) { this._toast('守望者被十五重灵光封印。先完成全部神庙。', 'warning'); return false; }
    enemy.hp -= amount;
    enemy.hurtTimer = 0.25;
    enemy.vx += knockback;
    this._sound('hit');
    this.effects.push({ type: 'damage', x: enemy.x + enemy.w / 2, y: enemy.y - 6, life: 0.7, maxLife: 0.7, color: '#fff1bf', text: `−${amount}` });
    this._burst(enemy.x + enemy.w / 2, enemy.y + enemy.h / 2, '#e6cd9c', 5);
    if (enemy.hp <= 0) {
      enemy.hp = 0; enemy.alive = false;
      this._drop('rupee', enemy.x + 5, enemy.y + 5);
      this._drop('arrow', enemy.x + 20, enemy.y + 2);
      if (enemy.type === 'bokoblin' || enemy.type === 'slime') this._drop('apple', enemy.x - 10, enemy.y + 5);
      if (enemy.isBoss && this.state.completedShrines.length === SHRINES.length) {
        this.state.gameWon = true;
        this.state.questStage = 3;
        this.player.rupees += 150;
        this._event('victory');
        this._sound('victory');
        this._toast('守望者终于安眠。十五道灵光照亮荒野，而你的旅途仍会继续。', 'success');
      }
      this.save();
    }
    return true;
  }

  damagePlayer(amount, options = {}) {
    const p = this.player;
    if (p.invuln > 0 && !options.ignoreInvuln) return false;
    p.hp = Math.max(0, p.hp - amount);
    p.invuln = 1.25; p.hurtTimer = 0.3;
    this._sound('hurt');
    this._burst(p.x + 9, p.y + 12, '#efab95', 7);
    if (p.hp <= 0) {
      this._event('death'); this._sound('death');
      this.respawn();
    }
    this._notify();
    return true;
  }

  respawn() {
    this.player.hp = this.player.maxHp;
    this.player.stamina = this.player.maxStamina;
    this.player.invuln = 2.5;
    const spawn = !this.state.shrineId && this.checkpoint?.mapId === this.state.mapId ? this.checkpoint : this.map.spawn;
    this._positionPlayer(spawn || { x: 100, y: 390 });
    this.player.invuln = 2.5;
    this.projectiles.length = 0;
    this.camera.x = this._cameraTarget();
    this._toast('旅人，再次醒来。灵光与行囊都在，勇气也仍在。', 'warning');
    this.save();
    return true;
  }

  _drop(type, x, y) {
    this.items.push({ id: `drop-${this.state.mapId}-${Math.floor(this.state.playTime * 1000)}-${this.items.length}`, type, x, y: Math.min(y, this.map.groundY - 15), w: 13, h: 13, collected: false });
  }

  _collect(item) {
    if (item.collected) return;
    item.collected = true;
    const inventory = this.state.inventory;
    const names = { apple: '苹果', wood: '木材', ore: '矿石', rupee: '星币', heart: '生命', arrow: '箭矢' };
    if (item.type === 'rupee') this.player.rupees += 5;
    else if (item.type === 'arrow') this.player.arrows += 3;
    else if (item.type === 'heart') this.player.hp = Math.min(this.player.maxHp, this.player.hp + 2);
    else if (Object.hasOwn(inventory, item.type)) inventory[item.type] += 1;
    this.effects.push({ type: 'text', x: item.x, y: item.y - 10, text: `+${item.type === 'rupee' ? 5 : item.type === 'arrow' ? 3 : 1} ${names[item.type] || item.type}`, color: '#f4edc9', life: 1.1, maxLife: 1.1 });
    this._sound(item.type === 'rupee' ? 'coin' : 'pickup');
    this._burst(item.x + 6, item.y + 6, '#d5e7bd', 4);
  }

  _burst(x, y, color, count = 8, type = 'particle') {
    // Deterministic particle vectors keep simulation reproducible.
    for (let i = 0; i < count; i += 1) {
      const angle = (i / count) * Math.PI * 2 + this.time;
      this.effects.push({ type, x, y, vx: Math.cos(angle) * (26 + i * 4), vy: Math.sin(angle) * (20 + i * 3) - 35, life: 0.45 + (i % 3) * 0.08, maxLife: 0.65, color, radius: i % 2 ? 2 : 3 });
    }
  }

  getSnapshot() {
    const p = this.player;
    const metadata = MAPS.find((m) => m.id === this.state.mapId);
    const shrine = SHRINES.find((s) => s.id === this.state.shrineId);
    let quest = '循着风，寻找荒野中的古老神庙';
    if (this.state.completedShrines.length > 0) quest = `寻回十五道灵光 · 神庙 ${this.state.completedShrines.length}/${SHRINES.length}`;
    if (this.state.shrineId) quest = this.map.puzzle?.solved ? '通路已开启 · 前往祭坛领取灵光' : (shrine?.hint || '用符文解开古老机关');
    if (this.state.completedShrines.length === SHRINES.length && !this.state.shrineId) quest = `前往${MAPS[MAPS.length - 1].name} · 击败遗迹守望者`;
    if (this.state.gameWon) quest = '荒野已重获自由 · 继续你的旅程';
    const boss = this.enemies.find((e) => e.isBoss && e.alive);
    return {
      started: this.started, paused: this.state.paused,
      mapId: this.state.mapId, mapName: this.map?.name || metadata?.name || '',
      mapSubtitle: this.map?.subtitle || metadata?.subtitle || '', biome: this.map?.biome,
      shrineId: this.state.shrineId, shrineName: shrine?.name || '',
      weather: this.state.weather, hp: p.hp, maxHp: p.maxHp,
      stamina: Math.round(p.stamina), maxStamina: p.maxStamina,
      arrows: p.arrows, rupees: p.rupees, orbs: p.orbs,
      inventory: { ...this.state.inventory }, rune: this.state.rune,
      runeCooldown: this.runeCooldown,
      visited: [...this.state.visited], completedShrines: [...this.state.completedShrines],
      quest, interaction: this._getInteraction(), canCook: Boolean(this._nearObject('campfire', 110)),
      gameWon: this.state.gameWon, playTime: this.state.playTime, hasSave: Boolean(this.hasSave),
      boss: boss && !boss.dormant ? { hp: boss.hp, maxHp: boss.maxHp, name: boss.name } : null,
      x: p.x, worldWidth: this.map?.width || 3200,
      viewportWidth: this.viewportWidth,
    };
  }

  save() {
    this._captureProgress();
    try {
      const p = this.player;
      // Shrine locations resume at their safe entrance; overworld positions are preserved.
      const position = this.state.shrineId ? this.returnPosition || { x: 100, y: 390 } : p;
      globalThis.localStorage?.setItem(SAVE_KEY, JSON.stringify({
        version: 1, state: this.state,
        player: { x: position.x, y: position.y, hp: p.hp, arrows: p.arrows, rupees: p.rupees },
        savedAt: Date.now(),
      }));
      this.hasSave = true;
      return true;
    } catch { return false; }
  }

  reset() {
    try { globalThis.localStorage?.removeItem(SAVE_KEY); } catch { /* Optional persistence. */ }
    const started = this.started;
    this.state = freshState();
    this.state.started = started;
    this.player = freshPlayer();
    this.worldCache.clear();
    this.map = null;
    this.returnPosition = null;
    this.checkpoint = null;
    this.hasSave = false;
    this.keys.clear();
    this.enterMap('map-01', { silent: true });
    this.save();
    this._toast('新的风已经吹起。旅途从这里重新开始。', 'success');
    this._notify();
    return true;
  }

  destroy() {
    this.save();
    this.destroyed = true;
    this.keys.clear();
    if (this.frameHandle !== undefined && typeof cancelAnimationFrame === 'function') cancelAnimationFrame(this.frameHandle);
    if (typeof window !== 'undefined') {
      window.removeEventListener('keydown', this._keyDown);
      window.removeEventListener('keyup', this._keyUp);
      window.removeEventListener('blur', this._blur);
      window.removeEventListener('pagehide', this._beforeUnload);
    }
  }
}
