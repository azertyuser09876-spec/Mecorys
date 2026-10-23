// Panneaux des colosses : plan, diagnostic, conception d'un nouveau colosse, forge.
import { el, clear, canvasEl } from './dom.js';
import { CMODULES, CMOD_ORDER, CGRID_W, CGRID_H, MOD } from '../data/colossus.js';
import { analyzeColossus, colossusCost, fnLabels, cellAt } from '../systems/colossusdesign.js';
import { costText } from '../data/items.js';

const CS = 46;
const STATE = { ok: 'en état', endommage: 'endommagé', manquant: 'manquant', plan: 'prévu', livre: 'à installer' };
const STATE_COL = { ok: '#9fc28a', endommage: '#e0c070', manquant: '#d97a5e', plan: '#8a8070', livre: '#d8a35c' };

function moduleGlyph(g, m, x, y, s, state) {
  const M = CMODULES[m];
  g.fillStyle = M.organic ? '#8a4a52' : M.cat === 'Déplacement' ? '#4a4846' : M.cat === 'Fonctions' ? '#5a6a7a' : M.cat === 'Organes' ? '#6a4a3a' : '#5e646c';
  g.globalAlpha = state === 'plan' || state === 'manquant' ? 0.35 : 1;
  g.fillRect(x + 2, y + 2, s - 4, s - 4);
  g.globalAlpha = 1;
  g.fillStyle = '#efe6d6';
  g.font = `${Math.floor(s * 0.22)}px Georgia, serif`;
  const label = M.name.split(' ')[0].slice(0, 9);
  g.fillText(label, x + 5, y + s * 0.42);
  if (state) {
    g.fillStyle = STATE_COL[state];
    g.fillRect(x + 4, y + s - 9, s - 8, 4);
  }
}

// Diagnostic et modification d'un colosse existant
export function openColossus(game, c) {
  const sys = game.colossusSys;
  let tool = null;
  game.ui.openPanel(
    c.name,
    (body) => {
      const render = () => {
        clear(body);
        const a = analyzeColossus(c.cells);
        const plan = analyzeColossus(c.cells, { plan: true });
        const editable = c.type === 'construit' || (c.type === 'dormeur' && c.active) || (c.type === 'gardien' && c.data.resolved === 'apaiser');
        const gridC = canvasEl(CGRID_W * CS, CGRID_H * CS, 'd-grid');
        const gg = gridC.getContext('2d');
        gg.fillStyle = '#1c1a18';
        gg.fillRect(0, 0, gridC.width, gridC.height);
        gg.strokeStyle = 'rgba(214,190,150,0.1)';
        for (let x = 0; x <= CGRID_W; x++) gg.strokeRect(x * CS, 0, 0.5, CGRID_H * CS);
        for (let y = 0; y <= CGRID_H; y++) gg.strokeRect(0, y * CS, CGRID_W * CS, 0.5);
        for (const cell of c.cells) moduleGlyph(gg, cell.m, cell.x * CS, cell.y * CS, CS, cell.state);
        if (editable) {
          gridC.addEventListener('mousedown', (e) => {
            const r = gridC.getBoundingClientRect();
            const x = Math.floor(((e.clientX - r.left) / r.width) * CGRID_W);
            const y = Math.floor(((e.clientY - r.top) / r.height) * CGRID_H);
            const ex = cellAt(c.cells, x, y);
            if (e.button === 2) {
              if (ex && ex.state === 'plan') {
                c.cells = c.cells.filter((q) => q !== ex);
                c.build();
              }
            } else if (tool && !ex) {
              const adj = c.cells.some((q) => Math.abs(q.x - x) + Math.abs(q.y - y) === 1);
              if (!adj) return game.toast('Un module doit être accolé au colosse.', 'bad');
              c.cells.push({ x, y, m: tool, state: 'plan' });
              c.build();
            }
            render();
          });
          gridC.addEventListener('contextmenu', (e) => e.preventDefault());
        }
        const side = el('div', { class: 'd-side' });
        side.append(
          el('h3', {}, 'État'),
          el('div', { class: 'd-stat' }, el('span', { class: 'muted' }, 'Poids / portance'), el('span', {}, `${a.weight} / ${a.carry}`)),
          el('div', { class: 'd-stat' }, el('span', { class: 'muted' }, 'Énergie'), el('span', { class: a.energy < 0 ? 'ko' : '' }, `${a.energyProd} / ${a.energyUse}`)),
          el('div', { class: 'd-stat' }, el('span', { class: 'muted' }, 'Chaleur'), el('span', { class: a.heat > 0 ? 'ko' : '' }, String(a.heat))),
          el('div', { class: 'd-stat' }, el('span', { class: 'muted' }, 'Fonctions'), el('span', {}, fnLabels(a).join(', ') || '—')),
        );
        const iss = el('div', { class: 'd-issues' });
        if (!a.issues.length) iss.append(el('div', { class: 'ok' }, '✓ Tout fonctionne.'));
        for (const i of a.issues) iss.append(el('div', { class: i.level === 'erreur' ? 'ko' : 'warn' }, (i.level === 'erreur' ? '✗ ' : '! ') + i.text));
        side.append(iss);
        const todo = c.cells.filter((q) => q.state === 'livre' || q.state === 'endommage' || (q.state === 'manquant' && (CMODULES[q.m].grown || CMODULES[q.m].ancient) && game.inv.items[q.m] > 0) || (q.state === 'plan' && (CMODULES[q.m].grown || CMODULES[q.m].ancient) && game.inv.items[q.m] > 0));
        if (todo.length) {
          side.append(el('h3', {}, 'Travaux'));
          for (const q of todo) {
            const M = CMODULES[q.m];
            const w = c.work[q.x + ',' + q.y] || 0;
            const label = q.state === 'endommage' ? `Réparer : ${M.name}` + (c.paid[q.x + ',' + q.y] ? '' : ` (${costText(sys.repairCost(q))})`) : q.state === 'livre' ? `Installer : ${M.name} (${Math.round((w / (M.work || 30)) * 100)} %)` : `Greffer : ${M.name}`;
            side.append(el('button', { class: 'btn small', onclick: () => (game.ui.closePanel(), sys.cellInteract(c, q)) }, label));
          }
          side.append(el('p', { class: 'muted small' }, 'Il faut rester près du module (ou sur le chantier de la cale) pendant le travail.'));
        }
        if (c.type === 'construit' && !c.active) {
          const left = c.cells.filter((q) => q.state !== 'ok');
          side.append(el('h3', {}, 'Chantier'), el('p', { class: 'small' }, `${c.cells.length - left.length} modules installés sur ${c.cells.length}. Le plan complet ${plan.ok ? 'fonctionnera' : 'a encore des défauts'}.`));
          const blocked = sys.blockedTiles(c);
          if (blocked > 6) side.append(el('p', { class: 'small ko' }, `Préparation du terrain : ${blocked} tuiles de gravats encombrent encore la cale.`));
          side.append(el('p', { class: 'small muted' }, 'Ordre : préparer le terrain, forger chaque module, le laisser descendre par le pont roulant, l’installer (toi ou des robots soudeurs), puis activer depuis la salle de commande.'));
        }
        if (editable) {
          side.append(el('h3', {}, 'Ajouter des modules au plan'));
          const pal = el('div', { class: 'r-orders' });
          for (const m of CMOD_ORDER) {
            if (!sys.known.has(m)) continue;
            pal.append(el('button', { class: 'btn small' + (tool === m ? ' primary' : ''), title: CMODULES[m].desc, onclick: () => ((tool = tool === m ? null : m), render()) }, CMODULES[m].name));
          }
          if (!sys.known.size) pal.append(el('p', { class: 'muted small' }, 'Les archives de la cale contiennent les plans des modules.'));
          side.append(pal, el('p', { class: 'muted small' }, 'Clic : poser au plan · clic droit : retirer un module prévu. Chaque module prévu se fabrique à la forge.'));
        }
        const legend = el('div', { class: 'small' }, ...Object.entries(STATE).map(([k, v]) => el('span', { class: 'chip', style: { color: STATE_COL[k] } }, v)));
        body.append(el('div', { class: 'd-main' }, el('div', { class: 'd-center' }, gridC, legend), side));
      };
      render();
      return render;
    },
    { cls: 'wide' },
  );
}

// Forge : concevoir un nouveau colosse ou fabriquer les modules prévus
export function openForge(game, forge) {
  const sys = game.colossusSys;
  if (!sys.known.size) {
    game.toast('La forge attend des plans. Les archives du bureau de la cale en contiennent.', 'bad');
    return;
  }
  game.ui.openPanel(
    'Forge colossale',
    (body) => {
      const render = () => {
        clear(body);
        const eff = forge.lieu && forge.lieu.energyProd > 0 ? forge.lieu.energyRatio : 0;
        if (!eff) body.append(el('p', { class: 'ko' }, 'La forge est froide : il faut un refuge à proximité et de l’énergie (chaudières, moulins).'));
        const targets = game.colossi.filter((c) => Math.abs(c.cx - forge.cx) < 220 * 16 && c.cells.some((q) => q.state === 'plan' || (q.state === 'manquant' && !CMODULES[q.m].grown)));
        const q = sys.forgeQueue;
        if (q.length) {
          body.append(el('h3', {}, 'À la forge'));
          for (const j of q) body.append(el('div', { class: 'small' }, CMODULES[j.module].name, el('div', { class: 'meter' }, el('div', { style: { width: Math.round((j.progress / j.total) * 100) + '%' } }))));
        }
        if (!game.colossi.some((c) => c.type === 'construit')) body.append(designer(game, render));
        for (const c of targets) {
          body.append(el('h3', {}, c.name));
          const list = el('div', { class: 'list' });
          for (const cell of c.cells) {
            if (!(cell.state === 'plan' || (cell.state === 'manquant' && !CMODULES[cell.m].grown))) continue;
            const cost = sys.forgeCost(cell.m);
            const queued = q.some((j) => j.colossus === c.id && j.slot[0] === cell.x && j.slot[1] === cell.y) || game.entities.some((e) => e.kind === 'crate' && e.payload.colossus === c.id && e.payload.slot[0] === cell.x && e.payload.slot[1] === cell.y);
            list.append(
              el(
                'div',
                { class: 'card' },
                el('h3', {}, CMODULES[cell.m].name),
                el('div', { class: 'small' }, costText(cost) + ` · ${Math.round((CMODULES[cell.m].work || 30) * 1.2)} s`),
                el('button', { class: 'btn small primary', disabled: queued || !game.inv.has(cost), onclick: () => (sys.queueForge(forge, c, cell), render()) }, queued ? 'En cours' : 'Forger'),
              ),
            );
          }
          body.append(list);
          body.append(el('button', { class: 'btn small', onclick: () => openColossus(game, c) }, 'Voir le plan du colosse'));
        }
        body.append(el('p', { class: 'muted small' }, 'D’après les plans des archives, chaque module coûte environ 5 % de ressources en moins.'));
      };
      render();
      return render;
    },
    { cls: 'wide' },
  );
}

// Conception d'un colosse entièrement nouveau
function designer(game, refresh) {
  const sys = game.colossusSys;
  const st = { cells: [], tool: 'commande', name: 'Mon colosse' };
  const wrap = el('div', {});
  const draw = () => {
    clear(wrap);
    const a = analyzeColossus(st.cells, { plan: true });
    const cost = colossusCost(st.cells);
    const gridC = canvasEl(CGRID_W * CS, CGRID_H * CS, 'd-grid');
    const gg = gridC.getContext('2d');
    gg.fillStyle = '#1c1a18';
    gg.fillRect(0, 0, gridC.width, gridC.height);
    gg.strokeStyle = 'rgba(214,190,150,0.1)';
    for (let x = 0; x <= CGRID_W; x++) gg.strokeRect(x * CS, 0, 0.5, CGRID_H * CS);
    for (let y = 0; y <= CGRID_H; y++) gg.strokeRect(0, y * CS, CGRID_W * CS, 0.5);
    for (const c of st.cells) moduleGlyph(gg, c.m, c.x * CS, c.y * CS, CS, null);
    gridC.addEventListener('contextmenu', (e) => e.preventDefault());
    gridC.addEventListener('mousedown', (e) => {
      const r = gridC.getBoundingClientRect();
      const x = Math.floor(((e.clientX - r.left) / r.width) * CGRID_W);
      const y = Math.floor(((e.clientY - r.top) / r.height) * CGRID_H);
      st.cells = st.cells.filter((q) => !(q.x === x && q.y === y));
      if (e.button !== 2) st.cells.push({ x, y, m: st.tool, state: 'plan' });
      draw();
    });
    const pal = el('div', { class: 'r-orders' });
    for (const m of CMOD_ORDER) {
      if (!sys.known.has(m) && !(game.inv.items[m] > 0)) continue;
      pal.append(el('button', { class: 'btn small' + (st.tool === m ? ' primary' : ''), title: CMODULES[m].desc, onclick: () => ((st.tool = m), draw()) }, CMODULES[m].name));
    }
    const iss = el('div', { class: 'd-issues' });
    for (const i of a.issues) iss.append(el('div', { class: i.level === 'erreur' ? 'ko' : 'warn' }, (i.level === 'erreur' ? '✗ ' : '! ') + i.text));
    if (st.cells.length && !a.issues.length) iss.append(el('div', { class: 'ok' }, '✓ Ce colosse fonctionnera.'));
    const nameIn = el('input', { class: 'd-name', value: st.name, maxlength: 24 });
    nameIn.addEventListener('input', () => (st.name = nameIn.value));
    wrap.append(
      el('h3', {}, 'Concevoir un colosse'),
      el('p', { class: 'muted small' }, 'Chaque case est un module de 5 × 5 cases de monde. Commence par la salle de commande, puis l’ossature, les organes, les jambes en bas, et ses fonctions : rien n’est imposé. Plusieurs fonctions alourdissent, coûtent et consomment davantage.'),
      el(
        'div',
        { class: 'd-main' },
        el('div', { class: 'd-center' }, gridC),
        el(
          'div',
          { class: 'd-side' },
          el('div', { class: 'row' }, el('span', { class: 'muted' }, 'Nom :'), nameIn),
          pal,
          el('div', { class: 'd-stat' }, el('span', { class: 'muted' }, 'Poids / portance'), el('span', {}, `${a.weight} / ${a.carry}`)),
          el('div', { class: 'd-stat' }, el('span', { class: 'muted' }, 'Énergie'), el('span', {}, `${a.energyProd} / ${a.energyUse}`)),
          el('div', { class: 'd-stat' }, el('span', { class: 'muted' }, 'Chaleur'), el('span', {}, String(a.heat))),
          el('div', { class: 'd-stat' }, el('span', { class: 'muted' }, 'Fonctions'), el('span', {}, fnLabels(a).join(', ') || '—')),
          el('div', { class: 'd-stat' }, el('span', { class: 'muted' }, 'Coût total'), el('span', {}, costText(cost) || '—')),
          iss,
          el('button', { class: 'btn primary', disabled: !a.ok, onclick: () => (sys.newChantier(st.cells, st.name), refresh()) }, 'Poser la quille dans la cale'),
        ),
      ),
    );
  };
  draw();
  return wrap;
}
