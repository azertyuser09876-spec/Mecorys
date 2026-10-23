// Textes du monde : inscriptions, carnet et dialogues.
// L'histoire passe surtout par les lieux : ces textes restent courts.

export const LORE = {
  camp: {
    title: 'Le camp tari',
    text: 'Un poteau gravé au couteau : « Caravane de Hesse. Le puits s’est tu au troisième été. Les autres sont partis vers le nord. » Dessous, ta propre écriture : « Moi, vers l’est. »',
  },
  abri: {
    title: 'Plaque rivetée',
    text: '« ABRI 12 — RÉSERVE DES CONVOIS. » Quelqu’un a gratté en dessous : « il n’y a plus de convois ».',
  },
  carcasse: {
    title: 'Coque gravée',
    text: 'Une écriture que tu ne sais pas lire. Mais les dessins parlent : une machine, et derrière elle, des champs qui n’existent plus.',
  },
  tour: {
    title: 'Le point de vue',
    text: 'Les dunes jusqu’à l’horizon. À l’est, les cheminées de la fonderie. Et cette forme couchée sous le sable, trop régulière pour être une colline.',
  },
  tour_haute: {
    title: 'Fresque effacée',
    text: 'Des silhouettes tendent des graines vers une machine immense. La machine leur rend des arbres.',
  },
  atelier: {
    title: 'Note épinglée',
    text: '« Pour Ilo, si tu reviens : le plan du Trotteur est sur la mezzanine. Il marche mieux avec deux roues qu’avec trois. »',
  },
  cheminee: {
    title: 'Au sommet de la cheminée',
    text: 'Vue d’en haut, la fonderie ressemble à une forêt de métal. Une vraie forêt avait dû pousser ici, avant.',
  },
  halle: {
    title: 'Les soudures',
    text: 'Le pont roulant a été réparé cent fois. Chaque soudure est datée au poinçon. La dernière remonte à onze ans.',
  },
  barrage: {
    title: 'Registre du barrage',
    text: '« La Sève remonte par les conduites vers les Chambres. » Puis une ligne plus profonde que les autres : « Débit nul. »',
  },
  pilotis: {
    title: 'Filets secs',
    text: 'Des filets de pêche, raides comme du bois. Le lac est d’une pureté parfaite. Rien n’y vit.',
  },
  conduites: {
    title: 'Traces dorées',
    text: 'Les conduites portaient autrefois un fluide doré, la Sève. Il en reste des cristaux dans les joints, comme du miel figé.',
  },
  sorrel_mur: {
    title: 'Le mur des jours',
    text: 'Des milliers de traits. Des jours, ou des années. Une écriture serrée, ancienne, court entre eux.',
  },
  squelette: {
    title: 'Os de colosse',
    text: 'Ses os sont faits de pierre et de métal entrelacés. Quelque chose, dans la moelle, a été vivant.',
  },
  chantier: {
    title: 'Registres de la cale',
    text: '« N°41 — excavation. N°42 — guerre. N°43 — annulé : le Cœur ne répond plus. »',
  },
  aqueduc: {
    title: 'L’aiguille',
    text: 'Ici, la Sève passait d’une montagne à l’autre. L’aqueduc traverse la roche comme une aiguille traverse une étoffe.',
  },
  porte: {
    title: 'La porte de l’est',
    text: 'Une seule marque, large comme toi : un œil fermé. Le gardien veille.',
  },
  serre: {
    title: 'Étiquette',
    text: 'Des bassins vides, des tiges sèches enroulées autour des poutres. Une étiquette émaillée : « mousse de rouille, souche 3 ».',
  },
  matrice: {
    title: 'La Matrice',
    text: 'Un organe grand comme une maison, relié à mille tuyaux. Elle ne bat plus. Mais elle n’est pas morte : elle attend.',
  },
  archives: {
    title: 'Les bocaux',
    text: 'Les Anciens gardaient ici un modèle de tout ce qui vivait. La plupart des bocaux sont brisés. Pas tous.',
  },
  abime: {
    title: 'Le bord du monde',
    text: 'Le pont s’est effondré il y a si longtemps que l’abîme a ses propres nuages. De l’autre côté, la lumière n’est pas la même.',
  },
  autre_rive: {
    title: 'Traces',
    text: 'Des empreintes de pas, très anciennes, pétrifiées dans la boue. Toutes tournées vers l’est.',
  },
  coeur: {
    title: 'Le Cœur',
    text: 'Il emplit le ciel. Sous tes pieds, une pulsation si lente qu’elle pourrait être celle du monde.',
  },
};

// Le carnet : notes du personnage, ajoutées au fil de la progression.
export const JOURNAL = {
  depart: 'Le puits s’est tu. Il doit rester de l’eau quelque part. À l’est, il y a les tours.',
  abri_vu: 'Un vieil abri à demi enterré, à l’est du camp. Avec un peu de ferraille, je pourrais en faire un refuge.',
  refuge: 'J’ai un toit. Je peux y dormir, et le monde se souviendra de ce que j’ai fait.',
  etabli: 'Un établi et le plan d’un petit robot. Si j’arrive à le construire, je ne serai plus tout à fait seul.',
  robot: 'Mon premier robot. Il obéit aux ordres que je lui donne. C’est étrange, et réconfortant.',
  ilo: 'Ilo vit dans une cabine accrochée au pont roulant. Il cherche un atelier digne de ce nom.',
  barrage: 'Le barrage retient tout un lac. Une vanne, dans la salle des pompes, commande le fond.',
  maelle: 'Maëlle garde un lac sans vie. Elle dit qu’une eau qui ne va nulle part est une eau morte.',
  vanne: 'Le lac descend. L’eau repart vers l’ouest par les conduites. Au fond, un passage est apparu.',
  sorrel: 'Sorrel, dans les Conduites, lit l’écriture des Anciens. Il ne veut pas voir le soleil.',
  vallee: 'Une vallée de géants morts. Et une cale immense, faite pour en construire.',
  gardien: 'Un colosse vivant garde la porte de l’est. Je ne peux pas le combattre. Mais je peux grimper jusqu’à ce qui le fait vivre.',
  gardien_apaise: 'Le Gardien s’est apaisé. La porte de l’est est ouverte.',
  gardien_demonte: 'J’ai arraché la mémoire du Gardien. La porte est ouverte. Le colosse ne bougera plus jamais.',
  serre: 'La Serre-Matrice. Ici, les Anciens faisaient pousser la vie.',
  matrice: 'La Matrice respire de nouveau, faiblement. Je peux reproduire ce dont j’ai trouvé un modèle.',
  nadja: 'Nadja s’est éveillée dans sa capsule. Elle ne sait pas depuis combien de temps elle dormait.',
  dormeur: 'Le Dormeur, sous le sable des dunes. Il lui manque un organe d’équilibre et plusieurs pièces.',
  dormeur_eveille: 'Le Dormeur s’est levé. Le sable a coulé de ses épaules comme de l’eau.',
  chantier: 'Je peux construire mon propre colosse. Il me faudra des heures, beaucoup de ressources, et de l’aide.',
  abime: 'Aucun pont humain ne franchira l’Abîme. Il faudrait un colosse capable de le traverser.',
  pont: 'Un pont de colosse enjambe l’Abîme. Il restera là bien après moi.',
  coeur: 'Le Cœur. Je dois décider de ce qu’il deviendra.',
  humain: 'Une personne s’est éveillée dans la chambre de croissance. Je ne l’ai pas fabriquée : je l’ai laissée naître.',
};

// Bandeaux affichés à l'entrée d'une région
export const REGION_SUB = {
  desert: 'Le sable garde la mémoire de tout ce qui marche.',
  fonderie: 'Le métal y a poussé, puis la mousse.',
  reservoir: 'Une eau parfaite, où rien ne vit.',
  conduites: 'Les veines du monde ancien.',
  vallee: 'Ici, on construisait des géants.',
  serre: 'Le berceau de la vie des Anciens.',
  abime: 'Le monde s’arrête. Presque.',
  coeur: 'Ce qui battait sous toutes choses.',
};
