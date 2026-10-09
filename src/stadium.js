import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { HALF_L, HALF_W, BOUNDS_X, BOUNDS_Z, GOAL_W, GOAL_H, GOAL_D, COLORS } from './config.js';

const TEX_W = 124; // metros cobertos pela textura do relvado (x)
const TEX_H = 86; //  (z)

function rand(a, b) { return a + Math.random() * (b - a); }

function makePitchTexture(renderer, quality) {
  const ppm = quality === 'high' ? 16 : 10;
  const c = document.createElement('canvas');
  c.width = Math.round(TEX_W * ppm);
  c.height = Math.round(TEX_H * ppm);
  const g = c.getContext('2d');
  const X = (x) => (x + TEX_W / 2) * ppm;
  const Z = (z) => (z + TEX_H / 2) * ppm;

  g.fillStyle = '#2c6e2f';
  g.fillRect(0, 0, c.width, c.height);
  // Riscas do corte da relva.
  const stripes = 20;
  const sw = (2 * HALF_L) / stripes;
  for (let i = -2; i < stripes + 2; i++) {
    g.fillStyle = i % 2 === 0 ? '#3a8c3b' : '#327c33';
    g.fillRect(X(-HALF_L + i * sw), Z(-HALF_W - 4), sw * ppm + 1, (2 * HALF_W + 8) * ppm);
  }
  // Zona exterior ligeiramente mais escura.
  g.fillStyle = 'rgba(10,30,10,0.28)';
  g.fillRect(0, 0, c.width, Z(-HALF_W - 4));
  g.fillRect(0, Z(HALF_W + 4), c.width, c.height);
  g.fillRect(0, 0, X(-HALF_L - 4), c.height);
  g.fillRect(X(HALF_L + 4), 0, c.width, c.height);
  // Grão da relva.
  const specks = Math.round(c.width * c.height / 40);
  for (let i = 0; i < specks; i++) {
    const v = Math.random();
    g.fillStyle = v < 0.5 ? 'rgba(0,0,0,0.07)' : 'rgba(255,255,255,0.045)';
    g.fillRect(Math.random() * c.width, Math.random() * c.height, 2, 2);
  }

  // Linhas.
  g.strokeStyle = 'rgba(255,255,255,0.93)';
  g.fillStyle = 'rgba(255,255,255,0.93)';
  g.lineWidth = Math.max(2, 0.12 * ppm);
  const rect = (x0, z0, x1, z1) => g.strokeRect(X(x0), Z(z0), (x1 - x0) * ppm, (z1 - z0) * ppm);
  const line = (x0, z0, x1, z1) => { g.beginPath(); g.moveTo(X(x0), Z(z0)); g.lineTo(X(x1), Z(z1)); g.stroke(); };
  const arc = (x, z, r, a0, a1) => { g.beginPath(); g.arc(X(x), Z(z), r * ppm, a0, a1); g.stroke(); };
  const spot = (x, z) => { g.beginPath(); g.arc(X(x), Z(z), 0.18 * ppm, 0, Math.PI * 2); g.fill(); };

  rect(-HALF_L, -HALF_W, HALF_L, HALF_W);
  line(0, -HALF_W, 0, HALF_W);
  arc(0, 0, 9.15, 0, Math.PI * 2);
  spot(0, 0);
  const a = Math.acos(5.5 / 9.15);
  for (const s of [-1, 1]) {
    const gx = s * HALF_L;
    rect(Math.min(gx, gx - s * 16.5), -20.16, Math.max(gx, gx - s * 16.5), 20.16);
    rect(Math.min(gx, gx - s * 5.5), -9.16, Math.max(gx, gx - s * 5.5), 9.16);
    spot(gx - s * 11, 0);
    if (s === 1) arc(gx - 11, 0, 9.15, Math.PI - a, Math.PI + a);
    else arc(gx + 11, 0, 9.15, -a, a);
    for (const t of [-1, 1]) {
      // Cantos: quarto de círculo virado para dentro do campo.
      const cx = gx, cz = t * HALF_W;
      const start = Math.atan2(-t, -s);
      arc(cx, cz, 1, start - Math.PI / 4, start + Math.PI / 4);
    }
  }

  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());
  return tex;
}

function makeNetTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const g = c.getContext('2d');
  g.strokeStyle = 'rgba(255,255,255,0.9)';
  g.lineWidth = 3;
  g.strokeRect(0, 0, 64, 64);
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

const ADS = [
  { text: 'PITCH INVADERS', bg: '#111', fg: '#ffd21f' },
  { text: 'CHUTO CERVEJA', bg: '#c4161c', fg: '#fff' },
  { text: 'RELVADO+ TV', bg: '#0b3d91', fg: '#fff' },
  { text: 'FINTA SEGUROS', bg: '#f5f5f5', fg: '#0b3d91' },
  { text: 'OLÉ ENERGY', bg: '#18a558', fg: '#fff' },
  { text: 'PASTÉIS DA BANCADA', bg: '#ffb703', fg: '#3a1f00' },
  { text: 'TRAVE MOBILE', bg: '#6a1b9a', fg: '#fff' },
  { text: 'BOLA DE OURO', bg: '#222', fg: '#f2c94c' },
];

function makeAdTexture() {
  const c = document.createElement('canvas');
  const seg = 256;
  c.width = seg * ADS.length;
  c.height = 64;
  const g = c.getContext('2d');
  ADS.forEach((ad, i) => {
    g.fillStyle = ad.bg;
    g.fillRect(i * seg, 0, seg, 64);
    g.fillStyle = ad.fg;
    g.font = 'bold 30px "Arial Black", Impact, sans-serif';
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    let size = 30;
    while (g.measureText(ad.text).width > seg - 20 && size > 12) {
      size -= 2;
      g.font = `bold ${size}px "Arial Black", Impact, sans-serif`;
    }
    g.fillText(ad.text, i * seg + seg / 2, 34);
  });
  const t = new THREE.CanvasTexture(c);
  t.wrapS = THREE.RepeatWrapping;
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

function colored(geo, color) {
  const col = new THREE.Color(color);
  const n = geo.attributes.position.count;
  const arr = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) { arr[i * 3] = col.r; arr[i * 3 + 1] = col.g; arr[i * 3 + 2] = col.b; }
  geo.setAttribute('color', new THREE.BufferAttribute(arr, 3));
  return geo;
}

function crowdMaterial(uniforms) {
  const mat = new THREE.MeshLambertMaterial({ color: 0xffffff });
  mat.onBeforeCompile = (shader) => {
    shader.uniforms.uTime = uniforms.uTime;
    shader.uniforms.uExcite = uniforms.uExcite;
    shader.vertexShader = 'uniform float uTime;\nuniform float uExcite;\n' + shader.vertexShader.replace(
      '#include <begin_vertex>',
      `#include <begin_vertex>
      #ifdef USE_INSTANCING
        vec2 ip = vec2(instanceMatrix[3][0], instanceMatrix[3][2]);
        float rnd = fract(sin(dot(ip, vec2(12.9898, 78.233))) * 43758.5453);
        float ph = ip.x * 0.31 + ip.y * 0.47 + rnd * 6.2831;
        float hop = max(0.0, sin(uTime * (4.0 + 3.0 * rnd) + ph));
        float wave = max(0.0, sin(uTime * 2.2 - ip.x * 0.08 - ip.y * 0.08));
        transformed.y += hop * (0.03 + 0.3 * uExcite * step(0.35, rnd)) + wave * 0.12 * uExcite;
      #endif`,
    );
  };
  return mat;
}

export function buildStadium(scene, renderer, quality = 'high') {
  const hi = quality === 'high';
  const uniforms = { uTime: { value: 0 }, uExcite: { value: 0.3 } };

  // ---------- Céu ----------
  const sky = new THREE.Mesh(
    new THREE.SphereGeometry(600, 32, 16),
    new THREE.ShaderMaterial({
      side: THREE.BackSide,
      depthWrite: false,
      fog: false,
      uniforms: { top: { value: new THREE.Color('#03060f') }, bottom: { value: new THREE.Color('#1c2c52') } },
      vertexShader: 'varying vec3 vP; void main(){ vP = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
      fragmentShader: 'uniform vec3 top; uniform vec3 bottom; varying vec3 vP; void main(){ float h = clamp(vP.y * 1.6, 0.0, 1.0); gl_FragColor = vec4(mix(bottom, top, pow(h, 0.6)), 1.0); }',
    }),
  );
  scene.add(sky);
  {
    const n = 700;
    const pos = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) {
      const th = Math.random() * Math.PI * 2;
      const ph = Math.acos(rand(0.15, 1));
      pos[i * 3] = Math.sin(ph) * Math.cos(th) * 550;
      pos[i * 3 + 1] = Math.cos(ph) * 550;
      pos[i * 3 + 2] = Math.sin(ph) * Math.sin(th) * 550;
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    scene.add(new THREE.Points(geo, new THREE.PointsMaterial({ color: 0xffffff, size: 1.6, sizeAttenuation: false, fog: false })));
  }

  // ---------- Luzes ----------
  scene.add(new THREE.HemisphereLight(0xc6d4ff, 0x29402a, 1.15));
  const key = new THREE.DirectionalLight(0xfff6e6, 2.4);
  key.position.set(-40, 60, -30);
  key.castShadow = true;
  key.shadow.mapSize.set(hi ? 2048 : 1024, hi ? 2048 : 1024);
  const sc = key.shadow.camera;
  sc.left = -32; sc.right = 32; sc.top = 32; sc.bottom = -32; sc.near = 10; sc.far = 160;
  key.shadow.bias = -0.0006;
  key.shadow.normalBias = 0.02;
  scene.add(key, key.target);
  const fill = new THREE.DirectionalLight(0xdfe8ff, 0.9);
  fill.position.set(50, 50, 40);
  scene.add(fill);

  // ---------- Chão ----------
  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(700, 700),
    new THREE.MeshLambertMaterial({ color: 0x1b2620 }),
  );
  ground.rotation.x = -Math.PI / 2;
  ground.position.y = -0.03;
  scene.add(ground);

  const pitch = new THREE.Mesh(
    new THREE.PlaneGeometry(TEX_W, TEX_H),
    new THREE.MeshStandardMaterial({ map: makePitchTexture(renderer, quality), roughness: 0.95, metalness: 0 }),
  );
  pitch.rotation.x = -Math.PI / 2;
  pitch.receiveShadow = true;
  scene.add(pitch);

  // ---------- Balizas ----------
  const colliders = [];
  const white = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.4 });
  const netMat = new THREE.MeshLambertMaterial({ map: makeNetTexture(), transparent: true, side: THREE.DoubleSide, depthWrite: false, opacity: 0.85 });
  for (const s of [-1, 1]) {
    const goal = new THREE.Group();
    goal.position.set(s * HALF_L, 0, 0);
    const postGeo = new THREE.CylinderGeometry(0.06, 0.06, GOAL_H, 10);
    for (const z of [-GOAL_W / 2, GOAL_W / 2]) {
      const p = new THREE.Mesh(postGeo, white);
      p.position.set(s * 0.06, GOAL_H / 2, z);
      p.castShadow = true;
      goal.add(p);
      const back = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 1.4, 6), white);
      back.position.set(s * (GOAL_D - 0.1), 0.7, z);
      goal.add(back);
      const strut = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, Math.hypot(GOAL_D, GOAL_H - 1.4), 6), white);
      strut.position.set(s * GOAL_D / 2, (GOAL_H + 1.4) / 2, z);
      strut.rotation.z = s * Math.atan2(GOAL_D, GOAL_H - 1.4);
      goal.add(strut);
    }
    const bar = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, GOAL_W + 0.12, 10), white);
    bar.rotation.x = Math.PI / 2;
    bar.position.set(s * 0.06, GOAL_H, 0);
    bar.castShadow = true;
    goal.add(bar);
    // Rede: traseira, topo inclinado e laterais.
    const netPiece = (geo, repU, repV) => {
      const t = netMat.map.clone();
      t.repeat.set(repU, repV);
      t.needsUpdate = true;
      const m = new THREE.Mesh(geo, netMat.clone());
      m.material.map = t;
      return m;
    };
    const quad = (a, b, c, d) => {
      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.Float32BufferAttribute([...a, ...b, ...c, ...d], 3));
      geo.setAttribute('uv', new THREE.Float32BufferAttribute([0, 0, 1, 0, 1, 1, 0, 1], 2));
      geo.setIndex([0, 1, 2, 0, 2, 3]);
      geo.computeVertexNormals();
      return geo;
    };
    const hw = GOAL_W / 2, bx = s * GOAL_D;
    goal.add(netPiece(quad([bx, 0, -hw], [bx, 0, hw], [bx, 1.4, hw], [bx, 1.4, -hw]), GOAL_W / 0.15, 1.4 / 0.15));
    goal.add(netPiece(quad([0, GOAL_H, -hw], [0, GOAL_H, hw], [bx, 1.4, hw], [bx, 1.4, -hw]), GOAL_W / 0.15, Math.hypot(GOAL_D, GOAL_H - 1.4) / 0.15));
    for (const z of [-hw, hw]) {
      const shape = new THREE.Shape();
      shape.moveTo(0, 0);
      shape.lineTo(GOAL_D, 0);
      shape.lineTo(GOAL_D, 1.4);
      shape.lineTo(0, GOAL_H);
      shape.lineTo(0, 0);
      const m = netPiece(new THREE.ShapeGeometry(shape), 1 / 0.15, 1 / 0.15);
      m.scale.x = s;
      m.position.z = z;
      goal.add(m);
    }
    scene.add(goal);
    const x0 = s * HALF_L, x1 = s * (HALF_L + GOAL_D + 0.1);
    colliders.push({ minX: Math.min(x0, x1) - 0.08, maxX: Math.max(x0, x1) + 0.08, minZ: -GOAL_W / 2 - 0.1, maxZ: GOAL_W / 2 + 0.1 });
  }

  // ---------- Painéis publicitários (LED com scroll) ----------
  const adTex = makeAdTexture();
  const adTextures = [];
  const boardBack = new THREE.MeshLambertMaterial({ color: 0x15171c });
  const addBoard = (len, x, z, ry) => {
    const t = adTex.clone();
    t.needsUpdate = true;
    t.repeat.set(len / 32, 1);
    adTextures.push(t);
    const face = new THREE.Mesh(new THREE.PlaneGeometry(len, 0.9), new THREE.MeshBasicMaterial({ map: t }));
    face.position.set(x, 0.45, z);
    face.rotation.y = ry;
    scene.add(face);
    const box = new THREE.Mesh(new THREE.BoxGeometry(len, 0.9, 0.2), boardBack);
    box.position.set(x, 0.45, z);
    box.rotation.y = ry;
    box.translateZ(-0.11);
    scene.add(box);
  };
  addBoard(2 * BOUNDS_X + 0.4, 0, -BOUNDS_Z - 0.2, 0);
  addBoard(2 * BOUNDS_X + 0.4, 0, BOUNDS_Z + 0.2, Math.PI);
  addBoard(2 * BOUNDS_Z + 0.4, -BOUNDS_X - 0.2, 0, Math.PI / 2);
  addBoard(2 * BOUNDS_Z + 0.4, BOUNDS_X + 0.2, 0, -Math.PI / 2);

  // ---------- Bancadas + público ----------
  const rows = hi ? 20 : 14;
  const rowDepth = 0.9;
  const rowRise = 0.52;
  const seat = hi ? 0.72 : 0.95;
  const stands = [
    // centro da frente da bancada, direção (para fora do campo), comprimento
    { cx: 0, cz: -(BOUNDS_Z + 3.5), dir: [0, -1], len: 122, away: false },
    { cx: 0, cz: BOUNDS_Z + 3.5, dir: [0, 1], len: 122, away: false, tunnel: true },
    { cx: -(BOUNDS_X + 4), cz: 0, dir: [-1, 0], len: 84, away: false },
    { cx: BOUNDS_X + 4, cz: 0, dir: [1, 0], len: 84, away: true },
  ];
  const standGeos = [];
  const seats = [];
  const tmpM = new THREE.Matrix4();
  for (const st of stands) {
    const [dx, dz] = st.dir;
    const yaw = Math.atan2(dx, dz); // local +Z aponta para fora do campo
    const base = new THREE.Matrix4().makeRotationY(yaw).setPosition(st.cx, 0, st.cz);
    // Muro da frente.
    const wall = colored(new THREE.BoxGeometry(st.len, 1.6, 0.4), '#2b2f38');
    wall.applyMatrix4(tmpM.makeTranslation(0, 0.8, 0)).applyMatrix4(base);
    standGeos.push(wall);
    for (let r = 0; r < rows; r++) {
      const h = 1.6 + r * rowRise;
      const step = colored(new THREE.BoxGeometry(st.len, rowRise, rowDepth), r % 2 ? '#3a3f4b' : '#343844');
      step.applyMatrix4(tmpM.makeTranslation(0, h - rowRise / 2, 0.2 + rowDepth / 2 + r * rowDepth)).applyMatrix4(base);
      standGeos.push(step);
      const count = Math.floor(st.len / seat);
      for (let i = 0; i < count; i++) {
        const lx = -st.len / 2 + seat / 2 + i * seat + rand(-0.08, 0.08);
        if (st.tunnel && Math.abs(lx) < 3.5 && r < 4) continue;
        if (Math.random() < 0.1) continue;
        const local = new THREE.Vector3(lx, h, 0.2 + rowDepth * 0.55 + r * rowDepth);
        local.applyMatrix4(base);
        // Adeptos visitantes num canto da bancada topo direito.
        const awayFan = st.away && lx > 8;
        seats.push({ p: local, yaw: yaw + Math.PI + rand(-0.25, 0.25), away: awayFan });
      }
    }
    // Paredão de fundo e cobertura.
    const backH = 1.6 + rows * rowRise;
    const backWall = colored(new THREE.BoxGeometry(st.len, backH + 6, 0.6), '#252832');
    backWall.applyMatrix4(tmpM.makeTranslation(0, (backH + 6) / 2, 0.5 + rows * rowDepth)).applyMatrix4(base);
    standGeos.push(backWall);
    const roofDepth = rows * rowDepth + 4;
    const roof = colored(new THREE.BoxGeometry(st.len + 2, 0.4, roofDepth), '#1d2027');
    roof.applyMatrix4(new THREE.Matrix4().makeRotationX(-0.08))
      .applyMatrix4(tmpM.makeTranslation(0, backH + 6, 0.5 + rows * rowDepth - roofDepth / 2))
      .applyMatrix4(base);
    standGeos.push(roof);
    // Faixa luminosa por baixo da cobertura.
    if (st.tunnel) {
      const tunnel = colored(new THREE.BoxGeometry(5, 3, 2.5), '#07080b');
      tunnel.applyMatrix4(tmpM.makeTranslation(0, 1.5, 0.6)).applyMatrix4(base);
      standGeos.push(tunnel);
    }
  }
  const standMesh = new THREE.Mesh(mergeGeometries(standGeos), new THREE.MeshLambertMaterial({ vertexColors: true }));
  standMesh.receiveShadow = false;
  scene.add(standMesh);

  // Público: uma InstancedMesh para corpos e outra para cabeças (2 draw calls).
  const cMat = crowdMaterial(uniforms);
  const bodyGeo = new THREE.BoxGeometry(0.46, 0.62, 0.3);
  bodyGeo.translate(0, 0.42, 0);
  const headGeo = new THREE.BoxGeometry(0.22, 0.24, 0.22);
  headGeo.translate(0, 0.86, 0);
  const bodies = new THREE.InstancedMesh(bodyGeo, cMat, seats.length);
  const heads = new THREE.InstancedMesh(headGeo, cMat, seats.length);
  const q = new THREE.Quaternion();
  const sVec = new THREE.Vector3(1, 1, 1);
  const col = new THREE.Color();
  const homeMix = [COLORS.home.shirt, COLORS.home.shirt, COLORS.home.shirt, '#ffffff', '#1a1a1a', '#b5121b', '#3b3b3b', '#ececec'];
  const awayMix = [COLORS.away.shirt, COLORS.away.shirt, COLORS.away.shirt, COLORS.away.shorts, '#ffffff'];
  seats.forEach((s, i) => {
    q.setFromAxisAngle(THREE.Object3D.DEFAULT_UP, s.yaw);
    sVec.set(1, rand(0.88, 1.12), 1);
    tmpM.compose(s.p, q, sVec);
    bodies.setMatrixAt(i, tmpM);
    heads.setMatrixAt(i, tmpM);
    const mix = s.away ? awayMix : homeMix;
    col.set(Math.random() < 0.85 ? mix[(Math.random() * mix.length) | 0] : `hsl(${rand(0, 360)},50%,45%)`);
    bodies.setColorAt(i, col);
    col.set(COLORS.skin[(Math.random() * COLORS.skin.length) | 0]);
    heads.setColorAt(i, col);
  });
  bodies.frustumCulled = heads.frustumCulled = false;
  scene.add(bodies, heads);

  // Flashes de telemóveis na bancada (mais frequentes com o público entusiasmado).
  {
    const n = Math.min(seats.length, hi ? 420 : 160);
    const pos = new Float32Array(n * 3);
    const seed = new Float32Array(n);
    for (let i = 0; i < n; i++) {
      const s = seats[(Math.random() * seats.length) | 0];
      pos[i * 3] = s.p.x;
      pos[i * 3 + 1] = s.p.y + 1.05;
      pos[i * 3 + 2] = s.p.z;
      seed[i] = Math.random();
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    geo.setAttribute('seed', new THREE.BufferAttribute(seed, 1));
    const flashes = new THREE.Points(geo, new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      uniforms,
      vertexShader: `
        attribute float seed;
        uniform float uTime;
        uniform float uExcite;
        varying float vA;
        void main() {
          vec4 mv = modelViewMatrix * vec4(position, 1.0);
          float slot = floor(uTime * 7.0 + seed * 37.0);
          float r = fract(sin(slot * 12.9898 + seed * 78.233) * 43758.5453);
          vA = step(1.0 - (0.015 + 0.09 * uExcite), r);
          gl_PointSize = vA * min(12.0, 520.0 / -mv.z);
          gl_Position = projectionMatrix * mv;
        }`,
      fragmentShader: `
        varying float vA;
        void main() {
          float d = length(gl_PointCoord - 0.5);
          float a = vA * smoothstep(0.5, 0.0, d);
          if (a < 0.01) discard;
          gl_FragColor = vec4(1.0, 1.0, 0.94, a);
        }`,
    }));
    flashes.frustumCulled = false;
    scene.add(flashes);
  }

  // ---------- Torres de iluminação ----------
  const towerMat = new THREE.MeshLambertMaterial({ color: 0x3a3f47 });
  const panelMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
  const glowTex = (() => {
    const c = document.createElement('canvas');
    c.width = c.height = 128;
    const g = c.getContext('2d');
    const gr = g.createRadialGradient(64, 64, 0, 64, 64, 64);
    gr.addColorStop(0, 'rgba(255,255,240,1)');
    gr.addColorStop(0.2, 'rgba(255,250,220,0.6)');
    gr.addColorStop(1, 'rgba(255,250,220,0)');
    g.fillStyle = gr;
    g.fillRect(0, 0, 128, 128);
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    return t;
  })();
  for (const sx of [-1, 1]) {
    for (const sz of [-1, 1]) {
      const tx = sx * 70, tz = sz * 54;
      const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.6, 1.0, 42, 8), towerMat);
      pole.position.set(tx, 21, tz);
      scene.add(pole);
      const head = new THREE.Group();
      head.position.set(tx, 43, tz);
      head.lookAt(0, 0, 0);
      const frame = new THREE.Mesh(new THREE.BoxGeometry(9, 5, 0.6), towerMat);
      head.add(frame);
      const panel = new THREE.Mesh(new THREE.PlaneGeometry(8.4, 4.4), panelMat);
      panel.position.z = 0.31;
      head.add(panel);
      scene.add(head);
      const glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, blending: THREE.AdditiveBlending, depthWrite: false, fog: false }));
      glow.scale.set(34, 34, 1);
      glow.position.set(tx * 0.97, 43, tz * 0.97);
      scene.add(glow);
    }
  }

  // ---------- Ecrã gigante ----------
  const jc = document.createElement('canvas');
  jc.width = 768;
  jc.height = 320;
  const jtex = new THREE.CanvasTexture(jc);
  jtex.colorSpace = THREE.SRGBColorSpace;
  const jumbo = new THREE.Group();
  const jFrame = new THREE.Mesh(new THREE.BoxGeometry(26, 11.5, 1), towerMat);
  const jScreen = new THREE.Mesh(new THREE.PlaneGeometry(24.6, 10.25), new THREE.MeshBasicMaterial({ map: jtex, toneMapped: false }));
  jScreen.position.z = 0.51;
  jumbo.add(jFrame, jScreen);
  const jx = -(BOUNDS_X + 4 + rows * rowDepth + 1);
  jumbo.position.set(jx, 1.6 + rows * rowRise + 14, 0);
  jumbo.rotation.y = Math.PI / 2;
  scene.add(jumbo);
  const legs = new THREE.Mesh(new THREE.BoxGeometry(1, 16, 1), towerMat);
  legs.position.set(jx - 0.6, 1.6 + rows * rowRise + 2, 0);
  scene.add(legs);

  let jumboKey = '';
  function drawJumbo(info) {
    const key = JSON.stringify(info);
    if (key === jumboKey) return;
    jumboKey = key;
    const g = jc.getContext('2d');
    g.fillStyle = '#05070c';
    g.fillRect(0, 0, jc.width, jc.height);
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    if (info.mode === 'score') {
      g.fillStyle = '#fff';
      g.font = 'bold 54px "Arial Black", Impact, sans-serif';
      g.fillText('LEÕES FC  1 - 1  ÁGUIAS SC', 384, 110);
      g.fillStyle = '#ffd21f';
      g.font = 'bold 44px "Arial Black", Impact, sans-serif';
      g.fillText(info.clock || "67'", 384, 200);
    } else if (info.mode === 'invader') {
      g.fillStyle = '#ff2d55';
      g.font = 'bold 50px "Arial Black", Impact, sans-serif';
      g.fillText('⚠ INVASOR EM CAMPO ⚠', 384, 70);
      g.fillStyle = '#fff';
      g.font = 'bold 78px "Arial Black", Impact, sans-serif';
      g.fillText(info.time, 384, 170);
      g.fillStyle = '#ffd21f';
      g.font = 'bold 48px "Arial Black", Impact, sans-serif';
      g.fillText(`${info.xp} XP`, 384, 262);
    } else if (info.mode === 'big') {
      g.fillStyle = info.color || '#ffd21f';
      g.font = 'bold 120px "Arial Black", Impact, sans-serif';
      g.fillText(info.text, 384, 150);
      if (info.sub) {
        g.fillStyle = '#fff';
        g.font = 'bold 40px "Arial Black", Impact, sans-serif';
        g.fillText(info.sub, 384, 260);
      }
    }
    // Efeito de LED.
    g.fillStyle = 'rgba(0,0,0,0.22)';
    for (let y = 0; y < jc.height; y += 4) g.fillRect(0, y, jc.width, 1);
    jtex.needsUpdate = true;
  }
  drawJumbo({ mode: 'score' });

  function update(dt, time, excite, focus) {
    uniforms.uTime.value = time;
    uniforms.uExcite.value += (excite - uniforms.uExcite.value) * Math.min(1, dt * 2);
    for (const t of adTextures) t.offset.x = (t.offset.x + dt * 0.035) % 1;
    // A sombra acompanha o jogador para ficar nítida perto da câmara.
    key.target.position.set(focus.x, 0, focus.z);
    key.position.set(focus.x - 40, 60, focus.z - 30);
  }

  return { update, drawJumbo, colliders, setShadows(on) { key.castShadow = on; } };
}
