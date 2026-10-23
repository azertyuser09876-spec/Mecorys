// Structure posée dans le monde (construite ou trouvée).
import { STRUCT } from '../data/structures.js';
import { DRAW } from '../render/structdraw.js';
import { TILE, tileDef } from '../world/tiles.js';
import { costText } from '../data/items.js';

let NEXT_ID = 1;

export class Structure {
  constructor(type, tx, floorY, opts = {}) {
    this.kind = 'structure';
    this.type = type;
    this.def = STRUCT[type];
    this.id = opts.id || 's' + NEXT_ID++;
    this.tx = tx;
    this.floorY = floorY; // ligne de tuile du sol
    this.w = this.def.w * TILE;
    this.h = this.def.h * TILE;
    this.x = tx * TILE;
    this.y = floorY * TILE - this.h;
    this.ruined = !!opts.ruined;
    this.found = !!opts.found;
    this.built = !opts.found;
    this.active = false;
    this.efficiency = 1;
    this.data = opts.data || {};
    this.t = Math.random() * 10;
    this.interactable = true;
    this.covered = false;
  }

  get cx() {
    return this.x + this.w / 2;
  }
  get cy() {
    return this.y + this.h / 2;
  }

  checkCover(world) {
    // Un toit au-dessus ? Alors pas de bâche pour le refuge.
    const tx0 = Math.floor(this.x / TILE);
    const ty = Math.floor(this.y / TILE);
    let n = 0;
    for (let x = tx0; x < tx0 + this.def.w; x++)
      for (let y = ty - 1; y > ty - 8; y--)
        if (tileDef(world.get(x, y)).solid) {
          n++;
          break;
        }
    this.covered = n >= this.def.w - 1;
  }

  update(dt) {
    this.t += dt;
  }

  draw(g, game) {
    const fn = DRAW[this.type];
    if (fn) fn(g, this, this.t, game);
    else {
      g.fillStyle = '#888';
      g.fillRect(this.x, this.y, this.w, this.h);
    }
  }

  restoreCost() {
    return this.def.restore || this.def.cost;
  }

  // Invite affichée quand le joueur est proche
  prompt(game) {
    return game.structurePrompt(this);
  }

  interact(game) {
    return game.structureInteract(this);
  }

  light() {
    const L = this.def.light;
    if (!L || this.ruined) return null;
    if ((this.type === 'chambre' || this.type === 'forge') && !this.active) return null;
    if (this.type === 'matrice' && !(this.data.life > 0)) return null;
    return { x: this.x + L.dx * TILE, y: this.y + L.dy * TILE, r: L.r, i: L.i, col: L.col === 'organic' ? '255,150,160' : undefined };
  }

  toJSON() {
    return { type: this.type, id: this.id, tx: this.tx, floorY: this.floorY, ruined: this.ruined, found: this.found, data: this.data };
  }

  costLabel(game, cost) {
    const ok = game.inv.has(cost);
    return `<span class="cost ${ok ? '' : 'bad'}">${costText(cost)}</span>`;
  }
}
