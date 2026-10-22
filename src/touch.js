/** Pointer-based controls: independent fingers, repeat attacks, and reliable release. */
export class TouchControls {
  constructor(element, { onKey, onAction, beforePress = () => true, canPlay = () => true, eventTarget = window, visibilityTarget = document }) {
    this.element = element;
    this.onKey = onKey;
    this.onAction = onAction;
    this.beforePress = beforePress;
    this.canPlay = canPlay;
    this.pointers = new Map();
    this.heldKeys = new Map();
    this.listeners = [];
    const listen = (target, type, callback, options) => {
      target.addEventListener(type, callback, options);
      this.listeners.push(() => target.removeEventListener(type, callback, options));
    };
    for (const button of element.querySelectorAll('[data-key], [data-action]')) {
      listen(button, 'pointerdown', event => this.press(button, event));
      listen(button, 'lostpointercapture', event => this.release(event.pointerId));
      listen(button, 'contextmenu', event => event.preventDefault());
    }
    listen(eventTarget, 'pointerup', event => this.release(event.pointerId));
    listen(eventTarget, 'pointercancel', event => this.release(event.pointerId));
    listen(eventTarget, 'blur', () => this.releaseAll());
    listen(visibilityTarget, 'visibilitychange', () => {
      if (visibilityTarget.hidden) this.releaseAll();
    });
  }

  press(button, event) {
    if (button.disabled || (event.pointerType === 'mouse' && event.button !== 0)) return;
    event.preventDefault();
    if (this.beforePress() === false || !this.canPlay()) return;
    this.release(event.pointerId);
    const entry = { button, key: button.dataset.key, timer: null };
    this.pointers.set(event.pointerId, entry);
    button.classList.add('pressed');
    button.setAttribute('aria-pressed', 'true');
    try { button.setPointerCapture(event.pointerId); } catch { /* Window release is the fallback. */ }
    if (entry.key) {
      const count = this.heldKeys.get(entry.key) || 0;
      this.heldKeys.set(entry.key, count + 1);
      if (!count) this.onKey(entry.key, true);
    } else if (button.dataset.action) {
      this.onAction(button.dataset.action);
      const delay = Math.max(100, Number(button.dataset.repeat) || 0);
      if (button.dataset.repeat && this.pointers.has(event.pointerId)) {
        const repeat = () => {
          if (!this.pointers.has(event.pointerId)) return;
          if (!this.canPlay()) { this.releaseAll(); return; }
          this.onAction(button.dataset.action);
          if (this.pointers.has(event.pointerId)) entry.timer = setTimeout(repeat, delay);
        };
        entry.timer = setTimeout(repeat, delay);
      }
    }
  }

  release(pointerId) {
    const entry = this.pointers.get(pointerId);
    if (!entry) return;
    this.pointers.delete(pointerId);
    clearTimeout(entry.timer);
    if (entry.key) {
      const count = (this.heldKeys.get(entry.key) || 1) - 1;
      if (count > 0) this.heldKeys.set(entry.key, count);
      else { this.heldKeys.delete(entry.key); this.onKey(entry.key, false); }
    }
    if (![...this.pointers.values()].some(other => other.button === entry.button)) {
      entry.button.classList.remove('pressed');
      entry.button.setAttribute('aria-pressed', 'false');
    }
    try {
      if (entry.button.hasPointerCapture?.(pointerId)) entry.button.releasePointerCapture(pointerId);
    } catch { /* The browser may already have cancelled the pointer. */ }
  }

  releaseAll() { for (const id of [...this.pointers.keys()]) this.release(id); }
  destroy() { this.releaseAll(); for (const remove of this.listeners) remove(); this.listeners = []; }
}
