// Collisions entre boîtes (AABB) et grilles de tuiles : le monde et les colosses.
import { TILE, tileDef, T } from './tiles.js';

const EPS = 0.001;

// Une grille expose get(tx, ty) et un décalage en pixels (ox, oy).
function cellRange(g, x, y, w, h) {
  return [
    Math.floor((x - g.ox) / TILE),
    Math.floor((y - g.oy) / TILE),
    Math.floor((x + w - EPS - g.ox) / TILE),
    Math.floor((y + h - EPS - g.oy) / TILE),
  ];
}

export function boxBlocked(grids, x, y, w, h) {
  for (const g of grids) {
    const [tx0, ty0, tx1, ty1] = cellRange(g, x, y, w, h);
    for (let ty = ty0; ty <= ty1; ty++)
      for (let tx = tx0; tx <= tx1; tx++) if (tileDef(g.get(tx, ty)).solid) return true;
  }
  return false;
}

export function pointTile(grids, px, py) {
  // Renvoie la tuile non vide trouvée en priorité dans les colosses.
  for (let i = grids.length - 1; i >= 0; i--) {
    const g = grids[i];
    const id = g.get(Math.floor((px - g.ox) / TILE), Math.floor((py - g.oy) / TILE));
    if (id !== T.AIR) return { id, grid: g };
  }
  return { id: T.AIR, grid: grids[0] };
}

export function climbAt(grids, px, py) {
  for (const g of grids) {
    const id = g.get(Math.floor((px - g.ox) / TILE), Math.floor((py - g.oy) / TILE));
    if (tileDef(id).climb) return g;
  }
  return null;
}

export function liquidAt(grids, px, py) {
  for (const g of grids) {
    const id = g.get(Math.floor((px - g.ox) / TILE), Math.floor((py - g.oy) / TILE));
    if (tileDef(id).liquid) return true;
  }
  return false;
}

// Déplace un corps et résout les collisions axe par axe.
// body : { x, y, w, h, vx, vy } ; options : { stepUp (px), drop (traverse les passerelles) }
export function moveBody(body, dt, grids, opt = {}) {
  const stepUp = opt.stepUp || 0;
  body.hitWall = 0;
  body.hitCeil = false;
  const wasGround = body.onGround;
  body.onGround = false;
  body.groundRef = null;
  body.stepped = 0;

  // --- Axe horizontal
  let dx = body.vx * dt;
  if (dx !== 0) {
    const nx = body.x + dx;
    const hit = horizontalHit(grids, nx, body.y, body.w, body.h, dx);
    if (hit === null) body.x = nx;
    else {
      // Tentative de franchir une petite marche
      let climbed = false;
      if (stepUp > 0 && wasGround) {
        const lift = body.y + body.h - hit.top;
        if (lift > 0 && lift <= stepUp + 0.5 && !boxBlocked(grids, nx, body.y - lift, body.w, body.h)) {
          body.y -= lift;
          body.x = nx;
          body.stepped = lift;
          climbed = true;
        }
      }
      if (!climbed) {
        body.x = dx > 0 ? hit.edge - body.w : hit.edge;
        body.hitWall = dx > 0 ? 1 : -1;
        body.vx = 0;
      }
    }
  }

  // --- Axe vertical
  let dy = body.vy * dt;
  const prevBottom = body.y + body.h;
  const ny = body.y + dy;
  if (dy > 0) {
    let best = Infinity;
    let ref = null;
    for (const g of grids) {
      const [tx0, ty0, tx1, ty1] = cellRange(g, body.x, ny, body.w, body.h);
      for (let ty = ty0; ty <= ty1; ty++) {
        const top = ty * TILE + g.oy;
        for (let tx = tx0; tx <= tx1; tx++) {
          const d = tileDef(g.get(tx, ty));
          if (d.solid || (d.oneWay && !opt.drop && prevBottom <= top + 0.5)) {
            if (top < best) {
              best = top;
              ref = g;
            }
          }
        }
      }
    }
    if (best !== Infinity) {
      body.y = best - body.h;
      body.vy = 0;
      body.onGround = true;
      body.groundRef = ref;
    } else body.y = ny;
  } else if (dy < 0) {
    let best = -Infinity;
    for (const g of grids) {
      const [tx0, ty0, tx1, ty1] = cellRange(g, body.x, ny, body.w, body.h);
      for (let ty = ty0; ty <= ty1; ty++)
        for (let tx = tx0; tx <= tx1; tx++)
          if (tileDef(g.get(tx, ty)).solid) best = Math.max(best, (ty + 1) * TILE + g.oy);
    }
    if (best !== -Infinity) {
      body.y = best;
      body.vy = 0;
      body.hitCeil = true;
    } else body.y = ny;
  } else {
    // Immobile verticalement : vérifier le sol juste dessous.
    const g = groundBelow(grids, body, opt.drop);
    if (g) {
      body.onGround = true;
      body.groundRef = g;
    }
  }
  return body;
}

function horizontalHit(grids, x, y, w, h, dx) {
  let edge = dx > 0 ? Infinity : -Infinity;
  let top = Infinity;
  for (const g of grids) {
    const [tx0, ty0, tx1, ty1] = cellRange(g, x, y, w, h);
    for (let ty = ty0; ty <= ty1; ty++)
      for (let tx = tx0; tx <= tx1; tx++) {
        if (!tileDef(g.get(tx, ty)).solid) continue;
        const left = tx * TILE + g.ox;
        if (dx > 0) edge = Math.min(edge, left);
        else edge = Math.max(edge, left + TILE);
        top = Math.min(top, ty * TILE + g.oy);
      }
  }
  if (edge === Infinity || edge === -Infinity) return null;
  return { edge, top };
}

export function groundBelow(grids, body, drop = false) {
  const y = body.y + body.h + 0.5;
  for (const g of grids) {
    const ty = Math.floor((y - g.oy) / TILE);
    const tx0 = Math.floor((body.x - g.ox) / TILE);
    const tx1 = Math.floor((body.x + body.w - EPS - g.ox) / TILE);
    const top = ty * TILE + g.oy;
    if (Math.abs(top - (body.y + body.h)) > 1) continue;
    for (let tx = tx0; tx <= tx1; tx++) {
      const d = tileDef(g.get(tx, ty));
      if (d.solid || (d.oneWay && !drop)) return g;
    }
  }
  return null;
}
