// Clavier (positions physiques, donc ZQSD sur AZERTY et WASD sur QWERTY) et souris.

const ACTIONS = {
  left: ['KeyA', 'ArrowLeft'],
  right: ['KeyD', 'ArrowRight'],
  up: ['KeyW', 'ArrowUp'],
  down: ['KeyS', 'ArrowDown'],
  jump: ['Space'],
  run: ['ShiftLeft', 'ShiftRight'],
  interact: ['KeyE'],
  build: ['KeyB'],
  orders: ['KeyR'],
  machine: ['KeyF'],
  map: ['Semicolon', 'KeyM', 'Tab'],
  journal: ['KeyJ', 'KeyI'],
  pause: ['Escape'],
  zoomIn: ['Equal', 'NumpadAdd'],
  zoomOut: ['Minus', 'NumpadSubtract'],
  lantern: ['KeyL'],
  confirm: ['Enter', 'NumpadEnter'],
  rotate: ['KeyX'],
  debug: ['F3'],
};

export class Input {
  constructor(target) {
    this.down = new Set();
    this.pressed = new Set();
    this.released = new Set();
    this.mouse = { x: 0, y: 0, sx: 0, sy: 0, left: false, right: false, leftPressed: false, rightPressed: false, wheel: 0, inCanvas: false };
    this.enabled = true;
    this.layout = null;
    this.target = target;
    this.anyKeyHandlers = [];

    window.addEventListener('keydown', (e) => {
      if (e.code === 'Tab' || e.code === 'Space' || e.code.startsWith('Arrow')) {
        if (!isTyping(e)) e.preventDefault();
      }
      if (isTyping(e)) return;
      if (!this.down.has(e.code)) this.pressed.add(e.code);
      this.down.add(e.code);
      for (const h of this.anyKeyHandlers) h(e);
    });
    window.addEventListener('keyup', (e) => {
      this.down.delete(e.code);
      this.released.add(e.code);
    });
    window.addEventListener('blur', () => {
      this.down.clear();
      this.mouse.left = this.mouse.right = false;
    });
    target.addEventListener('mousemove', (e) => this.onMouse(e));
    target.addEventListener('mousedown', (e) => {
      this.onMouse(e);
      if (e.button === 0) {
        this.mouse.left = true;
        this.mouse.leftPressed = true;
      }
      if (e.button === 2) {
        this.mouse.right = true;
        this.mouse.rightPressed = true;
      }
    });
    window.addEventListener('mouseup', (e) => {
      if (e.button === 0) this.mouse.left = false;
      if (e.button === 2) this.mouse.right = false;
    });
    target.addEventListener('contextmenu', (e) => e.preventDefault());
    target.addEventListener(
      'wheel',
      (e) => {
        this.mouse.wheel += Math.sign(e.deltaY);
        e.preventDefault();
      },
      { passive: false },
    );
    target.addEventListener('mouseenter', () => (this.mouse.inCanvas = true));
    target.addEventListener('mouseleave', () => (this.mouse.inCanvas = false));

    // Libellés des touches selon la disposition réelle du clavier (Chrome).
    if (navigator.keyboard && navigator.keyboard.getLayoutMap) {
      navigator.keyboard
        .getLayoutMap()
        .then((m) => (this.layout = m))
        .catch(() => {});
    }
  }

  onMouse(e) {
    const r = this.target.getBoundingClientRect();
    this.mouse.sx = e.clientX - r.left;
    this.mouse.sy = e.clientY - r.top;
    this.mouse.inCanvas = true;
  }

  is(action) {
    if (!this.enabled) return false;
    for (const c of ACTIONS[action]) if (this.down.has(c)) return true;
    return false;
  }
  hit(action) {
    if (!this.enabled) return false;
    for (const c of ACTIONS[action]) if (this.pressed.has(c)) return true;
    return false;
  }
  // Touche appuyée même si les entrées de jeu sont désactivées (menus).
  hitRaw(action) {
    for (const c of ACTIONS[action]) if (this.pressed.has(c)) return true;
    return false;
  }
  keyHit(code) {
    return this.pressed.has(code);
  }

  label(action) {
    if (FIXED[action]) return FIXED[action];
    const code = ACTIONS[action][0];
    return codeLabel(code, this.layout);
  }

  endFrame() {
    this.pressed.clear();
    this.released.clear();
    this.mouse.leftPressed = false;
    this.mouse.rightPressed = false;
    this.mouse.wheel = 0;
  }
}

function isTyping(e) {
  const t = e.target;
  return t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable);
}

const NAMES = {
  Space: 'Espace',
  ShiftLeft: 'Maj',
  ShiftRight: 'Maj',
  Escape: 'Échap',
  Tab: 'Tab',
  Enter: 'Entrée',
  ArrowLeft: '←',
  ArrowRight: '→',
  ArrowUp: '↑',
  ArrowDown: '↓',
  F3: 'F3',
  Equal: '+',
  Minus: '-',
};

// Par défaut on suppose un clavier AZERTY (jeu en français) tant que la disposition est inconnue.
const AZERTY = { KeyA: 'Q', KeyW: 'Z', KeyQ: 'A', KeyZ: 'W', KeyM: ',', Semicolon: 'M' };
const FIXED = { map: 'M' };

export function codeLabel(code, layout) {
  if (NAMES[code]) return NAMES[code];
  if (layout && layout.get(code)) return layout.get(code).toUpperCase();
  if (AZERTY[code]) return AZERTY[code];
  if (code.startsWith('Key')) return code.slice(3);
  if (code.startsWith('Digit')) return code.slice(5);
  return code;
}
