// Dessin procédural des structures. Chaque fonction dessine dans le repère du monde.
import { css, hex, scale, mix } from '../core/color.js';
import { paletteColor } from '../world/regions.js';

const T = 16;
const RUST = '#8a4a2c';
const IRON = '#5c5f66';
const IRON_D = '#3c3e44';
const WOOD = '#6e5640';
const WOOD_D = '#4e3c2c';
const CLOTH = '#a8866a';
const GLOW = 'rgba(255,190,110,';

function rect(g, x, y, w, h, c) {
  g.fillStyle = c;
  g.fillRect(x, y, w, h);
}
function line(g, x0, y0, x1, y1, w, c) {
  g.strokeStyle = c;
  g.lineWidth = w;
  g.beginPath();
  g.moveTo(x0, y0);
  g.lineTo(x1, y1);
  g.stroke();
}
function glow(g, x, y, r, a) {
  const gr = g.createRadialGradient(x, y, 0, x, y, r);
  gr.addColorStop(0, GLOW + a + ')');
  gr.addColorStop(1, GLOW + '0)');
  g.fillStyle = gr;
  g.fillRect(x - r, y - r, r * 2, r * 2);
}

export const DRAW = {
  refuge(g, s, t) {
    const { x, y, w, h } = s;
    const b = y + h;
    const ruined = s.ruined;
    // toile tendue si à l'air libre
    if (!s.covered) {
      line(g, x + 2, b, x + 4, y - 14, 2, WOOD_D);
      line(g, x + w - 2, b, x + w - 4, y - 14, 2, WOOD_D);
      g.fillStyle = ruined ? '#6a5a4a' : CLOTH;
      g.beginPath();
      g.moveTo(x - 6, y - 4);
      g.lineTo(x + w / 2, y - 22);
      g.lineTo(x + w + 6, y - 4);
      g.lineTo(x + w + 2, y - 2);
      g.lineTo(x + w / 2, y - 16);
      g.lineTo(x - 2, y - 2);
      g.closePath();
      g.fill();
    }
    // couchage
    rect(g, x + 22, b - 6, 30, 6, ruined ? '#5a4c40' : '#7a5a44');
    rect(g, x + 22, b - 8, 10, 3, ruined ? '#6a5c50' : '#b8a488');
    if (!ruined) rect(g, x + 30, b - 7, 22, 2, '#8a3e30');
    // poêle
    rect(g, x + 4, b - 14, 14, 14, IRON_D);
    rect(g, x + 5, b - 13, 12, 3, IRON);
    rect(g, x + 9, b - 30, 4, 16, IRON_D);
    rect(g, x + 7, b - 8, 8, 5, ruined ? '#2a2420' : '#ffb060');
    if (!ruined) {
      const f = 0.6 + Math.sin(t * 9) * 0.2 + Math.sin(t * 23) * 0.1;
      glow(g, x + 11, b - 6, 18, (0.35 * f).toFixed(3));
    }
    // coffre
    rect(g, x + w - 16, b - 9, 14, 9, WOOD);
    rect(g, x + w - 16, b - 9, 14, 2, '#8a6a4c');
    rect(g, x + w - 10, b - 6, 2, 3, '#c0a060');
  },

  lanterne(g, s, t) {
    const { x, y, h } = s;
    const b = y + h;
    line(g, x + 8, b, x + 8, y + 6, 2, WOOD_D);
    line(g, x + 8, y + 6, x + 12, y + 6, 2, WOOD_D);
    rect(g, x + 9, y + 7, 6, 8, IRON_D);
    const f = 0.8 + Math.sin(t * 7 + x) * 0.12;
    rect(g, x + 10, y + 8, 4, 6, `rgba(255,200,120,${f.toFixed(2)})`);
    glow(g, x + 12, y + 11, 14, (0.4 * f).toFixed(3));
  },

  etabli(g, s, t) {
    const { x, y, w, h } = s;
    const b = y + h;
    const c = s.ruined ? '#5a4a3c' : WOOD;
    rect(g, x + 1, b - 14, w - 2, 3, c);
    rect(g, x + 3, b - 11, 3, 11, WOOD_D);
    rect(g, x + w - 6, b - 11, 3, 11, WOOD_D);
    rect(g, x + 3, b - 4, w - 6, 2, WOOD_D);
    // étau
    rect(g, x + w - 14, b - 19, 8, 5, IRON);
    rect(g, x + w - 12, b - 22, 2, 3, IRON_D);
    // panneau à outils
    rect(g, x + 4, y - 6, w - 20, 14, s.ruined ? '#3e342a' : '#54443a');
    line(g, x + 8, y - 3, x + 8, y + 5, 1.5, '#a0a0a0');
    line(g, x + 13, y - 4, x + 13, y + 4, 2, '#8a6a4c');
    g.strokeStyle = '#a0a0a0';
    g.lineWidth = 1.5;
    g.beginPath();
    g.arc(x + 20, y + 1, 3, 0, Math.PI * 2);
    g.stroke();
    // pièces sur la table
    rect(g, x + 10, b - 16, 5, 2, RUST);
    rect(g, x + 18, b - 17, 3, 3, '#c0a060');
    if (s.working) {
      const k = Math.sin(t * 16);
      line(g, x + 22, b - 22, x + 26 + k * 2, b - 16, 2, '#8a8a8a');
    }
  },

  depot(g, s) {
    const { x, y, w, h } = s;
    const b = y + h;
    rect(g, x + 2, b - 14, 18, 14, WOOD);
    rect(g, x + 2, b - 14, 18, 2, '#8a6a4c');
    line(g, x + 2, b - 14, x + 20, b, 1.5, WOOD_D);
    line(g, x + 20, b - 14, x + 2, b, 1.5, WOOD_D);
    rect(g, x + 22, b - 10, 22, 10, '#5a4a3a');
    rect(g, x + 26, b - 22, 14, 12, WOOD);
    rect(g, x + 26, b - 22, 14, 2, '#8a6a4c');
  },

  chaudiere(g, s, t) {
    const { x, y, w, h } = s;
    const b = y + h;
    const on = s.active;
    // cuve
    rect(g, x + 6, y + 8, w - 12, h - 14, '#6a4a3a');
    rect(g, x + 6, y + 8, w - 12, 3, '#8a6a52');
    for (let k = 0; k < 3; k++) rect(g, x + 6, y + 16 + k * 8, w - 12, 1, '#4a3428');
    // foyer
    rect(g, x + 10, b - 12, w - 20, 10, IRON_D);
    rect(g, x + 13, b - 9, w - 26, 6, on ? '#ff9a40' : '#2a201c');
    if (on) glow(g, x + w / 2, b - 6, 22, (0.4 + Math.sin(t * 11) * 0.08).toFixed(3));
    // cheminée et manomètre
    rect(g, x + w - 14, y - 6, 5, 16, IRON_D);
    g.fillStyle = '#c8c0a8';
    g.beginPath();
    g.arc(x + 12, y + 14, 4, 0, Math.PI * 2);
    g.fill();
    const a = on ? -0.6 + Math.sin(t * 2) * 0.3 : 1.8;
    line(g, x + 12, y + 14, x + 12 + Math.cos(a) * 3, y + 14 + Math.sin(a) * 3, 1, '#8a2a1a');
    // conduites
    line(g, x + 2, y + 20, x + 6, y + 20, 3, IRON);
    line(g, x + w - 6, y + 28, x + w, y + 28, 3, IRON);
  },

  moulin(g, s, t, game) {
    const { x, y, w, h } = s;
    const b = y + h;
    const cx = x + w / 2;
    line(g, x + 3, b, cx - 1, y + 10, 2, WOOD_D);
    line(g, x + w - 3, b, cx + 1, y + 10, 2, WOOD_D);
    for (let k = 1; k < 5; k++) line(g, x + 3 + k * 1.2, b - k * 16, x + w - 3 - k * 1.2, b - k * 16, 1, WOOD_D);
    rect(g, cx - 4, y + 6, 8, 8, IRON);
    const wind = game ? game.env.wind : 0.5;
    s.rot = (s.rot || 0) + 0.016 * (0.5 + wind * 2.5);
    const hx = cx;
    const hy = y + 10;
    for (let k = 0; k < 4; k++) {
      const a = s.rot + (k * Math.PI) / 2;
      const ex = hx + Math.cos(a) * 18;
      const ey = hy + Math.sin(a) * 18;
      line(g, hx, hy, ex, ey, 1.5, WOOD_D);
      g.fillStyle = s.ruined ? '#6a5a4a' : CLOTH;
      g.beginPath();
      g.moveTo(hx + Math.cos(a) * 5, hy + Math.sin(a) * 5);
      g.lineTo(ex, ey);
      g.lineTo(ex + Math.cos(a + 1.6) * 5, ey + Math.sin(a + 1.6) * 5);
      g.lineTo(hx + Math.cos(a + 0.4) * 6, hy + Math.sin(a + 0.4) * 6);
      g.fill();
    }
    rect(g, hx - 2, hy - 2, 4, 4, '#2a2420');
  },

  citerne(g, s, t) {
    const { x, y, w, h } = s;
    const b = y + h;
    rect(g, x + 3, y + 6, w - 6, h - 8, IRON);
    rect(g, x + 3, y + 6, w - 6, 3, '#7a7e86');
    for (let k = 0; k < 3; k++) rect(g, x + 3, y + 14 + k * 10, w - 6, 2, IRON_D);
    const lvl = s.level || 0;
    rect(g, x + w - 9, y + 10, 3, h - 16, '#2a2c30');
    rect(g, x + w - 9, y + 10 + (h - 16) * (1 - lvl), 3, (h - 16) * lvl, '#5aa0b8');
    rect(g, x + 5, b - 4, 4, 4, IRON_D);
    rect(g, x + w - 9, b - 4, 4, 4, IRON_D);
    // entonnoir à rosée
    g.fillStyle = '#7a7e86';
    g.beginPath();
    g.moveTo(x + 6, y + 6);
    g.lineTo(x + w / 2 - 2, y - 4);
    g.lineTo(x + w / 2 + 2, y - 4);
    g.lineTo(x + w - 6, y + 6);
    g.fill();
  },

  pompe(g, s, t) {
    const { x, y, w, h } = s;
    const b = y + h;
    const on = s.active;
    rect(g, x + 4, b - 18, w - 8, 18, IRON);
    rect(g, x + 4, b - 18, w - 8, 2, '#7a7e86');
    const k = on ? Math.sin(t * 5) * 5 : 0;
    rect(g, x + w / 2 - 2, y + 4 + k, 4, 22, '#8a8e96');
    line(g, x + w / 2, y + 4 + k, x + w - 2, y + 2, 2, IRON_D);
    rect(g, x + w - 4, y, 4, b - y, IRON_D);
    line(g, x + 2, b - 6, x - 6, b - 6, 3, '#4a6a78');
  },

  potager(g, s, t, game) {
    const { x, y, w, h } = s;
    const b = y + h;
    rect(g, x, b - 8, w, 8, WOOD);
    rect(g, x, b - 8, w, 2, '#8a6a4c');
    rect(g, x + 2, b - 10, w - 4, 3, '#4a3424');
    const grow = s.growth || 0;
    if (s.crop) {
      const green = s.dry ? '#8a7a4a' : '#6a9a4a';
      for (let i = 0; i < 7; i++) {
        const px = x + 5 + i * 8;
        const hh = 3 + grow * 10 + Math.sin(i * 2.1) * 2;
        const sway = Math.sin(t * 1.5 + i) * 1.2;
        line(g, px, b - 9, px + sway, b - 9 - hh, 1.5, green);
        if (grow > 0.6) {
          g.fillStyle = s.crop === 'herbe' ? '#c8b060' : '#d08a50';
          g.fillRect(px + sway - 1.5, b - 10 - hh, 3, 3);
        }
      }
    }
  },

  chambre(g, s, t) {
    const { x, y, w, h } = s;
    const b = y + h;
    const on = s.active;
    // socle
    rect(g, x + 2, b - 8, w - 4, 8, IRON_D);
    rect(g, x + 2, b - 8, w - 4, 2, IRON);
    // cuve de verre
    g.fillStyle = on ? 'rgba(150,200,160,0.35)' : 'rgba(150,170,170,0.2)';
    g.beginPath();
    g.ellipse(x + w / 2, y + h / 2 - 2, w / 2 - 8, h / 2 - 8, 0, 0, Math.PI * 2);
    g.fill();
    g.strokeStyle = '#7a8a8a';
    g.lineWidth = 2;
    g.stroke();
    // membrane et racines
    g.strokeStyle = '#8a4a52';
    g.lineWidth = 2;
    for (let k = -1; k <= 1; k++) {
      g.beginPath();
      g.moveTo(x + w / 2 + k * 10, b - 8);
      g.quadraticCurveTo(x + w / 2 + k * 18, y + h / 2, x + w / 2 + k * 6, y + 10);
      g.stroke();
    }
    // organisme en croissance
    if (s.progress > 0) {
      const r = 3 + s.progress * 12;
      const p = 1 + Math.sin(t * 3) * 0.06;
      g.fillStyle = 'rgba(200,120,120,0.75)';
      g.beginPath();
      g.ellipse(x + w / 2, y + h / 2 - 2, r * p, r * 0.8 * p, 0, 0, Math.PI * 2);
      g.fill();
    }
    // tuyaux
    line(g, x, y + 14, x + 8, y + 14, 3, IRON);
    line(g, x + w - 8, y + 20, x + w, y + 20, 3, IRON);
    if (on) {
      for (let k = 0; k < 3; k++) {
        const by = y + h - 14 - ((t * 12 + k * 13) % (h - 20));
        g.fillStyle = 'rgba(220,255,230,0.5)';
        g.fillRect(x + w / 2 - 6 + k * 5, by, 2, 2);
      }
    }
  },

  forge(g, s, t) {
    const { x, y, w, h } = s;
    const b = y + h;
    const on = s.active;
    rect(g, x + 4, y + 10, w - 8, h - 10, '#5a4038');
    rect(g, x + 4, y + 10, w - 8, 3, '#7a5a4a');
    rect(g, x + 14, b - 22, 24, 16, '#2a1c18');
    if (on) {
      rect(g, x + 16, b - 20, 20, 12, '#ff8a30');
      glow(g, x + 26, b - 14, 34, (0.45 + Math.sin(t * 8) * 0.08).toFixed(3));
    }
    // marteau-pilon
    const k = on ? Math.max(0, Math.sin(t * 3)) * 10 : 0;
    rect(g, x + w - 26, y - 14, 4, 30, IRON_D);
    rect(g, x + w - 32, y + 6 + k, 16, 8, IRON);
    rect(g, x + w - 30, b - 8, 12, 8, IRON_D);
    rect(g, x + 8, y - 20, 6, 30, '#4a3430');
  },

  pompe_barrage(g, s, t) {
    const { x, y, w, h } = s;
    const b = y + h;
    const on = s.active;
    rect(g, x + 2, y + 6, w - 4, h - 6, s.ruined ? '#4e4a48' : '#5a6068');
    rect(g, x + 2, y + 6, w - 4, 3, '#7a8088');
    for (let k = 0; k < 3; k++) {
      const a = (on ? t * 2 : 0) + k;
      const cx = x + 14 + k * 16;
      g.strokeStyle = s.ruined ? '#6a4a3a' : '#9a9aa0';
      g.lineWidth = 2;
      g.beginPath();
      g.arc(cx, y + 26, 6, 0, Math.PI * 2);
      g.stroke();
      line(g, cx, y + 26, cx + Math.cos(a) * 6, y + 26 + Math.sin(a) * 6, 2, g.strokeStyle);
    }
    if (s.ruined) {
      rect(g, x + 10, y + 40, 12, 6, RUST);
      rect(g, x + 36, y + 14, 8, 4, RUST);
    }
    rect(g, x + w - 8, y - 16, 6, 22, IRON_D);
  },

  vanne(g, s, t) {
    const { x, y } = s;
    const cx = x + 16;
    const cy = y + 14;
    const a = s.turn || 0;
    rect(g, cx - 2, cy, 4, 18, IRON_D);
    g.strokeStyle = '#8a3a2a';
    g.lineWidth = 3;
    g.beginPath();
    g.arc(cx, cy, 10, 0, Math.PI * 2);
    g.stroke();
    for (let k = 0; k < 4; k++) line(g, cx, cy, cx + Math.cos(a + (k * Math.PI) / 2) * 10, cy + Math.sin(a + (k * Math.PI) / 2) * 10, 2, '#8a3a2a');
    rect(g, cx - 3, cy - 3, 6, 6, '#5a2a1a');
  },

  capsule(g, s, t) {
    const { x, y, w, h } = s;
    rect(g, x + 2, y + h - 6, w - 4, 6, IRON_D);
    g.fillStyle = s.open ? 'rgba(160,180,180,0.15)' : 'rgba(180,210,200,0.4)';
    g.beginPath();
    g.ellipse(x + w / 2, y + h / 2, w / 2 - 2, h / 2 - 3, 0, 0, Math.PI * 2);
    g.fill();
    g.strokeStyle = '#8a9a9a';
    g.lineWidth = 2;
    g.stroke();
    if (!s.open) {
      g.fillStyle = 'rgba(120,90,80,0.6)';
      g.beginPath();
      g.ellipse(x + w / 2, y + h / 2 + 2, 5, 13, 0, 0, Math.PI * 2);
      g.fill();
    }
  },

  archives(g, s) {
    const { x, y, w, h } = s;
    const b = y + h;
    for (let k = 0; k < 3; k++) {
      rect(g, x + 2, b - 4 - k * 14, w - 4, 3, WOOD_D);
      for (let i = 0; i < 8; i++) rect(g, x + 4 + i * 7, b - 13 - k * 14, 5, 9, i % 3 ? '#8a7a5a' : '#6a5a7a');
    }
  },

  matrice(g, s, t) {
    const { x, y, w, h } = s;
    const b = y + h;
    const life = s.life || 0; // 0 morte, 1 restaurée
    const beat = life > 0 ? 1 + Math.max(0, Math.sin(t * 1.6)) * 0.05 * life : 1;
    const cx = x + w / 2;
    // socle de pierre et conduites
    rect(g, x + 10, b - 18, w - 20, 18, '#6a6066');
    rect(g, x + 10, b - 18, w - 20, 3, '#8a8086');
    for (let k = 0; k < 8; k++) {
      const px = x + 20 + k * ((w - 40) / 7);
      line(g, px, b - 18, px + Math.sin(k) * 10, b - 60 - (k % 3) * 20, 4, '#5a5862');
    }
    // corps organique
    const body = mix(hex('#6a4a4e'), hex('#b0505a'), life);
    g.fillStyle = css(body);
    g.beginPath();
    g.ellipse(cx, b - 100, 70 * beat, 80 * beat, 0, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = css(scale(body, 0.8));
    g.beginPath();
    g.ellipse(cx - 20, b - 90, 30 * beat, 40 * beat, 0.3, 0, Math.PI * 2);
    g.fill();
    g.beginPath();
    g.ellipse(cx + 26, b - 110, 26 * beat, 36 * beat, -0.3, 0, Math.PI * 2);
    g.fill();
    // veines
    g.strokeStyle = css(mix(hex('#3a2a2e'), hex('#ffcf80'), life * 0.7));
    g.lineWidth = 2;
    for (let k = 0; k < 7; k++) {
      g.beginPath();
      const a = (k / 7) * Math.PI * 2;
      g.moveTo(cx, b - 100);
      g.quadraticCurveTo(cx + Math.cos(a) * 40, b - 100 + Math.sin(a) * 30, cx + Math.cos(a + 0.4) * 62, b - 100 + Math.sin(a + 0.4) * 70);
      g.stroke();
    }
    // armature métallique
    g.strokeStyle = '#4a4852';
    g.lineWidth = 4;
    g.beginPath();
    g.ellipse(cx, b - 100, 76, 86, 0, Math.PI * 1.1, Math.PI * 1.9);
    g.stroke();
    line(g, cx, b - 186, cx, y - 40, 3, '#4a4852');
    if (life > 0) {
      const gr = g.createRadialGradient(cx, b - 100, 4, cx, b - 100, 120);
      gr.addColorStop(0, `rgba(255,200,140,${(0.25 * life).toFixed(3)})`);
      gr.addColorStop(1, 'rgba(255,200,140,0)');
      g.fillStyle = gr;
      g.fillRect(cx - 120, b - 220, 240, 240);
    }
  },

  coeur(g, s, t) {
    const { x, y, w, h } = s;
    const cx = x + w / 2;
    const cy = y + h / 2;
    const state = s.state || 'dormant';
    const beat = 1 + Math.max(0, Math.sin(t * (state === 'awake' ? 1.6 : 0.4))) * 0.04;
    const col = state === 'awake' ? '#c0505a' : state === 'freed' ? '#6a8a4a' : '#5a3a40';
    g.fillStyle = col;
    g.beginPath();
    g.ellipse(cx, cy, 70 * beat, 82 * beat, 0, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = 'rgba(0,0,0,0.25)';
    g.beginPath();
    g.ellipse(cx + 18, cy + 10, 40 * beat, 56 * beat, 0.2, 0, Math.PI * 2);
    g.fill();
    g.strokeStyle = state === 'awake' ? '#ffcf80' : '#3a2a2e';
    g.lineWidth = 3;
    for (let k = 0; k < 9; k++) {
      const a = (k / 9) * Math.PI * 2 + 0.3;
      g.beginPath();
      g.moveTo(cx, cy);
      g.quadraticCurveTo(cx + Math.cos(a) * 50, cy + Math.sin(a) * 40, cx + Math.cos(a + 0.5) * 120, cy + Math.sin(a + 0.5) * 120);
      g.stroke();
    }
    if (state !== 'dormant') glow(g, cx, cy, 160, 0.25);
  },
};
