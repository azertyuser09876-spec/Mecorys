// Éléments de décor et inscriptions à lire.
import { TILE } from '../world/tiles.js';

export class Prop {
  constructor(kind, tx, floorY, data = {}) {
    this.kind = 'prop';
    this.type = kind;
    this.data = data;
    const w = (data.w || 2) * TILE;
    this.w = kind === 'lore' ? 14 : w;
    this.h = kind === 'tent' ? 40 : 16;
    this.x = tx * TILE + (kind === 'lore' ? 1 : 0);
    this.y = floorY * TILE - this.h;
    this.t = Math.random() * 5;
    this.interactable = kind === 'lore' || kind === 'well';
    this.read = false;
  }

  update(dt) {
    this.t += dt;
  }

  prompt(game) {
    if (this.type === 'lore') return { text: this.read ? 'Relire' : 'Lire', key: 'interact' };
    if (this.type === 'well') return { text: 'Regarder au fond du puits', key: 'interact' };
    return null;
  }

  interact(game) {
    game.readProp(this);
  }

  draw(g) {
    const x = this.x;
    const b = this.y + this.h;
    switch (this.type) {
      case 'tent': {
        const w = this.w;
        g.fillStyle = '#4e3c2c';
        g.fillRect(x + w / 2 - 1, b - 36, 2, 36);
        g.fillStyle = this.data.torn ? '#7a6450' : '#9a7a5a';
        g.beginPath();
        g.moveTo(x, b);
        g.lineTo(x + w / 2, b - 34);
        g.lineTo(x + w, b);
        g.closePath();
        g.fill();
        g.fillStyle = 'rgba(0,0,0,0.25)';
        g.beginPath();
        g.moveTo(x + w / 2, b - 34);
        g.lineTo(x + w, b);
        g.lineTo(x + w / 2 + 6, b);
        g.closePath();
        g.fill();
        if (this.data.torn) {
          g.fillStyle = 'rgba(0,0,0,0.5)';
          g.fillRect(x + w * 0.3, b - 14, 6, 9);
        }
        // tissu qui claque au vent
        const f = Math.sin(this.t * 4) * 2;
        g.fillStyle = '#8a3e30';
        g.fillRect(x + w / 2, b - 40, 8 + f, 3);
        break;
      }
      case 'campfire': {
        g.fillStyle = '#3a3028';
        for (let k = 0; k < 5; k++) g.fillRect(x + 4 + k * 5, b - 3, 4, 3);
        g.strokeStyle = '#2a2420';
        g.lineWidth = 2;
        g.beginPath();
        g.moveTo(x + 8, b - 2);
        g.lineTo(x + 20, b - 8);
        g.moveTo(x + 22, b - 2);
        g.lineTo(x + 10, b - 8);
        g.stroke();
        break;
      }
      case 'well':
        break;
      case 'lore': {
        // plaque ou gravure murale
        const pulse = this.read ? 0 : 0.25 + Math.sin(this.t * 2) * 0.15;
        g.fillStyle = '#6a6258';
        g.fillRect(x, b - 14, 12, 10);
        g.fillStyle = '#4a443e';
        for (let k = 0; k < 3; k++) g.fillRect(x + 2, b - 12 + k * 3, 8 - (k % 2) * 3, 1);
        g.fillStyle = '#3a342e';
        g.fillRect(x + 5, b - 4, 2, 4);
        if (pulse > 0) {
          g.fillStyle = `rgba(200,190,255,${pulse.toFixed(3)})`;
          g.fillRect(x - 1, b - 15, 14, 1);
        }
        break;
      }
    }
  }
}
