// Cœur du jeu : relie le monde, les entités, les systèmes, le rendu et l'interface.
import { TILE, T, tileDef } from './world/tiles.js';
import { generateWorld } from './world/generator.js';
import { regionAt } from './world/regions.js';
import { Player } from './entities/player.js';
import { Camera } from './render/camera.js';
import { Particles, Weather } from './render/particles.js';
import { Renderer } from './render/renderer.js';
import { skyState } from './render/background.js';

export const DAY_LENGTH = 600; // secondes réelles pour 24 h

export class Game {
  constructor(canvas, input, ui, audio) {
    this.canvas = canvas;
    this.input = input;
    this.ui = ui;
    this.audio = audio;
    this.renderer = new Renderer(canvas);
    this.camera = new Camera();
    this.particles = new Particles();
    this.weather = new Weather();
    this.env = { time: 0, hour: 9, day: 1, wind: 0.5 };
    this.entities = [];
    this.colossi = [];
    this.toasts = [];
    this.building = { active: false };
    this.paused = false;
    this.debug = false;
    this.fps = 60;
  }

  newWorld(seed = 1729) {
    const gen = generateWorld(seed);
    this.world = gen.world;
    this.pois = gen.pois;
    this.ground = gen.ground;
    const start = this.pois.find((p) => p.type === 'start');
    this.player = new Player(0, 0);
    this.player.teleport(start.x * TILE + 8, start.y * TILE);
    this.camera.follow(this.player.cx, this.player.cy, 1, this.bounds(), 0, true);
  }

  bounds() {
    return { w: this.world.w * TILE, h: this.world.h * TILE };
  }

  grids() {
    if (!this._grids) this._grids = [this.world];
    this._grids.length = 1;
    for (const c of this.colossi) if (c.grid) this._grids.push(c.grid);
    return this._grids;
  }

  mouseWorld() {
    const m = this.input.mouse;
    const s = this.renderer.scale;
    return this.camera.toWorld(m.sx / s, m.sy / s);
  }

  toast(text, kind = 'info') {
    if (this.toasts.some((t) => t.text === text && t.life > 1)) return;
    this.toasts.push({ text, kind, life: 4 });
    if (this.toasts.length > 4) this.toasts.shift();
  }

  faint(reason) {
    this.toast(reason);
    const p = this.player;
    const spot = this.respawnPoint || this.pois.find((q) => q.type === 'start');
    p.teleport(spot.x * TILE + 8, spot.y * TILE);
    p.stun = 1;
    this.camera.follow(p.cx, p.cy, 1, this.bounds(), 0, true);
  }

  dismantle(tx, ty, by) {
    const id = this.world.get(tx, ty);
    const d = tileDef(id);
    this.world.set(tx, ty, T.AIR);
    this.particles.burst(tx * TILE + 8, ty * TILE + 8, d.mat, tx, ty, 8);
    return d.yields;
  }

  update(dt) {
    this.env.time += dt;
    this.env.hour = (this.env.hour + (dt / DAY_LENGTH) * 24) % 24;
    this.env.wind = 0.6 + Math.sin(this.env.time * 0.07) * 0.5;

    if (this.input.hit('zoomOut') || this.input.mouse.wheel > 0) this.camera.setZoomIndex(this.camera.zoomIndex + 1);
    if (this.input.hit('zoomIn') || this.input.mouse.wheel < 0) this.camera.setZoomIndex(this.camera.zoomIndex - 1);
    if (this.input.hit('debug')) this.debug = !this.debug;

    this.player.update(dt, this);
    for (const e of this.entities) e.update && e.update(dt, this);
    this.particles.update(dt);

    const prevX = this.camera.x;
    const prevY = this.camera.y;
    this.camera.follow(this.player.cx, this.player.cy, dt, this.bounds(), this.player.facing);
    const region = this.region();
    this.weather.update(dt, region.weather, this.env.wind, this.camera.vw, this.camera.vh, (this.camera.x - prevX) * this.camera.zoom, (this.camera.y - prevY) * this.camera.zoom);

    for (const t of this.toasts) t.life -= dt;
    this.toasts = this.toasts.filter((t) => t.life > 0);
  }

  region() {
    return regionAt(Math.floor(this.player.cx / TILE), Math.floor(this.player.cy / TILE));
  }

  render() {
    this.renderer.render(this);
  }

  // --- Rendu : appelé par le moteur de rendu ---------------------------------------
  drawWorld(g, view) {
    for (const e of this.entities) if (e.draw && this.inView(e, view)) e.draw(g, this);
    this.player.draw(g, this);
  }

  drawWorldFront(g, view) {
    this.particles.draw(g);
  }

  inView(e, view) {
    const m = 64;
    return e.x + (e.w || 0) > view.x - m && e.x < view.x + view.w + m && e.y + (e.h || 0) > view.y - m && e.y < view.y + view.h + m;
  }

  drawOverlay(g, view) {
    const p = this.player;
    if (p.hover && !this.ui.blocking()) {
      const { tx, ty, def } = p.hover;
      g.strokeStyle = def.tool === 'main' ? 'rgba(255,240,200,0.8)' : 'rgba(255,140,120,0.6)';
      g.lineWidth = 1 / this.camera.zoom;
      g.strokeRect(tx * TILE + 0.5, ty * TILE + 0.5, TILE - 1, TILE - 1);
      if (p.useProgress > 0) {
        g.fillStyle = 'rgba(255,240,200,0.85)';
        g.fillRect(tx * TILE, ty * TILE + TILE + 2, TILE * Math.min(1, p.useProgress / def.time), 2);
      }
    }
  }

  drawScreen(g, vw, vh) {
    if (this.debug) {
      g.fillStyle = 'rgba(0,0,0,0.5)';
      g.fillRect(4, 4, 220, 54);
      g.fillStyle = '#fff';
      g.font = '8px monospace';
      const p = this.player;
      g.fillText(`fps ${this.fps.toFixed(0)}  tuile ${Math.floor(p.cx / TILE)},${Math.floor(p.cy / TILE)}`, 8, 14);
      g.fillText(`état ${p.state}  zoom ${this.camera.zoom.toFixed(2)}  ${this.region().name}`, 8, 24);
      g.fillText(`heure ${this.env.hour.toFixed(1)}  entités ${this.entities.length}`, 8, 34);
    }
  }

  lights(view) {
    const out = [];
    const p = this.player;
    const sky = skyState(this.env);
    // une faible présence lumineuse autour du joueur garde la scène lisible
    out.push({ x: p.cx, y: p.cy - 4, r: 46, i: 0.25 });
    if (p.lantern) out.push({ x: p.cx + p.facing * 4, y: p.cy - 4, r: 120, i: 0.9 });
    return out;
  }
}
