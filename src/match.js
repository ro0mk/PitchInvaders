import * as THREE from 'three';
import { Humanoid, makeStarSprite } from './character.js';
import { COLORS, HALF_L, HALF_W, BOUNDS_X, BOUNDS_Z, GOAL_W, GOAL_H, GOAL_D } from './config.js';

const pick = (arr) => arr[(Math.random() * arr.length) | 0];
const rand = (a, b) => a + Math.random() * (b - a);
const TAU = Math.PI * 2;

function angleDiff(a, b) {
  let d = (b - a) % TAU;
  if (d > Math.PI) d -= TAU;
  if (d < -Math.PI) d += TAU;
  return d;
}

// 4-4-2 para a equipa que ataca no sentido +x.
const FORMATION = [
  [-49, 0, 'GK'],
  [-34, -20], [-37, -7], [-37, 7], [-34, 20],
  [-18, -22], [-20, -7], [-20, 7], [-18, 22],
  [-5, -8], [-5, 8],
];

const STAR_NAMES = ['O Craque', 'El Mágico', 'Capitão'];

function makeBallTexture() {
  const c = document.createElement('canvas');
  c.width = 256;
  c.height = 128;
  const g = c.getContext('2d');
  g.fillStyle = '#fafafa';
  g.fillRect(0, 0, 256, 128);
  g.fillStyle = '#151515';
  for (let i = 0; i < 14; i++) {
    const x = (i % 7) * 37 + (i >= 7 ? 18 : 0);
    const y = i >= 7 ? 88 : 40;
    g.beginPath();
    for (let k = 0; k < 5; k++) {
      const a = (k / 5) * TAU - Math.PI / 2;
      g.lineTo(x + Math.cos(a) * 11, y + Math.sin(a) * 11);
    }
    g.fill();
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

class Footballer {
  constructor(scene, team, idx, opts) {
    this.team = team; // 0 casa, 1 fora, 2 árbitro
    this.idx = idx;
    this.role = opts.role || 'field';
    this.model = new Humanoid(opts.look);
    scene.add(this.model.root);
    this.pos = new THREE.Vector3();
    this.vel = new THREE.Vector3();
    this.yaw = 0;
    this.home = new THREE.Vector2(opts.home[0], opts.home[1]);
    this.star = !!opts.star;
    this.starName = opts.starName || '';
    this.selfied = false;
    this.downT = 0;
    this.pose = 'run';
    this.behavior = 'watch';
    this.behaviorT = 0;
    this.wander = new THREE.Vector2();
    this.posing = 0;
    if (this.star) {
      this.starSprite = makeStarSprite();
      this.starSprite.position.y = 2.35;
      this.starSprite.visible = false;
      this.model.root.add(this.starSprite);
    }
  }

  knock(dx, dz) {
    this.downT = 2.2;
    this.vel.set(dx * 3, 0, dz * 3);
  }
}

export class Match {
  constructor(scene) {
    this.scene = scene;
    this.players = [];
    const teams = [COLORS.home, COLORS.away];
    for (let team = 0; team < 2; team++) {
      const kit = teams[team];
      const dir = team === 0 ? 1 : -1;
      FORMATION.forEach((f, i) => {
        const gk = f[2] === 'GK';
        const number = gk ? 1 : i + 1;
        const star = (team === 0 && (number === 10 || number === 7)) || (team === 1 && number === 9);
        const fb = new Footballer(scene, team, i, {
          role: gk ? 'GK' : 'field',
          home: [f[0] * dir, f[1] * dir],
          star,
          starName: star ? STAR_NAMES[team === 1 ? 1 : number === 10 ? 0 : 2] : '',
          look: {
            skin: pick(COLORS.skin), hair: pick(COLORS.hair),
            shirt: gk ? kit.gk : kit.shirt, shorts: gk ? '#1a1a1a' : kit.shorts, socks: gk ? kit.gk : kit.socks,
            shoes: star ? '#f2c94c' : pick(['#111', '#f5f5f5', '#1e88e5', '#ff6f00']),
            number: team === 0 ? '#ffffff' : '#14284b',
            gloves: gk ? '#f5f5f5' : undefined,
          },
        });
        this.players.push(fb);
      });
    }
    this.ref = new Footballer(scene, 2, 0, {
      role: 'ref', home: [0, 0],
      look: { skin: pick(COLORS.skin), hair: '#111', shirt: '#121212', shorts: '#121212', socks: '#121212', shoes: '#111', sleeve: '#121212' },
    });
    this.players.push(this.ref);

    // Bola
    const ballMat = new THREE.MeshStandardMaterial({ map: makeBallTexture(), roughness: 0.5 });
    this.ballMesh = new THREE.Mesh(new THREE.SphereGeometry(0.11, 16, 12), ballMat);
    this.ballMesh.castShadow = true;
    scene.add(this.ballMesh);
    this.ball = { pos: new THREE.Vector3(), vel: new THREE.Vector3(), lastTouch: 'sim', resetT: 0, spin: new THREE.Vector3() };

    this.obstacles = this.players.map((p) => ({ x: 0, z: 0, r: 0.34, p }));
    this.reset();
  }

  reset() {
    this.mode = 'play';
    this.carrier = null;
    this.passTarget = null;
    this.passT = 2;
    this.goalCooldown = 0;
    for (const p of this.players) {
      p.pos.set(p.home.x + rand(-3, 3) + 6, 0, p.home.y + rand(-3, 3));
      if (p.role === 'GK') p.pos.set(p.home.x, 0, 0);
      if (p.role === 'ref') p.pos.set(rand(-5, 5), 0, rand(-8, 8));
      p.vel.set(0, 0, 0);
      p.downT = 0;
      p.selfied = false;
      p.posing = 0;
      p.yaw = p.team === 0 ? Math.PI / 2 : -Math.PI / 2;
      if (p.starSprite) p.starSprite.visible = false;
    }
    this.ball.pos.set(8, 0.11, 0);
    this.ball.vel.set(0, 0, 0);
    this.ball.lastTouch = 'sim';
    this.ball.resetT = 0;
    this.carrier = this.players.find((p) => p.team === 0 && p.idx === 9);
  }

  // A invasão começa: o jogo para.
  stop() {
    this.mode = 'stopped';
    this.carrier = null;
    for (const p of this.players) {
      p.behavior = 'watch';
      p.behaviorT = rand(0.5, 3);
      if (p.starSprite) p.starSprite.visible = true;
    }
    // A bola fica a rolar devagar.
    this.ball.vel.multiplyScalar(0.3);
  }

  hitTest(ax, az, bx, bz, r) {
    const abx = bx - ax, abz = bz - az;
    const l2 = abx * abx + abz * abz;
    for (const p of this.players) {
      if (p.downT > 0) continue;
      let t = l2 > 0 ? ((p.pos.x - ax) * abx + (p.pos.z - az) * abz) / l2 : 0;
      t = Math.max(0, Math.min(1, t));
      const d = Math.hypot(p.pos.x - (ax + abx * t), p.pos.z - (az + abz * t));
      if (d < r) return p;
    }
    return null;
  }

  selfieTarget(pos) {
    let best = null, bd = 2.4;
    for (const p of this.players) {
      if (!p.star || p.selfied || p.downT > 0) continue;
      const d = Math.hypot(p.pos.x - pos.x, p.pos.z - pos.z);
      if (d < bd) { bd = d; best = p; }
    }
    return best;
  }

  starsLeft() {
    return this.players.filter((p) => p.star && !p.selfied).length;
  }

  _teammates(p) { return this.players.filter((o) => o.team === p.team && o !== p && o.role !== 'GK'); }

  _simPlay(dt) {
    const ball = this.ball;
    const attack = (p) => (p.team === 0 ? 1 : -1);
    // Avanço da linha consoante a bola.
    const shiftX = Math.max(-18, Math.min(18, ball.pos.x * 0.55));
    const shiftZ = ball.pos.z * 0.2;

    if (this.carrier) {
      const c = this.carrier;
      this.passT -= dt;
      const goalX = attack(c) * HALF_L;
      const tx = goalX - attack(c) * 14, tz = Math.sin(performance.now() / 900 + c.idx) * 10;
      const dx = tx - c.pos.x, dz = tz - c.pos.z;
      const d = Math.hypot(dx, dz) || 1;
      c.target = [c.pos.x + (dx / d) * 4, c.pos.z + (dz / d) * 4, 5.2];
      // Bola colada ao pé
      const fx = Math.sin(c.yaw), fz = Math.cos(c.yaw);
      ball.pos.x += (c.pos.x + fx * 0.55 - ball.pos.x) * Math.min(1, dt * 12);
      ball.pos.z += (c.pos.z + fz * 0.55 - ball.pos.z) * Math.min(1, dt * 12);
      ball.vel.set(c.vel.x, 0, c.vel.z);
      // Remate perto da área
      if (Math.abs(c.pos.x - goalX) < 22 && Math.abs(c.pos.z) < 18 && this.passT < 0.5) {
        const aimZ = rand(-5, 5);
        const sx = goalX - ball.pos.x, sz = aimZ - ball.pos.z;
        const sl = Math.hypot(sx, sz);
        ball.vel.set((sx / sl) * 24, rand(1, 4), (sz / sl) * 24);
        ball.lastTouch = 'sim';
        this.carrier = null;
        this.passT = 1.2;
      } else if (this.passT <= 0) {
        const mates = this._teammates(c);
        const ahead = mates.filter((m) => (m.pos.x - c.pos.x) * attack(c) > -5);
        const target = pick(ahead.length ? ahead : mates);
        const lead = 0.4;
        const px = target.pos.x + target.vel.x * lead - ball.pos.x;
        const pz = target.pos.z + target.vel.z * lead - ball.pos.z;
        const pl = Math.hypot(px, pz) || 1;
        const sp = Math.min(22, 8 + pl * 0.5);
        ball.vel.set((px / pl) * sp, pl > 25 ? 3.5 : 0.5, (pz / pl) * sp);
        ball.lastTouch = 'sim';
        this.passTarget = target;
        this.carrier = null;
        this.passT = rand(1.2, 2.8);
      }
    } else {
      // Bola solta: o mais próximo de cada equipa vai a ela.
      this.passT -= dt;
      for (const team of [0, 1]) {
        let best = null, bd = Infinity;
        for (const p of this.players) {
          if (p.team !== team || p.role === 'GK') continue;
          const d = p.pos.distanceTo(ball.pos);
          if (d < bd) { bd = d; best = p; }
        }
        if (best) best.chasing = true;
      }
    }

    for (const p of this.players) {
      if (p.role === 'ref') {
        p.target = [ball.pos.x - 8, ball.pos.z * 0.6 - 6, 4];
        continue;
      }
      if (p.role === 'GK') {
        const gx = p.home.x;
        p.target = [Math.sign(gx) * (HALF_L - 1.2), Math.max(-3, Math.min(3, ball.pos.z * 0.15)), 4];
        // Defende remates
        if (!this.carrier && p.pos.distanceTo(ball.pos) < 1.4 && ball.pos.y < 2.2) this._gainBall(p);
        continue;
      }
      if (p === this.carrier) continue;
      if (p.chasing || p === this.passTarget) {
        p.target = [ball.pos.x, ball.pos.z, 6.2];
        p.chasing = false;
        if (!this.carrier && p.pos.distanceTo(ball.pos) < 0.9 && ball.pos.y < 1.2) this._gainBall(p);
        continue;
      }
      const dir = p.team === 0 ? 1 : -1;
      p.target = [p.home.x + shiftX + dir * 4, p.home.y + shiftZ, 4.5];
    }

    // Disputa: adversário colado ao portador rouba a bola às vezes.
    if (this.carrier) {
      for (const p of this.players) {
        if (p.team === this.carrier.team || p.role === 'ref' || p.role === 'GK') continue;
        if (p.pos.distanceTo(this.carrier.pos) < 1.0 && Math.random() < dt * 0.8) { this._gainBall(p); break; }
      }
    }

    // Bola fora: reinicia com a equipa contrária perto do sítio.
    if (Math.abs(ball.pos.x) > HALF_L + 0.5 || Math.abs(ball.pos.z) > HALF_W + 0.5) {
      const bx = Math.max(-HALF_L + 6, Math.min(HALF_L - 6, ball.pos.x));
      const bz = Math.max(-HALF_W + 1, Math.min(HALF_W - 1, ball.pos.z));
      ball.pos.set(bx, 0.11, bz);
      ball.vel.set(0, 0, 0);
      let best = null, bd = Infinity;
      for (const p of this.players) {
        if (p.role !== 'field') continue;
        const d = Math.hypot(p.pos.x - bx, p.pos.z - bz);
        if (d < bd) { bd = d; best = p; }
      }
      if (best) {
        best.pos.set(bx - (best.team === 0 ? 1 : -1) * 0.6, 0, bz);
        this._gainBall(best);
      }
    }
  }

  _gainBall(p) {
    this.carrier = p;
    this.passTarget = null;
    this.passT = rand(0.8, 2.2);
    p.yaw = p.team === 0 ? Math.PI / 2 : -Math.PI / 2;
  }

  _simStopped(dt, game) {
    const inv = game.player.pos;
    const invOnPitch = game.state === 'playing' || game.state === 'caught';
    for (const p of this.players) {
      p.behaviorT -= dt;
      const dx = inv.x - p.pos.x, dz = inv.z - p.pos.z;
      const d = Math.hypot(dx, dz);
      if (p.behaviorT <= 0) {
        p.behaviorT = rand(2, 5);
        const r = Math.random();
        p.behavior = r < 0.5 ? 'watch' : r < 0.75 ? 'wander' : 'arms';
        if (p.star && !p.selfied && d < 18) p.behavior = 'wave';
        const ang = Math.random() * TAU;
        p.wander.set(p.pos.x + Math.cos(ang) * 4, p.pos.z + Math.sin(ang) * 4);
      }
      p.pose = 'run';
      p.target = null;
      if (p.role === 'GK') {
        p.target = [Math.sign(p.home.x) * (HALF_L - 1.2), 0, 2];
      } else if (p.role === 'ref' && invOnPitch && d > 14) {
        p.target = [inv.x - (dx / d) * 12, inv.z - (dz / d) * 12, 3];
      } else if (p.behavior === 'wander') {
        p.target = [p.wander.x, p.wander.y, 1.2];
      }
      // Afasta-se do invasor se ele vier a correr na sua direção.
      if (invOnPitch && d < 3.2 && game.player.speed > 3 && p.posing <= 0) {
        const sx = -dz / (d || 1), sz = dx / (d || 1);
        const side = (sx * game.player.vel.x + sz * game.player.vel.z) > 0 ? -1 : 1;
        p.target = [p.pos.x + sx * side * 3 - dx * 0.3, p.pos.z + sz * side * 3 - dz * 0.3, 3.5];
      }
      if (p.target === null) {
        p.pose = p.behavior === 'arms' ? 'arms' : p.behavior === 'wave' ? 'wave' : 'run';
        p.faceTo = invOnPitch ? Math.atan2(dx, dz) : null;
      }
      if (p.posing > 0) {
        p.posing -= dt;
        p.pose = 'selfie';
        p.target = null;
      }
    }
  }

  update(dt, game) {
    this.goalCooldown = Math.max(0, this.goalCooldown - dt);
    if (this.mode === 'play') this._simPlay(dt);
    else this._simStopped(dt, game);

    const inv = game.player.pos;
    for (const p of this.players) {
      p.faceTo = this.mode === 'play' ? null : p.faceTo;
      if (p.downT > 0) {
        p.downT -= dt;
        p.vel.multiplyScalar(Math.max(0, 1 - dt * 5));
        p.pos.addScaledVector(p.vel, dt);
        p.model.root.position.set(p.pos.x, 0, p.pos.z);
        p.model.animate(dt, { pose: p.downT > 0.5 ? 'down' : 'getup', speed: 0 });
        continue;
      }
      let speedTarget = 0, tx = 0, tz = 0;
      if (p.target) {
        tx = p.target[0] - p.pos.x;
        tz = p.target[1] - p.pos.z;
        const d = Math.hypot(tx, tz);
        speedTarget = d < 0.4 ? 0 : Math.min(p.target[2], d * 1.5);
        if (d > 0.001) { tx /= d; tz /= d; }
      }
      const ax = tx * speedTarget - p.vel.x, az = tz * speedTarget - p.vel.z;
      const al = Math.hypot(ax, az);
      const step = 10 * dt;
      if (al <= step) { p.vel.x += ax; p.vel.z += az; } else { p.vel.x += (ax / al) * step; p.vel.z += (az / al) * step; }
      p.pos.addScaledVector(p.vel, dt);
      p.pos.x = Math.max(-BOUNDS_X + 0.5, Math.min(BOUNDS_X - 0.5, p.pos.x));
      p.pos.z = Math.max(-BOUNDS_Z + 0.5, Math.min(BOUNDS_Z - 0.5, p.pos.z));
      const sp = Math.hypot(p.vel.x, p.vel.z);
      if (sp > 0.4) p.yaw += angleDiff(p.yaw, Math.atan2(p.vel.x, p.vel.z)) * Math.min(1, dt * 8);
      else if (p.faceTo != null) p.yaw += angleDiff(p.yaw, p.faceTo) * Math.min(1, dt * 3);
      let look = 0;
      if (this.mode === 'stopped') {
        look = Math.max(-1.1, Math.min(1.1, angleDiff(p.yaw, Math.atan2(inv.x - p.pos.x, inv.z - p.pos.z))));
      }
      p.model.root.position.set(p.pos.x, 0, p.pos.z);
      p.model.root.rotation.y = p.yaw;
      p.model.animate(dt, { speed: sp, pose: sp > 0.6 ? 'run' : p.pose, lookYaw: look });
      if (p.starSprite && p.starSprite.visible) p.starSprite.position.y = 2.35 + Math.sin(performance.now() / 250) * 0.08;
    }

    // Separação simples entre jogadores
    for (let i = 0; i < this.players.length; i++) {
      const a = this.players[i];
      for (let j = i + 1; j < this.players.length; j++) {
        const b = this.players[j];
        const dx = a.pos.x - b.pos.x, dz = a.pos.z - b.pos.z;
        const d2 = dx * dx + dz * dz;
        if (d2 < 0.49 && d2 > 1e-6) {
          const d = Math.sqrt(d2), push = (0.7 - d) / 2;
          a.pos.x += (dx / d) * push; a.pos.z += (dz / d) * push;
          b.pos.x -= (dx / d) * push; b.pos.z -= (dz / d) * push;
        }
      }
    }
    this.obstacles.forEach((o) => { o.x = o.p.pos.x; o.z = o.p.pos.z; o.r = o.p.downT > 0 ? 0 : 0.34; });

    return this._updateBall(dt, game);
  }

  _updateBall(dt, game) {
    const events = [];
    const b = this.ball;
    const r = 0.11;
    if (b.resetT > 0) {
      b.resetT -= dt;
      if (b.resetT <= 0) {
        b.pos.set(0, 0.11, 0);
        b.vel.set(0, 0, 0);
        b.lastTouch = 'sim';
      }
    }
    const held = this.mode === 'play' && this.carrier;
    if (!held) {
      b.vel.y -= 9.81 * dt;
      b.pos.addScaledVector(b.vel, dt);
      if (b.pos.y < r) {
        b.pos.y = r;
        if (b.vel.y < -1.5) b.vel.y = -b.vel.y * 0.5;
        else b.vel.y = 0;
        const f = Math.max(0, 1 - dt * 0.9);
        b.vel.x *= f;
        b.vel.z *= f;
      }
    }

    // Toque do invasor
    if (game.state === 'playing' && !game.player.grabbed) {
      const P = game.player;
      const dx = b.pos.x - P.pos.x, dz = b.pos.z - P.pos.z;
      const d = Math.hypot(dx, dz);
      if (d < 0.6 && b.pos.y < 0.9 + P.y) {
        const sp = P.speed;
        const fx = sp > 0.5 ? P.vel.x / sp : Math.sin(P.yaw);
        const fz = sp > 0.5 ? P.vel.z / sp : Math.cos(P.yaw);
        const power = Math.min(26, sp * 1.6 + 3 + (P.sprinting ? 5 : 0));
        b.vel.set(fx * power, P.airborne ? 6 : (power > 14 ? 2.2 : 0.6), fz * power);
        b.pos.x = P.pos.x + fx * 0.62;
        b.pos.z = P.pos.z + fz * 0.62;
        if (this.mode === 'play') this.carrier = null;
        if (b.lastTouch !== 'player' || power > 9) events.push({ type: 'kick', power });
        b.lastTouch = 'player';
      }
    }
    // Toques de perseguidores
    if (game.enemies) {
      for (const e of game.enemies.list) {
        if (!e.active) continue;
        const dx = b.pos.x - e.pos.x, dz = b.pos.z - e.pos.z;
        const d = Math.hypot(dx, dz);
        if (d < 0.5 && b.pos.y < 0.8) {
          b.vel.x = (dx / d) * 4 + e.vel.x;
          b.vel.z = (dz / d) * 4 + e.vel.z;
          b.lastTouch = 'enemy';
        }
      }
    }
    // Jogadores parados apenas desviam a bola
    if (this.mode === 'stopped') {
      for (const p of this.players) {
        const dx = b.pos.x - p.pos.x, dz = b.pos.z - p.pos.z;
        const d = Math.hypot(dx, dz);
        if (d < 0.45 && b.pos.y < 1.5 && d > 0.001) {
          const vn = b.vel.x * dx / d + b.vel.z * dz / d;
          if (vn < 0) { b.vel.x -= 1.6 * vn * dx / d; b.vel.z -= 1.6 * vn * dz / d; }
          b.vel.multiplyScalar(0.6);
          b.pos.x = p.pos.x + (dx / d) * 0.45;
          b.pos.z = p.pos.z + (dz / d) * 0.45;
        }
      }
    }

    // Balizas: golo, postes e rede
    for (const s of [-1, 1]) {
      const lineX = s * HALF_L;
      const inside = s > 0 ? b.pos.x > lineX : b.pos.x < lineX;
      if (inside && Math.abs(b.pos.z) < GOAL_W / 2 - r && b.pos.y < GOAL_H - r && Math.abs(b.pos.x) < HALF_L + GOAL_D) {
        if (!b.inGoal) {
          b.inGoal = true;
          if (this.goalCooldown <= 0) {
            this.goalCooldown = 3;
            events.push({ type: 'goal', side: s, byPlayer: b.lastTouch === 'player' });
            b.resetT = 2.6;
          }
        }
        // Rede segura a bola
        if (Math.abs(b.pos.x) > HALF_L + GOAL_D - 0.2) { b.pos.x = s * (HALF_L + GOAL_D - 0.2); b.vel.x *= -0.2; }
        if (Math.abs(b.pos.z) > GOAL_W / 2 - 0.15) { b.pos.z = Math.sign(b.pos.z) * (GOAL_W / 2 - 0.15); b.vel.z *= -0.2; }
        if (b.pos.y > GOAL_H - 0.2) { b.pos.y = GOAL_H - 0.2; b.vel.y *= -0.2; }
        b.vel.multiplyScalar(Math.max(0, 1 - dt * 3));
      } else if (!inside) {
        b.inGoal = false;
      }
      // Postes
      for (const pz of [-GOAL_W / 2, GOAL_W / 2]) {
        const dx = b.pos.x - lineX, dz = b.pos.z - pz;
        const d = Math.hypot(dx, dz);
        if (d < r + 0.07 && b.pos.y < GOAL_H && d > 0.001) {
          const vn = (b.vel.x * dx + b.vel.z * dz) / d;
          if (vn < 0) { b.vel.x -= 1.7 * vn * dx / d; b.vel.z -= 1.7 * vn * dz / d; }
          b.pos.x = lineX + (dx / d) * (r + 0.07);
          b.pos.z = pz + (dz / d) * (r + 0.07);
        }
      }
      // Rede por fora (lados e trás) quando a bola vem de fora da baliza
      if (!b.inGoal && Math.abs(b.pos.x) > HALF_L && Math.abs(b.pos.x) < HALF_L + GOAL_D + 0.2 && Math.sign(b.pos.x) === s) {
        if (Math.abs(b.pos.z) < GOAL_W / 2 + 0.15 && b.pos.y < GOAL_H) {
          b.vel.x *= -0.3;
          b.vel.z *= -0.3;
          b.pos.z = Math.sign(b.pos.z || 1) * (GOAL_W / 2 + 0.16);
        }
      }
    }
    // Painéis publicitários
    if (Math.abs(b.pos.x) > BOUNDS_X - r) { b.pos.x = Math.sign(b.pos.x) * (BOUNDS_X - r); b.vel.x *= -0.5; }
    if (Math.abs(b.pos.z) > BOUNDS_Z - r) { b.pos.z = Math.sign(b.pos.z) * (BOUNDS_Z - r); b.vel.z *= -0.5; }

    this.ballMesh.position.copy(b.pos);
    const hs = Math.hypot(b.vel.x, b.vel.z);
    if (hs > 0.05) {
      const axis = new THREE.Vector3(b.vel.z, 0, -b.vel.x).normalize();
      this.ballMesh.rotateOnWorldAxis(axis, (hs * dt) / r);
    }
    return events;
  }
}
