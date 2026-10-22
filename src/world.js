/**
 * The wind remembers every road.
 * Hand-authored, deterministic region and sanctuary data for Wilds of the Wind.
 * Factories always return disposable, mutable copies; metadata is never mutated.
 */

const clone = value => JSON.parse(JSON.stringify(value));
const pad = n => String(n).padStart(2, '0');
const mapId = n => `map-${pad(n)}`;
const shrineId = n => `shrine-${pad(n)}`;

const REGIONS = [
  {
    name: '晨露原野', subtitle: 'THE FIRST LIGHT', biome: 'meadow', weather: 'clear',
    description: '晨光落在青草与遗失的石碑上。沿着风的方向，找回世界的回响。',
    palette: { sky: '#91c8bf', skyBottom: '#e0ddaa', mountain: '#809e88', far: '#a3b896', mid: '#527d69', grass: '#83a953', dirt: '#665840', accent: '#e6bd64' },
    sign: '旅人，欢迎来到晨露原野。E 与石碑、神庙交互；J 挥剑，K 拉弓。每座神庙都藏着一枚风之灵珠。',
    lore: '守风人曾把天空的歌声藏进十五座神庙。找回它们，王庭之门才会再次打开。',
    terrain: [[420, 355, 140, 'stone'], [730, 300, 110, 'wood'], [1450, 350, 170, 'stone'], [2020, 310, 145, 'wood'], [2460, 355, 160, 'stone']],
    resource: 'apple', guardian: false,
  },
  {
    name: '雨鸣密林', subtitle: 'A FOREST THAT LISTENS', biome: 'forest', weather: 'rain',
    description: '苔藓覆盖的树根在细雨中交错。树冠之上，旧时的风铃依然轻响。',
    palette: { sky: '#6d9d96', skyBottom: '#aac4a2', mountain: '#537c70', far: '#638c73', mid: '#31594d', grass: '#71954b', dirt: '#4d4939', accent: '#b9d692' },
    sign: '湿滑的古树可以攀爬：靠近树干按 W。空中再次按空格展开滑翔翼，留意体力。',
    lore: '雨林的树木记得每一个归乡者。营火旁烹饪苹果，能让疲惫的心重新温暖。',
    terrain: [[350, 345, 160, 'wood'], [760, 260, 170, 'wood'], [1300, 330, 200, 'wood'], [1890, 270, 145, 'wood'], [2420, 340, 180, 'wood']],
    resource: 'wood', guardian: false,
  },
  {
    name: '琉璃湖湾', subtitle: 'WHERE THE SKY RESTS', biome: 'coast', weather: 'clear',
    description: '湖面如碎落的琉璃，白鹭与云影擦肩而过。岸边的遗迹等待新的访客。',
    palette: { sky: '#8bc7d0', skyBottom: '#d7e9cb', mountain: '#769daa', far: '#88b9b0', mid: '#4a9093', grass: '#9bbd69', dirt: '#a18e61', accent: '#70d0cc' },
    sign: '湖风温柔，却无法替你恢复体力。落在安全的平台上稍作休息，再开始下一次滑翔。',
    lore: '古人在湖底造镜，倒映永不落下的星辰。如今只有倒影知道归途。',
    terrain: [[380, 360, 150, 'stone'], [820, 310, 200, 'wood'], [1380, 345, 180, 'stone'], [1980, 280, 160, 'stone'], [2550, 355, 150, 'wood']],
    resource: 'apple', guardian: false,
  },
  {
    name: '赤砂峡谷', subtitle: 'THE SUNKEN SUN', biome: 'desert', weather: 'sand',
    description: '赤色岩壁在风沙中发光。古老商队留下的路标，指向砂海深处的绿洲。',
    palette: { sky: '#dbb58e', skyBottom: '#efd7a1', mountain: '#b07860', far: '#c39369', mid: '#a5704d', grass: '#c9b477', dirt: '#8b6245', accent: '#edbc75' },
    sign: '峡谷中的金属装置响应磁力。按 R 切换符文，F 释放；靠近装置再尝试。',
    lore: '风沙会掩埋脚印，却埋不住承诺。断桥另一端，守门人等待最后一封信。',
    terrain: [[380, 355, 190, 'stone'], [820, 285, 155, 'stone'], [1410, 340, 220, 'stone'], [1980, 265, 175, 'stone'], [2470, 345, 180, 'stone']],
    resource: 'ore', guardian: false,
  },
  {
    name: '铸火山麓', subtitle: 'EMBER OF THE EARTH', biome: 'volcano', weather: 'clear',
    description: '熔岩的呼吸穿过黑色山岩。沉睡的锻炉里，还留着不灭的微光。',
    palette: { sky: '#b18a81', skyBottom: '#e1ad8c', mountain: '#665c62', far: '#8a7071', mid: '#514a50', grass: '#ad8052', dirt: '#51423e', accent: '#f2a168' },
    sign: '遥控爆弹能炸开脆岩。火焰符文能点燃火把、融化冰块。神庙碑文会提示正确符文。',
    lore: '铁匠最后一次敲下铁锤时，声音变成了山的心跳。每一块矿石，都藏着火。',
    terrain: [[390, 345, 155, 'stone'], [840, 270, 145, 'stone'], [1400, 350, 200, 'stone'], [1960, 290, 165, 'stone'], [2480, 340, 160, 'stone']],
    resource: 'ore', guardian: true,
  },
  {
    name: '星霜雪岭', subtitle: 'A QUIET KIND OF LIGHT', biome: 'snow', weather: 'snow',
    description: '雪落在旧日的石阶上，群山守望着天空。越过冰脊，便能听见星辰的回声。',
    palette: { sky: '#a7bfce', skyBottom: '#e8e8dc', mountain: '#8198aa', far: '#bccbd2', mid: '#658493', grass: '#dee7df', dirt: '#7c8790', accent: '#b3e2eb' },
    sign: '冰雪也会记住温度。靠近冰障，切换火焰符文并按 F；营火能烹饪热食。',
    lore: '山顶的星星从未坠落。旅人看见的，只是雪花携带的光。',
    terrain: [[420, 350, 170, 'ice'], [870, 270, 155, 'ice'], [1400, 325, 185, 'stone'], [1970, 260, 170, 'ice'], [2490, 350, 180, 'ice']],
    resource: 'ore', guardian: true,
  },
  {
    name: '风车高原', subtitle: 'FOLLOW THE WANDERING WIND', biome: 'highland', weather: 'clear',
    description: '风车无声旋转，芦苇向远方俯身。高原上的每一条路，都通往更宽阔的天空。',
    palette: { sky: '#99c8c1', skyBottom: '#e0dbac', mountain: '#819e85', far: '#aab997', mid: '#69947d', grass: '#9eb869', dirt: '#796849', accent: '#ead287' },
    sign: '上升气流能够托起滑翔翼。在空中按空格展开，再次按空格收起。',
    lore: '这里的人不记录年份，只记风来的方向。离别时，他们把祝福挂在风车上。',
    terrain: [[350, 350, 150, 'wood'], [790, 260, 150, 'wood'], [1340, 335, 190, 'stone'], [1910, 245, 185, 'wood'], [2530, 320, 160, 'wood']],
    resource: 'wood', guardian: true,
  },
  {
    name: '萤光湿地', subtitle: 'WHEN THE FIREFLIES WAKE', biome: 'marsh', weather: 'rain',
    description: '暮色浸入浅水，萤火如落星般漂浮。木栈道的尽头，传来失落文明的低语。',
    palette: { sky: '#728e9c', skyBottom: '#b1b6a1', mountain: '#607d83', far: '#78968c', mid: '#416c68', grass: '#7c9e72', dirt: '#4c5148', accent: '#d0e39d' },
    sign: '弓箭适合对付空中的敌人。按 K 射箭，营地与宝箱中可以补充箭矢。',
    lore: '当最后一盏灯熄灭，萤火虫便接过了守夜的职责。它们会为旅人留下路。',
    terrain: [[360, 355, 180, 'wood'], [820, 285, 165, 'wood'], [1390, 340, 180, 'wood'], [1920, 270, 190, 'wood'], [2510, 345, 180, 'wood']],
    resource: 'wood', guardian: true,
  },
  {
    name: '古钟遗迹', subtitle: 'ECHOES OF THE BEFORE', biome: 'ruins', weather: 'clear',
    description: '藤蔓攀过高耸的石柱，破碎的钟面仍朝向黎明。时间停在了风吹起的那一刻。',
    palette: { sky: '#a9b6ad', skyBottom: '#ded2af', mountain: '#92998b', far: '#a9ac94', mid: '#747e6b', grass: '#9da46e', dirt: '#736b56', accent: '#d5b980' },
    sign: '静滞符文会短暂冻结机关和敌人。十五枚灵珠集齐后，前往东方的苍穹王庭。',
    lore: '钟声不是为了告诉人们时间，而是为了提醒：即使漫长的等待，也终将结束。',
    terrain: [[400, 335, 175, 'stone'], [850, 245, 160, 'stone'], [1400, 320, 180, 'stone'], [1970, 250, 165, 'stone'], [2470, 340, 190, 'stone']],
    resource: 'ore', guardian: true,
  },
  {
    name: '苍穹王庭', subtitle: 'THE WIND WILL REMEMBER', biome: 'castle', weather: 'clear',
    description: '天空之下，王庭的石墙依然挺立。十五道回响在此汇聚，等待一个新的黎明。',
    palette: { sky: '#9c9fae', skyBottom: '#dcc6a4', mountain: '#7a7f8c', far: '#96979a', mid: '#5e6870', grass: '#9a9f77', dirt: '#69685b', accent: '#e2c68b' },
    sign: '把十五座神庙的风之灵珠带到王庭。穿过最后的守卫，让长夜之后的天空重获自由。',
    lore: '不必成为传说中的英雄。只要仍愿意迎着风前行，每一个旅人都能点亮黎明。',
    terrain: [[370, 350, 190, 'stone'], [850, 270, 175, 'stone'], [1380, 330, 190, 'stone'], [1940, 255, 180, 'stone'], [2450, 325, 200, 'stone']],
    resource: 'ore', guardian: true,
  },
];

const SANCTUARIES = [
  { name: '初风之祠', map: 1, type: 'wind', hint: '风可以托举旅人，也可以唤醒沉睡的风叶。在风之机关旁释放疾风符文。', description: '第一缕风，献给愿意迈出第一步的人。', x: 830, variant: 0 },
  { name: '磁石之祠', map: 1, type: 'magnet', hint: '金属方块听得见磁力的召唤。在蓝色方块旁使用磁力符文。', description: '看不见的力量，也能铺就道路。', x: 2680, variant: 0 },
  { name: '停时之祠', map: 2, type: 'stasis', hint: '时间会让石轮停驻。在钟摆机关旁释放静滞符文，再走向祭坛。', description: '在流逝之中，寻找片刻永恒。', x: 1070, variant: 0 },
  { name: '破岩之祠', map: 2, type: 'bomb', hint: '破裂的石块后面藏着通路。在脆岩附近使用遥控爆弹。', description: '道路有时藏在阻碍之中。', x: 2680, variant: 0 },
  { name: '长明之祠', map: 3, type: 'flame', hint: '没有燃尽的火，只有等待点燃的灯。在火把旁使用火焰符文。', description: '让微光从你的指间继续传递。', x: 1080, variant: 0 },
  { name: '潮汐风庭', map: 3, type: 'wind', hint: '湖风沿着石阶上升。在风叶旁使用疾风符文，借上升气流越过阶梯。', description: '听，水面之上还有更宽阔的世界。', x: 2670, variant: 1 },
  { name: '赤铜回廊', map: 4, type: 'magnet', hint: '砂海埋住了道路，却埋不住金属。对铜色方块释放磁力，唤醒石门。', description: '指尖的磁力，牵引千年前的回声。', x: 1070, variant: 1 },
  { name: '砂漏静室', map: 4, type: 'stasis', hint: '让转动的砂漏停下。在时钟机关附近使用静滞符文，石门便会敞开。', description: '每一粒流沙，都是时间的名字。', x: 2680, variant: 1 },
  { name: '余烬锻炉', map: 5, type: 'bomb', hint: '黑岩外壳脆弱而中空。站在断裂岩壁附近，释放遥控爆弹。', description: '旧世界的最后一炉火，等你敲开。', x: 1080, variant: 1 },
  { name: '燃心祭台', map: 5, type: 'flame', hint: '火把上的余温尚未消失。释放火焰符文，让祭台重新明亮。', description: '再微小的火种，也拥有照亮长夜的愿望。', x: 2680, variant: 1 },
  { name: '雪羽风殿', map: 6, type: 'wind', hint: '雪羽等待着能穿过寒冬的风。在风之机关旁释放疾风，唤醒上升气流。', description: '风不惧寒冷，羽毛也不会忘记天空。', x: 1910, variant: 2 },
  { name: '浮铁天阶', map: 7, type: 'magnet', hint: '漂浮的铁块是通向天空的阶梯。靠近金属装置使用磁力符文。', description: '天空与大地，被看不见的线连接着。', x: 1920, variant: 2 },
  { name: '萤时回廊', map: 8, type: 'stasis', hint: '萤火停驻的瞬间，门扉便会醒来。对时间机关使用静滞符文。', description: '记住这一刻，记住微光曾落在掌心。', x: 1910, variant: 2 },
  { name: '裂钟秘室', map: 9, type: 'bomb', hint: '古钟旁的裂石阻隔了最后的回音。靠近裂石使用遥控爆弹。', description: '即使钟已破碎，回声仍会远行。', x: 1920, variant: 2 },
  { name: '黎明灯塔', map: 10, type: 'flame', hint: '为王庭点燃最后一盏灯。在冰封的火把旁释放火焰符文。', description: '这一次，黎明会为你而来。', x: 1620, variant: 2 },
];

export const SHRINES = SANCTUARIES.map((s, i) => ({
  id: shrineId(i + 1), index: i + 1, name: s.name, mapId: mapId(s.map),
  puzzle: s.type, rune: s.type, hint: s.hint, description: s.description,
  x: s.x, variant: s.variant,
}));

function object(id, type, x, y, w, h, extra = {}) {
  return { id, type, x, y, w, h, ...extra };
}

function createRegion(region, i) {
  const id = mapId(i + 1);
  const trees = region.biome === 'desert' ? [660, 1520, 2810] :
    region.biome === 'volcano' ? [180, 1440, 2860] :
    region.biome === 'castle' ? [500, 1260, 2380] :
    [270, 620, 1260, 1720, 2320, 2870];
  const treeTypes = { snow: 'pine', forest: 'oak', marsh: 'willow', desert: 'palm', coast: 'palm', highland: 'birch' };
  const objects = trees.map((x, n) => object(`${id}-tree-${n}`, 'tree', x, 260 - (n % 3) * 14, 50 + (n % 2) * 10, 180 + (n % 3) * 14, { style: treeTypes[region.biome] || 'oak', climbable: true }));
  objects.push(
    object(`${id}-fire`, 'campfire', 185, 412, 34, 28, { text: '旅人营地 · 按 C 烹饪苹果与木材', active: true }),
    object(`${id}-sign`, 'sign', 308, 390, 28, 50, { text: region.sign }),
    object(`${id}-lore`, 'sign', 2180, 390, 28, 50, { text: region.lore }),
    object(`${id}-tower`, 'tower', 3020, 230, 58, 210, { text: `${region.name} · 观风塔`, active: false }),
    object(`${id}-rock-0`, 'rock', 580, 410, 44, 30),
    object(`${id}-rock-1`, 'rock', 1530, 413, 38, 27),
    object(`${id}-crate-0`, 'crate', 2260, 408, 32, 32, { loot: 'arrow' }),
    object(`${id}-crate-1`, 'crate', 2288, 408, 32, 32, { loot: 'apple' }),
  );
  for (let n = 0; n < 19; n++) {
    objects.push(object(`${id}-grass-${n}`, 'grass', 105 + n * 157, 426, 22 + (n % 3) * 8, 14, { flower: n % 4 === 0 }));
  }
  if (region.biome === 'coast' || region.biome === 'marsh') {
    objects.push(object(`${id}-water-a`, 'water', 540, 435, 440, 105, { shallow: true }), object(`${id}-water-b`, 'water', 2350, 435, 370, 105, { shallow: true }));
  }
  if (region.biome === 'highland' || region.biome === 'meadow') {
    objects.push(object(`${id}-updraft`, 'wind', 1860, 285, 90, 155, { active: true, decorative: true }));
  }
  if (region.biome === 'snow') objects.push(object(`${id}-ice`, 'ice', 1210, 388, 50, 52, { breakable: true }));
  if (region.biome === 'volcano') objects.push(object(`${id}-torch`, 'torch', 1180, 382, 20, 58, { active: true }));
  if (region.biome === 'ruins') {
    [630, 1170, 1720, 2370].forEach((x, n) => objects.push(object(`${id}-pillar-${n}`, 'rock', x, 310, 44, 130, { style: 'pillar', climbable: true })));
  }
  if (i === 9) objects.push(object('final-gate', 'gate', 2850, 240, 70, 200, { final: true, requiredOrbs: 15, text: '十五道回响汇聚之时，长夜便会退去。' }));

  const platforms = [
    { x: 0, y: 440, w: 3200, h: 100, kind: 'ground' },
    ...region.terrain.map(([x, y, w, kind]) => ({ x, y, w, h: 16, kind })),
  ];
  const enemyPositions = [690, 1370, 1790, 2390, 2780];
  const enemies = enemyPositions.map((x, n) => ({
    id: `${id}-enemy-${n}`, type: n === 3 ? 'bat' : n === 4 && region.guardian ? 'guardian' : n % 2 === 0 ? 'slime' : 'bokoblin',
    x, y: n === 3 ? 275 : 408, hp: n === 4 && region.guardian ? 7 + Math.floor(i / 3) : 2 + Math.floor(i / 3),
    patrol: n === 3 ? 150 : 100 + n * 12,
  }));
  if (i === 9) enemies.push({ id: 'sky-court-sentinel', type: 'guardian', x: 2960, y: 388, hp: 24, patrol: 120, boss: true, name: '长夜守望者' });
  const items = [
    { id: `${id}-apple-0`, type: 'apple', x: 450, y: 325 },
    { id: `${id}-resource-0`, type: region.resource, x: 790, y: 410 },
    { id: `${id}-rupee-0`, type: 'rupee', x: 870, y: 250 },
    { id: `${id}-arrow-0`, type: 'arrow', x: 1480, y: 315 },
    { id: `${id}-resource-1`, type: region.resource, x: 1745, y: 410 },
    { id: `${id}-chest-0`, type: 'chest', x: 2045, y: 280 },
    { id: `${id}-heart-0`, type: 'heart', x: 2250, y: 405 },
    { id: `${id}-apple-1`, type: 'apple', x: 2500, y: 320 },
    { id: `${id}-rupee-1`, type: 'rupee', x: 2920, y: 405 },
  ];
  const shrines = SHRINES.filter(s => s.mapId === id).map(s => ({ id: s.id, x: s.x, y: 440, name: s.name, rune: s.rune }));
  return {
    id, index: i + 1, name: region.name, subtitle: region.subtitle, description: region.description,
    biome: region.biome, width: 3200, height: 540, groundY: 440, palette: clone(region.palette), weather: region.weather,
    spawn: { x: 105, y: 390 }, platforms, enemies, items, objects, shrines,
    exits: { left: i ? mapId(i) : null, right: i < 9 ? mapId(i + 2) : null },
  };
}

export const MAPS = REGIONS.map(createRegion);

const SHRINE_PALETTE = {
  wind: { sky: '#1f393e', skyBottom: '#40564e', mountain: '#294549', far: '#345453', mid: '#2a4945', grass: '#82977b', dirt: '#44564c', accent: '#bce2bf' },
  magnet: { sky: '#293742', skyBottom: '#465763', mountain: '#344650', far: '#3f5661', mid: '#344b55', grass: '#8aa1a4', dirt: '#4f6269', accent: '#9cd5e1' },
  stasis: { sky: '#423b2e', skyBottom: '#66583b', mountain: '#514a35', far: '#635a40', mid: '#534c36', grass: '#b6a777', dirt: '#6f6348', accent: '#f0d784' },
  bomb: { sky: '#3c343b', skyBottom: '#5d4d4a', mountain: '#4a4147', far: '#625451', mid: '#4e4344', grass: '#b29c81', dirt: '#6d5b50', accent: '#e9ad88' },
  flame: { sky: '#3d3539', skyBottom: '#665248', mountain: '#504043', far: '#685448', mid: '#53443d', grass: '#b5a08b', dirt: '#6e5d52', accent: '#f1c391' },
};

/** Construct a fresh overworld region; rejects accidental missing IDs loudly. */
export function createMap(id = 'map-01') {
  const source = MAPS.find(map => map.id === id);
  if (!source) throw new RangeError(`Unknown region: ${id}`);
  return clone(source);
}

/**
 * Each shrine has three authored variants with different vertical routes.
 * Puzzle state stays in the runtime copy. Gates connect to matching rune targets.
 */
export function createShrine(id) {
  const shrine = SHRINES.find(s => s.id === id);
  if (!shrine) throw new RangeError(`Unknown shrine: ${id}`);
  const v = shrine.variant;
  const gateId = `${id}-gate`;
  const targetX = [575, 605, 630][v];
  const targetY = [394, 394, 394][v];
  const objects = [
    object(`${id}-exit`, 'sign', 62, 386, 30, 54, { text: '归途之门 · 按 E 返回原野', exit: true }),
    object(`${id}-riddle`, 'sign', 305, 386, 30, 54, { text: shrine.hint }),
    object(gateId, 'gate', 1130, 250, 40, 190, { active: false, open: false, target: `${id}-mechanism`, rune: shrine.rune }),
    object(`${id}-lantern-left`, 'torch', 172, 375, 20, 65, { active: true, decorative: true }),
    object(`${id}-lantern-right`, 'torch', 1360, 375, 20, 65, { active: true, decorative: true }),
  ];
  const mechanic = { active: false, target: gateId, rune: shrine.rune, puzzleTarget: true, puzzle: true, text: shrine.hint };
  if (shrine.puzzle === 'wind') {
    objects.push(object(`${id}-mechanism`, 'wind', targetX, 280, 70, 160, mechanic));
    objects.push(object(`${id}-wind-stone`, 'switch', targetX + 98, 422, 36, 18, { ...mechanic, rune: 'wind', visual: 'fan' }));
  } else if (shrine.puzzle === 'magnet') {
    objects.push(object(`${id}-mechanism`, 'metal', targetX, 386, 54, 54, { ...mechanic, movable: true }));
    objects.push(object(`${id}-magnetic-plate`, 'switch', targetX + 130, 426, 62, 14, { target: gateId, rune: 'magnet', visual: 'pressure' }));
  } else if (shrine.puzzle === 'stasis') {
    objects.push(object(`${id}-mechanism`, 'switch', targetX, targetY, 46, 46, { ...mechanic, visual: 'clock', moving: true }));
    objects.push(object(`${id}-pendulum`, 'rock', targetX + 100, 380, 55, 60, { moving: true, rune: 'stasis', decorative: true }));
  } else if (shrine.puzzle === 'bomb') {
    objects.push(object(`${id}-mechanism`, 'rock', targetX, 350, 80 + v * 12, 90, { ...mechanic, breakable: true, cracked: true }));
    objects.push(object(`${id}-supply`, 'crate', 435, 408, 32, 32, { loot: 'arrow' }));
  } else {
    objects.push(object(`${id}-mechanism`, 'torch', targetX, 368, 28, 72, { ...mechanic, active: false }));
    objects.push(object(`${id}-frozen-core`, 'ice', targetX + 86, 390, 45, 50, { ...mechanic, breakable: true, decorative: true }));
  }
  const routes = [
    [ [425, 355, 125], [825, 345, 140], [985, 300, 125], [1235, 345, 115] ],
    [ [410, 365, 110], [540, 300, 105], [905, 335, 140], [1220, 320, 145] ],
    [ [415, 355, 120], [560, 280, 130], [1010, 340, 105], [1215, 285, 150] ],
  ];
  return {
    id: shrine.id, index: shrine.index, name: shrine.name, subtitle: `SANCTUARY ${pad(shrine.index)} · ${shrine.puzzle.toUpperCase()}`,
    description: shrine.description, biome: 'shrine', width: 1600, height: 540, groundY: 440,
    palette: clone(SHRINE_PALETTE[shrine.puzzle]), weather: 'clear', spawn: { x: 110, y: 390 },
    platforms: [ { x: 0, y: 440, w: 1600, h: 100, kind: 'stone' }, ...routes[v].map(([x, y, w]) => ({ x, y, w, h: 16, kind: 'stone' })) ],
    enemies: [],
    items: [ { id: `${id}-rupee`, type: 'rupee', x: 462, y: 320 }, { id: `${id}-chest`, type: 'chest', x: 1260, y: routes[v][3][1] - 30 } ],
    objects, shrines: [], exits: { left: null, right: null },
    puzzle: { type: shrine.puzzle, solved: false, hint: shrine.hint, targetId: `${id}-mechanism`, gateId },
    altar: { x: 1450, y: 380, w: 40, h: 60 },
    returnMapId: shrine.mapId,
  };
}

/** Content-integrity checks, also usable in Node without a browser. */
export function validateWorld() {
  const errors = [];
  if (MAPS.length !== 10) errors.push(`Expected 10 regions, got ${MAPS.length}`);
  if (SHRINES.length !== 15) errors.push(`Expected 15 shrines, got ${SHRINES.length}`);
  const ids = new Set();
  const names = new Set();
  for (const map of MAPS) {
    if (ids.has(map.id)) errors.push(`Duplicate region id ${map.id}`);
    ids.add(map.id);
    if (names.has(map.name)) errors.push(`Duplicate region name ${map.name}`);
    names.add(map.name);
    if (map.width < 3200) errors.push(`Region too small: ${map.id}`);
    if (!map.platforms.some(p => p.x === 0 && p.y === 440 && p.w === map.width)) errors.push(`Missing continuous safe floor: ${map.id}`);
    if (!map.shrines.length) errors.push(`No shrine in ${map.id}`);
    if (!map.enemies.length || !map.items.length || !map.objects.length) errors.push(`Incomplete region ${map.id}`);
    for (const exit of Object.values(map.exits)) if (exit && !MAPS.some(m => m.id === exit)) errors.push(`Broken exit ${map.id} → ${exit}`);
    for (const s of map.shrines) if (!SHRINES.some(meta => meta.id === s.id && meta.mapId === map.id)) errors.push(`Broken shrine entrance ${s.id}`);
  }
  const types = ['wind', 'magnet', 'stasis', 'bomb', 'flame'];
  const shrineIds = new Set();
  for (const shrine of SHRINES) {
    if (shrineIds.has(shrine.id)) errors.push(`Duplicate shrine id ${shrine.id}`);
    shrineIds.add(shrine.id);
    if (!types.includes(shrine.puzzle)) errors.push(`Unknown puzzle ${shrine.id}`);
    if (!MAPS.some(m => m.id === shrine.mapId && m.shrines.some(s => s.id === shrine.id))) errors.push(`Orphan shrine ${shrine.id}`);
    const world = createShrine(shrine.id);
    if (!world.objects.some(o => o.id === world.puzzle.targetId && o.rune === shrine.rune)) errors.push(`Missing puzzle mechanism ${shrine.id}`);
    if (!world.objects.some(o => o.id === world.puzzle.gateId)) errors.push(`Missing puzzle gate ${shrine.id}`);
    if (world.altar.x < 1100 || world.altar.x > world.width - world.altar.w) errors.push(`Inaccessible altar ${shrine.id}`);
  }
  for (const type of types) if (SHRINES.filter(s => s.puzzle === type).length !== 3) errors.push(`Expected 3 ${type} shrines`);
  return errors;
}
