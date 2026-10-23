// Épilogue : ce que le joueur a changé dans le monde.
import { el } from './dom.js';

const TEXTS = {
  awake: {
    title: 'Le Cœur bat',
    lines: [
      'La Sève coule de nouveau. En quelques saisons, la mousse couvre les conduites, l’herbe tient les dunes, les bassins de la Serre débordent.',
      'Les survivants regardent ce retour avec joie, et parfois avec crainte. Quand tout dépend d’une seule machine, que se passera-t-il le jour où elle se taira de nouveau ?',
    ],
  },
  dormant: {
    title: 'Le Cœur dort',
    lines: [
      'Le monde ne change pas d’un coup. Il change par les mains de quelques-uns : une graine, une chambre, un robot jardinier au-dessus des dunes.',
      'Ce qui revient est fragile. Mais rien ne pourra plus s’éteindre d’un seul coup, parce que rien ne dépend plus d’une seule chose.',
    ],
  },
  freed: {
    title: 'Le Cœur est forêt',
    lines: [
      'Les graines du Cœur ont voyagé avec le vent. Là où elles sont tombées sur un sol humide, elles ont pris.',
      'La grande machine vivante n’est plus une machine. Elle est devenue un paysage. Les colosses viennent parfois s’y reposer.',
    ],
  },
};

export function openEnding(game, choice) {
  const T = TEXTS[choice];
  const s = game.survivors.list.filter((p) => p.met);
  const { plants, fauna } = game.ecology.totals();
  const species = Object.keys(plants).filter((k) => plants[k] > 0.05).length + Object.keys(fauna).filter((k) => fauna[k] > 0.5).length;
  const created = Object.keys(game.ecology.custom).length;
  const colossi = game.colossi.filter((c) => c.active).length;
  const green = Math.round(game.ecology.greenRatio(0, 520) * 100);
  const hours = Math.floor(game.playTime / 3600);
  const minutes = Math.floor((game.playTime % 3600) / 60);
  game.ui.openPanel(T.title, (body) => {
    for (const l of T.lines) body.append(el('p', {}, l));
    body.append(
      el(
        'div',
        { class: 'list' },
        el('div', { class: 'card' }, el('h3', {}, 'Survivants rencontrés'), el('div', {}, s.length ? s.map((p) => p.name).join(', ') : 'aucun')),
        el('div', { class: 'card' }, el('h3', {}, 'Espèces vivantes'), el('div', {}, `${species}${created ? `, dont ${created} créées` : ''}`)),
        el('div', { class: 'card' }, el('h3', {}, 'Colosses en marche'), el('div', {}, String(colossi))),
        el('div', { class: 'card' }, el('h3', {}, 'Dunes reverdies'), el('div', {}, `${green} %`)),
        el('div', { class: 'card' }, el('h3', {}, 'Robots fabriqués'), el('div', {}, String(game.robots.built))),
        el('div', { class: 'card' }, el('h3', {}, 'Temps'), el('div', {}, `${hours} h ${minutes} min, ${game.env.day} jours`)),
      ),
      el('p', { class: 'muted' }, 'Le monde continue. Tu peux poursuivre : il y a toujours des lieux à rendre habitables et des espèces à faire revenir.'),
      el('div', { class: 'd-btns' }, el('button', { class: 'btn primary', onclick: () => game.ui.closePanel() }, 'Continuer')),
    );
  });
}
