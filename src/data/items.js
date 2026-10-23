// Ressources, échantillons biologiques et icônes dessinées.

export const RESOURCES = {
  ferraille: { name: 'Ferraille', color: '#a0643c', desc: 'Métal rouillé récupéré sur les épaves.' },
  pierre: { name: 'Pierre', color: '#a09888', desc: 'Pierre et béton concassés.' },
  fibre: { name: 'Fibre', color: '#b39a62', desc: 'Bois mort, lianes et fibres tressées.' },
  biomasse: { name: 'Biomasse', color: '#7d9a52', desc: 'Matière vivante ou morte, nourrit la technologie de vie.' },
  rouages: { name: 'Rouages', color: '#d0b070', desc: 'Pièces mécaniques précises, rares.' },
  vivres: { name: 'Vivres', color: '#d89a5a', desc: 'Nourriture pour les survivants.' },
};

export const RES_ORDER = ['ferraille', 'pierre', 'fibre', 'biomasse', 'rouages', 'vivres'];

// Échantillons : modèles exploitables par la technologie de vie.
export const SAMPLES = {
  graine_herbe: { name: 'Graine d’herbe des dunes', kind: 'plante', species: 'herbe', desc: 'Une capsule scellée contenant des graines encore viables.' },
  spore_mousse: { name: 'Spores de mousse de rouille', kind: 'plante', species: 'mousse', desc: 'Une poussière verte qui s’accroche au métal humide.' },
  graine_arbre: { name: 'Graine d’arbre-conduit', kind: 'plante', species: 'arbre', desc: 'Une graine lourde, cerclée de fibres ligneuses.' },
  oeuf_coleo: { name: 'Œuf de coléoptère à valves', kind: 'animal', species: 'coleo', desc: 'Petit, tiède, il vibre faiblement.' },
  oeuf_heron: { name: 'Œuf de héron de rouille', kind: 'animal', species: 'heron', desc: 'Une coquille grise tachée d’ocre.' },
  tissu_brouteur: { name: 'Tissu de brouteur', kind: 'animal', species: 'brouteur', desc: 'Prélevé sur un squelette ancien, encore souple.' },
  tissu_equilibre: { name: 'Tissu d’organe d’équilibre', kind: 'organe', organ: 'equilibre', desc: 'Une matrice de tissu nerveux conservée dans un bocal de résine.' },
  empreinte: { name: 'Empreinte humaine', kind: 'humain', desc: 'Une plaque de cire organique gravée. Elle contient quelqu’un.' },
};

// Dessin d'une petite icône de ressource (dans un contexte 2D).
export function drawResIcon(g, id, x, y, s = 8) {
  const c = RESOURCES[id] ? RESOURCES[id].color : '#ccc';
  g.save();
  g.translate(x, y);
  g.fillStyle = c;
  g.strokeStyle = 'rgba(0,0,0,0.35)';
  g.lineWidth = Math.max(1, s / 8);
  switch (id) {
    case 'ferraille':
      g.beginPath();
      g.moveTo(-s * 0.5, s * 0.3);
      g.lineTo(-s * 0.2, -s * 0.45);
      g.lineTo(s * 0.45, -s * 0.2);
      g.lineTo(s * 0.3, s * 0.45);
      g.closePath();
      g.fill();
      g.stroke();
      break;
    case 'pierre':
      g.beginPath();
      g.ellipse(0, s * 0.05, s * 0.5, s * 0.38, 0.2, 0, Math.PI * 2);
      g.fill();
      g.stroke();
      break;
    case 'fibre':
      g.lineWidth = Math.max(1, s / 5);
      g.strokeStyle = c;
      for (let k = -1; k <= 1; k++) {
        g.beginPath();
        g.moveTo(k * s * 0.25 - s * 0.1, s * 0.5);
        g.quadraticCurveTo(k * s * 0.3 + s * 0.2, 0, k * s * 0.2, -s * 0.5);
        g.stroke();
      }
      break;
    case 'biomasse':
      g.beginPath();
      g.arc(0, 0, s * 0.45, 0, Math.PI * 2);
      g.fill();
      g.fillStyle = 'rgba(255,255,255,0.3)';
      g.beginPath();
      g.arc(-s * 0.15, -s * 0.15, s * 0.15, 0, Math.PI * 2);
      g.fill();
      break;
    case 'rouages':
      g.beginPath();
      for (let k = 0; k < 16; k++) {
        const a = (k / 16) * Math.PI * 2;
        const r = k % 2 ? s * 0.5 : s * 0.36;
        g.lineTo(Math.cos(a) * r, Math.sin(a) * r);
      }
      g.closePath();
      g.fill();
      g.fillStyle = 'rgba(0,0,0,0.45)';
      g.beginPath();
      g.arc(0, 0, s * 0.14, 0, Math.PI * 2);
      g.fill();
      break;
    case 'vivres':
      g.beginPath();
      g.ellipse(0, s * 0.05, s * 0.4, s * 0.45, 0, 0, Math.PI * 2);
      g.fill();
      g.fillStyle = '#6a8a3a';
      g.fillRect(-s * 0.05, -s * 0.6, s * 0.12, s * 0.25);
      break;
    default:
      g.fillRect(-s / 2, -s / 2, s, s);
  }
  g.restore();
}

export function costText(cost) {
  return Object.entries(cost)
    .map(([k, v]) => `${v} ${(RESOURCES[k] ? RESOURCES[k].name : k).toLowerCase()}`)
    .join(', ');
}
