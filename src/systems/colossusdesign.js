// Analyse d'un colosse : poids, énergie, chaleur, équilibre, fonctions, problèmes réparables.
import { CMODULES } from '../data/colossus.js';

export function cellAt(cells, x, y) {
  return cells.find((c) => c.x === x && c.y === y) || null;
}

// Les cases qui comptent : installées (ou toutes, pour un plan)
export function analyzeColossus(cells, opts = {}) {
  const use = opts.plan ? cells : cells.filter((c) => c.state === 'ok');
  const out = { weight: 0, energyProd: 0, energyUse: 0, heat: 0, carry: 0, balance: 0, armor: 0, fns: {}, reach: 0, loco: null, mind: false, issues: [], ok: false, legs: 0, tracks: 0 };
  for (const c of use) {
    const M = CMODULES[c.m];
    out.weight += M.weight;
    if (M.energy > 0) out.energyProd += M.energy;
    if (M.energy < 0) out.energyUse += -M.energy;
    out.heat += M.heat || 0;
    out.carry += M.carry || 0;
    out.balance += M.balance || 0;
    out.armor += M.armor || 0;
    if (M.fn) out.fns[M.fn] = (out.fns[M.fn] || 0) + 1;
    if (M.reach) out.reach += M.reach;
    if (M.mind) out.mind = true;
    if (M.loco === 'jambe') out.legs++;
    if (M.loco === 'chenille') out.tracks++;
  }
  out.energy = out.energyProd - out.energyUse;
  out.loco = out.legs >= out.tracks && out.legs ? 'jambe' : out.tracks ? 'chenille' : null;
  const I = (level, text) => out.issues.push({ level, text });
  if (!use.some((c) => c.m === 'commande') && !out.mind) I('erreur', 'Pas de salle de commande : personne ne peut le piloter.');
  if (!out.loco) I('erreur', 'Aucun moyen de se déplacer : jambes ou chenilles, sur la rangée du bas.');
  if (out.loco && out.carry < out.weight) I('erreur', `Trop lourd : poids ${out.weight} pour ${out.carry} de portance. Ajoute des jambes ou des chenilles, ou allège.`);
  if (out.legs && out.balance < 1) I('erreur', 'Déséquilibre : des jambes sans organe d’équilibre ni gyroscope, il tomberait au premier pas.');
  if (out.energyProd === 0) I('erreur', 'Aucune source d’énergie : il faut une chaudière colossale.');
  else if (out.energy < 0) I('erreur', `Manque de puissance : ${out.energy}. Ajoute une chaudière ou retire des fonctions.`);
  if (out.heat > 0) I('erreur', `Surchauffe : ${out.heat}. Ajoute du refroidissement.`);
  // pieds sur la rangée du bas, rien dessous
  for (const c of use) {
    const M = CMODULES[c.m];
    if (M.pos === 'bas' && cellAt(use, c.x, c.y + 1)) I('erreur', `${M.name} : doit être tout en bas.`);
  }
  // connexions
  const start = use.find((c) => c.m === 'commande') || use.find((c) => CMODULES[c.m].mind) || use[0];
  if (start) {
    const seen = new Set([start.x + ',' + start.y]);
    const st = [start];
    while (st.length) {
      const c = st.pop();
      for (const [dx, dy] of [
        [1, 0],
        [-1, 0],
        [0, 1],
        [0, -1],
      ]) {
        const n = cellAt(use, c.x + dx, c.y + dy);
        if (n && !seen.has(n.x + ',' + n.y)) {
          seen.add(n.x + ',' + n.y);
          st.push(n);
        }
      }
    }
    const loose = use.filter((c) => !seen.has(c.x + ',' + c.y)).length;
    if (loose) I('erreur', `${loose} module(s) détaché(s) du reste.`);
  }
  if (!opts.plan) {
    const broken = cells.filter((c) => c.state === 'endommage').length;
    const missing = cells.filter((c) => c.state === 'manquant' || c.state === 'livre' || c.state === 'plan').length;
    if (broken) I('attention', `${broken} module(s) endommagé(s) à réparer.`);
    if (missing) I('attention', `${missing} module(s) encore absent(s).`);
  }
  out.ok = !out.issues.some((i) => i.level === 'erreur');
  return out;
}

export function colossusCost(cells) {
  const cost = {};
  for (const c of cells) for (const [k, v] of Object.entries(CMODULES[c.m].cost || {})) cost[k] = (cost[k] || 0) + v;
  return cost;
}

export function fnLabels(a) {
  const L = { excavation: 'excavation', pont: `pont (${a.reach} cases)`, restauration: 'restauration des terres', eau: 'transport d’eau', base: 'base mobile', arme: 'arme', };
  return Object.keys(a.fns).map((k) => L[k] || k);
}
