// Paysages lointains en parallaxe, générés procéduralement et mis en cache par bandes.
import { REGIONS, regionAt } from '../world/regions.js';
import { TILE } from '../world/tiles.js';
import { fbm1, noise1, hash1, hash2, RNG, clamp, smoothstep } from '../core/rng.js';
import { css, mix, scale } from '../core/color.js';
import { makeCanvas, ctx2d } from './canvas.js';

export const HORIZON = 118 * TILE; // hauteur de référence du sol du désert
const STRIP = 512;
const LH = 520; // hauteur d'une bande
const BASE = LH - 70; // ligne de base dans la bande
const VW = 960;

const LAYERS = [
  { p: 0.05, key: 'far', haze: 0.55, py: 0.03, amp: 1.0 },
  { p: 0.14, key: 'mid', haze: 0.32, py: 0.08, amp: 0.8 },
  { p: 0.3, key: 'near', haze: 0.12, py: 0.16, amp: 0.6 },
];

function worldTxFromLayer(lx, p) {
  return ((lx - VW / 2) / p + VW / 2) / TILE;
}

// Poids des régions autour d'une position, pour adoucir les transitions.
function regionWeights(tx) {
  const W = 50;
  const r = regionAt(tx, 0);
  const i = REGIONS.indexOf(r);
  if (i > 0 && tx - r.x0 < W) {
    const t = 0.5 + (0.5 * (tx - r.x0)) / W;
    return [
      [REGIONS[i - 1], 1 - t],
      [r, t],
    ];
  }
  if (i < REGIONS.length - 1 && r.x1 - tx < W) {
    const t = 0.5 + (0.5 * (r.x1 - tx)) / W;
    return [
      [r, t],
      [REGIONS[i + 1], 1 - t],
    ];
  }
  return [[r, 1]];
}

function blendedColor(key, tx) {
  let c = [0, 0, 0];
  for (const [r, w] of regionWeights(tx)) {
    const k = r.pal[key];
    c = [c[0] + k[0] * w, c[1] + k[1] * w, c[2] + k[2] * w];
  }
  return c;
}

// Hauteur des reliefs selon la région et la couche.
function ridgeFor(region, li, lx) {
  const s = li * 1000;
  switch (region.id) {
    case 'desert': {
      if (li === 0) {
        // mesas lointaines : plateaux plats
        const n = fbm1(lx / 260, 11 + s, 3);
        const mesa = smoothstep(0.52, 0.6, n) * 90;
        return 18 + fbm1(lx / 90, 3 + s, 2) * 30 + mesa;
      }
      return 14 + Math.sin(lx / (140 + li * 30)) * 14 + fbm1(lx / 120, 5 + s, 3) * 50;
    }
    case 'fonderie':
      return 26 + fbm1(lx / 160, 21 + s, 3) * (li === 0 ? 70 : 40);
    case 'reservoir': {
      const m = fbm1(lx / 200, 31 + s, 4);
      return 30 + m * (li === 0 ? 170 : li === 1 ? 90 : 40);
    }
    case 'vallee': {
      const m = fbm1(lx / 170, 41 + s, 5);
      const peaks = Math.pow(m, 1.7) * (li === 0 ? 420 : li === 1 ? 260 : 110);
      return 30 + peaks;
    }
    case 'serre':
      return 24 + fbm1(lx / 130, 51 + s, 3) * (li === 0 ? 120 : 60);
    case 'abime': {
      const c = fbm1(lx / 110, 61 + s, 4);
      return 40 + Math.pow(c, 2) * (li === 0 ? 300 : 200);
    }
    default:
      return 30 + fbm1(lx / 150, 71 + s, 3) * (li === 0 ? 160 : 70);
  }
}

function ridgeHeight(li, lx, p) {
  const tx = worldTxFromLayer(lx, p);
  let h = 0;
  for (const [r, w] of regionWeights(tx)) h += ridgeFor(r, li, lx) * w;
  return h * LAYERS[li].amp + 10;
}

// --- Éléments architecturaux lointains -------------------------------------------

function drawTower(g, x, base, w, h, col, rng) {
  g.fillStyle = css(col);
  const taper = w * 0.18;
  g.beginPath();
  g.moveTo(x - w / 2, base);
  g.lineTo(x - w / 2 + taper, base - h);
  g.lineTo(x + w / 2 - taper, base - h);
  g.lineTo(x + w / 2, base);
  g.fill();
  // couronne
  g.fillRect(x - w / 2 + taper - 3, base - h - 6, w - 2 * taper + 6, 6);
  if (rng.chance(0.5)) g.fillRect(x - 1, base - h - 28, 2, 24);
  // meurtrières éclairées par le ciel
  g.fillStyle = css(scale(col, 1.12));
  for (let k = 0; k < 4; k++) g.fillRect(x - w / 2 + taper + 2, base - h + 12 + k * 18, 2, 7);
}

function drawChimney(g, x, base, w, h, col) {
  g.fillStyle = css(col);
  g.fillRect(x - w / 2, base - h, w, h);
  g.fillRect(x - w / 2 - 2, base - h, w + 4, 5);
  g.fillStyle = css(scale(col, 0.88));
  for (let y = base - h + 18; y < base; y += 26) g.fillRect(x - w / 2, y, w, 3);
}

function drawHall(g, x, base, w, h, col) {
  g.fillStyle = css(col);
  g.fillRect(x, base - h, w, h);
  // toit en dents de scie
  const teeth = Math.max(2, Math.floor(w / 22));
  const tw = w / teeth;
  g.beginPath();
  for (let k = 0; k < teeth; k++) {
    g.moveTo(x + k * tw, base - h);
    g.lineTo(x + k * tw, base - h - 14);
    g.lineTo(x + (k + 1) * tw, base - h);
  }
  g.fill();
  g.fillStyle = css(scale(col, 1.14));
  for (let k = 0; k < teeth; k++) g.fillRect(x + k * tw + 1, base - h - 12, 1, 11);
  // fenêtres brisées
  g.fillStyle = css(scale(col, 0.82));
  for (let wx = x + 6; wx < x + w - 8; wx += 12) g.fillRect(wx, base - h + 10, 6, 10);
}

function drawCrane(g, x, base, h, col, dir) {
  g.strokeStyle = css(col);
  g.lineWidth = 2;
  g.beginPath();
  g.moveTo(x - 4, base);
  g.lineTo(x - 2, base - h);
  g.moveTo(x + 4, base);
  g.lineTo(x + 2, base - h);
  for (let y = base; y > base - h; y -= 10) {
    g.moveTo(x - 4, y);
    g.lineTo(x + 4, y - 10);
  }
  g.moveTo(x, base - h);
  g.lineTo(x + dir * h * 0.7, base - h + 4);
  g.moveTo(x, base - h - 10);
  g.lineTo(x + dir * h * 0.7, base - h + 4);
  g.moveTo(x + dir * h * 0.55, base - h + 3);
  g.lineTo(x + dir * h * 0.55, base - h * 0.4);
  g.stroke();
  g.fillStyle = css(col);
  g.fillRect(x + dir * h * 0.55 - 4, base - h * 0.4, 8, 6);
}

function drawArches(g, x, base, w, h, col) {
  g.fillStyle = css(col);
  g.fillRect(x, base - h, w, 10);
  const n = Math.max(2, Math.floor(w / 40));
  const aw = w / n;
  for (let k = 0; k <= n; k++) g.fillRect(x + k * aw - 4, base - h, 8, h);
  g.beginPath();
  for (let k = 0; k < n; k++) {
    const ax = x + k * aw;
    g.moveTo(ax, base - h + 10);
    g.quadraticCurveTo(ax + aw / 2, base - h + 40, ax + aw, base - h + 10);
  }
  g.lineTo(x + w, base - h + 10);
  g.fill();
}

function drawGiantPipe(g, x, base, w, y, col) {
  g.fillStyle = css(col);
  g.fillRect(x, y, w, 18);
  g.fillStyle = css(scale(col, 1.12));
  g.fillRect(x, y + 3, w, 3);
  g.fillStyle = css(col);
  for (let k = x + 20; k < x + w; k += 90) {
    g.fillRect(k, y - 3, 6, 24);
    g.fillRect(k - 2, y + 18, 10, base - y - 18);
  }
}

function drawDome(g, x, base, r, col) {
  g.fillStyle = css(col);
  g.beginPath();
  g.ellipse(x, base, r, r * 0.8, 0, Math.PI, 0);
  g.fill();
  g.strokeStyle = css(scale(col, 1.12));
  g.lineWidth = 1;
  for (let k = 1; k < 5; k++) {
    g.beginPath();
    g.ellipse(x, base, (r * k) / 5, r * 0.8, 0, Math.PI, 0);
    g.stroke();
  }
}

function drawOrganicTower(g, x, base, w, h, col, rng) {
  g.fillStyle = css(col);
  g.beginPath();
  g.moveTo(x - w / 2, base);
  let y = base;
  const seg = 5;
  for (let k = 0; k < seg; k++) {
    const yy = base - (h * (k + 1)) / seg;
    const bulge = w * (0.4 + rng.next() * 0.5);
    g.quadraticCurveTo(x - bulge, (y + yy) / 2, x - w * 0.2, yy);
    y = yy;
  }
  g.quadraticCurveTo(x, base - h - w * 0.6, x + w * 0.2, base - h);
  y = base - h;
  for (let k = seg - 1; k >= 0; k--) {
    const yy = base - (h * k) / seg;
    const bulge = w * (0.4 + rng.next() * 0.5);
    g.quadraticCurveTo(x + bulge, (y + yy) / 2, x + (k === 0 ? w / 2 : w * 0.2), yy);
    y = yy;
  }
  g.fill();
}

function drawRibs(g, x, base, w, h, col) {
  // squelette de colosse : côtes arquées
  g.strokeStyle = css(col);
  g.lineCap = 'round';
  const n = 6;
  for (let k = 0; k < n; k++) {
    const rx = x + (k / (n - 1)) * w;
    g.lineWidth = 5 - k * 0.4;
    g.beginPath();
    g.moveTo(rx, base);
    g.quadraticCurveTo(rx - 20, base - h, rx + w * 0.25, base - h * 1.05);
    g.stroke();
  }
  g.lineWidth = 7;
  g.beginPath();
  g.moveTo(x - 10, base - h * 1.0);
  g.quadraticCurveTo(x + w * 0.5, base - h * 1.25, x + w + 30, base - h * 0.95);
  g.stroke();
  g.lineCap = 'butt';
}

// Silhouette d'un colosse lointain, debout ou agenouillé.
function drawColossusSilhouette(g, x, base, h, col, kneel, rng) {
  g.fillStyle = css(col);
  const w = h * 0.55;
  const bodyY = base - h * (kneel ? 0.55 : 0.75);
  // jambes
  g.beginPath();
  if (kneel) {
    g.moveTo(x - w * 0.4, base);
    g.lineTo(x - w * 0.3, base - h * 0.25);
    g.lineTo(x + w * 0.1, base - h * 0.2);
    g.lineTo(x + w * 0.25, base);
  } else {
    g.moveTo(x - w * 0.35, base);
    g.lineTo(x - w * 0.25, bodyY);
    g.lineTo(x - w * 0.1, bodyY);
    g.lineTo(x - w * 0.18, base);
    g.moveTo(x + w * 0.18, base);
    g.lineTo(x + w * 0.1, bodyY);
    g.lineTo(x + w * 0.25, bodyY);
    g.lineTo(x + w * 0.35, base);
  }
  g.fill();
  // torse massif
  g.beginPath();
  g.moveTo(x - w * 0.4, bodyY + 6);
  g.lineTo(x - w * 0.48, bodyY - h * 0.28);
  g.lineTo(x - w * 0.2, bodyY - h * 0.38);
  g.lineTo(x + w * 0.25, bodyY - h * 0.36);
  g.lineTo(x + w * 0.45, bodyY - h * 0.22);
  g.lineTo(x + w * 0.38, bodyY + 6);
  g.fill();
  // tête basse
  g.fillRect(x + w * 0.05, bodyY - h * 0.45, w * 0.22, h * 0.1);
  // bras pendants
  g.fillRect(x - w * 0.56, bodyY - h * 0.25, w * 0.1, h * 0.42);
  g.fillRect(x + w * 0.44, bodyY - h * 0.2, w * 0.1, h * 0.38);
  // cheminées dorsales
  g.fillRect(x - w * 0.15, bodyY - h * 0.48, 3, h * 0.12);
  g.fillRect(x - w * 0.05, bodyY - h * 0.46, 2, h * 0.1);
  g.fillStyle = css(scale(col, 1.1));
  g.fillRect(x - w * 0.47, bodyY - h * 0.27, 2, h * 0.3);
}

function drawMegaBridge(g, x, w, y, col) {
  // structure traversant les montagnes
  g.fillStyle = css(col);
  g.fillRect(x, y, w, 12);
  g.fillRect(x, y + 12, w, 3);
  g.fillStyle = css(scale(col, 0.9));
  for (let k = x; k < x + w; k += 34) g.fillRect(k, y + 15, 4, 10);
  g.fillStyle = css(scale(col, 1.1));
  g.fillRect(x, y, w, 2);
}

function drawHeartTree(g, x, base, h, col) {
  g.fillStyle = css(col);
  // tronc-machine
  g.beginPath();
  g.moveTo(x - 60, base);
  g.quadraticCurveTo(x - 20, base - h * 0.4, x - 24, base - h * 0.7);
  g.lineTo(x + 24, base - h * 0.7);
  g.quadraticCurveTo(x + 20, base - h * 0.4, x + 60, base);
  g.fill();
  // couronne de conduites
  for (let k = -4; k <= 4; k++) {
    g.lineWidth = 6 - Math.abs(k);
    g.strokeStyle = css(col);
    g.beginPath();
    g.moveTo(x + k * 3, base - h * 0.68);
    g.quadraticCurveTo(x + k * 30, base - h * 1.0, x + k * 46, base - h * 0.8 + Math.abs(k) * 12);
    g.stroke();
  }
  g.beginPath();
  g.ellipse(x, base - h * 0.78, 36, 26, 0, 0, Math.PI * 2);
  g.fill();
}

// Génère les éléments d'une cellule de 160 px de couche.
const CELL = 160;
function cellFeatures(li, c, p) {
  const lx = c * CELL + hash1(c, 900 + li) * CELL;
  const tx = worldTxFromLayer(lx, p);
  const region = regionAt(Math.max(0, tx), 0);
  const rng = new RNG(Math.floor(hash2(c, li, 77) * 1e9));
  const out = [];
  const roll = rng.next();
  const id = region.id;
  if (id === 'desert') {
    if (li === 0 && roll < 0.1) out.push({ t: 'colossus', x: lx, h: rng.range(160, 230), kneel: rng.chance(0.5) });
    else if (roll < 0.35) out.push({ t: 'tower', x: lx, w: rng.range(14, 30), h: rng.range(60, 160) * (li === 0 ? 0.8 : 1) });
    else if (li > 0 && roll < 0.5) out.push({ t: 'arches', x: lx, w: rng.range(80, 200), h: rng.range(30, 70) });
  } else if (id === 'fonderie') {
    if (roll < 0.35) out.push({ t: 'chimney', x: lx, w: rng.range(10, 20), h: rng.range(90, 200) });
    if (rng.next() < 0.45) out.push({ t: 'hall', x: lx - 40, w: rng.range(70, 170), h: rng.range(30, 70) });
    if (li > 0 && rng.next() < 0.25) out.push({ t: 'crane', x: lx + 30, h: rng.range(70, 130), dir: rng.chance(0.5) ? 1 : -1 });
  } else if (id === 'reservoir') {
    if (roll < 0.3) out.push({ t: 'arches', x: lx, w: rng.range(120, 260), h: rng.range(60, 120) });
    else if (roll < 0.5) out.push({ t: 'pipe', x: lx, w: rng.range(150, 300), y: -rng.range(40, 110) });
    else if (roll < 0.65) out.push({ t: 'tower', x: lx, w: rng.range(20, 30), h: rng.range(70, 120) });
  } else if (id === 'vallee') {
    if (li === 0 && roll < 0.3) out.push({ t: 'bridge', x: lx - 100, w: rng.range(300, 600), y: -rng.range(200, 320) });
    else if (li === 0 && roll < 0.42) out.push({ t: 'colossus', x: lx, h: rng.range(220, 320), kneel: false });
    else if (roll < 0.55) out.push({ t: 'ribs', x: lx, w: rng.range(80, 180), h: rng.range(50, 110) });
    else if (roll < 0.7) out.push({ t: 'tower', x: lx, w: rng.range(18, 34), h: rng.range(80, 200) });
  } else if (id === 'serre') {
    if (roll < 0.3) out.push({ t: 'dome', x: lx, r: rng.range(40, 110) });
    else if (roll < 0.6) out.push({ t: 'organic', x: lx, w: rng.range(20, 40), h: rng.range(90, 220) });
  } else if (id === 'abime') {
    if (roll < 0.2) out.push({ t: 'tower', x: lx, w: rng.range(16, 26), h: rng.range(60, 140) });
    else if (li < 2 && roll < 0.32) out.push({ t: 'bridge', x: lx - 60, w: rng.range(120, 260), y: -rng.range(120, 240) });
  } else if (id === 'coeur') {
    if (li === 0 && c % 9 === 0) out.push({ t: 'heart', x: lx, h: 360 });
    else if (roll < 0.35) out.push({ t: 'organic', x: lx, w: rng.range(18, 30), h: rng.range(60, 140) });
  }
  for (const f of out) f.tx = tx;
  return { feats: out, rng };
}

function drawFeature(g, f, base, col, rng) {
  switch (f.t) {
    case 'tower':
      drawTower(g, f.x, base, f.w, f.h, col, rng);
      break;
    case 'chimney':
      drawChimney(g, f.x, base, f.w, f.h, col);
      break;
    case 'hall':
      drawHall(g, f.x, base, f.w, f.h, col);
      break;
    case 'crane':
      drawCrane(g, f.x, base, f.h, col, f.dir);
      break;
    case 'arches':
      drawArches(g, f.x, base, f.w, f.h, col);
      break;
    case 'pipe':
      drawGiantPipe(g, f.x, base, f.w, base + f.y, col);
      break;
    case 'dome':
      drawDome(g, f.x, base, f.r, col);
      break;
    case 'organic':
      drawOrganicTower(g, f.x, base, f.w, f.h, col, rng);
      break;
    case 'ribs':
      drawRibs(g, f.x, base, f.w, f.h, col);
      break;
    case 'colossus':
      drawColossusSilhouette(g, f.x, base, f.h, col, f.kneel, rng);
      break;
    case 'bridge':
      drawMegaBridge(g, f.x, f.w, base + f.y, col);
      break;
    case 'heart':
      drawHeartTree(g, f.x, base, f.h, col);
      break;
  }
}

export class Backdrop {
  constructor() {
    this.cache = new Map();
    this.order = [];
  }

  strip(li, k) {
    const key = li + ':' + k;
    let s = this.cache.get(key);
    if (s) return s;
    s = this.renderStrip(li, k);
    this.cache.set(key, s);
    this.order.push(key);
    if (this.order.length > 24) this.cache.delete(this.order.shift());
    return s;
  }

  renderStrip(li, k) {
    const L = LAYERS[li];
    const c = makeCanvas(STRIP, LH);
    const g = ctx2d(c);
    const x0 = k * STRIP;
    // Reliefs colonne par colonne
    for (let cx = 0; cx < STRIP; cx += 2) {
      const lx = x0 + cx;
      const tx = Math.max(0, worldTxFromLayer(lx, L.p));
      const col = mix(blendedColor(L.key, tx), blendedColor('haze', tx), L.haze);
      const h = ridgeHeight(li, lx, L.p);
      g.fillStyle = css(col);
      g.fillRect(cx, BASE - h, 2, LH - (BASE - h));
      // lisière éclairée au sommet
      g.fillStyle = css(scale(col, 1.06));
      g.fillRect(cx, BASE - h, 2, 2);
    }
    // Éléments
    g.save();
    g.translate(-x0, 0);
    const c0 = Math.floor((x0 - 700) / CELL);
    const c1 = Math.floor((x0 + STRIP + 700) / CELL);
    for (let ci = c0; ci <= c1; ci++) {
      const { feats, rng } = cellFeatures(li, ci, L.p);
      for (const f of feats) {
        const tx = Math.max(0, f.tx);
        const col = mix(blendedColor(L.key, tx), blendedColor('haze', tx), L.haze * 0.92);
        const base = BASE - ridgeHeight(li, f.x, L.p) + 6;
        drawFeature(g, f, base, col, rng);
      }
    }
    g.restore();
    // Brume au pied des reliefs
    for (let cx = 0; cx < STRIP; cx += 16) {
      const tx = Math.max(0, worldTxFromLayer(x0 + cx + 8, L.p));
      const haze = blendedColor('haze', tx);
      const grad = g.createLinearGradient(0, BASE - 140, 0, BASE + 40);
      grad.addColorStop(0, css(haze, 0));
      grad.addColorStop(1, css(haze, 0.55 - li * 0.12));
      g.fillStyle = grad;
      g.fillRect(cx, BASE - 140, 16, LH - BASE + 140);
    }
    return c;
  }

  // Le ciel est dessiné sur gSky, les reliefs sur gLayers (teintés ensuite selon l'heure).
  draw(gSky, g, cam, env) {
    const vw = cam.vw;
    const vh = cam.vh;
    const cx = cam.x + cam.w / 2;
    const cy = cam.y + cam.h / 2;
    drawSky(gSky, vw, vh, cx / TILE, env, cy);
    for (let li = 0; li < LAYERS.length; li++) {
      const L = LAYERS[li];
      const lxLeft = (cx - VW / 2) * L.p + VW / 2 - vw / 2; // bord gauche en coordonnées de couche
      const baseScreen = vh * 0.66 + (HORIZON - cy) * L.py;
      const top = baseScreen - BASE;
      if (top > vh) continue;
      const k0 = Math.floor(lxLeft / STRIP);
      const k1 = Math.floor((lxLeft + vw) / STRIP);
      for (let k = k0; k <= k1; k++) {
        const s = this.strip(li, k);
        g.drawImage(s, Math.round(k * STRIP - lxLeft), Math.round(top));
      }
      // Remplissage sous la bande
      if (top + LH < vh) {
        const tx = cx / TILE;
        g.fillStyle = css(mix(blendedColor(L.key, tx), blendedColor('haze', tx), L.haze + 0.1));
        g.fillRect(0, Math.round(top + LH) - 1, vw, vh - (top + LH) + 2);
      }
      // Perspective atmosphérique : la brume locale recouvre les lointains
      g.globalCompositeOperation = 'source-atop';
      g.fillStyle = css(blendedColor('haze', cx / TILE), [0.32, 0.2, 0.1][li]);
      g.fillRect(0, 0, vw, vh);
      g.globalCompositeOperation = 'source-over';
    }
  }
}

// --- Ciel --------------------------------------------------------------------------

const NIGHT_TOP = [14, 18, 34];
const NIGHT_BOTTOM = [36, 38, 58];
const DUSK = [238, 140, 96];

export function undergroundFactor(cy) {
  return smoothstep(HORIZON + 200, HORIZON + 900, cy);
}

export function skyState(env) {
  // env.hour : 0..24
  const h = env.hour;
  const day = smoothstep(5, 7.5, h) * (1 - smoothstep(18.5, 21, h));
  const dusk = Math.max(0, 1 - Math.abs(h - 19.5) / 1.8) + Math.max(0, 1 - Math.abs(h - 6.2) / 1.6);
  return { day, dusk: clamp(dusk, 0, 1) };
}

function drawSky(g, vw, vh, tx, env, cy) {
  const { day, dusk } = skyState(env);
  let top = mix(NIGHT_TOP, blendedColor('skyTop', tx), day);
  let bottom = mix(NIGHT_BOTTOM, blendedColor('skyBottom', tx), day);
  bottom = mix(bottom, DUSK, dusk * 0.55);
  top = mix(top, scale(DUSK, 0.6), dusk * 0.2);
  const grad = g.createLinearGradient(0, 0, 0, vh);
  grad.addColorStop(0, css(top));
  grad.addColorStop(0.75, css(bottom));
  grad.addColorStop(1, css(bottom));
  g.fillStyle = grad;
  g.fillRect(0, 0, vw, vh);

  // Étoiles
  if (day < 0.7) {
    const a = (1 - day / 0.7) * 0.9;
    for (let i = 0; i < 90; i++) {
      const sx = hash1(i, 5) * vw;
      const sy = hash1(i, 9) * vh * 0.6;
      const tw = 0.6 + 0.4 * Math.sin(env.time * 1.3 + i);
      g.fillStyle = `rgba(230,230,255,${(a * tw * (0.4 + hash1(i, 3) * 0.6)).toFixed(3)})`;
      g.fillRect(Math.floor(sx), Math.floor(sy), hash1(i, 4) > 0.9 ? 2 : 1, 1);
    }
  }
  // Soleil et lune suivant un arc
  const sunT = (env.hour - 6) / 14; // 0 au lever, 1 au coucher
  if (sunT > -0.1 && sunT < 1.1) {
    const sx = vw * (0.1 + 0.8 * sunT);
    const sy = vh * 0.62 - Math.sin(Math.PI * clamp(sunT, 0, 1)) * vh * 0.48;
    const glow = g.createRadialGradient(sx, sy, 2, sx, sy, 120);
    const sc = mix([255, 240, 210], DUSK, dusk);
    glow.addColorStop(0, css(sc, 0.55));
    glow.addColorStop(1, css(sc, 0));
    g.fillStyle = glow;
    g.fillRect(sx - 120, sy - 120, 240, 240);
    g.fillStyle = css(mix([255, 248, 230], [255, 200, 150], dusk));
    g.beginPath();
    g.arc(sx, sy, 9, 0, Math.PI * 2);
    g.fill();
  }
  const moonT = ((env.hour + 24 - 20) % 24) / 10;
  if (moonT >= 0 && moonT <= 1 && day < 0.6) {
    const mx = vw * (0.15 + 0.7 * moonT);
    const my = vh * 0.55 - Math.sin(Math.PI * moonT) * vh * 0.42;
    g.fillStyle = 'rgba(220,226,240,0.9)';
    g.beginPath();
    g.arc(mx, my, 7, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = css(top);
    g.beginPath();
    g.arc(mx + 3, my - 2, 6, 0, Math.PI * 2);
    g.fill();
  }
  // Nuages étirés
  for (let i = 0; i < 6; i++) {
    const speed = 2 + hash1(i, 21) * 3;
    const w = 120 + hash1(i, 22) * 200;
    const x = ((hash1(i, 23) * (vw + w) + env.time * speed - tx * 0.6) % (vw + w) + (vw + w)) % (vw + w) - w;
    const y = vh * (0.08 + hash1(i, 24) * 0.32);
    const cc = mix(bottom, [255, 255, 255], 0.25 * day);
    g.fillStyle = css(cc, 0.16 + 0.1 * day);
    g.beginPath();
    g.ellipse(x + w / 2, y, w / 2, 5 + hash1(i, 25) * 6, 0, 0, Math.PI * 2);
    g.fill();
  }
  // Sous terre : l'obscurité remplace le ciel
  const depth = undergroundFactor(cy);
  if (depth > 0) {
    g.fillStyle = `rgba(10,14,14,${(depth * 0.92).toFixed(3)})`;
    g.fillRect(0, 0, vw, vh);
  }
}
