// Mode construction : aperçu, validation lisible, pose et démontage.
import { TILE, T, tileDef } from '../world/tiles.js';
import { STRUCT, BUILD_ORDER, BUILD_TILES } from '../data/structures.js';
import { Structure } from '../entities/structure.js';
import { costText } from '../data/items.js';
import { planCost } from './inventory.js';
import { LIEU_RADIUS } from './lieux.js';
import { el, clear } from '../ui/dom.js';
import { DRAW } from '../render/structdraw.js';

const TILE_IDS = { PLANK: T.PLANK, BUILT_LADDER: T.BUILT_LADDER, TINWALL: T.TINWALL };
const REACH = 13; // tuiles

export class Building {
  constructor(game) {
    this.game = game;
    this.active = false;
    this.sel = null; // { kind: 'struct'|'tile', id }
    this.bar = null;
    this.preview = null;
    this.t = 0;
  }

  known() {
    const inv = this.game.inv;
    const out = [];
    for (const id of BUILD_ORDER) {
      const d = STRUCT[id];
      if (!d.plan || inv.plans.has(d.plan)) out.push({ kind: 'struct', id, name: d.name, def: d });
    }
    for (const id in BUILD_TILES) out.push({ kind: 'tile', id, name: BUILD_TILES[id].name, def: BUILD_TILES[id] });
    return out;
  }

  toggle() {
    if (this.active) this.close();
    else this.open();
  }

  open() {
    this.active = true;
    const items = this.known();
    if (!this.sel || !items.some((i) => i.id === this.sel.id)) this.sel = items[0];
    this.renderBar();
    this.game.audio && this.game.audio.sfx('ui_open');
  }

  close() {
    this.active = false;
    if (this.bar) this.bar.remove();
    this.bar = null;
    this.game.ui.setHint('');
  }

  renderBar() {
    if (this.bar) this.bar.remove();
    const items = this.known();
    const bar = el('div', { class: 'buildbar' });
    items.forEach((it, i) => {
      const cost = this.costOf(it);
      const ok = this.game.inv.has(cost);
      const b = el(
        'button',
        {
          class: 'bitem' + (this.sel && this.sel.id === it.id ? ' on' : '') + (ok ? '' : ' poor'),
          title: `${it.name} — ${it.def.desc || ''}`,
          onclick: () => {
            this.sel = it;
            this.renderBar();
          },
        },
        el('span', { class: 'bnum' }, i < 9 ? String(i + 1) : ''),
        el('span', { class: 'bname' }, it.name),
        el('span', { class: 'bcost' }, costText(cost)),
      );
      bar.append(b);
    });
    bar.append(el('div', { class: 'bhelp' }, 'Clic gauche : poser · Clic droit : démonter · B ou Échap : quitter'));
    this.game.ui.root.append(bar);
    this.bar = bar;
  }

  costOf(it) {
    if (it.kind === 'tile') return it.def.cost;
    const optimized = this.game.inv.foundPlans.has(it.def.plan || it.id);
    return planCost(it.def.cost, optimized);
  }

  update(dt) {
    const game = this.game;
    const input = game.input;
    this.t += dt;
    if (!this.active) return;
    // sélection au clavier
    const items = this.known();
    for (let k = 0; k < Math.min(9, items.length); k++)
      if (input.keyHit('Digit' + (k + 1))) {
        this.sel = items[k];
        this.renderBar();
      }
    if (input.hitRaw('pause')) {
      this.close();
      return;
    }
    const m = game.mouseWorld();
    const tx = Math.floor(m.x / TILE);
    const ty = Math.floor(m.y / TILE);
    if (!this.sel) return;
    this.preview = this.sel.kind === 'tile' ? this.checkTile(tx, ty) : this.checkStruct(tx, ty);
    const p = this.preview;
    const cost = this.costOf(this.sel);
    const miss = game.inv.missing(cost);
    const costHtml = `<b>${this.sel.name}</b> · ${costText(cost)}` + (Object.keys(miss).length ? ` <span class="ko">(manque ${costText(miss)})</span>` : '');
    game.ui.setHint(costHtml + (p.reason ? `<br><span class="ko">${p.reason}</span>` : '<br><span class="ok">Emplacement valide</span>') + (this.sel.def.desc ? `<br>${this.sel.def.desc}` : ''));
    if (input.mouse.leftPressed && input.mouse.inCanvas) {
      if (!p.ok) {
        game.audio && game.audio.sfx('deny');
        return;
      }
      if (!game.inv.pay(cost)) {
        game.toast('Ressources insuffisantes.', 'bad');
        game.audio && game.audio.sfx('deny');
        return;
      }
      this.place(p);
      this.renderBar();
    }
    // pose continue des tuiles en maintenant le bouton
    if (input.mouse.left && !input.mouse.leftPressed && this.sel.kind === 'tile' && p.ok && game.inv.has(cost)) {
      if (this.lastTile !== tx + ',' + ty) {
        game.inv.pay(cost);
        this.place(p);
      }
    }
    if (input.mouse.rightPressed) this.deconstruct(tx, ty);
  }

  checkTile(tx, ty) {
    const game = this.game;
    const w = game.world;
    const out = { kind: 'tile', tx, ty, ok: false, reason: '' };
    const p = game.player;
    if (Math.abs(tx * TILE + 8 - p.cx) > REACH * TILE || Math.abs(ty * TILE + 8 - p.cy) > REACH * TILE) return (out.reason = 'Trop loin.'), out;
    if (w.get(tx, ty) !== T.AIR) return (out.reason = 'Case occupée.'), out;
    if (game.structureAt(tx, ty)) return (out.reason = 'Une structure occupe déjà la case.'), out;
    const id = TILE_IDS[this.sel.def.tile];
    if (id === T.TINWALL && this.overlapsBody(tx, ty)) return (out.reason = 'Quelqu’un se tient ici.'), out;
    if (!this.supported(tx, ty, id)) return (out.reason = id === T.PLANK ? 'Rien pour la soutenir : il faut un appui à moins de 4 cases.' : 'Rien pour l’accrocher.'), out;
    out.ok = true;
    out.id = id;
    return out;
  }

  overlapsBody(tx, ty) {
    const p = this.game.player;
    return p.x < tx * TILE + TILE && p.x + p.w > tx * TILE && p.y < ty * TILE + TILE && p.y + p.h > ty * TILE;
  }

  supported(tx, ty, id) {
    const w = this.game.world;
    const solid = (x, y) => tileDef(w.get(x, y)).solid;
    if (id === T.TINWALL) return solid(tx, ty + 1) || solid(tx - 1, ty) || solid(tx + 1, ty) || solid(tx, ty - 1);
    if (id === T.BUILT_LADDER) {
      if (solid(tx, ty + 1) || solid(tx - 1, ty) || solid(tx + 1, ty) || tileDef(w.get(tx, ty + 1)).oneWay) return true;
      // empilée sur une autre échelle, sans dépasser 10 cases dans le vide
      let n = 0;
      for (let y = ty + 1; y < ty + 11; y++) {
        const id2 = w.get(tx, y);
        if (id2 !== T.BUILT_LADDER && id2 !== T.LADDER) return tileDef(id2).solid || tileDef(id2).oneWay;
        if (solid(tx - 1, y) || solid(tx + 1, y)) return true;
        n++;
      }
      return false;
    }
    if (id === T.PLANK) {
      if (solid(tx, ty + 1)) return true;
      for (const dir of [-1, 1]) {
        for (let k = 1; k <= 4; k++) {
          const id2 = w.get(tx + dir * k, ty);
          if (tileDef(id2).solid) return true;
          if (id2 !== T.PLANK && id2 !== T.PLATFORM && id2 !== T.GRATE) break;
          if (solid(tx + dir * k, ty + 1)) return true;
        }
      }
      return false;
    }
    return true;
  }

  checkStruct(tx, ty) {
    const game = this.game;
    const w = game.world;
    const d = this.sel.def;
    const x0 = tx - Math.floor(d.w / 2);
    // On pose sur le premier sol trouvé sous la souris
    let floor = ty + 1;
    for (let k = 0; k < 6; k++) {
      if (this.floorOk(x0, floor, d.w)) break;
      floor++;
    }
    const out = { kind: 'struct', id: this.sel.id, tx: x0, floor, ok: false, reason: '' };
    const p = game.player;
    if (Math.abs((x0 + d.w / 2) * TILE - p.cx) > REACH * TILE || Math.abs(floor * TILE - p.cy) > REACH * TILE) return (out.reason = 'Trop loin.'), out;
    if (!this.floorOk(x0, floor, d.w)) return (out.reason = 'Il faut un sol plat et solide sur toute la largeur.'), out;
    for (let y = floor - d.h; y < floor; y++)
      for (let x = x0; x < x0 + d.w; x++) {
        const t = tileDef(w.get(x, y));
        if (t.solid) return (out.reason = 'Pas assez de place.'), out;
        if (t.liquid) return (out.reason = 'Impossible sous l’eau.'), out;
      }
    for (const s of game.structures) {
      if (s.x < (x0 + d.w) * TILE && s.x + s.w > x0 * TILE && s.y < floor * TILE && s.y + s.h > (floor - d.h) * TILE) return (out.reason = 'Une autre structure gêne.'), out;
    }
    const lieu = game.lieux.lieuAt(x0 + Math.floor(d.w / 2), floor);
    if (this.sel.id !== 'refuge' && !lieu) return (out.reason = `Hors d’un lieu habitable : construis d’abord un refuge (rayon ${LIEU_RADIUS} cases).`), out;
    if (this.sel.id === 'refuge' && lieu && lieu.refuge) {
      const near = Math.abs(lieu.tx - (x0 + 2)) < 20;
      if (near) return (out.reason = 'Un refuge existe déjà tout près.'), out;
    }
    if (this.sel.id === 'pompe' && !nearWater(w, x0, floor, d)) out.warn = 'Aucune eau à proximité : la pompe ne fournira rien.';
    out.ok = true;
    out.lieu = lieu;
    return out;
  }

  floorOk(x0, floor, wdt) {
    const w = this.game.world;
    for (let x = x0; x < x0 + wdt; x++) {
      const t = tileDef(w.get(x, floor));
      if (!(t.solid || t.oneWay)) return false;
    }
    return true;
  }

  place(p) {
    const game = this.game;
    if (p.kind === 'tile') {
      game.world.set(p.tx, p.ty, p.id);
      this.lastTile = p.tx + ',' + p.ty;
      game.audio && game.audio.sfx('place');
      game.particles.dust(p.tx * TILE + 8, p.ty * TILE + 12, 0, 3);
      return;
    }
    const s = new Structure(p.id, p.tx, p.floor);
    s.checkCover(game.world);
    game.addStructure(s);
    game.audio && game.audio.sfx('build');
    for (let k = 0; k < 6; k++) game.particles.dust(s.x + Math.random() * s.w, s.y + s.h, 0, 2);
    if (p.warn) game.toast(p.warn, 'bad');
    game.onBuilt(s);
  }

  deconstruct(tx, ty) {
    const game = this.game;
    const s = game.structureAt(tx, ty);
    if (s && s.built && !s.def.found) {
      game.removeStructure(s);
      game.inv.addAll(planCost(s.def.cost, false));
      game.toast(`${s.def.name} démonté : ressources récupérées.`);
      game.audio && game.audio.sfx('place');
      return;
    }
    const id = game.world.get(tx, ty);
    const d = tileDef(id);
    if (d.built) {
      game.world.set(tx, ty, T.AIR);
      game.inv.addAll(d.yields || {});
      game.audio && game.audio.sfx('place');
    }
  }

  // Aperçu et réseaux dans le monde
  draw(g) {
    if (!this.active || !this.preview) return;
    const game = this.game;
    const p = this.preview;
    const z = game.camera.zoom;
    g.lineWidth = 1 / z;
    const col = p.ok ? 'rgba(150,220,140,' : 'rgba(230,110,90,';
    if (p.kind === 'tile') {
      g.fillStyle = col + '0.25)';
      g.fillRect(p.tx * TILE, p.ty * TILE, TILE, TILE);
      g.strokeStyle = col + '0.9)';
      g.strokeRect(p.tx * TILE + 0.5, p.ty * TILE + 0.5, TILE - 1, TILE - 1);
    } else {
      const d = STRUCT[p.id];
      const ghost = { x: p.tx * TILE, y: p.floor * TILE - d.h * TILE, w: d.w * TILE, h: d.h * TILE, ruined: false, data: {}, covered: true };
      g.globalAlpha = 0.55;
      if (DRAW[p.id]) DRAW[p.id](g, ghost, this.t, game);
      g.globalAlpha = 1;
      g.strokeStyle = col + '0.9)';
      g.strokeRect(ghost.x + 0.5, ghost.y + 0.5, ghost.w - 1, ghost.h - 1);
      g.fillStyle = col + '0.12)';
      g.fillRect(ghost.x, ghost.y, ghost.w, ghost.h);
      // rayon du lieu
      if (p.id === 'refuge') {
        g.strokeStyle = 'rgba(216,163,92,0.35)';
        g.setLineDash([6 / z, 6 / z]);
        g.strokeRect((p.tx + 2 - LIEU_RADIUS) * TILE, (p.floor - 30) * TILE, LIEU_RADIUS * 2 * TILE, 40 * TILE);
        g.setLineDash([]);
      }
    }
    // Réseaux : énergie (or) et eau (bleu) vers le refuge de chaque lieu
    for (const l of game.lieux.list) {
      const r = l.refuge;
      for (const s of l.structs || []) {
        if (s === r) continue;
        const e = s.def.energy || 0;
        const wa = s.def.water || 0;
        if (e) this.flow(g, s, r, e > 0, l.energyRatio < 1 ? 'rgba(230,110,90,' : 'rgba(240,200,110,', 0);
        if (wa) this.flow(g, s, r, wa > 0, l.waterRatio < 1 ? 'rgba(230,110,90,' : 'rgba(110,180,230,', 4);
      }
      g.fillStyle = 'rgba(0,0,0,0.6)';
      g.font = `${8 / z}px monospace`;
    }
  }

  flow(g, s, r, out, col, off) {
    const z = this.game.camera.zoom;
    const x0 = s.cx;
    const y0 = s.y + s.h - 3 - off;
    const x1 = r.cx;
    const y1 = r.y + r.h - 3 - off;
    g.strokeStyle = col + '0.35)';
    g.lineWidth = 1 / z;
    g.beginPath();
    g.moveTo(x0, y0);
    g.lineTo(x1, y1);
    g.stroke();
    const len = Math.hypot(x1 - x0, y1 - y0);
    const n = Math.max(1, Math.floor(len / 24));
    g.fillStyle = col + '0.9)';
    for (let k = 0; k < n; k++) {
      let f = (k / n + this.t * 0.4) % 1;
      if (!out) f = 1 - f;
      g.fillRect(x0 + (x1 - x0) * f - 1, y0 + (y1 - y0) * f - 1, 2, 2);
    }
  }
}

function nearWater(world, x0, floor, d) {
  for (let y = floor - d.h; y <= floor + 6; y++) for (let x = x0 - 3; x <= x0 + d.w + 3; x++) if (world.get(x, y) === T.WATER) return true;
  return false;
}
