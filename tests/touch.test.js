import test from 'node:test';
import assert from 'node:assert/strict';
import { TouchControls } from '../src/touch.js';

class Button extends EventTarget {
  constructor(dataset) {
    super(); this.dataset = dataset; this.disabled = false; this.attributes = new Map(); this.classes = new Set();
    this.classList = { add: name => this.classes.add(name), remove: name => this.classes.delete(name) };
  }
  setAttribute(name, value) { this.attributes.set(name, value); }
  setPointerCapture() {}
  hasPointerCapture() { return false; }
}

function pointer(target, type, pointerId) {
  const event = new Event(type, { cancelable: true });
  Object.assign(event, { pointerId, pointerType: 'touch', button: 0 });
  target.dispatchEvent(event);
}

function setup(t, options = {}) {
  const right = new Button({key:'ArrowRight'});
  const jump = new Button({key:'Space'});
  const sword = new Button({action:'attack', repeat:'120'});
  const rune = new Button({action:'cycleRune'});
  const eventTarget = new EventTarget();
  const visibilityTarget = new EventTarget();
  visibilityTarget.hidden = false;
  const keys = [], actions = [];
  const controls = new TouchControls({querySelectorAll: () => [right,jump,sword,rune]}, {
    onKey: (...args) => keys.push(args), onAction: action => actions.push(action), eventTarget, visibilityTarget, ...options,
  });
  t.after(() => controls.destroy());
  return {right,jump,sword,rune,eventTarget,visibilityTarget,keys,actions,controls};
}

test('two fingers can move and jump independently; releasing one does not release the other', t => {
  const {right,jump,eventTarget,keys,controls} = setup(t);
  pointer(right,'pointerdown',1);
  pointer(jump,'pointerdown',2);
  assert.deepEqual(keys,[['ArrowRight',true],['Space',true]]);
  pointer(eventTarget,'pointerup',2);
  assert.deepEqual(keys.at(-1),['Space',false]);
  assert.equal(controls.heldKeys.get('ArrowRight'),1);
  assert.ok(right.classes.has('pressed'));
  pointer(right,'pointerdown',3);
  pointer(eventTarget,'pointerup',1);
  assert.equal(controls.heldKeys.get('ArrowRight'),1,'a second finger holding the same key must survive');
  pointer(eventTarget,'pointerup',3);
  assert.deepEqual(keys.at(-1),['ArrowRight',false]);
  assert.equal(right.attributes.get('aria-pressed'),'false');
});

test('cancelled fingers, lost capture, blur and backgrounding release all held input', t => {
  const {right,jump,eventTarget,visibilityTarget,keys,controls} = setup(t);
  pointer(right,'pointerdown',1);
  pointer(eventTarget,'pointercancel',1);
  assert.deepEqual(keys.at(-1),['ArrowRight',false]);
  pointer(right,'pointerdown',2);
  pointer(right,'lostpointercapture',2);
  assert.deepEqual(keys.at(-1),['ArrowRight',false]);
  pointer(right,'pointerdown',3);
  pointer(jump,'pointerdown',4);
  eventTarget.dispatchEvent(new Event('blur'));
  assert.equal(controls.heldKeys.size,0);
  assert.equal(controls.pointers.size,0);
  pointer(right,'pointerdown',5);
  visibilityTarget.hidden = true;
  visibilityTarget.dispatchEvent(new Event('visibilitychange'));
  assert.equal(controls.pointers.size,0);
  assert.deepEqual(keys.at(-1),['ArrowRight',false]);
});

test('holding attack repeats until release, while rune switching fires only once per press', t => {
  t.mock.timers.enable({apis:['setTimeout']});
  const {sword,rune,eventTarget,actions} = setup(t);
  pointer(sword,'pointerdown',1);
  for (let i=0;i<3;i++) t.mock.timers.tick(120);
  assert.deepEqual(actions,['attack','attack','attack','attack']);
  pointer(eventTarget,'pointerup',1);
  t.mock.timers.tick(1000);
  assert.equal(actions.length,4,'releasing outside the button must stop repeated attacks');
  pointer(rune,'pointerdown',2);
  t.mock.timers.tick(1000);
  assert.equal(actions.filter(a=>a==='cycleRune').length,1);
});

test('paused controls and disabled buttons cannot act or keep repeating', t => {
  t.mock.timers.enable({apis:['setTimeout']});
  let active = true;
  const {sword,rune,actions,controls} = setup(t,{canPlay:()=>active});
  rune.disabled = true;
  pointer(rune,'pointerdown',1);
  assert.equal(actions.length,0);
  pointer(sword,'pointerdown',2);
  active = false;
  t.mock.timers.tick(120);
  assert.equal(actions.length,1);
  assert.equal(controls.pointers.size,0);
  pointer(sword,'pointerdown',3);
  assert.equal(actions.length,1);
});
