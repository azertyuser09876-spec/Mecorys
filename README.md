# Mecorys

Jeu d'exploration et de reconstruction dans un monde immense, silencieux et presque privé de vie.
Vue de côté, en 2D, pour PC, écrit en HTML et JavaScript. Tout ce que l'on voit et entend
(paysages, personnages, machines, colosses, musique, bruitages) est généré par le code.

## Jouer

- **Le plus simple** : ouvrir `dist/mecorys.html` dans un navigateur récent (Chrome, Edge, Firefox).
  Le fichier est autonome : il fonctionne sans connexion et sans installation.
- La partie se sauvegarde quand on se repose dans un refuge, régulièrement en arrière-plan,
  et en quittant la page. La sauvegarde reste dans le navigateur.

### Commandes

| Action | Touche |
| --- | --- |
| Marcher | Q / D (AZERTY), A / D (QWERTY) ou flèches |
| Sauter | Espace |
| Courir | Maj |
| Grimper, nager, descendre d'une passerelle | Z / S ou flèches |
| Interagir | E |
| Démanteler avec l'outil | clic gauche maintenu |
| Mode construction | B |
| Ordres aux robots | R |
| Monter dans une machine, en descendre | F |
| Carnet (notes, réserves, lieux, survivants, plans) | J |
| Carte du monde | M |
| Lanterne | L |
| Zoom | molette, + / - |
| Menu | Échap |

Les touches suivent la position physique du clavier : ZQSD sur AZERTY, WASD sur QWERTY.

## Le monde

D'ouest en est : les Dunes Muettes, la Fonderie Engloutie et, sous elle, les Conduites,
le Grand Réservoir, la Vallée des Colosses, la Serre-Matrice, l'Abîme, puis le Cœur.

Le joueur part seul d'un camp dont le puits s'est tu. Il récupère des ressources, restaure un
abri, fabrique des robots modulaires, retrouve de rares survivants libres, rouvre l'eau du lac,
apaise ou démantèle le Gardien, fait revivre la Matrice et reproduit des espèces, répare le
Dormeur enfoui dans les dunes, construit son propre colosse module par module dans la cale,
franchit l'Abîme et décide de l'avenir du Cœur.

Les rouages sont rares dans les ruines ; si on en manque, l'établi peut en usiner un
pour 5 ferraille, lentement.

Le document de conception se trouve dans [`docs/conception.md`](docs/conception.md).

## Développement

Il faut Node.js (version 20 ou plus).

```sh
npm install        # installe esbuild
npm run build      # produit dist/mecorys.html et www/mecorys.js
npm test           # tests unitaires (robots, plans, monde, accessibilité des lieux)
npm run dev        # serveur de développement : http://localhost:8000
```

Pour développer, on peut aussi ouvrir `www/index.html` directement après `npm run build`.
Paramètres d'adresse utiles : `?skip` (passer l'écran titre), `?x=546&y=116` (se placer à une
tuile), `?hour=20` (heure de la journée), `?zoom=2` (zoom de départ), `F3` (informations de débogage).

### Organisation du code

- `src/world/` : tuiles, génération du monde, régions, physique, sauvegarde différentielle.
- `src/render/` : rendu (blocs de tuiles, parallaxe, lumière, personnages, structures, robots).
- `src/entities/` : joueur, robots, survivants, colosses, structures, objets.
- `src/systems/` : construction, lieux, écologie, technologie de vie, robots, survivants,
  colosses, recherche de chemin, sauvegarde.
- `src/story/` : histoire, cinématiques, fin.
- `src/ui/` : interface (carnet, carte, éditeurs de robots et de colosses, titre).
- `src/audio/` : son procédural (Web Audio).
- `src/data/` : contenus (textes, espèces, modules, survivants, structures).
