// Réserve commune de ressources, échantillons et plans connus.
import { RESOURCES, SAMPLES } from '../data/items.js';

export class Inventory {
  constructor() {
    this.res = {};
    this.seen = {};
    for (const k in RESOURCES) this.res[k] = 0;
    this.samples = {}; // id -> nombre
    this.plans = new Set(); // plans connus
    this.foundPlans = new Set(); // plans trouvés (avantage de 5 %)
    this.items = {}; // objets uniques (clés, pièces)
  }

  add(id, n = 1) {
    if (!(id in this.res)) this.res[id] = 0;
    this.res[id] += n;
    this.seen[id] = true;
  }

  addAll(cost) {
    for (const [k, v] of Object.entries(cost || {})) this.add(k, v);
  }

  has(cost) {
    for (const [k, v] of Object.entries(cost || {})) if ((this.res[k] || 0) < v) return false;
    return true;
  }

  missing(cost) {
    const out = {};
    for (const [k, v] of Object.entries(cost || {})) if ((this.res[k] || 0) < v) out[k] = v - (this.res[k] || 0);
    return out;
  }

  pay(cost) {
    if (!this.has(cost)) return false;
    for (const [k, v] of Object.entries(cost || {})) this.res[k] -= v;
    return true;
  }

  addSample(id, n = 1) {
    this.samples[id] = (this.samples[id] || 0) + n;
  }

  hasSample(id) {
    return (this.samples[id] || 0) > 0;
  }

  sampleName(id) {
    return SAMPLES[id] ? SAMPLES[id].name : id;
  }

  toJSON() {
    return {
      res: this.res,
      seen: this.seen,
      samples: this.samples,
      plans: [...this.plans],
      foundPlans: [...this.foundPlans],
      items: this.items,
    };
  }

  static from(o) {
    const inv = new Inventory();
    Object.assign(inv.res, o.res || {});
    Object.assign(inv.seen, o.seen || {});
    Object.assign(inv.samples, o.samples || {});
    inv.plans = new Set(o.plans || []);
    inv.foundPlans = new Set(o.foundPlans || []);
    Object.assign(inv.items, o.items || {});
    return inv;
  }
}

// Coût réduit d'environ 5 % pour une construction faite d'après un plan éprouvé :
// mesures connues, découpe optimisée, pas de prototype raté.
export function planCost(cost, optimized) {
  const out = Object.assign({}, cost);
  if (!optimized) return out;
  const total = Object.values(cost).reduce((a, b) => a + b, 0);
  let cut = total >= 10 ? Math.max(1, Math.round(total * 0.05)) : 0;
  const keys = Object.keys(out)
    .filter((k) => out[k] > 2)
    .sort((a, b) => out[b] - out[a]);
  let i = 0;
  while (cut > 0 && keys.length) {
    const k = keys[i % keys.length];
    if (out[k] > 2) {
      out[k]--;
      cut--;
    }
    i++;
    if (i > 1000) break;
  }
  return out;
}
