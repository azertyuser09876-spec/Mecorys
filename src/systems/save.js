// Sauvegarde : le monde généré est retrouvé par sa graine, seules les différences sont stockées.
import { TILE } from '../world/tiles.js';
import { Structure } from '../entities/structure.js';
import { Pickup } from '../entities/pickup.js';
import { Prop } from '../entities/prop.js';
import { Inventory } from './inventory.js';

export const SAVE_KEY = 'mecorys.save.v1';

function pack(arr) {
  // tableau d'octets -> chaîne compacte
  if (!arr) return '';
  let s = '';
  for (let i = 0; i < arr.length; i += 8192) s += String.fromCharCode.apply(null, arr.subarray(i, i + 8192));
  return btoa(s);
}
function unpack(str, len) {
  const out = new Uint8Array(len);
  if (!str) return out;
  const s = atob(str);
  for (let i = 0; i < s.length && i < len; i++) out[i] = s.charCodeAt(i);
  return out;
}

export function serialize(game) {
  const p = game.player;
  return {
    v: 1,
    seed: game.seed,
    savedAt: Date.now(),
    playTime: game.playTime,
    env: { hour: game.env.hour, day: game.env.day, time: game.env.time },
    player: { x: p.cx, y: p.y + p.h, look: p.look, lantern: p.lantern },
    respawn: game.respawnPoint,
    flags: game.flags,
    journal: game.journal,
    inv: game.inv.toJSON(),
    world: game.world.diff(),
    structures: game.structures.map((s) => s.toJSON()),
    pickups: game.entities.filter((e) => e.kind === 'pickup').map((e) => e.toJSON()),
    read: game.entities.filter((e) => e.kind === 'prop' && e.read).map((e) => e.uid),
    robots: game.robots.toJSON(),
    survivors: game.survivors.toJSON(),
    ecology: game.ecology.toJSON(),
    life: game.life.toJSON(),
    colossi: game.colossusSys.toJSON(),
    lieux: game.lieux.list.map((l) => ({ id: l.id, name: l.name, priority: l.priority })),
    explored: pack(game.explored),
  };
}

export function hasSave() {
  try {
    return !!localStorage.getItem(SAVE_KEY);
  } catch {
    return false;
  }
}

export function readSave() {
  try {
    const s = localStorage.getItem(SAVE_KEY);
    return s ? JSON.parse(s) : null;
  } catch {
    return null;
  }
}

export function writeSave(game) {
  const data = serialize(game);
  localStorage.setItem(SAVE_KEY, JSON.stringify(data));
  return data;
}

export function deleteSave() {
  try {
    localStorage.removeItem(SAVE_KEY);
  } catch {}
}

// Reconstruit une partie à partir d'une sauvegarde.
export function restore(game, d) {
  game.newWorld(d.seed);
  game.world.applyDiff(d.world);
  game.playTime = d.playTime || 0;
  Object.assign(game.env, d.env);
  game.flags = d.flags || {};
  game.journal = d.journal || [];
  game.inv = Inventory.from(d.inv);
  game.structures = [];
  for (const s of d.structures) {
    const st = new Structure(s.type, s.tx, s.floorY, { ruined: s.ruined, found: s.found, id: s.id, data: s.data });
    game.structures.push(st);
    st.checkCover(game.world);
  }
  game.entities = [];
  for (const pk of d.pickups) game.entities.push(new Pickup(pk.type, pk.x, pk.y, pk.data));
  const read = new Set(d.read || []);
  game.pois.forEach((p, i) => {
    if (p.type === 'lore') {
      const pr = new Prop('lore', p.x, p.y, { id: p.id });
      pr.uid = 'poi' + i;
      pr.read = read.has(pr.uid);
      game.entities.push(pr);
    } else if (p.type === 'prop') game.entities.push(new Prop(p.kind, p.x - Math.floor((p.w || 2) / 2), p.y, p));
  });
  game.ecology.load(d.ecology);
  game.robots.load(d.robots);
  game.survivors.load(d.survivors);
  game.life.load(d.life);
  game.colossusSys.load(d.colossi);
  game.lieux.rebuild();
  for (const l of d.lieux || []) {
    const L = game.lieux.list.find((q) => q.id === l.id);
    if (L) {
      L.name = l.name;
      L.priority = l.priority;
    }
  }
  game.respawnPoint = d.respawn || game.respawnPoint;
  game.player.look = d.player.look;
  game.player.lantern = !!d.player.lantern;
  game.player.teleport(d.player.x, d.player.y);
  const ew = Math.ceil(game.world.w / 8) * Math.ceil(game.world.h / 8);
  game.explored = unpack(d.explored, ew);
  game.camera.follow(game.player.cx, game.player.cy, 1, game.bounds(), 0, true);
}
