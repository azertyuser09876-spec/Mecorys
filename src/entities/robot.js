// Robot programmable : reçoit des ordres précis, récolte, dépose, arrose, participe aux chantiers.
import { TILE, T, tileDef } from '../world/tiles.js';
import { moveBody, climbAt } from '../world/physics.js';
import { CELL, MODULES } from '../data/modules.js';
import { analyze, normalize } from '../systems/robotdesign.js';
import { drawModule } from '../render/robotdraw.js';
import { findPath } from '../systems/nav.js';

let NEXT = 1;

export const ORDERS = {
  suivre: 'Suivre',
  attendre: 'Attendre ici',
  recolter: 'Récolter',
  deblayer: 'Déblayer la zone',
  arroser: 'Arroser et semer',
  construire: 'Travailler au chantier',
  livrer: 'Livrer les caisses',
};

export function drawCells(g, cells, x, y, s, st = {}) {
  for (const c of cells) drawModule(g, c.m, x + c.x * s, y + c.y * s, s, st);
}

export class Robot {
  constructor(design, x, y, opts = {}) {
    this.kind = 'robot';
    this.id = opts.id || 'r' + Date.now().toString(36) + NEXT++;
    this.name = opts.name || design.name || 'Robot';
    this.designId = design.id;
    this.cells = normalize(design.cells.map((c) => ({ ...c })));
    this.a = analyze(this.cells);
    this.w = this.a.w * CELL;
    this.h = this.a.h * CELL;
    this.x = x - this.w / 2;
    this.y = y - this.h;
    this.vx = 0;
    this.vy = 0;
    this.facing = 1;
    this.t = Math.random() * 5;
    this.phase = 0;
    this.order = opts.order || { type: 'suivre' };
    this.cargo = opts.cargo || {};
    this.state = 'idle';
    this.target = null;
    this.work = 0;
    this.stuck = 0;
    this.lastX = this.x;
    this.unreachable = new Set();
    this.rider = null;
    this.interactable = true;
    this.working = false;
    this.msg = '';
  }

  get cx() {
    return this.x + this.w / 2;
  }
  get cy() {
    return this.y + this.h / 2;
  }
  cargoCount() {
    let n = 0;
    for (const k in this.cargo) n += this.cargo[k];
    return n;
  }
  seatX() {
    const s = this.cells.find((c) => c.m === 'siege');
    return this.x + (s ? (s.x + 0.5) * CELL : this.w / 2);
  }
  seatY() {
    const s = this.cells.find((c) => c.m === 'siege');
    return this.y + (s ? (s.y + 0.8) * CELL : 0) + 2;
  }

  prompt(game) {
    if (game.player.riding) return null;
    const st = this.statusText(game);
    if (this.a.seat) return { text: `${this.name} — ordres`, info: st + ` · ${game.input.label('machine')} pour monter` };
    return { text: `${this.name} — ordres`, info: st };
  }

  interact(game) {
    game.robots.openOrders(this);
  }

  statusText(game) {
    const o = this.order;
    let s = ORDERS[o.type] || o.type;
    if (o.type === 'recolter' && o.res && o.res !== 'tout') s += ' ' + o.res;
    if (this.msg) s += ' — ' + this.msg;
    const n = this.cargoCount();
    if (n) s += ` (${n}/${this.a.cargo})`;
    return s;
  }

  setOrder(order) {
    this.order = order;
    this.state = 'idle';
    this.target = null;
    this.unreachable.clear();
    this.msg = '';
  }

  dismount(game) {
    if (!this.rider) return;
    const p = this.rider;
    this.rider = null;
    p.riding = null;
    p.state = 'air';
    p.teleport(this.cx + this.facing * -(this.w / 2 + 6), this.y + this.h - 1);
  }

  update(dt, game) {
    this.t += dt;
    this.working = false;
    const a = this.a;
    const speed = a.speed;
    let wantX = 0;
    let wantY = 0;
    if (this.rider) {
      const input = game.input;
      if (!game.ui.blocking()) {
        if (input.is('left')) wantX -= 1;
        if (input.is('right')) wantX += 1;
        if (input.is('up') || input.is('jump')) wantY -= 1;
        if (input.is('down')) wantY += 1;
      }
      this.drive(dt, game, wantX * speed * 1.15, wantY * speed);
      if (a.loco === 'patte' && input.hit('jump') && this.onGround) this.vy = -230;
      return;
    }
    this.think(dt, game);
  }

  // Intelligence : chaque ordre est une petite machine à états.
  think(dt, game) {
    this.mining = false;
    this.forget = (this.forget || 0) + dt;
    if (this.forget > 45) {
      this.forget = 0;
      this.unreachable.clear();
    }
    const p = game.player;
    const o = this.order;
    const a = this.a;
    let tx = null;
    let ty = null;
    switch (o.type) {
      case 'suivre': {
        const d = p.cx - this.cx;
        if (Math.abs(d) > 1200 || Math.abs(p.cy - this.cy) > 600) this.teleportNear(game, p.cx, p.y + p.h);
        if (Math.abs(d) > 34 || Math.abs(p.cy - this.cy) > 48) {
          tx = p.cx - Math.sign(d) * 24;
          ty = a.flies ? p.cy - 30 : p.y + p.h - 4;
        }
        this.msg = '';
        break;
      }
      case 'attendre':
        if (o.ax !== undefined && (Math.abs(o.ax - this.cx) > 10 || Math.abs(o.ay - this.cy) > 40)) {
          tx = o.ax;
          ty = o.ay;
        }
        break;
      case 'recolter':
      case 'deblayer':
        [tx, ty] = this.harvest(dt, game, o.type === 'deblayer');
        break;
      case 'arroser':
        [tx, ty] = this.water(dt, game);
        break;
      case 'construire':
        [tx, ty] = this.build(dt, game);
        break;
      case 'livrer':
        [tx, ty] = this.deliver(dt, game);
        break;
    }
    let vx = 0;
    let vy = 0;
    if (tx !== null) {
      const wp = this.navigate(game, tx, ty === null ? this.y + this.h - 4 : ty);
      if (wp === false) this.onUnreachable(game);
      else if (wp) {
        tx = wp.x;
        ty = wp.y;
      } else tx = ty = null;
    }
    if (tx !== null) {
      const d = tx - this.cx;
      if (Math.abs(d) > 2) vx = Math.sign(d) * this.a.speed * (Math.abs(d) < 12 ? 0.5 : 1);
    }
    if (ty !== null && (a.flies || a.climbs)) {
      const d = ty - (a.flies ? this.cy : this.y + this.h - 8);
      if (Math.abs(d) > 3) vy = Math.sign(d) * this.a.speed * 0.8;
    }
    this.drive(dt, game, vx, vy);
    // une cible qu'on n'atteint ni ne travaille finit par être abandonnée
    if (this.target && !this.working && vx === 0 && vy === 0) {
      this.idleT = (this.idleT || 0) + dt;
      if (this.idleT > 2) {
        this.idleT = 0;
        this.unreachable.add(this.target.tx + ',' + this.target.ty);
        this.target = null;
      }
    } else this.idleT = 0;
    // blocage
    if (Math.abs(vx) > 1 && Math.abs(this.x - this.lastX) < 0.15) this.stuck += dt;
    else this.stuck = Math.max(0, this.stuck - dt * 2);
    this.lastX = this.x;
    if (this.stuck > 2.5) {
      this.stuck = 0;
      if (this.target) this.unreachable.add(this.target.tx + ',' + this.target.ty);
      this.target = null;
      if (o.type === 'suivre' && Math.abs(p.cx - this.cx) > 200) this.teleportNear(game, p.cx, p.y + p.h, true);
    }
  }

  // Calcule (et met en cache) un chemin ; renvoie le prochain point de passage,
  // null si l'objectif est atteint, false s'il est inaccessible.
  navigate(game, gx, gy) {
    const T = TILE;
    const H = Math.max(1, Math.ceil(this.h / T));
    const rtx = Math.floor(this.cx / T);
    const rty = Math.floor((this.y + this.h - 2) / T);
    const gtx = Math.floor(gx / T);
    const gty = Math.floor(gy / T);
    const near = 1;
    // pour creuser, la tuile visée doit être à portée de l'outil depuis la case d'arrivée
    const mine = !!this.mining;
    const goalFn = mine
      ? (x, y) => Math.abs(x - gtx) <= 1 && gty >= y - H && gty <= y + 1 && !(x === gtx && y === gty)
      : (x, y) => Math.abs(x - gtx) <= near && Math.abs(y - gty) <= near + H;
    if (goalFn(rtx, rty)) return null;
    const P = this.path;
    const moved = P && (Math.abs(P.gtx - gtx) > 2 || Math.abs(P.gty - gty) > 2);
    this.pathAge = (this.pathAge || 0) + 1 / 60;
    if (!P || moved || this.pathAge > 3) {
      this.pathAge = 0;
      const a = this.a;
      const nodes = findPath(game.world, rtx, rty, goalFn, {
        height: H,
        stepUp: Math.round(a.stepUp / T) + 1, // + un petit saut
        maxDrop: Math.round(a.stepUp / T) + 1,
        climbs: a.climbs,
        flies: a.flies,
        radius: 110,
      });
      if (!nodes) {
        this.path = null;
        return false;
      }
      this.path = { nodes, gtx, gty, i: 0 };
    }
    const path = this.path;
    // avancer le long du chemin
    let i = path.i;
    while (i < path.nodes.length - 1) {
      const nd = path.nodes[i];
      if (Math.abs(nd.tx - rtx) <= 0 && Math.abs(nd.ty - rty) <= 1) i++;
      else break;
    }
    path.i = i;
    const nd = path.nodes[Math.min(i, path.nodes.length - 1)];
    return { x: nd.tx * T + 8, y: nd.ty * T + 8 };
  }

  onUnreachable(game) {
    const o = this.order;
    if (this.target && (o.type === 'recolter' || o.type === 'deblayer')) {
      this.unreachable.add(this.target.tx + ',' + this.target.ty);
      this.target = null;
      return;
    }
    if (o.type === 'suivre') {
      const p = game.player;
      if (Math.abs(p.cx - this.cx) > 160) this.teleportNear(game, p.cx, p.y + p.h);
      return;
    }
    if (this.state === 'return') this.msg = 'aucun chemin vers un dépôt : construis-en un plus près';
    else this.msg = 'chemin introuvable';
  }

  teleportNear(game, x, y, force) {
    // On ne téléporte jamais un robot sous les yeux du joueur.
    const cam = game.camera;
    if (!force && x > cam.x && x < cam.x + cam.w) {
      const off = x < cam.x + cam.w / 2 ? -cam.w / 2 - 40 : cam.w / 2 + 40;
      x += off;
    }
    const tx = Math.floor(x / TILE);
    let ty = Math.floor(y / TILE);
    for (let k = 0; k < 30 && game.world.solid(tx, ty); k++) ty--;
    for (let k = 0; k < 30 && !game.world.solid(tx, ty + 1); k++) ty++;
    this.x = tx * TILE + 8 - this.w / 2;
    this.y = (ty + 1) * TILE - this.h - 0.5;
    this.vx = this.vy = 0;
  }

  drive(dt, game, vx, vy) {
    const a = this.a;
    const grids = game.grids();
    if (vx) this.facing = Math.sign(vx);
    if (a.flies) {
      this.vx += (vx - this.vx) * Math.min(1, dt * 3);
      this.vy += ((vy || 0) - this.vy) * Math.min(1, dt * 3);
      // léger flottement
      this.vy += Math.sin(this.t * 1.7) * 4 * dt;
      moveBody(this, dt, grids, {});
    } else {
      this.vx += (vx - this.vx) * Math.min(1, dt * 6);
      const climbG = a.climbs && climbAt(grids, this.cx, this.cy);
      if (climbG && vy) {
        this.vy = vy;
      } else this.vy = Math.min(500, this.vy + 900 * dt);
      const wasGround = this.onGround;
      moveBody(this, dt, grids, { stepUp: a.stepUp, drop: vy > 0 });
      // petit saut quand une marche est trop haute
      if (this.hitWall && wasGround && vx) this.vy = -Math.sqrt(2 * 900 * (a.stepUp + 22));
    }
    if (Math.abs(this.vx) > 2) this.phase += dt * Math.abs(this.vx) * 0.25;
    if (this.onGround && this.groundRef && this.groundRef.carrier) {
      this.x += this.groundRef.dx || 0;
      this.y += this.groundRef.dy || 0;
    }
  }

  // --- Récolte -----------------------------------------------------------------------------
  canMine(game, x, y, clear) {
    const w = game.world;
    if (w.sealed && w.sealed[x]) return false;
    const id = w.get(x, y);
    const d = tileDef(id);
    if (!d.tool || d.built) return false;
    // ne pas creuser une fosse dont le robot ne pourrait pas ressortir
    if (!this.a.flies && !w.solid(x, y - 1)) {
      const climb = Math.round(this.a.stepUp / TILE) + 1;
      const surfAt = (cx) => {
        for (let yy = y - 8; yy < y + 12; yy++) if (w.solid(cx, yy)) return yy;
        return y + 12;
      };
      const depth = Math.min(y + 1 - surfAt(x - 1), y + 1 - surfAt(x + 1));
      if (depth > climb) return false;
    }
    if (d.tool === 'foreuse' && !this.a.tools.has('foreuse')) return false;
    if (d.tool === 'main' && !(this.a.tools.has('main') || this.a.tools.has('foreuse'))) return false;
    if (!clear) {
      if (!d.yields) return false;
      const f = this.order.res;
      if (f && f !== 'tout' && !(f in d.yields)) return false;
    }
    if (game.structureAt(x, y - 1) && !clear) return false;
    // la tuile doit être accessible : un voisin vide
    return !w.solid(x - 1, y) || !w.solid(x + 1, y) || !w.solid(x, y - 1) || !w.solid(x, y + 1);
  }

  findTarget(game, clear) {
    const o = this.order;
    const ax = o.ax !== undefined ? o.ax : this.cx;
    const ay = o.ay !== undefined ? o.ay : this.cy;
    const R = clear ? 9 : 16;
    const cx = Math.floor(ax / TILE);
    const cy = Math.floor(ay / TILE);
    let best = null;
    let bd = Infinity;
    const rx = Math.floor(this.cx / TILE);
    const ry = Math.floor(this.cy / TILE);
    for (let y = cy - R; y <= cy + R; y++)
      for (let x = cx - R; x <= cx + R; x++) {
        if (this.unreachable.has(x + ',' + y)) continue;
        if (!this.canMine(game, x, y, clear)) continue;
        // les robots qui ne grimpent pas ne visent pas trop haut
        const dy = ry - y;
        if (!this.a.flies && !this.a.climbs && dy > 3) continue;
        const d = Math.abs(x - rx) + Math.abs(y - ry) * 1.5;
        if (d < bd) {
          bd = d;
          best = { tx: x, ty: y };
        }
      }
    return best;
  }

  harvest(dt, game, clear) {
    const a = this.a;
    if (!a.tools.has('main') && !a.tools.has('foreuse')) {
      this.msg = 'aucun outil de récolte';
      return [null, null];
    }
    if (this.state === 'return' || this.cargoCount() >= a.cargo) {
      this.state = 'return';
      const dep = game.robots.depotFor(this);
      if (!dep) {
        this.msg = 'aucun dépôt ni refuge';
        return [null, null];
      }
      this.msg = 'retour au dépôt';
      if (Math.abs(dep.cx - this.cx) < 14 + dep.w / 2 && Math.abs(dep.y + dep.h - (this.y + this.h)) < 40) {
        game.inv.addAll(this.cargo);
        if (this.cargoCount()) game.robots.deposited(this, this.cargo);
        this.cargo = {};
        this.state = 'idle';
      }
      return [dep.cx, dep.y + dep.h - 8];
    }
    if (!this.target || !this.canMine(game, this.target.tx, this.target.ty, clear)) {
      this.target = this.findTarget(game, clear);
      this.work = 0;
      if (!this.target) {
        if (this.cargoCount()) this.state = 'return';
        this.msg = clear ? 'zone dégagée' : 'plus rien à récolter ici';
        return [null, null];
      }
    }
    this.msg = '';
    this.mining = true;
    const t = this.target;
    const px = t.tx * TILE + 8;
    const py = t.ty * TILE + 8;
    const bx = Math.max(this.x - px, 0, px - (this.x + this.w));
    const by = Math.max(this.y - py, 0, py - (this.y + this.h));
    if (Math.hypot(bx, by) < 30) {
      this.working = true;
      this.facing = px > this.cx ? 1 : -1;
      const d = tileDef(game.world.get(t.tx, t.ty));
      const k = (a.tools.has('foreuse') ? 1.25 : 0.85) * (a.energyRatio || 1);
      this.work += dt * k;
      if (Math.random() < dt * 6) game.particles.chips(px, py, d.mat, t.tx, t.ty);
      if (this.work >= d.time) {
        const y = game.dismantle(t.tx, t.ty, 'robot');
        if (y) for (const [r, n] of Object.entries(y)) this.cargo[r] = (this.cargo[r] || 0) + n;
        this.target = null;
        this.work = 0;
      }
      return [null, a.flies ? py - 10 : null];
    }
    return [px, py];
  }

  // --- Arrosage -----------------------------------------------------------------------
  water(dt, game) {
    if (!this.a.tools.has('eau')) {
      this.msg = 'aucun arroseur';
      return [null, null];
    }
    const o = this.order;
    const ax = o.ax !== undefined ? o.ax : this.cx;
    if (!this.wanderX || Math.abs(this.wanderX - this.cx) < 8) this.wanderX = ax + (Math.random() - 0.5) * 30 * TILE;
    this.working = true;
    const tx = Math.floor(this.cx / TILE);
    const ty = Math.floor((this.y + this.h) / TILE);
    game.ecology.boost(tx, ty, dt * 0.0035, dt * 0.0006);
    game.robots.sow(this, tx, ty, dt);
    this.msg = '';
    return [this.wanderX, this.a.flies ? game.world.surface(tx) * TILE - 34 : null];
  }

  // --- Chantier -----------------------------------------------------------------------
  build(dt, game) {
    if (!this.a.tools.has('soudure') && !this.a.tools.has('main')) {
      this.msg = 'aucun outil de chantier';
      return [null, null];
    }
    const site = game.robots.siteFor(this);
    if (!site) {
      this.msg = 'aucun chantier en cours';
      return [null, null];
    }
    this.msg = site.label || '';
    const d = Math.hypot(site.x - this.cx, site.y - this.cy);
    if (d < 40) {
      this.working = true;
      site.addWork(dt * (this.a.tools.has('soudure') ? 1 : 0.35) * (this.a.energyRatio || 1), this);
      if (Math.random() < dt * 4) game.particles.sparks(this.cx + this.facing * this.w / 2, this.cy);
      return [null, this.a.flies ? site.y : null];
    }
    return [site.x, site.y];
  }

  // --- Livraison des caisses ----------------------------------------------------------
  deliver(dt, game) {
    if (!this.a.crane) {
      this.msg = 'il faut un bras de levage';
      return [null, null];
    }
    const crate = this.carrying || game.robots.crateFor(this);
    if (!crate) {
      this.msg = 'aucune caisse à livrer';
      return [null, null];
    }
    if (!this.carrying) {
      this.msg = 'va chercher ' + crate.label;
      if (Math.abs(crate.cx - this.cx) < 20 && Math.abs(crate.cy - this.cy) < 40) {
        this.carrying = crate;
        crate.carrier = this;
      }
      return [crate.cx, crate.cy];
    }
    const dest = crate.dest(game);
    this.msg = 'livre ' + crate.label;
    if (!dest) return [null, null];
    if (Math.abs(dest.x - this.cx) < 24 && Math.abs(dest.y - this.cy) < 120) {
      crate.carrier = null;
      this.carrying = null;
      crate.arrive(game);
      return [null, null];
    }
    return [dest.x, dest.y];
  }

  light() {
    if (!this.a.light) return null;
    return { x: this.cx + this.facing * 6, y: this.y + 2, r: 70, i: 0.6 };
  }

  draw(g, game) {
    const st = { t: this.t, phase: this.phase, moving: Math.abs(this.vx) > 3, working: this.working, cargo: this.cargoCount() / this.a.cargo };
    g.save();
    const off = this.onGround && !this.a.flies ? game.world.slopeOffset(this.cx, this.y + this.h) : 0;
    const bob = this.a.loco === 'patte' && st.moving ? Math.abs(Math.sin(this.phase)) * -1 : 0;
    if (this.facing < 0) {
      g.translate(this.x + this.w, this.y + off + bob);
      g.scale(-1, 1);
    } else g.translate(this.x, this.y + off + bob);
    drawCells(g, this.cells, 0, 0, CELL, st);
    g.restore();
    // vapeur de la chaudière
    if (this.cells.some((c) => c.m === 'chaudiere') && Math.random() < 0.05) game.particles.steam(this.cx, this.y - 2, 1, 0.5);
    if (this.carrying) {
      const c = this.carrying;
      c.x = this.cx - c.w / 2;
      c.y = this.y - c.h - 2;
    }
  }

  toJSON() {
    return { id: this.id, name: this.name, designId: this.designId, cells: this.cells, x: this.cx, y: this.y + this.h, order: this.order, cargo: this.cargo };
  }
}
