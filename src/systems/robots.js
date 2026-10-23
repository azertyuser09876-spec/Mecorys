// Gestion des robots : plans, fabrication aux établis, ordres, pilotage.
import { TILE } from '../world/tiles.js';
import { FOUND_DESIGNS, START_MODULES, MODULES } from '../data/modules.js';
import { analyze, designCost, normalize } from './robotdesign.js';
import { planCost } from './inventory.js';
import { Robot, ORDERS } from '../entities/robot.js';
import { openDesigner } from '../ui/designer.js';
import { el, clear } from '../ui/dom.js';
import { RESOURCES } from '../data/items.js';
import { PLANTS } from '../data/species.js';

function sig(cells) {
  return normalize(cells)
    .map((c) => `${c.x},${c.y},${c.m}`)
    .sort()
    .join('|');
}

export class Robots {
  constructor(game) {
    this.game = game;
    this.designs = []; // { id, name, cells, found, proto }
    this.queues = {}; // id d'établi -> travaux
    this.extraModules = new Set();
    this.lastDesign = null;
    this.built = 0;
  }

  get list() {
    return this.game.entities.filter((e) => e.kind === 'robot');
  }

  unlockedModules() {
    const s = new Set(START_MODULES);
    for (const m of this.extraModules) s.add(m);
    return s;
  }

  planName(id) {
    return FOUND_DESIGNS[id] ? 'Robot ' + FOUND_DESIGNS[id].name : null;
  }

  onPlan(id) {
    const d = FOUND_DESIGNS[id];
    if (!d) return;
    if (!this.designs.some((x) => x.id === id)) this.designs.push({ id, name: d.name, cells: d.cells.map((c) => ({ ...c })), found: true, proto: true });
    for (const m of d.unlocks) this.extraModules.add(m);
    for (const c of d.cells) this.extraModules.add(c.m);
  }

  sameAsSource(cells, srcId) {
    const d = this.designs.find((x) => x.id === srcId);
    return d && sig(d.cells) === sig(cells);
  }

  // Coût de fabrication : un plan éprouvé (trouvé, ou déjà prototypé) coûte ~5 % de moins.
  costFor(cells, srcId) {
    const raw = designCost(cells);
    const d = srcId && this.designs.find((x) => x.id === srcId);
    if (d && sig(d.cells) === sig(cells)) {
      if (d.found || d.proto) return { cost: planCost(raw, true), optimized: true };
      return { cost: raw, optimized: false, why: 'Premier prototype de ce plan : coût normal. Les exemplaires suivants coûteront moins.' };
    }
    return { cost: raw, optimized: false, why: 'Conception libre : enregistre-la comme plan, puis les copies coûteront moins.' };
  }

  saveDesign(state) {
    const s = sig(state.cells);
    let d = this.designs.find((x) => !x.found && sig(x.cells) === s);
    if (!d) {
      d = { id: 'p' + Date.now().toString(36), name: state.name || 'Robot', cells: normalize(state.cells), found: false, proto: false };
      this.designs.push(d);
      this.game.toast(`Plan « ${d.name} » enregistré.`, 'good');
    } else {
      d.name = state.name || d.name;
      this.game.toast(`Plan « ${d.name} » mis à jour.`);
    }
    state.source = d.id;
    return d;
  }

  queueOf(etabli) {
    return (this.queues[etabli.id] = this.queues[etabli.id] || []);
  }

  fabricate(etabli, state, cost) {
    const game = this.game;
    const a = analyze(state.cells);
    if (!a.ok) return;
    if (!game.inv.pay(cost)) {
      game.toast('Ressources insuffisantes.', 'bad');
      return;
    }
    const q = this.queueOf(etabli);
    q.push({ name: state.name, cells: normalize(state.cells), source: state.source, progress: 0, total: 6 + state.cells.length * 1.6 });
    game.audio && game.audio.sfx('build');
    game.toast(`Fabrication lancée : ${state.name}.`);
  }

  update(dt) {
    const game = this.game;
    for (const s of game.structures) {
      if (s.type !== 'etabli' || s.ruined) continue;
      const q = this.queues[s.id];
      s.working = !!(q && q.length);
      s.busy = s.working;
      if (!q || !q.length) continue;
      const job = q[0];
      // à la main sans énergie, deux fois plus vite avec
      const e = s.lieu ? 0.5 + 0.5 * (s.lieu.energyRatio || 0) * (s.lieu.energyProd > 0 ? 1 : 0) : 0.5;
      const bonus = game.survivors ? game.survivors.bonus('robots') : 1;
      job.progress += dt * e * bonus;
      if (Math.random() < dt * 3) game.particles.sparks(s.x + s.w * 0.7, s.y + 6, 2);
      if (job.progress >= job.total) {
        q.shift();
        const r = new Robot({ id: job.source, name: job.name, cells: job.cells }, s.cx + 20, s.y + s.h);
        game.entities.push(r);
        this.built++;
        const d = job.source && this.designs.find((x) => x.id === job.source);
        if (d && !d.proto) {
          d.proto = true;
          game.toast(`Prototype « ${d.name} » réussi : les prochains exemplaires profiteront du plan.`, 'good');
        }
        game.toast(`${job.name} est prêt. Donne-lui un ordre avec ${game.input.label('orders')}.`, 'good');
        game.note('robot');
        game.audio && game.audio.sfx('robot');
        game.ui.refreshPanel();
      }
    }
  }

  structurePrompt(s) {
    if (s.type !== 'etabli') return null;
    const q = this.queues[s.id] || [];
    return { text: 'Concevoir un robot', info: q.length ? `fabrication : ${Math.round((q[0].progress / q[0].total) * 100)} %` : '' };
  }

  structureInteract(s) {
    if (s.type !== 'etabli') return false;
    openDesigner(this.game, s);
    this.game.audio && this.game.audio.sfx('ui_open');
    return true;
  }

  onRestored(s) {
    if (s.type === 'etabli') this.game.note('etabli');
  }

  onKeys(input) {
    const game = this.game;
    if (input.hit('orders')) this.openOrders();
    if (input.hit('machine')) {
      const p = game.player;
      if (p.riding) p.riding.dismount(game);
      else {
        let best = null;
        let bd = 40;
        for (const r of this.list) {
          if (!r.a.seat) continue;
          const d = Math.hypot(r.cx - p.cx, r.cy - p.cy);
          if (d < bd) {
            bd = d;
            best = r;
          }
        }
        if (best) {
          best.rider = p;
          p.riding = best;
          game.toast(`Aux commandes de ${best.name}. ${game.input.label('machine')} pour descendre.`);
          game.audio && game.audio.sfx('click');
        } else if (this.game.colossi.length) {
          for (const c of this.game.colossi) if (c.tryPilot && c.tryPilot(game)) return;
        }
      }
    }
  }

  depotFor(robot) {
    let best = null;
    let bd = Infinity;
    for (const s of this.game.structures) {
      if (s.ruined || !(s.type === 'depot' || s.type === 'refuge')) continue;
      const d = Math.abs(s.cx - robot.cx) + Math.abs(s.cy - robot.cy) * 2 + (s.type === 'depot' ? 0 : 200);
      if (d < bd) {
        bd = d;
        best = s;
      }
    }
    return best;
  }

  deposited(robot, cargo) {
    const txt = Object.entries(cargo)
      .map(([k, v]) => `${v} ${(RESOURCES[k] || { name: k }).name.toLowerCase()}`)
      .join(', ');
    if (txt) this.game.toast(`${robot.name} a déposé ${txt}.`);
  }

  sow(robot, tx, ty, dt) {
    const game = this.game;
    const inv = game.inv;
    robot.sowT = (robot.sowT || 0) + dt;
    if (robot.sowT < 3) return;
    robot.sowT = 0;
    const z = game.ecology.zoneAt(tx, ty);
    if (!z) return;
    for (const id in inv.seeds) {
      if (inv.seeds[id] <= 0) continue;
      const P = game.ecology.speciesDef(id);
      if (!P) continue;
      if ((z.plants[id] || 0) > 0.04) continue;
      if (game.ecology.humidity(z) < (P.humidity || 0)) continue;
      inv.seeds[id]--;
      game.ecology.plant(id, tx, ty, 0.07);
      game.toast(`${robot.name} a semé ${P.name.toLowerCase()}.`, 'good');
      return;
    }
  }

  siteFor(robot) {
    const sites = this.game.sites || [];
    let best = null;
    let bd = Infinity;
    const ax = robot.order.ax !== undefined ? robot.order.ax : robot.cx;
    for (const s of sites) {
      if (s.done) continue;
      const d = Math.abs(s.x - ax);
      if (d < 120 * TILE && d < bd) {
        bd = d;
        best = s;
      }
    }
    return best;
  }

  crateFor(robot) {
    const crates = this.game.crates || [];
    let best = null;
    let bd = Infinity;
    for (const c of crates) {
      if (c.carrier || c.delivered) continue;
      const d = Math.abs(c.cx - robot.cx);
      if (d < bd) {
        bd = d;
        best = c;
      }
    }
    return best;
  }

  // --- Panneau des ordres -----------------------------------------------------------
  openOrders(focus) {
    const game = this.game;
    const list = this.list.sort((a, b) => Math.abs(a.cx - game.player.cx) - Math.abs(b.cx - game.player.cx));
    if (!list.length) {
      game.toast('Tu n’as encore aucun robot. Restaure ou construis un établi.');
      return;
    }
    game.ui.openPanel(
      'Ordres aux robots',
      (body) => {
        const render = () => {
          clear(body);
          body.append(el('p', { class: 'muted' }, 'Les robots obéissent à des ordres précis. « Ici » désigne l’endroit où tu te trouves.'));
          for (const r of list) {
            const a = r.a;
            const p = game.player;
            const here = { ax: p.cx, ay: p.cy };
            const dist = Math.round(Math.abs(r.cx - p.cx) / TILE);
            const card = el('div', { class: 'card r-card' + (r === focus ? ' focus' : '') });
            const nameIn = el('input', { class: 'r-name', value: r.name, maxlength: 20 });
            nameIn.addEventListener('change', () => (r.name = nameIn.value || r.name));
            card.append(el('div', { class: 'row' }, nameIn, el('span', { class: 'muted grow' }, `${r.statusText(game)} · à ${dist} cases`)));
            const b = (label, order, ok, why) =>
              el(
                'button',
                {
                  class: 'btn small' + (r.order.type === order.type && (!order.res || r.order.res === order.res) ? ' primary' : ''),
                  disabled: !ok,
                  title: ok ? '' : why,
                  onclick: () => {
                    r.setOrder(order);
                    game.audio && game.audio.sfx('click');
                    render();
                  },
                },
                label,
              );
            const harvest = a.tools.has('main') || a.tools.has('foreuse');
            const row = el(
              'div',
              { class: 'r-orders' },
              b('Suivre', { type: 'suivre' }, true),
              b('Attendre ici', { type: 'attendre', ...here }, true),
              b('Récolter ici', { type: 'recolter', res: 'tout', ...here }, harvest, 'Il faut une pince ou une foreuse.'),
              ...['ferraille', 'pierre', 'fibre', 'biomasse'].map((res) => b(RESOURCES[res].name, { type: 'recolter', res, ...here }, harvest, 'Il faut une pince ou une foreuse.')),
              b('Déblayer ici', { type: 'deblayer', ...here }, harvest, 'Il faut une pince ou une foreuse.'),
              b('Arroser ici', { type: 'arroser', ...here }, a.tools.has('eau'), 'Il faut un arroseur.'),
              b('Chantier', { type: 'construire', ...here }, a.tools.has('soudure') || a.tools.has('main'), 'Il faut une soudeuse (ou au moins une pince).'),
              b('Livrer les caisses', { type: 'livrer', ...here }, a.crane, 'Il faut un bras de levage.'),
            );
            card.append(row);
            body.append(card);
          }
        };
        render();
        return render;
      },
      { toggleKey: 'orders' },
    );
  }

  toJSON() {
    return { designs: this.designs, queues: this.queues, extra: [...this.extraModules], robots: this.list.map((r) => r.toJSON()), built: this.built };
  }

  load(o) {
    if (!o) return;
    this.designs = o.designs || [];
    this.queues = o.queues || {};
    this.extraModules = new Set(o.extra || []);
    this.built = o.built || 0;
    for (const d of o.robots || []) {
      const r = new Robot({ id: d.designId, name: d.name, cells: d.cells }, d.x, d.y, { id: d.id, name: d.name, order: d.order, cargo: d.cargo });
      this.game.entities.push(r);
    }
  }
}

export function seedsAvailable(game) {
  return Object.entries(game.inv.seeds).filter(([id, n]) => n > 0 && (PLANTS[id] || game.ecology.custom[id]));
}
