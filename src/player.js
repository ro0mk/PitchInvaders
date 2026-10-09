import * as THREE from 'three';
import { Humanoid } from './character.js';
import { PLAYER, TRICKS, BOUNDS_X, BOUNDS_Z } from './config.js';

const TAU = Math.PI * 2;

function angleDiff(a, b) {
  let d = (b - a) % TAU;
  if (d > Math.PI) d -= TAU;
  if (d < -Math.PI) d += TAU;
  return d;
}

export class Invader {
  constructor(scene) {
    this.model = new Humanoid({
      skin: '#f1c27d', hair: '#3b2416', shirt: '#ffffff', shorts: '#1b3a8a',
      socks: '#ffffff', shoes: '#e63946', cape: true, headband: '#e63946',
    });
    scene.add(this.model.root);
    this.pos = new THREE.Vector3();
    this.vel = new THREE.Vector3();
    this.reset(0, -BOUNDS_Z - 1.5, 0);
  }

  reset(x, z, yaw) {
    this.pos.set(x, 0, z);
    this.vel.set(0, 0, 0);
    this.y = 0;
    this.vy = 0;
    this.yaw = yaw;
    this.stamina = PLAYER.staminaMax;
    this.exhausted = false;
    this.sinceDrain = 10;
    this.action = null;
    this.cooldowns = { juke: 0, spin: 0, jump: 0, slide: 0 };
    this.buffer = null;
    this.iframes = 0;
    this.grabbed = null;
    this.pose = 'run';
    this.poseT = 0;
    this.spinOffset = 0;
    this.sprinting = false;
    this.tricks = []; // { type, time }
    this.selfie = null;
    this.frozen = false;
    this.caught = false;
    this.model.root.visible = true;
  }

  get speed() { return Math.hypot(this.vel.x, this.vel.z); }
  get airborne() { return this.y > 0.05; }
  get sliding() { return this.action && this.action.type === 'slide' && this.action.t > 0.04; }
  get spinIframes() { return this.action && this.action.type === 'spin' && this.action.t > 0.02 && this.action.t < 0.42; }
  get invulnerable() { return this.iframes > 0 || this.spinIframes; }

  // Devolve o truque que faz o ataque falhar (ou null se o ataque acerta).
  evades(height) {
    if (this.iframes > 0) return 'iframes';
    if (this.spinIframes) return 'spin';
    if (height === 'high' && this.sliding) return 'slide';
    if (height === 'low' && this.y > 0.3) return 'jump';
    return null;
  }

  recentTricks(since) {
    return this.tricks.filter((t) => t.time >= since);
  }

  _startAction(type, side, ctx, events) {
    const cfg = TRICKS[type];
    if (this.cooldowns[type] > 0) return false;
    if (this.stamina < cfg.cost) {
      events.push({ type: 'noStamina' });
      return true; // consome o pedido
    }
    if (type !== 'jump' && this.airborne) return false;
    if (type === 'jump' && this.airborne) return false;
    this.stamina -= cfg.cost;
    this.sinceDrain = 0;
    this.cooldowns[type] = cfg.cooldown + cfg.dur;
    const a = { type, t: 0, dur: cfg.dur, side };
    const sp = this.speed;
    const fx = Math.sin(this.yaw), fz = Math.cos(this.yaw);
    if (type === 'juke') {
      const rx = -Math.cos(ctx.camYaw), rz = Math.sin(ctx.camYaw);
      const lx = rx * side, lz = rz * side;
      // mantém parte da velocidade que não é lateral
      const along = this.vel.x * lx + this.vel.z * lz;
      const keepX = (this.vel.x - lx * along) * 0.75, keepZ = (this.vel.z - lz * along) * 0.75;
      this.vel.set(keepX + lx * 12.5, 0, keepZ + lz * 12.5);
      a.dirX = lx;
      a.dirZ = lz;
    } else if (type === 'jump') {
      this.vy = PLAYER.jumpVel;
    } else if (type === 'slide') {
      let dx = fx, dz = fz;
      if (sp > 0.5) { dx = this.vel.x / sp; dz = this.vel.z / sp; }
      const s = Math.min(11, Math.max(sp, 7) * 1.22);
      this.vel.set(dx * s, 0, dz * s);
      this.yaw = Math.atan2(dx, dz);
    } else if (type === 'spin') {
      if (sp > 0.5) this.vel.multiplyScalar(1.1);
    }
    this.action = a;
    this.tricks.push({ type, time: ctx.time });
    if (this.tricks.length > 30) this.tricks.shift();
    events.push({ type: 'trick', trick: type });
    return true;
  }

  update(dt, ctx) {
    const events = [];
    const { input } = ctx;
    for (const k in this.cooldowns) this.cooldowns[k] = Math.max(0, this.cooldowns[k] - dt);
    this.iframes = Math.max(0, this.iframes - dt);
    this.poseT += dt;

    if (this.caught) {
      this.vel.multiplyScalar(Math.max(0, 1 - dt * 8));
      this.y = Math.max(0, this.y - dt * 5);
      this.vy = 0;
      this._apply(dt, ctx, 'struggle');
      return events;
    }

    // ---- Agarrado: luta para escapar ----
    if (this.grabbed) {
      const g = this.grabbed;
      g.t += dt;
      if (input.wasPressed('struggle')) g.progress += 1 / g.required;
      g.progress = Math.max(0, g.progress - dt * 0.18);
      this.vel.set(0, 0, 0);
      if (g.progress >= 1) {
        events.push({ type: 'escaped', enemy: g.enemy });
        this.grabbed = null;
        this.iframes = 1.1;
        // empurrão para longe de quem agarrou
        const ex = this.pos.x - g.enemy.pos.x, ez = this.pos.z - g.enemy.pos.z;
        const d = Math.hypot(ex, ez) || 1;
        this.vel.set((ex / d) * 9, 0, (ez / d) * 9);
        this.yaw = Math.atan2(ex, ez);
      } else if (g.t > g.limit) {
        events.push({ type: 'caught', by: g.enemy });
      }
      this._apply(dt, ctx, 'struggle');
      return events;
    }

    // ---- Selfie com um craque ----
    if (this.selfie) {
      this.selfie.t += dt;
      this.vel.multiplyScalar(Math.max(0, 1 - dt * 10));
      if (this.selfie.t >= this.selfie.dur) {
        events.push({ type: 'selfieDone', target: this.selfie.target });
        this.selfie = null;
      }
      this._apply(dt, ctx, 'selfie');
      return events;
    }

    // ---- Movimento pedido ----
    const mv = this.frozen ? { x: 0, y: 0 } : input.moveVector();
    const cy = ctx.camYaw;
    const fx = Math.sin(cy), fz = Math.cos(cy);
    const rx = -Math.cos(cy), rz = Math.sin(cy);
    let dx = fx * mv.y + rx * mv.x;
    let dz = fz * mv.y + rz * mv.x;
    const mag = Math.min(1, Math.hypot(dx, dz));
    if (mag > 0.001) { const l = Math.hypot(dx, dz); dx /= l; dz /= l; }

    // ---- Pedidos de truques (com buffer de 0.15 s) ----
    if (!this.frozen) {
      if (input.wasPressed('jukeL')) this.buffer = { type: 'juke', side: -1, ttl: 0.15 };
      if (input.wasPressed('jukeR')) this.buffer = { type: 'juke', side: 1, ttl: 0.15 };
      if (input.wasPressed('spin')) this.buffer = { type: 'spin', side: 0, ttl: 0.15 };
      if (input.wasPressed('jump')) this.buffer = { type: 'jump', side: 0, ttl: 0.15 };
      if (input.wasPressed('slide')) this.buffer = { type: 'slide', side: 0, ttl: 0.15 };
      if (input.wasPressed('selfie') && ctx.selfieTarget && !this.action && !this.airborne) {
        this.selfie = { t: 0, dur: 0.75, target: ctx.selfieTarget };
        events.push({ type: 'selfieStart', target: ctx.selfieTarget });
        this._apply(dt, ctx, 'selfie');
        return events;
      }
    }
    if (this.buffer) {
      this.buffer.ttl -= dt;
      if (this.buffer.ttl <= 0) this.buffer = null;
      else if (!this.action && this._startAction(this.buffer.type, this.buffer.side, ctx, events)) this.buffer = null;
    }

    // ---- Energia / sprint ----
    const wantSprint = input.isDown('sprint') && mag > 0.2 && !this.exhausted && !this.frozen;
    this.sprinting = wantSprint && (!this.action || this.action.type !== 'slide');
    if (this.sprinting) {
      this.stamina -= PLAYER.sprintDrain * dt;
      this.sinceDrain = 0;
      if (this.stamina <= 0) {
        this.stamina = 0;
        this.exhausted = true;
        events.push({ type: 'exhausted' });
      }
    } else {
      this.sinceDrain += dt;
      if (this.sinceDrain > PLAYER.regenDelay) {
        this.stamina = Math.min(PLAYER.staminaMax, this.stamina + PLAYER.staminaRegen * dt * (this.speed < 1 ? 1.6 : 1));
      }
      if (this.exhausted && this.stamina >= 30) this.exhausted = false;
    }

    // ---- Ação em curso ----
    let accel = this.airborne ? PLAYER.airAccel : PLAYER.accel;
    let maxSpeed = this.sprinting ? PLAYER.sprintSpeed : (this.exhausted ? 5.5 : PLAYER.runSpeed);
    let steer = true;
    let pose = 'run';
    const a = this.action;
    if (a) {
      a.t += dt;
      if (a.type === 'juke') {
        steer = false;
        pose = 'juke';
        this.vel.multiplyScalar(Math.max(0, 1 - dt * 1.5));
      } else if (a.type === 'spin') {
        pose = 'spin';
        maxSpeed *= 1.05;
        accel *= 0.6;
        const k = Math.min(1, a.t / a.dur);
        this.spinOffset = TAU * (k * k * (3 - 2 * k));
      } else if (a.type === 'slide') {
        steer = false;
        pose = 'slide';
        const sp = this.speed;
        if (sp > 0.01) {
          const ns = Math.max(0, sp - 9 * dt);
          this.vel.multiplyScalar(ns / sp);
          // ligeira correção de direção
          if (mag > 0.1) {
            this.vel.x += dx * 4 * dt;
            this.vel.z += dz * 4 * dt;
          }
        }
      } else if (a.type === 'jump') {
        pose = 'jump';
      }
      const done = a.type === 'jump' ? (!this.airborne && a.t > 0.1) : a.t >= a.dur;
      if (done) {
        if (a.type === 'spin') this.spinOffset = 0;
        if (a.type === 'slide') this.poseT = -0.12; // pequena recuperação
        this.action = null;
      }
    }

    // Recuperação depois do deslize
    if (!this.action && this.poseT < 0) { accel *= 0.4; }

    if (steer) {
      const tx = dx * maxSpeed * mag, tz = dz * maxSpeed * mag;
      const ddx = tx - this.vel.x, ddz = tz - this.vel.z;
      const dl = Math.hypot(ddx, ddz);
      const step = accel * dt;
      if (dl <= step) { this.vel.x = tx; this.vel.z = tz; }
      else { this.vel.x += (ddx / dl) * step; this.vel.z += (ddz / dl) * step; }
    }

    // ---- Salto / gravidade ----
    if (this.airborne || this.vy > 0) {
      this.vy -= PLAYER.gravity * dt;
      this.y += this.vy * dt;
      if (this.y <= 0) {
        this.y = 0;
        this.vy = 0;
        events.push({ type: 'land' });
      }
    }

    // ---- Orientação ----
    const sp = this.speed;
    if (sp > 0.6 && (!a || a.type !== 'juke')) {
      const target = Math.atan2(this.vel.x, this.vel.z);
      const d = angleDiff(this.yaw, target);
      this.yaw += d * Math.min(1, dt * 14);
    }

    this._apply(dt, ctx, pose);
    return events;
  }

  _apply(dt, ctx, pose) {
    // Integração e colisões
    this.pos.x += this.vel.x * dt;
    this.pos.z += this.vel.z * dt;
    this.resolveCollisions(ctx.colliders, ctx.obstacles);
    const m = this.model;
    m.root.position.set(this.pos.x, this.y, this.pos.z);
    m.root.rotation.y = this.yaw + this.spinOffset;
    this.pose = pose;
    m.animate(dt, {
      speed: pose === 'struggle' || pose === 'selfie' ? 0 : this.speed,
      pose,
      side: this.action ? this.action.side : 0,
      sharp: pose === 'juke' || pose === 'slide' || pose === 'jump',
    });
  }

  resolveCollisions(colliders, obstacles) {
    const r = 0.32;
    if (obstacles) {
      for (const o of obstacles) {
        if (o.r <= 0) continue;
        const ox = this.pos.x - o.x, oz = this.pos.z - o.z;
        const min = r + o.r;
        const d2 = ox * ox + oz * oz;
        if (d2 < min * min && d2 > 1e-6) {
          const d = Math.sqrt(d2);
          const push = min - d;
          this.pos.x += (ox / d) * push;
          this.pos.z += (oz / d) * push;
          // perde a componente de velocidade contra o obstáculo
          const vn = (this.vel.x * ox + this.vel.z * oz) / d;
          if (vn < 0) { this.vel.x -= (ox / d) * vn; this.vel.z -= (oz / d) * vn; }
          if (o.onHit) o.onHit(this);
        }
      }
    }
    if (colliders) {
      for (const c of colliders) {
        if (this.pos.x > c.minX - r && this.pos.x < c.maxX + r && this.pos.z > c.minZ - r && this.pos.z < c.maxZ + r) {
          const pushL = this.pos.x - (c.minX - r);
          const pushR = c.maxX + r - this.pos.x;
          const pushB = this.pos.z - (c.minZ - r);
          const pushF = c.maxZ + r - this.pos.z;
          const m = Math.min(pushL, pushR, pushB, pushF);
          if (m === pushL) { this.pos.x = c.minX - r; this.vel.x = Math.min(0, this.vel.x); }
          else if (m === pushR) { this.pos.x = c.maxX + r; this.vel.x = Math.max(0, this.vel.x); }
          else if (m === pushB) { this.pos.z = c.minZ - r; this.vel.z = Math.min(0, this.vel.z); }
          else { this.pos.z = c.maxZ + r; this.vel.z = Math.max(0, this.vel.z); }
        }
      }
    }
    const bx = BOUNDS_X - r, bz = BOUNDS_Z - r;
    if (this.pos.x < -bx) { this.pos.x = -bx; this.vel.x = Math.max(0, this.vel.x); }
    if (this.pos.x > bx) { this.pos.x = bx; this.vel.x = Math.min(0, this.vel.x); }
    if (this.pos.z < -bz && !this.frozen) { this.pos.z = -bz; this.vel.z = Math.max(0, this.vel.z); }
    if (this.pos.z > bz) { this.pos.z = bz; this.vel.z = Math.min(0, this.vel.z); }
  }
}
