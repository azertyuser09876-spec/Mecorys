// Composition de l'image : ciel, reliefs, monde, entités, eau, lumière, météo.
import { TILE, T } from '../world/tiles.js';
import { CHUNK, LIGHT_MAX } from '../world/world.js';
import { paletteColor, regionAt } from '../world/regions.js';
import { paintChunk } from './tilepaint.js';
import { Backdrop, skyState, undergroundFactor } from './background.js';
import { makeCanvas, ctx2d } from './canvas.js';
import { css, scale, mix } from '../core/color.js';
import { clamp } from '../core/rng.js';

const CH_PX = CHUNK * TILE;
const MAX_CHUNKS = 72;

export class Renderer {
  constructor(canvas) {
    this.canvas = canvas;
    this.g = canvas.getContext('2d');
    this.backdrop = new Backdrop();
    this.chunks = new Map();
    this.chunkOrder = [];
    this.lightCanvas = makeCanvas(8, 8);
    this.lightCtx = ctx2d(this.lightCanvas);
    this.scale = 2;
    this.resize();
  }

  resize() {
    const W = window.innerWidth;
    const H = window.innerHeight;
    const s = Math.max(1, Math.round(H / 450));
    this.scale = s;
    const vw = Math.ceil(W / s);
    const vh = Math.ceil(H / s);
    this.canvas.width = vw;
    this.canvas.height = vh;
    this.canvas.style.width = vw * s + 'px';
    this.canvas.style.height = vh * s + 'px';
    this.vw = vw;
    this.vh = vh;
    this.layers = makeCanvas(vw, vh);
    this.layersCtx = ctx2d(this.layers);
    this.worldLayer = makeCanvas(vw, vh);
    this.worldCtx = ctx2d(this.worldLayer);
    this.g.imageSmoothingEnabled = false;
  }

  chunk(src, cx, cy, key) {
    let c = this.chunks.get(key);
    if (!c) {
      c = paintChunk(src, cx, cy);
      this.chunks.set(key, c);
      this.chunkOrder.push(key);
      if (this.chunkOrder.length > MAX_CHUNKS) {
        const old = this.chunkOrder.shift();
        this.chunks.delete(old);
      }
    }
    return c;
  }

  invalidate(key) {
    this.chunks.delete(key);
    const i = this.chunkOrder.indexOf(key);
    if (i >= 0) this.chunkOrder.splice(i, 1);
  }

  render(game) {
    const g = this.g;
    const cam = game.camera;
    cam.vw = this.vw;
    cam.vh = this.vh;
    const env = game.env;
    const sky = skyState(env);
    const under = undergroundFactor(cam.y + cam.h / 2);

    // 1. Ciel et reliefs
    g.setTransform(1, 0, 0, 1, 0, 0);
    const lg = this.layersCtx;
    lg.setTransform(1, 0, 0, 1, 0, 0);
    lg.globalCompositeOperation = 'source-over';
    lg.clearRect(0, 0, this.vw, this.vh);
    this.backdrop.draw(g, lg, cam, env);
    const night = 1 - sky.day;
    lg.globalCompositeOperation = 'source-atop';
    if (night > 0.01) {
      lg.fillStyle = `rgba(16,22,44,${(night * 0.72).toFixed(3)})`;
      lg.fillRect(0, 0, this.vw, this.vh);
    }
    if (sky.dusk > 0.01) {
      lg.fillStyle = `rgba(190,90,60,${(sky.dusk * 0.18).toFixed(3)})`;
      lg.fillRect(0, 0, this.vw, this.vh);
    }
    if (under > 0.01) {
      lg.fillStyle = `rgba(10,14,14,${(under * 0.95).toFixed(3)})`;
      lg.fillRect(0, 0, this.vw, this.vh);
    }
    lg.globalCompositeOperation = 'source-over';
    g.drawImage(this.layers, 0, 0);

    // 2. Monde
    const w = this.worldCtx;
    w.setTransform(1, 0, 0, 1, 0, 0);
    w.globalCompositeOperation = 'source-over';
    w.clearRect(0, 0, this.vw, this.vh);
    const z = cam.zoom;
    const camX = Math.round((cam.x + cam.ox) * z) / z;
    const camY = Math.round((cam.y + cam.oy) * z) / z;
    w.setTransform(z, 0, 0, z, -camX * z, -camY * z);
    w.imageSmoothingEnabled = z < 0.99;

    const world = game.world;
    // blocs modifiés
    for (const key of world.dirty) this.invalidate('w' + key);
    world.dirty.clear();
    const view0 = { x: camX, y: camY, w: cam.w, h: cam.h };
    game.drawWorldBack(w, view0);
    const cx0 = Math.floor(camX / CH_PX);
    const cy0 = Math.floor(camY / CH_PX);
    const cx1 = Math.floor((camX + cam.w) / CH_PX);
    const cy1 = Math.floor((camY + cam.h) / CH_PX);
    for (let cy = Math.max(0, cy0); cy <= cy1; cy++)
      for (let cx = Math.max(0, cx0); cx <= cx1; cx++) {
        if (cx * CHUNK >= world.w || cy * CHUNK >= world.h) continue;
        const c = this.chunk(world, cx, cy, 'w' + cx + ',' + cy);
        w.drawImage(c, cx * CH_PX, cy * CH_PX, CH_PX + 0.5, CH_PX + 0.5);
      }

    const view = { x: camX, y: camY, w: cam.w, h: cam.h };
    game.drawWorld(w, view, this);

    // Eau
    this.drawWater(w, world, view, env.time);
    game.drawWorldFront(w, view, this);

    // 3. Lumière et obscurité
    w.setTransform(1, 0, 0, 1, 0, 0);
    this.drawLight(w, game, view, sky);
    w.globalCompositeOperation = 'source-atop';
    if (sky.dusk > 0.01) {
      w.fillStyle = `rgba(200,110,70,${(sky.dusk * 0.12).toFixed(3)})`;
      w.fillRect(0, 0, this.vw, this.vh);
    }
    if (night > 0.01) {
      w.fillStyle = `rgba(30,40,90,${(night * 0.22).toFixed(3)})`;
      w.fillRect(0, 0, this.vw, this.vh);
    }
    // halos colorés des sources de lumière, par-dessus l'obscurité
    w.setTransform(z, 0, 0, z, -camX * z, -camY * z);
    w.globalCompositeOperation = 'lighter';
    const dark = 0.35 + 0.65 * Math.max(night, 1 - (world.lightAt(Math.floor((cam.x + cam.w / 2) / TILE), Math.floor((cam.y + cam.h / 2) / TILE)) / LIGHT_MAX));
    for (const L of this.lastLights || []) {
      const col = L.col || '255,180,110';
      const a = Math.min(0.35, L.i * 0.22) * dark;
      if (a < 0.01) continue;
      const r = L.r * 0.8;
      const gr = w.createRadialGradient(L.x, L.y, 0, L.x, L.y, r);
      gr.addColorStop(0, `rgba(${col},${a.toFixed(3)})`);
      gr.addColorStop(1, `rgba(${col},0)`);
      w.fillStyle = gr;
      w.fillRect(L.x - r, L.y - r, r * 2, r * 2);
    }
    w.setTransform(1, 0, 0, 1, 0, 0);
    w.globalCompositeOperation = 'source-over';
    g.drawImage(this.worldLayer, 0, 0);

    // 4. Météo et brume d'écran
    const region = regionAt(Math.floor((cam.x + cam.w / 2) / TILE), Math.floor((cam.y + cam.h / 2) / TILE));
    const hz = region.pal.haze;
    game.weather.draw(g, sky.day, `${Math.round(hz[0])},${Math.round(hz[1])},${Math.round(hz[2])}`);

    // 5. Surcouches du monde (aperçus, survols) non affectées par la nuit
    g.setTransform(z, 0, 0, z, -camX * z, -camY * z);
    game.drawOverlay(g, view);
    g.setTransform(1, 0, 0, 1, 0, 0);
    game.drawScreen(g, this.vw, this.vh);
  }

  drawWater(w, world, view, time) {
    const tx0 = Math.max(0, Math.floor(view.x / TILE));
    const ty0 = Math.max(0, Math.floor(view.y / TILE));
    const tx1 = Math.min(world.w - 1, Math.floor((view.x + view.w) / TILE));
    const ty1 = Math.min(world.h - 1, Math.floor((view.y + view.h) / TILE));
    let lastCol = '';
    for (let ty = ty0; ty <= ty1; ty++) {
      for (let tx = tx0; tx <= tx1; tx++) {
        if (world.tiles[ty * world.w + tx] !== T.WATER) continue;
        const c = paletteColor('water', tx, ty);
        const surface = world.get(tx, ty - 1) !== T.WATER && !world.solid(tx, ty - 1);
        const depthK = surface ? 0.48 : 0.62;
        const col = css(c, depthK);
        if (col !== lastCol) {
          w.fillStyle = col;
          lastCol = col;
        }
        if (surface) {
          const off = Math.sin(time * 1.6 + tx * 0.7) * 1.2 + Math.sin(time * 2.7 + tx * 1.9) * 0.6;
          w.fillRect(tx * TILE, ty * TILE + 3 + off, TILE, TILE - 3 - off);
          w.fillStyle = css(scale(c, 1.8), 0.55);
          w.fillRect(tx * TILE, ty * TILE + 3 + off, TILE, 1);
          lastCol = '';
        } else w.fillRect(tx * TILE, ty * TILE, TILE, TILE);
      }
    }
    // reflets lumineux
    w.fillStyle = 'rgba(220,240,240,0.08)';
    for (let ty = ty0; ty <= ty1; ty++)
      for (let tx = tx0; tx <= tx1; tx++) {
        if (world.tiles[ty * world.w + tx] !== T.WATER) continue;
        const k = Math.sin(time * 0.9 + tx * 1.3 + ty * 2.1);
        if (k > 0.85) w.fillRect(tx * TILE + 3, ty * TILE + 7, 6, 1);
      }
  }

  drawLight(w, game, view, sky) {
    const world = game.world;
    const tx0 = Math.floor(view.x / TILE) - 1;
    const ty0 = Math.floor(view.y / TILE) - 1;
    const tw = Math.ceil(view.w / TILE) + 3;
    const th = Math.ceil(view.h / TILE) + 3;
    if (this.lightCanvas.width !== tw || this.lightCanvas.height !== th) {
      this.lightCanvas.width = tw;
      this.lightCanvas.height = th;
      this.lightCtx = ctx2d(this.lightCanvas);
      this.lightImg = this.lightCtx.createImageData(tw, th);
    }
    if (!this.lightImg) this.lightImg = this.lightCtx.createImageData(tw, th);
    const data = this.lightImg.data;
    const dayK = 0.3 + 0.7 * sky.day;
    const lights = game.lights(view);
    this.lastLights = lights;
    const buf = this._lbuf && this._lbuf.length === tw * th ? this._lbuf : (this._lbuf = new Float32Array(tw * th));
    for (let j = 0; j < th; j++) {
      const ty = ty0 + j;
      for (let i = 0; i < tw; i++) {
        const tx = tx0 + i;
        buf[j * tw + i] = (world.lightAt(tx, ty) / LIGHT_MAX) ** 1.15 * dayK;
      }
    }
    for (const L of lights) {
      const r = L.r / TILE;
      const lx = L.x / TILE - tx0 - 0.5;
      const ly = L.y / TILE - ty0 - 0.5;
      const i0 = Math.max(0, Math.floor(lx - r));
      const i1 = Math.min(tw - 1, Math.ceil(lx + r));
      const j0 = Math.max(0, Math.floor(ly - r));
      const j1 = Math.min(th - 1, Math.ceil(ly + r));
      for (let j = j0; j <= j1; j++)
        for (let i = i0; i <= i1; i++) {
          const d = Math.hypot(i - lx, j - ly) / r;
          if (d < 1) buf[j * tw + i] += (1 - d * d) * L.i;
        }
    }
    for (let k = 0; k < tw * th; k++) {
      const dark = clamp(1 - buf[k], 0, 0.84);
      data[k * 4] = 4;
      data[k * 4 + 1] = 6;
      data[k * 4 + 2] = 10;
      data[k * 4 + 3] = dark * 255;
    }
    this.lightCtx.putImageData(this.lightImg, 0, 0);
    const z = game.camera.zoom;
    w.globalCompositeOperation = 'source-atop';
    w.imageSmoothingEnabled = true;
    w.drawImage(this.lightCanvas, (tx0 * TILE - view.x) * z, (ty0 * TILE - view.y) * z, tw * TILE * z, th * TILE * z);
    w.imageSmoothingEnabled = false;
    w.globalCompositeOperation = 'source-over';
  }
}
