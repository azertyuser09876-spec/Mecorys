// Le carnet : notes, réserves, plans, lieux, vivant, survivants, commandes.
import { el, clear, canvasEl } from './dom.js';
import { RESOURCES, RES_ORDER, SAMPLES, drawResIcon, costText } from '../data/items.js';
import { STRUCT } from '../data/structures.js';
import { PLANTS, ANIMALS } from '../data/species.js';
import { PRIORITIES } from '../data/survivors.js';
import { FOUND_DESIGNS } from '../data/modules.js';
import { renderStock } from './lifepanel.js';

let lastTab = 'carnet';

export function openJournal(game, tab) {
  if (tab) lastTab = tab;
  game.ui.openPanel(
    'Carnet',
    (body) => {
      const render = () => {
        clear(body);
        const tabs = el('div', { class: 'tabs' });
        const T = [
          ['carnet', 'Notes'],
          ['reserves', 'Réserves'],
          ['vivant', 'Vivant'],
          ['lieux', 'Lieux'],
          ['gens', 'Survivants'],
          ['plans', 'Plans'],
          ['aide', 'Commandes'],
        ];
        for (const [id, name] of T) tabs.append(el('button', { class: 'tab' + (lastTab === id ? ' on' : ''), onclick: () => ((lastTab = id), render()) }, name));
        body.append(tabs);
        const fn = TABS[lastTab];
        if (fn) fn(game, body, render);
      };
      render();
      return render;
    },
    { toggleKey: 'journal', cls: 'wide' },
  );
}

const TABS = {
  carnet(game, body) {
    const days = game.env.day;
    body.append(el('p', { class: 'muted' }, `Jour ${days}. Ce que j’ai vu, ce que je dois faire.`));
    const list = el('div', { class: 'col' });
    for (const j of [...game.journal].reverse()) list.append(el('div', { class: 'card' }, el('div', { class: 'muted small' }, `Jour ${j.day}, ${j.hour} h`), el('div', {}, j.text)));
    if (!game.journal.length) list.append(el('p', {}, 'Rien encore.'));
    body.append(list);
    const goal = game.story ? game.story.currentGoal() : null;
    if (goal) body.prepend(el('div', { class: 'card goal' }, el('div', { class: 'muted small' }, 'Ce qui me semble le plus urgent'), el('div', {}, goal)));
  },

  reserves(game, body, render) {
    const inv = game.inv;
    const grid = el('div', { class: 'list' });
    for (const k of RES_ORDER) {
      const c = canvasEl(20, 20);
      drawResIcon(c.getContext('2d'), k, 10, 10, 14);
      grid.append(el('div', { class: 'card row' }, c, el('div', { class: 'grow' }, el('div', {}, `${RESOURCES[k].name} : ${inv.res[k] || 0}`), el('div', { class: 'muted small' }, RESOURCES[k].desc))));
    }
    body.append(el('h3', {}, 'Ressources'), grid);
    const samples = Object.entries(inv.samples).filter(([, n]) => n > 0);
    body.append(el('h3', {}, 'Modèles vivants'));
    if (!samples.length) body.append(el('p', { class: 'muted' }, 'Aucun. Les ruines en cachent : graines, œufs, tissus.'));
    const sl = el('div', { class: 'list' });
    for (const [id] of samples) sl.append(el('div', { class: 'card' }, el('h3', {}, SAMPLES[id].name), el('div', { class: 'muted small' }, SAMPLES[id].desc)));
    body.append(sl);
    body.append(el('h3', {}, 'Graines et jeunes'));
    renderStock(game, body, render);
  },

  vivant(game, body) {
    const { plants, fauna } = game.ecology.totals();
    body.append(el('p', { class: 'muted' }, 'Ce qui vit dans le monde. Les animaux suivent leur nature : ils vont là où il y a de quoi manger.'));
    const list = el('div', { class: 'list' });
    const all = { ...PLANTS, ...ANIMALS, ...game.ecology.custom };
    for (const id in all) {
      const d = all[id];
      const v = plants[id] !== undefined ? plants[id] : fauna[id];
      if (!v || v < 0.05) continue;
      const amount = plants[id] !== undefined ? `couverture ${Math.round(v * 10) / 10}` : `${Math.round(v)} individus`;
      list.append(el('div', { class: 'card' }, el('h3', {}, d.name + (d.custom ? ' ✦' : '')), el('div', { class: 'muted small' }, d.desc), el('div', { class: 'small' }, amount)));
    }
    if (!list.childNodes.length) list.append(el('p', {}, 'Presque rien. Un peu de mousse, peut-être, dans les endroits humides.'));
    body.append(list);
    const green = Math.round(game.ecology.greenRatio(0, 520) * 100);
    body.append(el('p', { class: 'muted' }, `Les Dunes Muettes sont vertes à ${green} %.`));
  },

  lieux(game, body, render) {
    if (!game.lieux.list.length) {
      body.append(el('p', {}, 'Aucun lieu habitable. Restaure l’abri du désert, ou construis un refuge.'));
      return;
    }
    for (const l of game.lieux.list) {
      const res = game.survivors.residents(l);
      const sel = el('select', { class: 'd-select' });
      for (const k in PRIORITIES) sel.append(el('option', { value: k, selected: l.priority === k }, PRIORITIES[k]));
      sel.addEventListener('change', () => {
        game.survivors.setPriority(l, sel.value);
        render();
      });
      const e = `${(l.energyProd || 0).toFixed(1)} / ${(l.energyUse || 0).toFixed(1)}`;
      const w = `${(l.waterProd || 0).toFixed(1)} / ${(l.waterUse || 0).toFixed(1)}`;
      body.append(
        el(
          'div',
          { class: 'card' },
          el('h3', {}, l.name),
          el('div', { class: 'row small' }, el('span', { class: l.energyRatio < 1 ? 'ko' : '' }, `Énergie ${e}`), el('span', { class: l.waterRatio < 1 ? 'ko' : '' }, `Eau ${w}`), el('span', {}, `Couchages ${l.beds}`), el('span', {}, `Habitants ${res.length}`)),
          el('div', { class: 'small muted' }, 'Structures : ' + Object.entries(l.has || {}).map(([k, n]) => `${STRUCT[k].name}${n > 1 ? ' ×' + n : ''}`).join(', ')),
          el('div', { class: 'row small' }, el('span', { class: 'muted' }, 'Grande priorité :'), sel, el('span', { class: 'muted' }, 'Les habitants s’organisent seuls ; ils peuvent refuser.')),
          res.length ? el('div', { class: 'small' }, res.map((s) => `${s.name} ${game.survivors.statusOf(s).split(' · ').slice(1).join(', ')}`).join(' — ')) : null,
        ),
      );
    }
  },

  gens(game, body) {
    const met = game.survivors.list.filter((s) => s.met);
    if (!met.length) body.append(el('p', {}, 'Personne. Le monde est presque vide. Presque.'));
    for (const s of met) {
      const def = game.survivors.defOf(s.id);
      body.append(el('div', { class: 'card' }, el('h3', {}, `${s.name} — ${def.role}`), el('div', { class: 'small' }, s.home ? game.survivors.statusOf(s) : def.stays ? 'Reste chez soi.' : `Attend : ${def.needText}.`), el('div', { class: 'muted small' }, def.skillText)));
    }
  },

  plans(game, body) {
    body.append(el('p', { class: 'muted' }, 'Construire d’après un plan trouvé coûte environ 5 % de ressources en moins : mesures éprouvées, découpe optimisée, pas de prototype raté.'));
    const list = el('div', { class: 'list' });
    for (const id in STRUCT) {
      const d = STRUCT[id];
      if (d.found) continue;
      const known = !d.plan || game.inv.plans.has(d.plan);
      if (!known) continue;
      list.append(el('div', { class: 'card' }, el('h3', {}, d.name + (game.inv.foundPlans.has(d.plan || id) ? ' 📜' : '')), el('div', { class: 'muted small' }, d.desc), el('div', { class: 'small' }, costText(d.cost))));
    }
    for (const d of game.robots.designs) list.append(el('div', { class: 'card' }, el('h3', {}, 'Robot ' + d.name + (d.found ? ' 📜' : ' ✎')), el('div', { class: 'muted small' }, d.found ? FOUND_DESIGNS[d.id].desc : d.proto ? 'Plan personnel éprouvé.' : 'Plan personnel, pas encore prototypé.')));
    if (game.colossusSys) for (const c of game.colossusSys.knownModules()) list.append(el('div', { class: 'card' }, el('h3', {}, 'Module : ' + c.name), el('div', { class: 'muted small' }, c.desc)));
    body.append(list);
  },

  aide(game, body) {
    const k = (a) => `<kbd>${game.input.label(a)}</kbd>`;
    body.append(
      el('div', {
        class: 'help',
        html: `
        <p>${k('left')}${k('right')} marcher · ${k('run')} courir · ${k('jump')} sauter · ${k('up')}${k('down')} grimper, nager, descendre d’une passerelle</p>
        <p>${k('interact')} interagir · <b>clic gauche</b> démanteler avec l’outil</p>
        <p>${k('build')} mode construction · ${k('orders')} ordres aux robots · ${k('machine')} monter dans une machine ou en descendre</p>
        <p>${k('journal')} carnet · ${k('map')} carte du monde · ${k('lantern')} lanterne · molette ou ${k('zoomIn')}${k('zoomOut')} zoom · ${k('pause')} menu</p>
        <p class="muted">Les refuges sauvegardent la partie quand tu t’y reposes. Le jeu sauvegarde aussi régulièrement tout seul.</p>`,
      }),
    );
  },
};
