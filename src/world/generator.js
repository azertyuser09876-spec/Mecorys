// Génération déterministe du monde de Mecorys.
import { World } from './world.js';
import { T, BG } from './tiles.js';
import { WORLD_W, WORLD_H, CONDUITES } from './regions.js';
import { Gen } from './stamp.js';
import { fbm1, noise1, hash1, hash2, RNG, smoothstep, lerp, clamp } from '../core/rng.js';

export const SEALED = [
  [0, 13],
  [1150, 1181],
  [1578, 1589],
  [2390, 2399],
];

export const LAKE = { x0: 886, x1: 1149, level: 92, drained: 151 };
export const CHASM = { x0: 1960, x1: 2039 };
export const CALE = { x0: 1234, x1: 1366, floor: 148 };

function interp(points, x) {
  for (let i = 0; i < points.length - 1; i++) {
    const [ax, ay] = points[i];
    const [bx, by] = points[i + 1];
    if (x >= ax && x <= bx) {
      const t = (x - ax) / (bx - ax);
      const s = t * t * (3 - 2 * t);
      return ay + (by - ay) * s;
    }
  }
  return points[points.length - 1][1];
}

function flatten(h, x, a, b, target, fall = 8) {
  if (x < a - fall || x > b + fall) return h;
  let w = 1;
  if (x < a) w = smoothstep(a - fall, a, x);
  else if (x > b) w = 1 - smoothstep(b, b + fall, x);
  return lerp(h, target, w);
}

export function surfaceProfile(x, seed) {
  if (x <= 13 || x >= 2390) return 0;
  if (x < 520) {
    let h = 116 - (fbm1(x / 46, seed + 1, 4) - 0.5) * 24 - Math.sin(x / 19) * 1.6;
    h = flatten(h, x, 28, 64, 118);
    h = flatten(h, x, 104, 142, 117);
    // Monticule recouvrant le Dormeur
    h = lerp(h, 108 - Math.sin(clamp((x - 270) / 120, 0, 1) * Math.PI) * 8, smoothstep(250, 275, x) * (1 - smoothstep(385, 410, x)));
    h = flatten(h, x, 505, 520, 116, 14);
    return Math.round(h);
  }
  if (x < 870) {
    let h = 116 + (fbm1(x / 30, seed + 2, 3) - 0.5) * 4;
    return Math.round(flatten(h, x, 530, 862, 116, 4));
  }
  if (x < 886) return 58; // barrage
  if (x < 1150) return Math.round(interp([[886, 128], [900, 150], [960, 168], [1040, 170], [1100, 160], [1149, 152]], x));
  if (x < 1182) return 0; // montagne scellée
  if (x < 1578) {
    let h = 128 + (fbm1(x / 40, seed + 3, 3) - 0.5) * 6;
    h = flatten(h, x, 1182, 1192, 128, 6);
    h = flatten(h, x, 1222, 1398, 128, 4);
    h = flatten(h, x, 1436, 1578, 128, 6);
    return Math.round(h);
  }
  if (x < 1590) return 0;
  if (x < 1900) {
    let h = 120 + (fbm1(x / 34, seed + 4, 3) - 0.5) * 10;
    h = flatten(h, x, 1590, 1598, 128, 10);
    h = flatten(h, x, 1716, 1846, 120, 6);
    return Math.round(h);
  }
  if (x < 1960) return Math.round(118 + (fbm1(x / 25, seed + 5, 2) - 0.5) * 4);
  if (x < 2040) return 236;
  if (x < 2120) return Math.round(116 + (fbm1(x / 25, seed + 6, 2) - 0.5) * 4);
  return Math.round(flatten(120 + (fbm1(x / 30, seed + 7, 3) - 0.5) * 8, x, 2190, 2340, 120, 8));
}

export function generateWorld(seed = 1729) {
  const world = new World(WORLD_W, WORLD_H);
  const G = new Gen(world);
  const pois = [];
  const poi = (type, x, y, data = {}) => {
    const p = Object.assign({ type, x, y }, data);
    pois.push(p);
    return p;
  };
  const rng = new RNG(seed);
  const ground = new Int16Array(WORLD_W);
  world.sealed = new Uint8Array(WORLD_W);
  for (const [a, b] of SEALED) for (let x = a; x <= b; x++) world.sealed[x] = 1;

  // --- 1. Relief de base ------------------------------------------------------------
  const heights = new Int16Array(WORLD_W);
  for (let x = 0; x < WORLD_W; x++) heights[x] = surfaceProfile(x, seed);
  // Pentes douces : jamais plus d'une tuile d'écart entre deux colonnes voisines
  for (const [a, b] of [
    [14, 869],
    [1182, 1577],
    [1590, 1959],
    [2040, 2389],
  ]) {
    for (let x = a + 1; x <= b; x++) heights[x] = Math.min(heights[x], heights[x - 1] + 1);
    for (let x = b - 1; x >= a; x--) heights[x] = Math.min(heights[x], heights[x + 1] + 1);
  }
  for (let x = 0; x < WORLD_W; x++) {
    const h = heights[x];
    ground[x] = h;
    for (let y = h; y < WORLD_H; y++) {
      const d = y - h;
      let id = T.ROCK;
      if (x < 520) id = d < 7 + Math.floor(hash1(x, 9) * 3) ? T.SAND : T.ROCK;
      else if (x < 870) id = d < 2 ? T.SOIL : d < 5 && hash2(x, y, 4) > 0.5 ? T.RUBBLE : T.ROCK;
      else if (x >= 886 && x < 1150) id = d < 2 ? T.SAND : T.ROCK;
      else if (x >= 1182 && x < 1578) id = d < 3 ? T.SAND : T.ROCK;
      else if (x >= 1590 && x < 1900) id = d < 2 ? T.SOIL : d < 4 && hash2(x, y, 5) > 0.6 ? T.ROOT : T.ROCK;
      else if (x >= 2120) id = d < 2 ? T.SOIL : T.ROCK;
      if (y >= WORLD_H - 4) id = T.BEDROCK;
      if (world.sealed[x] && y < 40) id = T.BEDROCK;
      world.raw(x, y, id);
      if (d > 1) world.rawBg(x, y, BG.ROCK);
    }
  }
  const surf = (x) => ground[x];

  // --- 2. Désert : les Dunes Muettes -----------------------------------------------
  // Camp tari (départ)
  poi('start', 44, 118);
  poi('prop', 38, 118, { kind: 'tent', w: 7 });
  poi('prop', 54, 118, { kind: 'tent', w: 6, torn: true });
  poi('prop', 47, 118, { kind: 'campfire' });
  G.fill(49, 112, 51, 117, T.AIR);
  G.fillBg(49, 112, 51, 117, BG.NONE);
  G.fillBg(49, 118, 51, 120, BG.SAND);
  G.fill(49, 118, 51, 120, T.AIR);
  G.set(48, 117, T.BRICK);
  G.set(52, 117, T.BRICK);
  G.set(48, 118, T.BRICK);
  G.set(52, 118, T.BRICK);
  G.fill(48, 121, 52, 121, T.ROCK);
  G.hline(49, 51, 118, T.PLANK);
  poi('prop', 50, 118, { kind: 'well' });
  poi('lore', 41, 118, { id: 'camp' });

  // Ferraille éparse
  const scrapMound = (x0, x1, peak, gearChance = 0.08) => {
    for (let x = x0; x <= x1; x++) {
      const t = (x - x0) / Math.max(1, x1 - x0);
      const hh = Math.round(Math.sin(t * Math.PI) * peak + hash1(x, 33) * 0.8);
      const g = surf(x);
      for (let k = 1; k <= hh; k++) {
        const r = hash2(x, k, 34);
        world.raw(x, g - k, r < gearChance ? T.GEARBOX : r < 0.25 ? T.METAL : T.SCRAP);
      }
      ground[x] = g - hh;
    }
  };
  scrapMound(74, 84, 2, 0.0);
  scrapMound(188, 200, 3);
  scrapMound(412, 428, 3);
  scrapMound(440, 449, 2);

  // L'abri à demi enfoui : premier refuge
  {
    const x0 = 112;
    const x1 = 133;
    const g = 117;
    G.room(x0, g - 7, x1, g, T.CONCRETE, BG.CONCRETE);
    G.fill(x0, g - 3, x0, g - 1, T.AIR); // porte
    G.fill(x0 + 1, g, x1 - 1, g, T.METAL);
    G.hline(x1 - 6, x1 - 1, g - 4, T.PLATFORM);
    G.fill(x0 + 7, g - 8, x0 + 10, g - 8, T.CONCRETE); // conduit d'aération
    G.set(x0 + 8, g - 9, T.PIPE);
    G.set(x0 + 9, g - 9, T.PIPE);
    // sable entré par la porte et dune sur le toit
    G.set(x0 + 1, g - 1, T.SAND);
    G.set(x0 + 2, g - 1, T.SAND);
    // dune sur le toit, puis talus de sable contre le mur est
    for (let x = x0 + 11; x <= x1; x++) {
      const hh = Math.min(3, Math.floor((x - (x0 + 11)) / 3) + 1);
      for (let k = 0; k < hh; k++) if (world.get(x, g - 8 - k) === T.AIR) world.raw(x, g - 8 - k, T.SAND);
    }
    // porte est, et une congère au pied du mur
    G.fill(x1, g - 3, x1, g - 1, T.AIR);
    for (let x = x1 + 3; x <= x1 + 7; x++) world.raw(x, g - 1, T.SAND);
    world.raw(x1 + 5, g - 2, T.SAND);
    poi('refuge', x0 + 6, g, { id: 'abri', found: true, ruined: true });
    poi('lore', x0 + 14, g, { id: 'abri' });
    poi('cache', x1 - 3, g - 4, { items: { ferraille: 3, fibre: 2 } });
  }

  // Carcasse de machine enfouie
  {
    const cx = 168;
    const cy = surf(168) - 2;
    const rx = 15;
    const ry = 8;
    for (let y = cy - ry - 1; y <= cy + ry + 1; y++)
      for (let x = cx - rx - 1; x <= cx + rx + 1; x++) {
        const dx = (x - cx) / rx;
        const dy = (y - cy) / ry;
        const d = dx * dx + dy * dy;
        if (d <= 1) {
          if (d > 0.62) world.raw(x, y, hash2(x, y, 5) > 0.82 ? T.GEARBOX : hash2(x, y, 6) > 0.4 ? T.SCRAP : T.METAL);
          else {
            world.raw(x, y, T.AIR);
            world.rawBg(x, y, BG.METAL);
          }
        }
      }
    // côtes de métal
    for (let k = -2; k <= 2; k++) G.vline(cx + k * 5, cy - ry + 2, cy + 3, T.TRUSS);
    // couloir traversant au niveau du sol : on passe à travers l'épave
    const gA = surf(cx - rx - 3);
    const gB = surf(cx + rx + 3);
    const gl = Math.round((gA + gB) / 2);
    for (let x = cx - rx - 2; x <= cx + rx + 2; x++) {
      const gx = Math.round(gA + ((gB - gA) * (x - (cx - rx - 3))) / (2 * rx + 6));
      for (let y = gx - 3; y <= gx - 1; y++) {
        world.raw(x, y, T.AIR);
        world.rawBg(x, y, BG.METAL);
      }
      for (let y = gx; y <= cy + ry + 1; y++) if (world.get(x, y) === T.AIR || y === gx) world.raw(x, y, T.SAND);
      ground[x] = gx;
      if ((x - cx) % 5 === 0) world.raw(x, gx - 1, T.AIR);
    }
    G.hline(cx - 9, cx + 9, cy - 3, T.PLATFORM);
    poi('cache', cx + 4, cy - 3, { items: { rouages: 2, ferraille: 4 } });
    poi('lore', cx - 3, gl, { id: 'carcasse' });
  }

  // Tours en ruine
  const tower = (x, h, w, opt = {}) => {
    const g = Math.min(surf(x), surf(x + w - 1));
    const top = g - h;
    for (let y = top; y <= g; y++) {
      for (let i = 0; i < w; i++) {
        const xx = x + i;
        const wall = i === 0 || i === w - 1;
        const broken = y < top + 4 && hash2(xx, y, 71) > 0.5;
        if (broken) continue;
        if (wall) world.raw(xx, y, (y + i) % 7 === 0 ? T.BRICK : T.CONCRETE);
        else {
          world.raw(xx, y, T.AIR);
          world.rawBg(xx, y, BG.CONCRETE);
        }
      }
    }
    // planchers et échelle
    G.vline(x + w - 2, top + 3, g - 1, T.LADDER);
    for (let y = g - 8; y > top + 3; y -= 8) G.hline(x + 1, x + w - 2, y, T.PLATFORM);
    // fenêtres
    for (let y = g - 5; y > top + 4; y -= 8) {
      G.set(x, y, T.AIR);
      G.set(x, y - 1, T.AIR);
      G.set(x + w - 1, y - 3, T.AIR);
    }
    // portes des deux côtés
    G.fill(x, g - 3, x, g - 1, T.AIR);
    G.fill(x + w - 1, g - 3, x + w - 1, g - 1, T.AIR);
    G.hline(x, x + w - 1, g, T.CONCRETE);
    for (let i = 1; i < w - 1; i++) world.rawBg(x + i, g, BG.CONCRETE);
    for (let i = 0; i < w; i++) for (let y = g + 1; y <= surf(x + i); y++) if (world.get(x + i, y) === T.AIR) world.raw(x + i, y, T.SAND);
    const topFloor = g - 8 * Math.floor((h - 4) / 8);
    return { top, g, topFloor };
  };
  {
    const t1 = tower(232, 30, 7);
    poi('lore', 235, t1.topFloor, { id: 'tour' });
    const t2 = tower(466, 46, 8);
    poi('sample', 469, t2.topFloor, { id: 'graine_herbe' });
    poi('lore', 469, t2.g, { id: 'tour_haute' });
  }

  // Petite grotte sous les dunes
  {
    for (let x = 352; x <= 372; x++) {
      const yy = 128 + Math.round(Math.sin((x - 352) / 3) * 1.5);
      for (let k = 0; k < 4; k++) {
        world.raw(x, yy - k, T.AIR);
        world.rawBg(x, yy - k, BG.SAND);
      }
    }
  }
  poi('dormeur', 318, 112);

  // L'ancien canal enfoui : une rigole de béton sous le sable, vers la fonderie
  {
    const x0 = 432;
    const x1 = 514;
    const tops = [];
    for (let x = x0; x <= x1; x++) {
      const sy = surf(x);
      tops.push(sy);
      world.raw(x, sy + 3, T.CONCRETE);
      world.raw(x, sy + 4, T.CONCRETE);
    }
    poi('canal', 472, surf(472) + 1, { x0, x1, tops });
    poi('lore', x0 - 3, surf(x0 - 3), { id: 'canal' });
  }

  // --- 3. La Fonderie Engloutie -----------------------------------------------------
  const FG = 116;
  // Hall A : l'atelier abandonné
  {
    const x0 = 536;
    const x1 = 592;
    const top = FG - 22;
    G.room(x0, top, x1, FG, T.CONCRETE, BG.CONCRETE);
    G.fill(x0, FG - 4, x0, FG - 1, T.AIR);
    G.fill(x1, FG - 4, x1, FG - 1, T.AIR);
    // toit en dents de scie (poutres et verre)
    for (let x = x0; x <= x1; x++) {
      const k = (x - x0) % 8;
      for (let y = top - k; y < top; y++) world.raw(x, y, k === 7 ? T.GIRDER : y === top - k ? T.GLASS : T.AIR);
      if (k < 7) world.raw(x, top - k - 1, T.GIRDER);
    }
    for (let x = x0 + 3; x <= x1 - 3; x += 9) G.fill(x, top, x + 2, top, T.GLASS);
    // étage
    G.hline(x0 + 1, x0 + 30, FG - 11, T.GRATE);
    G.vline(x0 + 31, FG - 11, FG - 1, T.LADDER);
    G.hline(x0 + 40, x1 - 1, FG - 11, T.GRATE);
    G.vline(x0 + 39, FG - 11, FG - 1, T.LADDER);
    // chaînes et lianes
    G.vline(x0 + 14, top + 1, top + 7, T.CHAIN);
    G.vline(x0 + 46, top + 1, top + 5, T.CHAIN);
    for (let x = x0 + 4; x < x1 - 2; x += 7) G.vline(x, top + 1, top + 2 + Math.floor(hash1(x, 3) * 6), T.VINE);
    // machines
    G.fill(x0 + 18, FG - 2, x0 + 21, FG - 1, T.GEARBOX);
    G.fill(x0 + 19, FG - 3, x0 + 20, FG - 3, T.GEARBOX);
    G.fill(x0 + 8, FG - 13, x0 + 10, FG - 12, T.SCRAP);
    G.fill(x1 - 8, FG - 2, x1 - 5, FG - 1, T.SCRAP);
    // puits vers les conduites
    G.fill(x1 - 3, FG, x1 - 2, CONDUITES.depth + 35, T.AIR);
    G.fillBg(x1 - 3, FG, x1 - 2, CONDUITES.depth + 35, BG.PIPES);
    G.vline(x1 - 3, FG + 1, CONDUITES.depth + 35, T.LADDER);
    G.hline(x1 - 3, x1 - 2, FG, T.GRATE);
    poi('etabli', x0 + 10, FG, { found: true });
    poi('plan', x0 + 6, FG - 11, { id: 'trotteur' });
    poi('plan', x1 - 4, FG - 11, { id: 'chaudiere' });
    poi('lore', x0 + 26, FG, { id: 'atelier' });
    poi('sample', x0 + 2, FG - 12, { id: 'spore_mousse' });
  }
  scrapMound(596, 606, 2);
  // Cheminées
  const chimney = (x, h, w = 5) => {
    const top = FG - h;
    for (let y = top; y <= FG; y++)
      for (let i = 0; i < w; i++) {
        const xx = x + i;
        if (i === 0 || i === w - 1) world.raw(xx, y, T.BRICK);
        else {
          world.raw(xx, y, T.AIR);
          world.rawBg(xx, y, BG.BRICK);
        }
      }
    G.vline(x + 2, top, FG - 1, T.LADDER);
    G.fill(x, FG - 3, x, FG - 1, T.AIR);
    G.fill(x + w - 1, FG - 3, x + w - 1, FG - 1, T.AIR);
    G.hline(x - 1, x + w, top, T.BRICK);
    G.set(x + 2, top, T.AIR);
    G.set(x + 1, top, T.AIR);
    G.set(x + 3, top, T.AIR);
    return top;
  };
  const ct1 = chimney(612, 52);
  chimney(626, 40);
  chimney(640, 34, 4);
  G.hline(616, 626, FG - 26, T.PIPE);
  G.hline(630, 640, FG - 20, T.PIPE);
  poi('lore', 613, ct1 + 3, { id: 'cheminee' });

  // Grande Halle avec pont roulant et cabine
  {
    const x0 = 672;
    const x1 = 772;
    const top = FG - 40;
    G.room(x0, top, x1, FG, T.CONCRETE, BG.CONCRETE);
    G.fill(x0, FG - 5, x0, FG - 1, T.AIR);
    G.fill(x1, FG - 5, x1, FG - 1, T.AIR);
    // fenêtres hautes
    for (let x = x0 + 4; x < x1 - 4; x += 10) G.fill(x, top + 3, x + 3, top + 7, T.GLASS);
    // toit effondré par endroits
    G.fill(x0 + 30, top, x0 + 42, top, T.AIR);
    G.fill(x0 + 31, top - 1, x0 + 41, top, T.AIR);
    for (let x = x0 + 30; x <= x0 + 42; x++) world.rawBg(x, top, BG.NONE);
    G.fill(x0 + 28, FG - 2, x0 + 45, FG - 1, T.RUBBLE);
    G.fill(x0 + 32, FG - 3, x0 + 40, FG - 3, T.RUBBLE);
    // piliers et pont roulant
    for (let x = x0 + 12; x < x1; x += 22) G.vline(x, top + 1, FG - 1, T.TRUSS);
    G.hline(x0 + 1, x1 - 1, top + 8, T.GIRDER);
    G.vline(x0 + 56, top + 9, top + 22, T.CHAIN);
    G.fill(x0 + 54, top + 23, x0 + 58, top + 24, T.METAL);
    // cabine d'Ilo accrochée au pont roulant
    G.room(x0 + 44, top + 9, x0 + 52, top + 15, T.TINWALL, BG.WOOD);
    G.fill(x0 + 44, top + 12, x0 + 44, top + 14, T.AIR);
    G.vline(x0 + 34, top + 11, FG - 1, T.LADDER);
    G.hline(x0 + 35, x0 + 43, top + 15, T.GRATE);
    // passerelles
    G.hline(x0 + 1, x0 + 20, FG - 14, T.GRATE);
    G.vline(x0 + 21, FG - 14, FG - 1, T.LADDER);
    G.hline(x1 - 24, x1 - 1, FG - 18, T.GRATE);
    G.vline(x1 - 25, FG - 18, FG - 1, T.LADDER);
    // machines à démonter
    G.fill(x0 + 6, FG - 2, x0 + 10, FG - 1, T.GEARBOX);
    G.fill(x0 + 7, FG - 3, x0 + 9, FG - 3, T.GEARBOX);
    G.fill(x1 - 14, FG - 2, x1 - 8, FG - 1, T.SCRAP);
    G.fill(x1 - 12, FG - 3, x1 - 10, FG - 3, T.SCRAP);
    G.fill(x1 - 12, FG - 21, x1 - 6, FG - 19, T.SCRAP);
    for (let x = x0 + 3; x < x1 - 2; x += 6) G.vline(x, top + 1, top + 2 + Math.floor(hash1(x, 8) * 9), T.VINE);
    for (let x = x0 + 2; x < x1 - 1; x++) if (hash1(x, 12) > 0.55) world.raw(x, FG, T.MOSSROCK);
    poi('survivor', x0 + 48, top + 15, { id: 'ilo' });
    poi('plan', x1 - 10, FG - 18, { id: 'porteur' });
    poi('lore', x0 + 60, FG, { id: 'halle' });
    poi('cache', x0 + 15, FG - 14, { items: { rouages: 2, ferraille: 5 } });
  }
  // Cour de gravats et second puits
  scrapMound(780, 790, 2);
  // tas de gravats en pentes douces
  let prevH = 0;
  for (let x = 800; x < 862; x++) {
    let hh = Math.round(clamp((noise1(x / 4, 40) - 0.35) * 6, 0, 3));
    hh = Math.min(hh, prevH + 1);
    // dégagé sous les arches des murs effondrés
    if ((x >= 808 && x <= 817) || (x >= 842 && x <= 851)) hh = Math.min(hh, Math.max(0, Math.abs(x - (x < 830 ? 812.5 : 846.5)) - 2));
    prevH = hh;
    for (let k = 1; k <= hh; k++) world.raw(x, FG - k, T.RUBBLE);
  }
  {
    // murs effondrés
    // murs effondrés : on passe sous les arches
    G.fill(812, FG - 11, 813, FG - 4, T.CONCRETE);
    G.fill(814, FG - 11, 822, FG - 10, T.CONCRETE);
    G.fill(830, FG - 2, 831, FG - 1, T.BRICK);
    G.fill(846, FG - 14, 847, FG - 4, T.CONCRETE);
    for (let x = 805; x <= 850; x++) for (let y = FG - 3; y < FG; y++) if (x === 812 || x === 813 || x === 846 || x === 847) world.raw(x, y, T.AIR);
    G.fill(794, FG, 795, CONDUITES.depth + 35, T.AIR);
    G.fillBg(794, FG, 795, CONDUITES.depth + 35, BG.PIPES);
    G.vline(794, FG + 1, CONDUITES.depth + 35, T.LADDER);
    G.hline(794, 795, FG, T.GRATE);
    G.hline(792, 797, FG - 1, T.AIR);
    G.set(793, FG - 1, T.PIPE);
    G.set(796, FG - 1, T.PIPE);
  }

  // --- 4. Le Grand Réservoir --------------------------------------------------------
  {
    // Barrage : masse de béton creusée d'un puits
    for (let x = 870; x <= 885; x++) for (let y = 58; y < 200; y++) if (world.get(x, y) !== T.BEDROCK) world.raw(x, y, T.CONCRETE);
    G.fill(870, 113, 872, 115, T.AIR);
    G.fillBg(870, 112, 878, 116, BG.CONCRETE);
    G.fill(873, 59, 876, 186, T.AIR);
    G.fillBg(873, 58, 876, 186, BG.CONCRETE);
    for (let y = 70; y < 180; y += 10) G.hline(873, 874, y, T.PLATFORM);
    // Salle des pompes au sommet
    G.room(870, 48, 886, 58, T.CONCRETE, BG.METAL);
    G.fill(873, 58, 876, 58, T.AIR);
    G.hline(871, 872, 58, T.METAL);
    G.hline(877, 885, 58, T.METAL);
    G.fill(886, 54, 886, 57, T.AIR);
    G.fill(871, 49, 885, 49, T.PIPE);
    G.vline(875, 59, 186, T.LADDER);
    G.hline(873, 876, 58, T.GRATE);
    poi('pompe', 878, 58, { id: 'pompe_barrage' });
    poi('vanne', 871, 58, {});
    poi('plan', 872, 58, { id: 'pompe' });
    poi('lore', 877, 58, { id: 'barrage' });

    // Le lac
    for (let x = LAKE.x0; x <= LAKE.x1; x++) {
      for (let y = LAKE.level; y < surf(x); y++) {
        world.raw(x, y, T.WATER);
        world.rawBg(x, y, BG.NONE);
      }
    }
    // Maison sur pilotis de Maëlle
    const hx = 1000;
    for (const px of [hx, hx + 6, hx + 12]) for (let y = 87; y < surf(px); y++) world.raw(px, y, T.PIPE);
    G.hline(hx - 3, hx + 15, 87, T.PLATFORM);
    G.room(hx + 1, 79, hx + 11, 87, T.TINWALL, BG.WOOD);
    G.hline(hx + 1, hx + 11, 87, T.METAL);
    G.fill(hx + 1, 84, hx + 1, 86, T.AIR);
    G.fill(hx + 11, 84, hx + 11, 86, T.AIR);
    G.hline(hx, hx + 12, 78, T.TINWALL);
    G.vline(hx - 3, 87, 100, T.LADDER);
    for (let y = 88; y <= 100; y++) world.rawBg(hx - 3, y, BG.NONE);
    poi('survivor', hx + 6, 87, { id: 'maelle' });
    poi('sample', hx + 9, 78, { id: 'oeuf_heron' });
    poi('lore', hx + 3, 87, { id: 'pilotis' });
    // Vanne de fond et tunnel vers la vallée
    G.tunnel(1140, 151, 1186, 127, 5, BG.CONCRETE);
    for (let x = 1141; x <= 1190; x++) {
      for (let y = 120; y < 160; y++) {
        if (world.get(x, y) === T.AIR && world.get(x, y + 1) !== T.AIR && world.get(x, y + 1) !== T.WATER) {
          if (hash1(x, 3) > 0.7) world.raw(x, y + 1, T.METAL);
        }
      }
    }
    // le tunnel reste sec derrière la vanne de fond
    for (let x = 1136; x <= 1147; x++) for (let y = 138; y < 156; y++) if (world.get(x, y) === T.AIR) world.raw(x, y, T.WATER);
    G.fill(1148, 138, 1149, 153, T.METAL);
    poi('porte_vanne', 1148, 138, { x0: 1148, x1: 1149, y0: 138, y1: 153 });
  }

  // --- 5. Les Conduites (sous la fonderie et le réservoir) --------------------------
  {
    const bg = BG.PIPES;
    const corridor = (x0, x1, y, h) => {
      for (let x = x0; x <= x1; x++) {
        for (let k = 0; k < h; k++) {
          world.raw(x, y - k, T.AIR);
          world.rawBg(x, y - k, bg);
        }
        // les puits déjà creusés (échelles) restent ouverts
        if (world.get(x, y + 1) !== T.LADDER) world.raw(x, y + 1, x % 9 === 0 ? T.GRATE : T.PIPE);
        if (world.get(x, y + 1) === T.GRATE) world.raw(x, y + 2, T.PIPE);
        const up = world.get(x, y - h);
        if (up !== T.LADDER && up !== T.AIR) world.raw(x, y - h, T.PIPE);
      }
    };
    const yMain = 186;
    corridor(536, 1132, yMain, 6);
    // dénivelés et salles
    corridor(600, 700, 168, 5);
    G.fill(600, 162, 601, 186, T.AIR);
    G.fillBg(600, 162, 601, 186, bg);
    G.vline(600, 163, 185, T.LADDER);
    corridor(705, 760, 200, 5);
    G.fill(758, 186, 759, 200, T.AIR);
    G.fillBg(758, 180, 759, 200, bg);
    G.vline(758, 181, 199, T.LADDER);
    G.fill(706, 186, 707, 200, T.AIR);
    G.fillBg(706, 180, 707, 200, bg);
    G.vline(707, 181, 199, T.LADDER);
    // Bassins d'eau stagnante
    for (let x = 720; x <= 745; x++) for (let y = 198; y <= 200; y++) world.raw(x, y, T.WATER);
    // Salles
    G.room(640, 160, 666, 169, T.PIPE, bg);
    G.fill(640, 165, 640, 168, T.AIR);
    G.fill(666, 165, 666, 168, T.AIR);
    G.room(890, 190, 930, 204, T.PIPE, bg);
    G.fill(890, 181, 891, 189, T.AIR);
    G.fillBg(890, 181, 891, 190, bg);
    G.vline(891, 181, 203, T.LADDER);
    for (let x = 893; x < 928; x++) if (hash1(x, 77) > 0.7) G.vline(x, 191, 192 + Math.floor(hash1(x, 78) * 4), T.VINE);
    G.room(1048, 186, 1082, 200, T.BRICK, BG.BRICK);
    G.fill(1048, 181, 1049, 186, T.AIR);
    G.fillBg(1048, 180, 1049, 186, bg);
    G.vline(1049, 181, 199, T.LADDER);
    G.hline(1066, 1080, 194, T.PLANK);
    // Raccord avec le puits du barrage
    G.fill(873, 180, 876, 186, T.AIR);
    G.fillBg(873, 180, 876, 186, BG.CONCRETE);
    // Mousse et lianes, humidité
    for (let x = 540; x < 1130; x++) {
      if (hash1(x, 81) > 0.86) G.vline(x, yMain - 5, yMain - 5 + Math.floor(hash1(x, 82) * 4), T.VINE);
      if (hash1(x, 83) > 0.8 && world.get(x, yMain + 1) === T.PIPE) world.raw(x, yMain + 1, T.MOSSROCK);
    }
    G.fill(780, yMain - 1, 783, yMain, T.GEARBOX);
    G.fill(960, yMain - 1, 966, yMain, T.SCRAP);
    G.fill(962, yMain - 2, 964, yMain - 2, T.SCRAP);
    poi('survivor', 1072, 200, { id: 'sorrel' });
    poi('sample', 655, 169, { id: 'oeuf_coleo' });
    poi('sample', 920, 204, { id: 'graine_arbre' });
    poi('plan', 650, 169, { id: 'foreur' });
    poi('lore', 910, 204, { id: 'conduites' });
    poi('lore', 1056, 200, { id: 'sorrel_mur' });
    poi('cache', 735, 200, { items: { rouages: 3 } });
    poi('nest', 720, 186, { species: 'coleo', n: 6 });
    poi('nest', 980, 186, { species: 'coleo', n: 4 });
    poi('nest', 860, 186, { species: 'rodeur', n: 1 });
  }

  // --- 6. La Vallée des Colosses ----------------------------------------------------
  {
    // Sortie du tunnel
    G.fill(1182, 122, 1190, 127, T.AIR);
    G.fillBg(1182, 122, 1190, 127, BG.CONCRETE);
    // Squelette d'un ancien colosse
    const bx = 1200;
    for (let k = 0; k < 6; k++) {
      const rx = bx + k * 4;
      const hh = 10 + Math.round(Math.sin((k / 5) * Math.PI) * 8);
      for (let j = 0; j < hh; j++) {
        const xx = rx + Math.round(Math.sin((j / hh) * 1.4) * 3);
        world.raw(xx, surf(rx) - 1 - j, T.BONE);
      }
    }
    G.fill(bx - 6, surf(bx) - 4, bx - 1, surf(bx) - 1, T.BONE);
    G.fill(bx - 5, surf(bx) - 3, bx - 3, surf(bx) - 2, T.AIR);
    poi('sample', bx + 10, surf(bx + 10), { id: 'tissu_brouteur' });
    poi('lore', bx - 2, surf(bx), { id: 'squelette' });

    // La cale du chantier : bassin creusé, encombré de gravats, avec une rampe de sortie à l'est
    const { x0, x1, floor } = CALE;
    const rampStart = x0 + 72;
    const floorAt = (x) => (x < rampStart ? floor : Math.max(128, floor - Math.floor((x - rampStart) / 3)));
    for (let x = x0 - 2; x <= x1 + 2; x++) {
      const fx = floorAt(x);
      for (let y = 128; y <= fx; y++) {
        world.raw(x, y, T.AIR);
        world.rawBg(x, y, BG.CONCRETE);
      }
      world.raw(x, fx + 1, T.CONCRETE);
      world.raw(x, fx + 2, T.CONCRETE);
      for (let y = fx + 3; y <= floor + 2; y++) world.raw(x, y, T.CONCRETE);
      ground[x] = fx + 1;
    }
    G.fill(x0 - 4, 128, x0 - 3, floor + 2, T.CONCRETE);
    G.vline(x0 - 2, 127, floor, T.LADDER);
    // gravats à dégager
    for (let x = x0; x <= x1; x++) {
      const t = (x - x0) / (x1 - x0);
      const fx = floorAt(x);
      const hh = Math.min(fx - 128, Math.round(Math.sin(t * Math.PI) * 11 + 2 + hash1(x, 51) * 2));
      for (let k = 0; k < hh; k++) world.raw(x, fx - k, hash2(x, k, 52) > 0.84 ? T.SCRAP : T.RUBBLE);
    }
    // tours d'échafaudage et pont roulant
    for (const tx of [x0 - 9, x1 + 6]) {
      for (let y = 96; y < 128; y++) {
        world.raw(tx, y, T.TRUSS);
        world.raw(tx + 2, y, T.TRUSS);
        world.raw(tx + 1, y, T.LADDER);
      }
    }
    G.hline(x0 - 9, x1 + 8, 95, T.GIRDER);
    G.hline(x0 - 9, x1 + 8, 94, T.GRATE);
    G.set(x0 - 8, 95, T.LADDER);
    G.set(x0 - 8, 94, T.LADDER);
    G.set(x1 + 7, 95, T.LADDER);
    G.set(x1 + 7, 94, T.LADDER);
    // la rampe débouche sur la vallée : la tour est n'a pas de pied au sol
    for (let y = 120; y < 128; y++) {
      world.raw(x1 + 6, y, T.AIR);
      world.raw(x1 + 8, y, T.AIR);
    }
    // Bureau du chantier
    const ox0 = x1 + 12;
    const ox1 = x1 + 30;
    G.room(ox0, 117, ox1, 128, T.CONCRETE, BG.CONCRETE);
    G.fill(ox0, 125, ox0, 127, T.AIR);
    G.fill(ox1, 125, ox1, 127, T.AIR);
    G.hline(ox0 + 1, ox0 + 8, 122, T.PLATFORM);
    poi('chantier', Math.floor((x0 + x1) / 2), floor + 1, { x0, x1, floor });
    poi('forge', ox1 - 6, 128, {});
    poi('archives', ox0 + 4, 122, {});
    poi('lore', ox0 + 12, 128, { id: 'chantier' });

    // Massif rocheux traversé par une mégastructure
    for (let x = 1400; x <= 1436; x++) {
      const peak = 46 + Math.round(Math.abs(x - 1418) * 2.2 + hash1(x, 61) * 3);
      for (let y = peak; y < 128; y++) {
        world.raw(x, y, T.ROCK);
        if (y > peak + 2) world.rawBg(x, y, BG.ROCK);
      }
    }
    for (let x = 1398; x <= 1438; x++) {
      for (let y = 122; y <= 127; y++) {
        world.raw(x, y, T.AIR);
        world.rawBg(x, y, BG.CONCRETE);
      }
      world.raw(x, 121, T.CONCRETE);
      world.raw(x, 128, T.METAL);
    }
    // aqueduc haut, accessible depuis la tour d'échafaudage est
    const ax0 = x1 + 7;
    for (let x = ax0; x <= 1440; x++) {
      for (let y = 70; y <= 74; y++) {
        world.raw(x, y, T.AIR);
        world.rawBg(x, y, BG.CONCRETE);
      }
      world.raw(x, 69, T.CONCRETE);
      world.raw(x, 75, T.CONCRETE);
    }
    G.vline(ax0, 70, 93, T.LADDER);
    for (let y = 76; y < 94; y++) world.rawBg(ax0, y, BG.NONE);
    for (let x = ax0 + 10; x < 1400; x += 9) G.vline(x, 76, 93, T.TRUSS);
    poi('lore', 1420, 75, { id: 'aqueduc' });
    poi('cache', 1432, 75, { items: { rouages: 4 } });

    // Arène du Gardien et grande porte
    G.fill(1576, 120, 1590, 127, T.AIR);
    G.fillBg(1576, 120, 1590, 127, BG.METAL);
    G.hline(1576, 1590, 119, T.METAL);
    G.hline(1576, 1590, 128, T.METAL);
    G.fill(1578, 120, 1580, 127, T.METAL);
    poi('porte_gardien', 1578, 120, { x0: 1578, x1: 1580, y0: 120, y1: 127 });
    poi('gardien', 1500, 128, {});
    poi('lore', 1570, 128, { id: 'porte' });
  }

  // --- 7. La Serre-Matrice ----------------------------------------------------------
  {
    // Petite serre
    const dome = (cx, g, r, glass = true) => {
      for (let a = 0; a <= 180; a += 1) {
        const rad = (a * Math.PI) / 180;
        const x = Math.round(cx + Math.cos(rad) * r);
        const y = Math.round(g - Math.sin(rad) * r * 0.85);
        world.raw(x, y, a % 15 < 3 ? T.GIRDER : glass && hash1(a, 5) > 0.25 ? T.GLASS : T.AIR);
      }
      for (let x = cx - r + 1; x < cx + r; x++)
        for (let y = g - 1; y > g - r * 0.85; y--) {
          const dx = (x - cx) / r;
          const dy = (g - y) / (r * 0.85);
          if (dx * dx + dy * dy < 0.93) {
            world.raw(x, y, T.AIR);
            world.rawBg(x, y, BG.ORGANIC);
          }
        }
    };
    const g1 = surf(1640);
    dome(1640, g1, 18);
    for (let x = 1623; x <= 1657; x++) world.raw(x, g1, T.CONCRETE);
    G.fill(1622, g1 - 3, 1624, g1 - 1, T.AIR);
    G.fill(1630, g1 - 2, 1638, g1 - 1, T.CONCRETE);
    G.fill(1631, g1 - 1, 1637, g1 - 1, T.AIR);
    G.vline(1648, g1 - 14, g1 - 1, T.MEMBRANE);
    poi('chambre', 1644, g1, { id: 'petite_chambre', broken: true });
    poi('lore', 1634, g1, { id: 'serre' });

    // Racines géantes
    for (let k = 0; k < 5; k++) {
      const rx = 1664 + k * 11;
      const amp = 8 + hash1(k, 4) * 10;
      for (let i = 0; i < 18; i++) {
        const x = rx + i;
        const y = surf(x) - Math.round(Math.sin((i / 17) * Math.PI) * amp);
        world.raw(x, y, T.ROOT);
        world.raw(x, y + 1, T.ROOT);
      }
    }

    // Serre-Matrice : la grande salle
    const x0 = 1716;
    const x1 = 1846;
    const g = 120;
    const cx = Math.floor((x0 + x1) / 2);
    for (let x = x0; x <= x1; x++) {
      world.raw(x, g, T.CONCRETE);
      for (let y = g - 1; y > 40; y--) world.raw(x, y, T.AIR);
    }
    G.fill(x0, g - 14, x0 + 1, g, T.CONCRETE);
    G.fill(x1 - 1, g - 14, x1, g, T.CONCRETE);
    for (let a = 0; a <= 180; a += 0.5) {
      const rad = (a * Math.PI) / 180;
      const x = Math.round(cx + Math.cos(rad) * 65);
      const y = Math.round(g - 14 - Math.sin(rad) * 54);
      world.raw(x, y, Math.floor(a) % 12 < 2 ? T.GIRDER : hash1(Math.floor(a), 9) > 0.3 ? T.GLASS : T.AIR);
    }
    for (let x = x0 + 2; x < x1 - 1; x++)
      for (let y = g - 1; y > g - 68; y--) {
        const dx = (x - cx) / 64;
        const dy = Math.max(0, g - 14 - y) / 53;
        if (dx * dx + dy * dy < 0.97 || (y > g - 15 && Math.abs(x - cx) < 63)) world.rawBg(x, y, BG.ORGANIC);
      }
    G.fill(x0, g - 4, x0 + 1, g - 1, T.AIR);
    G.fill(x1 - 1, g - 4, x1, g - 1, T.AIR);
    // Racines de la Matrice (la Matrice elle-même est une structure dessinée)
    for (let k = -1; k <= 1; k += 2) {
      for (let i = 0; i < 26; i++) world.raw(cx + k * (11 + i), g - 2 - Math.round(Math.sin(i / 8) * 3), T.ROOT);
    }
    G.vline(cx, g - 40, g - 23, T.CHAIN);
    // passerelles
    G.hline(x0 + 4, x0 + 30, g - 20, T.GRATE);
    G.vline(x0 + 31, g - 20, g - 1, T.LADDER);
    G.hline(x1 - 30, x1 - 4, g - 20, T.GRATE);
    G.vline(x1 - 31, g - 20, g - 1, T.LADDER);
    // bassins
    for (let x = x0 + 8; x <= x0 + 22; x++) {
      world.raw(x, g + 1, T.CONCRETE);
      world.raw(x, g, T.WATER);
    }
    // archives sous la salle
    G.room(x1 - 40, g, x1 - 6, g + 12, T.CONCRETE, BG.CONCRETE);
    G.fill(x1 - 36, g, x1 - 35, g, T.AIR);
    G.vline(x1 - 36, g - 1, g + 11, T.LADDER);
    G.hline(x1 - 30, x1 - 10, g + 7, T.PLATFORM);
    poi('matrice', cx, g, {});
    poi('pod', x1 - 16, g - 20, { id: 'nadja' });
    poi('sample', x1 - 12, g + 7, { id: 'tissu_equilibre' });
    poi('sample', x1 - 24, g + 12, { id: 'empreinte' });
    poi('plan', x1 - 18, g + 12, { id: 'chambre' });
    poi('lore', x0 + 12, g - 20, { id: 'matrice' });
    poi('lore', x1 - 28, g + 12, { id: 'archives' });
  }

  // --- 8. L'Abîme ------------------------------------------------------------------
  {
    // débris de l'ancien pont
    G.hline(CHASM.x0, CHASM.x0 + 6, surf(CHASM.x0 - 1), T.GIRDER);
    G.hline(CHASM.x1 - 6, CHASM.x1, surf(CHASM.x1 + 1), T.GIRDER);
    G.set(CHASM.x0 + 7, surf(CHASM.x0 - 1) + 1, T.GIRDER);
    for (let x = CHASM.x0; x <= CHASM.x1; x++) for (let y = 120; y < 236; y++) if (world.get(x, y) !== T.GIRDER) world.rawBg(x, y, BG.NONE);
    // parois rocheuses dentelées
    for (let y = 121; y < 236; y++) {
      const a = Math.round(Math.sin(y / 7) * 2 + hash1(y, 3) * 2);
      for (let k = 0; k < a; k++) world.raw(CHASM.x0 + k, y, T.ROCK);
      const b = Math.round(Math.sin(y / 5) * 2 + hash1(y, 4) * 2);
      for (let k = 0; k < b; k++) world.raw(CHASM.x1 - k, y, T.ROCK);
    }
    poi('abime', CHASM.x0 - 2, surf(CHASM.x0 - 3), { x0: CHASM.x0, x1: CHASM.x1 });
    poi('lore', CHASM.x0 - 10, surf(CHASM.x0 - 10), { id: 'abime' });
    tower(1930, 24, 6);
    tower(2080, 30, 7);
    poi('lore', 2083, surf(2083), { id: 'autre_rive' });
  }

  // --- 9. Le Cœur -------------------------------------------------------------------
  {
    const x0 = 2200;
    const x1 = 2330;
    const cx = 2265;
    const g = 120;
    for (let x = x0; x <= x1; x++) {
      const t = (x - x0) / (x1 - x0);
      const top = Math.round(g - 20 - Math.sin(t * Math.PI) * 60);
      for (let y = top; y < g; y++) world.raw(x, y, hash2(x, y, 91) > 0.5 ? T.ORGANIC : T.ROOT);
    }
    // cavité centrale
    for (let x = x0 + 8; x <= x1 - 8; x++)
      for (let y = g - 1; y > g - 50; y--) {
        const dx = (x - cx) / 56;
        const dy = (g - y) / 46;
        if (dx * dx + dy * dy < 1) {
          world.raw(x, y, T.AIR);
          world.rawBg(x, y, BG.ORGANIC);
        }
      }
    G.fill(x0, g - 5, x0 + 10, g - 1, T.AIR);
    G.fillBg(x0, g - 5, x0 + 10, g - 1, BG.ORGANIC);
    G.fill(cx - 4, g - 30, cx + 4, g - 20, T.MEMBRANE);
    for (let k = 0; k < 6; k++) G.vline(cx - 20 + k * 8, g - 46 + (k % 2) * 4, g - 34, T.VINE);
    poi('coeur', cx, g, {});
    poi('lore', x0 + 14, g, { id: 'coeur' });
  }

  // --- 10. Finitions : lianes dans la fonderie, mousse ------------------------------
  for (let x = 520; x < 870; x++) {
    const g = world.surface(x);
    if (world.get(x, g) === T.SOIL && hash1(x, 101) > 0.7) world.raw(x, g, T.MOSSROCK);
  }

  world.finishGeneration();
  return { world, pois, ground };
}
