// Colosse : une grille de tuiles mobile, parcourable dessus et dedans, faite de modules.
import { TILE, T, BG, tileDef } from '../world/tiles.js';
import { CHUNK } from '../world/world.js';
import { MOD, LEG_ROWS, CMODULES } from '../data/colossus.js';
import { analyzeColossus } from '../systems/colossusdesign.js';
import { paintChunk } from '../render/tilepaint.js';
import { makeCanvas, ctx2d } from '../render/canvas.js';
import { hex, css, scale, mix } from '../core/color.js';

const PALETTES = {
  dormeur: { metal: '#7e6c58', rust: '#946038', girder: '#5c5046', organic: '#a0606a', glass: '#a8b8b0', bgwall: '#3a3028', pipe: '#6e6254', concrete: '#8a7e6e', tin: '#8a7a66', wood: '#6a543e', moss: '#7a7a4a', sand: '#c0965e', bone: '#d0c4ac', brick: '#8a5a44', water: '#3f7f8f', plant: '#7a8a4a', rock: '#7a6a58', root: '#6a4a3a', rubble: '#8a7a64', soil: '#5a4232', bedrock: '#3a3028' },
  gardien: { metal: '#4e5862', rust: '#6e4a3e', girder: '#3c424a', organic: '#7a4a62', glass: '#8a9aac', bgwall: '#262a30', pipe: '#4a525a', concrete: '#6a6e74', tin: '#5a626a', wood: '#4a3e36', moss: '#5a7040', sand: '#8a7a68', bone: '#bab4ae', brick: '#6a4a44', water: '#3c6a80', plant: '#5a7040', rock: '#4e5862', root: '#5a3e3a', rubble: '#5a5e62', soil: '#3e3432', bedrock: '#262a30' },
  built: { metal: '#6e747e', rust: '#8a5a3a', girder: '#4a4e56', organic: '#a0606a', glass: '#b0c4cc', bgwall: '#30343a', pipe: '#5e646c', concrete: '#86888a', tin: '#7e848c', wood: '#6a543e', moss: '#6a7a4a', sand: '#b08e72', bone: '#d4c8bc', brick: '#865a4c', water: '#3c6a80', plant: '#6a7a4c', rock: '#6e747e', root: '#5a463e', rubble: '#7a6e74', soil: '#54443c', bedrock: '#30343a' },
};

let N = 1;

export class Colossus {
  constructor(o) {
    this.kind = 'colossus';
    this.id = o.id || 'col' + N++;
    this.name = o.name;
    this.type = o.type; // 'dormeur' | 'gardien' | 'construit'
    this.cells = o.cells.map((c) => ({ ...c }));
    this.ox = o.ox; // pixels, coin haut-gauche de la grille
    this.oy = o.oy;
    this.facing = o.facing || 1;
    this.buried = !!o.buried;
    this.active = !!o.active;
    this.ai = o.ai || null;
    this.pal = PALETTES[o.palette || 'built'];
    this.palC = {};
    for (const k in this.pal) this.palC[k] = hex(this.pal[k]);
    this.t = 0;
    this.walk = 0;
    this.dx = 0;
    this.dy = 0;
    this.speed = 0;
    this.pilot = null;
    this.work = o.work || {}; // progression des travaux par case
    this.paid = o.paid || {}; // réparations payées
    this.data = o.data || {};
    this.kneel = 0;
    this.build();
  }

  // --- Grille --------------------------------------------------------------------
  build() {
    const all = this.cells;
    const built = all.filter((c) => c.state === 'ok' || c.state === 'endommage');
    const maxX = Math.max(...all.map((c) => c.x));
    const maxY = Math.max(...all.map((c) => c.y));
    const hasLeg = built.some((c) => CMODULES[c.m].loco === 'jambe');
    const hasTrack = built.some((c) => CMODULES[c.m].loco === 'chenille');
    this.legRows = hasLeg ? LEG_ROWS : hasTrack ? 3 : all.some((c) => CMODULES[c.m].loco === 'jambe') ? LEG_ROWS : 3;
    this.gw = (maxX + 1) * MOD;
    this.bodyRows = (maxY + 1) * MOD;
    this.gh = this.bodyRows + this.legRows;
    const W = this.gw;
    const H = this.gh;
    const tiles = new Uint8Array(W * H);
    const bg = new Uint8Array(W * H);
    const set = (x, y, id) => {
      if (x >= 0 && y >= 0 && x < W && y < H) tiles[y * W + x] = id;
    };
    const setBg = (x, y, id) => {
      if (x >= 0 && y >= 0 && x < W && y < H) bg[y * W + x] = id;
    };
    const has = (x, y) => built.some((c) => c.x === x && c.y === y);
    for (const c of built) {
      const M = CMODULES[c.m];
      const x0 = c.x * MOD;
      const y0 = c.y * MOD;
      const wall = M.organic ? T.ORGANIC : T.METAL;
      const bgt = M.organic ? BG.ORGANIC : c.m === 'habitat' ? BG.WOOD : c.m === 'ossature' ? BG.PIPES : BG.METAL;
      for (let y = y0; y < y0 + MOD; y++) for (let x = x0; x < x0 + MOD; x++) setBg(x, y, bgt);
      if (!has(c.x, c.y - 1)) for (let x = x0; x < x0 + MOD; x++) set(x, y0, wall);
      for (let x = x0; x < x0 + MOD; x++) set(x, y0 + MOD - 1, T.METAL);
      if (!has(c.x - 1, c.y)) for (let y = y0; y < y0 + MOD; y++) set(x0, y, wall);
      if (!has(c.x + 1, c.y)) for (let y = y0; y < y0 + MOD; y++) set(x0 + MOD - 1, y, wall);
      // échelles entre étages
      if (has(c.x, c.y + 1)) set(x0 + 1, y0 + MOD - 1, T.LADDER);
      if (has(c.x, c.y - 1)) for (let y = y0; y < y0 + MOD - 1; y++) set(x0 + 1, y, T.LADDER);
      // trappe sur le toit
      if (!has(c.x, c.y - 1)) {
        set(x0 + 2, y0, T.GRATE);
        set(x0 + 2, y0 + 1, T.LADDER);
        set(x0 + 2, y0 + 2, T.LADDER);
      }
      // jambes : une échelle descend jusqu'au sol
      if (M.loco === 'jambe') {
        for (let y = y0 + MOD - 1; y < H; y++) set(x0 + 1, y, T.LADDER);
      }
      if (M.loco === 'chenille') for (let y = this.bodyRows; y < this.bodyRows + 3; y++) for (let x = x0; x < x0 + MOD; x++) set(x, y, T.METAL);
    }
    this.tiles = tiles;
    this.bgTiles = bg;
    const self = this;
    this.grid = {
      carrier: true,
      dx: 0,
      dy: 0,
      ox: this.ox,
      oy: this.oy,
      owner: this,
      get(x, y) {
        if (x < 0 || y < 0 || x >= W || y >= H) return T.AIR;
        return tiles[y * W + x];
      },
      getBg(x, y) {
        if (x < 0 || y < 0 || x >= W || y >= H) return BG.NONE;
        return bg[y * W + x];
      },
      palette: (key) => self.palC[key] || self.palC.metal,
    };
    this.canvas = null;
    this.analysis = analyzeColossus(this.cells);
  }

  paint() {
    const W = this.gw * TILE;
    const H = this.gh * TILE;
    const c = makeCanvas(W, H);
    const g = ctx2d(c);
    for (let cy = 0; cy * CHUNK < this.gh; cy++)
      for (let cx = 0; cx * CHUNK < this.gw; cx++) {
        const ch = paintChunk(this.grid, cx, cy);
        g.drawImage(ch, cx * CHUNK * TILE, cy * CHUNK * TILE);
      }
    this.canvas = c;
  }

  get x() {
    return this.ox;
  }
  get y() {
    return this.oy;
  }
  get w() {
    return this.gw * TILE;
  }
  get h() {
    return this.gh * TILE;
  }
  get cx() {
    return this.ox + this.w / 2;
  }
  get cy() {
    return this.oy + (this.bodyRows * TILE) / 2;
  }

  cellRect(c) {
    return { x: this.ox + c.x * MOD * TILE, y: this.oy + c.y * MOD * TILE, w: MOD * TILE, h: MOD * TILE };
  }

  feet() {
    return this.cells.filter((c) => (c.state === 'ok' || c.state === 'endommage') && CMODULES[c.m].loco).map((c) => ({ c, x: this.ox + (c.x * MOD + 2) * TILE, hipY: this.oy + (c.y + 1) * MOD * TILE }));
  }

  // --- Mouvement -------------------------------------------------------------------
  groundBelow(world, px, fromY, maxDist) {
    const tx = Math.floor(px / TILE);
    let ty = Math.max(0, Math.floor(fromY / TILE));
    const end = Math.floor((fromY + maxDist) / TILE);
    for (; ty <= end; ty++) {
      const d = tileDef(world.get(tx, ty));
      if (d.solid || d.oneWay) return ty * TILE;
    }
    return null;
  }

  // Avance d'un pas si le terrain le permet ; renvoie une raison sinon.
  tryMove(game, vx, dt) {
    const world = game.world;
    const legLen = this.legRows * TILE;
    const legMax = legLen * 2.2;
    const nox = this.ox + vx * dt;
    let best = Infinity;
    const shift = nox - this.ox;
    for (const f of this.feet()) {
      const gy = this.groundBelow(world, f.x + shift, f.hipY - legLen * 0.6, legMax + legLen * 0.6);
      if (gy === null) return 'vide';
      best = Math.min(best, gy);
    }
    if (best === Infinity) return 'pieds';
    const noy = best - (this.bodyRows * TILE + legLen);
    // le corps ne traverse pas la roche ; il écrase le sable et les gravats
    const tx0 = Math.floor(nox / TILE);
    const ty0 = Math.floor(noy / TILE);
    let hard = 0;
    const crush = [];
    for (let y = ty0; y < ty0 + this.bodyRows; y++)
      for (let x = tx0; x < tx0 + this.gw; x++) {
        if (this.grid.get(x - tx0, y - ty0) === T.AIR && !this.cellAtTile(x - tx0, y - ty0)) continue;
        const id = world.get(x, y);
        const d = tileDef(id);
        if (!d.solid) continue;
        if (id === T.SAND || id === T.RUBBLE || id === T.DEADWOOD || id === T.SCRAP || id === T.SOIL || id === T.MOSSROCK || id === T.ROOT) crush.push([x, y]);
        else hard++;
      }
    if (hard > 2) return 'roche';
    for (const [x, y] of crush.slice(0, 40)) {
      world.set(x, y, T.AIR);
      if (Math.random() < 0.3) game.particles.dust(x * TILE + 8, y * TILE + 8, Math.sign(vx), 2);
    }
    this.ox = nox;
    this.oy += (noy - this.oy) * Math.min(1, dt * 3);
    return null;
  }

  cellAtTile(lx, ly) {
    const cx = Math.floor(lx / MOD);
    const cy = Math.floor(ly / MOD);
    return this.cells.find((c) => c.x === cx && c.y === cy && (c.state === 'ok' || c.state === 'endommage'));
  }

  update(dt, game) {
    this.t += dt;
    const px = this.ox;
    const py = this.oy;
    if (this.active && !this.buried) {
      if (this.pilot) this.piloted(dt, game);
      else if (this.ai) this.ai(this, dt, game);
      else this.speed *= 0.9;
      if (Math.abs(this.speed) > 1) {
        const why = this.tryMove(game, this.speed, dt);
        if (why) {
          this.speed = 0;
          if (this.pilot && !this.blockedMsg) {
            this.blockedMsg = 2;
            game.toast(why === 'vide' ? 'Le sol manque devant : le colosse refuse d’avancer.' : why === 'roche' ? 'La roche bloque le passage.' : 'Il ne peut pas avancer.', 'bad');
          }
        } else this.walk += dt * Math.abs(this.speed) * 0.05;
      }
      if (this.blockedMsg) this.blockedMsg = Math.max(0, this.blockedMsg - dt);
      // tremblement des pas
      const step = Math.floor(this.walk);
      if (step !== this.lastStep) {
        this.lastStep = step;
        if (Math.abs(this.speed) > 1) {
          const d = Math.hypot(game.player.cx - this.cx, game.player.cy - this.cy);
          if (d < 900) game.camera.shake(Math.max(0.5, 4 - d / 250));
          game.audio && game.audio.sfx('stomp', { x: this.cx, dist: d });
          for (const f of this.feet()) game.particles.dust(f.x, this.oy + this.h, 0, 6);
        }
      }
    }
    this.dx = this.ox - px;
    this.dy = this.oy - py;
    this.grid.ox = this.ox;
    this.grid.oy = this.oy;
    this.grid.dx = this.dx;
    this.grid.dy = this.dy;
    if (this.active && Math.random() < dt * 2) {
      for (const c of this.cells) if (c.m === 'chaudiere' && c.state === 'ok') game.particles.steam(this.ox + (c.x * MOD + 3) * TILE, this.oy + c.y * MOD * TILE, 1, 2);
    }
  }

  piloted(dt, game) {
    const input = game.input;
    let v = 0;
    if (!game.ui.blocking()) {
      if (input.is('left')) v -= 1;
      if (input.is('right')) v += 1;
    }
    const a = this.analysis;
    const top = a.loco === 'chenille' ? 22 : 34;
    this.speed += (v * top - this.speed) * Math.min(1, dt * 1.2);
    if (v) this.facing = v;
  }

  // --- Rendu --------------------------------------------------------------------------
  drawBehind(g, game, view) {
    if (!this.buried) return;
    this.drawAll(g, game, view);
  }

  drawBody(g, game, view) {
    if (this.buried) return;
    this.drawAll(g, game, view);
  }

  drawAll(g, game, view) {
    if (this.ox > view.x + view.w + 200 || this.ox + this.w < view.x - 200) return;
    if (!this.canvas) this.paint();
    this.drawLegs(g, game);
    this.drawShell(g, game, true);
    g.drawImage(this.canvas, Math.round(this.ox), Math.round(this.oy));
    this.drawProps(g, game);
    this.drawShell(g, game, false);
  }

  // Carapace extérieure : plaques dorsales, tête, cheminées — ce qui fait d'un bâtiment un géant.
  drawShell(g, game, back) {
    const built = this.cells.filter((c) => c.state === 'ok' || c.state === 'endommage');
    if (!built.length) return;
    const metal = this.palC.metal;
    const t = this.t;
    if (back) {
      // plaques dorsales arrondies au-dessus de chaque case du sommet
      for (const c of built) {
        if (built.some((q) => q.x === c.x && q.y === c.y - 1)) continue;
        const r = this.cellRect(c);
        g.fillStyle = css(scale(metal, 0.82));
        g.beginPath();
        g.moveTo(r.x - 3, r.y + 6);
        g.quadraticCurveTo(r.x + r.w / 2, r.y - 22, r.x + r.w + 3, r.y + 6);
        g.closePath();
        g.fill();
        g.fillStyle = css(scale(metal, 1.08));
        g.fillRect(r.x + 6, r.y - 6, r.w - 12, 2);
        if ((c.x + c.y) % 2 === 0) {
          g.fillStyle = css(scale(metal, 0.6));
          g.fillRect(r.x + r.w / 2 - 3, r.y - 30, 6, 22);
          g.fillRect(r.x + r.w / 2 - 5, r.y - 32, 10, 4);
        }
      }
      return;
    }
    // la tête, à l'avant de la salle de commande (ou de la mémoire)
    const head = built.find((c) => c.m === 'commande') || built.find((c) => c.m === 'memoire');
    if (!head) return;
    const r = this.cellRect(head);
    const f = this.facing;
    const edge = f > 0 ? Math.max(...built.map((c) => c.x)) : Math.min(...built.map((c) => c.x));
    const hx = f > 0 ? this.ox + (edge + 1) * MOD * TILE : this.ox + edge * MOD * TILE;
    const hy = r.y + 6;
    g.save();
    g.translate(hx, hy);
    g.scale(f, 1);
    g.fillStyle = css(scale(metal, 0.9));
    g.beginPath();
    g.moveTo(-6, 0);
    g.lineTo(34, 6);
    g.lineTo(46, 26);
    g.lineTo(38, 48);
    g.lineTo(10, 56);
    g.lineTo(-6, 50);
    g.closePath();
    g.fill();
    g.fillStyle = css(scale(metal, 0.65));
    g.beginPath();
    g.moveTo(10, 40);
    g.lineTo(40, 40);
    g.lineTo(34, 54);
    g.lineTo(10, 56);
    g.closePath();
    g.fill();
    // œil
    const awake = this.active && !this.buried;
    const calm = this.data.calm;
    g.fillStyle = awake ? (calm ? 'rgba(170,200,255,0.9)' : this.type === 'gardien' ? 'rgba(255,120,80,0.95)' : 'rgba(255,210,140,0.95)') : 'rgba(40,36,32,0.9)';
    g.beginPath();
    g.ellipse(28, 22, 7, 4, -0.2, 0, Math.PI * 2);
    g.fill();
    if (awake) {
      const gr = g.createRadialGradient(28, 22, 1, 28, 22, 26);
      gr.addColorStop(0, calm ? 'rgba(170,200,255,0.35)' : 'rgba(255,190,120,0.35)');
      gr.addColorStop(1, 'rgba(255,190,120,0)');
      g.fillStyle = gr;
      g.fillRect(2, -4, 52, 52);
    }
    g.fillStyle = css(scale(metal, 1.15));
    g.fillRect(2, 4, 30, 3);
    g.restore();
  }

  drawLegs(g, game) {
    const legLen = this.legRows * TILE;
    const col = css(this.palC.metal);
    const dark = css(scale(this.palC.metal, 0.7));
    for (const f of this.feet()) {
      const M = CMODULES[f.c.m];
      if (M.loco === 'chenille') {
        const x0 = this.ox + f.c.x * MOD * TILE;
        const y0 = this.oy + this.bodyRows * TILE;
        g.fillStyle = '#2a2826';
        g.fillRect(x0 - 2, y0 + 4, MOD * TILE + 4, 3 * TILE - 4);
        g.fillStyle = '#4a4846';
        const off = (this.walk * 8) % 8;
        for (let k = -1; k < 9; k++) g.fillRect(x0 + k * 8 + off, y0 + 4, 3, 3 * TILE - 4);
        continue;
      }
      const ground = this.oy + this.h;
      const ph = this.walk * Math.PI + (f.c.x % 2) * Math.PI;
      const swing = Math.abs(this.speed) > 1 ? Math.sin(ph) * 10 : 0;
      const lift = Math.abs(this.speed) > 1 ? Math.max(0, Math.sin(ph)) * 8 : 0;
      const hx = f.x;
      const hy = f.hipY - 4;
      const fx = f.x + swing * this.facing;
      const fy = ground - lift;
      const kx = (hx + fx) / 2 - 18 * this.facing;
      const ky = (hy + fy) / 2 - this.kneel * 20;
      g.lineCap = 'round';
      g.strokeStyle = dark;
      g.lineWidth = 22;
      g.beginPath();
      g.moveTo(hx, hy);
      g.lineTo(kx, ky);
      g.lineTo(fx, fy - 6);
      g.stroke();
      g.strokeStyle = col;
      g.lineWidth = 16;
      g.stroke();
      // pistons
      g.strokeStyle = css(scale(this.palC.metal, 1.25));
      g.lineWidth = 4;
      g.beginPath();
      g.moveTo(hx + 6, hy + 6);
      g.lineTo(kx + 6, ky);
      g.stroke();
      g.fillStyle = dark;
      g.beginPath();
      g.arc(kx, ky, 12, 0, Math.PI * 2);
      g.fill();
      g.fillStyle = col;
      g.fillRect(fx - 26, fy - 12, 52, 12);
      g.fillStyle = dark;
      g.fillRect(fx - 26, fy - 3, 52, 3);
      g.lineCap = 'butt';
    }
  }

  drawProps(g, game) {
    const t = this.t;
    for (const c of this.cells) {
      const r = this.cellRect(c);
      const M = CMODULES[c.m];
      const cx = r.x + r.w / 2;
      const by = r.y + r.h - TILE; // sol intérieur
      if (c.state === 'manquant' || c.state === 'plan' || c.state === 'livre') {
        // emplacement vide : un cadre fantôme
        g.strokeStyle = c.state === 'livre' ? 'rgba(240,200,110,0.8)' : 'rgba(214,190,150,0.45)';
        g.setLineDash([6, 5]);
        g.lineWidth = 2;
        g.strokeRect(r.x + 3, r.y + 3, r.w - 6, r.h - 6);
        g.setLineDash([]);
        if (c.state === 'manquant') {
          g.strokeStyle = 'rgba(40,30,30,0.8)';
          g.lineWidth = 2;
          g.beginPath();
          g.moveTo(r.x + 10, r.y + 4);
          g.quadraticCurveTo(r.x + 16, r.y + 26, r.x + 12, r.y + 34);
          g.moveTo(r.x + r.w - 12, r.y + 4);
          g.quadraticCurveTo(r.x + r.w - 20, r.y + 20, r.x + r.w - 14, r.y + 30);
          g.stroke();
        }
        const w = this.work[c.x + ',' + c.y];
        if (w && c.state === 'livre') {
          g.fillStyle = 'rgba(240,200,110,0.9)';
          g.fillRect(r.x + 6, r.y + r.h - 8, (r.w - 12) * Math.min(1, w / (M.work || 30)), 3);
        }
        continue;
      }
      const on = this.active && c.state === 'ok';
      switch (c.m) {
        case 'commande': {
          g.fillStyle = '#3a2e26';
          g.fillRect(cx - 6, by - 10, 12, 10);
          g.fillStyle = '#6a4a3a';
          g.fillRect(cx - 8, by - 16, 4, 16);
          g.strokeStyle = '#a08a60';
          g.lineWidth = 2;
          for (let k = 0; k < 3; k++) {
            g.beginPath();
            g.moveTo(cx + 6 + k * 4, by - 2);
            g.lineTo(cx + 8 + k * 4 + (on ? Math.sin(t * 2 + k) * 2 : 0), by - 12);
            g.stroke();
          }
          g.fillStyle = on ? 'rgba(255,220,150,0.8)' : 'rgba(150,170,180,0.4)';
          g.beginPath();
          g.arc(r.x + r.w - 14, r.y + 16, 7, 0, Math.PI * 2);
          g.fill();
          break;
        }
        case 'chaudiere': {
          g.fillStyle = '#6a4a3a';
          g.fillRect(r.x + 10, r.y + 12, r.w - 20, r.h - 28);
          g.fillStyle = '#8a6a52';
          g.fillRect(r.x + 10, r.y + 12, r.w - 20, 4);
          g.fillStyle = on ? '#ff9a40' : '#2a201c';
          g.fillRect(cx - 8, by - 12, 16, 9);
          if (on) {
            const gr = g.createRadialGradient(cx, by - 8, 2, cx, by - 8, 30);
            gr.addColorStop(0, 'rgba(255,170,90,0.5)');
            gr.addColorStop(1, 'rgba(255,170,90,0)');
            g.fillStyle = gr;
            g.fillRect(cx - 30, by - 38, 60, 60);
          }
          break;
        }
        case 'refroid': {
          const a = on ? t * 8 : 0;
          g.strokeStyle = '#8a9098';
          g.lineWidth = 3;
          for (let k = 0; k < 4; k++) {
            g.beginPath();
            g.moveTo(cx, r.y + r.h / 2 - 4);
            g.lineTo(cx + Math.cos(a + (k * Math.PI) / 2) * 14, r.y + r.h / 2 - 4 + Math.sin(a + (k * Math.PI) / 2) * 14);
            g.stroke();
          }
          break;
        }
        case 'gyroscope': {
          const a = on ? t * 3 : 0;
          g.strokeStyle = '#b08a4a';
          g.lineWidth = 2;
          g.beginPath();
          g.ellipse(cx, r.y + r.h / 2 - 4, 14, 14 * Math.abs(Math.cos(a)), 0, 0, Math.PI * 2);
          g.stroke();
          g.beginPath();
          g.ellipse(cx, r.y + r.h / 2 - 4, 14 * Math.abs(Math.sin(a)), 14, 0, 0, Math.PI * 2);
          g.stroke();
          break;
        }
        case 'equilibre':
        case 'coeur_org':
        case 'memoire': {
          const beat = 1 + Math.max(0, Math.sin(t * (on ? 2.2 : 0.6))) * 0.08;
          const col = c.m === 'memoire' ? (this.data.calm ? '#8a7aa0' : '#a05a8a') : c.m === 'coeur_org' ? '#b04a4a' : '#a06a6a';
          g.fillStyle = col;
          g.beginPath();
          g.ellipse(cx, r.y + r.h / 2 - 2, 16 * beat, 13 * beat, 0, 0, Math.PI * 2);
          g.fill();
          g.strokeStyle = 'rgba(40,20,30,0.6)';
          g.lineWidth = 1.5;
          for (let k = 0; k < 5; k++) {
            g.beginPath();
            g.moveTo(cx, r.y + r.h / 2 - 2);
            g.lineTo(cx + Math.cos(k * 1.3) * 18, r.y + r.h / 2 - 2 + Math.sin(k * 1.3) * 14);
            g.stroke();
          }
          if (c.m === 'memoire' && !this.data.calm) {
            g.fillStyle = `rgba(220,140,255,${(0.2 + Math.sin(t * 4) * 0.1).toFixed(3)})`;
            g.beginPath();
            g.arc(cx, r.y + r.h / 2 - 2, 26, 0, Math.PI * 2);
            g.fill();
          }
          break;
        }
        case 'habitat':
          g.fillStyle = '#7a5a44';
          g.fillRect(r.x + 8, by - 6, 24, 6);
          g.fillStyle = '#b8a488';
          g.fillRect(r.x + 8, by - 8, 8, 3);
          g.fillStyle = '#3a3028';
          g.fillRect(r.x + r.w - 18, by - 12, 8, 12);
          g.fillStyle = on ? '#ffb060' : '#2a2420';
          g.fillRect(r.x + r.w - 16, by - 7, 4, 3);
          break;
        case 'reservoir':
          g.fillStyle = '#4a5a62';
          g.fillRect(r.x + 10, r.y + 10, r.w - 20, r.h - 26);
          g.fillStyle = '#5aa0b8';
          g.fillRect(r.x + 12, r.y + 10 + (r.h - 26) * 0.35, r.w - 24, (r.h - 26) * 0.65 - 2);
          break;
        case 'serre':
          g.fillStyle = 'rgba(170,210,190,0.35)';
          g.beginPath();
          g.ellipse(cx, r.y + 4, r.w / 2 - 2, 22, 0, Math.PI, 0);
          g.fill();
          g.strokeStyle = '#6a7a7a';
          g.lineWidth = 2;
          g.stroke();
          g.fillStyle = '#6a9a4a';
          for (let k = 0; k < 5; k++) g.fillRect(r.x + 10 + k * 9, r.y + 2 - (4 + (k % 3) * 3), 2, 4 + (k % 3) * 3);
          break;
        case 'bras': {
          const side = !this.cellExists(c.x - 1, c.y) ? -1 : 1;
          const bx = side < 0 ? r.x : r.x + r.w;
          const swing = this.data.digging ? Math.sin(t * 6) * 0.6 : 0.3;
          g.strokeStyle = css(this.palC.metal);
          g.lineWidth = 12;
          g.lineCap = 'round';
          const ex = bx + side * 40 * Math.cos(swing);
          const ey = r.y + 20 + 40 * Math.sin(swing);
          g.beginPath();
          g.moveTo(bx, r.y + 22);
          g.lineTo(ex, ey);
          g.lineTo(ex + side * 18, ey + 30);
          g.stroke();
          g.lineCap = 'butt';
          g.fillStyle = css(scale(this.palC.metal, 0.7));
          g.fillRect(ex + side * 18 - 10, ey + 26, 20, 12);
          break;
        }
        case 'pont': {
          const side = this.facing;
          const bx = side < 0 ? r.x - 6 : r.x + r.w;
          g.fillStyle = css(this.palC.girder);
          for (let k = 0; k < 4; k++) g.fillRect(bx, r.y + 8 + k * 12, 6, 10);
          break;
        }
        case 'canon': {
          const side = this.facing;
          const bx = side < 0 ? r.x : r.x + r.w;
          g.fillStyle = '#4a4e56';
          g.fillRect(side < 0 ? bx - 34 : bx, r.y + 22, 34, 14);
          g.fillStyle = '#2a2c30';
          g.fillRect(side < 0 ? bx - 38 : bx + 30, r.y + 20, 8, 18);
          break;
        }
        case 'blindage':
          g.fillStyle = 'rgba(80,86,94,0.5)';
          g.fillRect(r.x + 2, r.y + 2, r.w - 4, 6);
          break;
      }
      if (c.state === 'endommage') {
        g.strokeStyle = 'rgba(30,20,16,0.85)';
        g.lineWidth = 2;
        g.beginPath();
        g.moveTo(r.x + 14, r.y + 8);
        g.lineTo(r.x + 24, r.y + 22);
        g.lineTo(r.x + 18, r.y + 34);
        g.lineTo(r.x + 30, r.y + 44);
        g.stroke();
        g.fillStyle = 'rgba(148,82,46,0.55)';
        g.fillRect(r.x + 34, r.y + 12, 14, 10);
        if (Math.random() < 0.04) game.particles.sparks(r.x + 26, r.y + 24, 3);
        const w = this.work[c.x + ',' + c.y];
        if (w) {
          g.fillStyle = 'rgba(240,200,110,0.9)';
          g.fillRect(r.x + 6, r.y + r.h - 8, (r.w - 12) * Math.min(1, w / (CMODULES[c.m].work || 30)), 3);
        }
      }
    }
  }

  cellExists(x, y) {
    return this.cells.some((c) => c.x === x && c.y === y && c.state !== 'plan' && c.state !== 'manquant');
  }

  drawFront() {}

  lights(out) {
    if (!this.active) return;
    for (const c of this.cells) {
      if (c.state !== 'ok') continue;
      if (c.m === 'chaudiere' || c.m === 'commande' || c.m === 'habitat') {
        const r = this.cellRect(c);
        out.push({ x: r.x + r.w / 2, y: r.y + r.h / 2, r: 70, i: 0.5 });
      }
    }
  }

  toJSON() {
    return { id: this.id, name: this.name, type: this.type, cells: this.cells, ox: this.ox, oy: this.oy, facing: this.facing, buried: this.buried, active: this.active, work: this.work, paid: this.paid, data: this.data, palette: Object.keys(PALETTES).find((k) => PALETTES[k] === this.pal) };
  }
}
