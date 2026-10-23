// Modules de robots et plans trouvés dans le monde.

export const GRID_W = 7;
export const GRID_H = 5;
export const CELL = 6; // pixels du monde par case de robot

// pos : contrainte de placement ('bas' = rien dessous, 'haut' = rien dessus)
export const MODULES = {
  chassis: { name: 'Châssis', cat: 'Structure', weight: 1, cost: { ferraille: 1 }, desc: 'Relie les modules entre eux.' },
  noyau: { name: 'Noyau de commande', cat: 'Commande', weight: 1, energy: -0.5, cost: { ferraille: 2, rouages: 1 }, desc: 'Le cerveau du robot. Il en faut exactement un.' },
  ressort: { name: 'Batterie à ressort', cat: 'Énergie', weight: 1, energy: 2, cost: { ferraille: 2, rouages: 1 }, desc: 'Une énergie modeste et légère.' },
  chaudiere: { name: 'Petite chaudière', cat: 'Énergie', weight: 3, energy: 5, cost: { ferraille: 4, pierre: 2 }, desc: 'Beaucoup d’énergie, mais lourde.' },
  roue: { name: 'Roue', cat: 'Déplacement', weight: 1, carry: 4, pos: 'bas', loco: 'roue', cost: { ferraille: 2 }, desc: 'Rapide. Suit les pentes douces mais pas les vraies marches.' },
  chenille: { name: 'Chenille', cat: 'Déplacement', weight: 2, carry: 8, pos: 'bas', loco: 'chenille', cost: { ferraille: 3, rouages: 1 }, desc: 'Lente et robuste. Franchit des marches de deux cases.' },
  patte: { name: 'Patte', cat: 'Déplacement', weight: 1.5, carry: 6, pos: 'bas', loco: 'patte', cost: { ferraille: 2, rouages: 1 }, desc: 'Franchit deux marches et grimpe aux échelles.' },
  ballon: { name: 'Ballon à gaz', cat: 'Déplacement', weight: 0.5, lift: 4, pos: 'haut', loco: 'ballon', energy: -0.5, cost: { fibre: 4, ferraille: 1 }, desc: 'Fait voler un robot léger. Doit être au sommet.' },
  pince: { name: 'Pince', cat: 'Outil', weight: 1, energy: -0.5, tool: 'main', cost: { ferraille: 2 }, desc: 'Démonte la ferraille, les gravats, les lianes.' },
  foreuse: { name: 'Foreuse', cat: 'Outil', weight: 2, energy: -1.5, tool: 'foreuse', cost: { ferraille: 4, rouages: 1 }, desc: 'Creuse la roche, le sable et le béton.' },
  benne: { name: 'Benne', cat: 'Transport', weight: 1, cargo: 10, cost: { ferraille: 2, fibre: 1 }, desc: 'Transporte davantage de ressources.' },
  grue: { name: 'Bras de levage', cat: 'Transport', weight: 2, energy: -1, crane: true, cost: { ferraille: 4, rouages: 2 }, desc: 'Soulève les caisses de modules de colosse.' },
  arroseur: { name: 'Arroseur', cat: 'Outil', weight: 1, energy: -0.5, tool: 'eau', cost: { ferraille: 2, fibre: 2 }, desc: 'Humidifie le sol et disperse les graines connues.' },
  soudeuse: { name: 'Soudeuse', cat: 'Outil', weight: 1, energy: -1, tool: 'soudure', cost: { ferraille: 3, rouages: 1 }, desc: 'Participe aux chantiers et aux réparations.' },
  siege: { name: 'Siège de pilotage', cat: 'Commande', weight: 1, pos: 'haut', seat: true, cost: { fibre: 2, ferraille: 1 }, desc: 'Permet de monter dans la machine.' },
  blindage: { name: 'Blindage', cat: 'Structure', weight: 2, armor: 1, cost: { ferraille: 3 }, desc: 'Protège contre les chocs.' },
  lampe: { name: 'Lanterne', cat: 'Outil', weight: 0.5, energy: -0.3, light: true, cost: { ferraille: 1, fibre: 1 }, desc: 'Éclaire autour du robot.' },
};

export const MODULE_ORDER = ['chassis', 'noyau', 'ressort', 'chaudiere', 'roue', 'chenille', 'patte', 'ballon', 'pince', 'foreuse', 'benne', 'grue', 'arroseur', 'soudeuse', 'siege', 'blindage', 'lampe'];

// Modules disponibles dès le départ ; les autres se débloquent avec les plans trouvés.
export const START_MODULES = ['chassis', 'noyau', 'ressort', 'roue', 'pince', 'benne', 'lampe', 'siege'];

// Plans : grille de lignes, du haut vers le bas. '.' = vide.
const KEY = { C: 'chassis', N: 'noyau', R: 'ressort', H: 'chaudiere', o: 'roue', c: 'chenille', p: 'patte', b: 'ballon', P: 'pince', F: 'foreuse', B: 'benne', G: 'grue', A: 'arroseur', S: 'soudeuse', s: 'siege', X: 'blindage', L: 'lampe' };

function parse(rows) {
  const cells = [];
  rows.forEach((r, y) => [...r].forEach((ch, x) => KEY[ch] && cells.push({ x, y, m: KEY[ch] })));
  return cells;
}

export const FOUND_DESIGNS = {
  trotteur: {
    name: 'Trotteur',
    desc: 'Un petit récolteur à roues. Il démonte la ferraille et les gravats.',
    unlocks: [],
    cells: parse(['.L.', 'PNR', 'o.o']),
  },
  porteur: {
    name: 'Porteur',
    desc: 'Un transporteur à chenilles qu’on peut piloter, avec une grande benne.',
    unlocks: ['chenille', 'grue'],
    cells: parse(['..s..', 'BBNRR', 'CCCCC', 'c...c']),
  },
  foreur: {
    name: 'Foreur',
    desc: 'Un robot à pattes équipé d’une foreuse. Il creuse la roche et grimpe.',
    unlocks: ['patte', 'foreuse', 'chaudiere'],
    cells: parse(['.L..', 'FNHB', 'p..p']),
  },
  jardinier: {
    name: 'Jardinier',
    desc: 'Un robot volant qui humidifie le sol et disperse les graines.',
    unlocks: ['ballon', 'arroseur'],
    cells: parse(['.b.', 'ANR']),
  },
  soudeur: {
    name: 'Soudeur',
    desc: 'Un robot de chantier : il pose et soude les modules des colosses.',
    unlocks: ['soudeuse', 'blindage'],
    cells: parse(['.L..', 'SNRR', 'XCCX', 'c..c']),
  },
};
