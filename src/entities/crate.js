// Caisse contenant un module de colosse ou un organe : il faut la transporter jusqu'à sa place.
import { TILE } from '../world/tiles.js';
import { moveBody } from '../world/physics.js';

let N = 1;

export class Crate {
  constructor(x, y, payload, opts = {}) {
    this.kind = 'crate';
    this.id = opts.id || 'c' + Date.now().toString(36) + N++;
    this.payload = payload; // { module, colossus, slot, label, organic }
    this.label = payload.label || 'module';
    this.w = payload.organic ? 18 : 22;
    this.h = payload.organic ? 16 : 16;
    this.x = x - this.w / 2;
    this.y = y - this.h;
    this.vx = 0;
    this.vy = 0;
    this.carrier = null;
    this.delivered = false;
    this.dragged = false;
    this.interactable = true;
    this.t = 0;
  }
  get cx() {
    return this.x + this.w / 2;
  }
  get cy() {
    return this.y + this.h / 2;
  }

  dest(game) {
    return game.colossusSys ? game.colossusSys.destFor(this) : null;
  }

  arrive(game) {
    if (game.colossusSys) game.colossusSys.crateArrived(this);
  }

  prompt(game) {
    if (this.carrier) return null;
    const d = this.dest(game);
    const near = d && Math.abs(d.x - this.cx) < 60 && Math.abs(d.y - this.cy) < 160;
    if (near) return { text: `Déposer : ${this.label}`, info: 'à sa place dans le colosse' };
    return { text: this.dragged ? 'Lâcher la caisse' : `Traîner : ${this.label}`, info: 'lent ; un robot à bras de levage va plus vite' };
  }

  interact(game) {
    const d = this.dest(game);
    if (d && Math.abs(d.x - this.cx) < 60 && Math.abs(d.y - this.cy) < 160) {
      this.dragged = false;
      game.player.dragging = null;
      this.arrive(game);
      return;
    }
    this.dragged = !this.dragged;
    game.player.dragging = this.dragged ? this : null;
  }

  update(dt, game) {
    this.t += dt;
    if (this.carrier || this.delivered) return;
    if (this.dragged) {
      const p = game.player;
      const tx = p.cx - p.facing * 18 - this.w / 2;
      this.vx = (tx - this.x) * 4;
      if (Math.abs(p.cx - this.cx) > 120) {
        this.dragged = false;
        p.dragging = null;
      }
    } else this.vx *= 0.8;
    this.vy = Math.min(500, this.vy + 900 * dt);
    moveBody(this, dt, game.grids(), { stepUp: TILE });
  }

  draw(g) {
    const x = Math.round(this.x);
    const y = Math.round(this.y);
    if (this.payload.organic) {
      g.fillStyle = 'rgba(170,200,190,0.45)';
      g.fillRect(x + 1, y + 2, this.w - 2, this.h - 3);
      g.fillStyle = '#5a5f66';
      g.fillRect(x, y, this.w, 3);
      g.fillRect(x, y + this.h - 2, this.w, 2);
      const p = 1 + Math.sin(this.t * 2) * 0.08;
      g.fillStyle = 'rgba(190,100,110,0.85)';
      g.beginPath();
      g.ellipse(x + this.w / 2, y + this.h / 2 + 1, 5 * p, 4 * p, 0, 0, Math.PI * 2);
      g.fill();
    } else {
      g.fillStyle = '#5e4a36';
      g.fillRect(x, y, this.w, this.h);
      g.fillStyle = '#7a6046';
      g.fillRect(x, y, this.w, 2);
      g.strokeStyle = '#3e3024';
      g.lineWidth = 1;
      g.beginPath();
      g.moveTo(x, y);
      g.lineTo(x + this.w, y + this.h);
      g.moveTo(x + this.w, y);
      g.lineTo(x, y + this.h);
      g.stroke();
      g.fillStyle = '#c0a060';
      g.fillRect(x + this.w / 2 - 3, y + 5, 6, 5);
    }
  }

  toJSON() {
    return { id: this.id, payload: this.payload, x: this.cx, y: this.y + this.h, delivered: this.delivered };
  }
}
