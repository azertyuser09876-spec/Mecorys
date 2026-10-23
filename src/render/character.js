// Personnages humains dessinés comme des marionnettes articulées.
import { css, hex, scale, mix } from '../core/color.js';

export const SKINS = ['#f1d3bc', '#e0b493', '#c68e68', '#a06a48', '#7a4e34', '#4f3324'];
export const HAIRS = ['#1e1a18', '#4a3020', '#7a5232', '#b88a4e', '#d8c8a8', '#8a8a8a', '#7a2e22', '#3a4a5a'];
export const CLOTHES = ['#6e5a44', '#8a6a48', '#a4824e', '#4e5a48', '#5a6a6e', '#3e4656', '#7a4a3a', '#8e8270', '#5e4a5e', '#c8b89a', '#9a4e32', '#2e3436'];
export const HAIR_STYLES = ['Courts', 'Longs', 'Queue', 'Rasés', 'Chignon', 'Bouclés'];
export const BUILDS = ['Mince', 'Moyenne', 'Robuste'];
export const FACES = ['Ronde', 'Longue', 'Anguleuse'];
export const ACCESSORIES = ['Aucun', 'Écharpe', 'Lunettes de sable', 'Capuche', 'Sac à dos'];

export function defaultLook() {
  return {
    skin: 2,
    face: 0,
    hairStyle: 0,
    hairColor: 1,
    build: 1,
    top: 1,
    bottom: 11,
    accent: 10,
    accessory: 1,
    pack: true,
  };
}

function seg(g, x0, y0, x1, y1, w, col) {
  g.strokeStyle = col;
  g.lineWidth = w;
  g.beginPath();
  g.moveTo(x0, y0);
  g.lineTo(x1, y1);
  g.stroke();
}

// Pose : { facing, phase, state, t, vx, vy, use, scarf: [{x,y}...] }
// (x, y) : centre des pieds, en pixels du monde.
export function drawHuman(g, x, y, look, pose, opts = {}) {
  const f = pose.facing || 1;
  const skin = SKINS[look.skin % SKINS.length];
  const skinDark = css(scale(hex(skin), 0.82));
  const hair = HAIRS[look.hairColor % HAIRS.length];
  const top = CLOTHES[look.top % CLOTHES.length];
  const topDark = css(scale(hex(top), 0.78));
  const bottom = CLOTHES[look.bottom % CLOTHES.length];
  const bottomDark = css(scale(hex(bottom), 0.75));
  const accent = CLOTHES[look.accent % CLOTHES.length];
  const boot = '#2a2420';
  const bw = [4.5, 5.5, 7][look.build] || 5.5;
  const s = opts.scale || 1;

  g.save();
  g.translate(Math.round(x), Math.round(y));
  if (s !== 1) g.scale(s, s);
  g.lineCap = 'round';
  g.lineJoin = 'round';

  const st = pose.state;
  const ph = pose.phase || 0;
  let crouch = st === 'crouch' ? 7 : 0;
  let hipY = -12 + crouch;
  let lean = 0;
  if (st === 'run') lean = 0.18 * f;
  if (st === 'walk') lean = 0.06 * f;
  if (st === 'swim') lean = 0;

  // Respiration
  const breathe = st === 'idle' ? Math.sin(pose.t * 2.2) * 0.4 : 0;

  // Jambes
  let lA = 0,
    lB = 0,
    kA = 0,
    kB = 0;
  if (st === 'walk' || st === 'run') {
    const amp = st === 'run' ? 0.85 : 0.55;
    lA = Math.sin(ph) * amp;
    lB = Math.sin(ph + Math.PI) * amp;
    kA = Math.max(0, Math.sin(ph - 1.2)) * (st === 'run' ? 1.3 : 0.8);
    kB = Math.max(0, Math.sin(ph + Math.PI - 1.2)) * (st === 'run' ? 1.3 : 0.8);
    hipY += Math.abs(Math.cos(ph)) * -1;
  } else if (st === 'jump') {
    lA = 0.5;
    lB = -0.2;
    kA = 1.2;
    kB = 0.4;
  } else if (st === 'fall') {
    lA = 0.25;
    lB = -0.35;
    kA = 0.6;
    kB = 0.5;
  } else if (st === 'climb') {
    lA = Math.sin(ph) * 0.3;
    lB = -Math.sin(ph) * 0.3;
    kA = 0.9 + Math.sin(ph) * 0.5;
    kB = 0.9 - Math.sin(ph) * 0.5;
  } else if (st === 'swim') {
    lA = Math.sin(ph * 1.5) * 0.5;
    lB = -Math.sin(ph * 1.5) * 0.5;
    kA = 0.4;
    kB = 0.4;
  } else if (st === 'crouch') {
    lA = 0.9;
    lB = -0.3;
    kA = 1.9;
    kB = 1.4;
  } else if (st === 'sit') {
    lA = 1.5;
    lB = 1.3;
    kA = 1.6;
    kB = 1.5;
    hipY = -6;
  }
  const thigh = 6.2;
  const shin = 6.4;
  const hipX = 0;
  const leg = (a, k, col, colDark, back) => {
    const ax = Math.sin(a) * f;
    const ay = Math.cos(a);
    const kx = hipX + ax * thigh;
    const ky = hipY + ay * thigh;
    const a2 = a - k;
    const fx = kx + Math.sin(a2) * f * shin;
    const fy = ky + Math.cos(a2) * shin;
    seg(g, hipX, hipY, kx, ky, 3, back ? colDark : col);
    seg(g, kx, ky, fx, fy, 2.6, back ? colDark : col);
    seg(g, fx - f * 0.5, fy - 0.5, fx + f * 2, fy, 2.4, boot);
  };
  leg(lB, kB, bottom, bottomDark, true);

  // Sac à dos (derrière)
  const shoulderY = hipY - 9 + breathe;
  if (look.accessory === 4 || look.pack) {
    g.fillStyle = css(scale(hex(accent), 0.7));
    g.fillRect(-f * (bw / 2 + 3.5) - 2, shoulderY + 1, 4.5, 7);
    g.fillStyle = css(scale(hex(accent), 0.55));
    g.fillRect(-f * (bw / 2 + 3.5) - 2, shoulderY + 6, 4.5, 2);
  }

  // Bras arrière
  const arm = (side) => {
    let a;
    if (st === 'walk' || st === 'run') a = -Math.sin(ph + (side ? Math.PI : 0)) * (st === 'run' ? 0.9 : 0.5);
    else if (st === 'climb') a = Math.PI - 0.3 + (side ? Math.sin(ph) : -Math.sin(ph)) * 0.5;
    else if (st === 'jump') a = side ? -2.4 : -2.0;
    else if (st === 'fall') a = side ? -2.6 : 2.4;
    else if (st === 'swim') a = Math.PI / 2 + Math.sin(ph * 1.5 + (side ? 0 : Math.PI)) * 1.2;
    else a = 0.08 + Math.sin(pose.t * 2.2 + side) * 0.03;
    if (pose.use && side === 0) a = -1.4 + Math.sin(pose.t * 18) * 0.35;
    if (pose.reach && side === 0) a = -1.6;
    const sx = f * (bw / 2 - 1.5) * (side ? -0.4 : 0.4);
    const ex = sx + Math.sin(a) * f * 4.6;
    const ey = shoulderY + 1 + Math.cos(a) * 4.6;
    const a2 = a + (st === 'run' ? -0.9 : -0.35);
    const hx = ex + Math.sin(a2) * f * 4.4;
    const hy = ey + Math.cos(a2) * 4.4;
    const col = side ? topDark : top;
    seg(g, sx, shoulderY + 1, ex, ey, 2.4, col);
    seg(g, ex, ey, hx, hy, 2.1, side ? skinDark : skin);
    return [hx, hy];
  };
  arm(1);

  // Torse
  g.save();
  g.rotate(lean);
  g.fillStyle = top;
  g.beginPath();
  g.moveTo(-bw / 2, shoulderY);
  g.lineTo(bw / 2, shoulderY);
  g.lineTo(bw / 2 - 0.5, hipY + 1);
  g.lineTo(-bw / 2 + 0.5, hipY + 1);
  g.closePath();
  g.fill();
  // ceinture et ombre
  g.fillStyle = topDark;
  g.fillRect(-bw / 2, hipY - 1, bw, 2);
  g.fillRect(-f * bw / 2, shoulderY, f * 1.5, hipY - shoulderY);
  g.restore();

  // Jambe avant
  leg(lA, kA, bottom, bottomDark, false);

  // Tête
  const headY = shoulderY - 4.2 + (st === 'swim' ? 1 : 0);
  const headX = f * 0.6 + lean * 8;
  const faceW = [3.4, 3.0, 3.2][look.face] || 3.3;
  const faceH = [3.4, 3.9, 3.5][look.face] || 3.5;
  // cou
  seg(g, headX * 0.4, shoulderY, headX, headY + 2, 2, skinDark);
  // cheveux derrière
  g.fillStyle = hair;
  const hs = look.hairStyle;
  if (hs === 1) g.fillRect(headX - f * 3.5 - 1.5, headY - 2, 3.5, 8);
  if (hs === 2) {
    seg(g, headX - f * 2.5, headY - 1, headX - f * 6, headY + 3 + Math.sin(pose.t * 6) * 0.6, 2, hair);
  }
  if (hs === 4) {
    g.beginPath();
    g.arc(headX - f * 2.6, headY - 3, 1.9, 0, Math.PI * 2);
    g.fill();
  }
  g.fillStyle = skin;
  g.beginPath();
  g.ellipse(headX, headY, faceW, faceH, 0, 0, Math.PI * 2);
  g.fill();
  if (look.face === 2) {
    g.fillRect(headX + f * 1, headY + 1, f * 2.4, 2);
  }
  // cheveux dessus
  g.fillStyle = hair;
  if (hs !== 3) {
    g.beginPath();
    g.ellipse(headX - f * 0.4, headY - 1.6, faceW + 0.4, faceH * 0.62, 0, Math.PI, 0);
    g.fill();
    g.fillRect(headX - f * faceW - (f < 0 ? -0.0 : 0) - 0.4, headY - 1.6, f * 1.6, 3.2);
    if (hs === 5) {
      for (let k = -2; k <= 2; k++) {
        g.beginPath();
        g.arc(headX + k * 1.5, headY - 3.6, 1.3, 0, Math.PI * 2);
        g.fill();
      }
    }
  } else {
    g.fillStyle = css(mix(hex(hair), hex(skin), 0.5));
    g.beginPath();
    g.ellipse(headX - f * 0.4, headY - 1.8, faceW, faceH * 0.5, 0, Math.PI, 0);
    g.fill();
  }
  // œil
  g.fillStyle = '#1a1412';
  g.fillRect(headX + f * 1.6 - 0.5, headY - 0.3, 1, 1.2);
  // Accessoires
  if (look.accessory === 2) {
    g.fillStyle = '#5a4a3a';
    g.fillRect(headX - faceW, headY - 2.2, faceW * 2, 1.2);
    g.fillStyle = '#9fc2c8';
    g.fillRect(headX + f * 0.8 - 1, headY - 1.4, 2.6, 2);
  }
  if (look.accessory === 3) {
    g.fillStyle = css(hex(accent));
    g.beginPath();
    g.ellipse(headX - f * 0.6, headY - 0.5, faceW + 1.4, faceH + 1.2, 0, Math.PI * 0.85, Math.PI * 2.15);
    g.fill();
    g.fillRect(headX - f * (faceW + 1) - 1, headY - 1, 2, 5);
  }

  // Bras avant (par-dessus le torse)
  const hand = arm(0);
  if (opts.tool) drawTool(g, hand[0], hand[1], f, pose);

  // Écharpe
  if (look.accessory === 1 && pose.scarf) {
    g.strokeStyle = accent;
    g.lineWidth = 2.2;
    g.beginPath();
    g.moveTo(headX * 0.5, shoulderY + 0.5);
    for (const p of pose.scarf) g.lineTo(p.x - x, p.y - y);
    g.stroke();
    g.fillStyle = accent;
    g.fillRect(headX * 0.5 - 2.5, shoulderY - 0.5, 5, 2);
  }
  g.restore();
}

function drawTool(g, hx, hy, f, pose) {
  // levier-outil multifonction
  const a = pose.use ? -0.6 + Math.sin(pose.t * 18) * 0.4 : 0.9;
  const ex = hx + Math.cos(a) * 6 * f;
  const ey = hy + Math.sin(a) * 6;
  seg(g, hx, hy, ex, ey, 1.6, '#6a625a');
  seg(g, ex, ey, ex + f * 1.6, ey - 1.6, 2, '#a89a84');
}

// Simulation simple d'une écharpe portée par le vent.
export function updateScarf(scarf, ax, ay, wind, dt, facing) {
  const n = 5;
  if (scarf.length !== n) {
    scarf.length = 0;
    for (let i = 0; i < n; i++) scarf.push({ x: ax - facing * i * 2, y: ay + i, px: ax - facing * i * 2, py: ay + i });
  }
  let prevX = ax;
  let prevY = ay;
  for (let i = 0; i < n; i++) {
    const p = scarf[i];
    const vx = (p.x - p.px) * 0.86;
    const vy = (p.y - p.py) * 0.86;
    p.px = p.x;
    p.py = p.y;
    p.x += vx + wind * dt * 60 * 0.12;
    p.y += vy + 0.18;
    const dx = p.x - prevX;
    const dy = p.y - prevY;
    const d = Math.hypot(dx, dy) || 1;
    const L = 2.3;
    p.x = prevX + (dx / d) * L;
    p.y = prevY + (dy / d) * L;
    prevX = p.x;
    prevY = p.y;
  }
}
