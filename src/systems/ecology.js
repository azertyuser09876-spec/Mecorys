// Écologie : zones d'humidité, couverture végétale, populations animales et créatures visibles.
import { TILE, T, tileDef } from '../world/tiles.js';
import { CHUNK } from '../world/world.js';
import { regionAt, CONDUITES, paletteColor, REGIONS } from '../world/regions.js';
import { PLANTS, ANIMALS, inventName } from '../data/species.js';
import { moveBody, liquidAt } from '../world/physics.js';
import { hash2, hash1, clamp } from '../core/rng.js';
import { css, hex, scale, mix } from '../core/color.js';

export const ZW = 24; // largeur d'une zone en tuiles

export class Ecology {
  constructor(game) {
    this.game = game;
    this.zones = [];
    this.under = [];
    this.creatures = [];
    this.custom = {}; // espèces créées par le joueur
    this.timer = 0;
    this.spawnTimer = 0;
    this.surfCache = new Map();
    this.t = 0;
    this.bestiary = {};
  }

  init() {
    const world = this.game.world;
    const nz = Math.ceil(world.w / ZW);
    this.zones = [];
    this.under = [];
    for (let i = 0; i < nz; i++) {
      const cx = i * ZW + ZW / 2;
      const r = regionAt(cx, 0);
      this.zones.push({ i, layer: 'surface', base: r.humidity, boost: 0, perm: 0, plants: {}, fauna: {} });
      const u = cx >= CONDUITES.x0 && cx < CONDUITES.x1;
      this.under.push(u ? { i, layer: 'under', base: CONDUITES.humidity, boost: 0, perm: 0, plants: {}, fauna: {} } : null);
    }
    // La vie qui persiste : de la mousse dans la fonderie et les conduites
    for (const z of this.zones) {
      const r = regionAt(z.i * ZW + ZW / 2, 0);
      if (r.id === 'fonderie') z.plants.mousse = 0.18 + hash1(z.i, 3) * 0.2;
    }
    for (const z of this.under) if (z) z.plants.mousse = 0.3 + hash1(z.i, 4) * 0.2;
    world.listeners.push((x, y, old) => {
      if (old === -1) this.surfCache.clear();
      else this.surfCache.delete(Math.floor(x / CHUNK) + ',' + Math.floor(y / CHUNK));
    });
  }

  spawnNests(pois) {
    for (const p of pois) {
      if (p.type !== 'nest') continue;
      const z = this.zoneAt(p.x, p.y);
      if (z) z.fauna[p.species] = (z.fauna[p.species] || 0) + p.n;
    }
  }

  zoneAt(tx, ty) {
    const i = clamp(Math.floor(tx / ZW), 0, this.zones.length - 1);
    if (ty > CONDUITES.depth + 4 && this.under[i]) return this.under[i];
    return this.zones[i];
  }

  humidity(z) {
    let h = z.base + z.boost + z.perm;
    const g = this.game;
    const x = z.i * ZW + ZW / 2;
    if (g.flags.vanne && z.layer === 'surface' && x >= 520 && x < 870) h += 0.12;
    if (g.flags.vanne && z.layer === 'surface' && x < 520) h += 0.03;
    if (g.flags.irrigation && z.layer === 'surface' && x < 520) h += 0.28;
    if (g.flags.vanne && z.layer === 'surface' && x >= 886 && x < 1150) h -= 0.25;
    return clamp(h, 0, 1);
  }

  humidityAt(tx, ty = 0) {
    const z = this.zoneAt(tx, ty);
    return z ? this.humidity(z) : 0;
  }

  speciesDef(id) {
    return PLANTS[id] || ANIMALS[id] || this.custom[id];
  }

  plant(id, tx, ty, amount = 0.08) {
    const z = this.zoneAt(tx, ty);
    if (!z) return false;
    z.plants[id] = Math.max(z.plants[id] || 0, amount);
    return z;
  }

  release(id, tx, ty, n) {
    const z = this.zoneAt(tx, ty);
    if (!z) return false;
    z.fauna[id] = (z.fauna[id] || 0) + n;
    this.spawnTimer = 0;
    return z;
  }

  boost(tx, ty, amount, permanent = 0) {
    const z = this.zoneAt(tx, ty);
    if (!z) return;
    z.boost = Math.min(0.6, z.boost + amount);
    z.perm = Math.min(0.6, z.perm + permanent);
  }

  // --- Simulation (toutes les 2 s) -----------------------------------------------------
  update(dt) {
    this.t += dt;
    this.timer -= dt;
    if (this.timer <= 0) {
      this.timer = 2;
      this.tick(2);
    }
    this.spawnTimer -= dt;
    if (this.spawnTimer <= 0) {
      this.spawnTimer = 1.5;
      this.manageCreatures();
    }
    for (const c of this.creatures) c.update(dt, this.game, this);
  }

  tick(dt) {
    const layers = [this.zones, this.under];
    for (const zs of layers) {
      for (let i = 0; i < zs.length; i++) {
        const z = zs[i];
        if (!z) continue;
        z.boost = Math.max(0, z.boost - dt * 0.0008);
        const h = this.humidity(z);
        // plantes
        for (const id in z.plants) {
          const P = this.speciesDef(id);
          if (!P) continue;
          let c = z.plants[id];
          let cap = clamp((h - P.humidity) / Math.max(0.05, P.humidity * 1.5) + 0.25, 0, 1);
          if (P.needs) cap = Math.min(cap, (z.plants[P.needs] || 0) * 1.2);
          const rate = (P.rate || 0.01) * dt;
          if (c < cap) c = Math.min(cap, c + rate * (0.3 + c));
          else c = Math.max(cap, c - rate * 0.6);
          z.plants[id] = c;
          // dispersion vers les voisins
          if (c > 0.45) {
            for (const j of [i - 1, i + 1]) {
              const n = zs[j];
              if (!n) continue;
              const hn = this.humidity(n);
              if (hn >= P.humidity && (n.plants[id] || 0) < 0.04 && Math.random() < 0.02 * dt) n.plants[id] = 0.05;
            }
          }
        }
        // animaux
        for (const id in z.fauna) {
          const A = this.speciesDef(id);
          if (!A) continue;
          let n = z.fauna[id];
          if (n <= 0) continue;
          const food = this.foodFor(z, A);
          const cap = Math.max(0, food * A.perZone);
          const humOk = !A.humidity || h >= A.humidity;
          if (n < cap && humOk) n += Math.min(cap - n, 0.02 * dt * Math.max(1, n));
          else if (n > cap || !humOk) n -= Math.min(n, 0.015 * dt * (n - cap + 1));
          // migration lente vers une zone voisine plus riche
          if (n > 1.5 && Math.random() < 0.01 * dt) {
            const j = Math.random() < 0.5 ? i - 1 : i + 1;
            const nb = zs[j];
            if (nb && this.foodFor(nb, A) > 0.2) {
              nb.fauna[id] = (nb.fauna[id] || 0) + 1;
              n -= 1;
            }
          }
          z.fauna[id] = n;
        }
      }
    }
  }

  foodFor(z, A) {
    if (!A.eats) return 0.5;
    if (PLANTS[A.eats] || (this.custom[A.eats] && this.custom[A.eats].plant)) return z.plants[A.eats] || 0;
    if (A.eats === 'insectes') return Math.min(1, ((z.fauna.coleo || 0) + this.customCount(z, 'petit')) / 6);
    if (A.eats === 'rouille') return 0.6;
    if (A.eats === 'herbe') return z.plants.herbe || 0;
    if (A.eats === 'mousse') return z.plants.mousse || 0;
    return Math.min(1, (z.fauna[A.eats] || 0) / 6);
  }

  customCount(z, size) {
    let n = 0;
    for (const id in z.fauna) if (this.custom[id] && this.custom[id].size === size) n += z.fauna[id];
    return n;
  }

  // Statistiques pour le carnet et la fin
  totals() {
    const plants = {};
    const fauna = {};
    for (const zs of [this.zones, this.under])
      for (const z of zs) {
        if (!z) continue;
        for (const id in z.plants) plants[id] = (plants[id] || 0) + z.plants[id];
        for (const id in z.fauna) fauna[id] = (fauna[id] || 0) + z.fauna[id];
      }
    return { plants, fauna };
  }

  greenRatio(x0, x1) {
    let s = 0;
    let n = 0;
    for (const z of this.zones) {
      const x = z.i * ZW;
      if (x < x0 || x >= x1) continue;
      s += Math.max(z.plants.herbe || 0, z.plants.mousse || 0, z.plants.arbre || 0);
      n++;
    }
    return n ? s / n : 0;
  }

  // --- Créatures visibles près de la caméra --------------------------------------------
  manageCreatures() {
    const cam = this.game.camera;
    const cx0 = Math.floor((cam.x - 200) / TILE);
    const cx1 = Math.floor((cam.x + cam.w + 200) / TILE);
    // retirer les créatures lointaines
    this.creatures = this.creatures.filter((c) => {
      const tx = c.x / TILE;
      if (tx < cx0 - 40 || tx > cx1 + 40) {
        return false;
      }
      return !c.dead;
    });
    const count = {};
    for (const c of this.creatures) {
      const k = c.zone.layer + c.zone.i + ':' + c.species;
      count[k] = (count[k] || 0) + 1;
    }
    for (let i = Math.max(0, Math.floor(cx0 / ZW)); i <= Math.min(this.zones.length - 1, Math.floor(cx1 / ZW)); i++) {
      for (const z of [this.zones[i], this.under[i]]) {
        if (!z) continue;
        for (const id in z.fauna) {
          const want = Math.min(Math.round(z.fauna[id]), (this.speciesDef(id) || {}).perZone || 4);
          const k = z.layer + z.i + ':' + id;
          let have = count[k] || 0;
          let tries = 0;
          while (have < want && tries++ < 6) {
            const c = this.spawnCreature(id, z);
            if (c) have++;
          }
        }
      }
    }
  }

  spawnCreature(id, z) {
    const A = this.speciesDef(id);
    const world = this.game.world;
    const tx = z.i * ZW + Math.floor(Math.random() * ZW);
    // trouver un sol dans la bonne couche
    let ty = -1;
    if (z.layer === 'under') {
      for (let y = CONDUITES.depth + 6; y < world.h - 4; y++) {
        if (!world.solid(tx, y) && world.solid(tx, y + 1) && !world.solid(tx, y - 1)) {
          ty = y;
          break;
        }
      }
    } else {
      const s = world.surface(tx);
      if (s < CONDUITES.depth + 4 && !world.liquid(tx, s - 1)) ty = s - 1;
      if (A.move === 'nage') {
        for (let y = 60; y < 200; y++)
          if (world.liquid(tx, y)) {
            ty = y + 2;
            break;
          }
      }
    }
    if (ty < 0) return null;
    // ne pas apparaître sous les yeux du joueur
    const p = this.game.player;
    if (Math.abs(tx * TILE - p.cx) < 60 && Math.abs(ty * TILE - p.cy) < 60) return null;
    const c = new Creature(id, A, tx * TILE + 8, (ty + 1) * TILE, z);
    if (A.move === 'vol') c.y -= 20 + Math.random() * 60;
    this.creatures.push(c);
    return c;
  }

  // --- Rendu ------------------------------------------------------------------------------
  surfaces(cx, cy) {
    const key = cx + ',' + cy;
    let s = this.surfCache.get(key);
    if (s) return s;
    const world = this.game.world;
    const top = [];
    const bottom = [];
    for (let y = cy * CHUNK; y < (cy + 1) * CHUNK; y++)
      for (let x = cx * CHUNK; x < (cx + 1) * CHUNK; x++) {
        const d = tileDef(world.get(x, y));
        if (!d.solid) continue;
        const up = world.get(x, y - 1);
        if (up === T.AIR || tileDef(up).climb) top.push(x, y, d.mat);
        if (world.get(x, y + 1) === T.AIR) bottom.push(x, y, d.mat);
      }
    s = { top, bottom };
    this.surfCache.set(key, s);
    return s;
  }

  forVisible(view, fn) {
    const cx0 = Math.max(0, Math.floor(view.x / (CHUNK * TILE)));
    const cy0 = Math.max(0, Math.floor(view.y / (CHUNK * TILE)));
    const cx1 = Math.floor((view.x + view.w) / (CHUNK * TILE));
    const cy1 = Math.floor((view.y + view.h) / (CHUNK * TILE));
    for (let cy = cy0; cy <= cy1; cy++) for (let cx = cx0; cx <= cx1; cx++) fn(this.surfaces(cx, cy));
  }

  drawBack(g, view) {
    // Arbres-conduits
    const tx0 = Math.floor(view.x / TILE) - 6;
    const tx1 = Math.floor((view.x + view.w) / TILE) + 6;
    const world = this.game.world;
    for (let tx = Math.max(0, tx0); tx <= tx1 && tx < world.w; tx++) {
      if (hash1(tx, 404) > 0.16) continue;
      const z = this.zones[Math.floor(tx / ZW)];
      const c = z ? z.plants.arbre || 0 : 0;
      if (c < 0.05) continue;
      if (hash1(tx, 405) > c * 1.4) continue;
      const ty = world.surface(tx);
      if (ty > CONDUITES.depth) continue;
      const mat = tileDef(world.get(tx, ty)).mat;
      if (!PLANTS.arbre.surfaces.includes(mat)) continue;
      drawTree(g, tx * TILE + 8, ty * TILE + world.slopeOffset(tx * TILE + 8, ty * TILE), c, hash1(tx, 406), this.t, this.game.env.wind);
    }
  }

  drawFront(g, view) {
    const t = this.t;
    const wind = this.game.env.wind;
    const grass = [];
    const moss = [];
    const hang = [];
    const flowers = [];
    const world = this.game.world;
    this.forVisible(view, (s) => {
      const top = s.top;
      for (let k = 0; k < top.length; k += 3) {
        const x = top[k];
        const y = top[k + 1];
        const mat = top[k + 2];
        const z = this.zoneAt(x, y);
        if (!z) continue;
        const ch = z.plants.herbe || 0;
        const cm = z.plants.mousse || 0;
        const off = world.slopeOffset(x * TILE + 8, y * TILE);
        if (ch > 0.02 && PLANTS.herbe.surfaces.includes(mat) && hash2(x, y, 51) < ch * 1.3) grass.push(x, y, ch, off);
        else if (cm > 0.02 && PLANTS.mousse.surfaces.includes(mat) && hash2(x, y, 52) < cm * 1.4) moss.push(x, y, off);
        if (ch > 0.55 && hash2(x, y, 53) < (ch - 0.5) * 0.6) flowers.push(x, y, off);
        for (const id in this.custom) {
          const P = this.custom[id];
          if (P.plant && (z.plants[id] || 0) > 0.05 && hash2(x, y, 60 + id.length) < z.plants[id]) flowers.push(x, y, off, P.color);
        }
      }
      const bottom = s.bottom;
      for (let k = 0; k < bottom.length; k += 3) {
        const x = bottom[k];
        const y = bottom[k + 1];
        const z = this.zoneAt(x, y);
        if (!z) continue;
        const cm = z.plants.mousse || 0;
        if (cm > 0.1 && hash2(x, y, 54) < cm * 0.7) hang.push(x, y);
      }
    });
    // herbe
    g.lineWidth = 1;
    for (let k = 0; k < grass.length; k += 4) {
      const x = grass[k] * TILE;
      const y = grass[k + 1] * TILE + grass[k + 3];
      const c = grass[k + 2];
      const col = paletteColor('plant', grass[k], grass[k + 1]);
      g.strokeStyle = css(mix(hex('#8a8048'), col, 0.4 + c * 0.5));
      g.beginPath();
      const n = 2 + Math.floor(c * 4);
      for (let b = 0; b < n; b++) {
        const bx = x + 2 + ((b * 5 + grass[k] * 3) % 13);
        const h = 3 + c * 7 + hash2(grass[k] + b, grass[k + 1], 9) * 4;
        const sway = Math.sin(t * 1.8 + bx * 0.15) * (1 + wind * 1.5);
        g.moveTo(bx, y + 1);
        g.quadraticCurveTo(bx + sway * 0.4, y - h * 0.5, bx + sway, y - h);
      }
      g.stroke();
    }
    // mousse
    for (let k = 0; k < moss.length; k += 3) {
      const x = moss[k];
      const y = moss[k + 1];
      g.fillStyle = css(paletteColor('moss', x, y));
      g.fillRect(x * TILE, y * TILE - 1 + moss[k + 2], TILE, 3);
      g.fillStyle = css(scale(paletteColor('moss', x, y), 1.25));
      const hx = Math.floor(hash2(x, y, 55) * 12);
      g.fillRect(x * TILE + hx, y * TILE - 2 + moss[k + 2], 3, 2);
    }
    for (let k = 0; k < hang.length; k += 2) {
      const x = hang[k];
      const y = hang[k + 1];
      g.fillStyle = css(scale(paletteColor('moss', x, y), 0.9));
      const len = 3 + Math.floor(hash2(x, y, 56) * 9);
      g.fillRect(x * TILE + 3 + Math.floor(hash2(x, y, 57) * 9), (y + 1) * TILE, 2, len);
    }
    for (let k = 0; k < flowers.length; k += 4) {
      const x = flowers[k] * TILE + 3 + Math.floor(hash2(flowers[k], flowers[k + 1], 58) * 10);
      const y = flowers[k + 1] * TILE + flowers[k + 2];
      const col = flowers[k + 3] || (hash2(flowers[k], 1, 59) > 0.5 ? '#e0c060' : '#d88a7a');
      g.fillStyle = '#6a8a4a';
      g.fillRect(x, y - 6, 1, 6);
      g.fillStyle = col;
      g.fillRect(x - 1, y - 8, 3, 3);
    }
    // lueurs des conduites
    this.forGlow(view, (x, y, k) => {
      const a = 0.5 + 0.3 * Math.sin(t * 1.3 + k);
      g.fillStyle = `rgba(150,230,190,${a.toFixed(3)})`;
      g.fillRect(x - 1, y, 2, 2);
      g.fillRect(x + 3, y + 1, 1, 1);
      g.fillRect(x - 4, y + 2, 1, 1);
    });
  }

  forGlow(view, fn) {
    this.forVisible(view, (s) => {
      const b = s.bottom;
      for (let k = 0; k < b.length; k += 3) {
        const x = b[k];
        const y = b[k + 1];
        if (y < CONDUITES.depth || x < CONDUITES.x0 || x > CONDUITES.x1) continue;
        if (hash2(x, y, 88) > 0.07) continue;
        fn(x * TILE + 8, (y + 1) * TILE, x + y);
      }
    });
  }

  lights(out, view) {
    let n = 0;
    this.forGlow(view, (x, y) => {
      if (n++ < 40) out.push({ x, y: y + 4, r: 42, i: 0.32 });
    });
    for (const c of this.creatures) if (c.glow) out.push({ x: c.x, y: c.y - 4, r: 30, i: 0.3 });
  }

  drawCreatures(g, view) {
    for (const c of this.creatures) if (c.x > view.x - 40 && c.x < view.x + view.w + 40 && c.y > view.y - 40 && c.y < view.y + view.h + 60) c.draw(g, this.game);
  }

  // Nouvelle espèce à partir de caractéristiques lisibles
  createSpecies(traits) {
    const seed = Math.floor(Math.random() * 1e6);
    const id = 'cree_' + seed;
    const sizeK = { petit: 0.7, moyen: 1, grand: 1.5 }[traits.taille];
    const habitatCol = { sable: '#c0a070', eau: '#6a8aa0', ruines: '#7a7a6a', souterrain: '#4a5a5a' }[traits.habitat];
    const def = {
      id,
      name: inventName(seed),
      custom: true,
      traits,
      size: traits.taille,
      move: traits.deplacement === 'grimpe' ? 'sol' : traits.deplacement,
      climbs: traits.deplacement === 'grimpe',
      eats: traits.alimentation === 'insectes' ? 'insectes' : traits.alimentation,
      temper: traits.temperament === 'territorial' ? 'territorial' : traits.temperament,
      perZone: traits.taille === 'grand' ? 3 : traits.taille === 'moyen' ? 5 : 8,
      humidity: traits.habitat === 'eau' ? 0.4 : traits.resistance === 'sécheresse' ? 0 : 0.05,
      color: habitatCol,
      scale: sizeK,
      glow: traits.aptitude === 'éclaire',
      legs: traits.deplacement === 'vol' ? 2 : traits.taille === 'petit' ? 6 : 4,
      desc: `Une espèce nouvelle, ${traits.taille}, qui vit dans ${{ sable: 'le sable', eau: 'l’eau', ruines: 'les ruines', souterrain: 'les souterrains' }[traits.habitat]} et se nourrit de ${traits.alimentation}.`,
    };
    this.custom[id] = def;
    return def;
  }

  toJSON() {
    const pack = (z) => (z ? { b: z.boost, p: z.perm, pl: z.plants, f: z.fauna } : null);
    return { zones: this.zones.map(pack), under: this.under.map(pack), custom: this.custom, bestiary: this.bestiary };
  }

  load(o) {
    if (!o) return;
    const unpack = (z, d) => {
      if (!z || !d) return;
      z.boost = d.b || 0;
      z.perm = d.p || 0;
      z.plants = d.pl || {};
      z.fauna = d.f || {};
    };
    o.zones.forEach((d, i) => unpack(this.zones[i], d));
    o.under.forEach((d, i) => unpack(this.under[i], d));
    this.custom = o.custom || {};
    this.bestiary = o.bestiary || {};
  }
}

function drawTree(g, x, y, c, h, t, wind) {
  const height = 20 + c * 50 + h * 20;
  const sway = Math.sin(t * 0.8 + x * 0.01) * (1 + wind) * 1.5;
  g.strokeStyle = '#4a3a2c';
  g.lineCap = 'round';
  g.lineWidth = 3 + c * 3;
  g.beginPath();
  g.moveTo(x, y + 2);
  g.quadraticCurveTo(x - 3, y - height * 0.5, x + sway, y - height);
  g.stroke();
  // conduit creux caractéristique
  g.strokeStyle = '#6a5440';
  g.lineWidth = 1;
  g.beginPath();
  g.moveTo(x + 1, y);
  g.lineTo(x + sway * 0.6 + 1, y - height * 0.8);
  g.stroke();
  // branches et feuillage
  const leaf = mix(hex('#4e6a34'), hex('#7a9a4a'), h);
  for (let k = 0; k < 5; k++) {
    const by = y - height * (0.45 + k * 0.12);
    const dir = k % 2 ? 1 : -1;
    const bx = x + sway * (0.5 + k * 0.1);
    g.strokeStyle = '#4a3a2c';
    g.lineWidth = 1.5;
    g.beginPath();
    g.moveTo(bx, by);
    g.lineTo(bx + dir * (8 + c * 8), by - 6);
    g.stroke();
    g.fillStyle = css(scale(leaf, 0.85 + k * 0.05));
    g.beginPath();
    g.ellipse(bx + dir * (9 + c * 8), by - 8, 7 + c * 6, 5 + c * 3, 0, 0, Math.PI * 2);
    g.fill();
  }
  g.fillStyle = css(scale(leaf, 1.1));
  g.beginPath();
  g.ellipse(x + sway, y - height - 4, 10 + c * 8, 7 + c * 4, 0, 0, Math.PI * 2);
  g.fill();
  g.lineCap = 'butt';
}

// --- Créature ---------------------------------------------------------------------------
class Creature {
  constructor(species, def, x, y, zone) {
    this.species = species;
    this.def = def;
    this.zone = zone;
    const k = def.scale || ({ petit: 0.6, moyen: 1, grand: 1.6 }[def.size] || 1);
    this.k = k;
    this.w = Math.round(8 * k);
    this.h = Math.round(6 * k + (def.size === 'grand' ? 10 : 2));
    this.x = x;
    this.y = y;
    this.bx = x - this.w / 2;
    this.by = y - this.h;
    this.vx = 0;
    this.vy = 0;
    this.facing = Math.random() < 0.5 ? -1 : 1;
    this.t = Math.random() * 10;
    this.state = 'wander';
    this.timer = 1 + Math.random() * 3;
    this.flying = def.move === 'vol';
    this.alt = 0;
    this.glow = !!def.glow;
    this.cool = 0;
  }

  update(dt, game, eco) {
    this.t += dt;
    this.timer -= dt;
    this.cool = Math.max(0, this.cool - dt);
    const p = game.player;
    const dx = p.cx - this.x;
    const dy = p.cy - this.y;
    const dist = Math.hypot(dx, dy);
    const temper = this.def.temper;
    const speed = (this.flying ? 50 : this.def.size === 'grand' ? 34 : this.def.size === 'petit' ? 22 : 30) * (this.def.custom ? 1 : 1);
    let target = 0;
    if ((temper === 'craintif' && dist < 90) || (temper === 'placide' && dist < 34)) {
      this.state = 'flee';
      this.timer = 1.5;
    } else if ((temper === 'agressif' || temper === 'territorial') && dist < 110 && this.cool <= 0 && Math.abs(dy) < 40) {
      this.state = 'charge';
    } else if (temper === 'curieux' && dist < 140 && dist > 40) this.state = 'approach';
    if (this.timer <= 0) {
      this.timer = 2 + Math.random() * 4;
      this.state = Math.random() < 0.5 ? 'wander' : 'idle';
      this.facing = Math.random() < 0.5 ? -1 : 1;
    }
    switch (this.state) {
      case 'flee':
        target = -Math.sign(dx) * speed * 2.2;
        break;
      case 'charge':
        target = Math.sign(dx) * speed * 2.6;
        if (dist < 14 && this.cool <= 0) {
          p.vx = Math.sign(dx) * 260;
          p.vy = -160;
          p.hurt = 0.6;
          p.stun = 0.4;
          game.camera.shake(3);
          game.audio && game.audio.sfx('hurt');
          this.cool = 3;
          this.state = 'flee';
          this.timer = 2;
        }
        break;
      case 'approach':
        target = Math.sign(dx) * speed * 0.8;
        break;
      case 'wander':
        target = this.facing * speed * 0.5;
        break;
      default:
        target = 0;
    }
    // rester dans sa zone
    const zx0 = this.zone.i * ZW * TILE;
    const zx1 = zx0 + ZW * TILE;
    if (this.state !== 'charge' && this.state !== 'flee') {
      if (this.x < zx0 - 30) target = Math.abs(target) || speed * 0.5;
      if (this.x > zx1 + 30) target = -(Math.abs(target) || speed * 0.5);
    }
    if (target) this.facing = Math.sign(target);
    if (this.flying) {
      // vol : planer, se poser parfois
      this.vx += (target - this.vx) * Math.min(1, dt * 2);
      const ground = game.world.surface(Math.floor(this.x / TILE)) * TILE;
      const want = this.state === 'idle' ? ground - 2 : ground - 50 - Math.sin(this.t * 0.7) * 20;
      this.vy += (Math.sign(want - this.y) * 40 - this.vy) * Math.min(1, dt * 2);
      this.x += this.vx * dt;
      this.y += this.vy * dt;
      if (this.y > ground - 1) this.y = ground - 1;
      this.perched = Math.abs(this.y - (ground - 1)) < 3;
      return;
    }
    this.vx += (target - this.vx) * Math.min(1, dt * 6);
    this.vy = Math.min(400, this.vy + 900 * dt);
    if (this.def.move === 'nage' && liquidAt(game.grids(), this.x, this.y - 2)) this.vy *= 0.8;
    this.bx = this.x - this.w / 2;
    this.by = this.y - this.h;
    const body = { x: this.bx, y: this.by, w: this.w, h: this.h, vx: this.vx, vy: this.vy, onGround: this.onGround };
    moveBody(body, dt, game.grids(), { stepUp: this.def.size === 'grand' ? 16 : 8 });
    if (body.hitWall && this.onGround) {
      if (this.def.climbs) body.vy = -60;
      else if (body.hitWall) {
        this.facing = -this.facing;
        if (this.state === 'wander') this.timer = 0.1;
      }
    }
    this.vx = body.vx;
    this.vy = body.vy;
    this.onGround = body.onGround;
    this.x = body.x + this.w / 2;
    this.y = body.y + this.h;
  }

  draw(g, game) {
    const d = this.def;
    const x = Math.round(this.x);
    const y = Math.round(this.y) + game.world.slopeOffset(this.x, this.y) * (this.onGround ? 1 : 0);
    const f = this.facing;
    const k = this.k;
    const moving = Math.abs(this.vx) > 3;
    const ph = this.t * (moving ? 14 : 2);
    g.save();
    g.translate(x, y);
    g.scale(f, 1);
    const col = d.color || '#888';
    switch (this.species) {
      case 'coleo': {
        g.fillStyle = '#2e342e';
        for (let i = 0; i < 3; i++) g.fillRect(-3 + i * 2.5, -1 + (moving ? Math.sin(ph + i * 2) * 0.6 : 0), 1, 2);
        g.fillStyle = col;
        g.beginPath();
        g.ellipse(0, -3, 4, 2.6, 0, 0, Math.PI * 2);
        g.fill();
        const open = Math.max(0, Math.sin(this.t * 3)) * 1.5;
        g.fillStyle = '#7a8a6a';
        g.fillRect(-2, -5.5 - open, 2, 1);
        g.fillRect(1, -5.5 - open * 0.7, 2, 1);
        g.fillStyle = '#1a1a1a';
        g.fillRect(3, -3.5, 1, 1);
        break;
      }
      case 'heron': {
        if (this.perched) {
          g.strokeStyle = '#5a5a5e';
          g.lineWidth = 1;
          g.beginPath();
          g.moveTo(-1, 0);
          g.lineTo(-1, -9);
          g.moveTo(2, 0);
          g.lineTo(1, -9);
          g.stroke();
          g.fillStyle = col;
          g.beginPath();
          g.ellipse(0, -11, 5, 3, -0.2, 0, Math.PI * 2);
          g.fill();
          g.strokeStyle = col;
          g.lineWidth = 2;
          g.beginPath();
          g.moveTo(3, -12);
          g.quadraticCurveTo(7, -15, 4, -19);
          g.stroke();
          g.fillStyle = '#c08a4a';
          g.fillRect(4, -20, 4, 1);
        } else {
          const flap = Math.sin(this.t * 9) * 5;
          g.fillStyle = col;
          g.beginPath();
          g.ellipse(0, -4, 6, 2.5, 0, 0, Math.PI * 2);
          g.fill();
          g.beginPath();
          g.moveTo(-2, -5);
          g.lineTo(-6, -5 - flap);
          g.lineTo(3, -5);
          g.fill();
          g.fillStyle = '#c08a4a';
          g.fillRect(6, -5, 3, 1);
        }
        break;
      }
      case 'brouteur': {
        g.strokeStyle = '#6a5a44';
        g.lineWidth = 1.5;
        const step = moving ? Math.sin(ph * 0.6) * 3 : 0;
        g.beginPath();
        g.moveTo(-5, -10);
        g.lineTo(-6 + step, 0);
        g.moveTo(-3, -10);
        g.lineTo(-2 - step, 0);
        g.moveTo(4, -10);
        g.lineTo(5 - step, 0);
        g.moveTo(6, -10);
        g.lineTo(7 + step, 0);
        g.stroke();
        g.fillStyle = col;
        g.beginPath();
        g.ellipse(0, -12, 9, 4.5, 0, 0, Math.PI * 2);
        g.fill();
        g.fillStyle = '#8a7458';
        g.beginPath();
        g.ellipse(-1, -15, 4, 2.5, 0, 0, Math.PI * 2);
        g.fill();
        const graze = this.state === 'idle' ? 6 : 0;
        g.strokeStyle = col;
        g.lineWidth = 2.5;
        g.beginPath();
        g.moveTo(7, -13);
        g.quadraticCurveTo(11, -18 + graze, 12, -20 + graze * 2.4);
        g.stroke();
        g.fillStyle = '#7a6448';
        g.fillRect(11, -22 + graze * 2.4, 4, 3);
        break;
      }
      case 'rodeur': {
        const breathe = 1 + Math.sin(this.t * 3) * 0.15;
        g.fillStyle = '#26262a';
        for (let i = 0; i < 4; i++) g.fillRect(-5 + i * 3, -2, 1.5, 2);
        g.fillStyle = col;
        g.beginPath();
        g.ellipse(0, -5, 7 * breathe, 4 * breathe, 0, 0, Math.PI * 2);
        g.fill();
        g.fillStyle = '#4a4a52';
        for (let i = -1; i <= 1; i++) g.fillRect(i * 3, -9 * breathe, 1, 6);
        g.fillStyle = this.state === 'charge' ? '#ff7050' : '#c0a060';
        g.fillRect(6, -6, 1.5, 1.5);
        g.fillRect(4, -6.5, 1, 1);
        break;
      }
      default:
        drawCustom(g, d, this, ph, moving);
    }
    g.restore();
  }
}

function drawCustom(g, d, c, ph, moving) {
  const k = d.scale || 1;
  const col = d.color || '#888';
  const legs = d.legs || 4;
  if (d.move === 'vol' && !c.perched) {
    const flap = Math.sin(c.t * 10) * 4 * k;
    g.fillStyle = col;
    g.beginPath();
    g.ellipse(0, -4 * k, 5 * k, 2.5 * k, 0, 0, Math.PI * 2);
    g.fill();
    g.beginPath();
    g.moveTo(-2 * k, -5 * k);
    g.lineTo(-5 * k, -5 * k - flap);
    g.lineTo(3 * k, -5 * k);
    g.fill();
  } else {
    g.strokeStyle = css(scale(hex(col), 0.6));
    g.lineWidth = Math.max(1, k);
    for (let i = 0; i < legs; i++) {
      const lx = -4 * k + (i * 8 * k) / Math.max(1, legs - 1);
      const st = moving ? Math.sin(ph + i * 1.7) * 2 * k : 0;
      g.beginPath();
      g.moveTo(lx, -4 * k);
      g.lineTo(lx + st, 0);
      g.stroke();
    }
    g.fillStyle = col;
    g.beginPath();
    g.ellipse(0, -6 * k, 6 * k, 3.5 * k, 0, 0, Math.PI * 2);
    g.fill();
    g.beginPath();
    g.arc(6 * k, -8 * k, 2.2 * k, 0, Math.PI * 2);
    g.fill();
  }
  g.fillStyle = d.glow ? '#b0ffd0' : '#1a1a1a';
  g.fillRect(6.5 * k, -8.5 * k, 1, 1);
  if (d.glow) {
    g.fillStyle = 'rgba(180,255,210,0.5)';
    g.fillRect(-2 * k, -9 * k, 4 * k, 2);
  }
}
