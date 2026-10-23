// Définition des tuiles du monde. Une tuile mesure TILE pixels de côté.

export const TILE = 16;

export const T = {
  AIR: 0,
  SAND: 1,
  ROCK: 2,
  BEDROCK: 3,
  CONCRETE: 4,
  METAL: 5,
  SCRAP: 6,
  RUBBLE: 7,
  PIPE: 8,
  PLATFORM: 9,
  LADDER: 10,
  VINE: 11,
  WATER: 12,
  DEADWOOD: 13,
  SOIL: 14,
  ORGANIC: 15,
  BRICK: 16,
  CHAIN: 17,
  PLANK: 18,
  TINWALL: 19,
  GRATE: 20,
  ROOT: 21,
  MEMBRANE: 22,
  GLASS: 23,
  BONE: 24,
  GIRDER: 25,
  BUILT_LADDER: 26,
  MOSSROCK: 27,
  GEARBOX: 28,
  TRUSS: 29,
};

// Arrière-plans (murs derrière le joueur)
export const BG = {
  NONE: 0,
  ROCK: 1,
  CONCRETE: 2,
  METAL: 3,
  BRICK: 4,
  PIPES: 5,
  ORGANIC: 6,
  SAND: 7,
  WOOD: 8,
};

const D = []; // propriétés indexées par identifiant

function def(id, props) {
  D[id] = Object.assign(
    {
      id,
      name: '',
      solid: false,
      oneWay: false,
      climb: false,
      liquid: false,
      natural: false,
      opaque: false,
      mat: 'rock',
      tool: null, // 'main' (outil du joueur) ou 'foreuse' (robots, colosses)
      time: 0, // secondes de travail pour démanteler
      yields: null, // ressources obtenues
      built: false, // construit par le joueur (récupérable)
    },
    props,
  );
}

def(T.AIR, { name: 'Air' });
def(T.SAND, { name: 'Sable', solid: true, natural: true, opaque: true, mat: 'sand', tool: 'foreuse', time: 0.6, yields: null });
def(T.ROCK, { name: 'Roche', solid: true, natural: true, opaque: true, mat: 'rock', tool: 'foreuse', time: 1.6, yields: { pierre: 1 } });
def(T.BEDROCK, { name: 'Socle', solid: true, natural: true, opaque: true, mat: 'bedrock' });
def(T.CONCRETE, { name: 'Béton ancien', solid: true, opaque: true, mat: 'concrete', tool: 'foreuse', time: 2.2, yields: { pierre: 1 } });
def(T.METAL, { name: 'Plaque de métal', solid: true, opaque: true, mat: 'metal' });
def(T.SCRAP, { name: 'Ferraille', solid: true, opaque: true, mat: 'rust', tool: 'main', time: 0.9, yields: { ferraille: 2 } });
def(T.RUBBLE, { name: 'Gravats', solid: true, natural: true, opaque: true, mat: 'rubble', tool: 'main', time: 0.7, yields: { pierre: 1 } });
def(T.PIPE, { name: 'Conduite', solid: true, opaque: true, mat: 'pipe' });
def(T.PLATFORM, { name: 'Passerelle', oneWay: true, mat: 'metal' });
def(T.LADDER, { name: 'Échelle', climb: true, mat: 'metal' });
def(T.VINE, { name: 'Liane', climb: true, mat: 'plant', tool: 'main', time: 0.4, yields: { fibre: 1, biomasse: 1 } });
def(T.WATER, { name: 'Eau', liquid: true, mat: 'water' });
def(T.DEADWOOD, { name: 'Bois mort', solid: true, natural: true, opaque: true, mat: 'wood', tool: 'main', time: 0.8, yields: { fibre: 2 } });
def(T.SOIL, { name: 'Terre', solid: true, natural: true, opaque: true, mat: 'soil', tool: 'foreuse', time: 0.6 });
def(T.ORGANIC, { name: 'Chair ancienne', solid: true, natural: true, opaque: true, mat: 'organic' });
def(T.BRICK, { name: 'Briques', solid: true, opaque: true, mat: 'brick', tool: 'foreuse', time: 1.4, yields: { pierre: 1 } });
def(T.CHAIN, { name: 'Chaîne', climb: true, mat: 'metal', tool: 'main', time: 1.2, yields: { ferraille: 1 } });
def(T.PLANK, { name: 'Plateforme', oneWay: true, mat: 'wood', built: true, tool: 'main', time: 0.3, yields: { fibre: 1 } });
def(T.TINWALL, { name: 'Mur de tôle', solid: true, opaque: true, mat: 'tin', built: true, tool: 'main', time: 0.4, yields: { ferraille: 1 } });
def(T.GRATE, { name: 'Grille', oneWay: true, mat: 'metal' });
def(T.ROOT, { name: 'Racine', solid: true, natural: true, opaque: true, mat: 'root', tool: 'main', time: 1.0, yields: { biomasse: 2 } });
def(T.MEMBRANE, { name: 'Membrane', climb: true, mat: 'organic', tool: 'main', time: 0.6, yields: { biomasse: 1 } });
def(T.GLASS, { name: 'Verre', solid: true, mat: 'glass' });
def(T.BONE, { name: 'Ossature', solid: true, natural: true, opaque: true, mat: 'bone', tool: 'foreuse', time: 2, yields: { pierre: 1 } });
def(T.GIRDER, { name: 'Poutre', solid: true, opaque: false, mat: 'girder' });
def(T.BUILT_LADDER, { name: 'Échelle', climb: true, mat: 'wood', built: true, tool: 'main', time: 0.3, yields: { fibre: 1 } });
def(T.MOSSROCK, { name: 'Roche moussue', solid: true, natural: true, opaque: true, mat: 'moss', tool: 'main', time: 0.8, yields: { biomasse: 1 } });
def(T.TRUSS, { name: 'Pilier', mat: 'girder' });
def(T.GEARBOX, { name: 'Mécanisme', solid: true, opaque: true, mat: 'rust', tool: 'main', time: 2.2, yields: { ferraille: 1, rouages: 1 } });

export const TILES = D;

export function tileDef(id) {
  return D[id] || D[0];
}
