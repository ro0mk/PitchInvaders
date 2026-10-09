import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

// Personagens low-poly feitos de caixas. Cada parte móvel é uma única malha com cores por vértice,
// e todas partilham o mesmo material => poucas draw calls.

const MAT = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.78, metalness: 0 });

function colorize(geo, color) {
  const c = new THREE.Color(color);
  const n = geo.attributes.position.count;
  const arr = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) { arr[i * 3] = c.r; arr[i * 3 + 1] = c.g; arr[i * 3 + 2] = c.b; }
  geo.setAttribute('color', new THREE.BufferAttribute(arr, 3));
  return geo;
}

function box(w, h, d, color, x = 0, y = 0, z = 0) {
  const g = new THREE.BoxGeometry(w, h, d);
  g.translate(x, y, z);
  return colorize(g, color);
}

function cyl(rt, rb, h, color, x = 0, y = 0, z = 0, seg = 10) {
  const g = new THREE.CylinderGeometry(rt, rb, h, seg);
  g.translate(x, y, z);
  return colorize(g, color);
}

function mesh(parts) {
  const m = new THREE.Mesh(mergeGeometries(parts), MAT);
  m.castShadow = true;
  return m;
}

const damp = (cur, target, k) => cur + (target - cur) * k;

// ---------------- Texturas partilhadas (indicadores) ----------------
function spriteTexture(draw, w = 128, h = 128) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

let alertTextures = null;
function getAlertTexture(color) {
  alertTextures = alertTextures || {};
  if (!alertTextures[color]) {
    alertTextures[color] = spriteTexture((g, w, h) => {
      g.fillStyle = color;
      g.strokeStyle = '#000';
      g.lineWidth = 8;
      g.beginPath();
      g.moveTo(w / 2, 8);
      g.lineTo(w - 8, h - 10);
      g.lineTo(8, h - 10);
      g.closePath();
      g.fill();
      g.stroke();
      g.fillStyle = '#000';
      g.font = 'bold 72px Arial Black, Impact, sans-serif';
      g.textAlign = 'center';
      g.textBaseline = 'middle';
      g.fillText('!', w / 2, h * 0.6);
    });
  }
  return alertTextures[color];
}

let starTexture = null;
function getStarTexture() {
  starTexture = starTexture || spriteTexture((g, w, h) => {
    g.translate(w / 2, h / 2);
    g.beginPath();
    for (let i = 0; i < 10; i++) {
      const r = i % 2 ? 24 : 56;
      const a = -Math.PI / 2 + (i * Math.PI) / 5;
      g.lineTo(Math.cos(a) * r, Math.sin(a) * r);
    }
    g.closePath();
    g.fillStyle = '#ffd21f';
    g.strokeStyle = '#7a4b00';
    g.lineWidth = 6;
    g.fill();
    g.stroke();
  });
  return starTexture;
}

export function makeAlertSprite(color) {
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: getAlertTexture(color), depthTest: false, transparent: true }));
  s.scale.set(0.7, 0.7, 1);
  s.renderOrder = 10;
  s.visible = false;
  return s;
}

export function makeStarSprite() {
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: getStarTexture(), depthTest: true, transparent: true }));
  s.scale.set(0.6, 0.6, 1);
  return s;
}

function makeFlagTexture() {
  return spriteTexture((g, w, h) => {
    g.fillStyle = '#046a38';
    g.fillRect(0, 0, w * 0.4, h);
    g.fillStyle = '#da291c';
    g.fillRect(w * 0.4, 0, w * 0.6, h);
    g.fillStyle = '#ffe900';
    g.beginPath();
    g.arc(w * 0.4, h * 0.42, w * 0.2, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = '#da291c';
    g.fillRect(w * 0.4 - 12, h * 0.42 - 14, 24, 28);
    g.fillStyle = '#fff';
    g.fillRect(w * 0.4 - 7, h * 0.42 - 9, 14, 18);
  }, 128, 192);
}

// ---------------- Humanoide ----------------

export class Humanoid {
  constructor(o) {
    const skin = o.skin || '#e0ac69';
    const hair = o.hair || '#2b1b10';
    const shirt = o.shirt || '#ffffff';
    const sleeve = o.sleeve || shirt;
    const shorts = o.shorts || '#222222';
    const lowerLeg = o.lowerLeg || o.socks || skin;
    const shoes = o.shoes || '#111111';
    const longPants = !!o.longPants;

    this.root = new THREE.Group();
    this.pelvis = new THREE.Group();
    this.pelvis.position.y = 0.93;
    this.root.add(this.pelvis);

    // Pernas
    const mkLeg = (side) => {
      const hip = new THREE.Group();
      hip.position.set(side * 0.11, 0, 0);
      const thigh = mesh([box(0.17, 0.48, 0.19, shorts, 0, -0.22, 0)]);
      hip.add(thigh);
      const knee = new THREE.Group();
      knee.position.y = -0.46;
      const shinParts = [box(0.14, 0.42, 0.15, longPants ? shorts : lowerLeg, 0, -0.21, 0), box(0.15, 0.09, 0.27, shoes, 0, -0.43, 0.05)];
      if (!longPants && o.socks) shinParts.push(box(0.145, 0.08, 0.155, skin, 0, -0.03, 0));
      knee.add(mesh(shinParts));
      hip.add(knee);
      this.pelvis.add(hip);
      return { hip, knee };
    };
    this.legL = mkLeg(1);
    this.legR = mkLeg(-1);

    // Tronco
    this.spine = new THREE.Group();
    this.pelvis.add(this.spine);
    const torso = [
      box(0.44, 0.17, 0.25, shorts, 0, 0.02, 0),
      box(0.46, 0.5, 0.26, shirt, 0, 0.33, 0),
      box(0.12, 0.08, 0.12, skin, 0, 0.62, 0),
    ];
    if (o.vest) {
      torso.push(box(0.48, 0.4, 0.28, o.vest, 0, 0.36, 0));
      torso.push(box(0.485, 0.05, 0.285, '#e8e8e8', 0, 0.3, 0));
      torso.push(box(0.485, 0.05, 0.285, '#e8e8e8', 0, 0.42, 0));
      if (o.vestText) torso.push(box(0.3, 0.1, 0.02, o.vestText, 0, 0.42, -0.145));
    }
    if (o.number) torso.push(box(0.16, 0.2, 0.02, o.number, 0, 0.38, -0.135));
    if (o.belt) torso.push(box(0.45, 0.05, 0.26, o.belt, 0, 0.1, 0));
    this.spine.add(mesh(torso));

    // Cabeça
    this.head = new THREE.Group();
    this.head.position.y = 0.66;
    const headParts = [
      box(0.24, 0.26, 0.25, skin, 0, 0.13, 0),
      box(0.04, 0.035, 0.02, '#111', 0.055, 0.15, 0.126),
      box(0.04, 0.035, 0.02, '#111', -0.055, 0.15, 0.126),
    ];
    if (o.hat === 'police') {
      headParts.push(cyl(0.15, 0.14, 0.09, '#141c33', 0, 0.3, 0, 12));
      headParts.push(box(0.3, 0.025, 0.2, '#0b0f1c', 0, 0.26, 0.1));
      headParts.push(box(0.29, 0.03, 0.29, '#e6e6e6', 0, 0.27, 0));
    } else if (o.hat === 'cap') {
      headParts.push(box(0.27, 0.09, 0.27, o.hatColor || '#111', 0, 0.28, 0));
      headParts.push(box(0.24, 0.025, 0.14, o.hatColor || '#111', 0, 0.25, 0.18));
    } else if (o.headband) {
      headParts.push(box(0.26, 0.09, 0.27, hair, 0, 0.28, -0.005));
      headParts.push(box(0.255, 0.05, 0.26, o.headband, 0, 0.22, 0));
    } else if (!o.bald) {
      headParts.push(box(0.26, 0.09, 0.27, hair, 0, 0.28, -0.005));
      headParts.push(box(0.26, 0.16, 0.06, hair, 0, 0.2, -0.11));
    }
    this.head.add(mesh(headParts));
    this.spine.add(this.head);

    // Braços
    const mkArm = (side) => {
      const sh = new THREE.Group();
      sh.position.set(side * 0.3, 0.55, 0);
      sh.add(mesh([box(0.13, 0.3, 0.14, sleeve, 0, -0.13, 0)]));
      const el = new THREE.Group();
      el.position.y = -0.28;
      el.add(mesh([box(0.11, 0.26, 0.12, o.forearm || skin, 0, -0.12, 0), box(0.1, 0.1, 0.11, o.gloves || skin, 0, -0.29, 0)]));
      sh.add(el);
      this.spine.add(sh);
      return { sh, el };
    };
    this.armL = mkArm(1);
    this.armR = mkArm(-1);

    // Capa (só o invasor)
    if (o.cape) {
      const geo = new THREE.PlaneGeometry(0.5, 0.8, 3, 8);
      geo.translate(0, -0.4, 0);
      this.capeBase = Float32Array.from(geo.attributes.position.array);
      this.cape = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ map: makeFlagTexture(), side: THREE.DoubleSide, roughness: 0.9 }));
      this.cape.position.set(0, 0.6, -0.15);
      this.cape.scale.x = -1; // vista de trás, a bandeira fica no sentido certo
      this.cape.castShadow = true;
      this.spine.add(this.cape);
    }

    this.phase = Math.random() * 10;
    this.time = 0;
    this.j = {
      pelvisY: 0.93, pelvisRX: 0, pelvisRZ: 0, spineRX: 0.1, spineRY: 0, headRX: 0, headRY: 0,
      legLX: 0, legRX: 0, kneeL: 0.1, kneeR: 0.1,
      armLX: 0, armRX: 0, armLZ: 0.1, armRZ: -0.1, elL: -0.3, elR: -0.3,
    };
  }

  // p: { speed, pose, poseT, side, lookYaw, sharp }
  animate(dt, p) {
    this.time += dt;
    const t = this.time;
    const speed = p.speed || 0;
    const s = Math.min(speed / 8.5, 1.2);
    const moving = speed > 0.35;
    this.phase += dt * (speed * 1.3 + (moving ? 2.2 : 0));
    const sw = Math.sin(this.phase);
    const cs = Math.cos(this.phase);
    const amp = moving ? 0.3 + 0.75 * s : 0;

    // Ciclo base: corrida / parado.
    const T = {
      pelvisY: 0.93 + Math.abs(sw) * 0.05 * amp - 0.03 * amp,
      pelvisRX: 0, pelvisRZ: 0,
      spineRX: moving ? 0.1 + 0.28 * s : 0.04 + Math.sin(t * 2) * 0.012,
      spineRY: moving ? sw * 0.12 * amp : 0,
      headRX: moving ? -0.15 * s : 0, headRY: p.lookYaw || 0,
      legLX: -sw * 0.95 * amp, legRX: sw * 0.95 * amp,
      kneeL: 0.08 + Math.max(0, cs) * 1.5 * amp, kneeR: 0.08 + Math.max(0, -cs) * 1.5 * amp,
      armLX: sw * 0.85 * amp, armRX: -sw * 0.85 * amp,
      armLZ: 0.08, armRZ: -0.08,
      elL: moving ? -0.4 - 1.0 * amp : -0.15, elR: moving ? -0.4 - 1.0 * amp : -0.15,
    };
    const side = p.side || 0;
    switch (p.pose) {
      case 'grabWindup':
        Object.assign(T, { pelvisY: 0.86, spineRX: 0.35, armLX: -1.5, armRX: -1.5, armLZ: 0.35, armRZ: -0.35, elL: -0.25, elR: -0.25, legLX: -0.4, legRX: 0.35, kneeL: 0.5, kneeR: 0.4 });
        break;
      case 'grabLunge':
        Object.assign(T, { spineRX: 0.65, armLX: -1.65, armRX: -1.65, armLZ: 0.2, armRZ: -0.2, elL: 0, elR: 0 });
        break;
      case 'diveWindup':
        Object.assign(T, { pelvisY: 0.72, spineRX: 0.75, armLX: 0.7, armRX: 0.7, elL: -0.3, elR: -0.3, legLX: -0.7, legRX: -0.4, kneeL: 1.2, kneeR: 1.0 });
        break;
      case 'dive':
        Object.assign(T, { pelvisY: 0.45, pelvisRX: 1.38, spineRX: 0.05, armLX: -2.95, armRX: -2.95, armLZ: 0.25, armRZ: -0.25, elL: 0, elR: 0, legLX: 0.15, legRX: 0.25, kneeL: 0.2, kneeR: 0.4, headRX: -0.6 });
        break;
      case 'down':
        Object.assign(T, { pelvisY: 0.16, pelvisRX: 1.52, spineRX: 0.04, armLX: -2.5, armRX: -2.3, armLZ: 0.6, armRZ: -0.7, elL: -0.2, elR: -0.4, legLX: 0.05, legRX: 0.1, kneeL: 0.3, kneeR: 0.1, headRX: -0.5 });
        break;
      case 'getup':
        Object.assign(T, { pelvisY: 0.6, pelvisRX: 0.5, spineRX: 0.4, armLX: -0.6, armRX: -0.6, legLX: -1.3, legRX: -0.2, kneeL: 1.8, kneeR: 1.2 });
        break;
      case 'stumble':
        T.spineRX += 0.45;
        T.armLZ = 0.9 + Math.sin(t * 20) * 0.2;
        T.armRZ = -0.9 - Math.sin(t * 20) * 0.2;
        T.pelvisRZ = Math.sin(t * 9) * 0.15;
        break;
      case 'slide':
        Object.assign(T, { pelvisY: 0.3, pelvisRX: -1.12, spineRX: 0.25, legLX: -0.05, kneeL: 0.05, legRX: -0.75, kneeR: 1.4, armLX: 0.4, armRX: 0.5, armLZ: 0.9, armRZ: -0.9, elL: -0.2, elR: -0.2, headRX: 0.5 });
        break;
      case 'jump':
        Object.assign(T, { pelvisY: 0.93, spineRX: 0.3, legLX: -1.25, kneeL: 1.7, legRX: 0.45, kneeR: 1.4, armLX: 0.6, armRX: -1.5, armLZ: 0.4, armRZ: -0.4, elL: -0.4, elR: -0.3 });
        break;
      case 'spin':
        Object.assign(T, { armLZ: 1.25, armRZ: -1.25, armLX: -0.2, armRX: -0.2, elL: -0.2, elR: -0.2, spineRX: 0.15 });
        break;
      case 'juke':
        T.pelvisRZ = -side * 0.4;
        T.spineRX = 0.2;
        T.legLX = side > 0 ? -0.2 : 0.3;
        T.legRX = side > 0 ? 0.3 : -0.2;
        T.armLZ = side > 0 ? 0.9 : 0.3;
        T.armRZ = side > 0 ? -0.3 : -0.9;
        break;
      case 'struggle':
        Object.assign(T, {
          pelvisY: 0.86, pelvisRZ: Math.sin(t * 31) * 0.22, spineRX: 0.3 + Math.sin(t * 17) * 0.15,
          armLX: -1 + Math.sin(t * 23) * 0.9, armRX: -1 + Math.cos(t * 21) * 0.9, armLZ: 0.6, armRZ: -0.6,
          legLX: Math.sin(t * 19) * 0.5, legRX: -Math.sin(t * 19) * 0.5, kneeL: 0.6, kneeR: 0.6,
        });
        break;
      case 'holding':
        Object.assign(T, { spineRX: 0.45, armLX: -1.35 + Math.sin(t * 25) * 0.1, armRX: -1.35 + Math.cos(t * 23) * 0.1, armLZ: -0.1, armRZ: 0.1, elL: -0.6, elR: -0.6, legLX: -0.4, legRX: 0.4, kneeL: 0.5, kneeR: 0.3, pelvisY: 0.86 });
        break;
      case 'celebrate': {
        const b = Math.abs(Math.sin(t * 7));
        Object.assign(T, { pelvisY: 0.93 + b * 0.12, armLZ: 2.6, armRZ: -2.6, armLX: -0.2, armRX: -0.2, elL: -0.3, elR: -0.3, spineRX: -0.1, kneeL: 0.2 + b * 0.3, kneeR: 0.2 + b * 0.3 });
        break;
      }
      case 'selfie':
        Object.assign(T, { armRX: -2.0, armRZ: -0.3, elR: -0.9, armLZ: 0.7, armLX: -0.4, elL: -1.2, headRX: -0.15, spineRX: 0, pelvisRZ: 0.05 });
        break;
      case 'wave':
        T.armRZ = -2.4 + Math.sin(t * 9) * 0.35;
        T.elR = -0.3;
        break;
      case 'arms':
        // Braços abertos em protesto (jogadores a reclamar).
        T.armLZ = 0.8;
        T.armRZ = -0.8;
        T.elL = T.elR = -0.5;
        break;
      default:
        break;
    }

    const k = 1 - Math.exp(-dt * (p.sharp ? 30 : 16));
    const J = this.j;
    for (const key in T) J[key] = damp(J[key], T[key], k);

    this.pelvis.position.y = J.pelvisY;
    this.pelvis.rotation.set(J.pelvisRX, 0, J.pelvisRZ);
    this.spine.rotation.set(J.spineRX, J.spineRY, 0);
    this.head.rotation.set(J.headRX, J.headRY, 0);
    this.legL.hip.rotation.x = J.legLX;
    this.legR.hip.rotation.x = J.legRX;
    this.legL.knee.rotation.x = J.kneeL;
    this.legR.knee.rotation.x = J.kneeR;
    this.armL.sh.rotation.set(J.armLX, 0, J.armLZ);
    this.armR.sh.rotation.set(J.armRX, 0, J.armRZ);
    this.armL.el.rotation.x = J.elL;
    this.armR.el.rotation.x = J.elR;

    if (this.cape) this._animateCape(dt, speed, p.pose);
  }

  _animateCape(dt, speed, pose) {
    const f = Math.min(1, speed / 8.5);
    const lift = pose === 'slide' ? 0.2 : pose === 'jump' ? 1.0 : 0.15 + f * 1.05;
    this.capeLift = damp(this.capeLift || 0, lift, 1 - Math.exp(-dt * 6));
    this.cape.rotation.x = this.capeLift + 0.05;
    const pos = this.cape.geometry.attributes.position;
    const base = this.capeBase;
    const t = this.time;
    for (let i = 0; i < pos.count; i++) {
      const bx = base[i * 3], by = base[i * 3 + 1];
      const v = -by / 0.8; // 0 no topo, 1 em baixo
      const wave = Math.sin(t * (6 + f * 10) + v * 7 + bx * 3) * (0.03 + 0.09 * f) * v;
      pos.array[i * 3 + 2] = wave - v * v * 0.12 * f;
    }
    pos.needsUpdate = true;
    this.cape.geometry.computeVertexNormals();
  }
}

// ---------------- Cão polícia ----------------

export class Dog {
  constructor() {
    this.root = new THREE.Group();
    this.body = new THREE.Group();
    this.body.position.y = 0.58;
    this.root.add(this.body);
    const tan = '#b5793a', dark = '#2a1d12';
    this.body.add(mesh([
      box(0.3, 0.3, 0.86, tan, 0, 0, 0),
      box(0.31, 0.12, 0.6, dark, 0, 0.12, -0.05),
      box(0.16, 0.2, 0.2, tan, 0, 0.15, 0.42),
      box(0.12, 0.05, 0.4, dark, 0, 0.14, -0.6),
    ]));
    this.headG = new THREE.Group();
    this.headG.position.set(0, 0.26, 0.5);
    this.headG.add(mesh([
      box(0.22, 0.22, 0.26, tan, 0, 0, 0),
      box(0.14, 0.12, 0.2, dark, 0, -0.04, 0.2),
      box(0.06, 0.12, 0.04, dark, 0.07, 0.15, -0.04),
      box(0.06, 0.12, 0.04, dark, -0.07, 0.15, -0.04),
      box(0.04, 0.03, 0.02, '#000', 0.06, 0.04, 0.13),
      box(0.04, 0.03, 0.02, '#000', -0.06, 0.04, 0.13),
    ]));
    this.body.add(this.headG);
    this.legs = [];
    for (const [x, z] of [[0.1, 0.32], [-0.1, 0.32], [0.1, -0.32], [-0.1, -0.32]]) {
      const hip = new THREE.Group();
      hip.position.set(x, -0.08, z);
      hip.add(mesh([box(0.08, 0.52, 0.09, tan, 0, -0.24, 0), box(0.09, 0.05, 0.12, dark, 0, -0.5, 0.02)]));
      this.body.add(hip);
      this.legs.push(hip);
    }
    this.phase = 0;
    this.time = 0;
    this.j = { y: 0.58, rx: 0, legs: [0, 0, 0, 0] };
  }

  animate(dt, p) {
    this.time += dt;
    const speed = p.speed || 0;
    const moving = speed > 0.3;
    this.phase += dt * (speed * 1.6 + (moving ? 3 : 0));
    const sw = Math.sin(this.phase);
    const amp = moving ? Math.min(1, 0.3 + speed / 10) : 0;
    let y = 0.58 + Math.abs(Math.sin(this.phase)) * 0.06 * amp;
    let rx = sw * 0.08 * amp;
    let legs = [sw * 0.8 * amp, sw * 0.8 * amp, -sw * 0.8 * amp, -sw * 0.8 * amp];
    if (p.pose === 'leap') { y = 0.85; rx = -0.25; legs = [-1.2, -1.2, 1.1, 1.1]; }
    else if (p.pose === 'crouch') { y = 0.45; rx = 0.12; legs = [-0.3, -0.3, 0.6, 0.6]; }
    else if (p.pose === 'down') { y = 0.35; rx = 0.05; legs = [-1.0, -1.0, 1.0, 1.0]; }
    else if (p.pose === 'holding') { y = 0.6; rx = -0.15 + Math.sin(this.time * 30) * 0.1; }
    const k = 1 - Math.exp(-dt * 18);
    this.j.y = damp(this.j.y, y, k);
    this.j.rx = damp(this.j.rx, rx, k);
    this.body.position.y = this.j.y;
    this.body.rotation.x = this.j.rx;
    this.legs.forEach((l, i) => { this.j.legs[i] = damp(this.j.legs[i], legs[i], k); l.rotation.x = this.j.legs[i]; });
    this.headG.rotation.y = p.lookYaw || 0;
  }
}
