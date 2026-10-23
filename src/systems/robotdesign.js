// Analyse d'une conception de robot : coût, poids, énergie, équilibre, problèmes lisibles.
import { MODULES, GRID_W, GRID_H } from '../data/modules.js';

const BASE_SPEED = { roue: 70, chenille: 36, patte: 46, ballon: 44 };
const STEP = { roue: 0, chenille: 16, patte: 32, ballon: 0 };

export function cellAt(cells, x, y) {
  return cells.find((c) => c.x === x && c.y === y) || null;
}

export function designCost(cells) {
  const cost = {};
  for (const c of cells) for (const [k, v] of Object.entries(MODULES[c.m].cost)) cost[k] = (cost[k] || 0) + v;
  return cost;
}

export function analyze(cells) {
  const out = {
    weight: 0,
    energyProd: 0,
    energyUse: 0,
    carry: 0,
    lift: 0,
    cargo: 3,
    tools: new Set(),
    seat: false,
    crane: false,
    light: false,
    loco: null,
    issues: [], // { level: 'erreur'|'attention', text, cells? }
    bad: new Set(), // index des cases en défaut
    cog: null,
    support: null,
    stable: true,
    ok: false,
    speed: 0,
    stepUp: 0,
    flies: false,
    climbs: false,
    armor: 0,
    w: 0,
    h: 0,
  };
  if (!cells.length) {
    out.issues.push({ level: 'erreur', text: 'Aucun module : commence par un noyau de commande.' });
    return out;
  }
  // boîte englobante
  let minX = Infinity,
    minY = Infinity,
    maxX = -Infinity,
    maxY = -Infinity;
  for (const c of cells) {
    minX = Math.min(minX, c.x);
    maxX = Math.max(maxX, c.x);
    minY = Math.min(minY, c.y);
    maxY = Math.max(maxY, c.y);
  }
  out.bounds = { minX, minY, maxX, maxY };
  out.w = maxX - minX + 1;
  out.h = maxY - minY + 1;
  const locos = {};
  let mx = 0;
  for (let i = 0; i < cells.length; i++) {
    const c = cells[i];
    const M = MODULES[c.m];
    out.weight += M.weight;
    mx += (c.x + 0.5) * M.weight;
    if (M.energy > 0) out.energyProd += M.energy;
    if (M.energy < 0) out.energyUse += -M.energy;
    if (M.carry) out.carry += M.carry;
    if (M.lift) out.lift += M.lift;
    if (M.cargo) out.cargo += M.cargo;
    if (M.tool) out.tools.add(M.tool);
    if (M.seat) out.seat = true;
    if (M.crane) out.crane = true;
    if (M.light) out.light = true;
    if (M.armor) out.armor += M.armor;
    if (M.loco) locos[M.loco] = (locos[M.loco] || 0) + 1;
    // contraintes de position
    if (M.pos === 'bas' && cellAt(cells, c.x, c.y + 1)) {
      out.issues.push({ level: 'erreur', text: `${M.name} : rien ne doit se trouver dessous, il faut toucher le sol.` });
      out.bad.add(i);
    }
    if (M.pos === 'haut' && cellAt(cells, c.x, c.y - 1)) {
      out.issues.push({ level: 'erreur', text: `${M.name} : doit être au sommet, rien au-dessus.` });
      out.bad.add(i);
    }
  }
  out.cog = mx / out.weight;
  // noyau
  const cores = cells.filter((c) => c.m === 'noyau');
  if (cores.length === 0) out.issues.push({ level: 'erreur', text: 'Il faut un noyau de commande.' });
  if (cores.length > 1) {
    out.issues.push({ level: 'erreur', text: 'Un seul noyau de commande est permis.' });
    cells.forEach((c, i) => c.m === 'noyau' && out.bad.add(i));
  }
  // connexions depuis le noyau
  if (cores.length >= 1) {
    const seen = new Set();
    const stack = [cores[0]];
    const key = (c) => c.x + ',' + c.y;
    seen.add(key(cores[0]));
    while (stack.length) {
      const c = stack.pop();
      for (const [dx, dy] of [
        [1, 0],
        [-1, 0],
        [0, 1],
        [0, -1],
      ]) {
        const n = cellAt(cells, c.x + dx, c.y + dy);
        if (n && !seen.has(key(n))) {
          seen.add(key(n));
          stack.push(n);
        }
      }
    }
    let loose = 0;
    cells.forEach((c, i) => {
      if (!seen.has(key(c))) {
        out.bad.add(i);
        loose++;
      }
    });
    if (loose) out.issues.push({ level: 'erreur', text: `${loose} module${loose > 1 ? 's' : ''} non relié${loose > 1 ? 's' : ''} au noyau.` });
  }
  // déplacement
  const ground = ['roue', 'chenille', 'patte'].filter((k) => locos[k]);
  if (locos.ballon && out.lift >= out.weight) {
    out.loco = 'ballon';
    out.flies = true;
  } else if (ground.length) {
    // la locomotion la plus lente dicte l'allure
    out.loco = ground.sort((a, b) => BASE_SPEED[a] - BASE_SPEED[b])[0];
    if (locos.patte && ground.length === 1) out.climbs = true;
  }
  if (!out.loco) {
    if (locos.ballon) out.issues.push({ level: 'erreur', text: `Le ballon ne soulève que ${out.lift} pour un poids de ${fmt(out.weight)} : ajoute un ballon ou allège.` });
    else out.issues.push({ level: 'erreur', text: 'Aucun moyen de se déplacer : ajoute des roues, des chenilles, des pattes ou un ballon.' });
  }
  if (out.loco && !out.flies && out.carry < out.weight) {
    out.issues.push({ level: 'erreur', text: `Trop lourd : poids ${fmt(out.weight)} pour une capacité de ${out.carry}.` });
  }
  // énergie
  out.energy = out.energyProd - out.energyUse;
  if (out.energyUse > 0 && out.energyProd === 0) out.issues.push({ level: 'erreur', text: 'Aucune source d’énergie : ajoute une batterie ou une chaudière.' });
  else if (out.energy < 0) out.issues.push({ level: 'attention', text: `Énergie insuffisante (${fmt(out.energy)}) : le robot travaillera au ralenti.` });
  // équilibre : le centre de gravité doit rester au-dessus de l'appui
  if (out.loco && !out.flies) {
    const feet = cells.filter((c) => MODULES[c.m].loco && MODULES[c.m].loco !== 'ballon');
    const lo = Math.min(...feet.map((c) => c.x));
    const hi = Math.max(...feet.map((c) => c.x)) + 1;
    out.support = { lo, hi };
    const margin = feet.length === 1 ? 0.15 : 0;
    if (out.cog < lo - margin || out.cog > hi + margin) {
      out.stable = false;
      out.issues.push({ level: 'erreur', text: 'Déséquilibré : le centre de gravité sort de l’appui, le robot basculerait.' });
    }
  }
  if (out.flies) {
    const balloons = cells.filter((c) => c.m === 'ballon');
    const lo = Math.min(...balloons.map((c) => c.x));
    const hi = Math.max(...balloons.map((c) => c.x)) + 1;
    out.support = { lo, hi, top: true };
    if (out.cog < lo - 0.6 || out.cog > hi + 0.6) {
      out.stable = false;
      out.issues.push({ level: 'erreur', text: 'Le ballon tirerait de travers : centre-le au-dessus de la masse.' });
    }
  }
  // allure
  if (out.loco) {
    const ratio = out.energyUse > 0 ? Math.min(1, out.energyProd / out.energyUse) : 1;
    const load = out.flies ? Math.min(1, out.lift / out.weight) : Math.min(1, out.carry / Math.max(1, out.weight));
    out.energyRatio = ratio;
    out.speed = Math.round(BASE_SPEED[out.loco] * (0.4 + 0.6 * ratio) * (0.6 + 0.4 * load) * (out.weight > 8 ? 0.85 : 1));
    out.stepUp = STEP[out.loco];
    if (locos.patte && out.loco === 'patte') out.stepUp = STEP.patte;
  }
  if (!out.tools.size && !out.seat && !out.crane && out.cargo <= 3)
    out.issues.push({ level: 'attention', text: 'Ce robot n’a ni outil ni siège : il ne pourra que suivre.' });
  out.ok = !out.issues.some((i) => i.level === 'erreur');
  return out;
}

export function normalize(cells) {
  // ramène la conception dans le coin supérieur gauche de la grille
  if (!cells.length) return cells;
  const minX = Math.min(...cells.map((c) => c.x));
  const minY = Math.min(...cells.map((c) => c.y));
  return cells.map((c) => ({ x: c.x - minX, y: c.y - minY, m: c.m }));
}

export function fits(cells) {
  return cells.every((c) => c.x >= 0 && c.y >= 0 && c.x < GRID_W && c.y < GRID_H);
}

function fmt(v) {
  return Number.isInteger(v) ? String(v) : v.toFixed(1);
}

export function capabilities(a) {
  const out = [];
  if (a.tools.has('main')) out.push('récolte');
  if (a.tools.has('foreuse')) out.push('forage');
  if (a.tools.has('eau')) out.push('arrosage');
  if (a.tools.has('soudure')) out.push('chantier');
  if (a.crane) out.push('levage');
  if (a.seat) out.push('pilotable');
  if (a.flies) out.push('vol');
  if (a.climbs) out.push('escalade');
  return out;
}
