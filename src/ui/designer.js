// Éditeur de robots : modules sur une grille, analyse en direct, essai, fabrication, plans.
import { el, clear, canvasEl } from './dom.js';
import { MODULES, MODULE_ORDER, GRID_W, GRID_H } from '../data/modules.js';
import { analyze, designCost, cellAt, normalize, capabilities } from '../systems/robotdesign.js';
import { drawModule } from '../render/robotdraw.js';
import { costText } from '../data/items.js';

const CS = 54; // taille d'une case dans l'éditeur

export function openDesigner(game, etabli) {
  const R = game.robots;
  const state = {
    cells: [],
    tool: 'noyau',
    name: 'Nouveau robot',
    source: null, // plan chargé
    hover: null,
    test: null,
  };
  const last = R.lastDesign;
  if (last) {
    state.cells = last.cells.map((c) => ({ ...c }));
    state.name = last.name;
    state.source = last.source;
  }

  game.ui.openPanel(
    'Établi — conception de robots',
    (body, panel) => {
      const palette = el('div', { class: 'd-palette' });
      const grid = canvasEl(GRID_W * CS + 2, GRID_H * CS + 2, 'd-grid');
      const side = el('div', { class: 'd-side' });
      const plans = el('div', { class: 'd-plans' });
      const nameIn = el('input', { class: 'd-name', value: state.name, maxlength: 24 });
      nameIn.addEventListener('input', () => (state.name = nameIn.value || 'Robot'));
      const testC = canvasEl(300, 90, 'd-test');
      body.append(
        el('div', { class: 'd-top' }, el('span', { class: 'muted' }, 'Nom :'), nameIn, el('span', { class: 'grow' }), plans),
        el('div', { class: 'd-main' }, palette, el('div', { class: 'd-center' }, grid, testC, el('div', { class: 'muted d-help' }, 'Clic gauche : poser le module choisi · Clic droit : retirer')), side),
      );
      const g = grid.getContext('2d');

      const renderPalette = () => {
        clear(palette);
        const unlocked = R.unlockedModules();
        let cat = '';
        for (const id of MODULE_ORDER) {
          const M = MODULES[id];
          if (M.cat !== cat) {
            cat = M.cat;
            palette.append(el('div', { class: 'd-cat' }, cat));
          }
          const locked = !unlocked.has(id);
          const c = canvasEl(28, 28);
          const cg = c.getContext('2d');
          drawModule(cg, id, 2, 2, 24, { t: 1 });
          const b = el(
            'button',
            {
              class: 'd-mod' + (state.tool === id ? ' on' : '') + (locked ? ' locked' : ''),
              title: locked ? `${M.name} — module inconnu : trouve un plan qui l’utilise.` : `${M.name} — ${M.desc} (${costText(M.cost)})`,
              onclick: () => {
                if (locked) return;
                state.tool = id;
                renderPalette();
              },
            },
            c,
            el('span', {}, locked ? '???' : M.name),
          );
          palette.append(b);
        }
      };

      const renderPlans = () => {
        clear(plans);
        const sel = el('select', { class: 'd-select' });
        sel.append(el('option', { value: '' }, 'Charger un plan…'));
        for (const d of R.designs) sel.append(el('option', { value: d.id }, (d.found ? '📜 ' : '✎ ') + d.name));
        sel.addEventListener('change', () => {
          const d = R.designs.find((x) => x.id === sel.value);
          if (!d) return;
          state.cells = d.cells.map((c) => ({ ...c }));
          state.name = d.name;
          nameIn.value = d.name;
          state.source = d.id;
          refresh();
        });
        plans.append(sel, el('button', { class: 'btn small', onclick: () => ((state.cells = []), (state.source = null), refresh()) }, 'Vider'));
      };

      const drawGrid = () => {
        g.clearRect(0, 0, grid.width, grid.height);
        g.fillStyle = '#1c1a18';
        g.fillRect(0, 0, grid.width, grid.height);
        g.strokeStyle = 'rgba(214,190,150,0.12)';
        g.lineWidth = 1;
        for (let x = 0; x <= GRID_W; x++) {
          g.beginPath();
          g.moveTo(x * CS + 0.5, 0);
          g.lineTo(x * CS + 0.5, GRID_H * CS);
          g.stroke();
        }
        for (let y = 0; y <= GRID_H; y++) {
          g.beginPath();
          g.moveTo(0, y * CS + 0.5);
          g.lineTo(GRID_W * CS, y * CS + 0.5);
          g.stroke();
        }
        // sol
        g.fillStyle = 'rgba(160,140,110,0.15)';
        g.fillRect(0, GRID_H * CS - 3, grid.width, 3);
        const a = analyze(state.cells);
        const t = performance.now() / 1000;
        state.cells.forEach((c, i) => {
          drawModule(g, c.m, c.x * CS + 4, c.y * CS + 4, CS - 8, { t, working: true });
          if (a.bad.has(i)) {
            g.strokeStyle = 'rgba(230,110,90,0.95)';
            g.lineWidth = 2;
            g.strokeRect(c.x * CS + 2, c.y * CS + 2, CS - 4, CS - 4);
          }
        });
        // liaisons
        g.strokeStyle = 'rgba(216,163,92,0.5)';
        g.lineWidth = 2;
        for (const c of state.cells) {
          for (const [dx, dy] of [
            [1, 0],
            [0, 1],
          ]) {
            if (cellAt(state.cells, c.x + dx, c.y + dy)) {
              g.beginPath();
              g.moveTo((c.x + 0.5) * CS + dx * CS * 0.38, (c.y + 0.5) * CS + dy * CS * 0.38);
              g.lineTo((c.x + 0.5) * CS + dx * CS * 0.62, (c.y + 0.5) * CS + dy * CS * 0.62);
              g.stroke();
            }
          }
        }
        // appui et centre de gravité
        if (a.support) {
          g.fillStyle = a.stable ? 'rgba(150,220,140,0.6)' : 'rgba(230,110,90,0.7)';
          const sy = a.support.top ? 2 : GRID_H * CS - 6;
          g.fillRect(a.support.lo * CS, sy, (a.support.hi - a.support.lo) * CS, 4);
        }
        if (state.cells.length) {
          const cx = a.cog * CS;
          g.strokeStyle = a.stable ? 'rgba(240,220,160,0.8)' : 'rgba(230,110,90,0.9)';
          g.setLineDash([4, 4]);
          g.beginPath();
          g.moveTo(cx, 0);
          g.lineTo(cx, GRID_H * CS);
          g.stroke();
          g.setLineDash([]);
          g.fillStyle = g.strokeStyle;
          g.beginPath();
          g.arc(cx, GRID_H * CS * 0.5, 5, 0, Math.PI * 2);
          g.fill();
          g.fillStyle = '#1c1a18';
          g.font = '9px monospace';
          g.fillText('G', cx - 3, GRID_H * CS * 0.5 + 3);
        }
        // survol
        if (state.hover) {
          const { x, y } = state.hover;
          g.globalAlpha = 0.45;
          if (!cellAt(state.cells, x, y)) drawModule(g, state.tool, x * CS + 4, y * CS + 4, CS - 8, { t });
          g.globalAlpha = 1;
          g.strokeStyle = 'rgba(255,240,200,0.5)';
          g.strokeRect(x * CS + 1, y * CS + 1, CS - 2, CS - 2);
        }
      };

      const renderSide = () => {
        clear(side);
        const a = analyze(state.cells);
        const raw = designCost(state.cells);
        const { cost, optimized, why } = R.costFor(state.cells, state.source);
        const fmt = (v) => (Number.isInteger(v) ? v : v.toFixed(1));
        const stat = (label, val, bad) => el('div', { class: 'd-stat' }, el('span', { class: 'muted' }, label), el('span', { class: bad ? 'ko' : '' }, val));
        side.append(
          el('h3', {}, 'Caractéristiques'),
          stat('Poids', fmt(a.weight)),
          stat('Énergie', `${fmt(a.energyProd)} produite / ${fmt(a.energyUse)} utilisée`, a.energy < 0),
          stat('Déplacement', a.loco ? { roue: 'roues', chenille: 'chenilles', patte: 'pattes', ballon: 'vol' }[a.loco] : '—', !a.loco),
          stat('Vitesse', a.speed ? String(a.speed) : '—'),
          stat('Marches', a.flies ? 'vole' : a.stepUp ? `${a.stepUp / 16} case${a.stepUp > 16 ? 's' : ''}` : 'aucune'),
          stat('Cargaison', String(a.cargo)),
          stat('Équilibre', a.stable ? 'stable' : 'bascule', !a.stable),
          el('div', { class: 'd-caps' }, ...capabilities(a).map((c) => el('span', { class: 'chip good' }, c))),
        );
        const issues = el('div', { class: 'd-issues' });
        if (!a.issues.length) issues.append(el('div', { class: 'ok' }, '✓ Ce robot fonctionnera.'));
        for (const i of a.issues) issues.append(el('div', { class: i.level === 'erreur' ? 'ko' : 'warn' }, (i.level === 'erreur' ? '✗ ' : '! ') + i.text));
        side.append(issues);
        const can = game.inv.has(cost);
        side.append(
          el('h3', {}, 'Coût'),
          el('div', { class: can ? '' : 'ko' }, costText(cost) || '—'),
          el('div', { class: 'muted small' }, optimized ? 'D’après un plan éprouvé : environ 5 % de ressources en moins.' : why),
        );
        const q = R.queueOf(etabli);
        const btns = el('div', { class: 'd-btns' });
        const fab = el('button', { class: 'btn primary', disabled: !a.ok || !can || q.length >= 3, onclick: () => (R.fabricate(etabli, state, cost), refresh()) }, 'Fabriquer');
        const save = el('button', { class: 'btn', disabled: !a.ok, onclick: () => (R.saveDesign(state), renderPlans(), refresh()) }, 'Enregistrer comme plan');
        const test = el('button', { class: 'btn', disabled: !state.cells.length, onclick: () => (state.test = { t: 0, a }) }, 'Essayer');
        btns.append(fab, save, test);
        side.append(btns);
        if (q.length) {
          side.append(el('h3', {}, 'Fabrication en cours'));
          for (const job of q) side.append(el('div', {}, job.name, el('div', { class: 'meter' }, el('div', { style: { width: Math.round((job.progress / job.total) * 100) + '%' } }))));
        }
        R.lastDesign = { cells: state.cells.map((c) => ({ ...c })), name: state.name, source: state.source };
      };

      const refresh = () => {
        renderPalette();
        renderSide();
        drawGrid();
      };

      const cellFromEvent = (e) => {
        const r = grid.getBoundingClientRect();
        const x = Math.floor(((e.clientX - r.left) / r.width) * grid.width / CS);
        const y = Math.floor(((e.clientY - r.top) / r.height) * grid.height / CS);
        if (x < 0 || y < 0 || x >= GRID_W || y >= GRID_H) return null;
        return { x, y };
      };
      grid.addEventListener('mousemove', (e) => {
        state.hover = cellFromEvent(e);
        drawGrid();
      });
      grid.addEventListener('mouseleave', () => {
        state.hover = null;
        drawGrid();
      });
      grid.addEventListener('contextmenu', (e) => e.preventDefault());
      grid.addEventListener('mousedown', (e) => {
        const c = cellFromEvent(e);
        if (!c) return;
        const existing = state.cells.findIndex((q) => q.x === c.x && q.y === c.y);
        if (e.button === 2) {
          if (existing >= 0) state.cells.splice(existing, 1);
        } else {
          if (existing >= 0) state.cells.splice(existing, 1);
          state.cells.push({ x: c.x, y: c.y, m: state.tool });
          game.audio && game.audio.sfx('click');
        }
        state.source = state.source && R.sameAsSource(state.cells, state.source) ? state.source : null;
        refresh();
      });

      // animation : modules et essai
      const tc = testC.getContext('2d');
      let alive = true;
      const anim = () => {
        if (!alive || !game.ui.panel || game.ui.panel.el !== panel.el) return;
        drawGrid();
        drawTest(tc, testC, state);
        requestAnimationFrame(anim);
      };
      requestAnimationFrame(anim);
      panel.opts.onClose = () => (alive = false);
      game.ui.onClose = panel.opts.onClose;
      renderPlans();
      refresh();
      return refresh;
    },
    { cls: 'wide' },
  );
}

// Petit banc d'essai : terrain plat, une marche d'une case puis de deux.
function drawTest(g, c, state) {
  g.clearRect(0, 0, c.width, c.height);
  g.fillStyle = '#1c1a18';
  g.fillRect(0, 0, c.width, c.height);
  const s = 8;
  const ground = c.height - 12;
  g.fillStyle = '#5a4e40';
  g.fillRect(0, ground, c.width, 12);
  g.fillRect(150, ground - 16, 60, 16);
  g.fillRect(210, ground - 48, 90, 48);
  g.fillStyle = 'rgba(214,190,150,0.5)';
  g.font = '9px monospace';
  g.fillText('1 case', 160, ground - 20);
  g.fillText('2 cases', 222, ground - 52);
  if (!state.test || !state.cells.length) {
    g.fillStyle = 'rgba(214,190,150,0.6)';
    g.fillText('Banc d’essai : clique sur « Essayer »', 10, 14);
    return;
  }
  const T = state.test;
  T.t += 1 / 60;
  const a = T.a;
  const cells = normalize(state.cells);
  const w = a.w * s;
  const h = a.h * s;
  let x = 10 + (a.ok ? Math.min(T.t * a.speed * 0.9, 260) : Math.min(T.t * 20, 30));
  let y = ground - h;
  let rot = 0;
  let msg = '';
  if (!a.loco) {
    x = 10;
    msg = 'ne bouge pas';
  } else if (!a.stable) {
    rot = Math.min(1.2, T.t * 1.5) * (a.cog < (a.support ? a.support.lo : 0) ? -1 : 1);
    x = 10;
    msg = 'bascule !';
  } else if (a.flies) {
    y = ground - h - 30 - Math.sin(T.t * 2) * 4;
    msg = x >= 260 ? 'franchit tout en volant' : '';
  } else {
    const step1 = 150 - w;
    const step2 = 210 - w;
    const up = a.stepUp / 16;
    if (x > step1) {
      if (up < 1) {
        x = step1;
        msg = 'bloqué par une marche';
      } else y = ground - 16 - h;
    }
    if (x > step2) {
      if (up < 2) {
        x = step2;
        msg = 'bloqué par deux marches';
      } else y = ground - 48 - h;
    }
    if (x >= 260) msg = 'parcours réussi';
  }
  if (!a.ok && a.loco && a.stable && !msg) msg = 'ne fonctionne pas encore';
  g.save();
  g.translate(x + w / 2, y + h);
  g.rotate(rot);
  g.translate(-w / 2, -h);
  for (const cc of cells) drawModule(g, cc.m, cc.x * s, cc.y * s, s, { t: T.t, phase: T.t * a.speed * 0.2, moving: true, working: true });
  g.restore();
  if (msg) {
    g.fillStyle = /bloqué|bascule|ne /.test(msg) ? '#d97a5e' : '#9fc28a';
    g.fillText(msg, 10, 14);
  }
  if (T.t > 8) state.test = null;
}
