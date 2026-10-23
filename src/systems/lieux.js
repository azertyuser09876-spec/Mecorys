// Lieux habitables : un refuge fonde un lieu ; les structures proches partagent énergie et eau.
import { TILE, T } from '../world/tiles.js';
import { regionAt } from '../world/regions.js';

export const LIEU_RADIUS = 46; // en tuiles

const NAMES = {
  desert: 'L’Abri des dunes',
  fonderie: 'Le Refuge de la fonderie',
  reservoir: 'Le Refuge du lac',
  conduites: 'Le Terrier des conduites',
  vallee: 'Le Camp de la cale',
  serre: 'La Serre',
  abime: 'Le Bord',
  coeur: 'Le Seuil',
};

export class Lieux {
  constructor(game) {
    this.game = game;
    this.list = [];
    this.timer = 0;
  }

  // Recrée la liste à partir des refuges restaurés
  rebuild() {
    const old = new Map(this.list.map((l) => [l.refuge.id, l]));
    this.list = [];
    for (const s of this.game.structures) {
      if (s.type !== 'refuge' || s.ruined) continue;
      const prev = old.get(s.id);
      const r = regionAt(Math.floor(s.cx / TILE), Math.floor(s.cy / TILE));
      const lieu = prev || {
        id: s.id,
        name: s.data.name || this.uniqueName(NAMES[r.id] || 'Refuge'),
        refuge: s,
        water: 0,
        stock: 0,
        priority: 'equilibre',
      };
      lieu.refuge = s;
      s.data.name = lieu.name;
      lieu.tx = Math.floor(s.cx / TILE);
      lieu.ty = Math.floor((s.y + s.h) / TILE);
      lieu.region = r.id;
      this.list.push(lieu);
    }
    this.compute();
  }

  uniqueName(base) {
    let n = base;
    let k = 2;
    while (this.list.some((l) => l.name === n)) n = `${base} ${k++}`;
    return n;
  }

  lieuAt(tx, ty) {
    let best = null;
    let bd = Infinity;
    for (const l of this.list) {
      const d = Math.abs(l.tx - tx) + Math.abs(l.ty - ty) * 0.5;
      if (d <= LIEU_RADIUS && d < bd) {
        bd = d;
        best = l;
      }
    }
    return best;
  }

  update(dt) {
    this.timer -= dt;
    if (this.timer <= 0) {
      this.timer = 1;
      this.compute();
    }
  }

  // Bilan énergie / eau / abri de chaque lieu
  compute() {
    const game = this.game;
    const wind = game.env.wind;
    for (const l of this.list) {
      l.structs = [];
      l.energyProd = 0;
      l.energyUse = 0;
      l.waterProd = 0;
      l.waterUse = 0;
      l.beds = 0;
      l.has = {};
    }
    for (const s of game.structures) {
      if (s.ruined || s.def.found) continue;
      const l = this.lieuAt(Math.floor(s.cx / TILE), Math.floor((s.y + s.h) / TILE));
      s.lieu = l;
      if (!l) continue;
      l.structs.push(s);
      l.has[s.type] = (l.has[s.type] || 0) + 1;
      if (s.type === 'refuge') l.beds += s.def.capacity;
    }
    for (const l of this.list) {
      // eau
      for (const s of l.structs) {
        const w = s.def.water || 0;
        if (w > 0) {
          let p = w;
          if (s.type === 'pompe') p = nearWater(game.world, s) ? w : 0;
          if (s.type === 'citerne') p = w * (0.6 + game.ecology.humidityAt(l.tx) * 2);
          s.producing = p;
          l.waterProd += p;
        } else if (w < 0 && s.wantsWater !== false) l.waterUse += -w * (s.type === 'potager' && !s.data.crop ? 0 : 1);
      }
      // l'eau des conduites arrive dans les lieux de l'ouest une fois la vanne ouverte
      if (game.flags.vanne && l.tx < 870) l.waterProd += 2.5;
      if (game.flags.irrigation && l.tx < 520) l.waterProd += 2;
      if (l.survivors && l.survivors.some((s) => s.id === 'maelle')) l.waterProd *= 1.25;
      l.waterRatio = l.waterUse > 0 ? Math.min(1, l.waterProd / l.waterUse) : 1;
      // énergie
      for (const s of l.structs) {
        const e = s.def.energy || 0;
        if (e > 0) {
          let p = e;
          if (s.type === 'moulin') p = e * (0.3 + wind * 0.9);
          if (s.type === 'chaudiere') p = e * l.waterRatio;
          s.producing = p;
          s.active = p > 0.1;
          l.energyProd += p;
        } else if (e < 0) {
          const busy = s.type === 'pompe' || s.busy || s.type === 'etabli';
          if (busy) l.energyUse += -e;
        }
      }
      l.energyRatio = l.energyUse > 0 ? Math.min(1, l.energyProd / l.energyUse) : 1;
      for (const s of l.structs) {
        if ((s.def.energy || 0) < 0) {
          s.efficiency = l.energyRatio;
          if (s.type === 'pompe') s.active = l.energyRatio > 0.05 && s.producing > 0;
        }
        if ((s.def.water || 0) < 0 && s.type !== 'chaudiere') s.waterOk = l.waterRatio;
      }
    }
    for (const s of game.structures) if (!s.lieu && (s.def.energy || 0) < 0) s.efficiency = 0;
  }
}

function nearWater(world, s) {
  const tx0 = Math.floor(s.x / TILE) - 3;
  const tx1 = Math.floor((s.x + s.w) / TILE) + 3;
  const ty0 = Math.floor(s.y / TILE);
  const ty1 = Math.floor((s.y + s.h) / TILE) + 6;
  for (let y = ty0; y <= ty1; y++) for (let x = tx0; x <= tx1; x++) if (world.get(x, y) === T.WATER) return true;
  return false;
}
