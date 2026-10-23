// Écran titre, création du personnage, options et pause.
import { el, clear, canvasEl } from './dom.js';
import { drawHuman, defaultLook, SKINS, HAIRS, CLOTHES, HAIR_STYLES, BUILDS, FACES, ACCESSORIES } from '../render/character.js';
import { hasSave, readSave } from '../systems/save.js';

export function showTitle(ui, { onNew, onContinue, audio }) {
  const save = hasSave() ? readSave() : null;
  const wrap = el('div', { class: 'title' });
  const when = save ? new Date(save.savedAt) : null;
  const card = el(
    'div',
    { class: 'title-card' },
    el('h1', {}, 'Mecorys'),
    el('div', { class: 'title-sub' }, 'Le monde s’est tu. Rends-lui la vie.'),
    el(
      'div',
      { class: 'title-btns' },
      save
        ? el(
            'button',
            {
              class: 'btn primary big',
              onclick: () => {
                audio && audio.start();
                wrap.remove();
                onContinue(save);
              },
            },
            'Continuer',
            el('span', { class: 'small muted' }, ` jour ${save.env.day}, ${when.toLocaleDateString('fr-FR')}`),
          )
        : null,
      el(
        'button',
        {
          class: 'btn big' + (save ? '' : ' primary'),
          onclick: async () => {
            audio && audio.start();
            if (save && !confirm('Commencer une nouvelle partie effacera la sauvegarde actuelle. Continuer ?')) return;
            wrap.remove();
            onNew();
          },
        },
        'Nouvelle partie',
      ),
      el('button', { class: 'btn big', onclick: () => (audio && audio.start(), openOptions(ui, audio)) }, 'Options'),
    ),
    el('div', { class: 'title-foot muted small' }, 'Un jeu d’exploration et de reconstruction. Tout ce que tu vois et entends est généré par le code.'),
  );
  wrap.append(card);
  ui.root.append(wrap);
  return wrap;
}

export function openCreation(ui, onDone) {
  const look = defaultLook();
  const fields = [
    ['skin', 'Peau', SKINS.length, (i) => SKINS[i]],
    ['face', 'Visage', FACES.length, (i) => FACES[i]],
    ['hairStyle', 'Coiffure', HAIR_STYLES.length, (i) => HAIR_STYLES[i]],
    ['hairColor', 'Cheveux', HAIRS.length, (i) => HAIRS[i]],
    ['build', 'Silhouette', BUILDS.length, (i) => BUILDS[i]],
    ['top', 'Haut', CLOTHES.length, (i) => CLOTHES[i]],
    ['bottom', 'Bas', CLOTHES.length, (i) => CLOTHES[i]],
    ['accent', 'Couleur d’accent', CLOTHES.length, (i) => CLOTHES[i]],
    ['accessory', 'Accessoire', ACCESSORIES.length, (i) => ACCESSORIES[i]],
  ];
  ui.openPanel(
    'Qui es-tu ?',
    (body) => {
      const prev = canvasEl(160, 200, 'creation-preview');
      const g = prev.getContext('2d');
      let t = 0;
      let alive = true;
      const scarf = [];
      const draw = () => {
        if (!alive) return;
        t += 1 / 60;
        g.clearRect(0, 0, prev.width, prev.height);
        const grad = g.createLinearGradient(0, 0, 0, prev.height);
        grad.addColorStop(0, '#86a6c2');
        grad.addColorStop(1, '#ead0a8');
        g.fillStyle = grad;
        g.fillRect(0, 0, prev.width, prev.height);
        g.fillStyle = '#c99a5e';
        g.fillRect(0, 170, prev.width, 30);
        g.imageSmoothingEnabled = false;
        // l'écharpe flotte au vent (coordonnées du personnage, avant mise à l'échelle)
        scarf.length = 0;
        for (let i = 0; i < 5; i++) scarf.push({ x: 80 - (i + 1) * 2.2, y: 170 - 20.5 + i * 0.6 + Math.sin(t * 3 + i) * 0.5 });
        drawHuman(g, 80, 170, look, { facing: 1, state: 'idle', t, phase: 0, scarf }, { scale: 4, tool: true });
        requestAnimationFrame(draw);
      };
      requestAnimationFrame(draw);
      const controls = el('div', { class: 'creation-controls' });
      const render = () => {
        clear(controls);
        for (const [k, label, n, name] of fields) {
          const val = name(look[k]);
          const isColor = typeof val === 'string' && val.startsWith('#');
          controls.append(
            el(
              'div',
              { class: 'c-row' },
              el('span', { class: 'muted' }, label),
              el('button', { class: 'btn small', onclick: () => ((look[k] = (look[k] - 1 + n) % n), render()) }, '‹'),
              isColor ? el('span', { class: 'swatch', style: { background: val } }) : el('span', { class: 'c-val' }, val),
              el('button', { class: 'btn small', onclick: () => ((look[k] = (look[k] + 1) % n), render()) }, '›'),
            ),
          );
        }
      };
      render();
      body.append(
        el('p', { class: 'muted' }, 'Un humain, seul, au bord d’un désert immense. À quoi ressembles-tu ?'),
        el('div', { class: 'row creation' }, prev, controls),
        el(
          'div',
          { class: 'd-btns' },
          el(
            'button',
            {
              class: 'btn',
              onclick: () => {
                for (const [k, , n] of fields) look[k] = Math.floor(Math.random() * n);
                render();
              },
            },
            'Au hasard',
          ),
          el(
            'button',
            {
              class: 'btn primary',
              onclick: () => {
                alive = false;
                ui.closePanel(true);
                onDone(look);
              },
            },
            'Partir vers l’est',
          ),
        ),
      );
    },
    { cls: 'narrow' },
  );
}

export function openOptions(ui, audio) {
  ui.openPanel(
    'Options',
    (body) => {
      const slider = (label, key) => {
        const input = el('input', { type: 'range', min: 0, max: 1, step: 0.05, value: audio ? audio.vol[key] : 0.5 });
        input.addEventListener('input', () => {
          if (!audio) return;
          audio.vol[key] = Number(input.value);
          audio.applyVolume();
        });
        return el('label', { class: 'c-row' }, el('span', { class: 'muted' }, label), input);
      };
      body.append(slider('Volume général', 'master'), slider('Musique', 'music'), slider('Ambiance', 'ambience'), slider('Bruitages', 'sfx'));
      body.append(el('p', { class: 'muted small' }, 'Les touches suivent la position physique du clavier : ZQSD sur AZERTY, WASD sur QWERTY, ou les flèches.'));
    },
    { cls: 'narrow' },
  );
}

export function openPause(game, { onTitle }) {
  game.ui.openPanel(
    'Pause',
    (body) => {
      body.append(
        el(
          'div',
          { class: 'col' },
          el('button', { class: 'btn primary', onclick: () => game.ui.closePanel() }, 'Reprendre'),
          el('button', { class: 'btn', onclick: () => (game.save(false), game.ui.closePanel()) }, 'Sauvegarder'),
          el('button', { class: 'btn', onclick: () => openOptions(game.ui, game.audio) }, 'Options'),
          el('button', { class: 'btn', onclick: () => game.openJournal('aide') }, 'Commandes'),
          el('button', { class: 'btn', onclick: () => (game.save(true), onTitle()) }, 'Sauvegarder et revenir au titre'),
        ),
      );
    },
    { cls: 'narrow' },
  );
}
