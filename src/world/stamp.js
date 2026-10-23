// Outils de génération : remplissages, gabarits ASCII, tunnels.
import { T, BG } from './tiles.js';

export const LEGEND = {
  '#': T.CONCRETE,
  M: T.METAL,
  S: T.SCRAP,
  R: T.RUBBLE,
  P: T.PIPE,
  '=': T.PLATFORM,
  H: T.LADDER,
  V: T.VINE,
  '~': T.WATER,
  B: T.BRICK,
  G: T.GIRDER,
  C: T.CHAIN,
  g: T.GRATE,
  W: T.DEADWOOD,
  O: T.ORGANIC,
  r: T.ROOT,
  m: T.MEMBRANE,
  L: T.GLASS,
  X: T.GEARBOX,
  K: T.ROCK,
  k: T.SAND,
  b: T.BONE,
  s: T.SOIL,
  Z: T.BEDROCK,
  o: T.MOSSROCK,
};

export class Gen {
  constructor(world) {
    this.w = world;
    this.markers = [];
  }
  fill(x0, y0, x1, y1, id) {
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) this.w.raw(x, y, id);
  }
  fillBg(x0, y0, x1, y1, id) {
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) this.w.rawBg(x, y, id);
  }
  rect(x0, y0, x1, y1, id) {
    for (let x = x0; x <= x1; x++) {
      this.w.raw(x, y0, id);
      this.w.raw(x, y1, id);
    }
    for (let y = y0; y <= y1; y++) {
      this.w.raw(x0, y, id);
      this.w.raw(x1, y, id);
    }
  }
  // Pièce fermée : murs, intérieur vide avec mur d'arrière-plan.
  room(x0, y0, x1, y1, wall, bg) {
    this.rect(x0, y0, x1, y1, wall);
    this.fill(x0 + 1, y0 + 1, x1 - 1, y1 - 1, T.AIR);
    this.fillBg(x0, y0, x1, y1, bg);
  }
  vline(x, y0, y1, id) {
    for (let y = y0; y <= y1; y++) this.w.raw(x, y, id);
  }
  hline(x0, x1, y, id) {
    for (let x = x0; x <= x1; x++) this.w.raw(x, y, id);
  }
  get(x, y) {
    return this.w.get(x, y);
  }
  set(x, y, id) {
    this.w.raw(x, y, id);
  }
  setBg(x, y, id) {
    this.w.rawBg(x, y, id);
  }

  // Gabarit : lignes de caractères. ' ' ne touche à rien, '.' = air + arrière-plan,
  // ',' = air sans arrière-plan, '@' et chiffres = marqueurs (air + arrière-plan).
  stamp(lines, x0, y0, bg = BG.CONCRETE, legend = {}) {
    const marks = {};
    for (let j = 0; j < lines.length; j++) {
      const line = lines[j];
      for (let i = 0; i < line.length; i++) {
        const ch = line[i];
        const x = x0 + i;
        const y = y0 + j;
        if (ch === ' ') continue;
        if (ch === ',') {
          this.w.raw(x, y, T.AIR);
          this.w.rawBg(x, y, BG.NONE);
          continue;
        }
        if (ch === '.' || ch === '@' || (ch >= '0' && ch <= '9') || ch === '*' || ch === '&') {
          this.w.raw(x, y, T.AIR);
          this.w.rawBg(x, y, bg);
          if (ch !== '.') (marks[ch] = marks[ch] || []).push({ x, y });
          continue;
        }
        const id = legend[ch] !== undefined ? legend[ch] : LEGEND[ch];
        if (id === undefined) continue;
        this.w.raw(x, y, id);
        if (bg !== BG.NONE) this.w.rawBg(x, y, bg);
      }
    }
    return marks;
  }

  // Tunnel horizontal ou vertical creusé dans la roche, avec arrière-plan.
  tunnel(x0, y0, x1, y1, h, bg = BG.ROCK) {
    const dx = x1 - x0;
    const dy = y1 - y0;
    const n = Math.max(Math.abs(dx), Math.abs(dy));
    for (let k = 0; k <= n; k++) {
      const x = Math.round(x0 + (dx * k) / n);
      const y = Math.round(y0 + (dy * k) / n);
      for (let j = 0; j < h; j++) {
        for (let i = 0; i < 2; i++) {
          this.w.raw(x + i, y - j, T.AIR);
          this.w.rawBg(x + i, y - j, bg);
        }
      }
    }
  }
}
