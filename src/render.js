// All artwork is drawn locally. A two-pixel grid keeps the little world crisp.
const W = 960, H = 540;
const TAU = Math.PI * 2;
const clamp = (n, a, b) => Math.max(a, Math.min(b, n));
const hash = (n) => { const x = Math.sin(n * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); };
const q = (n) => Math.round(n / 2) * 2;
const fallbackPalette = {
  sky: '#86b5b3', skyBottom: '#e1dfb3', mountain: '#86a89b', far: '#668b7d',
  mid: '#3f7061', grass: '#86a95d', dirt: '#695c43', accent: '#91eed1',
};

export class Renderer {
  constructor(canvas) {
    this.canvas = canvas;
    canvas.width = W;
    canvas.height = H;
    this.ctx = canvas.getContext('2d', { alpha: false });
    this.ctx.imageSmoothingEnabled = false;
    this.layer = document.createElement('canvas');
    this.layer.width = W;
    this.layer.height = H;
    this.c = this.layer.getContext('2d', { alpha: false });
    this.c.imageSmoothingEnabled = false;
    this.width = W;
  }

  resize(width = W) {
    const next = Math.max(320, Math.min(W, Math.round(width / 2) * 2));
    if (this.width === next) return;
    this.width = next;
    this.canvas.width = next;
    this.canvas.height = H;
    this.ctx.imageSmoothingEnabled = false;
  }

  rect(x, y, w, h, color) {
    if (color) this.c.fillStyle = color;
    this.c.fillRect(q(x), q(y), Math.max(1, q(w)), Math.max(1, q(h)));
  }

  poly(points, color) {
    const c = this.c;
    c.fillStyle = color;
    c.beginPath();
    points.forEach(([x, y], i) => i ? c.lineTo(q(x), q(y)) : c.moveTo(q(x), q(y)));
    c.closePath(); c.fill();
  }

  line(points, color, width = 2) {
    const c = this.c;
    c.strokeStyle = color; c.lineWidth = width;
    c.beginPath();
    points.forEach(([x, y], i) => i ? c.lineTo(q(x), q(y)) : c.moveTo(q(x), q(y)));
    c.stroke();
  }

  blob(x, y, w, h, color) {
    this.rect(x + w * .22, y, w * .55, h, color);
    this.rect(x + w * .08, y + h * .14, w * .84, h * .73, color);
    this.rect(x, y + h * .32, w, h * .36, color);
  }

  render(game) {
    const c = this.c;
    const map = game.map || {};
    const camera = game.camera || { x: 0, y: 0 };
    const cx = Number(camera.x) || 0;
    const t = Number(game.time) || 0;
    const palette = { ...fallbackPalette, ...(map.palette || {}) };
    const shrine = map.biome === 'shrine' || Boolean(game.state?.shrineId);
    const biome = String(map.biome || 'meadow').toLowerCase();
    this.view = { cx, t, map, palette, biome, shrine, state: game.state || {} };
    c.globalAlpha = 1;
    c.setTransform(1, 0, 0, 1, 0, 0);
    if (shrine) this.shrineBackground();
    else this.landscape();

    const objects = map.objects || [];
    for (const o of objects) {
      if (o.type === 'tree' || o.type === 'tower' || o.type === 'water' || o.type === 'wind') this.object(o);
    }
    for (const p of map.platforms || []) this.platform(p);
    for (const o of objects) {
      if (!['tree', 'tower', 'water', 'wind'].includes(o.type)) this.object(o);
    }
    for (const s of map.shrines || []) this.shrine(s);
    if (map.altar) this.altar(map.altar);
    if (shrine) this.returnPortal();
    for (const i of game.items || map.items || []) if (!i.collected) this.item(i);
    for (const e of game.enemies || []) if (e.alive !== false && e.hp !== 0) this.enemy(e);
    for (const p of game.projectiles || []) this.projectile(p);
    if (game.player) this.player(game.player);
    for (const e of game.effects || []) this.effect(e);
    if (!shrine) this.foreground();
    this.weather();

    const vignette = c.createRadialGradient(W / 2, 240, 190, W / 2, 270, 600);
    vignette.addColorStop(0, '#10251c00'); vignette.addColorStop(1, '#0a241c38');
    c.fillStyle = vignette; c.fillRect(0, 0, W, H);
    // Tiny consistent scan lines evoke a handheld screen without obscuring detail.
    c.fillStyle = '#10251c07';
    for (let y = 1; y < H; y += 3) c.fillRect(0, y, W, 1);
    this.ctx.drawImage(this.layer, 0, 0, this.width, H, 0, 0, this.width, H);
  }

  landscape() {
    const { cx, t, map, palette: p, biome } = this.view;
    const c = this.c;
    const snow = /snow|frost|ice|tundra/.test(biome);
    const desert = /sand|desert|dune/.test(biome);
    const volcano = /volcan|ember|lava|fire/.test(biome);
    const sky = c.createLinearGradient(0, 0, 0, 440);
    sky.addColorStop(0, p.sky); sky.addColorStop(.76, p.skyBottom); sky.addColorStop(1, p.skyBottom);
    c.fillStyle = sky; c.fillRect(0, 0, W, H);

    const sunX = 690 - cx * .025, sunY = snow ? 95 : 93;
    const halo = c.createRadialGradient(sunX, sunY, 4, sunX, sunY, 116);
    halo.addColorStop(0, '#fff3cbb0'); halo.addColorStop(.25, '#fff1bd50'); halo.addColorStop(1, '#fff1bd00');
    c.fillStyle = halo; c.fillRect(sunX - 116, sunY - 116, 232, 232);
    this.blob(sunX - 21, sunY - 21, 42, 42, volcano ? '#f3ae79' : '#fff1c9');
    this.rect(sunX - 12, sunY - 20, 24, 3, '#fff8d9');

    for (let i = -1; i < 7; i++) {
      const x = ((i * 227 + t * (2 + i % 2) - cx * .07) % 1420 + 1420) % 1420 - 180;
      const y = 46 + hash(i + 81) * 116;
      const w = 90 + hash(i + 51) * 80;
      c.globalAlpha = .32 + hash(i + 15) * .25;
      this.cloud(x, y, w, '#fff4d3');
    }
    c.globalAlpha = 1;

    // Peaks follow a repeatable hand-cut silhouette, each layer moving at its own pace.
    this.ridge(cx * .07, 286, p.mountain, 142, 0, snow);
    this.ridge(cx * .13 + 220, 329, p.far, 101, 22, snow);
    const mist = c.createLinearGradient(0, 205, 0, 374);
    mist.addColorStop(0, '#e7e9d300'); mist.addColorStop(1, '#d7dfb236');
    c.fillStyle = mist; c.fillRect(0, 205, W, 169);

    if (!desert && !volcano) {
      this.poly([[-20, 369], [130, 332], [284, 354], [445, 318], [604, 351], [770, 325], [1000, 365], [1000, 448], [-20, 448]], p.mid);
      c.globalAlpha = .3;
      this.poly([[-10, 385], [184, 358], [352, 378], [537, 354], [755, 381], [990, 353], [990, 440], [-10, 440]], '#8eb295');
      c.globalAlpha = 1;
      for (let i = -3; i < 35; i++) {
        const x = i * 39 - ((cx * .28) % 39);
        const y = 349 + hash(i + 301) * 35;
        const h = 34 + hash(i + 329) * 73;
        this.pine(x, y - h, 30 + hash(i + 303) * 21, h, p.mid, true);
      }
      // Ruined watchtowers on the horizon make the valley feel inhabited.
      const ruinX = 490 - (cx * .19 % 1520);
      this.ruinSilhouette(ruinX, 295, p.far);
      if (snow) {
        this.poly([[-20, 412], [210, 383], [441, 405], [680, 378], [1000, 410], [1000, 450], [-20, 450]], '#c2d4ca');
      } else {
        this.poly([[-20, 412], [126, 392], [315, 413], [525, 385], [736, 405], [1000, 391], [1000, 450], [-20, 450]], '#638b60');
        this.poly([[337 - cx * .05, 382], [392 - cx * .05, 386], [482 - cx * .07, 439], [375 - cx * .07, 439]], '#a6c6b0');
      }
    } else if (desert) {
      this.poly([[-20, 392], [240, 331], [487, 382], [735, 342], [1000, 397], [1000, 450], [-20, 450]], '#c3a56e');
      this.poly([[-20, 427], [320, 374], [564, 415], [851, 371], [1000, 405], [1000, 450], [-20, 450]], '#a98e5d');
      for (let i = 0; i < 8; i++) {
        const x = i * 186 - (cx * .3 % 186);
        this.rect(x, 342, 16, 77, '#8e805d'); this.rect(x - 8, 359, 34, 8, '#8e805d');
      }
    } else {
      this.poly([[-20, 414], [140, 343], [295, 386], [487, 316], [697, 389], [864, 321], [1000, 392], [1000, 450], [-20, 450]], '#605b59');
      for (let i = 0; i < 12; i++) {
        const x = i * 109 - (cx * .25 % 109);
        this.line([[x, 373], [x + 8, 392], [x + 3, 409], [x + 18, 434]], '#dc9159', 3);
      }
    }

    this.regionalLandmark();

    // Small birds are animated shapes, not text glyphs.
    for (let i = 0; i < 5; i++) {
      const x = ((214 + i * 43 + t * 9 - cx * .12) % 1200 + 1200) % 1200;
      const y = 140 + i % 3 * 13 + Math.sin(t + i) * 5;
      const wing = Math.sin(t * 4 + i) * 4;
      this.line([[x - 5, y + wing], [x, y], [x + 5, y + wing]], '#587a70', 2);
    }
    // Dust flecks catch the late afternoon light.
    for (let i = 0; i < 22; i++) {
      const x = ((hash(i + 4) * W + t * (3 + hash(i) * 6) - cx * .45) % W + W) % W;
      const y = 210 + hash(i + 80) * 206 + Math.sin(t * .6 + i) * 12;
      c.globalAlpha = .2 + (Math.sin(t + i) + 1) * .2;
      this.rect(x, y, 2, 2, '#fff1ba');
    }
    c.globalAlpha = 1;
    // Soft diagonal shafts cross the upper canopy.
    c.globalAlpha = .045;
    this.poly([[640, 0], [670, 0], [365, 440], [270, 440]], '#fff4bc');
    this.poly([[715, 0], [731, 0], [486, 440], [438, 440]], '#fff4bc');
    c.globalAlpha = 1;
  }

  ridge(offset, base, color, amplitude, seed, snow) {
    const period = 1380;
    const start = -((offset % period) + period) % period;
    for (let n = -1; n < 2; n++) {
      const points = [[start + n * period, 460]];
      for (let i = 0; i <= 23; i++) {
        const x = start + n * period + i * 60;
        const h = 30 + hash(i + seed + 1) * amplitude;
        points.push([x, base - h]);
      }
      points.push([start + n * period + period, 460]);
      this.poly(points, color);
      if (snow) for (let i = 1; i < 23; i++) {
        const x = start + n * period + i * 60;
        const y = base - 30 - hash(i + seed + 1) * amplitude;
        if (y < base - amplitude * .66) this.poly([[x - 19, y + 24], [x, y], [x + 21, y + 22], [x + 10, y + 16], [x + 3, y + 25], [x - 5, y + 15]], '#d7dfd0');
      }
    }
  }

  cloud(x, y, w, color) {
    this.rect(x, y + 14, w, 10, color);
    this.rect(x + 10, y + 8, w * .74, 12, color);
    this.rect(x + w * .27, y, w * .27, 12, color);
    this.rect(x + w * .53, y + 4, w * .22, 13, color);
    this.rect(x + w * .06, y + 24, w * .81, 3, color);
  }

  pine(x, y, w, h, color, flat = false) {
    this.rect(x + w / 2 - 2, y + h * .4, 4, h * .6, color);
    for (let i = 0; i < 4; i++) {
      const tw = w * (.4 + i * .21);
      this.poly([[x + w / 2, y + h * i * .14], [x + w / 2 + tw / 2, y + h * (.42 + i * .14)], [x + w / 2 - tw / 2, y + h * (.42 + i * .14)]], color);
      if (!flat) this.line([[x + w / 2 - tw / 2, y + h * (.42 + i * .14)], [x + w / 2 - tw / 4, y + h * (.37 + i * .14)]], '#a7b894');
    }
  }

  ruinSilhouette(x, y, color) {
    this.rect(x, y, 25, 66, color); this.rect(x - 3, y - 5, 32, 8, color);
    this.rect(x - 4, y - 11, 7, 9, color); this.rect(x + 9, y - 11, 7, 9, color); this.rect(x + 23, y - 11, 7, 9, color);
    this.rect(x + 36, y + 34, 17, 38, color); this.rect(x + 31, y + 31, 28, 7, color);
    this.rect(x + 7, y + 19, 10, 16, this.view.palette.skyBottom);
  }

  regionalLandmark() {
    const { biome, cx, t, palette: p } = this.view;
    if (biome === 'coast' || biome === 'marsh') {
      const c = this.c;
      this.poly([[-20, 394], [150, 376], [380, 389], [620, 374], [980, 389], [980, 436], [-20, 436]], biome === 'coast' ? '#84bcb0' : '#638f83');
      for (let i = 0; i < 24; i++) {
        const x = ((i * 59 - cx * .32 + Math.sin(t * .8 + i) * 4) % 1100 + 1100) % 1100 - 80;
        this.rect(x, 390 + i % 7 * 5, 12 + hash(i + 83) * 32, 2, biome === 'coast' ? '#bed6ba' : '#95b59b');
      }
      if (biome === 'coast') {
        const sx = 672 - (cx * .16 % 1350);
        this.poly([[sx - 31, 390], [sx + 30, 390], [sx + 18, 400], [sx - 20, 400]], '#567a70');
        this.rect(sx - 1, 340, 3, 50, '#55766b');
        this.poly([[sx - 4, 343], [sx - 4, 383], [sx - 29, 383]], '#e0dec0');
        this.poly([[sx + 4, 351], [sx + 4, 383], [sx + 28, 383]], '#cbd6b6');
        for (let i = 0; i < 3; i++) {
          const x = 122 + i * 340 - (cx * .38 % 340);
          this.line([[x, 426], [x + 2, 404]], '#668867');
          this.line([[x + 6, 427], [x + 4, 410]], '#668867');
          this.rect(x + 1, 400, 3, 9, '#8f986a');
        }
      } else {
        for (let i = 0; i < 30; i++) {
          const x = ((hash(i + 300) * W - cx * .6 + Math.sin(t * .35 + i) * 13) % W + W) % W;
          const y = 300 + hash(i + 400) * 118 + Math.cos(t * .7 + i) * 5;
          c.globalAlpha = .3 + (Math.sin(t * 2 + i) + 1) * .3;
          this.rect(x, y, 3, 3, '#e4eda2'); c.globalAlpha *= .3;
          this.rect(x - 3, y - 3, 9, 9, '#d3e9a2');
        }
        c.globalAlpha = 1;
      }
    }
    if (biome === 'highland') {
      for (let i = 0; i < 3; i++) {
        const x = i * 570 + 440 - (cx * .2 % 1710), y = 333 - (i % 2) * 27;
        this.poly([[x - 17, 408], [x - 9, y], [x + 9, y], [x + 17, 408]], '#607e63');
        this.poly([[x - 14, y], [x, y - 18], [x + 14, y]], '#4b6f5a');
        this.rect(x - 4, 392, 8, 16, '#45634e');
        for (let b = 0; b < 4; b++) {
          const a = t * .24 + b * Math.PI / 2;
          const dx = Math.cos(a), dy = Math.sin(a), nx = -dy, ny = dx;
          this.poly([[x + dx * 9 + nx * 2, y + dy * 9 + ny * 2], [x + dx * 46 + nx * 2, y + dy * 46 + ny * 2], [x + dx * 46 + nx * 9, y + dy * 46 + ny * 9], [x + dx * 18 + nx * 9, y + dy * 18 + ny * 9]], '#c2bd8b');
          this.line([[x, y], [x + dx * 48, y + dy * 48]], '#5b7257');
        }
        this.rect(x - 3, y - 3, 6, 6, '#e0d19c');
      }
    }
    if (biome === 'ruins') {
      const start = 160 - (cx * .23 % 1600);
      for (let i = 0; i < 7; i++) {
        const x = start + i * 175, y = 274 + hash(i + 12) * 55;
        const h = 150 - hash(i + 50) * 30;
        this.rect(x - 8, y, 31, h, '#7b8c77'); this.rect(x - 3, y + 6, 5, h - 9, '#a0aa88');
        this.rect(x - 16, y - 9, 47, 11, '#9aa285'); this.rect(x - 14, y + h - 7, 43, 9, '#667c66');
        if (i === 1 || i === 2) this.rect(x - 16, y - 17, 217, 11, '#8e997d');
        for (let v = 0; v < 4; v++) this.blob(x + 13, y + v * 22, 9, 17, '#627f59');
      }
    }
    if (biome === 'castle') {
      const x = 640 - (cx * .23 % 1300), y = 315;
      this.rect(x - 140, y, 280, 106, '#6f7e7b');
      this.rect(x - 145, y - 5, 290, 8, '#9a9f8a');
      for (let i = 0; i < 12; i++) this.rect(x - 145 + i * 25, y - 17, 14, 17, '#7f8c81');
      for (let i = 0; i < 3; i++) {
        const tx = x - 106 + i * 105, ty = y - 63 - (i === 1 ? 54 : 0);
        this.rect(tx - 24, ty, 48, 421 - ty, '#667778');
        this.rect(tx - 26, ty - 5, 52, 10, '#9b9f8b');
        this.poly([[tx - 34, ty - 5], [tx, ty - 47], [tx + 34, ty - 5]], '#4f656a');
        this.line([[tx - 34, ty - 5], [tx, ty - 47], [tx + 34, ty - 5]], '#899080');
        this.rect(tx - 4, ty + 20, 8, 19, '#b4ba91');
        this.rect(tx - 2, ty - 66, 2, 21, '#4c6466');
        this.poly([[tx, ty - 66], [tx + 23, ty - 61 + Math.sin(t + i) * 2], [tx, ty - 55]], '#c2b583');
      }
      this.rect(x - 17, 380, 34, 41, '#455f60');
      this.blob(x - 17, 368, 34, 32, '#455f60');
      this.rect(x - 12, 379, 24, 42, '#b8af87');
    }
  }

  shrineBackground() {
    const { cx, t, palette: p, map } = this.view;
    const c = this.c;
    const grad = c.createLinearGradient(0, 0, 0, H);
    grad.addColorStop(0, '#182d32'); grad.addColorStop(1, '#253e3d');
    c.fillStyle = grad; c.fillRect(0, 0, W, H);
    // Massive basalt blocks, recessed pillars and breathing cyan inscriptions.
    for (let y = 0; y < 440; y += 50) for (let x = -100; x < W + 100; x += 100) {
      const bx = x - (cx * .1 % 100) + (Math.floor(y / 50) % 2) * 50;
      this.rect(bx + 2, y + 2, 96, 46, hash(x + y * 4) > .5 ? '#203639' : '#1d3337');
      this.line([[bx + 2, y + 45], [bx + 92, y + 45]], '#2a4240');
    }
    for (let i = -1; i < 6; i++) {
      const x = i * 240 - (cx * .28 % 240);
      this.rect(x, 65, 42, 374, '#152b30');
      this.rect(x - 8, 58, 58, 14, '#35514c'); this.rect(x + 4, 77, 5, 353, '#314b45');
      this.rect(x - 4, 423, 50, 16, '#3a5149');
      c.globalAlpha = .25 + Math.sin(t * 1.5 + i) * .1;
      this.runeGlyph(x + 22, 197, 17, '#8adcca', map.puzzle?.type || 'wind');
      c.globalAlpha = 1;
    }
    const glow = c.createRadialGradient(680, 220, 20, 680, 220, 420);
    glow.addColorStop(0, '#58cbb31a'); glow.addColorStop(1, '#58cbb300');
    c.fillStyle = glow; c.fillRect(0, 0, W, H);
    for (let i = 0; i < 35; i++) {
      const x = ((hash(i + 41) * W + Math.sin(t * .2 + i) * 14 - cx * .4) % W + W) % W;
      const y = ((hash(i + 79) * 440 - t * 5) % 440 + 440) % 440;
      c.globalAlpha = .2 + hash(i) * .4;
      this.rect(x, y, 2, 2, '#9ff5d4');
    }
    c.globalAlpha = 1;
  }

  platform(p) {
    const { cx, palette, shrine, biome } = this.view;
    const x = p.x - cx, y = p.y, w = p.w, h = p.h;
    if (x + w < -20 || x > W + 20 || p.active === false || p.removed) return;
    const left = Math.max(x, -20), right = Math.min(x + w, W + 20);
    if (p.magical) {
      const c = this.c;
      c.globalAlpha = .3;
      this.rect(x, y - 8, w, 26, '#83d8bc');
      c.globalAlpha = 1;
      this.rect(x, y, w, 5, '#d1eabb');
      this.rect(x, y + 5, w, 13, '#6d9a83');
      this.rect(x, y + 18, w, 5, '#385e52');
      for (let tx = Math.floor((left + cx) / 36) * 36 - cx; tx < right; tx += 36) {
        this.rect(tx + 2, y + 7, 31, 3, '#a8cba0');
        this.runeGlyph(tx + 16, y + 14, 4, '#b3e6b9', 'wind');
      }
      return;
    }
    if (p.kind === 'wood') {
      this.rect(x, y, w, Math.min(h, 16), '#5a4a38');
      this.rect(x, y, w, 3, '#b3a174');
      for (let tx = x; tx < x + w; tx += 23) this.rect(tx + 2, y + 4, 18, 6, '#887750');
      this.line([[x + 7, y + 16], [x + 7, y + h]], '#4b4433', 4);
      this.line([[x + w - 7, y + 16], [x + w - 7, y + h]], '#4b4433', 4);
      return;
    }
    if (p.kind === 'ice') {
      this.rect(x, y, w, h, '#78aaa9'); this.rect(x, y, w, 5, '#d4f1dd');
      for (let tx = left; tx < right; tx += 32) this.poly([[tx + 3, y + 8], [tx + 16, y + 6], [tx + 2, y + 27]], '#a0d3c4');
      return;
    }
    if (shrine || p.kind === 'stone') {
      this.rect(x, y, w, h, shrine ? '#3b4c47' : '#697360');
      this.rect(x, y, w, 4, shrine ? '#96ac8c' : '#bac1a0');
      this.rect(x, y + 4, w, 5, shrine ? '#667c67' : '#919b77');
      for (let ty = y + 12; ty < Math.min(y + h, H); ty += 22) {
        this.line([[left, ty], [right, ty]], '#293c37');
        for (let tx = Math.floor((left + cx) / 44) * 44 - cx; tx < right; tx += 44) this.line([[tx + (Math.floor(ty / 22) % 2) * 22, ty], [tx + (Math.floor(ty / 22) % 2) * 22, ty + 21]], '#293c37');
      }
      this.rect(x, y + h - 3, w, 3, '#1d3430');
      return;
    }
    const snow = /snow|frost|ice|tundra/.test(biome);
    const sand = /sand|desert|dune/.test(biome);
    this.rect(x, y + 8, w, h - 8, palette.dirt);
    this.rect(x, y, w, 6, snow ? '#e2e9d3' : palette.grass);
    this.rect(x, y + 6, w, 7, snow ? '#a6bfae' : '#536b3b');
    this.rect(x, y + 13, w, 4, '#423e2d');
    for (let tx = Math.floor((left + cx) / 16) * 16 - cx; tx < right; tx += 16) {
      const idx = Math.floor((tx + cx) / 16);
      if (hash(idx + 39) > .36) this.rect(tx + 2, y - 3, 8, 4, snow ? '#f2f2db' : palette.grass);
      if (!snow && !sand && hash(idx + 51) > .53) {
        const sway = Math.sin(this.view.t * 1.4 + idx) * 2;
        this.line([[tx + 6, y + 1], [tx + 5 + sway, y - 6], [tx + 2 + sway, y - 9]], '#9ebc6e');
        this.line([[tx + 9, y], [tx + 11 + sway, y - 6]], '#6c8d4a');
      }
    }
    for (let ty = y + 20; ty < Math.min(y + h, H); ty += 17) {
      for (let tx = Math.floor((left + cx) / 28) * 28 - cx; tx < right; tx += 28) {
        const n = (tx + cx) * .7 + ty * 11;
        this.rect(tx + hash(n + 2) * 12, ty + hash(n + 4) * 8, 4 + hash(n + 6) * 7, 3, hash(n) > .5 ? '#897853' : '#504d35');
        if (hash(n + 15) > .75) this.rect(tx + 9, ty + 3, 2, 2, '#b19b69');
      }
    }
    this.rect(x, y + h - 4, w, 4, '#333d2b');
  }

  object(o) {
    const { cx, t, palette: p, biome } = this.view;
    if (o.removed || o.destroyed) return;
    const x = o.x - cx, y = o.y, w = o.w || 30, h = o.h || 30;
    if (x + w < -180 || x > W + 180) return;
    if (o.puzzleTarget && !this.view.map.puzzle?.solved) {
      const color = { wind: '#bce8c2', magnet: '#d2b6df', stasis: '#e9d393', bomb: '#addce3', flame: '#ecc292' }[o.rune] || '#c1e5bb';
      this.c.globalAlpha = .08 + Math.sin(t * 1.8) * .025;
      this.blob(x - 12, y - 14, w + 24, h + 24, color);
      this.c.globalAlpha = .8;
      this.runeGlyph(x + w / 2, y - 18 + Math.sin(t * 2) * 3, 9, color, o.rune);
      this.c.globalAlpha = 1;
    }
    switch (o.type) {
      case 'tree': this.tree(x, y, w, h, o); break;
      case 'rock':
        this.blob(x, y, w, h, '#657365'); this.blob(x + 3, y + 3, w * .65, h * .45, '#87937a');
        this.rect(x + w * .15, y + h * .2, w * .3, 3, '#acb491');
        this.line([[x + w * .6, y + 2], [x + w * .46, y + h * .37], [x + w * .7, y + h * .53]], '#4d6053');
        if (o.cracked) this.line([[x + w * .35, y + 5], [x + w * .46, y + h * .28], [x + w * .3, y + h * .44], [x + w * .48, y + h * .62], [x + w * .4, y + h - 5]], '#d3bc81', 3);
        break;
      case 'grass':
        if (o.burned) {
          for (let i = 0; i < w / 8; i++) this.rect(x + i * 8, y + h - 5, 5, 4, '#554d36');
          break;
        }
        for (let i = 0; i < w / 5; i++) {
          const bx = x + i * 5, by = y + h;
          this.poly([[bx - 2, by], [bx - 6 + Math.sin(t * 1.8 + i), by - h * (.5 + hash(i + o.x) * .5)], [bx + 3, by - 2]], i % 2 ? p.grass : '#78934d');
        }
        break;
      case 'campfire': this.campfire(x, y, w, h); break;
      case 'sign':
        this.rect(x + w / 2 - 2, y + 12, 5, h - 10, '#66533c');
        this.rect(x, y, w, 19, '#534633'); this.rect(x + 2, y + 2, w - 4, 13, '#b6a172');
        this.line([[x + 7, y + 7], [x + w - 8, y + 7]], '#756748');
        this.line([[x + 7, y + 11], [x + w - 14, y + 11]], '#756748');
        break;
      case 'tower': this.tower(x, y, w, h, o.active); break;
      case 'water': {
        const c = this.c;
        c.globalAlpha = .78;
        this.rect(x, y, w, h, '#468e8c'); this.rect(x, y, w, 3, '#a8dfc4');
        for (let i = 0; i < w / 35; i++) this.rect(x + i * 35 + Math.sin(t + i) * 7, y + 9 + (i % 3) * 7, 18, 2, '#83bca9');
        c.globalAlpha = 1;
        break;
      }
      case 'crate':
        this.rect(x, y, w, h, '#4e4633'); this.rect(x + 3, y + 3, w - 6, h - 6, '#92764c');
        this.rect(x + 6, y + 6, w - 12, h - 12, '#735c3e');
        this.line([[x + 5, y + 5], [x + w - 5, y + h - 5]], '#b29764', 4);
        this.line([[x + w - 5, y + 5], [x + 5, y + h - 5]], '#b29764', 4);
        break;
      case 'metal':
        this.rect(x, y, w, h, '#283f40'); this.rect(x + 3, y + 3, w - 6, h - 6, o.active ? '#b59c73' : '#779898');
        this.rect(x + 5, y + 5, w - 10, 4, '#bbd1bb'); this.rect(x + 8, y + 13, w - 16, h - 20, '#4c696c');
        this.runeGlyph(x + w / 2, y + h / 2 + 3, Math.min(w, h) * .25, '#b7d4bd', 'magnet');
        break;
      case 'gate':
        if (!o.active && !o.open && !this.view.map.puzzle?.solved) {
          this.rect(x - 3, y - 3, w + 6, 7, '#869d87');
          for (let i = 0; i < w; i += 9) {
            this.rect(x + i, y + 4, 4, h - 4, '#74bcad');
            this.rect(x + i + 2, y + 4, 2, h - 4, '#b5e0bd');
          }
          this.rect(x - 3, y + h - 5, w + 6, 5, '#82967e');
        } else {
          this.rect(x - 3, y, w + 6, 8, '#617e6c');
          this.rect(x - 4, y + h - 5, w + 8, 5, '#617e6c');
        }
        break;
      case 'switch':
        this.rect(x, y + h - 8, w, 8, '#51665b'); this.rect(x + 3, y + h - 12, w - 6, 5, o.active ? '#b6edb2' : '#c3ac72');
        this.runeGlyph(x + w / 2, y + h * .4, Math.min(w, h) * .33, o.active ? '#adf0ce' : '#c1b17f', o.rune || this.view.map.puzzle?.type || 'stasis');
        break;
      case 'ice':
        this.blob(x, y, w, h, '#73a9b1');
        this.poly([[x + 4, y + h * .18], [x + w * .44, y + 2], [x + w * .61, y + h * .68], [x + w * .17, y + h - 2]], '#badbd2');
        this.poly([[x + w * .5, y + 4], [x + w - 4, y + h * .25], [x + w * .78, y + h - 4]], '#92c6c5');
        this.rect(x + w * .22, y + h * .25, 3, h * .33, '#e2f1d8');
        break;
      case 'torch':
        this.rect(x + w / 2 - 3, y + 12, 6, h - 12, '#705a3f');
        this.rect(x + w / 2 - 6, y + 10, 12, 8, '#a49a70');
        if (o.active || o.lit) this.flame(x + w / 2, y + 5, 13, 25);
        else this.rect(x + w / 2 - 4, y + 5, 8, 8, '#3d4036');
        break;
      case 'wind':
        for (let i = 0; i < 10; i++) {
          const wy = y + h - ((t * 45 + i * 29) % Math.max(h, 90));
          const wx = x + w / 2 + Math.sin(t * 2 + i) * w * .35;
          this.c.globalAlpha = .15 + (i % 3) * .08;
          this.line([[wx - 3, wy + 14], [wx + 2, wy], [wx - 2, wy - 7]], '#c3edd5');
        }
        this.c.globalAlpha = 1;
        break;
      default:
        if (/boulder|block|barrier/.test(o.type || '')) {
          this.blob(x, y, w, h, '#707b6a'); this.runeGlyph(x + w / 2, y + h / 2, 12, '#c9c095', 'bomb');
        }
    }
  }

  tree(x, y, w, h, o) {
    const { t, biome, palette: p } = this.view;
    const snow = /snow|frost|ice|tundra/.test(biome);
    const autumn = /autumn|amber/.test(biome);
    const desert = /desert|sand|dune/.test(biome);
    if (desert) {
      const tx = x + w / 2;
      this.rect(tx - 5, y + 24, 10, h - 24, '#66865b');
      this.rect(tx - 20, y + h * .4, 20, 8, '#66865b'); this.rect(tx - 20, y + h * .25, 8, h * .2, '#66865b');
      this.rect(tx + 5, y + h * .55, 21, 8, '#66865b'); this.rect(tx + 18, y + h * .34, 8, h * .25, '#66865b');
      this.rect(tx - 3, y + 25, 2, h - 28, '#9fb175');
      return;
    }
    const tw = Math.max(74, w * 2.2), tx = x + w / 2;
    const trunkY = y + h * .38;
    this.poly([[tx - 8, y + h], [tx - 5, trunkY], [tx + 2, trunkY - 14], [tx + 8, y + h]], '#464d37');
    this.rect(tx - 3, trunkY, 4, h * .6, '#7d7350');
    this.line([[tx, trunkY + h * .24], [tx - 19, trunkY + 7], [tx - 24, trunkY - 8]], '#586044', 6);
    this.line([[tx + 2, trunkY + h * .2], [tx + 19, trunkY - 3]], '#586044', 6);
    this.poly([[tx - 8, y + h], [tx - 18, y + h + 2], [tx - 9, y + h - 9]], '#464d37');
    this.poly([[tx + 7, y + h], [tx + 17, y + h + 2], [tx + 8, y + h - 9]], '#464d37');
    if (snow) {
      this.pine(tx - tw * .6, y - 10, tw * 1.2, h * .82, '#405f55');
      this.pine(tx - tw * .56, y - 9, tw * 1.12, h * .7, '#a5c0ab');
      return;
    }
    const colors = autumn ? ['#705e36', '#9a793d', '#bb9447', '#d1ae5c', '#dfbe70'] : ['#315d42', '#426f45', '#60874b', '#7f9d56', '#a0b667'];
    this.blob(tx - tw * .56, y + 16, tw * 1.13, h * .48, colors[0]);
    for (let i = 0; i < 19; i++) {
      const lx = tx + (hash(i * 2 + o.x) - .5) * tw;
      const ly = y + hash(i * 2 + o.x + 7) * h * .38;
      const lw = tw * (.22 + hash(i + 40) * .22);
      const lh = h * (.15 + hash(i + 75) * .1);
      this.blob(lx - lw / 2 + Math.sin(t * .7 + i) * 1, ly, lw, lh, colors[1 + (i % 4)]);
      if (i % 2 === 0) this.rect(lx - lw * .2, ly + 3, lw * .27, 3, colors[4]);
    }
    for (let i = 0; i < 4; i++) {
      const lx = tx - tw * .4 + hash(i + o.x) * tw * .8;
      const ly = y + h * (.22 + hash(i + o.x + 14) * .23);
      this.rect(lx, ly, 4, 4, '#d5bd75');
    }
  }

  campfire(x, y, w, h) {
    const cx = x + w / 2, base = y + h;
    const glow = this.c.createRadialGradient(cx, base - 10, 3, cx, base - 10, 65);
    glow.addColorStop(0, '#edb65c33'); glow.addColorStop(1, '#edb65c00');
    this.c.fillStyle = glow; this.c.fillRect(cx - 65, base - 75, 130, 130);
    for (let i = 0; i < 7; i++) this.blob(cx - 17 + i * 5, base - 5 + Math.sin(i * 1.9) * 4, 8, 5, '#777c63');
    this.line([[cx - 12, base - 3], [cx + 12, base - 9]], '#5b442d', 5);
    this.line([[cx - 12, base - 10], [cx + 10, base - 3]], '#987047', 5);
    this.flame(cx, base - 15, 17, 29);
    this.line([[cx - 21, base - 2], [cx - 10, base - 40], [cx + 20, base - 2]], '#514e38', 3);
    this.rect(cx - 10, base - 24, 20, 9, '#2c3d35'); this.rect(cx - 8, base - 14, 16, 4, '#324239');
    this.rect(cx - 12, base - 25, 24, 3, '#8d9271');
    for (let i = 0; i < 3; i++) {
      const sy = base - 43 - ((this.view.t * 13 + i * 11) % 35);
      this.c.globalAlpha = .14;
      this.blob(cx + Math.sin(this.view.t + i) * 6 - 6, sy, 12 + i * 3, 8, '#d9d9b1');
    }
    this.c.globalAlpha = 1;
  }

  flame(x, y, w = 12, h = 20) {
    const t = this.view.t;
    const flicker = Math.sin(t * 13 + x) * 3;
    this.poly([[x - w / 2, y + h * .35], [x - w / 2 - 2, y], [x - 2, y - h / 2 - flicker], [x + 2, y - 4], [x + w / 2 - 1, y - h * .34], [x + w / 2 + 2, y + h * .2], [x + 2, y + h * .4]], '#da8844');
    this.poly([[x - w * .28, y + h * .3], [x - w * .2, y - 1], [x + 1, y - h * .29], [x + w * .28, y + h * .18], [x + 2, y + h * .32]], '#f6c55f');
    this.rect(x - 2, y + h * .05, 4, h * .23, '#fff0a7');
  }

  tower(x, y, w, h, active) {
    const cx = x + w / 2;
    this.poly([[cx - w * .36, y + h], [cx - w * .2, y + 20], [cx + w * .2, y + 20], [cx + w * .36, y + h]], '#4d6559');
    this.rect(cx - w * .23, y + 22, w * .46, h - 22, '#6e8570');
    for (let i = 0; i < h / 24; i++) this.rect(cx - 13, y + 26 + i * 24, 26, 4, '#405c50');
    this.rect(x - 5, y + 8, w + 10, 13, '#8b9c7f');
    this.poly([[x - 6, y + 8], [cx, y - 8], [x + w + 6, y + 8]], '#486557');
    this.runeGlyph(cx, y + 4, 11, active ? '#a7f1ca' : '#cfbc84', 'wind');
    if (active) {
      const c = this.c;
      c.globalAlpha = .1;
      this.poly([[cx - 5, y], [cx - 40, 0], [cx + 40, 0], [cx + 5, y]], '#c0f5cf');
      c.globalAlpha = 1;
    }
  }

  shrine(s) {
    const { cx, t, state } = this.view;
    const x = s.x - cx, base = s.y || 440;
    if (x < -120 || x > W + 120) return;
    const done = (state.completedShrines || []).includes(s.id);
    const c = this.c, accent = done ? '#e4c77d' : '#86d5be';
    const glow = c.createRadialGradient(x + 20, base - 38, 5, x + 20, base - 38, 74);
    glow.addColorStop(0, done ? '#e6cd6e40' : '#83ebbf33'); glow.addColorStop(1, '#83ebbf00');
    c.fillStyle = glow; c.fillRect(x - 58, base - 116, 154, 154);
    this.rect(x - 18, base - 5, 78, 7, '#4a6251'); this.rect(x - 12, base - 11, 66, 7, '#a6ae8a');
    this.poly([[x - 8, base - 12], [x - 5, base - 58], [x + 7, base - 75], [x + 32, base - 78], [x + 46, base - 57], [x + 49, base - 12]], '#3d5a4c');
    this.poly([[x - 3, base - 13], [x, base - 56], [x + 10, base - 70], [x + 30, base - 72], [x + 40, base - 55], [x + 43, base - 13]], '#8f9b77');
    this.rect(x + 1, base - 53, 6, 39, '#a8b28b'); this.rect(x + 35, base - 53, 6, 39, '#5e785b');
    this.rect(x + 12, base - 49, 20, 35, '#203f36'); this.rect(x + 14, base - 46, 16, 29, accent);
    c.globalAlpha = .55 + Math.sin(t * 2) * .15;
    this.rect(x + 17, base - 43, 10, 27, '#e9f4bc'); c.globalAlpha = 1;
    this.runeGlyph(x + 21, base - 61, 8, '#e4e8b7', 'wind');
    this.rect(x - 8, base - 30, 6, 3, accent); this.rect(x + 40, base - 30, 6, 3, accent);
    for (let i = 0; i < 6; i++) {
      const a = t * .3 + i * 1.047;
      c.globalAlpha = .3 + Math.sin(t * 2 + i) * .2;
      this.rect(x + 20 + Math.cos(a) * 38, base - 40 + Math.sin(a) * 32, 2, 3, accent);
    }
    c.globalAlpha = 1;
  }

  altar(a) {
    const { cx, t, map } = this.view;
    const x = a.x - cx, y = a.y, w = a.w || 40, h = a.h || 60;
    if (x < -120 || x > W + 120) return;
    const active = map.puzzle?.solved;
    const c = this.c;
    const glow = c.createRadialGradient(x + w / 2, y - 5, 2, x + w / 2, y - 5, 100);
    glow.addColorStop(0, active ? '#cdf1ba44' : '#9bdeb522'); glow.addColorStop(1, '#9bdeb500');
    c.fillStyle = glow; c.fillRect(x - 80, y - 105, 200, 200);
    this.rect(x - 14, y + h - 8, w + 28, 8, '#718b73');
    this.rect(x - 7, y + h - 16, w + 14, 8, '#a1ac86');
    this.rect(x + 4, y + 19, w - 8, h - 35, '#4e6c59');
    this.rect(x - 5, y + 12, w + 10, 12, '#8ca184');
    this.rect(x + 2, y + 9, w - 4, 4, '#bcd4a0');
    const oy = y - 12 + Math.sin(t * 2) * 4;
    this.poly([[x + w / 2, oy - 13], [x + w / 2 + 10, oy], [x + w / 2, oy + 13], [x + w / 2 - 10, oy]], active ? '#daf4ba' : '#639588');
    this.poly([[x + w / 2, oy - 9], [x + w / 2 + 5, oy], [x + w / 2, oy + 7]], '#f4f3cc');
    this.runeGlyph(x + w / 2, y + 34, 8, '#c1d7a0', 'stasis');
  }

  returnPortal() {
    const x = 44 - this.view.cx;
    this.rect(x - 14, 363, 9, 77, '#668b7a'); this.rect(x + 22, 363, 9, 77, '#668b7a');
    this.rect(x - 17, 357, 51, 10, '#8eaa8b');
    this.c.globalAlpha = .25 + Math.sin(this.view.t * 2) * .08;
    this.rect(x - 5, 369, 27, 70, '#99e0bd'); this.c.globalAlpha = 1;
    this.line([[x + 12, 394], [x + 3, 402], [x + 12, 410]], '#c2dfb4');
  }

  item(i) {
    const { cx, t } = this.view;
    const x = i.x - cx, y = i.y + Math.sin(t * 2.8 + i.x) * 2;
    if (x < -30 || x > W + 30) return;
    this.c.globalAlpha = .2; this.blob(x - 2, y + 10, 16, 4, '#233c2c'); this.c.globalAlpha = 1;
    switch (i.type) {
      case 'apple':
        this.blob(x, y, 11, 10, '#b85b45'); this.rect(x + 2, y + 2, 3, 3, '#ed9772');
        this.rect(x + 5, y - 3, 2, 4, '#614e32'); this.rect(x + 7, y - 3, 5, 2, '#9aae64');
        break;
      case 'wood':
        this.rect(x - 1, y + 4, 16, 6, '#856346'); this.rect(x - 2, y + 4, 4, 6, '#b99a65');
        this.rect(x + 5, y, 5, 13, '#795b3e'); this.rect(x + 5, y - 1, 5, 3, '#c4a774');
        break;
      case 'ore':
        this.poly([[x, y + 9], [x + 2, y + 1], [x + 9, y - 2], [x + 15, y + 6], [x + 10, y + 12]], '#657e87');
        this.poly([[x + 4, y + 2], [x + 9, y], [x + 11, y + 5], [x + 4, y + 7]], '#b5cfb9');
        break;
      case 'arrow':
        this.line([[x, y + 11], [x + 14, y - 2]], '#d1c195', 2);
        this.poly([[x + 11, y - 2], [x + 17, y - 4], [x + 15, y + 2]], '#cbd6bd');
        break;
      case 'heart': this.heart(x, y, 2, '#dd8171'); break;
      case 'chest':
        this.rect(x - 4, y, 25, 18, '#4e4735'); this.rect(x - 2, y + 2, 21, 13, '#967747');
        this.rect(x - 2, y + 6, 21, 3, '#c9b075'); this.rect(x + 5, y + 6, 5, 7, '#e0cd8e');
        break;
      default:
        this.poly([[x + 5, y - 3], [x + 11, y + 2], [x + 11, y + 9], [x + 5, y + 14], [x, y + 8], [x, y + 2]], '#b4d78a');
        this.rect(x + 3, y + 1, 3, 8, '#eff4b4');
    }
    if (i.type === 'rupee' || i.type === 'ore') {
      const shine = (Math.sin(t * 4 + i.x) + 1) * .5;
      if (shine > .85) { this.rect(x - 5, y - 5, 6, 2, '#eaf1be'); this.rect(x - 3, y - 7, 2, 6, '#eaf1be'); }
    }
  }

  heart(x, y, s, color) {
    this.rect(x + s, y, s * 2, s, color); this.rect(x + s * 4, y, s * 2, s, color);
    this.rect(x, y + s, s * 7, s * 2, color); this.rect(x + s, y + s * 3, s * 5, s, color);
    this.rect(x + s * 2, y + s * 4, s * 3, s, color); this.rect(x + s * 3, y + s * 5, s, s, color);
  }

  enemy(e) {
    const { cx, t } = this.view;
    const x = e.x - cx, y = e.y, w = e.w || 24, h = e.h || 24;
    if (x < -100 || x > W + 100) return;
    const c = this.c;
    if (e.hurtTimer > 0 && Math.floor(t * 25) % 2) c.globalAlpha = .55;
    this.c.globalAlpha *= .25; this.blob(x - 3, y + h - 3, w + 6, 8, '#1c3026'); c.globalAlpha = 1;
    if (e.type === 'slime') {
      const squish = Math.sin(t * 5 + e.x) * 2;
      this.blob(x - 2, y + 4 + squish, w + 4, h - 4 - squish, '#3c6658');
      this.blob(x, y + 3 + squish, w, h - 8 - squish, '#91b179');
      this.rect(x + 4, y + 6 + squish, 5, 3, '#c3d295');
      this.rect(x + 5, y + h * .54, 3, 4, '#29463b'); this.rect(x + w - 8, y + h * .54, 3, 4, '#29463b');
    } else if (e.type === 'bat') {
      const flap = Math.sin(t * 12) * 8;
      this.poly([[x + 7, y + 6], [x - 12, y - 2 + flap], [x - 7, y + 12], [x + 8, y + 16]], '#5b6276');
      this.poly([[x + w - 7, y + 6], [x + w + 12, y - 2 + flap], [x + w + 7, y + 12], [x + w - 8, y + 16]], '#5b6276');
      this.blob(x + 4, y + 3, w - 8, h - 6, '#887d8b');
      this.rect(x + 7, y + 8, 3, 3, '#ead39e'); this.rect(x + w - 10, y + 8, 3, 3, '#ead39e');
    } else if (e.type === 'guardian' || /boss/.test(e.type || '')) {
      const center = x + w / 2;
      const big = w > 45 || e.isBoss;
      for (let i = 0; i < 4; i++) {
        const lx = center + (i - 1.5) * w * .48;
        const ly = y + h + Math.sin(t * 4 + i) * 3;
        this.line([[center + (i - 1.5) * 7, y + h * .55], [lx, y + h * .56], [lx + (i > 1 ? 8 : -8), ly]], '#596e61', big ? 7 : 4);
        this.rect(lx - 4 + (i > 1 ? 8 : -8), ly - 3, 9, 5, '#8d9c77');
      }
      this.blob(x + w * .15, y, w * .7, h * .82, '#4c655b');
      this.blob(x + w * .24, y + 3, w * .52, h * .6, '#8c9e7d');
      this.rect(center - w * .2, y + h * .25, w * .4, h * .22, '#243f39');
      this.rect(center - (big ? 8 : 4), y + h * .28, big ? 16 : 8, big ? 10 : 6, e.dormant ? '#9d9b79' : e.attackTimer > 0 ? '#e9a77e' : '#91e0cd');
      this.rect(center - 2, y - 6, 4, 8, '#b0b58a');
      this.runeGlyph(center, y + h * .65, big ? 10 : 5, '#a2c2a1', 'stasis');
      if (e.isBoss && e.dormant) {
        this.c.globalAlpha = .45;
        this.line([[x - 8, y + h + 5], [x - 15, y + h * .3], [center, y - 16], [x + w + 15, y + h * .3], [x + w + 8, y + h + 5]], '#d7c48a');
        this.runeGlyph(center, y - 26, 8, '#e4d19b', 'stasis');
        this.c.globalAlpha = 1;
      }
    } else {
      const step = Math.sin(t * 7 + e.x) * 3;
      this.rect(x + 4, y + h - 9, 7, 10 + step, '#554b3b'); this.rect(x + w - 11, y + h - 9, 7, 10 - step, '#554b3b');
      this.blob(x + 3, y + 11, w - 6, h - 17, '#86704e');
      this.blob(x + 1, y, w - 2, h * .55, '#a27e5a');
      this.poly([[x + 3, y + 3], [x - 7, y - 4], [x - 4, y + 10], [x + 5, y + 12]], '#8c6e50');
      this.poly([[x + w - 3, y + 3], [x + w + 7, y - 4], [x + w + 4, y + 10], [x + w - 5, y + 12]], '#8c6e50');
      this.rect(x + 6, y + 8, 3, 3, '#f0d69a'); this.rect(x + w - 9, y + 8, 3, 3, '#f0d69a');
      this.rect(x + w * .4, y + 15, w * .2, 3, '#584b3b');
      this.line([[x + w - 2, y + h * .6], [x + w + 9, y + h * .3]], '#4d4734', 4);
      this.blob(x + w + 3, y + h * .2, 12, 13, '#776146');
    }
    c.globalAlpha = 1;
    if (e.hp < (e.maxHp || e.hp) || e.hurtTimer > 0) {
      this.rect(x - 1, y - 10, w + 2, 5, '#21362c');
      this.rect(x, y - 9, w * clamp(e.hp / (e.maxHp || e.hp || 1), 0, 1), 3, '#d99878');
    }
    if (e.stasis > 0 || e.frozen > 0 || e.stasisTimer > 0 || e.frozenTime > 0) {
      c.globalAlpha = .4; this.rect(x - 5, y - 5, w + 10, h + 10, '#dbd58b'); c.globalAlpha = 1;
      this.runeGlyph(x + w / 2, y - 18, 7, '#f2d98b', 'stasis');
    }
  }

  player(p) {
    const { cx, t } = this.view;
    const c = this.c;
    const x = p.x - cx, y = p.y, w = p.w || 18, h = p.h || 30;
    const center = q(x + w / 2), base = q(y + h), face = p.facing === -1 ? -1 : 1;
    c.globalAlpha = .23; this.blob(center - 13, base - 3, 26, 7, '#1b362b'); c.globalAlpha = 1;
    if (p.invuln > 0 && Math.floor(t * 15) % 2) c.globalAlpha = .5;
    c.save(); c.translate(center, base); c.scale(face, 1);
    const run = Math.abs(p.vx || 0) > 12 && p.onGround;
    const stride = run ? Math.sin(t * 15) * 4 : 0;
    const bob = run ? Math.abs(Math.sin(t * 15)) * 2 : Math.sin(t * 2) * .5;
    // Slate boots, a teal travelling cloak and a pale linen hood: original sprite.
    this.rect(-8, -10 + stride, 6, 10 - stride, '#253c36');
    this.rect(3, -10 - stride, 6, 10 + stride, '#253c36');
    this.rect(-9, -3 + stride * .2, 9, 4, '#736b4f'); this.rect(3, -3 - stride * .2, 10, 4, '#736b4f');
    this.rect(-7, -19 - bob, 15, 13, '#375b50');
    this.rect(-9, -26 - bob, 17, 17, '#24584d');
    this.poly([[-8, -29 - bob], [-14, -17 - bob], [-13 - (run ? stride : 0), -6], [0, -11], [7, -27 - bob]], '#3e7d68');
    this.poly([[-8, -28 - bob], [-11, -17 - bob], [-9, -11], [-5, -18 - bob]], '#6b9b7b');
    this.rect(-2, -23 - bob, 11, 12, '#649880');
    this.rect(-7, -16 - bob, 15, 3, '#a89467'); this.rect(1, -17 - bob, 4, 5, '#d8c68c');
    // Bow and bedroll peep out from the back of the cloak.
    this.line([[-10, -29 - bob], [-15, -22 - bob], [-14, -12], [-10, -8]], '#b09b6b', 2);
    this.line([[-10, -29 - bob], [-10, -8]], '#e6d6a3', 1);
    this.rect(-11, -24 - bob, 5, 9, '#8c7953');
    // Head and soft pointed hood; no borrowed character sprite.
    this.blob(-8, -38 - bob, 18, 16, '#203c35');
    this.blob(-6, -37 - bob, 15, 14, '#bdd0a2');
    this.rect(-4, -36 - bob, 11, 4, '#e2dfb4');
    this.rect(0, -32 - bob, 10, 10, '#dcb98c');
    this.rect(7, -29 - bob, 3, 3, '#2e493d');
    this.rect(9, -25 - bob, 3, 3, '#edcea0');
    this.rect(-3, -24 - bob, 10, 4, '#d4cda1');
    this.rect(-5, -27 - bob, 5, 5, '#aab88c');
    this.rect(-7, -20 - bob, 17, 3, '#c3d0a0');
    this.rect(7, -19 - bob, 5, 7, '#517d65');
    this.rect(9, -13 - bob, 4, 5, '#dcb98c');
    if (p.attackTimer > 0) {
      const phase = clamp(p.attackTimer / .3, 0, 1);
      const sy = -15 - Math.sin(phase * Math.PI) * 14;
      this.rect(9, -20 - bob, 10, 5, '#69927b'); this.rect(17, -20 - bob, 5, 5, '#e0bd8d');
      this.line([[19, -18], [43, sy - 2]], '#354e43', 6);
      this.line([[20, -19], [43, sy - 4]], '#c7e0ca', 4);
      this.line([[19, -23], [23, -12]], '#e3ca8b', 3);
      c.globalAlpha *= .65;
      this.line([[20, -37], [35, -32], [47, -19], [45, -8]], '#e9e9c1', 4);
      c.globalAlpha = 1;
    } else {
      this.line([[9, -7], [20, -27]], '#344c40', 5);
      this.line([[11, -8], [20, -25]], '#b5cbbc', 3);
      this.line([[7, -10], [15, -6]], '#d6bb7b', 3);
    }
    if (p.gliding) {
      this.line([[-9, -24], [-18, -42]], '#d6bb7f'); this.line([[10, -24], [24, -43]], '#d6bb7f');
      this.poly([[-39, -43], [-31, -57], [-3, -68], [28, -59], [42, -43], [18, -48], [1, -44], [-18, -49]], '#2b554b');
      this.poly([[-34, -46], [-28, -55], [-3, -64], [25, -56], [35, -46], [16, -51], [1, -47], [-17, -52]], '#d4b976');
      this.poly([[-3, -64], [1, -47], [16, -51], [25, -56]], '#82966b');
      this.line([[-35, -45], [-3, -65], [36, -45]], '#e7d79a', 2);
      this.runeGlyph(0, -56, 5, '#ecdfaf', 'wind');
    }
    c.restore(); c.globalAlpha = 1;
    if (p.climbing || p.gliding || ((Math.abs(p.vx || 0) > 190) && p.onGround)) {
      const value = clamp((p.stamina ?? 100) / (p.maxStamina || 100), 0, 1);
      c.strokeStyle = '#1f4239'; c.lineWidth = 5; c.beginPath(); c.arc(center + 28, base - 27, 10, 0, TAU); c.stroke();
      c.strokeStyle = value < .25 ? '#e8b276' : '#b4d889'; c.lineWidth = 3; c.beginPath(); c.arc(center + 28, base - 27, 10, -Math.PI / 2, -Math.PI / 2 + TAU * value); c.stroke();
    }
  }

  projectile(p) {
    const x = p.x - this.view.cx, y = p.y;
    if (p.type === 'arrow') {
      const direction = p.vx < 0 ? -1 : 1;
      this.line([[x - direction * 11, y], [x + direction * 7, y]], '#d3c795');
      this.poly([[x + direction * 6, y - 3], [x + direction * 12, y], [x + direction * 6, y + 3]], '#d9e3c7');
      this.line([[x - direction * 7, y - 3], [x - direction * 4, y], [x - direction * 7, y + 3]], '#a6b797');
    } else if (p.type === 'bomb') {
      this.blob(x - 8, y - 8, 16, 16, '#3e7984'); this.blob(x - 5, y - 6, 9, 8, '#8dc9c2');
      this.rect(x - 2, y - 12, 4, 5, '#c3d7ac'); this.rect(x - 1, y - 14, 2, 3, '#f7d687');
    } else {
      this.blob(x - 4, y - 4, 8, 8, '#e7b270'); this.rect(x - 2, y - 2, 4, 4, '#fff0ba');
      this.c.globalAlpha = .3; this.rect(x - (p.vx > 0 ? 12 : -4), y - 2, 12, 4, '#e8af79'); this.c.globalAlpha = 1;
    }
  }

  runeGlyph(x, y, radius, color, type = 'wind') {
    const r = radius;
    if (type === 'wind') {
      this.line([[x - r, y + r * .2], [x + r * .5, y + r * .2], [x + r, y - r * .2], [x + r * .7, y - r * .65], [x + r * .25, y - r * .65]], color);
      this.line([[x - r * .7, y + r * .65], [x + r * .35, y + r * .65], [x + r * .6, y + r]], color);
      this.line([[x - r * .5, y - r * .3], [x, y - r * .3]], color);
    } else if (type === 'magnet') {
      this.line([[x - r * .7, y - r * .7], [x - r * .7, y + r * .4], [x - r * .35, y + r * .8], [x + r * .35, y + r * .8], [x + r * .7, y + r * .4], [x + r * .7, y - r * .7]], color, 3);
      this.rect(x - r, y - r, r * .6, r * .5, color); this.rect(x + r * .4, y - r, r * .6, r * .5, color);
    } else if (type === 'stasis') {
      this.line([[x - r * .65, y - r], [x + r * .65, y - r], [x - r * .55, y + r], [x + r * .65, y + r]], color);
      this.line([[x + r * .65, y - r], [x - r * .65, y - r], [x + r * .55, y + r], [x - r * .65, y + r]], color);
    } else if (type === 'bomb') {
      this.line([[x - r * .6, y - r * .4], [x - r, y + r * .2], [x - r * .6, y + r * .8], [x + r * .5, y + r * .8], [x + r, y + r * .2], [x + r * .6, y - r * .4], [x - r * .6, y - r * .4]], color);
      this.line([[x, y - r * .4], [x, y - r], [x + r * .5, y - r]], color);
    } else {
      this.poly([[x, y - r], [x + r * .6, y - r * .25], [x + r * .8, y + r * .5], [x, y + r], [x - r * .8, y + r * .5], [x - r * .6, y - r * .15], [x - r * .2, y + r * .3]], color);
    }
  }

  effect(e) {
    const { cx, t } = this.view;
    const x = e.x - cx, y = e.y;
    const life = clamp((e.life ?? 1) / (e.maxLife || 1), 0, 1);
    const c = this.c;
    c.globalAlpha = life;
    const type = String(e.type || 'spark');
    const color = e.color || (type.includes('fire') || type.includes('flame') || type.includes('explosion') ? '#efc375' : '#c8e6b1');
    if (e.text || type === 'text') {
      c.font = 'bold 12px monospace'; c.textAlign = 'center'; c.fillStyle = '#203c2f'; c.fillText(e.text || '', q(x + 1), q(y + 1));
      c.fillStyle = color; c.fillText(e.text || '', q(x), q(y));
    } else if (/wind|magnet|stasis|rune/.test(type)) {
      const r = (e.radius || 35) * (1.5 - life * .5);
      c.lineWidth = 2; c.strokeStyle = color; c.beginPath(); c.arc(q(x), q(y), r, 0, TAU); c.stroke();
      this.runeGlyph(x, y, 12, color, this.view.state.rune);
      for (let i = 0; i < 8; i++) this.rect(x + Math.cos(i * TAU / 8 + t) * r, y + Math.sin(i * TAU / 8 + t) * r, 3, 3, color);
    } else if (/explosion|bomb/.test(type)) {
      const r = (e.radius || 50) * (1.2 - life * .5);
      this.blob(x - r, y - r, r * 2, r * 2, color);
      this.blob(x - r * .6, y - r * .6, r * 1.2, r * 1.2, '#fff0b0');
      for (let i = 0; i < 8; i++) this.rect(x + Math.cos(i) * r * 1.4, y + Math.sin(i) * r * 1.4, 5, 5, '#e5a56e');
    } else if (/slash/.test(type)) {
      this.line([[x - 15, y - 19], [x + 6, y - 12], [x + 19, y + 5], [x + 13, y + 18]], color, 4);
    } else {
      const r = 5 + (1 - life) * (e.radius || 24);
      for (let i = 0; i < 6; i++) this.rect(x + Math.cos(i * TAU / 6) * r, y + Math.sin(i * TAU / 6) * r, 2 + life * 2, 2 + life * 2, color);
    }
    c.globalAlpha = 1;
  }

  foreground() {
    const { cx, t, biome, palette: p } = this.view;
    if (/sand|desert|dune|snow|ice|frost/.test(biome)) return;
    // A foreground fringe is restrained, so every collision and resource stays legible.
    for (let i = -1; i < 20; i++) {
      const x = i * 69 - (cx * 1.1 % 69);
      const y = 530 + hash(i + 44) * 12;
      const h = 12 + hash(i + 12) * 19;
      const sway = Math.sin(t * 1.3 + i) * 4;
      this.poly([[x - 8, y + 10], [x - 12 + sway, y - h], [x, y - 4], [x + 4 + sway, y - h * .85], [x + 6, y + 10]], '#304b36');
      this.line([[x - 1, y + 8], [x - 5 + sway, y - h]], '#5a7145');
      if (hash(i + 9) > .7) this.rect(x - 4 + sway, y - h, 4, 4, '#b0aa71');
    }
    // Occasional soft drifting leaf.
    for (let i = 0; i < 4; i++) {
      const x = ((t * 11 + i * 273 - cx * .8) % 1200 + 1200) % 1200 - 120;
      const y = ((t * 5 + i * 117) % 430) + 40;
      this.c.globalAlpha = .65;
      this.poly([[x - 4, y], [x + 3, y - 2], [x + 6, y + 1], [x, y + 3]], '#c0c17b');
    }
    this.c.globalAlpha = 1;
  }

  weather() {
    const { t, map, state, shrine } = this.view;
    if (shrine) return;
    const weather = state.weather || map.weather || 'clear';
    const c = this.c;
    if (weather === 'rain') {
      c.fillStyle = '#203d4a18'; c.fillRect(0, 0, W, H);
      c.globalAlpha = .35;
      for (let i = 0; i < 90; i++) {
        const x = ((hash(i + 4) * W - t * 80) % W + W) % W;
        const y = (hash(i + 3) * H + t * 240) % H;
        this.line([[x, y], [x - 4, y + 11]], '#cee5d7');
      }
      c.globalAlpha = 1;
    } else if (weather === 'snow') {
      for (let i = 0; i < 70; i++) {
        const x = (hash(i + 4) * W + Math.sin(t * .4 + i) * 30 + W) % W;
        const y = (hash(i + 5) * H + t * (10 + hash(i) * 18)) % H;
        c.globalAlpha = .3 + hash(i) * .5; this.rect(x, y, i % 5 === 0 ? 4 : 2, 2, '#eef3d9');
      }
      c.globalAlpha = 1;
    } else if (weather === 'sand') {
      c.fillStyle = '#e7cc8620'; c.fillRect(0, 0, W, H);
      c.globalAlpha = .3;
      for (let i = 0; i < 65; i++) {
        const x = (hash(i) * W + t * (60 + i % 6 * 10)) % W;
        const y = hash(i + 32) * H;
        this.rect(x, y, 2 + (i % 5) * 2, 2, '#e6d4a1');
      }
      c.globalAlpha = 1;
    }
  }
}
