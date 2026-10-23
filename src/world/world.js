// Grille du monde : tuiles, murs d'arrière-plan, lumière et suivi des modifications.
import { TILE, T, BG, tileDef } from './tiles.js';
import { WORLD_W, WORLD_H } from './regions.js';

export const CHUNK = 32; // tuiles par côté d'un bloc de rendu
export const LIGHT_MAX = 15;

export class World {
  constructor(w = WORLD_W, h = WORLD_H) {
    this.w = w;
    this.h = h;
    this.tiles = new Uint8Array(w * h);
    this.bg = new Uint8Array(w * h);
    this.light = new Uint8Array(w * h);
    this.top = new Int16Array(w); // première tuile opaque de chaque colonne
    this.base = null; // copie des tuiles générées, pour la sauvegarde différentielle
    this.baseBg = null;
    this.dirty = new Set();
    this.listeners = [];
    this.ox = 0; // décalage en pixels (interface commune avec les colosses)
    this.oy = 0;
  }

  idx(x, y) {
    return y * this.w + x;
  }
  inside(x, y) {
    return x >= 0 && y >= 0 && x < this.w && y < this.h;
  }
  get(x, y) {
    if (x < 0 || x >= this.w) return T.BEDROCK;
    if (y < 0) return this.sealed && this.sealed[x] ? T.BEDROCK : T.AIR;
    if (y >= this.h) return T.BEDROCK;
    return this.tiles[y * this.w + x];
  }
  getBg(x, y) {
    if (!this.inside(x, y)) return BG.NONE;
    return this.bg[y * this.w + x];
  }
  def(x, y) {
    return tileDef(this.get(x, y));
  }
  solid(x, y) {
    return tileDef(this.get(x, y)).solid;
  }
  liquid(x, y) {
    return this.get(x, y) === T.WATER;
  }

  // Écriture brute pendant la génération (pas de mise à jour de lumière).
  raw(x, y, id) {
    if (this.inside(x, y)) this.tiles[y * this.w + x] = id;
  }
  rawBg(x, y, id) {
    if (this.inside(x, y)) this.bg[y * this.w + x] = id;
  }

  set(x, y, id) {
    if (!this.inside(x, y)) return;
    const i = y * this.w + x;
    if (this.tiles[i] === id) return;
    const old = this.tiles[i];
    this.tiles[i] = id;
    this.markDirty(x, y);
    this.updateTop(x);
    this.relight(x - 16, y - 16, x + 16, y + 16);
    for (const l of this.listeners) l(x, y, old, id);
  }

  setBg(x, y, id) {
    if (!this.inside(x, y)) return;
    const i = y * this.w + x;
    if (this.bg[i] === id) return;
    this.bg[i] = id;
    this.markDirty(x, y);
  }

  // Remplit un rectangle sans recalcul tuile par tuile (événements à grande échelle).
  setArea(x0, y0, x1, y1, id, filter) {
    x0 = Math.max(0, x0);
    y0 = Math.max(0, y0);
    x1 = Math.min(this.w - 1, x1);
    y1 = Math.min(this.h - 1, y1);
    for (let y = y0; y <= y1; y++)
      for (let x = x0; x <= x1; x++) {
        const i = y * this.w + x;
        if (filter && !filter(this.tiles[i], x, y)) continue;
        this.tiles[i] = id;
      }
    for (let x = x0; x <= x1; x++) this.updateTop(x);
    this.relight(x0 - 16, y0 - 16, x1 + 16, y1 + 16);
    this.markAreaDirty(x0 - 1, y0 - 1, x1 + 1, y1 + 1);
    for (const l of this.listeners) l(x0, y0, -1, id);
    for (const l of this.listeners) l(x1, y1, -1, id);
  }

  markDirty(x, y) {
    const cx = Math.floor(x / CHUNK);
    const cy = Math.floor(y / CHUNK);
    this.dirty.add(cx + ',' + cy);
    // Les bords dépendent des voisins : on invalide aussi les blocs adjacents.
    const lx = x - cx * CHUNK;
    const ly = y - cy * CHUNK;
    if (lx === 0) this.dirty.add(cx - 1 + ',' + cy);
    if (lx === CHUNK - 1) this.dirty.add(cx + 1 + ',' + cy);
    if (ly === 0) this.dirty.add(cx + ',' + (cy - 1));
    if (ly === CHUNK - 1) this.dirty.add(cx + ',' + (cy + 1));
  }

  markAreaDirty(x0, y0, x1, y1) {
    for (let cy = Math.floor(y0 / CHUNK); cy <= Math.floor(y1 / CHUNK); cy++)
      for (let cx = Math.floor(x0 / CHUNK); cx <= Math.floor(x1 / CHUNK); cx++) this.dirty.add(cx + ',' + cy);
  }

  updateTop(x) {
    let y = 0;
    while (y < this.h && !tileDef(this.tiles[y * this.w + x]).opaque) y++;
    this.top[x] = y;
  }

  // Décalage visuel des pieds pour suivre les pentes douces dessinées sur le sol naturel.
  slopeOffset(px, feetY) {
    const r = Math.round(feetY / TILE);
    const c = Math.floor((px - TILE / 2) / TILE);
    const f = (px - (c * TILE + TILE / 2)) / TILE;
    const a = this.naturalTopNear(c, r);
    const b = this.naturalTopNear(c + 1, r);
    if (a === null || b === null || Math.abs(a - b) !== 1) return 0;
    const y = (a + (b - a) * f) * TILE;
    const d = y - feetY;
    return d < -8 ? -8 : d > 8 ? 8 : d;
  }

  naturalTopNear(c, r) {
    for (const rr of [r, r + 1, r - 1]) {
      const d = tileDef(this.get(c, rr));
      if (d.solid && d.natural && !tileDef(this.get(c, rr - 1)).solid) return rr;
    }
    return null;
  }

  surface(x) {
    // Première tuile solide (marchable) depuis le haut.
    for (let y = 0; y < this.h; y++) {
      const d = tileDef(this.get(x, y));
      if (d.solid || d.oneWay) return y;
    }
    return this.h;
  }

  finishGeneration() {
    for (let x = 0; x < this.w; x++) this.updateTop(x);
    this.base = this.tiles.slice();
    this.baseBg = this.bg.slice();
    this.relight(0, 0, this.w - 1, this.h - 1);
  }

  // Propagation de la lumière du ciel dans un rectangle (bornes incluses).
  relight(x0, y0, x1, y1) {
    x0 = Math.max(0, x0);
    y0 = Math.max(0, y0);
    x1 = Math.min(this.w - 1, x1);
    y1 = Math.min(this.h - 1, y1);
    const w = this.w;
    const L = this.light;
    const Q = 1 << 20; // tampon circulaire
    const M = Q - 1;
    const queue = this._queue || (this._queue = new Int32Array(Q));
    let qh = 0;
    let qt = 0;
    for (let y = y0; y <= y1; y++) {
      for (let x = x0; x <= x1; x++) {
        const i = y * w + x;
        if (y < this.top[x]) {
          L[i] = LIGHT_MAX;
          queue[qt++ & M] = i;
        } else L[i] = 0;
      }
    }
    // Les cellules du bord extérieur servent de sources.
    const seed = (x, y) => {
      if (x < 0 || y < 0 || x >= this.w || y >= this.h) return;
      const i = y * w + x;
      if (L[i] > 1) queue[qt++ & M] = i;
    };
    if (!(x0 === 0 && y0 === 0 && x1 === this.w - 1 && y1 === this.h - 1)) {
      for (let x = x0 - 1; x <= x1 + 1; x++) {
        seed(x, y0 - 1);
        seed(x, y1 + 1);
      }
      for (let y = y0; y <= y1; y++) {
        seed(x0 - 1, y);
        seed(x1 + 1, y);
      }
    }
    const tiles = this.tiles;
    while (qh < qt) {
      const i = queue[qh++ & M];
      const l = L[i];
      if (l <= 1) continue;
      const x = i % w;
      const y = (i - x) / w;
      const t = tileDef(tiles[i]);
      const cost = t.opaque ? 2 : t.liquid ? 2 : 1;
      const nl = l - cost;
      if (nl <= 0) continue;
      // voisins dans le rectangle seulement
      if (x > x0 && L[i - 1] < nl) {
        L[i - 1] = nl;
        queue[qt++ & M] = i - 1;
      }
      if (x < x1 && L[i + 1] < nl) {
        L[i + 1] = nl;
        queue[qt++ & M] = i + 1;
      }
      if (y > y0 && L[i - w] < nl) {
        L[i - w] = nl;
        queue[qt++ & M] = i - w;
      }
      if (y < y1 && L[i + w] < nl) {
        L[i + w] = nl;
        queue[qt++ & M] = i + w;
      }
    }
    this.lightVersion = (this.lightVersion || 0) + 1;
  }

  lightAt(x, y) {
    if (!this.inside(x, y)) return y < 0 ? LIGHT_MAX : 0;
    return this.light[y * this.w + x];
  }

  // Différences avec le monde généré, pour la sauvegarde.
  diff() {
    const t = [];
    const b = [];
    for (let i = 0; i < this.tiles.length; i++) {
      if (this.tiles[i] !== this.base[i]) t.push(i, this.tiles[i]);
      if (this.bg[i] !== this.baseBg[i]) b.push(i, this.bg[i]);
    }
    return { t, b };
  }

  applyDiff(d) {
    if (!d) return;
    for (let k = 0; k < d.t.length; k += 2) this.tiles[d.t[k]] = d.t[k + 1];
    for (let k = 0; k < d.b.length; k += 2) this.bg[d.b[k]] = d.b[k + 1];
    for (let x = 0; x < this.w; x++) this.updateTop(x);
    this.relight(0, 0, this.w - 1, this.h - 1);
    this.markAreaDirty(0, 0, this.w - 1, this.h - 1);
  }
}

export function toTile(px) {
  return Math.floor(px / TILE);
}
