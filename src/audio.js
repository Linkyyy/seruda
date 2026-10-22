// Entirely original, synthesized score and effects. No audio files or network access.
const NOTE = 440 * 2 ** (-69 / 12);
const frequency = (midi) => NOTE * 2 ** (midi / 12);
const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

export class AudioManager {
  constructor() {
    this.enabled = false;
    this.context = null;
    this.master = null;
    this.musicBus = null;
    this.effectsBus = null;
    this.timer = null;
    this.nextBeat = 0;
    this.beat = 0;
    this.voices = new Set();
    this.lastEffects = new Map();
    this.destroyed = false;
    this._visibility = () => {
      if (typeof document === 'undefined') return;
      if (document.hidden) this._stopMusic();
      else if (this.enabled) this.unlock();
    };
    if (typeof document !== 'undefined') {
      document.addEventListener('visibilitychange', this._visibility);
    }
  }

  async unlock() {
    if (this.destroyed) return false;
    try {
      if (!this.context) {
        const AudioContext = globalThis.AudioContext || globalThis.webkitAudioContext;
        if (!AudioContext) return false;
        this.context = new AudioContext();
        this.master = this.context.createGain();
        this.master.gain.value = this.enabled ? 0.32 : 0;
        this.musicBus = this.context.createGain();
        this.musicBus.gain.value = 0.19;
        this.effectsBus = this.context.createGain();
        this.effectsBus.gain.value = 0.42;
        const compressor = this.context.createDynamicsCompressor();
        compressor.threshold.value = -20;
        compressor.knee.value = 20;
        compressor.ratio.value = 4;
        this.musicBus.connect(this.master);
        this.effectsBus.connect(this.master);
        this.master.connect(compressor);
        compressor.connect(this.context.destination);
      }
      if (this.context.state === 'suspended') await this.context.resume();
      if (this.enabled && this.context.state === 'running') this._startMusic();
      return this.context.state === 'running';
    } catch {
      // Audio is optional. A denied autoplay policy must not interrupt the game.
      return false;
    }
  }

  setEnabled(enabled) {
    if (this.destroyed) return;
    this.enabled = Boolean(enabled);
    if (this.master && this.context) {
      const now = this.context.currentTime;
      this.master.gain.cancelScheduledValues(now);
      this.master.gain.setTargetAtTime(this.enabled ? 0.32 : 0, now, 0.04);
    }
    if (this.enabled) void this.unlock();
    else this._stopMusic();
  }

  _tone(midi, when, length, volume = 0.3, wave = 'triangle', bus = this.effectsBus, slide) {
    const ctx = this.context;
    if (!ctx || !bus || this.destroyed || this.voices.size > 48) return;
    try {
      const oscillator = ctx.createOscillator();
      const envelope = ctx.createGain();
      const start = Math.max(ctx.currentTime, when);
      const duration = Math.max(0.025, length);
      oscillator.type = wave;
      oscillator.frequency.setValueAtTime(frequency(midi), start);
      if (slide !== undefined) {
        oscillator.frequency.exponentialRampToValueAtTime(frequency(slide), start + duration);
      }
      envelope.gain.setValueAtTime(0.0001, start);
      envelope.gain.exponentialRampToValueAtTime(clamp(volume, 0.0002, 0.8), start + 0.008);
      envelope.gain.exponentialRampToValueAtTime(0.0001, start + duration);
      oscillator.connect(envelope);
      envelope.connect(bus);
      this.voices.add(oscillator);
      oscillator.onended = () => {
        this.voices.delete(oscillator);
        try { oscillator.disconnect(); envelope.disconnect(); } catch { /* already closed */ }
      };
      oscillator.start(start);
      oscillator.stop(start + duration + 0.02);
    } catch { /* An interrupted or closed AudioContext is harmless. */ }
  }

  _startMusic() {
    if (this.timer || !this.context || !this.enabled) return;
    this.nextBeat = this.context.currentTime + 0.08;
    const schedule = () => {
      if (!this.context || !this.enabled || this.context.state !== 'running') return;
      // A quiet pentatonic score, with space between the phrases.
      const chords = [[48, 55, 60, 64], [45, 52, 57, 60], [41, 48, 53, 57], [43, 50, 55, 62]];
      const melody = [76, null, 79, 81, null, 79, 76, null, 74, null, 72, 74, 76, null, null, null,
        72, null, 76, 79, null, 76, 74, null, 72, null, 69, 72, 74, null, null, null];
      const stepDuration = 0.31;
      if (this.nextBeat < this.context.currentTime - 0.5) {
        this.nextBeat = this.context.currentTime + 0.05;
      }
      while (this.nextBeat < this.context.currentTime + 0.7) {
        const chord = chords[Math.floor(this.beat / 16) % chords.length];
        const step = this.beat % 16;
        const note = melody[this.beat % melody.length];
        if (step % 2 === 0) {
          this._tone(chord[(step / 2) % chord.length] + 12,
            this.nextBeat, 0.55, 0.16, 'triangle', this.musicBus);
        }
        if (step === 0 || step === 8) {
          this._tone(chord[0] - 12, this.nextBeat, 1.45, 0.17, 'sine', this.musicBus);
        }
        if (note !== null) {
          this._tone(note, this.nextBeat, step % 4 === 0 ? 0.7 : 0.28,
            0.075, 'triangle', this.musicBus);
        }
        this.beat += 1;
        this.nextBeat += stepDuration;
      }
    };
    schedule();
    this.timer = setInterval(schedule, 200);
  }

  _stopMusic() {
    if (this.timer !== null) clearInterval(this.timer);
    this.timer = null;
  }

  play(type = 'menu') {
    if (!this.enabled || !this.context || this.context.state !== 'running' || this.destroyed) return;
    const now = this.context.currentTime;
    const aliases = {
      sword: 'attack', arrow: 'shoot', collect: 'pickup', coin: 'rupee',
      shrineComplete: 'complete', damage: 'hurt', land: 'step',
      bomb: 'explode', magic: 'rune', win: 'victory', levelup: 'complete',
    };
    const sound = aliases[type] || type;
    if (now - (this.lastEffects.get(sound) ?? -1) < 0.045) return;
    this.lastEffects.set(sound, now);
    const note = (midi, offset, duration, volume = 0.3, wave = 'triangle', slide) =>
      this._tone(midi, now + offset, duration, volume, wave, this.effectsBus, slide);
    const phrase = (notes, spacing = 0.095, duration = 0.2, volume = 0.3, wave = 'triangle') =>
      notes.forEach((midi, index) => note(midi, index * spacing, duration, volume, wave));
    switch (sound) {
      case 'jump': note(57, 0, 0.13, 0.22, 'square', 76); break;
      case 'attack': note(70, 0, 0.075, 0.19, 'sawtooth', 39); break;
      case 'shoot': note(85, 0, 0.08, 0.22, 'triangle', 52); break;
      case 'hit': note(47, 0, 0.1, 0.34, 'square', 28); break;
      case 'hurt': note(43, 0, 0.2, 0.3, 'sawtooth', 29); note(38, 0.05, 0.2, 0.13, 'square'); break;
      case 'pickup': phrase([76, 83], 0.065, 0.18, 0.25); break;
      case 'rupee': phrase([88, 95], 0.06, 0.19, 0.2, 'sine'); break;
      case 'rune': phrase([60, 67, 72, 79, 84], 0.045, 0.28, 0.18); break;
      case 'shrine': phrase([64, 71, 76, 83], 0.14, 0.6, 0.22, 'sine'); break;
      case 'complete': phrase([72, 76, 79, 84, 88], 0.13, 0.65, 0.25); note(48, 0, 1.3, 0.2, 'sine'); break;
      case 'death': phrase([64, 60, 55, 48], 0.18, 0.45, 0.23); break;
      case 'victory': phrase([60, 64, 67, 72, 76, 79, 84], 0.12, 0.8, 0.25); phrase([48, 55, 60], 0.24, 1.6, 0.14, 'sine'); break;
      case 'travel': phrase([67, 72, 79, 84], 0.06, 0.4, 0.17, 'sine'); break;
      case 'menu': note(79, 0, 0.07, 0.12, 'sine'); break;
      case 'cook': phrase([64, 67, 72, 67, 79], 0.09, 0.18, 0.18); break;
      case 'eat': phrase([60, 64, 72], 0.07, 0.2, 0.17, 'sine'); break;
      case 'glider': note(60, 0, 0.35, 0.1, 'sine', 79); break;
      case 'explode': note(33, 0, 0.5, 0.38, 'sawtooth', 17); note(43, 0, 0.15, 0.2, 'square', 20); break;
      case 'step': note(33, 0, 0.035, 0.07, 'triangle'); break;
      case 'error': phrase([48, 46], 0.09, 0.11, 0.12, 'square'); break;
      default: note(76, 0, 0.09, 0.12, 'sine');
    }
  }

  destroy() {
    if (this.destroyed) return;
    this.destroyed = true;
    this.enabled = false;
    this._stopMusic();
    if (typeof document !== 'undefined') document.removeEventListener('visibilitychange', this._visibility);
    for (const voice of this.voices) {
      try { voice.stop(); } catch { /* voice may have ended already */ }
    }
    this.voices.clear();
    if (this.context) {
      try { void this.context.close().catch(() => {}); } catch { /* context may be closed */ }
    }
    this.context = null;
  }
}
