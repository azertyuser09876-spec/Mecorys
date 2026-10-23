// Un survivant : un humain libre qui choisit où vivre et quoi faire.
import { TILE } from '../world/tiles.js';
import { moveBody, climbAt } from '../world/physics.js';
import { drawHuman, updateScarf } from '../render/character.js';
import { findPath } from '../systems/nav.js';

export class Survivor {
  constructor(id, def, x, y, opts = {}) {
    this.kind = 'survivor';
    this.id = id;
    this.def = def;
    this.name = opts.name || def.name;
    this.look = opts.look || def.look;
    this.w = 10;
    this.h = 26;
    this.x = x - 5;
    this.y = y - 26;
    this.vx = 0;
    this.vy = 0;
    this.facing = -1;
    this.phase = 0;
    this.t = Math.random() * 10;
    this.origin = opts.origin || { x, y };
    this.home = opts.home || null; // identifiant du lieu
    this.met = !!opts.met;
    this.mood = opts.mood ?? 0.75;
    this.activity = opts.activity || 'repos';
    this.goalX = null;
    this.goalY = null;
    this.travel = null;
    this.away = 0;
    this.bubble = null;
    this.scarf = [];
    this.interactable = true;
    this.decideT = 5 + Math.random() * 5;
    this.actT = 0;
    this.path = null;
  }

  get cx() {
    return this.x + this.w / 2;
  }
  get cy() {
    return this.y + this.h / 2;
  }

  prompt(game) {
    if (this.away > 0) return null;
    return { text: `Parler à ${this.name}`, info: this.home ? game.survivors.statusOf(this) : '' };
  }

  interact(game) {
    game.survivors.talk(this);
  }

  say(text, t = 4) {
    this.bubble = { text, t };
  }

  update(dt, game) {
    this.t += dt;
    if (this.bubble) {
      this.bubble.t -= dt;
      if (this.bubble.t <= 0) this.bubble = null;
    }
    if (this.away > 0) return;
    // marcher vers le but en suivant un chemin
    let vx = 0;
    let climbing = false;
    if (this.goalX !== null && !game.ui.dialogState) {
      const wp = this.waypoint(game);
      if (wp) {
        const d = wp.x - this.cx;
        if (Math.abs(d) > 2) vx = Math.sign(d) * (this.travel ? 70 : 42);
        const climbG = climbAt(game.grids(), this.cx, this.cy);
        if (climbG && Math.abs(wp.y - (this.y + this.h - 8)) > 6 && Math.abs(d) < 10) {
          climbing = true;
          this.vy = Math.sign(wp.y - (this.y + this.h - 8)) * 50;
          vx = d * 2;
        }
      }
    }
    if (game.ui.dialogState && game.survivors.talking === this) {
      vx = 0;
      this.facing = game.player.cx > this.cx ? 1 : -1;
    }
    this.vx += (vx - this.vx) * Math.min(1, dt * 8);
    if (vx) this.facing = Math.sign(vx);
    if (!climbing) this.vy = Math.min(600, this.vy + 980 * dt);
    const wasGround = this.onGround;
    moveBody(this, dt, game.grids(), { stepUp: TILE, drop: climbing && this.vy > 0 });
    if (this.hitWall && wasGround && vx) this.vy = -300;
    this.climbing = climbing;
    if (this.onGround && Math.abs(this.vx) > 4) this.phase += dt * (Math.abs(this.vx) / 7.5);
    updateScarf(this.scarf, this.cx, this.y + 5, game.env.wind - this.vx * 0.02, dt, this.facing);
  }

  waypoint(game) {
    const T = TILE;
    const rtx = Math.floor(this.cx / T);
    const rty = Math.floor((this.y + this.h - 2) / T);
    const gtx = Math.floor(this.goalX / T);
    const gty = Math.floor(this.goalY / T);
    if (Math.abs(rtx - gtx) <= 0 && Math.abs(rty - gty) <= 2) {
      this.goalX = null;
      return null;
    }
    this.pathAge = (this.pathAge || 0) + 1 / 60;
    if (!this.path || this.path.gtx !== gtx || this.pathAge > 4) {
      this.pathAge = 0;
      const nodes = findPath(game.world, rtx, rty, (x, y) => x === gtx && Math.abs(y - gty) <= 2, { height: 2, stepUp: 2, maxDrop: 6, climbs: true, jump: 3, radius: 90 });
      if (!nodes) {
        this.goalX = null;
        this.path = null;
        return null;
      }
      this.path = { nodes, gtx, i: 0 };
    }
    const P = this.path;
    while (P.i < P.nodes.length - 1 && P.nodes[P.i].tx === rtx && Math.abs(P.nodes[P.i].ty - rty) <= 1) P.i++;
    const nd = P.nodes[P.i];
    return { x: nd.tx * T + 8, y: nd.ty * T + 8 };
  }

  goTo(x, y) {
    this.goalX = x;
    this.goalY = y;
    this.path = null;
  }

  draw(g, game) {
    if (this.away > 0) return;
    const moving = Math.abs(this.vx) > 4;
    let state = this.climbing ? 'climb' : !this.onGround ? (this.vy < 0 ? 'jump' : 'fall') : moving ? 'walk' : 'idle';
    const working = !moving && this.onGround && ['atelier', 'construction', 'jardin', 'eau', 'vie'].includes(this.activity) && this.goalX === null && this.atSpot;
    if (!moving && this.activity === 'repos' && this.atSpot) state = 'sit';
    if (!moving && this.activity === 'jardin' && this.atSpot) state = 'crouch';
    const pose = { facing: this.facing, phase: this.phase, state, t: this.t, use: working && this.activity !== 'jardin', scarf: this.scarf };
    const off = this.onGround ? game.world.slopeOffset(this.cx, this.y + this.h) : 0;
    drawHuman(g, this.cx, this.y + this.h + off + (state === 'sit' ? 0 : 0), this.look, pose, { tool: working });
    if (this.bubble) {
      const z = game.camera.zoom;
      g.font = `${Math.max(6, 7 / z)}px Georgia, serif`;
      const text = this.bubble.text;
      const w = g.measureText(text).width + 8 / z;
      const bx = this.cx - w / 2;
      const by = this.y - 16 / z - 4;
      g.fillStyle = 'rgba(20,18,16,0.82)';
      g.fillRect(bx, by - 9 / z, w, 12 / z);
      g.fillStyle = '#efe6d6';
      g.fillText(text, bx + 4 / z, by);
    }
  }

  toJSON() {
    return { id: this.id, name: this.name, look: this.look, x: this.cx, y: this.y + this.h, origin: this.origin, home: this.home, met: this.met, mood: this.mood, activity: this.activity, away: this.away };
  }
}
