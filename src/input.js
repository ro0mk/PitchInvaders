// Teclado, rato (pointer lock) e comando (Gamepad API).

const PREVENT = new Set([
  'Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Tab',
]);

export const BINDINGS = {
  jump: ['Space', 'PadA'],
  slide: ['KeyC', 'PadB'],
  spin: ['KeyF', 'Mouse2', 'PadX'],
  jukeL: ['KeyQ', 'PadLB'],
  jukeR: ['KeyE', 'PadRB'],
  sprint: ['ShiftLeft', 'ShiftRight', 'PadRT', 'PadL3'],
  selfie: ['KeyT', 'PadY'],
  pause: ['Escape', 'KeyP', 'PadStart'],
  confirm: ['Enter', 'NumpadEnter', 'PadA'],
  restart: ['KeyR', 'Enter', 'NumpadEnter', 'PadStart'],
  struggle: ['Space', 'KeyA', 'KeyD', 'ArrowLeft', 'ArrowRight', 'PadA', 'PadB', 'PadX'],
};

const PAD_BUTTONS = {
  0: 'PadA', 1: 'PadB', 2: 'PadX', 3: 'PadY', 4: 'PadLB', 5: 'PadRB',
  6: 'PadLT', 7: 'PadRT', 9: 'PadStart', 10: 'PadL3',
  12: 'PadUp', 13: 'PadDown', 14: 'PadLeft', 15: 'PadRight',
};

export class Input {
  constructor(dom) {
    this.dom = dom;
    this.down = new Set();
    this.pressed = new Set();
    this.mouseDX = 0;
    this.mouseDY = 0;
    this.locked = false;
    this.lastMouseMove = -1e9;
    this.padMove = { x: 0, y: 0 };
    this.padLook = { x: 0, y: 0 };
    this.padPrev = new Set();
    this.usingPad = false;
    this.onLockChange = null;

    window.addEventListener('keydown', (e) => {
      if (PREVENT.has(e.code)) e.preventDefault();
      if (!e.repeat) this.pressed.add(e.code);
      this.down.add(e.code);
      this.usingPad = false;
    });
    window.addEventListener('keyup', (e) => this.down.delete(e.code));
    window.addEventListener('blur', () => this.down.clear());
    document.addEventListener('mousemove', (e) => {
      if (!this.locked) return;
      // Alguns browsers enviam saltos enormes ao (re)entrar em pointer lock.
      if (Math.abs(e.movementX) > 300 || Math.abs(e.movementY) > 300) return;
      this.mouseDX += e.movementX;
      this.mouseDY += e.movementY;
      this.lastMouseMove = performance.now();
    });
    dom.addEventListener('mousedown', (e) => {
      this.pressed.add('Mouse' + e.button);
      this.down.add('Mouse' + e.button);
    });
    window.addEventListener('mouseup', (e) => this.down.delete('Mouse' + e.button));
    dom.addEventListener('contextmenu', (e) => e.preventDefault());
    document.addEventListener('pointerlockchange', () => {
      this.locked = document.pointerLockElement === dom;
      if (this.onLockChange) this.onLockChange(this.locked);
    });
  }

  requestLock() {
    if (this.locked || !this.dom.requestPointerLock) return;
    try {
      const p = this.dom.requestPointerLock();
      if (p && p.catch) p.catch(() => {});
    } catch (_) { /* sem pointer lock: joga-se só com teclado */ }
  }

  releaseLock() {
    if (document.pointerLockElement) document.exitPointerLock();
  }

  pollGamepad() {
    const pads = navigator.getGamepads ? navigator.getGamepads() : [];
    let pad = null;
    for (const p of pads) if (p && p.connected) { pad = p; break; }
    const now = new Set();
    this.padMove.x = this.padMove.y = this.padLook.x = this.padLook.y = 0;
    if (pad) {
      const dz = (v) => (Math.abs(v) < 0.18 ? 0 : (v - Math.sign(v) * 0.18) / 0.82);
      this.padMove.x = dz(pad.axes[0] || 0);
      this.padMove.y = dz(pad.axes[1] || 0);
      this.padLook.x = dz(pad.axes[2] || 0);
      this.padLook.y = dz(pad.axes[3] || 0);
      pad.buttons.forEach((b, i) => {
        const name = PAD_BUTTONS[i];
        if (name && (b.pressed || b.value > 0.4)) now.add(name);
      });
      if (now.size || Math.hypot(this.padMove.x, this.padMove.y) > 0) this.usingPad = true;
    }
    for (const name of now) {
      if (!this.padPrev.has(name)) this.pressed.add(name);
      this.down.add(name);
    }
    for (const name of this.padPrev) if (!now.has(name)) this.down.delete(name);
    this.padPrev = now;
  }

  isDown(action) {
    return BINDINGS[action].some((c) => this.down.has(c));
  }

  wasPressed(action) {
    return BINDINGS[action].some((c) => this.pressed.has(c));
  }

  // Vetor de movimento: x = direita, y = frente.
  moveVector() {
    let x = 0, y = 0;
    if (this.down.has('KeyW') || this.down.has('ArrowUp')) y += 1;
    if (this.down.has('KeyS') || this.down.has('ArrowDown')) y -= 1;
    if (this.down.has('KeyD')) x += 1;
    if (this.down.has('KeyA')) x -= 1;
    x += this.padMove.x;
    y -= this.padMove.y;
    const len = Math.hypot(x, y);
    if (len > 1) { x /= len; y /= len; }
    return { x, y };
  }

  // Rotação da câmara por teclado (setas esquerda/direita) e stick direito.
  lookKeys() {
    let x = 0;
    if (this.down.has('ArrowLeft')) x -= 1;
    if (this.down.has('ArrowRight')) x += 1;
    return { x: x + this.padLook.x, y: this.padLook.y };
  }

  consumeMouse() {
    const d = { x: this.mouseDX, y: this.mouseDY };
    this.mouseDX = this.mouseDY = 0;
    return d;
  }

  endFrame() {
    this.pressed.clear();
  }
}
