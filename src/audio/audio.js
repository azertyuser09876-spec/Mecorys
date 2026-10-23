// Son entièrement procédural : ambiance, musique générative et bruitages (Web Audio).
import { TILE } from '../world/tiles.js';
import { skyState } from '../render/background.js';

const mtof = (m) => 440 * Math.pow(2, (m - 69) / 12);

export class Audio {
  constructor() {
    this.ctx = null;
    this.ready = false;
    this.vol = { master: 0.8, music: 0.55, ambience: 0.7, sfx: 0.8 };
    try {
      const v = JSON.parse(localStorage.getItem('mecorys.volume') || 'null');
      if (v) Object.assign(this.vol, v);
    } catch {}
    this.region = null;
    this.musicT = 2;
    this.bellT = 6;
    this.chordIndex = 0;
    this.listener = { x: 0, y: 0 };
    this.lastStep = 0;
  }

  // Le navigateur exige un geste de l'utilisateur pour démarrer le son.
  start() {
    if (this.ready) return;
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    try {
      this.ctx = new AC();
    } catch {
      return;
    }
    const c = this.ctx;
    this.master = c.createGain();
    this.master.connect(c.destination);
    this.musicBus = c.createGain();
    this.ambBus = c.createGain();
    this.sfxBus = c.createGain();
    this.reverb = c.createConvolver();
    this.reverb.buffer = this.impulse(3.2, 2.4);
    this.revSend = c.createGain();
    this.revSend.gain.value = 0.25;
    this.revSend.connect(this.reverb);
    this.reverb.connect(this.master);
    for (const b of [this.musicBus, this.ambBus, this.sfxBus]) b.connect(this.master);
    this.musicBus.connect(this.revSend);
    this.sfxBus.connect(this.revSend);
    this.noise = this.noiseBuffer(2);
    this.applyVolume();
    this.startWind();
    this.ready = true;
  }

  applyVolume() {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    this.master.gain.setTargetAtTime(this.vol.master, t, 0.1);
    this.musicBus.gain.setTargetAtTime(this.vol.music * 0.5, t, 0.1);
    this.ambBus.gain.setTargetAtTime(this.vol.ambience, t, 0.1);
    this.sfxBus.gain.setTargetAtTime(this.vol.sfx, t, 0.1);
    try {
      localStorage.setItem('mecorys.volume', JSON.stringify(this.vol));
    } catch {}
  }

  noiseBuffer(sec) {
    const c = this.ctx;
    const b = c.createBuffer(1, c.sampleRate * sec, c.sampleRate);
    const d = b.getChannelData(0);
    let last = 0;
    for (let i = 0; i < d.length; i++) {
      const w = Math.random() * 2 - 1;
      last = last * 0.97 + w * 0.03; // bruit rosé approximatif
      d[i] = w * 0.5 + last * 3;
    }
    return b;
  }

  impulse(sec, decay) {
    const c = this.ctx;
    const len = c.sampleRate * sec;
    const b = c.createBuffer(2, len, c.sampleRate);
    for (let ch = 0; ch < 2; ch++) {
      const d = b.getChannelData(ch);
      for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, decay);
    }
    return b;
  }

  // --- Ambiance ----------------------------------------------------------------------
  startWind() {
    const c = this.ctx;
    const src = c.createBufferSource();
    src.buffer = this.noise;
    src.loop = true;
    const bp = c.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.value = 500;
    bp.Q.value = 0.6;
    const g = c.createGain();
    g.gain.value = 0.0;
    src.connect(bp).connect(g).connect(this.ambBus);
    src.start();
    this.wind = { bp, g };
    // grondement grave pour les lieux fermés
    const src2 = c.createBufferSource();
    src2.buffer = this.noise;
    src2.loop = true;
    const lp = c.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 120;
    const g2 = c.createGain();
    g2.gain.value = 0;
    src2.connect(lp).connect(g2).connect(this.ambBus);
    src2.start(0, 0.7);
    this.room = { g: g2 };
    // eau
    const src3 = c.createBufferSource();
    src3.buffer = this.noise;
    src3.loop = true;
    const lp3 = c.createBiquadFilter();
    lp3.type = 'lowpass';
    lp3.frequency.value = 700;
    const g3 = c.createGain();
    g3.gain.value = 0;
    src3.connect(lp3).connect(g3).connect(this.ambBus);
    src3.start(0, 1.3);
    this.water = { g: g3, lp: lp3 };
  }

  setRegion(region) {
    this.region = region;
    if (!this.ready) return;
    const wet = region.id === 'conduites' ? 0.7 : region.id === 'serre' || region.id === 'coeur' ? 0.45 : region.id === 'fonderie' ? 0.35 : 0.2;
    this.revSend.gain.setTargetAtTime(wet, this.ctx.currentTime, 1.5);
    this.chordIndex = 0;
    this.musicT = 1.5;
  }

  update(dt, game) {
    if (!this.ready) return;
    const c = this.ctx;
    const t = c.currentTime;
    const p = game.player;
    this.listener.x = game.camera.x + game.camera.w / 2;
    this.listener.y = game.camera.y + game.camera.h / 2;
    const tx = Math.floor(p.cx / TILE);
    const ty = Math.floor(p.cy / TILE);
    const sky = game.world.lightAt(tx, ty) / 15;
    const r = this.region || game.region();
    const windK = r.id === 'conduites' ? 0.05 : r.id === 'desert' || r.id === 'vallee' || r.id === 'abime' ? 1 : 0.6;
    const w = game.env.wind;
    this.wind.g.gain.setTargetAtTime(0.12 * windK * (0.3 + w) * (0.25 + 0.75 * sky), t, 0.5);
    this.wind.bp.frequency.setTargetAtTime(300 + w * 500 + Math.sin(game.env.time * 0.3) * 120, t, 0.8);
    this.room.g.gain.setTargetAtTime((1 - sky) * 0.18, t, 0.8);
    // eau proche
    let near = 0;
    for (let dx = -8; dx <= 8; dx += 4) for (let dy = -6; dy <= 6; dy += 3) if (game.world.liquid(tx + dx, ty + dy)) near++;
    this.water.g.gain.setTargetAtTime(Math.min(0.12, near * 0.012), t, 0.6);
    // gouttes dans les conduites
    if (r.id === 'conduites' && Math.random() < dt * 1.2) this.drip();
    // musique générative
    this.musicT -= dt;
    if (this.musicT <= 0) {
      this.musicT = 9 + Math.random() * 6;
      this.chord(r, game);
    }
    this.bellT -= dt;
    if (this.bellT <= 0) {
      this.bellT = 3 + Math.random() * 7;
      if (Math.random() < 0.6) this.bell(r, game);
    }
  }

  chord(r, game) {
    const c = this.ctx;
    const m = r.music || { root: 48, scale: [0, 2, 4, 7, 9], mood: 0.3 };
    const sc = m.scale;
    const degrees = [0, 2, 4, 1, 3];
    const d = degrees[this.chordIndex % degrees.length];
    this.chordIndex++;
    const notes = [sc[d % sc.length], sc[(d + 2) % sc.length] + (d + 2 >= sc.length ? 12 : 0), sc[(d + 4) % sc.length] + (d + 4 >= sc.length ? 12 : 0)];
    const night = 1 - skyState(game.env).day;
    const t = c.currentTime;
    const dur = 11;
    const lp = c.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 600 + (1 - m.mood) * 900 - night * 250;
    const g = c.createGain();
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(0.07, t + 3.5);
    g.gain.linearRampToValueAtTime(0.05, t + dur - 3);
    g.gain.linearRampToValueAtTime(0, t + dur);
    lp.connect(g).connect(this.musicBus);
    for (const n of notes) {
      for (const det of [-6, 5]) {
        const o = c.createOscillator();
        o.type = 'sawtooth';
        o.frequency.value = mtof(m.root + n);
        o.detune.value = det;
        o.connect(lp);
        o.start(t);
        o.stop(t + dur + 0.1);
      }
    }
    // basse
    const b = c.createOscillator();
    b.type = 'sine';
    b.frequency.value = mtof(m.root + sc[d % sc.length] - 12);
    const bg = c.createGain();
    bg.gain.setValueAtTime(0, t);
    bg.gain.linearRampToValueAtTime(0.06, t + 4);
    bg.gain.linearRampToValueAtTime(0, t + dur);
    b.connect(bg).connect(this.musicBus);
    b.start(t);
    b.stop(t + dur + 0.1);
  }

  bell(r, game) {
    const c = this.ctx;
    const m = r.music || { root: 48, scale: [0, 2, 4, 7, 9] };
    const n = m.scale[Math.floor(Math.random() * m.scale.length)] + 24 + (Math.random() < 0.3 ? 12 : 0);
    const t = c.currentTime;
    const f = mtof(m.root + n);
    const car = c.createOscillator();
    const mod = c.createOscillator();
    const mg = c.createGain();
    car.frequency.value = f;
    mod.frequency.value = f * 3.5;
    mg.gain.setValueAtTime(f * 1.2, t);
    mg.gain.exponentialRampToValueAtTime(1, t + 2.5);
    mod.connect(mg).connect(car.frequency);
    const g = c.createGain();
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(0.035, t + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 4);
    const pan = c.createStereoPanner();
    pan.pan.value = Math.random() * 1.2 - 0.6;
    car.connect(g).connect(pan).connect(this.musicBus);
    car.start(t);
    mod.start(t);
    car.stop(t + 4.2);
    mod.stop(t + 4.2);
  }

  drip() {
    const c = this.ctx;
    const t = c.currentTime;
    const o = c.createOscillator();
    o.type = 'sine';
    const f = 900 + Math.random() * 900;
    o.frequency.setValueAtTime(f, t);
    o.frequency.exponentialRampToValueAtTime(f * 0.5, t + 0.08);
    const g = c.createGain();
    g.gain.setValueAtTime(0.04, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.12);
    const pan = c.createStereoPanner();
    pan.pan.value = Math.random() * 1.6 - 0.8;
    o.connect(g).connect(pan).connect(this.ambBus);
    o.start(t);
    o.stop(t + 0.15);
  }

  // --- Bruitages ---------------------------------------------------------------------------
  env(node, t, a, peak, d, end = 0.0001) {
    node.gain.setValueAtTime(0.0001, t);
    node.gain.exponentialRampToValueAtTime(peak, t + a);
    node.gain.exponentialRampToValueAtTime(end, t + a + d);
  }

  noiseHit(t, { f = 1000, q = 1, type = 'bandpass', peak = 0.2, a = 0.002, d = 0.1, out, offset } = {}) {
    const c = this.ctx;
    const s = c.createBufferSource();
    s.buffer = this.noise;
    const fl = c.createBiquadFilter();
    fl.type = type;
    fl.frequency.value = f;
    fl.Q.value = q;
    const g = c.createGain();
    this.env(g, t, a, peak, d);
    s.connect(fl).connect(g).connect(out || this.sfxBus);
    s.start(t, offset ?? Math.random() * 1.5);
    s.stop(t + a + d + 0.05);
    return fl;
  }

  tone(t, { f = 440, type = 'sine', peak = 0.1, a = 0.005, d = 0.2, slide, out, detune = 0 } = {}) {
    const c = this.ctx;
    const o = c.createOscillator();
    o.type = type;
    o.frequency.setValueAtTime(f, t);
    if (slide) o.frequency.exponentialRampToValueAtTime(slide, t + a + d);
    o.detune.value = detune;
    const g = c.createGain();
    this.env(g, t, a, peak, d);
    o.connect(g).connect(out || this.sfxBus);
    o.start(t);
    o.stop(t + a + d + 0.05);
  }

  sfx(name, o = {}) {
    if (!this.ready) return;
    const c = this.ctx;
    const t = c.currentTime + 0.005;
    // atténuation selon la distance
    let out = this.sfxBus;
    if (o.x !== undefined) {
      const dx = o.x - this.listener.x;
      const dist = Math.abs(dx);
      if (dist > 1400) return;
      const pan = c.createStereoPanner();
      pan.pan.value = Math.max(-0.8, Math.min(0.8, dx / 600));
      const g = c.createGain();
      g.gain.value = Math.max(0.05, 1 - dist / 1400);
      pan.connect(g).connect(this.sfxBus);
      out = pan;
    }
    switch (name) {
      case 'step': {
        if (t - this.lastStep < 0.08) return;
        this.lastStep = t;
        const m = o.surface;
        if (m === 'sand' || m === 'soil' || m === 'moss') this.noiseHit(t, { f: 700, q: 0.5, type: 'lowpass', peak: 0.05 * (o.run ? 1.3 : 1), d: 0.09, out });
        else if (m === 'metal' || m === 'rust' || m === 'pipe' || m === 'girder' || m === 'tin') {
          this.noiseHit(t, { f: 2400, q: 6, peak: 0.05, d: 0.06, out });
          this.tone(t, { f: 180 + Math.random() * 40, type: 'triangle', peak: 0.03, d: 0.08, out });
        } else if (m === 'wood') this.noiseHit(t, { f: 500, q: 3, peak: 0.06, d: 0.07, out });
        else this.noiseHit(t, { f: 1500, q: 1.5, peak: 0.045, d: 0.05, out });
        break;
      }
      case 'jump':
        this.noiseHit(t, { f: 900, q: 0.8, type: 'lowpass', peak: 0.04, d: 0.08 });
        break;
      case 'land':
        this.noiseHit(t, { f: 400, q: 0.7, type: 'lowpass', peak: 0.09, d: 0.12 });
        break;
      case 'thud':
        this.tone(t, { f: 90, slide: 40, peak: 0.25, d: 0.3 });
        this.noiseHit(t, { f: 300, type: 'lowpass', peak: 0.15, d: 0.25 });
        break;
      case 'hit': {
        const m = o.mat;
        if (m === 'rust' || m === 'metal') {
          this.tone(t, { f: 600 + Math.random() * 300, type: 'square', peak: 0.03, d: 0.12 });
          this.noiseHit(t, { f: 3000, q: 4, peak: 0.06, d: 0.08 });
        } else if (m === 'plant' || m === 'wood' || m === 'organic' || m === 'root') this.noiseHit(t, { f: 900, q: 2, peak: 0.07, d: 0.08 });
        else this.noiseHit(t, { f: 1800, q: 2, peak: 0.07, d: 0.07 });
        break;
      }
      case 'break':
        this.noiseHit(t, { f: 1200, q: 0.6, peak: 0.12, d: 0.25 });
        this.tone(t, { f: 200, slide: 90, type: 'triangle', peak: 0.06, d: 0.2 });
        break;
      case 'pickup':
        this.tone(t, { f: 660, peak: 0.06, d: 0.15 });
        this.tone(t + 0.07, { f: 990, peak: 0.05, d: 0.25 });
        break;
      case 'place':
        this.noiseHit(t, { f: 700, q: 2, peak: 0.08, d: 0.08 });
        this.tone(t, { f: 160, type: 'triangle', peak: 0.05, d: 0.1 });
        break;
      case 'build':
        for (let k = 0; k < 3; k++) {
          this.noiseHit(t + k * 0.11, { f: 2000, q: 5, peak: 0.06, d: 0.06 });
          this.tone(t + k * 0.11, { f: 300 + k * 60, type: 'square', peak: 0.025, d: 0.08 });
        }
        break;
      case 'deny':
        this.tone(t, { f: 220, slide: 160, type: 'square', peak: 0.04, d: 0.15 });
        break;
      case 'click':
        this.tone(t, { f: 1200, type: 'square', peak: 0.025, d: 0.03 });
        break;
      case 'ui_open':
        this.tone(t, { f: 440, peak: 0.03, d: 0.12 });
        this.tone(t + 0.05, { f: 660, peak: 0.03, d: 0.15 });
        break;
      case 'ui_close':
        this.tone(t, { f: 520, slide: 380, peak: 0.025, d: 0.12 });
        break;
      case 'note':
        this.tone(t, { f: 784, peak: 0.04, d: 0.8 });
        this.tone(t + 0.12, { f: 1175, peak: 0.03, d: 1.2 });
        break;
      case 'robot':
        for (let k = 0; k < 3; k++) this.tone(t + k * 0.09, { f: 700 + k * 220, type: 'square', peak: 0.03, d: 0.06 });
        break;
      case 'talk':
        this.tone(t, { f: 330, peak: 0.03, d: 0.1 });
        break;
      case 'splash':
        this.noiseHit(t, { f: 1500, q: 0.5, peak: 0.15, d: 0.4 });
        break;
      case 'rest':
        this.tone(t, { f: 392, peak: 0.04, d: 1.5 });
        this.tone(t + 0.3, { f: 494, peak: 0.035, d: 1.5 });
        this.tone(t + 0.6, { f: 587, peak: 0.03, d: 2 });
        break;
      case 'valve':
        for (let k = 0; k < 6; k++) this.noiseHit(t + k * 0.15, { f: 600 + k * 40, q: 9, peak: 0.08, d: 0.14 });
        break;
      case 'rumble':
        this.tone(t, { f: 45, slide: 30, peak: 0.35, a: 0.4, d: 3 });
        this.noiseHit(t, { f: 150, type: 'lowpass', peak: 0.3, a: 0.5, d: 3 });
        break;
      case 'heartbeat':
        this.tone(t, { f: 60, slide: 40, peak: 0.35, d: 0.25 });
        this.tone(t + 0.28, { f: 55, slide: 38, peak: 0.25, d: 0.3 });
        break;
      case 'horn': {
        const g = c.createGain();
        g.gain.setValueAtTime(0, t);
        g.gain.linearRampToValueAtTime(0.16, t + 0.8);
        g.gain.linearRampToValueAtTime(0.12, t + 2.5);
        g.gain.linearRampToValueAtTime(0, t + 4);
        const f1 = c.createBiquadFilter();
        f1.type = 'bandpass';
        f1.frequency.value = 500;
        f1.Q.value = 2;
        f1.connect(g).connect(this.sfxBus);
        for (const [fr, det] of [
          [55, -8],
          [55, 7],
          [82.5, 0],
          [110, 4],
        ]) {
          const os = c.createOscillator();
          os.type = 'sawtooth';
          os.frequency.setValueAtTime(fr * 0.94, t);
          os.frequency.linearRampToValueAtTime(fr, t + 0.6);
          os.detune.value = det;
          os.connect(f1);
          os.start(t);
          os.stop(t + 4.1);
        }
        break;
      }
      case 'stomp': {
        const k = o.dist !== undefined ? Math.max(0.1, 1 - o.dist / 900) : 1;
        this.tone(t, { f: 55, slide: 28, peak: 0.4 * k, d: 0.6 });
        this.noiseHit(t, { f: 200, type: 'lowpass', peak: 0.25 * k, d: 0.5 });
        break;
      }
      case 'hurt':
        this.noiseHit(t, { f: 500, q: 1, peak: 0.15, d: 0.15 });
        this.tone(t, { f: 160, slide: 90, type: 'square', peak: 0.04, d: 0.15 });
        break;
      case 'life':
        for (let k = 0; k < 5; k++) this.tone(t + k * 0.08, { f: 300 + Math.random() * 400, peak: 0.02, d: 0.2 });
        break;
      case 'birth':
        this.tone(t, { f: 523, peak: 0.05, d: 1.4 });
        this.tone(t + 0.15, { f: 659, peak: 0.045, d: 1.4 });
        this.tone(t + 0.3, { f: 784, peak: 0.04, d: 2 });
        break;
      case 'hiss':
        this.noiseHit(t, { f: 5000, q: 0.5, type: 'highpass', peak: 0.12, a: 0.05, d: 1.2 });
        break;
      case 'weld':
        this.noiseHit(t, { f: 4000, q: 1, peak: 0.04, d: 0.05 });
        break;
      case 'anvil':
        this.tone(t, { f: 880, type: 'triangle', peak: 0.08, d: 0.9 });
        this.tone(t, { f: 1320, type: 'triangle', peak: 0.04, d: 0.6 });
        break;
      case 'dig':
        this.noiseHit(t, { f: 300, type: 'lowpass', peak: 0.3, d: 0.8 });
        this.tone(t, { f: 70, slide: 35, peak: 0.25, d: 0.6 });
        break;
      case 'cannon':
        this.noiseHit(t, { f: 2000, q: 0.4, peak: 0.3, a: 0.01, d: 1 });
        this.tone(t, { f: 80, slide: 30, peak: 0.35, d: 0.8 });
        break;
      case 'water':
        this.noiseHit(t, { f: 800, type: 'lowpass', peak: 0.2, a: 0.5, d: 4 });
        break;
    }
  }
}
