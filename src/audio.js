// Som 100% sintetizado com WebAudio (sem ficheiros externos).

export class GameAudio {
  constructor() {
    this.ctx = null;
    this.volume = 0.8;
    this.excite = 0.3;
  }

  init() {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') this.ctx.resume();
      return;
    }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    const ctx = (this.ctx = new AC());
    this.master = ctx.createGain();
    this.master.gain.value = this.volume;
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -14;
    comp.ratio.value = 4;
    this.master.connect(comp).connect(ctx.destination);

    // Ruído rosa (aproximação de Paul Kellet), 3 s em loop.
    const len = ctx.sampleRate * 3;
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = buf.getChannelData(0);
    let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0;
    for (let i = 0; i < len; i++) {
      const w = Math.random() * 2 - 1;
      b0 = 0.99886 * b0 + w * 0.0555179;
      b1 = 0.99332 * b1 + w * 0.0750759;
      b2 = 0.969 * b2 + w * 0.153852;
      b3 = 0.8665 * b3 + w * 0.3104856;
      b4 = 0.55 * b4 + w * 0.5329522;
      b5 = -0.7616 * b5 - w * 0.016898;
      d[i] = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + w * 0.5362) * 0.11;
      b6 = w * 0.115926;
    }
    this.noise = buf;

    // Ambiente da multidão: duas camadas de ruído filtrado com modulação lenta.
    this.crowdGain = ctx.createGain();
    this.crowdGain.gain.value = 0.0;
    this.crowdGain.connect(this.master);
    const layer = (freq, q, gain, rate) => {
      const src = ctx.createBufferSource();
      src.buffer = buf;
      src.loop = true;
      src.playbackRate.value = rate;
      const f = ctx.createBiquadFilter();
      f.type = 'bandpass';
      f.frequency.value = freq;
      f.Q.value = q;
      const g = ctx.createGain();
      g.gain.value = gain;
      const lfo = ctx.createOscillator();
      lfo.frequency.value = 0.15 + Math.random() * 0.2;
      const lfoGain = ctx.createGain();
      lfoGain.gain.value = gain * 0.35;
      lfo.connect(lfoGain).connect(g.gain);
      src.connect(f).connect(g).connect(this.crowdGain);
      src.start(0, Math.random() * 2);
      lfo.start();
    };
    layer(450, 0.6, 0.9, 1.0);
    layer(1100, 0.9, 0.55, 0.93);
    layer(180, 0.7, 0.6, 0.8);
    this.crowdGain.gain.setTargetAtTime(0.35, ctx.currentTime, 1.5);
  }

  setVolume(v) {
    this.volume = v;
    if (this.master) this.master.gain.setTargetAtTime(v, this.ctx.currentTime, 0.05);
  }

  setExcitement(e) {
    if (!this.ctx) return;
    const target = 0.22 + Math.min(1, e) * 0.5;
    if (Math.abs(target - this.excite) > 0.02) {
      this.excite = target;
      this.crowdGain.gain.setTargetAtTime(target, this.ctx.currentTime, 0.6);
    }
  }

  _noiseBurst({ freq = 900, q = 0.5, gain = 0.5, attack = 0.08, decay = 1.0, type = 'bandpass', rate = 1, sweep = 0 }) {
    const ctx = this.ctx;
    if (!ctx) return;
    const t = ctx.currentTime;
    const src = ctx.createBufferSource();
    src.buffer = this.noise;
    src.playbackRate.value = rate;
    const f = ctx.createBiquadFilter();
    f.type = type;
    f.frequency.setValueAtTime(freq, t);
    if (sweep) f.frequency.exponentialRampToValueAtTime(Math.max(40, freq + sweep), t + attack + decay);
    f.Q.value = q;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(gain, t + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t + attack + decay);
    src.connect(f).connect(g).connect(this.master);
    src.start(t, Math.random() * 2);
    src.stop(t + attack + decay + 0.05);
  }

  _tone({ freq = 440, type = 'sine', gain = 0.2, attack = 0.005, decay = 0.2, slide = 0, delay = 0 }) {
    const ctx = this.ctx;
    if (!ctx) return;
    const t = ctx.currentTime + delay;
    const o = ctx.createOscillator();
    o.type = type;
    o.frequency.setValueAtTime(freq, t);
    if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(30, freq + slide), t + attack + decay);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(gain, t + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t + attack + decay);
    o.connect(g).connect(this.master);
    o.start(t);
    o.stop(t + attack + decay + 0.05);
  }

  cheer(intensity = 0.5) {
    const i = Math.min(1.2, intensity);
    this._noiseBurst({ freq: 1000, q: 0.5, gain: 0.25 + i * 0.5, attack: 0.12, decay: 0.8 + i * 1.4 });
    this._noiseBurst({ freq: 420, q: 0.7, gain: 0.2 + i * 0.4, attack: 0.15, decay: 1.0 + i * 1.2, rate: 0.9 });
  }

  ooh() {
    this._noiseBurst({ freq: 380, q: 2.5, gain: 0.35, attack: 0.15, decay: 0.9, sweep: 260 });
  }

  boo() {
    this._noiseBurst({ freq: 260, q: 2.0, gain: 0.45, attack: 0.3, decay: 1.8, sweep: -80 });
    this._noiseBurst({ freq: 700, q: 0.8, gain: 0.3, attack: 0.2, decay: 1.5 });
  }

  goal() {
    this.cheer(1.2);
    this._noiseBurst({ freq: 1500, q: 0.4, gain: 0.6, attack: 0.1, decay: 3.5 });
    this._noiseBurst({ freq: 300, q: 0.6, gain: 0.6, attack: 0.2, decay: 3.5 });
  }

  whistle(pattern = 'long') {
    const ctx = this.ctx;
    if (!ctx) return;
    const blasts = pattern === 'long' ? [[0, 0.9]]
      : pattern === 'end' ? [[0, 0.25], [0.35, 0.25], [0.7, 1.0]]
        : [[0, 0.2]];
    for (const [delay, dur] of blasts) {
      const t = ctx.currentTime + delay;
      const o = ctx.createOscillator();
      o.type = 'sine';
      o.frequency.value = 2850;
      const lfo = ctx.createOscillator();
      lfo.frequency.value = 32;
      const lg = ctx.createGain();
      lg.gain.value = 140;
      lfo.connect(lg).connect(o.frequency);
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(0.16, t + 0.02);
      g.gain.setValueAtTime(0.16, t + dur - 0.05);
      g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      o.connect(g).connect(this.master);
      o.start(t); lfo.start(t);
      o.stop(t + dur + 0.05); lfo.stop(t + dur + 0.05);
    }
  }

  ding(step = 0) {
    const f = 660 * Math.pow(2, Math.min(step, 12) / 12);
    this._tone({ freq: f, type: 'triangle', gain: 0.14, decay: 0.18 });
    this._tone({ freq: f * 1.5, type: 'sine', gain: 0.07, decay: 0.25, delay: 0.06 });
  }

  whoosh() {
    this._noiseBurst({ freq: 1800, q: 1.2, gain: 0.18, attack: 0.03, decay: 0.22, sweep: -1200 });
  }

  thud() {
    this._tone({ freq: 120, type: 'sine', gain: 0.4, decay: 0.25, slide: -70 });
    this._noiseBurst({ freq: 300, q: 0.8, gain: 0.25, attack: 0.005, decay: 0.15, type: 'lowpass' });
  }

  kick() {
    this._tone({ freq: 180, type: 'sine', gain: 0.35, decay: 0.12, slide: -90 });
    this._noiseBurst({ freq: 2000, q: 1, gain: 0.12, attack: 0.002, decay: 0.05 });
  }

  bark() {
    for (let k = 0; k < 2; k++) {
      this._tone({ freq: 520, type: 'sawtooth', gain: 0.12, attack: 0.01, decay: 0.12, slide: -260, delay: k * 0.18 });
      this._tone({ freq: 340, type: 'square', gain: 0.06, attack: 0.01, decay: 0.1, slide: -150, delay: k * 0.18 });
    }
  }

  shutter() {
    this._noiseBurst({ freq: 3000, q: 1, gain: 0.3, attack: 0.002, decay: 0.05 });
    this._noiseBurst({ freq: 2200, q: 1, gain: 0.25, attack: 0.002, decay: 0.06, type: 'highpass' });
  }

  grab() {
    this._tone({ freq: 90, type: 'square', gain: 0.18, decay: 0.2, slide: -30 });
    this.ooh();
  }

  escape() {
    this._tone({ freq: 400, type: 'triangle', gain: 0.15, decay: 0.12, slide: 500 });
    this._tone({ freq: 800, type: 'triangle', gain: 0.12, decay: 0.2, slide: 600, delay: 0.08 });
  }

  record() {
    [0, 4, 7, 12].forEach((s, i) => this._tone({ freq: 523 * Math.pow(2, s / 12), type: 'triangle', gain: 0.15, decay: 0.35, delay: i * 0.12 }));
  }
}
