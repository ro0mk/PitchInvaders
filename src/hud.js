import * as THREE from 'three';
import { HALF_L, HALF_W, BOUNDS_X, BOUNDS_Z, ENEMY_TYPES } from './config.js';
import { formatTime } from './storage.js';

const $ = (id) => document.getElementById(id);

export class HUD {
  constructor() {
    this.el = {
      hud: $('hud'), time: $('h-time'), xp: $('h-xp'), bestTime: $('h-best-time'), bestXP: $('h-best-xp'),
      alert: $('h-alert'), combo: $('h-combo'), mult: $('h-mult'), comboN: $('h-combo-n'), comboBar: $('h-combo-bar'),
      stamina: $('h-stamina'), tired: $('h-tired'), popups: $('popups'), banner: $('banner'),
      struggle: $('struggle'), stFill: $('st-fill'), stTime: $('st-time'),
      selfie: $('selfie-prompt'), selfieName: $('selfie-name'), flash: $('flash'), clickHint: $('click-hint'),
    };
    this.minimap = $('minimap');
    this.mm = this.minimap.getContext('2d');
    this.overlay = $('overlay');
    this.ov = this.overlay.getContext('2d');
    this.cache = {};
    this.popupQueue = [];
    this.popupCooldown = 0;
    this.v = new THREE.Vector3();
    this.resize();
  }

  resize() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    this.overlay.width = Math.round(window.innerWidth * dpr);
    this.overlay.height = Math.round(window.innerHeight * dpr);
    this.dpr = dpr;
    this.overlayDirty = false;
  }

  show(on) { this.el.hud.classList.toggle('hidden', !on); if (!on) this.clearOverlay(); }

  _set(key, el, value, prop = 'textContent') {
    if (this.cache[key] === value) return;
    this.cache[key] = value;
    el[prop] = value;
  }

  update(g) {
    const s = g.scoring;
    const p = g.player;
    this._set('time', this.el.time, formatTime(g.runTime));
    this._set('xp', this.el.xp, s.xp.toLocaleString('pt-PT'));
    this._set('bt', this.el.bestTime, formatTime(Math.max(g.save.bestTime, g.runTime)));
    this._set('bx', this.el.bestXP, Math.max(g.save.bestXP, s.xp).toLocaleString('pt-PT'));
    const lvl = g.enemies.alert;
    this._set('alert', this.el.alert, '★'.repeat(lvl) + `<span class="off">${'★'.repeat(5 - lvl)}</span>`, 'innerHTML');
    const comboOn = s.combo >= 1;
    this.el.combo.classList.toggle('on', comboOn);
    this._set('mult', this.el.mult, `×${s.multiplier}`);
    this._set('comboN', this.el.comboN, s.combo >= 2 ? `combo ${s.combo}` : '');
    this.el.comboBar.style.width = `${Math.max(0, s.comboTimer / s.comboTime) * 100}%`;
    const st = Math.round(p.stamina);
    if (this.cache.st !== st) {
      this.cache.st = st;
      this.el.stamina.style.width = `${st}%`;
      this.el.stamina.classList.toggle('low', p.exhausted || st < 25);
    }
    this._set('tired', this.el.tired, p.exhausted ? 'ESGOTADO' : '');

    // Luta
    if (p.grabbed) {
      this.el.struggle.classList.remove('hidden');
      this.el.stFill.style.width = `${Math.min(1, p.grabbed.progress) * 100}%`;
      this.el.stTime.style.width = `${Math.max(0, 1 - p.grabbed.t / p.grabbed.limit) * 100}%`;
    } else this.el.struggle.classList.add('hidden');

    this.popupCooldown -= g.realDt;
    if (this.popupQueue.length && this.popupCooldown <= 0) {
      this._spawnPopup(this.popupQueue.shift());
      this.popupCooldown = 0.22;
    }
  }

  selfiePrompt(target) {
    if (target) {
      this._set('sn', this.el.selfieName, target.starName);
      this.el.selfie.classList.remove('hidden');
    } else this.el.selfie.classList.add('hidden');
  }

  clickHint(on) { this.el.clickHint.classList.toggle('hidden', !on); }

  noStamina() {
    const bar = this.el.stamina.parentElement;
    bar.classList.add('flash');
    clearTimeout(this._nsT);
    this._nsT = setTimeout(() => bar.classList.remove('flash'), 300);
  }

  popup(title, sub = '', color = '#ffd21f', size = '') {
    if (this.popupQueue.length > 4) this.popupQueue.shift();
    this.popupQueue.push({ title, sub, color, size });
  }

  _spawnPopup({ title, sub, color, size }) {
    const d = document.createElement('div');
    d.className = `popup ${size}`;
    while (this.el.popups.children.length >= 4) this.el.popups.firstChild.remove();
    const t = document.createElement('div');
    t.className = 't';
    t.style.color = color;
    t.textContent = title;
    d.appendChild(t);
    if (sub) {
      const s = document.createElement('div');
      s.className = 's';
      s.textContent = sub;
      d.appendChild(s);
    }
    d.addEventListener('animationend', () => d.remove());
    this.el.popups.appendChild(d);
  }

  clearPopups() {
    this.popupQueue = [];
    this.el.popups.innerHTML = '';
  }

  banner(text, sub = '', color = '#ffd21f') {
    const b = this.el.banner;
    b.classList.remove('show');
    void b.offsetWidth;
    b.style.color = color;
    b.innerHTML = '';
    b.appendChild(document.createTextNode(text));
    if (sub) {
      const s = document.createElement('small');
      s.textContent = sub;
      b.appendChild(s);
    }
    b.classList.add('show');
  }

  flash() {
    const f = this.el.flash;
    f.classList.remove('go');
    void f.offsetWidth;
    f.classList.add('go');
  }

  drawMinimap(g) {
    const c = this.minimap, m = this.mm;
    const W = c.width, H = c.height;
    const pad = 8;
    const sx = (W - pad * 2) / (BOUNDS_X * 2), sz = (H - pad * 2) / (BOUNDS_Z * 2);
    const X = (x) => pad + (x + BOUNDS_X) * sx;
    const Z = (z) => pad + (z + BOUNDS_Z) * sz;
    m.clearRect(0, 0, W, H);
    m.fillStyle = 'rgba(40,110,45,0.75)';
    m.fillRect(X(-BOUNDS_X), Z(-BOUNDS_Z), BOUNDS_X * 2 * sx, BOUNDS_Z * 2 * sz);
    m.strokeStyle = 'rgba(255,255,255,0.6)';
    m.lineWidth = 1;
    m.strokeRect(X(-HALF_L), Z(-HALF_W), HALF_L * 2 * sx, HALF_W * 2 * sz);
    m.beginPath(); m.moveTo(X(0), Z(-HALF_W)); m.lineTo(X(0), Z(HALF_W)); m.stroke();
    m.beginPath(); m.arc(X(0), Z(0), 9.15 * sx, 0, Math.PI * 2); m.stroke();
    m.strokeRect(X(-HALF_L), Z(-20.16), 16.5 * sx, 40.32 * sz);
    m.strokeRect(X(HALF_L - 16.5), Z(-20.16), 16.5 * sx, 40.32 * sz);
    // túnel
    m.fillStyle = '#000';
    m.fillRect(X(-2.5), Z(BOUNDS_Z) - 3, 5 * sx, 4);

    // jogadores
    for (const p of g.match.players) {
      m.fillStyle = p.star && !p.selfied ? '#ffd21f' : p.team === 0 ? 'rgba(212,32,44,0.8)' : p.team === 1 ? 'rgba(79,179,232,0.8)' : 'rgba(0,0,0,0.8)';
      const r = p.star && !p.selfied ? 2.6 : 1.8;
      m.beginPath(); m.arc(X(p.pos.x), Z(p.pos.z), r, 0, Math.PI * 2); m.fill();
    }
    // bola
    const b = g.match.ball.pos;
    m.fillStyle = '#fff';
    m.beginPath(); m.arc(X(b.x), Z(b.z), 1.6, 0, Math.PI * 2); m.fill();

    // perseguidores
    const t = performance.now() / 1000;
    for (const e of g.enemies.list) {
      const col = ENEMY_TYPES[e.type].color;
      if (e.state === 'idle') { m.fillStyle = 'rgba(255,210,31,0.45)'; m.fillRect(X(e.pos.x) - 1.5, Z(e.pos.z) - 1.5, 3, 3); continue; }
      const flashing = e.state === 'windup' || e.state === 'lunge';
      m.fillStyle = flashing && Math.sin(t * 30) > 0 ? '#fff' : col;
      const r = e.state === 'down' ? 2 : 3.2;
      m.beginPath(); m.arc(X(e.pos.x), Z(e.pos.z), r, 0, Math.PI * 2); m.fill();
      m.strokeStyle = '#000'; m.lineWidth = 1; m.stroke();
    }
    // invasor
    const P = g.player.pos;
    m.save();
    m.translate(X(P.x), Z(P.z));
    m.rotate(-g.player.yaw + Math.PI / 2);
    m.fillStyle = '#fff';
    m.strokeStyle = '#000';
    m.lineWidth = 1.5;
    m.beginPath(); m.moveTo(6, 0); m.lineTo(-4, 4); m.lineTo(-2, 0); m.lineTo(-4, -4); m.closePath();
    m.fill(); m.stroke();
    m.restore();
    // cone da câmara
    m.strokeStyle = 'rgba(255,255,255,0.35)';
    m.beginPath();
    const cy = g.cam.yaw;
    m.moveTo(X(P.x), Z(P.z));
    m.lineTo(X(P.x + Math.sin(cy + 0.5) * 14), Z(P.z + Math.cos(cy + 0.5) * 14));
    m.moveTo(X(P.x), Z(P.z));
    m.lineTo(X(P.x + Math.sin(cy - 0.5) * 14), Z(P.z + Math.cos(cy - 0.5) * 14));
    m.stroke();
  }

  clearOverlay() {
    if (!this.overlayDirty) return;
    this.ov.clearRect(0, 0, this.overlay.width, this.overlay.height);
    this.overlayDirty = false;
  }

  // Setas na borda do ecrã para perseguidores próximos fora de vista.
  drawIndicators(g, camera) {
    const ctx = this.ov;
    const W = this.overlay.width, H = this.overlay.height;
    this.clearOverlay();
    const P = g.player.pos;
    const t = performance.now() / 1000;
    for (const e of g.enemies.list) {
      if (!e.active || e.state === 'down') continue;
      const d = Math.hypot(e.pos.x - P.x, e.pos.z - P.z);
      if (d > 16) continue;
      this.v.set(e.pos.x, 1.0, e.pos.z);
      const camSpace = this.v.clone().applyMatrix4(camera.matrixWorldInverse);
      const ndc = this.v.project(camera);
      const onScreen = camSpace.z < 0 && Math.abs(ndc.x) < 0.92 && Math.abs(ndc.y) < 0.9;
      if (onScreen) continue;
      let dx = camSpace.x, dy = camSpace.y;
      if (camSpace.z > 0) { dy = Math.min(dy, -Math.abs(camSpace.z) * 0.3); }
      const l = Math.hypot(dx, dy) || 1;
      dx /= l; dy /= l;
      const rx = W * 0.44, ry = H * 0.4;
      const k = 1 / Math.max(Math.abs(dx) / rx, Math.abs(dy) / ry);
      const x = W / 2 + dx * k, y = H / 2 - dy * k;
      const danger = e.state === 'windup' || e.state === 'lunge';
      const alpha = Math.max(0.25, 1 - d / 16);
      this.overlayDirty = true;
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(Math.atan2(-dy, dx));
      const s = (danger ? 1.4 + Math.sin(t * 30) * 0.2 : 1) * this.dpr;
      ctx.scale(s, s);
      ctx.globalAlpha = alpha;
      ctx.fillStyle = danger ? '#ff2d3d' : ENEMY_TYPES[e.type].color;
      ctx.strokeStyle = '#000';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(16, 0); ctx.lineTo(-8, 11); ctx.lineTo(-3, 0); ctx.lineTo(-8, -11); ctx.closePath();
      ctx.fill(); ctx.stroke();
      ctx.restore();
    }
    ctx.globalAlpha = 1;
  }
}
