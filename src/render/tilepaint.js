// Peinture procédurale des tuiles d'un bloc de 32×32 dans une surface hors écran.
import { TILE, T, BG, tileDef } from '../world/tiles.js';
import { CHUNK } from '../world/world.js';
import { paletteColor } from '../world/regions.js';
import { hash2 } from '../core/rng.js';
import { css, mix, scale } from '../core/color.js';
import { makeCanvas, ctx2d } from './canvas.js';

const S = TILE;

export function paintChunk(src, cx, cy, canvas) {
  // src : { get(x,y), getBg(x,y) } — le monde ou un colosse
  const size = CHUNK * S;
  if (!canvas) canvas = makeCanvas(size, size);
  const g = ctx2d(canvas);
  g.clearRect(0, 0, size, size);
  const x0 = cx * CHUNK;
  const y0 = cy * CHUNK;
  const get = (x, y) => src.get(x, y);
  const pal = src.palette || paletteColor;

  // 1. Murs d'arrière-plan
  for (let ly = 0; ly < CHUNK; ly++) {
    for (let lx = 0; lx < CHUNK; lx++) {
      const x = x0 + lx;
      const y = y0 + ly;
      const b = src.getBg(x, y);
      if (b === BG.NONE) continue;
      const d = tileDef(get(x, y));
      if (d.solid && d.opaque) continue;
      paintBg(g, lx * S, ly * S, b, x, y, src, pal);
    }
  }
  // 2. Tuiles et rampes adoucissant les marches naturelles
  for (let ly = 0; ly < CHUNK; ly++) {
    for (let lx = 0; lx < CHUNK; lx++) {
      const x = x0 + lx;
      const y = y0 + ly;
      const id = get(x, y);
      if (id === T.WATER) continue;
      if (id === T.AIR) {
        const r = rampAt(get, x, y);
        if (r) paintRamp(g, lx * S, ly * S, r, x, y, get, pal);
        continue;
      }
      paintTile(g, lx * S, ly * S, id, x, y, get, pal);
    }
  }
  return canvas;
}

function natural(get, x, y) {
  const d = tileDef(get(x, y));
  return d.solid && d.natural;
}

// Une colonne naturelle dont le sommet est exactement à la ligne y
function naturalTop(get, x, y) {
  return natural(get, x, y) && !tileDef(get(x, y - 1)).solid && get(x, y - 1) !== T.WATER;
}

// Hauteurs (en pixels depuis le bas de la case) du talus dessiné dans une case d'air
// posée sur un sol naturel, quand une colonne voisine est plus haute d'une tuile.
export function rampAt(get, x, y) {
  if (get(x, y) !== T.AIR || !natural(get, x, y + 1)) return 0;
  const hl = naturalTop(get, x - 1, y) ? 8 : 0;
  const hr = naturalTop(get, x + 1, y) ? 8 : 0;
  if (!hl && !hr) return 0;
  return { hl, hr };
}

function paintRamp(g, px, py, r, x, y, get, pal) {
  const id = get(x, y + 1);
  const d = tileDef(id);
  const c = scale(pal(d.mat, x, y), 0.97);
  g.fillStyle = css(c);
  g.beginPath();
  g.moveTo(px, py + S - r.hl);
  g.lineTo(px + S, py + S - r.hr);
  g.lineTo(px + S, py + S);
  g.lineTo(px, py + S);
  g.closePath();
  g.fill();
  const rim = id === T.MOSSROCK ? pal('moss', x, y) : c;
  g.strokeStyle = css(scale(rim, 1.22));
  g.lineWidth = 2;
  g.beginPath();
  g.moveTo(px, py + S - r.hl + 1);
  g.lineTo(px + S, py + S - r.hr + 1);
  g.stroke();
}

function bgColor(b, x, y, pal) {
  const wall = pal('bgwall', x, y);
  const key =
    b === BG.ROCK ? 'rock' : b === BG.CONCRETE ? 'concrete' : b === BG.METAL ? 'metal' : b === BG.BRICK ? 'brick'
      : b === BG.PIPES ? 'pipe' : b === BG.ORGANIC ? 'organic' : b === BG.SAND ? 'sand' : 'wood';
  return scale(mix(pal(key, x, y), wall, 0.55), 0.62);
}

function paintBg(g, px, py, b, x, y, src, pal) {
  const c = bgColor(b, x, y, pal);
  const h = hash2(x, y, 7);
  g.fillStyle = css(scale(c, 0.94 + h * 0.1));
  g.fillRect(px, py, S, S);
  const dark = css(scale(c, 0.78));
  const light = css(scale(c, 1.12));
  switch (b) {
    case BG.CONCRETE:
      g.fillStyle = dark;
      if (x % 3 === 0) g.fillRect(px, py, 1, S);
      if (y % 4 === 0) g.fillRect(px, py, S, 1);
      if (h > 0.8) g.fillRect(px + 4, py + 6, 6, 1);
      if (h < 0.15) {
        // coulure
        g.fillStyle = css(scale(c, 0.85));
        g.fillRect(px + Math.floor(h * 80) % 12, py, 2, S);
      }
      break;
    case BG.METAL:
      g.fillStyle = dark;
      g.fillRect(px, py + S - 1, S, 1);
      g.fillRect(px + S - 1, py, 1, S);
      g.fillStyle = light;
      g.fillRect(px + 2, py + 2, 1, 1);
      g.fillRect(px + S - 4, py + 2, 1, 1);
      break;
    case BG.BRICK:
      g.fillStyle = dark;
      for (let r = 0; r < 4; r++) {
        g.fillRect(px, py + r * 4 + 3, S, 1);
        const off = (r + y * 4) % 2 ? 0 : 4;
        g.fillRect(px + off, py + r * 4, 1, 3);
        g.fillRect(px + off + 8, py + r * 4, 1, 3);
      }
      break;
    case BG.PIPES:
      g.fillStyle = dark;
      g.fillRect(px + 2, py, 5, S);
      g.fillStyle = light;
      g.fillRect(px + 3, py, 1, S);
      g.fillStyle = dark;
      g.fillRect(px + 10, py, 3, S);
      if (y % 5 === 0) {
        g.fillStyle = light;
        g.fillRect(px + 1, py + 4, 7, 2);
      }
      break;
    case BG.ORGANIC:
      g.fillStyle = dark;
      g.beginPath();
      g.moveTo(px + h * 16, py);
      g.quadraticCurveTo(px + 8, py + 8, px + (1 - h) * 16, py + S);
      g.lineTo(px + (1 - h) * 16 + 2, py + S);
      g.quadraticCurveTo(px + 10, py + 8, px + h * 16 + 2, py);
      g.fill();
      break;
    case BG.WOOD:
      g.fillStyle = dark;
      g.fillRect(px, py + 7, S, 1);
      g.fillRect(px, py + 15, S, 1);
      if (h > 0.5) g.fillRect(px + 6, py, 1, 7);
      break;
    default:
      if (h > 0.7) {
        g.fillStyle = dark;
        g.fillRect(px + Math.floor(h * 13) % 13, py + Math.floor(h * 7) % 13, 3, 2);
      }
  }
  // Ombre portée sous une tuile solide
  if (tileDef(src.get(x, y - 1)).solid) {
    g.fillStyle = 'rgba(0,0,0,0.28)';
    g.fillRect(px, py, S, 5);
  }
  if (tileDef(src.get(x - 1, y)).solid) {
    g.fillStyle = 'rgba(0,0,0,0.18)';
    g.fillRect(px, py, 3, S);
  }
}

function paintTile(g, px, py, id, x, y, get, pal) {
  const d = tileDef(id);
  const h = hash2(x, y, 3);
  const c0 = pal(d.mat, x, y);
  const c = scale(c0, 0.93 + h * 0.12);
  const sAbove = tileDef(get(x, y - 1));
  const sBelow = tileDef(get(x, y + 1));
  const sLeft = tileDef(get(x - 1, y));
  const sRight = tileDef(get(x + 1, y));
  const openT = !sAbove.solid;
  const openB = !sBelow.solid;
  const openL = !sLeft.solid;
  const openR = !sRight.solid;

  if (d.solid && d.natural) {
    // Pentes douces vers une colonne voisine plus basse d'une tuile, sinon coins arrondis
    const slopeL = openT && openL && natural(get, x - 1, y + 1);
    const slopeR = openT && openR && natural(get, x + 1, y + 1);
    const yl = slopeL ? 8 : 0;
    const yr = slopeR ? 8 : 0;
    const r = id === T.SAND ? 7 : id === T.RUBBLE ? 4 : 5;
    const tl = openT && openL && !slopeL ? r : 0;
    const tr = openT && openR && !slopeR ? r : 0;
    const br = openB && openR ? r : 0;
    const bl = openB && openL ? r : 0;
    g.fillStyle = css(c);
    g.beginPath();
    g.moveTo(px + tl, py + yl);
    g.lineTo(px + S - tr, py + yr);
    g.lineTo(px + S, py + tr + yr);
    g.lineTo(px + S, py + S - br);
    g.lineTo(px + S - br, py + S);
    g.lineTo(px + bl, py + S);
    g.lineTo(px, py + S - bl);
    g.lineTo(px, py + tl + yl);
    g.closePath();
    g.fill();
    // Grain
    const dark = css(scale(c, 0.82));
    const light = css(scale(c, 1.12));
    for (let k = 0; k < 4; k++) {
      const hx = hash2(x * 5 + k, y * 3, 11);
      const hy = hash2(x * 7, y * 5 + k, 13);
      g.fillStyle = k % 2 ? dark : light;
      g.fillRect(px + 2 + Math.floor(hx * 11), py + 3 + Math.floor(hy * 10), id === T.RUBBLE ? 3 : 1, id === T.RUBBLE ? 2 : 1);
    }
    if (id === T.ROCK || id === T.BEDROCK) {
      g.fillStyle = dark;
      if (h > 0.6) g.fillRect(px + 3, py + 5 + Math.floor(h * 6), 9, 1);
      if (h < 0.2) g.fillRect(px + 8, py + 2, 1, 6);
    }
    if (id === T.SAND && h > 0.5) {
      g.fillStyle = dark;
      g.fillRect(px + 1, py + 9 + Math.floor(h * 4), 10, 1);
    }
    if (id === T.BONE) {
      g.fillStyle = css(scale(c, 0.75));
      g.fillRect(px, py + 5, S, 2);
      g.fillRect(px, py + 11, S, 1);
    }
    if (id === T.ORGANIC || id === T.ROOT) {
      g.fillStyle = css(scale(c, 0.7));
      g.beginPath();
      g.arc(px + 4 + h * 8, py + 8, 2 + h * 2, 0, Math.PI * 2);
      g.fill();
      g.fillStyle = css(scale(c, 1.2));
      g.fillRect(px + 3 + h * 8, py + 6, 1, 1);
    }
    if (id === T.DEADWOOD) {
      g.fillStyle = dark;
      g.fillRect(px + 4, py, 1, S);
      g.fillRect(px + 10, py, 1, S);
    }
    // Lisière éclairée
    if (openT) {
      const rim = id === T.MOSSROCK ? pal('moss', x, y) : id === T.SOIL ? pal('soil', x, y) : c;
      if (yl || yr) {
        g.strokeStyle = css(scale(rim, id === T.MOSSROCK ? 1.25 : 1.22));
        g.lineWidth = 2;
        g.beginPath();
        g.moveTo(px + tl, py + yl + 1);
        g.lineTo(px + S - tr, py + yr + 1);
        g.stroke();
      } else {
        g.fillStyle = css(scale(rim, id === T.MOSSROCK ? 1.25 : 1.22));
        g.fillRect(px + tl, py, S - tl - tr, 2);
      }
      if (id === T.MOSSROCK) {
        g.fillStyle = css(scale(pal('moss', x, y), 1.0));
        g.fillRect(px + tl, py + 2, S - tl - tr, 2);
        if (h > 0.4) g.fillRect(px + 3 + Math.floor(h * 8), py + 4, 2, 3 + Math.floor(h * 4));
      }
    }
    if (openB) {
      g.fillStyle = css(scale(c, 0.7));
      g.fillRect(px + bl, py + S - 2, S - bl - br, 2);
    }
    if (openL && !slopeL) {
      g.fillStyle = css(scale(c, 0.88));
      g.fillRect(px, py + tl, 1, S - tl - bl);
    }
    if (openR && !slopeR) {
      g.fillStyle = css(scale(c, 0.8));
      g.fillRect(px + S - 1, py + tr, 1, S - tr - br);
    }
    return;
  }

  const dark = css(scale(c, 0.72));
  const darker = css(scale(c, 0.55));
  const light = css(scale(c, 1.18));
  switch (id) {
    case T.CONCRETE: {
      g.fillStyle = css(c);
      g.fillRect(px, py, S, S);
      g.fillStyle = dark;
      if (x % 4 === 0) g.fillRect(px, py, 1, S);
      if (y % 3 === 0) g.fillRect(px, py, S, 1);
      if (h > 0.75) {
        // fissure
        g.fillRect(px + 3, py + 4, 1, 5);
        g.fillRect(px + 4, py + 8, 1, 4);
        g.fillRect(px + 5, py + 11, 3, 1);
      }
      if (h < 0.25) {
        g.fillStyle = css(scale(c, 0.86));
        g.fillRect(px + 2 + Math.floor(h * 40), py, 2, S);
      }
      if (openT) {
        g.fillStyle = light;
        g.fillRect(px, py, S, 2);
      }
      if (openB) {
        g.fillStyle = darker;
        g.fillRect(px, py + S - 2, S, 2);
      }
      break;
    }
    case T.METAL:
    case T.TINWALL: {
      g.fillStyle = css(c);
      g.fillRect(px, py, S, S);
      if (id === T.TINWALL) {
        g.fillStyle = dark;
        for (let k = 1; k < S; k += 3) g.fillRect(px + k, py, 1, S);
        g.fillStyle = light;
        for (let k = 2; k < S; k += 3) g.fillRect(px + k, py, 1, S);
      } else {
        g.fillStyle = dark;
        g.fillRect(px, py + S - 1, S, 1);
        g.fillRect(px + S - 1, py, 1, S);
        g.fillStyle = light;
        g.fillRect(px, py, S, 1);
        g.fillRect(px + 2, py + 2, 1, 1);
        g.fillRect(px + S - 4, py + 2, 1, 1);
        g.fillRect(px + 2, py + S - 4, 1, 1);
        g.fillRect(px + S - 4, py + S - 4, 1, 1);
        if (h > 0.7) {
          g.fillStyle = css(pal('rust', x, y), 0.6);
          g.fillRect(px + 4, py + 6, 5 + Math.floor(h * 4), 4);
        }
      }
      if (openT) {
        g.fillStyle = light;
        g.fillRect(px, py, S, 2);
      }
      break;
    }
    case T.SCRAP:
    case T.GEARBOX: {
      const rust = pal('rust', x, y);
      const metal = pal('metal', x, y);
      g.fillStyle = css(mix(metal, rust, 0.6));
      // bord supérieur déchiqueté
      g.beginPath();
      if (openT) {
        g.moveTo(px, py + 2 + h * 3);
        g.lineTo(px + 5, py + h * 2);
        g.lineTo(px + 9, py + 3);
        g.lineTo(px + 13, py + 1 + h * 2);
        g.lineTo(px + S, py + 2);
      } else {
        g.moveTo(px, py);
        g.lineTo(px + S, py);
      }
      g.lineTo(px + S, py + S);
      g.lineTo(px, py + S);
      g.closePath();
      g.fill();
      g.fillStyle = css(rust);
      g.fillRect(px + 2 + Math.floor(h * 6), py + 5, 6, 4);
      g.fillRect(px + 8, py + 10 + Math.floor(h * 3), 5, 3);
      g.fillStyle = css(scale(rust, 1.3));
      g.fillRect(px + 3 + Math.floor(h * 6), py + 6, 2, 1);
      g.fillStyle = css(scale(metal, 0.6));
      g.fillRect(px + 1, py + 12, 4, 1);
      g.fillRect(px + 11, py + 4, 1, 5);
      if (id === T.GEARBOX) {
        g.strokeStyle = css(scale(metal, 1.25));
        g.lineWidth = 2;
        g.beginPath();
        g.arc(px + 8, py + 8, 4.5, 0, Math.PI * 2);
        g.stroke();
        g.fillStyle = css(scale(metal, 1.25));
        for (let k = 0; k < 6; k++) {
          const a = (k / 6) * Math.PI * 2 + h;
          g.fillRect(px + 7 + Math.cos(a) * 6.5, py + 7 + Math.sin(a) * 6.5, 2, 2);
        }
      }
      break;
    }
    case T.BRICK: {
      g.fillStyle = css(c);
      g.fillRect(px, py, S, S);
      g.fillStyle = dark;
      for (let r = 0; r < 4; r++) {
        g.fillRect(px, py + r * 4 + 3, S, 1);
        const off = (r + y * 4) % 2 ? 0 : 4;
        g.fillRect(px + off, py + r * 4, 1, 3);
        g.fillRect(px + off + 8, py + r * 4, 1, 3);
      }
      if (openT) {
        g.fillStyle = light;
        g.fillRect(px, py, S, 1);
      }
      break;
    }
    case T.PIPE: {
      const horiz = get(x - 1, y) === T.PIPE || get(x + 1, y) === T.PIPE;
      const vert = get(x, y - 1) === T.PIPE || get(x, y + 1) === T.PIPE;
      g.fillStyle = css(scale(c, 0.6));
      g.fillRect(px, py, S, S);
      g.fillStyle = css(c);
      if (horiz || !vert) {
        g.fillRect(px, py + 2, S, 12);
        g.fillStyle = light;
        g.fillRect(px, py + 4, S, 2);
        g.fillStyle = dark;
        g.fillRect(px, py + 11, S, 2);
        if (x % 3 === 0) {
          g.fillStyle = css(scale(c, 1.05));
          g.fillRect(px + 6, py + 1, 3, 14);
          g.fillStyle = darker;
          g.fillRect(px + 9, py + 1, 1, 14);
        }
      }
      if (vert) {
        g.fillStyle = css(c);
        g.fillRect(px + 2, py, 12, S);
        g.fillStyle = light;
        g.fillRect(px + 4, py, 2, S);
        g.fillStyle = dark;
        g.fillRect(px + 11, py, 2, S);
        if (y % 3 === 0) {
          g.fillStyle = css(scale(c, 1.05));
          g.fillRect(px + 1, py + 6, 14, 3);
        }
      }
      if (h > 0.8) {
        g.fillStyle = css(pal('rust', x, y), 0.7);
        g.fillRect(px + 3, py + 7, 4, 3);
      }
      break;
    }
    case T.GIRDER: {
      g.fillStyle = css(c);
      g.fillRect(px, py, S, 3);
      g.fillRect(px, py + S - 3, S, 3);
      g.lineWidth = 2;
      g.strokeStyle = css(c);
      g.beginPath();
      if ((x + y) % 2) {
        g.moveTo(px, py + 2);
        g.lineTo(px + S, py + S - 2);
      } else {
        g.moveTo(px, py + S - 2);
        g.lineTo(px + S, py + 2);
      }
      g.stroke();
      g.fillStyle = light;
      g.fillRect(px, py, S, 1);
      g.fillStyle = dark;
      g.fillRect(px + 1, py + 1, 1, 1);
      g.fillRect(px + 13, py + 1, 1, 1);
      break;
    }
    case T.GLASS: {
      g.fillStyle = css(c, 0.35);
      g.fillRect(px, py, S, S);
      g.fillStyle = css(scale(c, 1.3), 0.5);
      g.fillRect(px + 3, py + 2, 1, 8);
      g.fillRect(px + 5, py + 2, 1, 4);
      g.strokeStyle = css(scale(c, 0.6));
      g.lineWidth = 1;
      g.strokeRect(px + 0.5, py + 0.5, S - 1, S - 1);
      break;
    }
    case T.PLATFORM:
    case T.GRATE: {
      g.fillStyle = css(c);
      g.fillRect(px, py, S, 3);
      g.fillStyle = light;
      g.fillRect(px, py, S, 1);
      g.fillStyle = dark;
      if (id === T.GRATE) for (let k = 1; k < S; k += 3) g.fillRect(px + k, py + 1, 1, 2);
      g.fillRect(px + 3, py + 3, 2, 3);
      g.fillRect(px + 11, py + 3, 2, 3);
      break;
    }
    case T.PLANK: {
      const wood = pal('wood', x, y);
      g.fillStyle = css(scale(wood, 1.1));
      g.fillRect(px, py, S, 4);
      g.fillStyle = css(scale(wood, 1.35));
      g.fillRect(px, py, S, 1);
      g.fillStyle = css(scale(wood, 0.7));
      g.fillRect(px + 7, py, 1, 4);
      g.fillRect(px + 2, py + 4, 1, 3);
      g.fillRect(px + 13, py + 4, 1, 3);
      break;
    }
    case T.LADDER:
    case T.BUILT_LADDER: {
      const col = id === T.LADDER ? c : pal('wood', x, y);
      g.fillStyle = css(col);
      g.fillRect(px + 2, py, 2, S);
      g.fillRect(px + 12, py, 2, S);
      for (let k = 2; k < S; k += 5) g.fillRect(px + 2, py + k, 12, 2);
      g.fillStyle = css(scale(col, 1.3));
      g.fillRect(px + 2, py, 1, S);
      break;
    }
    case T.CHAIN: {
      g.strokeStyle = css(c);
      g.lineWidth = 2;
      for (let k = 0; k < S; k += 6) {
        if ((k / 6 + y) % 2) g.strokeRect(px + 6, py + k, 4, 6);
        else g.fillRect(px + 7, py + k, 2, 6);
      }
      g.fillStyle = css(c);
      break;
    }
    case T.VINE: {
      const plant = pal('plant', x, y);
      g.strokeStyle = css(scale(plant, 0.7));
      g.lineWidth = 2;
      g.beginPath();
      const ox = 8 + Math.sin(y * 1.3) * 3;
      g.moveTo(px + ox, py);
      g.quadraticCurveTo(px + 8 + Math.sin(y * 1.3 + 1) * 5, py + 8, px + 8 + Math.sin((y + 1) * 1.3) * 3, py + S);
      g.stroke();
      g.fillStyle = css(plant);
      if (h > 0.3) g.fillRect(px + ox - 4, py + 4, 4, 2);
      if (h > 0.6) g.fillRect(px + ox + 1, py + 10, 4, 2);
      break;
    }
    case T.MEMBRANE: {
      g.fillStyle = css(c, 0.45);
      g.fillRect(px, py, S, S);
      g.strokeStyle = css(scale(c, 1.3), 0.8);
      g.lineWidth = 1;
      g.beginPath();
      g.moveTo(px + 4 + h * 4, py);
      g.lineTo(px + 6 + h * 4, py + S);
      g.moveTo(px + 11, py);
      g.lineTo(px + 10 - h * 3, py + S);
      g.stroke();
      break;
    }
    default: {
      g.fillStyle = css(c);
      g.fillRect(px, py, S, S);
    }
  }
}
