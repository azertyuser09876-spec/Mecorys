// Caméra qui suit le joueur, avec zoom progressif et tremblements.
import { clamp } from '../core/rng.js';

export const ZOOMS = [1, 0.75, 0.5, 0.33, 0.22];

export class Camera {
  constructor() {
    this.x = 0;
    this.y = 0;
    this.vw = 960; // taille de la surface interne
    this.vh = 540;
    this.zoom = 1;
    this.zoomIndex = 0;
    this.targetZoom = 1;
    this.shakeAmt = 0;
    this.ox = 0;
    this.oy = 0;
    this.lookAhead = 0;
    this.focus = null; // point imposé (cinématiques)
  }
  get w() {
    return this.vw / this.zoom;
  }
  get h() {
    return this.vh / this.zoom;
  }

  setZoomIndex(i) {
    this.zoomIndex = clamp(i, 0, ZOOMS.length - 1);
    this.targetZoom = ZOOMS[this.zoomIndex];
  }

  shake(a) {
    this.shakeAmt = Math.max(this.shakeAmt, a);
  }

  follow(tx, ty, dt, bounds, facing = 0, instant = false) {
    const z = this.zoom;
    this.zoom += (this.targetZoom - this.zoom) * Math.min(1, dt * 5);
    if (Math.abs(this.zoom - this.targetZoom) < 0.002) this.zoom = this.targetZoom;
    // garder le point suivi au même endroit pendant le zoom
    const cxOld = this.x + this.vw / z / 2;
    const cyOld = this.y + this.vh / z / 2;
    this.lookAhead += (facing * 40 - this.lookAhead) * Math.min(1, dt * 1.5);
    let fx = tx + this.lookAhead;
    let fy = ty - 20;
    if (this.focus) {
      fx = this.focus.x;
      fy = this.focus.y;
    }
    const k = instant ? 1 : Math.min(1, dt * (this.focus ? this.focus.speed || 2 : 4.5));
    let cx = cxOld + (fx - cxOld) * k;
    let cy = cyOld + (fy - cyOld) * k;
    this.x = cx - this.w / 2;
    this.y = cy - this.h / 2;
    if (bounds) {
      this.x = clamp(this.x, 0, Math.max(0, bounds.w - this.w));
      this.y = clamp(this.y, -this.h * 0.6, Math.max(0, bounds.h - this.h));
    }
    this.shakeAmt *= Math.pow(0.02, dt);
    if (this.shakeAmt < 0.05) this.shakeAmt = 0;
    this.ox = (Math.random() * 2 - 1) * this.shakeAmt;
    this.oy = (Math.random() * 2 - 1) * this.shakeAmt;
  }

  toWorld(sx, sy) {
    return { x: this.x + sx / this.zoom, y: this.y + sy / this.zoom };
  }
  toScreen(wx, wy) {
    return { x: (wx - this.x) * this.zoom, y: (wy - this.y) * this.zoom };
  }
}
