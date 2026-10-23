// Dessin des modules de robots, utilisable à toutes les échelles (éditeur et monde).
import { MODULES } from '../data/modules.js';

const IRON = '#6a6e76';
const IRON_L = '#8e929a';
const IRON_D = '#3e4046';
const BRASS = '#b08a4a';
const RUST = '#8a4a2c';

function r(g, x, y, w, h, c) {
  g.fillStyle = c;
  g.fillRect(x, y, w, h);
}

// st : { t, phase, moving, working, flying, tint }
export function drawModule(g, m, x, y, s, st = {}) {
  const t = st.t || 0;
  const k = s / 6;
  const lw = Math.max(1, k * 0.8);
  g.lineWidth = lw;
  switch (m) {
    case 'chassis':
      r(g, x, y + s * 0.15, s, s * 0.7, IRON);
      r(g, x, y + s * 0.15, s, s * 0.12, IRON_L);
      g.strokeStyle = IRON_D;
      g.beginPath();
      g.moveTo(x, y + s * 0.85);
      g.lineTo(x + s, y + s * 0.15);
      g.stroke();
      break;
    case 'noyau': {
      r(g, x + s * 0.05, y + s * 0.05, s * 0.9, s * 0.9, IRON_D);
      r(g, x + s * 0.1, y + s * 0.1, s * 0.8, s * 0.15, IRON);
      const pulse = 0.6 + Math.sin(t * 3) * 0.3;
      g.fillStyle = `rgba(255,${180 + pulse * 40},110,${0.7 + pulse * 0.3})`;
      g.beginPath();
      g.arc(x + s * 0.5, y + s * 0.55, s * 0.22, 0, Math.PI * 2);
      g.fill();
      r(g, x + s * 0.2, y + s * 0.82, s * 0.6, s * 0.08, BRASS);
      break;
    }
    case 'ressort': {
      r(g, x + s * 0.1, y + s * 0.1, s * 0.8, s * 0.8, '#5a5040');
      g.strokeStyle = BRASS;
      g.beginPath();
      const n = 4;
      for (let i = 0; i <= n * 2; i++) {
        const px = x + s * 0.2 + ((i % 2) * s * 0.6);
        const py = y + s * 0.18 + (i * s * 0.64) / (n * 2);
        if (i === 0) g.moveTo(px, py);
        else g.lineTo(px, py);
      }
      g.stroke();
      break;
    }
    case 'chaudiere': {
      r(g, x + s * 0.05, y + s * 0.1, s * 0.9, s * 0.85, '#6a4a3a');
      r(g, x + s * 0.05, y + s * 0.1, s * 0.9, s * 0.12, '#8a6a52');
      r(g, x + s * 0.3, y + s * 0.6, s * 0.4, s * 0.25, st.working !== false ? '#ff9a40' : '#2a201c');
      r(g, x + s * 0.7, y - s * 0.25, s * 0.15, s * 0.4, IRON_D);
      break;
    }
    case 'roue': {
      const a = st.phase || 0;
      const cx = x + s * 0.5;
      const cy = y + s * 0.55;
      const rad = s * 0.45;
      g.fillStyle = '#2a2826';
      g.beginPath();
      g.arc(cx, cy, rad, 0, Math.PI * 2);
      g.fill();
      g.fillStyle = IRON_L;
      g.beginPath();
      g.arc(cx, cy, rad * 0.55, 0, Math.PI * 2);
      g.fill();
      g.strokeStyle = IRON_D;
      g.beginPath();
      for (let i = 0; i < 3; i++) {
        const aa = a + (i * Math.PI * 2) / 3;
        g.moveTo(cx, cy);
        g.lineTo(cx + Math.cos(aa) * rad * 0.55, cy + Math.sin(aa) * rad * 0.55);
      }
      g.stroke();
      r(g, cx - s * 0.12, y, s * 0.24, s * 0.2, IRON);
      break;
    }
    case 'chenille': {
      g.fillStyle = '#2a2826';
      g.beginPath();
      g.roundRect ? g.roundRect(x, y + s * 0.3, s, s * 0.65, s * 0.3) : g.rect(x, y + s * 0.3, s, s * 0.65);
      g.fill();
      const off = ((st.phase || 0) * s * 0.2) % (s * 0.33);
      g.fillStyle = '#4a4846';
      for (let i = -1; i < 4; i++) {
        const px = x + i * s * 0.33 + off;
        if (px >= x && px < x + s - s * 0.1) r(g, px, y + s * 0.3, s * 0.1, s * 0.65, '#4a4846');
      }
      g.fillStyle = IRON;
      g.beginPath();
      g.arc(x + s * 0.5, y + s * 0.62, s * 0.18, 0, Math.PI * 2);
      g.fill();
      r(g, x + s * 0.3, y, s * 0.4, s * 0.32, IRON);
      break;
    }
    case 'patte': {
      const ph = st.phase || 0;
      const sw = st.moving ? Math.sin(ph) * s * 0.25 : 0;
      g.strokeStyle = IRON_D;
      g.lineWidth = Math.max(1, s * 0.16);
      g.beginPath();
      g.moveTo(x + s * 0.5, y + s * 0.1);
      g.lineTo(x + s * 0.25 - sw * 0.4, y + s * 0.5);
      g.lineTo(x + s * 0.5 + sw, y + s * 0.98);
      g.stroke();
      r(g, x + s * 0.3 + sw, y + s * 0.88, s * 0.45, s * 0.12, IRON);
      r(g, x + s * 0.3, y, s * 0.4, s * 0.2, IRON);
      break;
    }
    case 'ballon': {
      const bob = Math.sin(t * 1.5) * s * 0.05;
      g.fillStyle = '#b89a72';
      g.beginPath();
      g.ellipse(x + s * 0.5, y + s * 0.4 + bob, s * 0.55, s * 0.45, 0, 0, Math.PI * 2);
      g.fill();
      g.strokeStyle = '#8a6a4a';
      g.beginPath();
      g.moveTo(x + s * 0.5, y - s * 0.05 + bob);
      g.lineTo(x + s * 0.5, y + s * 0.85 + bob);
      g.stroke();
      g.beginPath();
      g.moveTo(x + s * 0.2, y + s * 0.75);
      g.lineTo(x + s * 0.2, y + s);
      g.moveTo(x + s * 0.8, y + s * 0.75);
      g.lineTo(x + s * 0.8, y + s);
      g.stroke();
      break;
    }
    case 'pince': {
      const open = st.working ? Math.abs(Math.sin(t * 10)) * 0.25 : 0.1;
      r(g, x, y + s * 0.4, s * 0.5, s * 0.2, IRON);
      g.fillStyle = IRON_L;
      g.beginPath();
      g.moveTo(x + s * 0.5, y + s * 0.4);
      g.lineTo(x + s, y + s * (0.2 - open));
      g.lineTo(x + s * 0.9, y + s * 0.45);
      g.closePath();
      g.fill();
      g.beginPath();
      g.moveTo(x + s * 0.5, y + s * 0.6);
      g.lineTo(x + s, y + s * (0.8 + open));
      g.lineTo(x + s * 0.9, y + s * 0.55);
      g.closePath();
      g.fill();
      break;
    }
    case 'foreuse': {
      r(g, x, y + s * 0.3, s * 0.4, s * 0.4, IRON);
      const sp = st.working ? t * 30 : 0;
      g.fillStyle = '#9a9aa2';
      g.beginPath();
      g.moveTo(x + s * 0.4, y + s * 0.2);
      g.lineTo(x + s * 1.05, y + s * 0.5);
      g.lineTo(x + s * 0.4, y + s * 0.8);
      g.closePath();
      g.fill();
      g.strokeStyle = IRON_D;
      for (let i = 0; i < 3; i++) {
        const px = x + s * (0.5 + i * 0.15) + ((sp * s * 0.02) % (s * 0.15));
        g.beginPath();
        g.moveTo(px, y + s * 0.3 + i * s * 0.05);
        g.lineTo(px + s * 0.08, y + s * 0.7 - i * s * 0.05);
        g.stroke();
      }
      break;
    }
    case 'benne':
      g.fillStyle = '#6a5a44';
      g.beginPath();
      g.moveTo(x, y + s * 0.15);
      g.lineTo(x + s, y + s * 0.15);
      g.lineTo(x + s * 0.85, y + s * 0.95);
      g.lineTo(x + s * 0.15, y + s * 0.95);
      g.closePath();
      g.fill();
      r(g, x, y + s * 0.15, s, s * 0.1, '#8a7658');
      if (st.cargo) r(g, x + s * 0.15, y + s * 0.05, s * 0.7 * Math.min(1, st.cargo), s * 0.15, RUST);
      break;
    case 'grue': {
      r(g, x + s * 0.35, y + s * 0.2, s * 0.3, s * 0.8, BRASS);
      g.strokeStyle = BRASS;
      g.lineWidth = Math.max(1, s * 0.12);
      g.beginPath();
      g.moveTo(x + s * 0.5, y + s * 0.25);
      g.lineTo(x + s * 1.1, y - s * 0.1);
      g.stroke();
      g.strokeStyle = IRON_D;
      g.lineWidth = lw;
      g.beginPath();
      g.moveTo(x + s * 1.05, y - s * 0.05);
      g.lineTo(x + s * 1.05, y + s * 0.5);
      g.stroke();
      r(g, x + s * 0.95, y + s * 0.5, s * 0.2, s * 0.12, IRON_D);
      break;
    }
    case 'arroseur': {
      r(g, x + s * 0.15, y + s * 0.2, s * 0.6, s * 0.7, '#4a6a78');
      r(g, x + s * 0.15, y + s * 0.2, s * 0.6, s * 0.1, '#6a8a98');
      r(g, x + s * 0.75, y + s * 0.4, s * 0.25, s * 0.12, IRON);
      if (st.working) {
        g.fillStyle = 'rgba(160,210,230,0.7)';
        for (let i = 0; i < 3; i++) g.fillRect(x + s * (1 + i * 0.15), y + s * (0.5 + ((t * 4 + i) % 1) * 0.6), Math.max(1, s * 0.08), Math.max(1, s * 0.12));
      }
      break;
    }
    case 'soudeuse': {
      r(g, x + s * 0.1, y + s * 0.25, s * 0.5, s * 0.5, IRON_D);
      r(g, x + s * 0.6, y + s * 0.42, s * 0.4, s * 0.12, IRON_L);
      if (st.working && Math.sin(t * 25) > 0) {
        g.fillStyle = 'rgba(200,230,255,0.95)';
        g.beginPath();
        g.arc(x + s, y + s * 0.48, s * 0.15, 0, Math.PI * 2);
        g.fill();
      }
      break;
    }
    case 'siege':
      r(g, x + s * 0.1, y + s * 0.6, s * 0.8, s * 0.25, '#6a4a3a');
      r(g, x + s * 0.1, y + s * 0.1, s * 0.2, s * 0.6, '#6a4a3a');
      r(g, x + s * 0.1, y + s * 0.85, s * 0.8, s * 0.15, IRON);
      break;
    case 'blindage':
      r(g, x, y, s, s, '#545860');
      r(g, x, y, s, s * 0.12, '#7a7e86');
      g.fillStyle = IRON_L;
      for (const [px, py] of [
        [0.2, 0.25],
        [0.8, 0.25],
        [0.2, 0.8],
        [0.8, 0.8],
      ])
        g.fillRect(x + s * px - 0.5, y + s * py - 0.5, Math.max(1, s * 0.08), Math.max(1, s * 0.08));
      break;
    case 'lampe': {
      r(g, x + s * 0.45, y + s * 0.4, s * 0.1, s * 0.6, IRON_D);
      r(g, x + s * 0.25, y + s * 0.1, s * 0.5, s * 0.35, IRON_D);
      const f = 0.8 + Math.sin(t * 7) * 0.1;
      r(g, x + s * 0.3, y + s * 0.15, s * 0.4, s * 0.25, `rgba(255,210,130,${f.toFixed(2)})`);
      break;
    }
    default:
      r(g, x, y, s, s, '#888');
  }
}

export function moduleLabel(m) {
  return MODULES[m] ? MODULES[m].name : m;
}
