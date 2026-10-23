// Les rares survivants. Ils sont libres : le joueur crée des conditions, eux décident.

export const PEOPLE = {
  ilo: {
    name: 'Ilo',
    role: 'mécanicien',
    look: { skin: 1, face: 0, hairStyle: 5, hairColor: 0, build: 2, top: 6, bottom: 5, accent: 2, accessory: 2, pack: false },
    skill: 'robots',
    skillText: 'Les robots se fabriquent une fois et demie plus vite.',
    likes: ['atelier', 'construction'],
    dislikes: ['repos'],
    needs: { etabli: true },
    needText: 'un vrai atelier, avec un établi qui tourne et un toit pour dormir',
    first: [
      { who: 'Ilo', text: 'Oh ! Un vivant ! Pardon, je… ça fait des années que je parle aux boulons.' },
      { who: 'Ilo', text: 'Je m’appelle Ilo. Je répare ce pont roulant. Il ne va nulle part, mais il roule.' },
      {
        who: 'Ilo',
        text: 'Tu viens d’où, toi ?',
        choices: [
          { text: 'D’un camp, à l’ouest. Le puits s’est tu.', value: 'camp', then: [{ who: 'Ilo', text: 'Alors tu cherches de l’eau. Ici il n’y a que de la rouille. Mais la rouille, ça se travaille.' }] },
          { text: 'Je cherche de quoi reconstruire.', value: 'build', then: [{ who: 'Ilo', text: 'Reconstruire ! Le plus beau mot qu’on m’ait dit depuis longtemps.' }] },
        ],
      },
      { who: 'Ilo', text: 'Si un jour tu as un atelier qui fonctionne, avec un établi et un toit, je viendrai. Je sais fabriquer des machines. Beaucoup de machines.' },
    ],
    waiting: ['Toujours pas d’atelier ? Je garde mes outils graissés.', 'Un établi, un toit. Je ne suis pas difficile.'],
    joining: 'Ilo a rangé ses outils dans un sac et part s’installer à {lieu}.',
    home: [
      'Tu as vu le dernier robot ? J’ai resserré ses articulations. Il danse presque.',
      'Je dors mieux depuis qu’il y a d’autres bruits que le vent.',
      'Un jour, on construira quelque chose d’assez grand pour que le vent nous fasse peur à nous.',
      'Je parle encore aux boulons. Mais maintenant ils me répondent moins bien que toi.',
    ],
    refuse: { repos: 'Me reposer ? Je me reposerai quand tout tournera.' },
  },
  maelle: {
    name: 'Maëlle',
    role: 'gardienne de l’eau',
    look: { skin: 3, face: 1, hairStyle: 1, hairColor: 1, build: 0, top: 4, bottom: 3, accent: 8, accessory: 3, pack: false },
    skill: 'eau',
    skillText: 'Les lieux où elle vit reçoivent plus d’eau, et les potagers poussent mieux.',
    likes: ['jardin', 'eau'],
    dislikes: ['construction'],
    needs: { vanne: true, eau: true },
    needText: 'que l’eau du lac reparte, et un lieu où elle coule vraiment',
    first: [
      { who: 'Maëlle', text: 'Ne fais pas de vagues. L’eau s’en souvient.' },
      { who: 'Maëlle', text: 'Je garde ce lac depuis toujours. Il est parfait. Rien n’y vit. Une eau qui ne va nulle part est une eau morte.' },
      {
        who: 'Maëlle',
        text: 'Tu veux savoir ce que je ferais à ta place ?',
        choices: [
          { text: 'Oui.', value: 'oui', then: [{ who: 'Maëlle', text: 'J’ouvrirais la vanne du fond, en haut du barrage. Mais la pompe est morte. Il faudrait la réparer.' }] },
          { text: 'Je ne suis pas là pour le lac.', value: 'non', then: [{ who: 'Maëlle', text: 'Tout le monde est là pour l’eau. Même ceux qui ne le savent pas encore.' }] },
        ],
      },
      { who: 'Maëlle', text: 'Le jour où l’eau repartira, je la suivrai. Là où elle coulera, je ferai pousser quelque chose.' },
    ],
    waiting: ['Le lac est toujours trop calme.', 'La pompe du barrage. Tout commence par elle.'],
    joining: 'Maëlle a suivi l’eau. Elle s’installe à {lieu}.',
    home: [
      'L’eau chante différemment ici. Elle a envie d’aller quelque part.',
      'J’ai trouvé une pousse ce matin. Une seule. Je l’ai regardée pendant une heure.',
      'Les plantes ne poussent pas plus vite si on les regarde. Mais elles poussent mieux.',
    ],
    refuse: { construction: 'Construire encore ? Laisse d’abord pousser ce qu’on a semé.' },
  },
  sorrel: {
    name: 'Sorrel',
    role: 'érudit des conduites',
    look: { skin: 0, face: 2, hairStyle: 3, hairColor: 5, build: 0, top: 11, bottom: 11, accent: 7, accessory: 0, pack: false },
    skill: 'savoir',
    skillText: 'Il lit l’écriture des Anciens : les inscriptions livrent davantage, et il révèle des plans.',
    likes: ['lecture'],
    dislikes: ['atelier', 'construction'],
    needs: { calme: true },
    needText: 'du calme, loin du soleil et des machines',
    stays: true,
    first: [
      { who: 'Sorrel', text: 'Éteins ta lanterne. Ou ne l’éteins pas. Je n’y vois plus de toute façon.' },
      { who: 'Sorrel', text: 'On m’appelait Sorrel, quand il y avait quelqu’un pour m’appeler. Je lis ce que les Anciens ont écrit sur ces murs.' },
      {
        who: 'Sorrel',
        text: 'Tu veux savoir ce qu’ils disent ?',
        choices: [
          {
            text: 'Oui. Qu’est-ce qui est arrivé ?',
            value: 'chute',
            then: [
              { who: 'Sorrel', text: 'Ils avaient un Cœur. Une machine vivante, à l’est, qui faisait pousser tout le reste. La Sève coulait dans ces conduites.' },
              { who: 'Sorrel', text: 'Ils lui ont demandé des géants. Pour creuser, pour se battre. Toujours plus grands. Un jour, le Cœur s’est tu.' },
            ],
          },
          { text: 'Pas maintenant.', value: 'non', then: [{ who: 'Sorrel', text: 'Les murs attendront. Ils ont l’habitude.' }] },
        ],
      },
      { who: 'Sorrel', text: 'Je ne quitterai pas mes murs. Mais reviens me voir : j’y trouve parfois des choses qui servent aux vivants.' },
    ],
    waiting: ['Tu as encore marché au soleil. Ça s’entend à ta façon de respirer.'],
    home: [
      'Les Anciens avaient un mot pour « assez ». Ils ne l’ont jamais écrit.',
      'Le Gardien, dans la vallée, n’est pas méchant. Il obéit à un ordre que personne ne peut plus annuler.',
      'Si tu trouves le Cœur, ne lui demande rien. C’est en demandant qu’ils l’ont tué.',
    ],
    refuse: { atelier: 'Des machines ? Je préfère mes murs.', construction: 'Construire ? À mon âge on déconstruit, doucement.' },
  },
  nadja: {
    name: 'Nadja',
    role: 'soigneuse de la vie',
    look: { skin: 4, face: 1, hairStyle: 4, hairColor: 6, build: 1, top: 9, bottom: 8, accent: 3, accessory: 0, pack: false },
    skill: 'vie',
    skillText: 'Les chambres de croissance travaillent une fois et demie plus vite.',
    likes: ['vie', 'jardin'],
    dislikes: ['construction'],
    needs: { serre: true },
    needText: 'rester près de la Matrice',
    stays: true,
    first: [
      { who: 'Nadja', text: '… Il fait froid. Pourquoi fait-il si froid ? La Matrice devrait…' },
      { who: 'Nadja', text: 'Tu l’as réveillée. Elle respire. Je l’entends d’ici.' },
      {
        who: 'Nadja',
        text: 'Je m’appelle Nadja. Je soignais la Matrice. Combien de temps ai-je dormi ?',
        choices: [
          { text: 'Je ne sais pas. Très longtemps. Le monde est presque vide.', value: 'verite', then: [{ who: 'Nadja', text: 'Alors il faut tout refaire. Tout. Une graine après l’autre.' }] },
          { text: 'Assez pour que tout soit à recommencer.', value: 'doux', then: [{ who: 'Nadja', text: 'Recommencer, c’est mon métier.' }] },
        ],
      },
      { who: 'Nadja', text: 'Je reste ici, avec elle. Apporte-moi des modèles vivants : graines, œufs, tissus. Nous les ferons revenir. Et un jour… peut-être plus.' },
    ],
    home: [
      'Une espèce qui revient ne suffit pas. Il lui faut un monde où elle peut rester.',
      'Je me demande parfois si j’ai été semée, moi aussi.',
      'L’empreinte humaine, dans les archives… Si tu t’en sers, ce ne sera pas une machine. Ce sera quelqu’un.',
    ],
    refuse: { construction: 'Je ne quitte pas la Matrice pour des chantiers.' },
  },
  tam: {
    name: 'Tam',
    role: 'voyageur',
    look: { skin: 2, face: 2, hairStyle: 2, hairColor: 2, build: 1, top: 2, bottom: 0, accent: 10, accessory: 1, pack: true },
    skill: 'exploration',
    skillText: 'Il rapporte régulièrement des ressources de ses voyages.',
    likes: ['exploration'],
    dislikes: ['repos'],
    needs: {},
    needText: 'un endroit où revenir',
    first: [
      { who: 'Tam', text: 'Alors c’était vrai. J’ai vu de loin une montagne qui marchait, et du vert dans les dunes.' },
      { who: 'Tam', text: 'Je m’appelle Tam. Je marche depuis le nord. Il n’y a plus personne, là-bas.' },
      { who: 'Tam', text: 'Je ne tiens pas en place. Mais si j’ai un endroit où revenir, je reviendrai les poches pleines.' },
    ],
    waiting: [],
    joining: 'Tam a posé son sac à {lieu}. Il repartira, mais il reviendra.',
    home: ['J’ai vu des traces de brouteurs vers l’ouest. Ils reviennent.', 'Le vent sent moins la poussière qu’avant.'],
    refuse: { repos: 'Me reposer ? J’ai des jambes pour quelque chose.' },
  },
};

// Activités possibles et structures associées
export const ACTIVITIES = {
  atelier: { label: 'travaille à l’atelier', near: ['etabli', 'forge'] },
  jardin: { label: 'jardine', near: ['potager'] },
  eau: { label: 'entretient l’eau', near: ['pompe', 'citerne'] },
  vie: { label: 'soigne la vie', near: ['chambre', 'matrice'] },
  lecture: { label: 'lit les murs', near: [] },
  construction: { label: 'aide au chantier', near: ['forge'] },
  exploration: { label: 'est parti explorer', near: [] },
  repos: { label: 'se repose', near: ['refuge'] },
};

export const PRIORITIES = {
  equilibre: 'Équilibre',
  nourriture: 'Nourriture',
  construction: 'Construction',
  vie: 'Vie',
  repos: 'Repos',
};

const PRIO_ACT = { nourriture: ['jardin', 'eau'], construction: ['atelier', 'construction'], vie: ['vie', 'jardin'], repos: ['repos'] };
export function priorityActivities(p) {
  return PRIO_ACT[p] || [];
}

// Conversations entre survivants qui vivent ensemble
export const BANTER = [
  ['ilo', 'maelle', 'Tu crois que l’eau aime les machines ?', 'Elle aime celles qui la laissent passer.'],
  ['ilo', 'tam', 'Tu as vu des pièces, dans le nord ?', 'Des montagnes de pièces. Et personne pour les assembler.'],
  ['maelle', 'tam', 'Tu repars quand ?', 'Quand le vent tournera. Pas avant le dîner.'],
  ['ilo', 'ael', 'Tu te souviens de comment on fabriquait les colosses ?', 'Je me souviens de leurs noms. Pas de moi.'],
  ['maelle', 'ael', 'Tu es née de la Matrice. Ça fait quoi ?', 'Ça fait comme toi, je crois. Ça fait vivre.'],
];
