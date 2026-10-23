// Espèces vivantes. Les besoins restent simples et lisibles.

export const PLANTS = {
  mousse: {
    name: 'Mousse de rouille',
    desc: 'Pousse sur le métal et la pierre humides. Nourrit les petits insectes.',
    humidity: 0.1,
    surfaces: ['rock', 'metal', 'rust', 'concrete', 'pipe', 'brick', 'moss', 'rubble', 'bone', 'soil'],
    color: '#6f8a44',
    rate: 0.02,
  },
  herbe: {
    name: 'Herbe des dunes',
    desc: 'Tient le sable et donne des graines comestibles. Nourrit les brouteurs.',
    humidity: 0.07,
    surfaces: ['sand', 'soil', 'rubble', 'moss'],
    color: '#a2a85a',
    rate: 0.014,
    food: true,
  },
  arbre: {
    name: 'Arbre-conduit',
    desc: 'Un arbre aux racines creuses qui boit profondément. Il lui faut de l’herbe autour et beaucoup d’eau.',
    humidity: 0.28,
    surfaces: ['sand', 'soil', 'moss', 'rock'],
    color: '#5a7a3a',
    rate: 0.006,
    needs: 'herbe',
  },
};

export const ANIMALS = {
  coleo: {
    name: 'Coléoptère à valves',
    desc: 'Un insecte cuirassé qui respire par des valves. Il broute la mousse.',
    eats: 'mousse',
    size: 'petit',
    move: 'sol',
    temper: 'craintif',
    perZone: 10,
    color: '#5a6a5a',
  },
  heron: {
    name: 'Héron de rouille',
    desc: 'Un grand oiseau gris aux reflets ocre. Il chasse les insectes près de l’eau.',
    eats: 'coleo',
    size: 'moyen',
    move: 'vol',
    temper: 'craintif',
    perZone: 3,
    humidity: 0.35,
    color: '#8a8a8e',
  },
  brouteur: {
    name: 'Brouteur des dunes',
    desc: 'Un herbivore placide aux longues pattes. Il suit l’herbe.',
    eats: 'herbe',
    size: 'grand',
    move: 'sol',
    temper: 'placide',
    perZone: 4,
    color: '#a08a6a',
  },
  rodeur: {
    name: 'Rôdeur des conduites',
    desc: 'Un chasseur à soufflet qui vit dans le noir. Il bouscule les intrus.',
    eats: 'coleo',
    size: 'moyen',
    move: 'sol',
    temper: 'agressif',
    perZone: 1,
    color: '#3a3a40',
  },
};

// Caractéristiques combinables pour créer un être nouveau.
export const TRAITS = {
  taille: { label: 'Taille', options: ['petit', 'moyen', 'grand'] },
  habitat: { label: 'Habitat', options: ['sable', 'eau', 'ruines', 'souterrain'] },
  deplacement: { label: 'Déplacement', options: ['sol', 'vol', 'nage', 'grimpe'] },
  alimentation: { label: 'Alimentation', options: ['mousse', 'herbe', 'insectes', 'rouille'] },
  temperament: { label: 'Tempérament', options: ['craintif', 'placide', 'curieux', 'territorial'] },
  resistance: { label: 'Résistance', options: ['chaleur', 'froid', 'sécheresse', 'obscurité'] },
  aptitude: { label: 'Aptitude', options: ['pollinise', 'creuse', 'éclaire', 'nettoie la rouille'] },
};

const SYL = ['va', 'lo', 'ri', 'mé', 'sa', 'ka', 'té', 'no', 'ul', 'ar', 'is', 'du', 'pa', 'ven', 'rou', 'cor'];
export function inventName(seed) {
  let s = '';
  let n = 2 + (seed % 2);
  let k = seed;
  for (let i = 0; i < n; i++) {
    s += SYL[k % SYL.length];
    k = Math.floor(k / 7) + 13 * (i + 1);
  }
  return s.charAt(0).toUpperCase() + s.slice(1);
}
