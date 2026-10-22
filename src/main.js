import { Game } from './game.js';
import { MAPS, SHRINES } from './world.js';
import { AudioManager } from './audio.js';
import { TouchControls } from './touch.js';

const $ = id => document.getElementById(id);
const escapeHTML = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const icon = name => `<svg><use href="#i-${name}"/></svg>`;
const runes = [
  { id:'wind', name:'疾风', full:'风之力', symbol:'≋', description:'唤起气流 · 托起滑翔翼' },
  { id:'magnet', name:'磁力', full:'磁石之力', symbol:'⊓', description:'移动金属 · 打开通路' },
  { id:'stasis', name:'静滞', full:'时之静滞', symbol:'◷', description:'冻结机关 · 停住敌人' },
  { id:'bomb', name:'爆弹', full:'遥控爆弹', symbol:'◉', description:'炸开裂岩 · 击退敌人' },
  { id:'flame', name:'火焰', full:'萤火之息', symbol:'♧', description:'融化坚冰 · 点燃火把' },
];
const biomeSymbols = ['♧','♣','≋','△','♨','❄','≋','✧','♜','♛'];
const weatherNames = { clear:'晴', rain:'雨', snow:'雪', sand:'风沙' };
const fieldNotes = [
  '爬上高处，撑开滑翔伞。<br>有时候，绕远的路风景更好。',
  '雨落在树梢，也落在旅人的心上。<br>在营火旁，为自己做一份热食。',
  '湖水收藏天空，风收藏远方。<br>跳起后再按空格，与云并肩。',
  '世界不会给你唯一的答案。<br>试试用不同的符文，打开新的路。',
  '每一座神庙都有自己的秘密。<br>读懂石碑，让符文回应机关。',
];
const canvas = $('gameCanvas');
const touchDevice = navigator.maxTouchPoints > 0 || matchMedia('(pointer:coarse)').matches;
document.body.classList.toggle('touch-device', touchDevice);
const compactTouch = () => touchDevice && (innerWidth <= 1024 || innerHeight <= 600);
const audio = new AudioManager();
let game;
let snapshot = {};
let currentDialog = '';
let pausedBeforeDialog = false;
let lastRegion = '';
let toastHistory = new Map();
let saveAnimation;
let touchControls;
let viewportFrame;
let scrollBeforePlay = 0;

function mobileInstructions(value) {
  if (!touchDevice) return value;
  return String(value)
    .replace(/C\s+烹饪\s*·\s*E\s+营火休憩/g, '点“烹饪”制作料理 · 点“交互”休憩')
    .replace(/按\s*R\s*切换/g, '点“切换符文”').replace(/R\s*切换符文/g, '切换符文')
    .replace(/F\s*(施放|释放)/g, '点“符文”$1').replace(/按\s*F/g, '点“符文”').replace(/按\s*E/g, '点“交互”').replace(/\bE\s+/g, '点“交互”').replace(/\bE\b/g, '交互')
    .replace(/按\s*C/g, '点“烹饪”').replace(/\bC\b/g, '烹饪').replace(/\bQ\b/g, '食用')
    .replace(/按\s*M/g, '打开地图').replace(/按\s*K\s*(射箭)?/g, '点“射箭”').replace(/按\s*J/g, '点“攻击”')
    .replace(/按\s*W/g, '按住“攀爬”').replace(/按\s*Shift/gi, '按住“冲刺”')
    .replace(/空格/g, '“跳跃”').replace(/A\s*\/\s*D/g, '左右按钮');
}

function resizeViewport() {
  cancelAnimationFrame(viewportFrame);
  viewportFrame = requestAnimationFrame(() => {
    const size = canvas.getBoundingClientRect();
    if (game && size.height > 0) game.setViewport(touchDevice ? 540 * size.width / size.height : 960);
  });
}

function syncWindowSize() {
  touchControls?.releaseAll();
  document.documentElement.style.setProperty('--app-height', `${Math.round(window.visualViewport?.height || innerHeight)}px`);
  resizeViewport();
}

function setPlayMode(enabled) {
  if (!touchDevice) return;
  const wasEnabled = document.body.classList.contains('play-mode');
  if (enabled && !wasEnabled) scrollBeforePlay = scrollY;
  touchControls?.releaseAll();
  document.body.classList.toggle('play-mode', enabled);
  document.querySelectorAll('.app-header, .intro-row, .adventure-panels, .page-footer').forEach(node => { node.inert = enabled; });
  $('fullscreenButton').setAttribute('aria-pressed', String(enabled));
  $('fullscreenButton').setAttribute('aria-label', enabled ? '退出沉浸模式' : '进入沉浸模式');
  $('fullscreenButton').title = enabled ? '退出沉浸模式' : '进入沉浸模式';
  $('fullscreenButton').querySelector('use').setAttribute('href', enabled ? '#i-collapse' : '#i-expand');
  if (!enabled && wasEnabled) {
    if (game?.started) game.pause(true);
    requestAnimationFrame(() => window.scrollTo({top:scrollBeforePlay, behavior:'instant'}));
  }
  syncWindowSize();
}

function toast(text, kind = 'info') {
  if (!text) return;
  const now = Date.now();
  if (now - (toastHistory.get(text) || 0) < 1500) return;
  toastHistory.set(text, now);
  const node = document.createElement('div');
  node.className = `toast ${kind}`;
  node.textContent = mobileInstructions(text);
  $('toastStack').append(node);
  while ($('toastStack').children.length > (touchDevice ? 2 : 3)) $('toastStack').firstChild.remove();
  setTimeout(() => { node.classList.add('removing'); setTimeout(() => node.remove(), 350); }, 3600);
}

function drawHearts(hp = 6, maxHp = 6) {
  const key = `${hp}/${maxHp}`;
  if ($('hearts').dataset.value === key) return;
  $('hearts').dataset.value = key;
  $('hearts').setAttribute('aria-label', `生命 ${hp} / ${maxHp}`);
  $('hearts').innerHTML = Array.from({length: Math.ceil(maxHp / 2)}, (_, i) => `<span class="heart ${hp >= i * 2 + 2 ? '' : hp > i * 2 ? 'half' : 'empty'}"></span>`).join('');
}

function updateSnapshot(next) {
  snapshot = next;
  const meta = MAPS.find(m => m.id === next.mapId) || MAPS[0];
  const completed = next.completedShrines?.length || 0;
  $('regionLabel').textContent = next.shrineName || next.mapName || meta.name;
  $('regionTag').textContent = next.shrineId ? 'ANCIENT SANCTUARY' : meta.subtitle;
  $('regionCount').textContent = String(next.visited?.length || 1).padStart(2, '0');
  drawHearts(next.hp, next.maxHp);
  const energy = Math.max(0, Math.min(100, (next.stamina ?? 100) / (next.maxStamina || 100) * 100));
  $('staminaBar').style.width = `${energy}%`;
  $('staminaBar').style.background = energy < 25 ? '#e8aa69' : '#c8e58e';
  $('arrowCount').textContent = next.arrows ?? 20;
  $('touchArrowCount').textContent = next.arrows ?? 20;
  $('touchFoodCount').textContent = next.inventory?.food ? `料理 × ${next.inventory.food}` : `苹果 × ${next.inventory?.apple || 0}`;
  $('touchCookButton').disabled = !next.canCook;
  $('touchCookButton').querySelector('small').textContent = next.canCook ? '烹饪 / 制箭' : '靠近营火';
  const bossVisible = Boolean(next.started && next.boss && !next.shrineId && next.x > 1900);
  $('bossHud').classList.toggle('hidden', !bossVisible);
  if (bossVisible) {
    $('bossHealth').style.width = `${Math.max(0, next.boss.hp / next.boss.maxHp * 100)}%`;
    $('bossHealthText').textContent = `${next.boss.hp} / ${next.boss.maxHp}`;
  }
  $('foodCount').textContent = next.inventory?.food ?? 2;
  $('orbCount').textContent = next.orbs ?? completed;
  $('shrineCount').textContent = completed;
  $('questProgress').style.width = `${completed / 15 * 100}%`;
  $('questTitle').textContent = next.gameWon ? '风记得每一位旅人' : completed === 15 ? '最后的黎明' : completed > 0 ? '收集风的十五道回响' : '唤醒沉睡的旷野';
  $('questText').textContent = mobileInstructions(next.quest || '循着青色的光，寻找第一座古代神庙。');
  const rune = runes.find(r => r.id === next.rune) || runes[0];
  $('runeSymbol').textContent = rune.symbol;
  $('runeName').textContent = rune.full;
  $('touchRuneSymbol').textContent = rune.symbol;
  $('touchRuneName').textContent = rune.name;
  $('touchControls').querySelector('[data-action="cycleRune"]').setAttribute('aria-label', `切换符文，当前${rune.name}`);
  const totalMinutes = 360 + Math.floor((next.playTime || 0) / 2);
  const hour = String(Math.floor(totalMinutes / 60) % 24).padStart(2, '0');
  const minute = String(totalMinutes % 60).padStart(2, '0');
  $('weatherLabel').textContent = `${next.shrineId ? '遗迹' : weatherNames[next.weather] || '晴'} · ${hour}:${minute}`;
  const active = Boolean(next.started);
  document.body.classList.toggle('game-started', active);
  if (next.paused) touchControls?.releaseAll();
  $('startScreen').classList.toggle('hidden', active);
  $('runeHud').classList.toggle('hidden', !active);
  $('pauseScreen').classList.toggle('hidden', !active || !next.paused || Boolean(currentDialog));
  const showInteraction = active && !next.paused && Boolean(next.interaction);
  $('interactionPrompt').classList.toggle('hidden', !showInteraction);
  if (showInteraction) {
    const match = next.interaction.match(/^([ECRF])\s+/i);
    $('interactionPrompt').querySelector('kbd').textContent = touchDevice ? '提示' : match ? match[1] : '✦';
    $('interactionPrompt').querySelector('span').textContent = mobileInstructions(touchDevice ? next.interaction : match ? next.interaction.slice(match[0].length) : next.interaction);
  }
  $('pauseButton').setAttribute('aria-label', next.paused ? '继续游戏' : '暂停游戏');
  $('pauseButton').title = next.paused ? '继续游戏' : '暂停游戏';
  if (lastRegion !== `${next.mapId}/${next.shrineId || ''}`) {
    const isFirst = !lastRegion;
    lastRegion = `${next.mapId}/${next.shrineId || ''}`;
    $('fieldTip').innerHTML = fieldNotes[(meta.index - 1) % fieldNotes.length];
    if (!isFirst && active) revealLocation(next.shrineName || next.mapName || meta.name, next.shrineId ? 'THE ANCIENT TRIAL' : meta.subtitle);
  }
}

function revealLocation(name, subtitle) {
  const node = $('locationReveal');
  node.innerHTML = `${escapeHTML(name)}<small>${escapeHTML(subtitle)}</small>`;
  node.classList.remove('show');
  void node.offsetWidth;
  node.classList.add('show');
}

function handleEvent(event) {
  if (event.type === 'toast') toast(event.text, event.kind);
  if (event.type === 'sound') audio.play(event.name);
  if (event.type === 'shrineComplete') { audio.play('shrine'); flashSave(); }
  if (event.type === 'death') audio.play('death');
  if (event.type === 'victory') { audio.play('victory'); setTimeout(showVictory, 900); }
  if (event.type === 'save') flashSave();
}

function flashSave() {
  $('saveStatus').innerHTML = '<i></i> 冒险已保存';
  clearTimeout(saveAnimation);
  saveAnimation = setTimeout(() => { $('saveStatus').innerHTML = '<i></i> 冒险自动保存'; }, 2500);
}

try {
  game = new Game(canvas, { onUpdate:updateSnapshot, onEvent:handleEvent });
  window.__game = game;
  updateSnapshot(game.getSnapshot());
  let hasSave = false;
  try { hasSave = Boolean(localStorage.getItem('wilds-of-the-wind-v1')); } catch {}
  if (hasSave && !snapshot.started) $('startButton').innerHTML = `继续这段旅程 ${icon('arrow')}`;
} catch (error) {
  console.error('Game initialization failed', error);
  $('startButton').textContent = '重新载入';
  $('startButton').onclick = () => location.reload();
  toast('冒险未能载入，请刷新页面重试。', 'warning');
}

function act(action) {
  if (!game) return;
  if (!snapshot.started) { startAdventure(); return; }
  if (snapshot.paused && !currentDialog) game.pause(false);
  game[action]?.();
  updateSnapshot(game.getSnapshot());
}

function startAdventure() {
  if (!game) return;
  audio.unlock();
  if (compactTouch()) setPlayMode(true);
  game.start();
  game.pause(false);
  updateSnapshot(game.getSnapshot());
  canvas.focus({preventScroll:true});
  audio.play('start');
  revealLocation(snapshot.mapName, (MAPS.find(m => m.id === snapshot.mapId) || MAPS[0]).subtitle);
}

function showDialog(type, title, eyebrow, html) {
  if (!game) return;
  if (!$('gameDialog').open) pausedBeforeDialog = Boolean(snapshot.paused);
  currentDialog = type;
  game.pause(true);
  $('dialogTitle').textContent = title;
  $('dialogEyebrow').textContent = eyebrow;
  $('dialogContent').innerHTML = html;
  if (!$('gameDialog').open) $('gameDialog').showModal();
  $('gameDialog').scrollTop = 0;
  updateSnapshot(game.getSnapshot());
  audio.play('menu');
}

function closeDialog() {
  if (!$('gameDialog').open) return;
  $('gameDialog').close();
  finishDialog();
}
function finishDialog() {
  if (!currentDialog) return;
  currentDialog = '';
  game?.pause(pausedBeforeDialog);
  if (game) updateSnapshot(game.getSnapshot());
  if (snapshot.started) canvas.focus({preventScroll:true});
}
$('gameDialog').addEventListener('close', finishDialog);
$('gameDialog').addEventListener('click', event => {
  if (event.target === $('gameDialog')) {
    const r = $('gameDialog').getBoundingClientRect();
    if (event.clientX < r.left || event.clientX > r.right || event.clientY < r.top || event.clientY > r.bottom) closeDialog();
  }
});

function showMap() {
  const completed = snapshot.completedShrines || [];
  const visited = snapshot.visited || ['map-01'];
  const regionCards = MAPS.map((m, index) => {
    const isCurrent = snapshot.mapId === m.id;
    const known = visited.includes(m.id);
    const shrines = SHRINES.filter(s => s.mapId === m.id);
    return `<button class="map-region ${isCurrent ? 'current' : ''}" data-travel="${m.id}" ${known ? '' : 'disabled'} aria-label="${m.name}${known ? '，传送' : '，尚未探索'}"><span class="map-number">${String(index + 1).padStart(2,'0')}</span>${isCurrent ? '<span class="map-position">你在这里</span>' : ''}<span class="map-emoji">${biomeSymbols[index]}</span><strong>${escapeHTML(m.name)}</strong><small>${known ? '已探索 · 点击传送' : '沿着旷野向东探索'}</small><span class="map-shrines">${shrines.map(s => completed.includes(s.id) ? '◆' : '◇').join(' ')}</span></button>`;
  }).join('');
  const shrineList = SHRINES.map(s => {
    const complete = completed.includes(s.id);
    const region = MAPS.find(m => m.id === s.mapId);
    const rune = runes.find(r => r.id === s.rune);
    return `<div class="shrine-entry ${complete ? 'complete' : ''}"><span>${complete ? '◆' : rune?.symbol || '◇'}</span><div><strong>${String(s.index).padStart(2,'0')} ${escapeHTML(s.name)}</strong><small>${escapeHTML(region.name)} · ${complete ? '已点亮' : `${rune?.name || ''}试炼`}</small></div></div>`;
  }).join('');
  showDialog('map', '风吹过的地方', 'ATLAS OF THE WANDERING WIND', `<p class="dialog-description">十片原野，由一条向东延伸的路相连。走到地图边缘，便会发现下一片风景。已探索的区域可以自由传送。</p><div class="map-legend"><span><i class="legend-dot current"></i>当前位置</span><span><i class="legend-dot"></i>可传送</span><span><i class="legend-dot locked"></i>尚未探索</span></div><div class="world-map">${regionCards}</div><h3 class="shrine-log-heading">古代神庙 <small>${completed.length} / 15 座已点亮</small></h3><div class="shrine-list">${shrineList}</div><div class="dialog-footer">集齐十五枚风之灵珠，唤醒苍穹王庭的最后守卫。每完成四座神庙，获得一颗额外的心。</div>`);
  $('dialogContent').querySelectorAll('[data-travel]').forEach(button => button.addEventListener('click', () => {
    const id = button.dataset.travel;
    if (!snapshot.started) { closeDialog(); startAdventure(); }
    else { pausedBeforeDialog = false; closeDialog(); }
    game.travel(id);
    updateSnapshot(game.getSnapshot());
  }));
}

function showHelp() {
  const controls = [
    ['左右移动',['A','D'], '或方向键'],['跳跃 / 空中滑翔',['SPACE'], '空中再按一次'],
    ['靠近树木或墙壁攀爬',['W'], '消耗体力'],['冲刺',['SHIFT'], '消耗体力'],
    ['挥剑攻击',['J'], '连按可连续攻击'],['弓箭射击',['K'], '需要箭矢'],
    ['交互 / 进入 / 领取',['E'], '靠近目标'],['释放当前符文',['F'], '靠近机关'],
    ['切换符文',['R'], '五种古代之力'],['食用料理',['Q'], '恢复生命'],
    ['营火烹饪',['C'], '消耗 2 个苹果'],['世界地图 / 行囊',['M','I'], '暂停时也可查看'],
    ['暂停 / 继续',['ESC'], '冒险自动保存'],['冒险指南',['H'], '随时重温'],
  ];
  const touchGuide = touchDevice ? '<div class="mobile-help"><h3>双手就能出发</h3><p>左侧左右移动，按住攀爬或冲刺；右侧跳跃、挥剑、射箭、交互和释放符文。可同时按住移动与动作，长按攻击或射箭连续出招。空中再点一次跳跃即可滑翔。</p><p>下方点击符文名字快速切换，点击食用恢复生命，靠近营火后点击烹饪。顶部可打开地图、行囊和暂停；点右上角收起图标退出沉浸模式。竖屏与横屏都能游玩。</p></div>' : '';
  showDialog('help', '风野生存手册', 'A GUIDE FOR THE CURIOUS', `<p class="help-intro">${mobileInstructions('你可以随心探索。向东穿过十张地图，在青色神庙前按 E 进入，读懂石碑，用对应符文唤醒机关，再前往最右侧祭坛领取灵珠。')}</p>${touchGuide}<div class="help-grid">${controls.map(([label,keys,note]) => `<div class="help-row"><span>${label} <small>${note}</small></span><div>${keys.map(k => `<kbd>${k}</kbd>`).join('')}</div></div>`).join('')}</div><div class="guide-blocks"><div class="guide-block"><h3>让身体追上风</h3><p>${mobileInstructions('跳跃后再次按空格展开滑翔翼。靠近树木或墙壁按 W 攀爬，按 Shift 冲刺。绿色体力会在地面自动恢复。')}</p></div><div class="guide-block"><h3>让符文回应世界</h3><p>${mobileInstructions('风托起你，磁力移动金属，静滞停止时间，爆弹炸开裂岩，火焰点亮灯火。切换符文后，靠近机关按 F。')}</p></div><div class="guide-block"><h3>让旅途留下回响</h3><p>拾取苹果、木材与矿石，搜寻宝箱，在营火旁烹饪。神庙永久记录进度，倒下后在营地重生。十五枚灵珠将唤醒终局。</p></div></div><div class="dialog-footer">进度保存在此浏览器；离开或刷新后可继续。符文也可以在行囊中直接装备。</div>`);
}

function showBag() {
  const inv = snapshot.inventory || {};
  const cards = [
    ['♨','野炊料理',inv.food || 0,'恢复 4 点生命'],['●','新鲜苹果',inv.apple || 0,'烹饪的好材料'],
    ['▰','干燥木材',inv.wood || 0,'来自旷野的馈赠'],['◆','星纹矿石',inv.ore || 0,'古老大地的结晶'],
  ];
  showDialog('bag', '陪你走远的东西', 'THE WANDERER’S SATCHEL', `<div class="bag-stats"><span><b>${snapshot.rupees || 0}</b> 绿晶</span><span><b>${snapshot.arrows || 0}</b> 箭矢</span><span><b>${snapshot.orbs || 0}</b> 灵珠</span></div><div class="bag-grid">${cards.map(([symbol,name,count,note]) => `<div class="bag-item"><span>${symbol}</span><strong>${name} × ${count}</strong><small>${note}</small></div>`).join('')}</div><div class="bag-actions"><button class="secondary-button" id="eatBagButton">食用料理 · Q</button><button class="secondary-button" id="cookBagButton" ${snapshot.canCook ? '' : 'disabled'}>营火烹饪 · C</button><small>${snapshot.canCook ? '营火温暖 · 2 个苹果可制作 1 份料理' : '靠近营火可烹饪料理'}</small></div><h3 class="shrine-log-heading">古代符文 <small>点击装备 · R 快速切换</small></h3><div class="rune-picker">${runes.map(r => `<button class="rune-card ${r.id === snapshot.rune ? 'active' : ''}" data-rune="${r.id}"><span>${r.symbol}</span><strong>${r.name}</strong><small>${r.description.replace(' · ','<br>')}</small></button>`).join('')}</div><div class="dialog-footer">旅人长剑 · J 近战攻击　／　木制弓 · K 远程攻击　／　滑翔翼 · 空中再次按空格<br>每 4 枚灵珠自动提升生命上限。探索不需要消耗绿晶，尽情选择自己的路线。</div>`);
  $('eatBagButton').addEventListener('click', () => { pausedBeforeDialog = false; closeDialog(); act('eat'); });
  $('cookBagButton').addEventListener('click', () => { pausedBeforeDialog = false; closeDialog(); act('cook'); });
  $('dialogContent').querySelectorAll('[data-rune]').forEach(button => button.addEventListener('click', () => {
    for (let i = 0; i < 5 && game.getSnapshot().rune !== button.dataset.rune; i++) game.cycleRune();
    updateSnapshot(game.getSnapshot());
    $('dialogContent').querySelectorAll('[data-rune]').forEach(b => b.classList.toggle('active', b.dataset.rune === snapshot.rune));
    audio.play('menu');
  }));
}

function showVictory() {
  const s = game.getSnapshot();
  const minutes = Math.floor((s.playTime || 0) / 60);
  showDialog('victory','风会记得你的名字','THE WILD IS FREE AGAIN', `<div class="victory-content"><div class="victory-emblem">✦</div><h3>而冒险，永不落幕。</h3><p>十五道回响重归旷野，王庭迎来了新的黎明。<br>谢谢你，愿意为这个小小的世界，再多走一步。</p><div class="victory-stats"><div><strong>10</strong><span>片自由的原野</span></div><div><strong>15</strong><span>座明亮的神庙</span></div><div><strong>${minutes}</strong><span>分钟的风与远方</span></div></div><button id="keepExploringButton" class="secondary-button">回到风中，继续探索 →</button></div>`);
  $('keepExploringButton').addEventListener('click', () => { pausedBeforeDialog = false; closeDialog(); });
}

function confirmReset() {
  showDialog('reset','重新迎接第一缕风？','A NEW CHAPTER', '<p class="dialog-description">这将清除当前浏览器中的冒险进度，包括神庙、行囊和地图探索记录，从晨露原野重新开始。</p><div class="bag-actions"><button class="secondary-button" id="cancelReset">保留这段旅程</button><button class="secondary-button" id="confirmReset">确认重新开始</button></div>');
  $('cancelReset').addEventListener('click', closeDialog);
  $('confirmReset').addEventListener('click', () => {
    pausedBeforeDialog = false;
    closeDialog();
    game.reset();
    lastRegion = '';
    updateSnapshot(game.getSnapshot());
    $('startButton').innerHTML = `踏入旷野 ${icon('arrow')}`;
    toast('新的一页已经展开。风，依旧在等你。');
  });
}

$('startButton').addEventListener('click', startAdventure);
$('helpButton').addEventListener('click', showHelp);
$('allControlsButton').addEventListener('click', showHelp);
$('mapButton').addEventListener('click', showMap);
$('bagButton').addEventListener('click', showBag);
$('mobileBagButton').addEventListener('click', showBag);
$('orbSlot').addEventListener('click', showMap);
$('foodSlot').addEventListener('click', () => act('eat'));
$('swordSlot').addEventListener('click', () => { act('attack'); canvas.focus({preventScroll:true}); });
$('bowSlot').addEventListener('click', () => { act('shoot'); canvas.focus({preventScroll:true}); });
$('resetButton').addEventListener('click', confirmReset);
$('closeDialog').addEventListener('click', closeDialog);
$('pauseButton').addEventListener('click', () => {
  if (!snapshot.started) return;
  game.togglePause(); updateSnapshot(game.getSnapshot());
});
$('resumeButton').addEventListener('click', () => { if (compactTouch()) setPlayMode(true); game.pause(false); updateSnapshot(game.getSnapshot()); canvas.focus({preventScroll:true}); });
$('audioButton').addEventListener('click', async () => {
  const enabled = !audio.enabled;
  audio.setEnabled(enabled);
  const available = enabled ? await audio.unlock() : true;
  $('audioButton').classList.toggle('audio-on', enabled && available);
  $('audioButton').setAttribute('aria-label', enabled && available ? '关闭声音' : '开启声音');
  $('audioButton').title = enabled && available ? '关闭声音' : '开启声音';
  if (enabled && !available) { audio.setEnabled(false); toast('此浏览器暂不支持声音，仍可继续冒险。'); }
});
$('fullscreenButton').addEventListener('click', async () => {
  if (touchDevice) {
    const enabled = !document.body.classList.contains('play-mode');
    setPlayMode(enabled);
    if (enabled && snapshot.started) { game.pause(false); updateSnapshot(game.getSnapshot()); }
    return;
  }
  try {
    if (document.fullscreenElement) await document.exitFullscreen();
    else if ($('gameStage').requestFullscreen) await $('gameStage').requestFullscreen();
    else toast('浏览器暂不支持全屏，可横屏获得更大视野。');
  } catch { toast('全屏未开启，可继续在当前画面冒险。'); }
});

document.addEventListener('keydown', event => {
  if (event.target.matches('input,textarea,select') || event.ctrlKey || event.metaKey || event.altKey || event.repeat) return;
  const code = event.code;
  if ($('gameDialog').open) {
    if (code === 'KeyM' && currentDialog === 'map' || code === 'KeyI' && currentDialog === 'bag' || code === 'KeyH' && currentDialog === 'help') {
      event.preventDefault(); closeDialog();
    }
    return;
  }
  if (code === 'KeyM') { event.preventDefault(); showMap(); }
  if (code === 'KeyI') { event.preventDefault(); showBag(); }
  if (code === 'KeyH') { event.preventDefault(); showHelp(); }
  if (code === 'Escape' && snapshot.started) { event.preventDefault(); game.togglePause(); updateSnapshot(game.getSnapshot()); }
});

touchControls = new TouchControls($('touchControls'), {
  onKey: (key, pressed) => game?.setInput(key, pressed),
  onAction: action => act(action),
  beforePress: () => { if (!snapshot.started) startAdventure(); },
  canPlay: () => Boolean(game && snapshot.started && !snapshot.paused && !currentDialog),
});
new ResizeObserver(resizeViewport).observe(canvas);
window.addEventListener('resize', syncWindowSize);
window.visualViewport?.addEventListener('resize', syncWindowSize);
window.addEventListener('orientationchange', syncWindowSize);
document.addEventListener('visibilitychange', () => {
  if (document.hidden && game?.started) { game.pause(true); game.save(); }
});
syncWindowSize();
canvas.addEventListener('pointerdown', () => { if (snapshot.started) canvas.focus({preventScroll:true}); });
window.addEventListener('blur', () => { if (snapshot.started && !snapshot.paused && !currentDialog) { game.pause(true); updateSnapshot(game.getSnapshot()); } });
window.addEventListener('beforeunload', () => game?.save());
setInterval(() => { if (snapshot.started && !snapshot.paused) { game.save(); flashSave(); } }, 20000);
