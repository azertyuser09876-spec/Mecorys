// Recherche de chemin sur la grille de tuiles pour les robots (marche, marches, chutes, échelles, vol).
import { tileDef } from '../world/tiles.js';

export function findPath(world, sx, sy, goal, opt) {
  const H = opt.height || 1;
  const step = opt.stepUp || 0;
  const R = opt.radius || 70;
  const x0 = sx - R;
  const y0 = sy - R;
  const W = R * 2 + 1;
  const solid = (x, y) => tileDef(world.get(x, y)).solid;
  const support = (x, y) => {
    const d = tileDef(world.get(x, y));
    return d.solid || d.oneWay;
  };
  const climb = (x, y) => tileDef(world.get(x, y)).climb || (opt.swims && tileDef(world.get(x, y)).liquid);
  const free = (x, y) => {
    for (let k = 0; k < H; k++) if (solid(x, y - k)) return false;
    return true;
  };
  const stand = (x, y) => {
    if (!free(x, y)) return false;
    if (opt.flies) return true;
    return support(x, y + 1) || (opt.climbs && climb(x, y));
  };
  const key = (x, y) => (y - y0) * W + (x - x0);
  const inside = (x, y) => x >= x0 && y >= y0 && x < x0 + W && y < y0 + W;
  // point de départ : descendre jusqu'à une position valable
  let ty = sy;
  for (let k = 0; k < 6 && !stand(sx, ty); k++) ty++;
  if (!stand(sx, ty)) {
    ty = sy;
    for (let k = 0; k < 4 && !stand(sx, ty); k++) ty--;
    if (!stand(sx, ty)) return null;
  }
  const prev = new Int32Array(W * W).fill(-2);
  const q = [sx, ty];
  prev[key(sx, ty)] = -1;
  let found = -1;
  let head = 0;
  let n = 0;
  const push = (x, y, from) => {
    if (!inside(x, y)) return;
    const k = key(x, y);
    if (prev[k] !== -2) return;
    prev[k] = from;
    q.push(x, y);
  };
  while (head < q.length && n++ < 24000) {
    const x = q[head++];
    const y = q[head++];
    const k = key(x, y);
    if (opt.visit) opt.visit(x, y);
    if (goal(x, y)) {
      found = k;
      break;
    }
    if (opt.flies) {
      for (const [dx, dy] of [
        [1, 0],
        [-1, 0],
        [0, 1],
        [0, -1],
      ])
        if (free(x + dx, y + dy)) push(x + dx, y + dy, k);
      continue;
    }
    for (const dir of [-1, 1]) {
      const nx = x + dir;
      if (stand(nx, y)) push(nx, y, k);
      else if (!free(nx, y)) {
        // marche à franchir
        for (let s = 1; s <= step; s++) {
          if (solid(x, y - H - s + 1)) break;
          if (stand(nx, y - s)) {
            push(nx, y - s, k);
            break;
          }
        }
      } else {
        // chute (limitée à ce que le robot peut remonter, pour ne pas se piéger)
        for (let d = 1; d <= (opt.swims ? 200 : opt.maxDrop || 10); d++) {
          if (!free(nx, y + d)) break;
          if (opt.swims && d > (opt.maxDrop || 10) && !tileDef(world.get(nx, y + d)).liquid) continue;
          if (stand(nx, y + d)) {
            push(nx, y + d, k);
            break;
          }
        }
      }
    }
    // sauts par-dessus un trou (joueur)
    if (opt.jump && stand(x, y)) {
      for (const dir of [-1, 1]) {
        for (let d = 2; d <= opt.jump; d++) {
          if (!free(x + dir * (d - 1), y - 1)) break;
          if (stand(x + dir * d, y)) {
            push(x + dir * d, y, k);
            break;
          }
          if (stand(x + dir * d, y - 1) && free(x + dir * d, y - 2)) {
            push(x + dir * d, y - 1, k);
            break;
          }
        }
      }
    }
    if (opt.climbs) {
      if ((climb(x, y) || climb(x, y - 1)) && free(x, y - 1)) push(x, y - 1, k);
      if (climb(x, y + 1) || (climb(x, y) && stand(x, y + 1))) push(x, y + 1, k);
      // en haut d'une échelle, on se hisse sur la passerelle au-dessus
      if (climb(x, y) && !climb(x, y - 1)) for (let d = 1; d <= 2; d++) if (stand(x, y - d)) push(x, y - d, k);
      // depuis une passerelle, on descend l'échelle qui part dessous
      if (tileDef(world.get(x, y + 1)).oneWay && climb(x, y + 2)) push(x, y + 2, k);
    }
  }
  if (found < 0) return null;
  const path = [];
  let k = found;
  while (k >= 0) {
    path.push({ tx: (k % W) + x0, ty: Math.floor(k / W) + y0 });
    k = prev[k];
  }
  path.reverse();
  return path;
}
