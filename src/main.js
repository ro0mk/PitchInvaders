import * as THREE from 'three';
import { buildStadium } from './stadium.js';
import { Match } from './match.js';
import { Invader } from './player.js';
import { Enemies } from './enemies.js';
import { Input } from './input.js';
import { GameAudio } from './audio.js';
import { HUD } from './hud.js';
import { Scoring } from './scoring.js';
import { CameraRig } from './camera.js';
import { loadSave, writeSave, levelInfo, formatTime } from './storage.js';
import { TRICKS, BOUNDS_Z } from './config.js';

const $ = (id) => document.getElementById(id);

const PERFECT_TITLES = {
  juke: 'FINTA PERFEITA!',
  spin: 'ROLETA PERFEITA!',
  jump: 'SALTO PERFEITO!',
  slide: 'DESLIZE PERFEITO!',
};

class Game {
  constructor() {
    this.save = loadSave();
    const quality = this.save.settings.quality;
    const hi = quality === 'high';
    const canvas = $('game');
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: hi, powerPreference: 'high-performance' });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, hi ? 1.75 : 1));
    this.renderer.setSize(window.innerWidth, window.innerHeight, false);
    this.renderer.shadowMap.enabled = hi;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.05;

    this.scene = new THREE.Scene();
    this.scene.fog = new THREE.Fog(0x0b1222, 160, 520);
    this.camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 1500);

    this.stadium = buildStadium(this.scene, this.renderer, quality);
    this.match = new Match(this.scene);
    this.player = new Invader(this.scene);
    this.player.model.root.visible = false;
    this.enemies = new Enemies(this.scene);
    this.enemies.reset();
    this.input = new Input(canvas);
    this.audio = new GameAudio();
    this.audio.volume = this.save.settings.volume;
    this.hud = new HUD();
    this.scoring = new Scoring(this.hud, this.audio);
    this.cam = new CameraRig(this.camera);

    this.state = 'menu';
    this.time = 0;
    this.runTime = 0;
    this.timeScale = 1;
    this.slowT = 0;
    this.excite = 0.3;
    this.realDt = 0.016;
    this.lastDodgeTime = -10;
    this.jumboT = 0;
    this.jumboOverride = null;
    this.expectUnlock = false;
    this.selfieTarget = null;

    this.input.onLockChange = (locked) => {
      if (!locked && this.state === 'playing' && !this.expectUnlock) this.pause();
      this.expectUnlock = false;
    };
    canvas.addEventListener('click', () => {
      if (this.state === 'playing') this.input.requestLock();
    });
    document.addEventListener('visibilitychange', () => {
      if (document.hidden && this.state === 'playing') this.pause();
    });
    window.addEventListener('resize', () => this.resize());

    this.bindUI();
    this.refreshMenu();
    this.resize();
    this.last = performance.now();
    requestAnimationFrame((t) => this.loop(t));
  }

  resize() {
    const w = window.innerWidth, h = window.innerHeight;
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.hud.resize();
  }

  // ---------------- UI ----------------
  showScreen(id) {
    for (const s of ['menu', 'controls', 'settings', 'pause', 'gameover']) $(s).classList.toggle('hidden', s !== id);
    this.screen = id;
    const first = id && $(id).querySelector('.btn.primary, .btn');
    if (first) first.focus({ preventScroll: true });
  }

  bindUI() {
    $('btn-play').onclick = () => this.startRun();
    $('btn-again').onclick = () => this.startRun();
    $('btn-menu').onclick = () => this.toMenu();
    $('btn-controls').onclick = () => { this.backTo = 'menu'; this.showScreen('controls'); };
    $('btn-settings').onclick = () => { this.backTo = 'menu'; this.showScreen('settings'); };
    $('btn-resume').onclick = () => this.resume();
    $('btn-pause-controls').onclick = () => { this.backTo = 'pause'; this.showScreen('controls'); };
    $('btn-quit').onclick = () => { this.state = 'playing'; this.endRun(null, true); };
    document.querySelectorAll('.btn.back').forEach((b) => { b.onclick = () => this.showScreen(this.backTo || 'menu'); });

    const st = this.save.settings;
    const vol = $('s-volume'), sens = $('s-sens'), q = $('s-quality'), ac = $('s-autocam'), iy = $('s-inverty');
    vol.value = st.volume; sens.value = st.sensitivity; q.value = st.quality; ac.checked = st.autoCam; iy.checked = st.invertY;
    vol.oninput = () => { st.volume = +vol.value; this.audio.setVolume(st.volume); writeSave(this.save); };
    sens.oninput = () => { st.sensitivity = +sens.value; writeSave(this.save); };
    q.onchange = () => { st.quality = q.value; writeSave(this.save); location.reload(); };
    ac.onchange = () => { st.autoCam = ac.checked; writeSave(this.save); };
    iy.onchange = () => { st.invertY = iy.checked; writeSave(this.save); };
    $('s-fullscreen').onclick = () => {
      if (document.fullscreenElement) document.exitFullscreen();
      else if (document.documentElement.requestFullscreen) document.documentElement.requestFullscreen().catch(() => {});
    };
    $('s-reset').onclick = () => {
      if (!window.confirm('Apagar todos os recordes e o progresso de carreira?')) return;
      Object.assign(this.save, { bestTime: 0, bestXP: 0, careerXP: 0, runs: 0, bestCombo: 0 });
      writeSave(this.save);
      this.refreshMenu();
    };
  }

  refreshMenu() {
    const s = this.save;
    const lv = levelInfo(s.careerXP);
    $('m-level').textContent = lv.level;
    $('m-title').textContent = lv.title;
    $('m-xpbar').style.width = `${lv.progress * 100}%`;
    $('m-xptext').textContent = `${lv.into.toLocaleString('pt-PT')} / ${lv.need.toLocaleString('pt-PT')} XP para o nível ${lv.level + 1} · total ${s.careerXP.toLocaleString('pt-PT')} XP`;
    $('m-best-time').textContent = s.bestTime ? formatTime(s.bestTime) : '--';
    $('m-best-xp').textContent = s.bestXP.toLocaleString('pt-PT');
    $('m-best-combo').textContent = s.bestCombo;
    $('m-runs').textContent = s.runs;
  }

  // ---------------- Fluxo de jogo ----------------
  startRun() {
    this.audio.init();
    this.audio.setVolume(this.save.settings.volume);
    this.showScreen(null);
    this.hud.show(true);
    this.hud.clearPopups();
    this.scoring.reset();
    this.enemies.reset();
    if (this.match.mode === 'stopped') this.match.reset();
    // Entra entre dois postos de segurança.
    const x = [-18, 0, 18][(Math.random() * 3) | 0] + (Math.random() - 0.5) * 4;
    this.player.reset(x, -BOUNDS_Z - 1.4, 0);
    this.player.frozen = true;
    this.player.model.root.visible = true;
    this.runTime = 0;
    this.introT = 0;
    this.excite = 0.4;
    this.timeScale = 1;
    this.slowT = 0;
    this.jumboOverride = null;
    this.cam.yaw = 0;
    this.cam.pitch = 0.32;
    this.cam.snapTo(this.player);
    this.cam.free = true;
    this.cam.startBlend(1.3);
    this.state = 'intro';
    this.input.requestLock();
  }

  beginInvasion() {
    this.state = 'playing';
    this.cam.free = false;
    this.player.frozen = false;
    this.player.pos.z = -BOUNDS_Z + 1.2;
    this.player.y = 0;
    this.player.iframes = 1.5;
    this.match.stop();
    this.enemies.startInvasion(this.player.pos, this);
    this.audio.whistle('long');
    this.audio.cheer(1);
    this.excite = 0.8;
    this.hud.banner('INVASÃO!', 'Foge da segurança o máximo de tempo possível!');
    this.setJumboOverride({ mode: 'big', text: 'INVASÃO!', color: '#ff2d55', sub: 'Por favor, saia do relvado' }, 2.5);
  }

  releaseLockQuietly() {
    if (!this.input.locked) return;
    this.expectUnlock = true;
    this.input.releaseLock();
  }

  pause() {
    if (this.state !== 'playing') return;
    this.state = 'paused';
    this.pausedAt = performance.now();
    this.input.pressed.clear();
    this.releaseLockQuietly();
    this.hud.clickHint(false);
    this.showScreen('pause');
  }

  resume() {
    if (this.state !== 'paused') return;
    this.showScreen(null);
    this.state = 'playing';
    this.last = performance.now();
    this.input.requestLock();
  }

  toMenu() {
    this.state = 'menu';
    this.hud.show(false);
    this.player.model.root.visible = false;
    this.enemies.reset();
    this.match.reset();
    this.cam.startBlend(1.5);
    this.refreshMenu();
    this.showScreen('menu');
  }

  endRun(by, quit = false) {
    if (this.state !== 'playing') return;
    this.state = 'caught';
    this.caughtT = 0;
    this.player.caught = true;
    this.player.grabbed = null;
    this.player.action = null;
    this.player.spinOffset = 0;
    this.player.selfie = null;
    if (by) by.setState('holding');
    this.enemies.celebrate();
    this.audio.whistle('end');
    this.audio.boo();
    this.cam.shake(0.3);
    this.hud.selfiePrompt(null);
    this.hud.clickHint(false);
    this.hud.clearPopups();
    this.hud.banner(quit ? 'DESISTISTE' : 'APANHADO!', '', '#ff3b4e');
    this.setJumboOverride({ mode: 'big', text: 'APANHADO!', color: '#ff3b4e', sub: `${formatTime(this.runTime)} · ${this.scoring.xp} XP` }, 30);
    this.releaseLockQuietly();
    this.hud.update(this);
    this.hud.clearOverlay();
    if (quit) this.showScreen(null);
  }

  showGameOver() {
    this.state = 'gameover';
    this.hud.show(false);
    const s = this.save;
    const xp = this.scoring.xp;
    const t = this.runTime;
    const newTime = t > s.bestTime;
    const newXP = xp > s.bestXP;
    const before = levelInfo(s.careerXP);
    s.careerXP += xp;
    s.runs += 1;
    s.bestCombo = Math.max(s.bestCombo, this.scoring.bestCombo);
    if (newTime) s.bestTime = t;
    if (newXP) s.bestXP = xp;
    writeSave(s);
    const after = levelInfo(s.careerXP);

    $('go-time').textContent = formatTime(t);
    $('go-xp').textContent = xp.toLocaleString('pt-PT');
    const rec = [];
    if (newTime) rec.push('NOVO RECORDE DE TEMPO!');
    if (newXP) rec.push('NOVO RECORDE DE XP!');
    $('go-record').innerHTML = rec.length ? `<span class="pulse">🏆 ${rec.join(' · ')}</span>` : `Recorde: ${formatTime(s.bestTime)} · ${s.bestXP.toLocaleString('pt-PT')} XP`;
    if (rec.length) this.audio.record();
    const st = this.scoring.stats;
    const cells = [
      ['ESQUIVAS', st.dodges], ['PERFEITAS', st.perfects], ['MELHOR COMBO', this.scoring.bestCombo], ['FUGAS', st.escapes],
      ['FINTAS', st.tricks.juke], ['ROLETAS', st.tricks.spin], ['SALTOS', st.tricks.jump], ['DESLIZES', st.tricks.slide],
      ['CUECAS', st.tricks.cueca], ['CHAPÉUS', st.tricks.chapeu], ['GOLOS', st.goals], ['SELFIES', st.selfies],
    ];
    $('go-stats').innerHTML = cells.map(([k, v]) => `<div><small>${k}</small><b>${v}</b></div>`).join('');
    $('go-level').textContent = after.level;
    $('go-title').textContent = after.title;
    $('go-levelup').textContent = after.level > before.level ? `▲ SUBISTE PARA O NÍVEL ${after.level}!` : '';
    $('go-xptext').textContent = `+${xp.toLocaleString('pt-PT')} XP de carreira · ${after.into.toLocaleString('pt-PT')} / ${after.need.toLocaleString('pt-PT')} para o nível ${after.level + 1}`;
    const bar = $('go-xpbar');
    bar.style.transition = 'none';
    bar.style.width = `${(after.level > before.level ? 0 : before.progress) * 100}%`;
    void bar.offsetWidth;
    bar.style.transition = '';
    bar.style.width = `${after.progress * 100}%`;
    this.showScreen('gameover');
  }

  slowmo(duration) {
    this.slowT = duration;
    this.timeScale = 0.3;
  }

  setJumboOverride(info, duration) {
    this.jumboOverride = { info, t: duration };
    this.stadium.drawJumbo(info);
  }

  // ---------------- Eventos ----------------
  handlePlayerEvents(events) {
    const S = this.scoring;
    for (const ev of events) {
      switch (ev.type) {
        case 'trick':
          if (ev.trick === 'juke' || ev.trick === 'spin' || ev.trick === 'slide') this.audio.whoosh();
          break;
        case 'noStamina':
          this.hud.noStamina();
          break;
        case 'exhausted':
          this.hud.popup('ESGOTADO!', 'Larga o sprint para recuperar', '#ff3b4e', 'small');
          break;
        case 'escaped': {
          S.stats.escapes++;
          ev.enemy.fall(1.5);
          S.award(200, 'ESCAPOU!', { combo: false, noMult: true, color: '#3ddc84', size: 'big' });
          this.audio.escape();
          this.audio.cheer(1);
          this.excite = Math.min(1, this.excite + 0.35);
          this.cam.shake(0.2);
          break;
        }
        case 'caught':
          this.endRun(ev.by);
          break;
        case 'selfieStart': {
          const t = ev.target;
          t.posing = 0.8;
          t.yaw = this.player.yaw;
          t.vel.set(0, 0, 0);
          break;
        }
        case 'selfieDone': {
          const t = ev.target;
          t.selfied = true;
          if (t.starSprite) t.starSprite.visible = false;
          S.stats.selfies++;
          this.hud.flash();
          this.audio.shutter();
          S.award(250, 'SELFIE!', { sub: `com ${t.starName}`, color: '#ff7ad9', size: 'big' });
          this.audio.cheer(0.7);
          this.excite = Math.min(1, this.excite + 0.2);
          break;
        }
        default: break;
      }
    }
  }

  handleMatchEvents(events) {
    for (const ev of events) {
      if (ev.type === 'kick') this.audio.kick();
      if (ev.type === 'goal') {
        if (this.state === 'playing' && (ev.byPlayer || this.match.ball.lastTouch === 'enemy')) {
          const own = !ev.byPlayer;
          this.scoring.stats.goals++;
          this.scoring.award(own ? 300 : 500, own ? 'AUTOGOLO DA SEGURANÇA!' : 'GOLO!!!', { color: '#ffd21f', size: 'big', combo: true });
          this.hud.banner('GOLO!', own ? 'A segurança marcou na própria baliza!' : 'O invasor marcou!');
          this.setJumboOverride({ mode: 'big', text: 'GOLO!', color: '#ffd21f', sub: own ? 'Autogolo da segurança' : 'Golo do invasor!' }, 3);
          this.audio.goal();
          this.excite = 1;
        } else if (this.state === 'menu') {
          this.audio.cheer(0.9);
          this.setJumboOverride({ mode: 'big', text: 'GOLO!', color: '#ffd21f' }, 3);
        }
      }
    }
  }

  handleEnemyEvents(events) {
    const S = this.scoring;
    const P = this.player.pos;
    for (const ev of events) {
      switch (ev.type) {
        case 'grab': {
          const p = this.player;
          if (p.grabbed || p.caught || this.state !== 'playing') break;
          const e = ev.enemy;
          p.grabbed = { enemy: e, progress: 0, required: 5 + S.stats.escapes * 2, t: 0, limit: 2.0 };
          p.action = null;
          p.spinOffset = 0;
          p.selfie = null;
          p.y = 0;
          p.vy = 0;
          p.buffer = null;
          e.setState('holding');
          e.yaw = Math.atan2(P.x - e.pos.x, P.z - e.pos.z);
          S.breakCombo();
          this.audio.grab();
          if (e.type === 'dog') this.audio.bark();
          this.cam.shake(0.35);
          break;
        }
        case 'dodge':
          this.handleDodge(ev.enemy, ev.lunge);
          break;
        case 'crash': {
          if (Math.hypot(ev.a.pos.x - P.x, ev.a.pos.z - P.z) > 8) break;
          S.stats.crashes++;
          S.award(150, 'CHOQUE!', { sub: 'Chocaram um contra o outro', color: '#ff9f1a' });
          this.audio.thud();
          this.audio.cheer(0.8);
          this.excite = Math.min(1, this.excite + 0.25);
          break;
        }
        case 'trip': {
          if (Math.hypot(ev.enemy.pos.x - P.x, ev.enemy.pos.z - P.z) > 12) break;
          S.award(100, 'TROPEÇÃO!', { sub: 'Placou um jogador', color: '#ff9f1a' });
          this.audio.thud();
          this.audio.ooh();
          break;
        }
        case 'cueca':
          S.stats.tricks.cueca++;
          S.award(130, 'CUECA!', { trick: 'cueca', sub: 'Entre as pernas', color: '#ff7ad9' });
          this.audio.cheer(0.7);
          this.excite = Math.min(1, this.excite + 0.2);
          break;
        case 'chapeu':
          S.stats.tricks.chapeu++;
          S.award(130, 'CHAPÉU!', { trick: 'chapeu', sub: 'Por cima do polícia', color: '#ff7ad9' });
          this.audio.cheer(0.7);
          this.excite = Math.min(1, this.excite + 0.2);
          break;
        case 'nearMiss':
          S.stats.nearMisses++;
          S.award(15, 'RASANTE', { size: 'small', color: '#9ad1ff' });
          break;
        default: break;
      }
    }
  }

  handleDodge(e, L) {
    if (!L || L.minDist > 2.3 || this.state !== 'playing') return;
    const S = this.scoring;
    const recent = this.player.recentTricks(L.windowStart);
    let trick = null;
    let perfect = false;
    if (L.saved && L.saved !== 'iframes') { trick = L.saved; perfect = true; }
    else if (recent.length) trick = recent[recent.length - 1].type;
    if (!perfect && trick === 'juke' && L.minDist < 1.4) perfect = true;
    const T = trick ? TRICKS[trick] : null;
    let base = T ? T.xp : 30;
    let title = T ? `${T.name}!` : 'ESQUIVA';
    if (perfect) { base *= 2; title = PERFECT_TITLES[trick]; }
    let sub = '';
    if (L.minDist < 0.9) { base *= 1.4; sub = 'Por um triz!'; }
    if (this.time - this.lastDodgeTime < 0.6) { base += 60; sub = 'DUPLA ESQUIVA!'; }
    this.lastDodgeTime = this.time;
    S.stats.dodges++;
    if (perfect) S.stats.perfects++;
    if (trick && S.stats.tricks[trick] !== undefined) S.stats.tricks[trick]++;
    S.award(base, title, { trick: trick || 'plain', sub, color: perfect ? '#3ddc84' : '#ffd21f', size: perfect ? 'big' : '' });
    // Finta curta deixa o segurança no chão.
    if (trick === 'juke' && L.minDist < 1.5 && e.isHuman && e.state !== 'down') {
      e.fall(1.3);
      S.award(40, 'TORNOZELOS PARTIDOS!', { combo: false, size: 'small', color: '#ff9f1a' });
    }
    if (perfect) {
      this.slowmo(0.4);
      this.cam.shake(0.12);
    }
    this.excite = Math.min(1, this.excite + (perfect ? 0.25 : 0.12));
    this.audio.cheer(perfect ? 0.8 : 0.4);
    if (S.combo >= 3 && S.combo % 3 === 0) {
      this.hud.popup('OLÉ!', `${S.combo} seguidas`, '#ffffff', 'small');
      this.audio.cheer(1);
      this.setJumboOverride({ mode: 'big', text: 'OLÉ!', color: '#ffd21f', sub: `Combo ×${S.multiplier}` }, 2);
    }
  }

  // ---------------- Ciclo principal ----------------
  loop(now) {
    requestAnimationFrame((t) => this.loop(t));
    const realDt = Math.min(0.05, Math.max(0, (now - this.last) / 1000));
    this.last = now;
    if (!this.manual) this.frame(realDt, true);
  }

  // Um passo do jogo. Os testes automáticos chamam frame(dt, false) diretamente.
  frame(realDt, render) {
    this.realDt = realDt;
    this.input.pollGamepad();

    if (this.slowT > 0) {
      this.slowT -= realDt;
      if (this.slowT <= 0) this.slowT = 0;
    } else {
      this.timeScale += (1 - this.timeScale) * Math.min(1, realDt * 6);
    }
    const dt = realDt * this.timeScale;
    const input = this.input;

    if (this.state !== 'paused') this.time += dt;

    switch (this.state) {
      case 'menu': {
        this.cam.orbit(realDt);
        this.handleMatchEvents(this.match.update(dt, this));
        this.enemies.update(dt, this);
        if (input.wasPressed('confirm') && this.screen === 'menu') this.startRun();
        break;
      }
      case 'intro': this.updateIntro(dt); break;
      case 'playing': this.updatePlaying(dt); break;
      case 'paused':
        if (input.wasPressed('pause') && performance.now() - this.pausedAt > 300) this.resume();
        break;
      case 'caught': {
        this.caughtT += realDt;
        this.player.update(dt, this.ctx());
        this.handleMatchEvents(this.match.update(dt, this));
        this.enemies.update(dt, this);
        this.cam.caughtView(realDt, this.player);
        if (this.caughtT > 2.8) this.showGameOver();
        break;
      }
      case 'gameover': {
        this.cam.caughtView(realDt, this.player);
        this.player.update(dt, this.ctx());
        this.match.update(dt, this);
        this.enemies.update(dt, this);
        if (input.wasPressed('restart') && this.screen === 'gameover') this.startRun();
        break;
      }
      default: break;
    }

    // Ecrã gigante
    this.jumboT -= realDt;
    if (this.jumboOverride) {
      this.jumboOverride.t -= realDt;
      if (this.jumboOverride.t <= 0) { this.jumboOverride = null; this.jumboT = 0; }
    }
    if (!this.jumboOverride && this.jumboT <= 0) {
      this.jumboT = 0.2;
      if (this.state === 'playing') this.stadium.drawJumbo({ mode: 'invader', time: formatTime(this.runTime), xp: this.scoring.xp.toLocaleString('pt-PT') });
      else this.stadium.drawJumbo({ mode: 'score', clock: `${67 + Math.floor(this.time / 60) % 20}'` });
    }

    this.excite += (0.3 - this.excite) * Math.min(1, realDt * 0.25);
    this.audio.setExcitement(this.excite);
    const focus = this.state === 'menu' ? { x: 0, z: 0 } : this.player.pos;
    this.stadium.update(dt, this.time, this.excite, focus);

    if (this.state === 'playing' || this.state === 'intro') {
      this.hud.update(this);
      this.hud.drawMinimap(this);
      this.hud.drawIndicators(this, this.camera);
    }

    if (render) this.renderer.render(this.scene, this.camera);
    input.endFrame();

    if (!this.loaded) {
      this.loaded = true;
      $('loading').classList.add('hidden');
    }
  }

  ctx() {
    return {
      input: this.input,
      camYaw: this.cam.yaw,
      time: this.time,
      colliders: this.stadium.colliders,
      obstacles: this.match.obstacles,
      selfieTarget: this.selfieTarget,
    };
  }

  updateIntro(dt) {
    this.introT += dt;
    const t = this.introT;
    const p = this.player;
    const z0 = -BOUNDS_Z - 1.4, z1 = -BOUNDS_Z + 1.2;
    let pose = 'run';
    let speed = 5;
    if (t < 0.45) {
      p.pos.z = z0 + t * 0.6;
    } else if (t < 1.05) {
      const k = (t - 0.45) / 0.6;
      p.pos.z = z0 + 0.27 + (z1 - z0 - 0.27) * k;
      p.y = Math.sin(k * Math.PI) * 1.25;
      pose = 'jump';
    } else {
      p.y = 0;
      p.pos.z = z1;
      speed = 0;
      pose = 'run';
    }
    p.model.root.position.set(p.pos.x, p.y, p.pos.z);
    p.model.root.rotation.y = 0;
    p.model.animate(dt, { speed, pose, sharp: pose === 'jump' });
    this.match.update(dt, this);
    this.enemies.update(dt, this);
    this.cam.follow(dt, p, this.input, this.save.settings);
    if (t >= 1.15) this.beginInvasion();
  }

  updatePlaying(dt) {
    const input = this.input;
    if (input.wasPressed('pause')) { this.pause(); return; }
    this.runTime += dt;
    const p = this.player;
    this.selfieTarget = this.match.selfieTarget(p.pos);
    this.hud.selfiePrompt(!p.grabbed && !p.selfie ? this.selfieTarget : null);
    this.hud.clickHint(!input.locked && !input.usingPad && this.runTime < 600);

    this.handlePlayerEvents(p.update(dt, this.ctx()));
    if (this.state !== 'playing') return;
    this.handleMatchEvents(this.match.update(dt, this));
    this.handleEnemyEvents(this.enemies.update(dt, this));
    if (this.state !== 'playing') return;

    // Se outro perseguidor chega enquanto o invasor está agarrado, acabou
    // (há uma pequena janela para te libertares antes de os reforços chegarem).
    if (p.grabbed && p.grabbed.t > 0.5) {
      for (const e of this.enemies.list) {
        if (e === p.grabbed.enemy || !e.active || e.state === 'down' || e.state === 'getup') continue;
        if (Math.hypot(e.pos.x - p.pos.x, e.pos.z - p.pos.z) < 1.1) { this.endRun(e); return; }
      }
    }

    this.scoring.update(dt, this.enemies.alert);
    this.cam.follow(this.realDt, p, input, this.save.settings);
  }
}

try {
  window.__game = new Game();
} catch (err) {
  console.error(err);
  const l = document.getElementById('loading');
  l.textContent = 'Não foi possível iniciar o WebGL. Atualiza os drivers gráficos ou tenta outro browser.';
  l.style.fontSize = '20px';
}
