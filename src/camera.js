import * as THREE from 'three';
import { BOUNDS_X, BOUNDS_Z } from './config.js';

const TAU = Math.PI * 2;
function angleDiff(a, b) {
  let d = (b - a) % TAU;
  if (d > Math.PI) d -= TAU;
  if (d < -Math.PI) d += TAU;
  return d;
}

// Câmara em 3.ª pessoa (atrás do invasor), órbita para o menu e transições suaves.
export class CameraRig {
  constructor(camera) {
    this.camera = camera;
    this.yaw = 0;
    this.pitch = 0.3;
    this.dist = 6.3;
    this.focus = new THREE.Vector3();
    this.shakeAmt = 0;
    this.fovBase = 68;
    this.blend = null;
    this.tmpPos = new THREE.Vector3();
    this.tmpLook = new THREE.Vector3();
    this.tmpObj = new THREE.Object3D();
    this.orbitT = 0;
    this.free = false; // durante a entrada em campo a câmara pode ficar atrás dos painéis
  }

  // Inicia uma transição a partir da pose atual da câmara.
  startBlend(duration) {
    this.blend = {
      pos: this.camera.position.clone(),
      quat: this.camera.quaternion.clone(),
      t: 0,
      dur: duration,
    };
  }

  shake(amount) {
    this.shakeAmt = Math.max(this.shakeAmt, amount);
  }

  snapTo(player) {
    this.focus.set(player.pos.x, 1.5, player.pos.z);
  }

  _apply(dt, pos, look, fov) {
    const cam = this.camera;
    if (this.shakeAmt > 0.001) {
      pos = pos.clone().add(new THREE.Vector3((Math.random() - 0.5) * this.shakeAmt, (Math.random() - 0.5) * this.shakeAmt, (Math.random() - 0.5) * this.shakeAmt));
      this.shakeAmt *= Math.exp(-dt * 9);
    }
    if (this.blend) {
      const b = this.blend;
      b.t += dt;
      const k = Math.min(1, b.t / b.dur);
      const e = k * k * (3 - 2 * k);
      this.tmpObj.position.copy(pos);
      this.tmpObj.lookAt(look);
      cam.position.lerpVectors(b.pos, pos, e);
      cam.quaternion.slerpQuaternions(b.quat, this.tmpObj.quaternion, e);
      if (k >= 1) this.blend = null;
    } else {
      cam.position.copy(pos);
      cam.lookAt(look);
    }
    if (Math.abs(cam.fov - fov) > 0.05) {
      cam.fov += (fov - cam.fov) * Math.min(1, dt * 5);
      cam.updateProjectionMatrix();
    }
  }

  orbit(dt) {
    this.orbitT += dt;
    const a = this.orbitT * 0.06 + 0.6;
    this.tmpPos.set(Math.sin(a) * 62, 26 + Math.sin(this.orbitT * 0.2) * 4, Math.cos(a) * 46);
    this.tmpLook.set(0, 0, 0);
    this._apply(dt, this.tmpPos, this.tmpLook, 55);
  }

  // Vista do fim de jogo: roda devagar à volta do invasor apanhado.
  caughtView(dt, player) {
    this.yaw += dt * 0.35;
    const d = 5.5;
    this.focus.lerp(new THREE.Vector3(player.pos.x, 0.9, player.pos.z), Math.min(1, dt * 4));
    this.tmpPos.set(this.focus.x - Math.sin(this.yaw) * d, 3.2, this.focus.z - Math.cos(this.yaw) * d);
    this._apply(dt, this.tmpPos, this.focus, 60);
  }

  follow(dt, player, input, settings) {
    const md = input.consumeMouse();
    const sens = settings.sensitivity || 1;
    const inv = settings.invertY ? -1 : 1;
    this.yaw -= md.x * 0.0024 * sens;
    this.pitch += md.y * 0.0018 * sens * inv;
    const lk = input.lookKeys();
    this.yaw -= lk.x * 2.6 * dt;
    this.pitch += lk.y * 1.6 * dt * inv;
    this.pitch = Math.max(0.05, Math.min(1.0, this.pitch));

    // Câmara automática: alinha-se devagar com a direção da corrida.
    const sp = player.speed;
    const idleMouse = performance.now() - input.lastMouseMove > 1400;
    if (settings.autoCam && idleMouse && Math.abs(lk.x) < 0.1 && sp > 2.5 && !player.grabbed && !player.selfie) {
      const heading = Math.atan2(player.vel.x, player.vel.z);
      const d = angleDiff(this.yaw, heading);
      if (Math.abs(d) < 2.3) this.yaw += d * Math.min(1, dt * 1.1 * Math.min(1, sp / 6));
    }

    const fy = 1.45 + player.y * 0.6;
    this.focus.x += (player.pos.x - this.focus.x) * Math.min(1, dt * 12);
    this.focus.z += (player.pos.z - this.focus.z) * Math.min(1, dt * 12);
    this.focus.y += (fy - this.focus.y) * Math.min(1, dt * 8);
    const dist = this.dist * (player.sprinting ? 1.1 : 1);
    const cp = Math.cos(this.pitch);
    this.tmpPos.set(
      this.focus.x - Math.sin(this.yaw) * cp * dist,
      this.focus.y + Math.sin(this.pitch) * dist,
      this.focus.z - Math.cos(this.yaw) * cp * dist,
    );
    // Manter a câmara do lado de dentro dos painéis publicitários; se tiver de se
    // aproximar do invasor, sobe para continuar a ver o relvado.
    const wantX = this.tmpPos.x, wantZ = this.tmpPos.z;
    const lim = this.free ? 8 : -0.4;
    this.tmpPos.x = Math.max(-BOUNDS_X - lim, Math.min(BOUNDS_X + lim, wantX));
    this.tmpPos.z = Math.max(-BOUNDS_Z - lim, Math.min(BOUNDS_Z + lim, wantZ));
    const lost = Math.hypot(wantX - this.tmpPos.x, wantZ - this.tmpPos.z);
    this.tmpPos.y = Math.max(0.6, this.tmpPos.y + lost * 0.85);
    this.tmpLook.set(
      this.focus.x + Math.sin(this.yaw) * 2.2,
      this.focus.y + 0.2,
      this.focus.z + Math.cos(this.yaw) * 2.2,
    );
    const fov = this.fovBase + (player.sprinting ? 7 : 0) + Math.min(6, sp * 0.4);
    this._apply(dt, this.tmpPos, this.tmpLook, fov);
  }
}
