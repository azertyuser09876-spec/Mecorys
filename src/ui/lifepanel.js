// Panneaux de la technologie de vie et des potagers.
import { el, clear, canvasEl } from './dom.js';
import { SAMPLES, costText } from '../data/items.js';
import { PLANTS, ANIMALS, TRAITS } from '../data/species.js';
import { JOBS, modelKind } from '../systems/life.js';

export function openLife(game, s) {
  const L = game.life;
  const isM = s.type === 'matrice';
  let tab = 'reproduire';
  const traits = {};
  for (const k in TRAITS) traits[k] = TRAITS[k].options[0];
  game.ui.openPanel(
    isM ? 'La Matrice' : 'Chambre de croissance',
    (body) => {
      const render = () => {
        clear(body);
        const j = L.jobs[s.id];
        const why = L.why(s);
        body.append(
          el('p', { class: 'muted' }, isM ? 'L’organe des Anciens respire de nouveau. Il peut reproduire tout ce dont tu as un modèle, et davantage.' : 'Une cuve de verre, des racines, des pompes. Il lui faut un modèle vivant, de la biomasse, de l’eau et de l’énergie.'),
        );
        if (why) body.append(el('p', { class: 'ko' }, why));
        if (j) {
          body.append(el('div', { class: 'card' }, el('h3', {}, 'En croissance : ' + label(game, j)), el('div', { class: 'meter' }, el('div', { style: { width: Math.round((j.progress / j.total) * 100) + '%' } })), el('div', { class: 'muted small' }, `vitesse × ${L.speed(s).toFixed(2)}`)));
        }
        const tabs = el('div', { class: 'tabs' });
        const T = [['reproduire', 'Reproduire'], ['jeunes', 'Jeunes et graines']];
        if (isM) T.splice(1, 0, ['creer', 'Créer une espèce'], ['humain', 'Une personne']);
        for (const [id, name] of T) tabs.append(el('button', { class: 'tab' + (tab === id ? ' on' : ''), onclick: () => ((tab = id), render()) }, name));
        body.append(tabs);
        const busy = !!j;
        if (tab === 'reproduire') {
          const list = el('div', { class: 'list' });
          const models = Object.keys(game.inv.samples).filter((id) => game.inv.samples[id] > 0 && modelKind(id) && modelKind(id) !== 'humain');
          if (!models.length) list.append(el('p', { class: 'muted' }, 'Aucun modèle. Cherche des graines, des œufs, des tissus dans le monde.'));
          for (const id of models) {
            const S = SAMPLES[id];
            const kind = modelKind(id);
            const target = S.species || S.organ;
            const J = JOBS[kind];
            const allowed = kind !== 'organe' || isM;
            const def = PLANTS[target] || ANIMALS[target];
            list.append(
              el(
                'div',
                { class: 'card' },
                el('h3', {}, S.name),
                el('div', { class: 'muted small' }, kind === 'plante' ? `Donne 4 sachets de graines de ${def.name.toLowerCase()}.` : kind === 'animal' ? `Donne 3 jeunes ${def.name.toLowerCase()}. ${def.desc}` : 'Un organe pour un colosse ancien.'),
                el('div', { class: 'small' }, `${costText(J.cost)} · ${J.time} s`),
                el('button', { class: 'btn small primary', disabled: busy || !allowed || !game.inv.has(J.cost), onclick: () => (L.start(s, kind, target), render()) }, J.label),
              ),
            );
          }
          body.append(list);
        } else if (tab === 'creer') {
          body.append(el('p', {}, 'Combine des caractéristiques lisibles. La Matrice compose le reste. L’être obtenu vivra selon sa nature : prévois-lui un milieu.'));
          const form = el('div', { class: 'list' });
          for (const k in TRAITS) {
            const sel = el('select', { class: 'd-select' });
            for (const o of TRAITS[k].options) sel.append(el('option', { value: o, selected: traits[k] === o }, o));
            sel.addEventListener('change', () => (traits[k] = sel.value));
            form.append(el('label', { class: 'card' }, el('div', { class: 'muted small' }, TRAITS[k].label), sel));
          }
          body.append(form);
          const J = JOBS.creation;
          body.append(
            el('div', { class: 'd-btns' }, el('span', { class: 'small' }, `${costText(J.cost)} · ${J.time} s`), el('button', {
              class: 'btn primary',
              disabled: busy || !game.inv.has(J.cost),
              onclick: () => {
                const def = game.ecology.createSpecies({ ...traits });
                L.start(s, 'creation', def.id);
                game.toast(`Une espèce nouvelle prend forme : on l’appellera ${def.name}.`, 'good');
                render();
              },
            }, 'Faire naître')),
          );
        } else if (tab === 'humain') {
          const has = game.inv.hasSample('empreinte');
          body.append(
            el('p', {}, 'Créer un humain n’est pas fabriquer une unité. La personne qui naîtra sera libre : elle choisira son nom, son lieu, sa vie. Elle ne t’obéira pas.'),
            el('p', { class: 'muted' }, has ? 'L’empreinte humaine des archives est prête. Elle contient quelqu’un : des fragments de souvenirs, une manière d’être.' : 'Il faudrait une empreinte humaine. Les Anciens en conservaient dans leurs archives.'),
          );
          const J = JOBS.humain;
          body.append(
            el('div', { class: 'd-btns' }, el('span', { class: 'small' }, `${costText(J.cost)} · ${J.time} s`), el('button', {
              class: 'btn primary',
              disabled: busy || !has || !game.inv.has(J.cost) || L.humans >= 2,
              onclick: async () => {
                game.ui.closePanel();
                const r = await game.ui.dialog([
                  { who: 'Nadja', text: game.survivors.get('nadja') ? 'Tu es sûr ? Une fois née, cette personne ne sera pas à toi. Ni à moi.' : 'La Matrice frémit. Ce que tu t’apprêtes à faire ne se défait pas.' },
                  {
                    who: '',
                    text: 'Laisser naître une personne ?',
                    choices: [
                      { text: 'Oui. Qu’elle vive, et qu’elle choisisse.', value: 'oui' },
                      { text: 'Pas maintenant.', value: 'non' },
                    ],
                  },
                ]);
                if (r === 'oui') {
                  L.start(s, 'humain', 'humain', {});
                  game.toast('La Matrice accueille l’empreinte. Il faudra du temps.', 'good');
                }
              },
            }, 'Laisser naître')),
          );
          if (L.humans >= 2) body.append(el('p', { class: 'muted' }, 'La Matrice est épuisée par ces naissances. Elle ne peut plus en porter d’autre.'));
        } else {
          renderStock(game, body, render);
        }
      };
      render();
      return render;
    },
    {},
  );
}

function label(game, j) {
  if (j.kind === 'humain') return 'une personne';
  if (j.kind === 'organe') return 'organe d’équilibre';
  return game.life.name(j.model);
}

export function renderStock(game, body, render) {
  const inv = game.inv;
  const L = game.life;
  const seeds = Object.entries(inv.seeds).filter(([, n]) => n > 0);
  const eggs = Object.entries(inv.eggs).filter(([, n]) => n > 0);
  const hum = Math.round(game.ecology.humidityAt(Math.floor(game.player.cx / 16), Math.floor(game.player.cy / 16)) * 100);
  body.append(el('p', { class: 'muted' }, `Ici, l’humidité du sol est de ${hum} %.`));
  if (!seeds.length && !eggs.length) body.append(el('p', { class: 'muted' }, 'Aucune graine ni aucun jeune pour l’instant.'));
  const list = el('div', { class: 'list' });
  for (const [id, n] of seeds) {
    const P = game.ecology.speciesDef(id);
    list.append(el('div', { class: 'card' }, el('h3', {}, `${P.name} × ${n}`), el('div', { class: 'muted small' }, `${P.desc} Humidité nécessaire : ${Math.round((P.humidity || 0) * 100)} %.`), el('button', { class: 'btn small', onclick: () => (L.sowHere(id), render()) }, 'Semer ici')));
  }
  for (const [id, n] of eggs) {
    const A = game.ecology.speciesDef(id);
    list.append(el('div', { class: 'card' }, el('h3', {}, `${A.name} × ${n}`), el('div', { class: 'muted small' }, A.desc), el('button', { class: 'btn small', onclick: () => (L.releaseHere(id), render()) }, 'Relâcher ici')));
  }
  body.append(list);
}

export function openSow(game, pot) {
  const seeds = Object.entries(game.inv.seeds).filter(([, n]) => n > 0);
  if (!seeds.length) {
    game.toast('Tu n’as aucune graine. Les échantillons de plantes en donnent quelques-unes.', 'bad');
    return;
  }
  game.ui.openPanel(
    'Semer dans le potager',
    (body) => {
      body.append(el('p', { class: 'muted' }, 'Le potager pousse avec l’eau du lieu. Les plantes comestibles donnent des vivres ; toutes donnent des graines.'));
      const list = el('div', { class: 'list' });
      for (const [id, n] of seeds) {
        const P = game.ecology.speciesDef(id);
        list.append(
          el(
            'div',
            { class: 'card' },
            el('h3', {}, `${P.name} × ${n}`),
            el('div', { class: 'muted small' }, P.food ? 'Comestible.' : 'Non comestible : donne seulement des graines.'),
            el('button', {
              class: 'btn small primary',
              onclick: () => {
                game.inv.seeds[id]--;
                pot.data.crop = id;
                pot.data.growth = 0;
                game.ui.closePanel();
                game.toast(`${P.name} semée.`, 'good');
                game.audio && game.audio.sfx('place');
              },
            }, 'Semer'),
          ),
        );
      }
      body.append(list);
    },
    { cls: 'narrow' },
  );
}
