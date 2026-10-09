// XP, combos e estatísticas de uma invasão.

const COMBO_TIME = 4.5;
const VARIETY = [1, 0.7, 0.5, 0.35];

export class Scoring {
  constructor(hud, audio) {
    this.hud = hud;
    this.audio = audio;
    this.comboTime = COMBO_TIME;
    this.reset();
  }

  reset() {
    this.xp = 0;
    this.combo = 0;
    this.comboTimer = 0;
    this.bestCombo = 0;
    this.lastTrick = null;
    this.repeat = 0;
    this.survivalAcc = 0;
    this.stats = {
      dodges: 0, perfects: 0, nearMisses: 0, goals: 0, selfies: 0, escapes: 0, crashes: 0,
      tricks: { juke: 0, spin: 0, jump: 0, slide: 0, cueca: 0, chapeu: 0 },
    };
  }

  get multiplier() {
    return Math.min(8, 1 + Math.floor(this.combo / 2));
  }

  // base: XP antes de multiplicadores. opts: { combo, trick, color, size, noMult, sub }
  award(base, title, opts = {}) {
    const mult = opts.noMult ? 1 : this.multiplier;
    let variety = 1;
    if (opts.trick) {
      if (opts.trick === this.lastTrick) this.repeat++;
      else this.repeat = 0;
      this.lastTrick = opts.trick;
      variety = VARIETY[Math.min(this.repeat, VARIETY.length - 1)];
    }
    const gained = Math.max(1, Math.round(base * mult * variety));
    this.xp += gained;
    if (opts.combo !== false) {
      this.combo++;
      this.comboTimer = COMBO_TIME;
      this.bestCombo = Math.max(this.bestCombo, this.combo);
    } else if (this.combo > 0) {
      this.comboTimer = Math.max(this.comboTimer, COMBO_TIME * 0.6);
    }
    let sub = `+${gained} XP`;
    if (mult > 1) sub += `  ×${mult}`;
    if (variety < 1) sub += '  (repetido)';
    if (opts.sub) sub = `${opts.sub} · ${sub}`;
    this.hud.popup(title, sub, opts.color || '#ffd21f', opts.size || '');
    this.audio.ding(Math.min(this.combo, 12));
    return gained;
  }

  breakCombo() {
    this.combo = 0;
    this.comboTimer = 0;
  }

  update(dt, alertLevel) {
    if (this.combo > 0) {
      this.comboTimer -= dt;
      if (this.comboTimer <= 0) this.breakCombo();
    }
    // XP por sobreviver: mais alerta => mais XP por segundo.
    this.survivalAcc += dt * (2 + alertLevel * 1.5);
    if (this.survivalAcc >= 1) {
      const n = Math.floor(this.survivalAcc);
      this.survivalAcc -= n;
      this.xp += n;
    }
  }
}
