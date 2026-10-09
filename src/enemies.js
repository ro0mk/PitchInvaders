import * as THREE from 'three';
import { Humanoid, Dog, makeAlertSprite } from './character.js';
import { ENEMY_TYPES, COLORS, BOUNDS_X, BOUNDS_Z } from './config.js';

const TAU = Math.PI * 2;
const pick = (arr) => arr[(Math.random() * arr.length) | 0];
const rand = (a, b) => a + Math.random() * (b - a);

function angleDiff(a, b) {
  let d = (b - a) % TAU;
  if (d > Math.PI) d -= TAU;
  if (d < -Math.PI) d += TAU;
  return d;
}

// Distância de um ponto (px,pz) ao segmento (ax,az)-(bx,bz).
function segDist(px, pz, ax, az, bx, bz) {
  const abx = bx - ax, abz = bz - az;
  const l2 = abx * abx + abz * abz;
  let t = l2 > 0 ? ((px - ax) * abx + (pz - az) * abz) / l2 : 0;
  t = Math.max(0, Math.min(1, t));
  const cx = ax + abx * t, cz = az + abz * t;
  return Math.hypot(px - cx, pz - cz);
}

export class Enemy {
  constructor(type, scene) {
    this.type = type;
    this.cfg = ENEMY_TYPES[type];
    if (type === 'dog') {
      this.model = new Dog();
    } else if (type === 'steward') {
      this.model = new Humanoid({
        skin: pick(COLORS.skin), hair: pick(COLORS.hair), shirt: '#1e1f24', shorts: '#16171b',
        longPants: true, shoes: '#0c0c0c', vest: '#d4ff2a', vestText: '#1a1a1a',
        bald: Math.random() < 0.3,
      });
    } else {
      this.model = new Humanoid({
        skin: pick(COLORS.skin), hair: pick(COLORS.hair), shirt: '#1d2b57', shorts: '#121a33',
        longPants: true, shoes: '#090909', hat: 'police', belt: '#0b0b0b', vest: '#22325f', vestText: '#e9e9e9',
        gloves: '#111',
      });
    }
    this.alert = makeAlertSprite(this.cfg.color);
    this.alert.position.y = type === 'dog' ? 1.35 : 2.3;
    this.model.root.add(this.alert);
    scene.add(this.model.root);
    this.scene = scene;
    this.pos = new THREE.Vector3();
    this.vel = new THREE.Vector3();
    this.yaw = 0;
    this.state = 'idle';
    this.t = 0;
    this.cool = 0;
    this.flank = rand(-1, 1);
    this.speedMul = 1;
    this.lunge = null;
    this.missCooldowns = { near: 0, cueca: 0, chapeu: 0 };
  }

  dispose() {
    this.scene.remove(this.model.root);
    this.model.root.traverse((o) => {
      if (o.isMesh) o.geometry.dispose();
      if (o.isSprite) o.material.dispose();
    });
  }

  get active() { return this.state !== 'idle'; }
  get standing() { return this.state !== 'down' && this.state !== 'getup' && this.state !== 'lunge'; }
  get isHuman() { return this.type !== 'dog'; }

  setState(s) {
    this.state = s;
    this.t = 0;
  }

  fall(duration) {
    this.setState('down');
    this.downFor = duration;
    this.lunge = null;
    this.vel.multiplyScalar(0.3);
  }

  pose() {
    switch (this.state) {
      case 'windup':
        return this.type === 'steward' ? 'grabWindup' : this.type === 'police' ? 'diveWindup' : 'crouch';
      case 'lunge':
        return this.type === 'steward' ? 'grabLunge' : this.type === 'police' ? 'dive' : 'leap';
      case 'down': return 'down';
      case 'getup': return this.isHuman ? 'getup' : 'run';
      case 'recover': return this.isHuman ? 'stumble' : 'down';
      case 'holding': return 'holding';
      case 'celebrate': return this.isHuman ? 'celebrate' : 'run';
      default: return 'run';
    }
  }
}

const POSTS = (() => {
  // Posições dos seguranças ao longo dos painéis (de frente para o público).
  const posts = [];
  for (let i = 0; i < 6; i++) {
    const x = -45 + i * 18;
    posts.push({ x, z: -BOUNDS_Z + 0.9, yaw: Math.PI });
    posts.push({ x: x + 9, z: BOUNDS_Z - 0.9, yaw: 0 });
  }
  for (const z of [-22, 0, 22]) {
    posts.push({ x: -BOUNDS_X + 0.9, z, yaw: -Math.PI / 2 });
    posts.push({ x: BOUNDS_X - 0.9, z, yaw: Math.PI / 2 });
  }
  return posts;
})();

const ENTRIES = [
  { x: 0, z: BOUNDS_Z - 0.3 }, // túnel
  { x: -BOUNDS_X + 1, z: BOUNDS_Z - 1 },
  { x: BOUNDS_X - 1, z: BOUNDS_Z - 1 },
  { x: -BOUNDS_X + 1, z: -BOUNDS_Z + 1 },
  { x: BOUNDS_X - 1, z: -BOUNDS_Z + 1 },
];

export class Enemies {
  constructor(scene) {
    this.scene = scene;
    this.list = [];
  }

  reset() {
    for (const e of this.list) e.dispose();
    this.list = [];
    for (const p of POSTS) {
      const e = new Enemy('steward', this.scene);
      e.pos.set(p.x, 0, p.z);
      e.yaw = p.yaw;
      e.state = 'idle';
      this.list.push(e);
    }
    this.spawnTimer = 3;
    this.alert = 1;
    this.maxActive = 4;
    this.lastBark = 0;
    this._syncModels(0);
  }

  activeCount() {
    let n = 0;
    for (const e of this.list) if (e.active) n++;
    return n;
  }

  activate(e, game) {
    e.setState('chase');
    e.speedMul = (1 + 0.03 * (this.alert - 1)) * rand(0.95, 1.05);
    e.cool = rand(0.3, 1.0);
    if (e.type === 'dog' && game) game.audio.bark();
  }

  // Ativa os primeiros perseguidores quando a invasão começa.
  startInvasion(playerPos, game) {
    const idle = this.list.filter((e) => e.state === 'idle');
    idle.sort((a, b) => a.pos.distanceTo(playerPos) - b.pos.distanceTo(playerPos));
    // os dois mais próximos (mas não colados ao jogador)
    let n = 0;
    for (const e of idle) {
      if (e.pos.distanceTo(playerPos) < 8) continue;
      this.activate(e, game);
      if (++n >= 2) break;
    }
  }

  spawn(type, playerPos, game) {
    if (type === 'steward') {
      const idle = this.list.filter((e) => e.state === 'idle' && e.pos.distanceTo(playerPos) > 14);
      if (idle.length) {
        idle.sort((a, b) => a.pos.distanceTo(playerPos) - b.pos.distanceTo(playerPos));
        this.activate(idle[Math.min(idle.length - 1, (Math.random() * 2) | 0)], game);
        return;
      }
    }
    const entries = ENTRIES.filter((p) => Math.hypot(p.x - playerPos.x, p.z - playerPos.z) > 18);
    const ent = entries.length ? (Math.random() < 0.55 ? entries[0] : pick(entries)) : pick(ENTRIES);
    const e = new Enemy(type, this.scene);
    e.pos.set(ent.x + rand(-1, 1), 0, ent.z);
    e.yaw = Math.atan2(playerPos.x - e.pos.x, playerPos.z - e.pos.z);
    this.list.push(e);
    this.activate(e, game);
  }

  update(dt, game) {
    const events = [];
    const player = game.player;
    const P = player.pos;
    const time = game.time;
    const playing = game.state === 'playing';

    // ---------- Dificuldade ----------
    if (playing) {
      this.alert = Math.min(5, 1 + Math.floor(game.runTime / 28) + (game.scoring.combo >= 8 ? 1 : 0));
      const maxActive = (this.maxActive = [0, 4, 6, 8, 10, 13][this.alert]);
      const interval = [0, 5.5, 4.7, 4.1, 3.5, 2.9][this.alert];
      this.spawnTimer -= dt;
      if (this.spawnTimer <= 0) {
        this.spawnTimer = interval * rand(0.85, 1.15);
        if (this.activeCount() < maxActive) {
          const r = Math.random();
          let type = 'steward';
          if (this.alert >= 2 && r < 0.4) type = 'police';
          if (this.alert >= 3 && r < 0.55) type = 'police';
          if (this.alert >= 4 && r < 0.22) type = 'dog';
          if (this.alert >= 5 && r < 0.28) type = 'dog';
          this.spawn(type, P, game);
        }
      }
    }

    for (const e of this.list) {
      e.t += dt;
      e.cool = Math.max(0, e.cool - dt);
      for (const k in e.missCooldowns) e.missCooldowns[k] = Math.max(0, e.missCooldowns[k] - dt);
      const cfg = e.cfg;
      const dx = P.x - e.pos.x, dz = P.z - e.pos.z;
      const dist = Math.hypot(dx, dz);
      let desiredX = 0, desiredZ = 0, maxSpeed = 0, accel = cfg.accel, turn = cfg.turn;
      let faceTarget = null;

      switch (e.state) {
        case 'idle': {
          // Seguranças parados junto aos painéis. Reagem se o invasor se aproxima.
          if (playing && dist < 5 && this.activeCount() < this.maxActive + 2) this.activate(e, game);
          break;
        }
        case 'chase': {
          if (!playing) { e.setState('celebrate'); break; }
          if (player.grabbed && player.grabbed.enemy !== e) {
            // Corre para ajudar quem agarrou.
            desiredX = dx; desiredZ = dz;
          } else {
            const lead = Math.min(dist / cfg.speed, 1.2) * cfg.predict;
            let tx = P.x + player.vel.x * lead;
            let tz = P.z + player.vel.z * lead;
            if (dist > 7) {
              const px = -dz / dist, pz = dx / dist;
              const off = e.flank * Math.min(dist * 0.35, 7);
              tx += px * off;
              tz += pz * off;
            }
            tx = Math.max(-BOUNDS_X, Math.min(BOUNDS_X, tx));
            tz = Math.max(-BOUNDS_Z, Math.min(BOUNDS_Z, tz));
            desiredX = tx - e.pos.x;
            desiredZ = tz - e.pos.z;
          }
          maxSpeed = cfg.speed * e.speedMul;
          // Ataque
          if (e.cool <= 0 && !player.grabbed && dist < cfg.range && player.model.root.visible) {
            const ang = Math.abs(angleDiff(e.yaw, Math.atan2(dx, dz)));
            if (ang < 0.7) {
              e.setState('windup');
              e.lunge = { minDist: Infinity, saved: null, windowStart: time - 0.25, hit: false };
            }
          }
          break;
        }
        case 'windup': {
          // Trava para preparar o ataque (é aqui que aparece o "!").
          maxSpeed = cfg.speed * 0.1;
          accel = 24;
          desiredX = dx; desiredZ = dz;
          turn = 10;
          faceTarget = Math.atan2(dx + player.vel.x * 0.15, dz + player.vel.z * 0.15);
          if (e.t >= cfg.windup) {
            // Antecipação limitada: uma finta no último instante não é "lida".
            const lead = 0.18 * cfg.predict;
            let ox = player.vel.x * lead, oz = player.vel.z * lead;
            if (player.action && player.action.type === 'juke') { ox = 0; oz = 0; }
            const ol = Math.hypot(ox, oz);
            if (ol > 0.6) { ox *= 0.6 / ol; oz *= 0.6 / ol; }
            const tx = P.x + ox - e.pos.x;
            const tz = P.z + oz - e.pos.z;
            const l = Math.hypot(tx, tz) || 1;
            e.lunge.dirX = tx / l;
            e.lunge.dirZ = tz / l;
            e.yaw = Math.atan2(e.lunge.dirX, e.lunge.dirZ);
            e.vel.set(e.lunge.dirX * cfg.lungeSpeed, 0, e.lunge.dirZ * cfg.lungeSpeed);
            e.setState('lunge');
            events.push({ type: 'lungeStart', enemy: e });
            if (e.type === 'dog') game.audio.bark();
            else game.audio.whoosh();
          }
          break;
        }
        case 'lunge': {
          const L = e.lunge;
          const sp = cfg.lungeSpeed * (e.type === 'police' ? Math.max(0.35, 1 - e.t / cfg.lungeDur * 0.6) : 1);
          e.vel.set(L.dirX * sp, 0, L.dirZ * sp);
          const ax = e.pos.x, az = e.pos.z;
          const bx = ax + L.dirX * cfg.reach, bz = az + L.dirZ * cfg.reach;
          const d = segDist(P.x, P.z, ax, az, bx, bz);
          L.minDist = Math.min(L.minDist, d);
          if (!L.hit && d < cfg.catchR && !player.grabbed && player.model.root.visible && playing) {
            const ev = player.evades(cfg.height);
            if (!ev) {
              L.hit = true;
              events.push({ type: 'grab', enemy: e });
            } else if (ev !== 'iframes') {
              L.saved = ev;
            }
          }
          // Choque com outros perseguidores (ou jogadores em campo).
          if (!L.hit && e.t > 0.05) {
            for (const o of this.list) {
              if (o === e || !o.active || o.state === 'down' || o.state === 'holding') continue;
              if (segDist(o.pos.x, o.pos.z, ax, az, bx, bz) < 0.55) {
                e.fall(1.8);
                o.fall(1.8);
                events.push({ type: 'crash', a: e, b: o });
                break;
              }
            }
          }
          if (e.state === 'lunge' && !L.hit && game.match) {
            const fb = game.match.hitTest(ax, az, bx, bz, 0.5);
            if (fb) {
              e.fall(1.6);
              fb.knock(L.dirX, L.dirZ);
              events.push({ type: 'trip', enemy: e, footballer: fb });
            }
          }
          if (e.state === 'lunge' && e.t >= cfg.lungeDur) {
            if (!L.hit) events.push({ type: 'dodge', enemy: e, lunge: L });
            if (e.state === 'lunge') {
              if (L.hit) { /* já está a agarrar */ }
              else if (e.type === 'police') e.fall(cfg.recover);
              else e.setState('recover');
            }
            e.cool = cfg.cooldown;
          }
          break;
        }
        case 'recover': {
          maxSpeed = cfg.speed * 0.25;
          desiredX = e.vel.x; desiredZ = e.vel.z;
          accel = 6;
          if (e.t >= cfg.recover) e.setState(playing ? 'chase' : 'celebrate');
          break;
        }
        case 'down': {
          e.vel.multiplyScalar(Math.max(0, 1 - dt * 6));
          if (e.t >= (e.downFor || 1.5)) e.setState(e.isHuman ? 'getup' : 'chase');
          break;
        }
        case 'getup': {
          e.vel.multiplyScalar(Math.max(0, 1 - dt * 8));
          if (e.t >= 0.5) e.setState(playing ? 'chase' : 'celebrate');
          break;
        }
        case 'holding': {
          e.vel.set(0, 0, 0);
          faceTarget = Math.atan2(dx, dz);
          if (!player.grabbed || player.grabbed.enemy !== e) {
            if (!player.caught) e.setState('chase');
          } else {
            // Mantém o invasor seguro à frente.
            const fx = Math.sin(e.yaw), fz = Math.cos(e.yaw);
            P.x += (e.pos.x + fx * 0.6 - P.x) * Math.min(1, dt * 10);
            P.z += (e.pos.z + fz * 0.6 - P.z) * Math.min(1, dt * 10);
          }
          break;
        }
        case 'celebrate': {
          if (dist > 2.2) {
            desiredX = dx; desiredZ = dz;
            maxSpeed = cfg.speed * 0.5;
          } else faceTarget = Math.atan2(dx, dz);
          break;
        }
        default: break;
      }

      // ---------- Steering ----------
      if (e.state !== 'lunge' && e.state !== 'down' && e.state !== 'getup' && e.state !== 'idle' && e.state !== 'holding') {
        let ddx = desiredX, ddz = desiredZ;
        const dl = Math.hypot(ddx, ddz);
        if (dl > 0.001) { ddx = (ddx / dl) * maxSpeed; ddz = (ddz / dl) * maxSpeed; }
        // Separação
        for (const o of this.list) {
          if (o === e || !o.active) continue;
          const ox = e.pos.x - o.pos.x, oz = e.pos.z - o.pos.z;
          const od = Math.hypot(ox, oz);
          if (od < 1.5 && od > 0.001) {
            const f = (1.5 - od) / 1.5 * 4;
            ddx += (ox / od) * f;
            ddz += (oz / od) * f;
          }
        }
        const cx = ddx - e.vel.x, cz = ddz - e.vel.z;
        const cl = Math.hypot(cx, cz);
        const step = accel * dt;
        if (cl <= step) { e.vel.x = ddx; e.vel.z = ddz; }
        else { e.vel.x += (cx / cl) * step; e.vel.z += (cz / cl) * step; }
      }

      e.pos.x += e.vel.x * dt;
      e.pos.z += e.vel.z * dt;
      if (e.state !== 'idle') {
        e.pos.x = Math.max(-BOUNDS_X + 0.3, Math.min(BOUNDS_X - 0.3, e.pos.x));
        e.pos.z = Math.max(-BOUNDS_Z + 0.3, Math.min(BOUNDS_Z - 0.3, e.pos.z));
        if (game.stadium) {
          for (const c of game.stadium.colliders) {
            if (e.pos.x > c.minX - 0.3 && e.pos.x < c.maxX + 0.3 && e.pos.z > c.minZ - 0.3 && e.pos.z < c.maxZ + 0.3) {
              const pl = e.pos.x - (c.minX - 0.3), pr = c.maxX + 0.3 - e.pos.x;
              const pb = e.pos.z - (c.minZ - 0.3), pf = c.maxZ + 0.3 - e.pos.z;
              const m = Math.min(pl, pr, pb, pf);
              if (m === pl) e.pos.x = c.minX - 0.3;
              else if (m === pr) e.pos.x = c.maxX + 0.3;
              else if (m === pb) e.pos.z = c.minZ - 0.3;
              else e.pos.z = c.maxZ + 0.3;
            }
          }
        }
      }

      // Orientação
      const sp = Math.hypot(e.vel.x, e.vel.z);
      if (faceTarget !== null) {
        e.yaw += angleDiff(e.yaw, faceTarget) * Math.min(1, dt * turn);
      } else if (sp > 0.5 && e.state !== 'lunge' && e.state !== 'down' && e.state !== 'getup') {
        e.yaw += angleDiff(e.yaw, Math.atan2(e.vel.x, e.vel.z)) * Math.min(1, dt * turn);
      }

      // Contacto direto = agarrado (exceto se o invasor desliza por baixo de um humano)
      if (playing && e.state === 'chase' && dist < 0.62 && !player.grabbed && !player.invulnerable && player.y < 0.5
        && !(player.sliding && e.isHuman)) {
        events.push({ type: 'grab', enemy: e });
      }

      // Rasantes, cuecas e chapéus (XP passivo)
      if (playing && !player.grabbed && e.active) {
        if (player.sliding && e.isHuman && e.standing && dist < 1.1 && e.missCooldowns.cueca <= 0) {
          e.missCooldowns.cueca = 3;
          events.push({ type: 'cueca', enemy: e });
        } else if (player.y > 0.35 && (e.state === 'down' || e.state === 'lunge') && e.type === 'police' && dist < 1.3 && e.missCooldowns.chapeu <= 0) {
          e.missCooldowns.chapeu = 3;
          events.push({ type: 'chapeu', enemy: e });
        } else if (e.state === 'chase' && dist < 1.35 && player.speed > 5 && e.missCooldowns.near <= 0) {
          e.missCooldowns.near = 2.5;
          events.push({ type: 'nearMiss', enemy: e });
        }
      }
    }

    this._syncModels(dt);
    return events;
  }

  _syncModels(dt) {
    for (const e of this.list) {
      const m = e.model;
      m.root.position.set(e.pos.x, 0, e.pos.z);
      m.root.rotation.y = e.yaw;
      m.animate(dt, { speed: e.state === 'idle' ? 0 : Math.hypot(e.vel.x, e.vel.z), pose: e.pose(), sharp: e.state === 'lunge' });
      const showAlert = e.state === 'windup';
      e.alert.visible = showAlert;
      if (showAlert) {
        const s = 0.6 + Math.sin(e.t * 30) * 0.12;
        e.alert.scale.set(s, s, 1);
      }
    }
  }

  // Quando o invasor é apanhado: os mais próximos vêm "festejar".
  celebrate() {
    for (const e of this.list) {
      if (e.state === 'chase' || e.state === 'windup' || e.state === 'recover') e.setState('celebrate');
    }
  }
}
