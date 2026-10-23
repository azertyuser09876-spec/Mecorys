// Régions du monde de Mecorys, de l'ouest vers l'est.
import { hex, mix } from '../core/color.js';

export const WORLD_W = 2400; // en tuiles
export const WORLD_H = 240;

function pal(p) {
  const out = {};
  for (const k in p) out[k] = typeof p[k] === 'string' ? hex(p[k]) : p[k];
  return out;
}

export const REGIONS = [
  {
    id: 'desert',
    name: 'Les Dunes Muettes',
    x0: 0,
    x1: 520,
    weather: 'dust',
    music: { root: 50, scale: [0, 2, 3, 7, 9], mood: 0.2 },
    humidity: 0.02,
    pal: pal({
      skyTop: '#86a6c2', skyBottom: '#ead0a8', haze: '#e9c9a2',
      far: '#d2b598', mid: '#b48f70', near: '#8b6a52',
      sand: '#c99a5e', rock: '#8c6a4c', bedrock: '#4a3a2e', concrete: '#a09484', metal: '#5f636b',
      rust: '#94532e', rubble: '#8f7a64', wood: '#6e5440', plant: '#7c8a4a', soil: '#6b4a32',
      organic: '#8a5a50', brick: '#9a6248', pipe: '#6a6660', glass: '#9fb4b8', bone: '#d8cbb0',
      girder: '#54504a', tin: '#7d8288', moss: '#6f7a46', root: '#6a4a3a',
      bgwall: '#5a4a3c', water: '#3f7f8f',
    }),
  },
  {
    id: 'fonderie',
    name: 'La Fonderie Engloutie',
    x0: 520,
    x1: 860,
    weather: 'ash',
    music: { root: 45, scale: [0, 3, 5, 7, 10], mood: 0.4 },
    humidity: 0.12,
    pal: pal({
      skyTop: '#6c8786', skyBottom: '#bdb79c', haze: '#a9ab94',
      far: '#8f988b', mid: '#636f66', near: '#3e4842',
      sand: '#9a8a62', rock: '#56504a', bedrock: '#2c2a28', concrete: '#77726a', metal: '#4c5258',
      rust: '#84452a', rubble: '#6a625a', wood: '#5a4a3a', plant: '#56743c', soil: '#4a3c2c',
      organic: '#7a5048', brick: '#7c4a3a', pipe: '#5a5e5c', glass: '#86a09c', bone: '#c4bca4',
      girder: '#3e3e3c', tin: '#6e7478', moss: '#57703a', root: '#5a4434',
      bgwall: '#363a36', water: '#3a6a6a',
    }),
  },
  {
    id: 'reservoir',
    name: 'Le Grand Réservoir',
    x0: 860,
    x1: 1180,
    weather: 'mist',
    music: { root: 52, scale: [0, 2, 4, 7, 9], mood: 0.3 },
    humidity: 0.6,
    pal: pal({
      skyTop: '#627f9c', skyBottom: '#c6d0cf', haze: '#b4c2c4',
      far: '#9aabb2', mid: '#70858f', near: '#46565e',
      sand: '#a09a80', rock: '#5c646a', bedrock: '#2a3034', concrete: '#848a8a', metal: '#4e5a62',
      rust: '#8a4c30', rubble: '#6e7472', wood: '#5a4c40', plant: '#4e7448', soil: '#4a4436',
      organic: '#76505a', brick: '#7a5446', pipe: '#566268', glass: '#9cc0c8', bone: '#c8c4b4',
      girder: '#3c4448', tin: '#70787e', moss: '#4f7044', root: '#54463c',
      bgwall: '#343e44', water: '#2e6478',
    }),
  },
  {
    id: 'vallee',
    name: 'La Vallée des Colosses',
    x0: 1180,
    x1: 1580,
    weather: 'dust',
    music: { root: 43, scale: [0, 2, 3, 7, 8], mood: 0.6 },
    humidity: 0.08,
    pal: pal({
      skyTop: '#7a86aa', skyBottom: '#dac4b2', haze: '#cdb9ae',
      far: '#ab9fae', mid: '#80758a', near: '#524a5c',
      sand: '#b08e72', rock: '#6c6070', bedrock: '#342e3a', concrete: '#8e8890', metal: '#545a66',
      rust: '#8a4e36', rubble: '#7a6e74', wood: '#5e4e46', plant: '#6a7a4c', soil: '#54443c',
      organic: '#86525a', brick: '#865a4c', pipe: '#5e5e68', glass: '#a4b4c4', bone: '#d4c8bc',
      girder: '#44424c', tin: '#767a86', moss: '#62704a', root: '#5a463e',
      bgwall: '#3e3846', water: '#3c6a80',
    }),
  },
  {
    id: 'serre',
    name: 'La Serre-Matrice',
    x0: 1580,
    x1: 1900,
    weather: 'spores',
    music: { root: 48, scale: [0, 2, 4, 6, 9], mood: 0.5 },
    humidity: 0.3,
    pal: pal({
      skyTop: '#8a7c94', skyBottom: '#dcbcaa', haze: '#c9a8a0',
      far: '#b99c9e', mid: '#8c6c72', near: '#5a424a',
      sand: '#a88a74', rock: '#6a5458', bedrock: '#32262a', concrete: '#8c8086', metal: '#5a5662',
      rust: '#8a4a36', rubble: '#7a6468', wood: '#5e4844', plant: '#6a8050', soil: '#5a4038',
      organic: '#93505a', brick: '#8a5450', pipe: '#665a62', glass: '#c0b0c0', bone: '#dccabe',
      girder: '#463c44', tin: '#7a7480', moss: '#6a7a4e', root: '#6e4a44',
      bgwall: '#40343c', water: '#4a6a7a',
    }),
  },
  {
    id: 'abime',
    name: "L'Abîme",
    x0: 1900,
    x1: 2120,
    weather: 'mist',
    music: { root: 40, scale: [0, 1, 5, 7, 8], mood: 0.8 },
    humidity: 0.15,
    pal: pal({
      skyTop: '#3e4862', skyBottom: '#a0959e', haze: '#7e7884',
      far: '#6e6a7a', mid: '#4c4a58', near: '#2c2c36',
      sand: '#7a6e6a', rock: '#44424c', bedrock: '#1c1c22', concrete: '#6c6a72', metal: '#44485a',
      rust: '#7a4232', rubble: '#58545c', wood: '#4a3e3c', plant: '#566a4e', soil: '#3e3432',
      organic: '#7a4652', brick: '#6e4a46', pipe: '#4c4c58', glass: '#8c98ac', bone: '#bab4ae',
      girder: '#34343e', tin: '#62667a', moss: '#4e6046', root: '#4e3e3a',
      bgwall: '#2a2a32', water: '#2c4a60',
    }),
  },
  {
    id: 'coeur',
    name: 'Le Cœur',
    x0: 2120,
    x1: 2400,
    weather: 'motes',
    music: { root: 47, scale: [0, 2, 4, 7, 11], mood: 0.1 },
    humidity: 0.2,
    pal: pal({
      skyTop: '#4e5c7e', skyBottom: '#f0c894', haze: '#e0b08c',
      far: '#c89c8c', mid: '#946c6c', near: '#5c404a',
      sand: '#b88e6e', rock: '#6e5456', bedrock: '#30222a', concrete: '#968486', metal: '#5c5664',
      rust: '#8e4a34', rubble: '#7e6464', wood: '#604842', plant: '#7a8c52', soil: '#5e4236',
      organic: '#a2545c', brick: '#8e5650', pipe: '#6a5a62', glass: '#d0b8b8', bone: '#e4d2c2',
      girder: '#4a3c44', tin: '#7e7682', moss: '#728050', root: '#744a42',
      bgwall: '#42323a', water: '#4a6e82',
    }),
  },
];

// Réseau souterrain sous la fonderie et le réservoir.
export const CONDUITES = {
  id: 'conduites',
  name: 'Les Conduites',
  x0: 520,
  x1: 1180,
  depth: 150, // sous cette profondeur on est dans les conduites
  weather: 'drips',
  music: { root: 38, scale: [0, 3, 5, 6, 10], mood: 0.7 },
  humidity: 0.5,
  pal: pal({
    skyTop: '#1e2a2c', skyBottom: '#2c3a38', haze: '#26302f',
    far: '#202a2a', mid: '#1a2222', near: '#141a1a',
    sand: '#6a6450', rock: '#3c4240', bedrock: '#1a1e1e', concrete: '#5a5e5a', metal: '#3e464a',
    rust: '#74402a', rubble: '#50544e', wood: '#4a4034', plant: '#4a6a40', soil: '#3c3428',
    organic: '#6a4a48', brick: '#6a4434', pipe: '#4a5452', glass: '#7a9a96', bone: '#b0aa96',
    girder: '#2e3230', tin: '#5e6466', moss: '#4a6a3c', root: '#4a3a2e',
    bgwall: '#222a2a', water: '#2a5656',
  }),
};

const byId = {};
for (const r of REGIONS) byId[r.id] = r;
byId.conduites = CONDUITES;

export function regionById(id) {
  return byId[id];
}

export function regionAt(tx, ty = 0) {
  if (ty > CONDUITES.depth && tx >= CONDUITES.x0 && tx < CONDUITES.x1) return CONDUITES;
  for (const r of REGIONS) if (tx < r.x1) return r;
  return REGIONS[REGIONS.length - 1];
}

// Couleur de palette mélangée près des frontières pour éviter les cassures nettes.
const BLEND = 28;
export function paletteColor(key, tx, ty = 0) {
  const r = regionAt(tx, ty);
  if (r === CONDUITES) {
    const d = ty - CONDUITES.depth;
    if (d < 12) {
      const above = regionAt(tx, 0);
      return mix(above.pal[key], r.pal[key], Math.max(0, d) / 12);
    }
    return r.pal[key];
  }
  const i = REGIONS.indexOf(r);
  const c = r.pal[key];
  if (i > 0 && tx - r.x0 < BLEND) {
    const prev = REGIONS[i - 1];
    const t = 0.5 + (0.5 * (tx - r.x0)) / BLEND;
    return mix(prev.pal[key], c, t);
  }
  if (i < REGIONS.length - 1 && r.x1 - tx < BLEND) {
    const next = REGIONS[i + 1];
    const t = 0.5 * (1 - (r.x1 - tx) / BLEND);
    return mix(c, next.pal[key], t);
  }
  return c;
}
