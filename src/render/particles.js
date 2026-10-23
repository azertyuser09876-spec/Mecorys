// Particules : poussière, éclats, vapeur, éclaboussures, spores, météo.
import { paletteColor } from '../world/regions.js';
import { css, scale } from '../core/color.js';

export class Particles {
  constructor() {
    this.list = [];
    this.weather = [];
  }

  add(p) {
    if (this.list.length > 900) this.list.shift();
    const o = Object.assign({ life: 1, vx: 0, vy: 0, g: 0, size: 1, drag: 0.98, alpha: 1 }, p);
    o.max = o.life;
    this.list.push(o);
  }

  dust(x, y, dir = 0, n = 3) {
    const c = paletteColor('sand', Math.floor(x / 16), Math.floor(y / 16));
    for (let i = 0; i < n; i++)
      this.add({
        x: x + (Math.random() - 0.5) * 8,
        y: y - Math.random() * 3,
        vx: dir * 20 + (Math.random() - 0.5) * 30,
        vy: -Math.random() * 18,
        g: 30,
        life: 0.5 + Math.random() * 0.5,
        size: 1 + Math.random() * 2,
        col: css(scale(c, 1.1), 0.7),
        drag: 0.94,
      });
  }

  chips(x, y, mat, tx, ty) {
    const c = paletteColor(mat === 'plant' ? 'plant' : mat, tx, ty);
    for (let i = 0; i < 3; i++)
      this.add({
        x,
        y,
        vx: (Math.random() - 0.5) * 90,
        vy: -30 - Math.random() * 60,
        g: 420,
        life: 0.4 + Math.random() * 0.4,
        size: 1 + Math.floor(Math.random() * 2),
        col: css(scale(c, 0.9 + Math.random() * 0.3)),
      });
  }

  burst(x, y, mat, tx, ty, n = 10) {
    const c = paletteColor(mat === 'plant' ? 'plant' : mat, tx, ty);
    for (let i = 0; i < n; i++)
      this.add({
        x: x + (Math.random() - 0.5) * 12,
        y: y + (Math.random() - 0.5) * 12,
        vx: (Math.random() - 0.5) * 120,
        vy: -40 - Math.random() * 90,
        g: 420,
        life: 0.5 + Math.random() * 0.6,
        size: 1 + Math.floor(Math.random() * 3),
        col: css(scale(c, 0.8 + Math.random() * 0.4)),
      });
  }

  splash(x, y) {
    for (let i = 0; i < 10; i++)
      this.add({
        x: x + (Math.random() - 0.5) * 10,
        y,
        vx: (Math.random() - 0.5) * 80,
        vy: -60 - Math.random() * 80,
        g: 400,
        life: 0.5 + Math.random() * 0.3,
        size: 1 + Math.random(),
        col: 'rgba(200,225,235,0.8)',
      });
  }

  steam(x, y, n = 1, big = 1) {
    for (let i = 0; i < n; i++)
      this.add({
        x: x + (Math.random() - 0.5) * 6 * big,
        y,
        vx: (Math.random() - 0.5) * 12,
        vy: -20 - Math.random() * 25,
        g: -8,
        life: 1.2 + Math.random() * 1.2,
        size: (3 + Math.random() * 4) * big,
        col: 'rgba(235,235,230,0.22)',
        grow: 6 * big,
        drag: 0.985,
        soft: true,
      });
  }

  sparks(x, y, n = 6) {
    for (let i = 0; i < n; i++)
      this.add({
        x,
        y,
        vx: (Math.random() - 0.5) * 140,
        vy: -Math.random() * 120,
        g: 300,
        life: 0.25 + Math.random() * 0.3,
        size: 1,
        col: 'rgba(255,210,120,1)',
        glow: true,
      });
  }

  motes(x, y, col, n = 1) {
    for (let i = 0; i < n; i++)
      this.add({
        x: x + (Math.random() - 0.5) * 20,
        y: y + (Math.random() - 0.5) * 20,
        vx: (Math.random() - 0.5) * 10,
        vy: -5 - Math.random() * 10,
        g: -2,
        life: 1.5 + Math.random() * 1.5,
        size: 1,
        col,
        glow: true,
        drag: 0.99,
      });
  }

  update(dt) {
    const L = this.list;
    for (let i = L.length - 1; i >= 0; i--) {
      const p = L[i];
      p.life -= dt;
      if (p.life <= 0) {
        L.splice(i, 1);
        continue;
      }
      p.vy += p.g * dt;
      p.vx *= p.drag;
      p.vy *= p.drag;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      if (p.grow) p.size += p.grow * dt;
    }
  }

  draw(g) {
    for (const p of this.list) {
      const a = Math.min(1, p.life / Math.min(0.4, p.max || 0.4));
      g.globalAlpha = a;
      g.fillStyle = p.col;
      if (p.soft) {
        g.beginPath();
        g.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        g.fill();
      } else g.fillRect(p.x - p.size / 2, p.y - p.size / 2, p.size, p.size);
    }
    g.globalAlpha = 1;
  }
}

// Météo d'ambiance, dessinée en coordonnées écran.
export class Weather {
  constructor() {
    this.parts = [];
    this.kind = 'dust';
    this.intensity = 1;
  }

  update(dt, kind, wind, vw, vh, camDX, camDY) {
    this.kind = kind;
    const want = kind === 'none' ? 0 : kind === 'mist' ? 26 : kind === 'drips' ? 30 : 70;
    while (this.parts.length < want * this.intensity) this.parts.push(this.spawn(vw, vh, true));
    if (this.parts.length > want * this.intensity) this.parts.length = Math.floor(want * this.intensity);
    for (const p of this.parts) {
      p.x += (p.vx + wind * p.k * 30) * dt - camDX * p.k;
      p.y += p.vy * dt - camDY * p.k;
      p.ph += dt;
      if (p.x < -40 || p.x > vw + 40 || p.y < -40 || p.y > vh + 40) Object.assign(p, this.spawn(vw, vh, false, p));
    }
  }

  spawn(vw, vh, anywhere, p = {}) {
    const k = 0.4 + Math.random() * 0.8;
    const o = { k, ph: Math.random() * 10 };
    switch (this.kind) {
      case 'dust':
        Object.assign(o, { vx: 20 + Math.random() * 30, vy: (Math.random() - 0.5) * 6, size: k > 1 ? 2 : 1 });
        break;
      case 'ash':
        Object.assign(o, { vx: 6 + Math.random() * 10, vy: 8 + Math.random() * 10, size: 1 + (k > 0.9 ? 1 : 0) });
        break;
      case 'spores':
        Object.assign(o, { vx: (Math.random() - 0.5) * 8, vy: -4 - Math.random() * 6, size: k > 0.9 ? 2 : 1 });
        break;
      case 'motes':
        Object.assign(o, { vx: (Math.random() - 0.5) * 6, vy: -3 - Math.random() * 4, size: 1 });
        break;
      case 'mist':
        Object.assign(o, { vx: 4 + Math.random() * 6, vy: 0, size: 40 + Math.random() * 60 });
        break;
      case 'drips':
        Object.assign(o, { vx: 0, vy: 160 + Math.random() * 80, size: 1 });
        break;
      default:
        Object.assign(o, { vx: 0, vy: 0, size: 1 });
    }
    if (anywhere) {
      o.x = Math.random() * vw;
      o.y = Math.random() * vh;
    } else if (this.kind === 'drips') {
      o.x = Math.random() * vw;
      o.y = -10;
    } else if (o.vx > 0) {
      o.x = -20;
      o.y = Math.random() * vh;
    } else {
      o.x = Math.random() * vw;
      o.y = o.vy < 0 ? vh + 10 : -10;
    }
    return Object.assign(p, o);
  }

  draw(g, light, tint) {
    if (!this.parts.length) return;
    const a = 0.25 + 0.5 * light;
    for (const p of this.parts) {
      switch (this.kind) {
        case 'mist': {
          g.fillStyle = `rgba(${tint},${(0.035 * a).toFixed(3)})`;
          g.beginPath();
          g.ellipse(p.x, p.y, p.size, p.size * 0.35, 0, 0, Math.PI * 2);
          g.fill();
          break;
        }
        case 'drips':
          g.fillStyle = `rgba(170,200,200,${(0.35 * a).toFixed(3)})`;
          g.fillRect(p.x, p.y, 1, 3);
          break;
        case 'spores':
        case 'motes':
          g.fillStyle = `rgba(${this.kind === 'spores' ? '230,210,170' : '255,230,170'},${(0.5 * a * (0.6 + 0.4 * Math.sin(p.ph * 2))).toFixed(3)})`;
          g.fillRect(p.x + Math.sin(p.ph) * 3, p.y, p.size, p.size);
          break;
        case 'ash':
          g.fillStyle = `rgba(200,195,185,${(0.4 * a).toFixed(3)})`;
          g.fillRect(p.x + Math.sin(p.ph * 1.5) * 4, p.y, p.size, p.size);
          break;
        default:
          g.fillStyle = `rgba(${tint},${(0.28 * a).toFixed(3)})`;
          g.fillRect(p.x, p.y, p.size * 2, p.size);
      }
    }
  }
}
