// Objets à ramasser : caisses de ressources, échantillons, plans.
import { TILE } from '../world/tiles.js';
import { moveBody } from '../world/physics.js';
import { drawResIcon } from '../data/items.js';

export class Pickup {
  constructor(kind, x, y, data = {}) {
    this.kind = 'pickup';
    this.type = kind; // 'cache' | 'sample' | 'plan' | 'res'
    this.data = data;
    this.w = kind === 'cache' ? 14 : 8;
    this.h = kind === 'cache' ? 10 : 8;
    this.x = x - this.w / 2;
    this.y = y - this.h;
    this.vx = 0;
    this.vy = 0;
    this.t = Math.random() * 6;
    this.interactable = true;
    this.id = data.uid || null;
  }

  update(dt, game) {
    this.t += dt;
    if (!this.settled) {
      this.vy = Math.min(400, this.vy + 600 * dt);
      moveBody(this, dt, game.grids(), {});
      if (this.onGround) this.settled = true;
    }
  }

  prompt(game) {
    return game.pickupPrompt(this);
  }

  interact(game) {
    game.collect(this);
  }

  light() {
    if (this.type === 'sample') return { x: this.x + 4, y: this.y + 4, r: 28, i: 0.3 + Math.sin(this.t * 2) * 0.08 };
    if (this.type === 'plan') return { x: this.x + 4, y: this.y + 4, r: 22, i: 0.2 };
    return null;
  }

  draw(g) {
    const x = Math.round(this.x);
    const y = Math.round(this.y);
    if (this.type === 'cache') {
      g.fillStyle = '#5e4a36';
      g.fillRect(x, y, 14, 10);
      g.fillStyle = '#7a6046';
      g.fillRect(x, y, 14, 2);
      g.fillStyle = '#3e3024';
      g.fillRect(x + 1, y + 4, 12, 1);
      g.fillStyle = '#a08050';
      g.fillRect(x + 6, y + 3, 2, 3);
    } else if (this.type === 'sample') {
      const p = 0.5 + Math.sin(this.t * 2) * 0.2;
      g.fillStyle = `rgba(190,230,200,${0.35 + p * 0.2})`;
      g.fillRect(x + 1, y + 1, 6, 7);
      g.fillStyle = '#6a5a4a';
      g.fillRect(x, y, 8, 2);
      g.fillStyle = `rgba(150,220,140,${0.6 + p * 0.3})`;
      g.fillRect(x + 3, y + 4, 2, 2);
    } else if (this.type === 'plan') {
      g.fillStyle = '#4a6a8a';
      g.fillRect(x, y + 3, 9, 5);
      g.fillStyle = '#8ab0d0';
      g.fillRect(x, y + 3, 9, 1);
      g.fillStyle = '#c8d8e8';
      g.fillRect(x + 2, y + 5, 5, 1);
    } else if (this.type === 'res') {
      drawResIcon(g, this.data.res, x + 4, y + 4, 8);
    }
  }

  toJSON() {
    return { type: this.type, x: this.x + this.w / 2, y: this.y + this.h, data: this.data };
  }
}
