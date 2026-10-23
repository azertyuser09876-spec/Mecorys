// Modules de colosses. Une case de module mesure 5×5 tuiles.
export const MOD = 5; // tuiles par case
export const CGRID_W = 8;
export const CGRID_H = 6;
export const LEG_ROWS = 14; // longueur nominale des jambes, en tuiles

export const CMODULES = {
  ossature: { name: 'Ossature', cat: 'Squelette', weight: 3, cost: { ferraille: 18, pierre: 10 }, work: 25, desc: 'La charpente qui relie tout. Légère et bon marché.' },
  commande: { name: 'Salle de commande', cat: 'Commande', weight: 3, energy: -2, cost: { ferraille: 24, rouages: 4 }, work: 45, desc: 'D’ici, on pilote le colosse. Il en faut une.' },
  chaudiere: { name: 'Chaudière colossale', cat: 'Organes', weight: 6, energy: 14, heat: 3, cost: { ferraille: 30, pierre: 20, rouages: 3 }, work: 55, desc: 'Le moteur du géant. Elle chauffe beaucoup.' },
  refroid: { name: 'Refroidissement', cat: 'Organes', weight: 2, heat: -4, cost: { ferraille: 16, rouages: 2 }, work: 30, desc: 'Ventilateurs et radiateurs. Évite la surchauffe.' },
  gyroscope: { name: 'Gyroscope', cat: 'Organes', weight: 4, energy: -2, balance: 1, cost: { ferraille: 28, rouages: 8 }, work: 60, desc: 'Garde l’équilibre d’un colosse à jambes.' },
  equilibre: { name: 'Organe d’équilibre', cat: 'Organes', weight: 1, balance: 1, organic: true, grown: true, desc: 'Un organe vivant, cultivé dans la Matrice. Plus léger qu’un gyroscope.' },
  coeur_org: { name: 'Cœur organique', cat: 'Organes', weight: 4, energy: 20, organic: true, ancient: true, desc: 'Un organe ancien qui produit sa propre énergie.' },
  memoire: { name: 'Mémoire organique', cat: 'Organes', weight: 2, organic: true, ancient: true, mind: true, desc: 'Un tissu nerveux ancien : instincts, souvenirs, volonté propre.' },
  jambe: { name: 'Jambe', cat: 'Déplacement', weight: 5, carry: 32, loco: 'jambe', energy: -3, pos: 'bas', cost: { ferraille: 36, rouages: 4 }, work: 60, desc: 'Marche sur tous les terrains. Demande un organe d’équilibre ou un gyroscope.' },
  chenille: { name: 'Chenille géante', cat: 'Déplacement', weight: 6, carry: 44, loco: 'chenille', energy: -4, pos: 'bas', cost: { ferraille: 42, pierre: 10, rouages: 3 }, work: 60, desc: 'Lente, très stable, porte énormément.' },
  bras: { name: 'Bras d’excavation', cat: 'Fonctions', weight: 5, energy: -4, fn: 'excavation', cost: { ferraille: 34, rouages: 4 }, work: 50, desc: 'Creuse la roche et le sable : canaux, passages, fondations.' },
  pont: { name: 'Pont déployable', cat: 'Fonctions', weight: 5, energy: -1, fn: 'pont', reach: 30, cost: { ferraille: 40, pierre: 10, rouages: 2 }, work: 50, desc: 'Un tablier replié qui se déploie sur 30 cases. On peut en cumuler.' },
  serre: { name: 'Serre ambulante', cat: 'Fonctions', weight: 4, energy: -2, fn: 'restauration', cost: { ferraille: 20, biomasse: 20, rouages: 2 }, work: 45, desc: 'Humidifie et ensemence les terres que le colosse traverse.' },
  reservoir: { name: 'Réservoir', cat: 'Fonctions', weight: 4, fn: 'eau', cost: { ferraille: 22, pierre: 8 }, work: 35, desc: 'Transporte de l’eau. Rend la serre ambulante bien plus efficace.' },
  habitat: { name: 'Habitat', cat: 'Fonctions', weight: 3, fn: 'base', cost: { ferraille: 16, fibre: 10 }, work: 35, desc: 'Des couchettes et un poêle : on peut s’y reposer et sauvegarder.' },
  canon: { name: 'Canon à vapeur', cat: 'Fonctions', weight: 5, energy: -3, fn: 'arme', cost: { ferraille: 30, rouages: 5 }, work: 50, desc: 'Une arme : un jet de vapeur qui pulvérise la roche devant le colosse.' },
  blindage: { name: 'Blindage', cat: 'Protection', weight: 4, armor: 1, cost: { ferraille: 26 }, work: 30, desc: 'Protège des chocs et des chutes de pierres.' },
};

export const CMOD_ORDER = ['ossature', 'commande', 'chaudiere', 'refroid', 'gyroscope', 'equilibre', 'jambe', 'chenille', 'bras', 'pont', 'serre', 'reservoir', 'habitat', 'canon', 'blindage'];

// Modules dont les plans viennent des archives de la cale
export const BASE_MODULES = ['ossature', 'commande', 'chaudiere', 'refroid', 'gyroscope', 'jambe', 'chenille', 'bras', 'pont', 'serre', 'reservoir', 'habitat', 'canon', 'blindage'];

const K = { O: 'ossature', C: 'commande', H: 'chaudiere', R: 'refroid', Y: 'gyroscope', E: 'equilibre', Q: 'coeur_org', M: 'memoire', J: 'jambe', T: 'chenille', B: 'bras', P: 'pont', S: 'serre', W: 'reservoir', A: 'habitat', N: 'canon', X: 'blindage' };

export function parseColossus(rows, states = {}) {
  const out = [];
  rows.forEach((r, y) =>
    [...r].forEach((ch, x) => {
      if (!K[ch]) return;
      out.push({ x, y, m: K[ch], state: states[x + ',' + y] || 'ok' });
    }),
  );
  return out;
}

// Le Dormeur : un colosse porteur et excavateur, enfoui dans les dunes.
export const DORMEUR = {
  name: 'Le Dormeur',
  rows: ['.OCO..', 'BHOAOO', 'ORERWO', 'J....J'],
  states: { '2,2': 'manquant', '5,3': 'endommage', '3,2': 'manquant', '1,1': 'endommage' },
};

// Le Gardien : autonome, sans salle de commande, mû par une mémoire organique.
export const GARDIEN = {
  name: 'Le Gardien',
  rows: ['.XMX.', 'XOQOX', 'OOOOO', 'J...J'],
  states: {},
};
