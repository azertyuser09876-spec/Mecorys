// Carte abstraite du monde : régions explorées, lieux, survivants, et l'immensité des colosses.
import { el, clear, canvasEl } from './dom.js';
import { TILE, T, tileDef } from '../world/tiles.js';
import { REGIONS, paletteColor } from '../world/regions.js';
import { MOD } from '../data/colossus.js';

export const EXPLORE = 8; // tuiles par case d'exploration

export function markExplored(game) {
  const cam = game.camera;
  const w = game.world;
  if (!game.explored) game.explored = new Uint8Array(Math.ceil(w.w / EXPLORE) * Math.ceil(w.h / EXPLORE));
  const ew = Math.ceil(w.w / EXPLORE);
  const x0 = Math.max(0, Math.floor(cam.x / TILE / EXPLORE));
  const y0 = Math.max(0, Math.floor(cam.y / TILE / EXPLORE));
  const x1 = Math.min(ew - 1, Math.floor((cam.x + cam.w) / TILE / EXPLORE));
  const y1 = Math.min(Math.ceil(w.h / EXPLORE) - 1, Math.floor((cam.y + cam.h) / TILE / EXPLORE));
  for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) game.explored[y * ew + x] = 1;
}

function worldImage(game) {
  const w = game.world;
  const c = canvasEl(w.w, w.h);
  const g = c.getContext('2d');
  const img = g.createImageData(w.w, w.h);
  const d = img.data;
  const ew = Math.ceil(w.w / EXPLORE);
  for (let y = 0; y < w.h; y++)
    for (let x = 0; x < w.w; x++) {
      const k = (y * w.w + x) * 4;
      const seen = game.explored && game.explored[Math.floor(y / EXPLORE) * ew + Math.floor(x / EXPLORE)];
      const id = w.tiles[y * w.w + x];
      if (!seen) {
        d[k + 3] = 0;
        continue;
      }
      const t = tileDef(id);
      if (id === T.WATER) {
        d[k] = 70;
        d[k + 1] = 130;
        d[k + 2] = 150;
        d[k + 3] = 230;
      } else if (t.solid) {
        const col = paletteColor(t.mat === 'sand' ? 'near' : 'mid', x, y);
        const k2 = t.natural ? 0.7 : 1.05;
        d[k] = col[0] * k2;
        d[k + 1] = col[1] * k2;
        d[k + 2] = col[2] * k2;
        d[k + 3] = 255;
      } else if (w.bg[y * w.w + x]) {
        d[k] = 40;
        d[k + 1] = 38;
        d[k + 2] = 36;
        d[k + 3] = 200;
      } else if (t.climb || t.oneWay) {
        d[k] = 150;
        d[k + 1] = 130;
        d[k + 2] = 100;
        d[k + 3] = 200;
      } else d[k + 3] = 0;
    }
  g.putImageData(img, 0, 0);
  return c;
}

export function openMap(game) {
  markExplored(game);
  const img = worldImage(game);
  const view = { scale: 0, ox: 0, oy: 0 };
  game.ui.openPanel(
    'Carte',
    (body) => {
      const W = Math.min(window.innerWidth * 0.9, 1160);
      const H = Math.min(window.innerHeight * 0.7, 640);
      const c = canvasEl(Math.floor(W), Math.floor(H), 'map');
      const g = c.getContext('2d');
      const base = Math.max(W / game.world.w, 0.4);
      view.scale = base * 2;
      const p = game.player;
      view.ox = p.cx / TILE - W / view.scale / 2;
      view.oy = p.cy / TILE - H / view.scale / 2;
      let drag = null;
      const t0 = performance.now();
      const draw = () => {
        if (!game.ui.panel || !body.isConnected) return;
        const s = view.scale;
        g.fillStyle = '#121110';
        g.fillRect(0, 0, W, H);
        g.imageSmoothingEnabled = false;
        g.save();
        g.translate(-view.ox * s, -view.oy * s);
        g.scale(s, s);
        // ciel des régions
        for (const r of REGIONS) {
          g.fillStyle = `rgba(${r.pal.skyBottom.join(',')},0.06)`;
          g.fillRect(r.x0, 0, r.x1 - r.x0, 140);
        }
        g.drawImage(img, 0, 0);
        // colosses : silhouettes à l'échelle
        for (const col of game.colossi) {
          const tx = col.ox / TILE;
          const ty = col.oy / TILE;
          g.fillStyle = col.active ? 'rgba(240,200,140,0.85)' : 'rgba(200,170,130,0.55)';
          for (const cell of col.cells) {
            if (cell.state === 'plan' || cell.state === 'manquant') continue;
            g.fillRect(tx + cell.x * MOD, ty + cell.y * MOD, MOD, MOD);
          }
          for (const f of col.feet()) g.fillRect(f.x / TILE - 1, f.hipY / TILE, 2, col.legRows);
        }
        g.restore();
        const sp = (x, y) => [(x / TILE - view.ox) * s, (y / TILE - view.oy) * s];
        g.font = '13px Georgia, serif';
        g.textAlign = 'center';
        // noms des régions
        for (const r of REGIONS) {
          if (!game.flags['vu_' + r.id]) continue;
          const [x] = sp(((r.x0 + r.x1) / 2) * TILE, 0);
          g.fillStyle = 'rgba(239,230,214,0.55)';
          g.fillText(r.name, x, 20);
        }
        if (game.flags.vu_conduites) {
          const [x, y] = sp(850 * TILE, 205 * TILE);
          g.fillText('Les Conduites', x, y);
        }
        // lieux et structures remarquables
        for (const l of game.lieux.list) {
          const [x, y] = sp(l.refuge.cx, l.refuge.y);
          g.fillStyle = '#d8a35c';
          g.beginPath();
          g.moveTo(x, y - 12);
          g.lineTo(x + 7, y - 5);
          g.lineTo(x - 7, y - 5);
          g.fill();
          g.fillRect(x - 5, y - 5, 10, 7);
          g.fillStyle = '#efe6d6';
          g.fillText(l.name, x, y - 16);
        }
        for (const st of game.structures) {
          if (!['etabli', 'forge', 'matrice', 'chambre', 'pompe_barrage', 'coeur'].includes(st.type)) continue;
          const [x, y] = sp(st.cx, st.cy);
          if (x < -20 || x > W + 20) continue;
          g.fillStyle = st.ruined ? 'rgba(200,120,100,0.8)' : 'rgba(160,210,170,0.9)';
          g.fillRect(x - 3, y - 3, 6, 6);
        }
        for (const s2 of game.survivors.list) {
          if (!s2.met || s2.away > 0) continue;
          const [x, y] = sp(s2.cx, s2.y);
          g.fillStyle = '#9fc28a';
          g.beginPath();
          g.arc(x, y, 3.5, 0, Math.PI * 2);
          g.fill();
          g.fillStyle = 'rgba(239,230,214,0.8)';
          g.fillText(s2.name, x, y - 7);
        }
        for (const r of game.robots.list) {
          const [x, y] = sp(r.cx, r.cy);
          g.fillStyle = 'rgba(176,138,74,0.9)';
          g.fillRect(x - 1.5, y - 1.5, 3, 3);
        }
        // joueur
        const [px, py] = sp(p.cx, p.cy);
        const blink = Math.sin((performance.now() - t0) / 200) > 0;
        g.strokeStyle = blink ? '#fff' : '#d8a35c';
        g.lineWidth = 2;
        g.beginPath();
        g.arc(px, py, 6, 0, Math.PI * 2);
        g.stroke();
        g.textAlign = 'left';
        requestAnimationFrame(draw);
      };
      c.addEventListener('mousedown', (e) => (drag = { x: e.clientX, y: e.clientY, ox: view.ox, oy: view.oy }));
      window.addEventListener('mouseup', () => (drag = null));
      c.addEventListener('mousemove', (e) => {
        if (!drag) return;
        view.ox = drag.ox - (e.clientX - drag.x) / view.scale;
        view.oy = drag.oy - (e.clientY - drag.y) / view.scale;
      });
      c.addEventListener(
        'wheel',
        (e) => {
          e.preventDefault();
          const r = c.getBoundingClientRect();
          const mx = (e.clientX - r.left) / view.scale + view.ox;
          const my = (e.clientY - r.top) / view.scale + view.oy;
          view.scale = Math.max(base, Math.min(8, view.scale * (e.deltaY > 0 ? 0.8 : 1.25)));
          view.ox = mx - (e.clientX - r.left) / view.scale;
          view.oy = my - (e.clientY - r.top) / view.scale;
        },
        { passive: false },
      );
      body.append(c, el('p', { class: 'muted small' }, 'Glisser pour se déplacer · molette pour zoomer. Seuls les endroits que tu as vus apparaissent.'));
      requestAnimationFrame(draw);
    },
    { cls: 'wide', toggleKey: 'map' },
  );
}
