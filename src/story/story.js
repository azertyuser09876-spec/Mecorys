// Histoire : déclencheurs, grands événements (vanne, Matrice, naissances), objectif courant, fin.
import { TILE, T } from '../world/tiles.js';
import { LAKE } from '../world/generator.js';
import { Cine } from './cine.js';
import { PEOPLE } from '../data/survivors.js';
import { openEnding } from '../ui/ending.js';

export class Story {
  constructor(game) {
    this.game = game;
    this.cine = new Cine(game);
    game.cine = this.cine;
    this.timer = 0;
    this.saveT = 60;
    this.tipT = 0;
  }

  // --- Ouverture -------------------------------------------------------------------
  async intro() {
    const g = this.game;
    const p = g.player;
    g.ui.fade(1, 0.01);
    await this.cine.run(async (c) => {
      await c.wait(1);
      await c.caption('Le puits s’est tu.', 3.2);
      await c.caption('Les autres sont partis vers le nord, avec ce qui restait d’eau.', 3.8);
      await c.caption('Toi, tu pars vers l’est. Là-bas, les tours touchent encore le ciel.', 4.2);
      c.zoom(3);
      g.camera.zoom = g.camera.targetZoom;
      g.camera.focus = { x: p.cx + 400, y: p.cy - 120, speed: 0.6 };
      g.camera.follow(p.cx + 400, p.cy - 120, 1, g.bounds(), 0, true);
      g.ui.fade(0, 3);
      await c.wait(1.5);
      c.focus(p.cx + 3600, p.cy - 160, 0.35);
      await c.caption('Mecorys', 5, true);
      await c.wait(2.5);
      c.focus(p.cx, p.cy, 0.9);
      c.zoom(0);
      await c.wait(2.2);
      c.release();
    });
    g.ui.fade(0, 0.5);
    g.note('depart');
  }

  tips() {
    const g = this.game;
    const k = (a) => `<kbd>${g.input.label(a)}</kbd>`;
    const ab = g.structures.find((s) => s.type === 'refuge' && s.data.poi === 'abri');
    const et = g.structures.find((s) => s.type === 'etabli');
    return [
      { id: 'move', when: () => true, text: `${k('left')}${k('right')} marcher · ${k('jump')} sauter · ${k('run')} courir · ${k('up')} grimper`, done: () => g.player.cx > 62 * TILE, max: 40 },
      { id: 'tool', when: () => g.player.cx > 66 * TILE, text: 'Maintiens le <b>clic gauche</b> sur la ferraille rouillée pour la démanteler.', done: () => g.inv.res.ferraille >= 4, max: 60 },
      { id: 'fibre', when: () => g.inv.res.ferraille >= 4 && ab && ab.ruined, text: 'Le bois mort et les lianes donnent de la fibre. Les gravats donnent de la pierre.', done: () => g.inv.res.fibre >= 4, max: 50 },
      { id: 'abri', when: () => g.journal.some((j) => j.id === 'abri_vu'), text: `Approche-toi du foyer de l’abri et appuie sur ${k('interact')} pour le remettre en état.`, done: () => ab && !ab.ruined, max: 90 },
      { id: 'keys', when: () => ab && !ab.ruined, text: `${k('build')} construire · ${k('journal')} carnet · ${k('map')} carte · ${k('lantern')} lanterne · molette : zoom`, done: () => false, max: 22 },
      { id: 'etabli', when: () => et && !et.ruined, text: `À l’établi, ${k('interact')} pour concevoir et fabriquer un robot.`, done: () => g.robots.built > 0, max: 60 },
      { id: 'lantern', when: () => !g.player.lantern && g.world.lightAt(Math.floor(g.player.cx / TILE), Math.floor(g.player.cy / TILE)) < 3, text: `Il fait noir ici : ${k('lantern')} pour allumer la lanterne.`, done: () => g.player.lantern, max: 30 },
      { id: 'orders', when: () => g.robots.built > 0, text: `${k('orders')} : ordres aux robots. Un dépôt (${k('build')}) près des épaves leur évite de longs trajets.`, done: () => false, max: 25 },
    ];
  }

  updateTips(dt) {
    const g = this.game;
    if (this.cine.active || g.building.active || g.ui.panel || g.titleMode) return;
    const list = this.tips();
    const tip = list.find((t) => !g.flags['tip_' + t.id] && t.when());
    if (!tip) {
      g.ui.setHint('');
      return;
    }
    if (this.tipId !== tip.id) {
      this.tipId = tip.id;
      this.tipT = 0;
    }
    this.tipT += dt;
    if (tip.done() || this.tipT > tip.max) {
      g.flags['tip_' + tip.id] = true;
      g.ui.setHint('');
      return;
    }
    g.ui.setHint(tip.text);
  }

  poi(type) {
    return this.game.pois.find((p) => p.type === type);
  }

  update(dt) {
    const g = this.game;
    this.cine.update(dt);
    this.updateTips(dt);
    this.timer -= dt;
    if (this.timer > 0) return;
    this.timer = 0.5;
    const p = g.player;
    const tx = Math.floor(p.cx / TILE);
    const ty = Math.floor(p.cy / TILE);
    const near = (x, y, r) => Math.abs(tx - x) < r && Math.abs(ty - y) < r;
    const ab = g.structures.find((s) => s.type === 'refuge' && s.data.poi === 'abri');
    if (ab && ab.ruined && near(Math.floor(ab.cx / TILE), ab.floorY, 26)) g.note('abri_vu');
    const r = g.region().id;
    if (r === 'reservoir' || near(878, 58, 20)) g.note('barrage');
    if (r === 'vallee') g.note('vallee');
    if (r === 'serre') g.note('serre');
    if (r === 'abime' && tx > 1940) g.note('abime');
    if (r === 'coeur') g.note('coeur');
    const ch = this.poi('chantier');
    if (ch && near(ch.x, ch.y, 70)) g.note('chantier');
    // Tam arrive quand le monde commence à changer
    if (!g.flags.tam && (g.flags.dormeur_eveille || g.flags.irrigation || g.flags.colosse_construit || g.ecology.greenRatio(0, 520) > 0.15)) {
      g.flags.tam = true;
      const x = 24 * TILE;
      const y = g.world.surface(24) * TILE;
      g.survivors.add('tam', PEOPLE.tam, x, y);
      const ab2 = g.lieux.list[0];
      const tam = g.survivors.get('tam');
      if (ab2) tam.goTo(ab2.refuge.cx - 40, ab2.refuge.y + ab2.refuge.h - 4);
      g.toast('Quelqu’un approche depuis l’ouest, à pied.', 'good');
    }
    // sauvegarde automatique
    this.saveT -= 0.5;
    if (this.saveT <= 0 && !this.cine.active && !g.ui.blocking()) {
      this.saveT = 120;
      g.save && g.save(true);
    }
  }

  // --- Structures anciennes -----------------------------------------------------
  structurePrompt(s) {
    const g = this.game;
    switch (s.type) {
      case 'vanne': {
        if (g.flags.vanne) return { text: 'Vanne du fond', info: 'ouverte' };
        const pump = g.structures.find((x) => x.type === 'pompe_barrage');
        if (pump && pump.ruined) return { text: 'Vanne du fond', info: 'bloquée : la pompe est hors d’usage' };
        return { text: 'Ouvrir la vanne du fond' };
      }
      case 'capsule':
        if (s.data.open) return { text: 'Capsule ouverte' };
        if (!g.flags.matrice) return { text: 'Capsule', info: 'quelqu’un dort à l’intérieur ; la Matrice ne l’alimente plus' };
        return { text: 'Ouvrir la capsule' };
      case 'archives':
        return { text: 'Consulter les archives', info: g.flags.archives ? 'déjà étudiées' : '' };
      case 'coeur':
        return g.flags.fin ? { text: 'Le Cœur', info: { awake: 'il bat', dormant: 'il dort', freed: 'il pousse' }[s.data.state] } : { text: 'Poser la main sur le Cœur' };
      case 'pompe_barrage':
        return { text: 'Pompe du barrage', info: 'elle tourne' };
    }
    return null;
  }

  structureInteract(s) {
    const g = this.game;
    switch (s.type) {
      case 'vanne':
        if (!g.flags.vanne) {
          const pump = g.structures.find((x) => x.type === 'pompe_barrage');
          if (pump && pump.ruined) g.toast('La roue ne bouge pas. Il faut d’abord réparer la pompe, juste à côté.', 'bad');
          else this.openVanne(s);
        }
        return true;
      case 'capsule':
        if (!s.data.open && g.flags.matrice) this.wakeNadja(s);
        else if (!g.flags.matrice) g.toast('La capsule est froide. La Matrice, au centre de la salle, ne l’alimente plus.');
        return true;
      case 'archives':
        this.archives(s);
        return true;
      case 'coeur':
        if (!g.flags.fin) this.ending(s);
        else g.toast('Le Cœur ne demande plus rien.');
        return true;
      case 'pompe_barrage':
        return true;
    }
    return false;
  }

  onRestored(s) {
    if (s.type === 'pompe_barrage') {
      s.active = true;
      this.game.toast('La pompe gronde, puis tourne. La vanne du fond peut être ouverte.', 'good');
    }
  }

  // --- La vanne : le lac descend -------------------------------------------------
  async openVanne(vanne) {
    const g = this.game;
    g.setFlag('vanne');
    await this.cine.run(async (c) => {
      c.sfx('valve');
      for (let k = 0; k < 20; k++) {
        vanne.data.turn = (vanne.data.turn || 0) + 0.15;
        vanne.turn = vanne.data.turn;
        await c.wait(0.05);
      }
      c.focus((LAKE.x0 + 110) * TILE, (LAKE.level + 20) * TILE, 1.2);
      c.zoom(3);
      c.shake(4);
      c.sfx('rumble');
      await c.caption('Quelque part sous le lac, une porte s’ouvre.', 2.5);
      // le niveau baisse rangée par rangée
      for (let y = LAKE.level; y < LAKE.drained; y++) {
        g.world.setArea(LAKE.x0, y, LAKE.x1, y, T.AIR, (id) => id === T.WATER);
        if (y % 6 === 0) c.shake(1.5);
        await c.wait(0.12);
      }
      // la vanne de fond s'efface
      const gate = this.poi('porte_vanne');
      g.world.setArea(gate.x0, gate.y0, gate.x1, gate.y1, T.AIR);
      // l'eau repart vers l'ouest par les conduites
      g.world.setArea(540, 186, 870, 186, T.WATER, (id) => id === T.AIR);
      c.focus((gate.x0 + 10) * TILE, (gate.y0 + 8) * TILE, 1.2);
      await c.caption('Au fond, un passage vers l’est. Et l’eau repart vers l’ouest, dans les conduites.', 4);
      c.zoom(0);
      c.release();
    });
    g.note('vanne');
    g.lieux.compute();
    g.save && g.save(true);
  }

  // --- La Matrice respire ---------------------------------------------------------
  async matriceRestored(m) {
    const g = this.game;
    g.setFlag('matrice');
    m.data.life = 0.01;
    await this.cine.run(async (c) => {
      c.focus(m.cx, m.cy - 40, 1);
      c.zoom(1);
      c.sfx('heartbeat');
      await c.caption('Un battement. Puis un autre, très loin derrière le premier.', 3.5);
      c.sfx('heartbeat');
      await c.caption('La Matrice respire.', 2.5, true);
      c.zoom(0);
      c.release();
    });
    g.note('matrice');
    if (!g.inv.plans.has('chambre')) {
      g.inv.plans.add('chambre');
      g.inv.foundPlans.add('chambre');
      g.toast('En observant la Matrice, tu comprends comment bâtir une chambre de croissance.', 'good');
    }
  }

  async wakeNadja(cap) {
    const g = this.game;
    cap.data.open = true;
    cap.open = true;
    g.audio && g.audio.sfx('hiss');
    for (let k = 0; k < 12; k++) g.particles.steam(cap.cx, cap.y + 10, 1, 1.2);
    const s = g.survivors.add('nadja', PEOPLE.nadja, cap.cx + 20, cap.y + cap.h);
    s.origin = { x: cap.cx + 20, y: cap.y + cap.h };
    await g.survivors.talk(s);
  }

  archives(a) {
    const g = this.game;
    if (g.flags.archives) {
      g.toast('Tu connais déjà ce que ces étagères peuvent t’apprendre.');
      return;
    }
    g.setFlag('archives');
    if (g.colossusSys) g.colossusSys.learnBase();
    g.learnPlan('soudeur', true);
    g.ui.dialog([
      { who: 'Archives de la cale', text: 'Des plans de modules : ossatures, jambes, chaudières colossales, salles de commande. Chaque module est dessiné seul, avec son ordre d’assemblage.' },
      { who: 'Archives de la cale', text: 'Une note manuscrite en marge : « On ne construit pas un géant. On construit cent choses, et on les attache. »' },
    ]);
  }

  // --- Une personne naît -------------------------------------------------------------
  async humanBorn(chamber) {
    const g = this.game;
    g.life.humans++;
    const first = g.life.humans === 1;
    const id = first ? 'ael' : 'iris';
    const name = first ? 'Ael' : 'Iris';
    const def = {
      id,
      name,
      role: 'née de la Matrice',
      look: first ? { skin: 2, face: 1, hairStyle: 1, hairColor: 4, build: 0, top: 9, bottom: 9, accent: 5, accessory: 0, pack: false } : { skin: 4, face: 0, hairStyle: 0, hairColor: 6, build: 1, top: 7, bottom: 11, accent: 3, accessory: 1, pack: false },
      skill: 'memoire',
      skillText: 'Se souvient par fragments du monde des Anciens.',
      likes: ['vie', 'jardin'],
      dislikes: [],
      needs: {},
      needText: 'trouver sa place',
      first: [
        { who: '…', text: 'C’est… froid. Et lumineux. Est-ce que c’est toujours comme ça, d’exister ?' },
        { who: '…', text: 'J’ai des souvenirs qui ne sont pas à moi. Une ville. Une machine qui chante. Des gens qui demandaient, demandaient.' },
        {
          who: '…',
          text: 'Tu m’as fait naître. Est-ce que je t’appartiens ?',
          choices: [
            { text: 'Non. Tu es libre.', value: 'libre', then: [{ who: '…', text: 'Alors je vais choisir. D’abord un nom. … ' + name + '. Je m’appellerai ' + name + '.' }] },
            { text: 'Je ne sais pas. À toi de le dire.', value: 'doute', then: [{ who: '…', text: 'Alors je dis non. Et je choisis un nom : ' + name + '.' }] },
          ],
        },
        { who: name, text: 'Je trouverai où vivre. Peut-être près de toi, peut-être pas. Merci de m’avoir laissé naître, et de ne pas m’avoir fabriqué.' },
      ],
      waiting: ['Je cherche encore où je veux être.'],
      joining: name + ' a choisi de vivre à {lieu}.',
      home: ['Les autres me regardent parfois comme une question. Je suis une question. Eux aussi.', 'Je me souviens d’un mot des Anciens pour « assez ». Je crois que je vais l’apprendre aux autres.', 'Est-ce que je suis une copie ? Non. Une copie ne doute pas.'],
      refuse: {},
    };
    g.survivors.created.push(def);
    await this.cine.run(async (c) => {
      c.focus(chamber.cx, chamber.cy, 1);
      c.sfx('heartbeat');
      await c.caption('La membrane se déchire doucement. Quelqu’un respire.', 4);
      c.release();
    });
    const s = g.survivors.add(id, def, chamber.cx + 24, chamber.y + chamber.h);
    await g.survivors.talk(s);
    g.note('humain');
    // les autres réagissent
    const nadja = g.survivors.get('nadja');
    if (nadja) nadja.say('Bienvenue. Prends ton temps.', 6);
    const sorrel = g.survivors.get('sorrel');
    if (sorrel && sorrel.met) g.toast('Plus tard, Sorrel dira : « Les Anciens aussi avaient commencé par une seule. »');
  }

  // --- Objectif courant (pour le carnet) --------------------------------------------
  currentGoal() {
    const g = this.game;
    const f = g.flags;
    const ab = g.structures.find((s) => s.type === 'refuge' && s.data.poi === 'abri');
    if (ab && ab.ruined) return 'Récupérer de la ferraille et de la fibre sur les épaves (clic gauche), puis remettre l’abri en état.';
    const et = g.structures.find((s) => s.type === 'etabli');
    if (et && et.ruined) return 'Chercher un atelier à l’est, dans la fonderie, et remettre son établi en état.';
    if (!g.robots.built) return 'Fabriquer un premier robot à l’établi.';
    if (!f.vanne) return 'Le barrage, à l’est de la fonderie : réparer la pompe et ouvrir la vanne du fond.';
    if (!f.vu_vallee) return 'Suivre le passage découvert au fond du lac, vers l’est.';
    if (!f.gardien) return 'Le Gardien bloque la porte de l’est. Grimper sur lui, jusqu’à ce qui le fait vivre.';
    if (!f.matrice) return 'Restaurer la Matrice, dans la Serre.';
    if (!f.dormeur_eveille) return 'Le Dormeur, dans les dunes : faire croître un organe d’équilibre et réparer ses modules.';
    if (!f.pont) return 'Construire ou transformer un colosse capable de franchir l’Abîme.';
    if (!f.fin) return 'Traverser l’Abîme et trouver le Cœur.';
    return 'Le monde continue. Il y a toujours quelque chose à faire revivre.';
  }

  // --- Fin -----------------------------------------------------------------------------
  async ending(heart) {
    const g = this.game;
    const choice = await g.ui.dialog([
      { who: '', text: 'Sous ta main, le Cœur est tiède. Il ne bat pas. Il attend, comme la Matrice attendait.' },
      { who: '', text: 'Tu comprends ce que les Anciens ont fait : ils lui ont tout demandé, jusqu’à l’épuiser. Ce qu’il deviendra dépend maintenant de toi.' },
      {
        who: '',
        text: 'Que fais-tu ?',
        choices: [
          { text: 'Le rallumer : la Sève coulera de nouveau partout. Tout reviendra vite… et tout dépendra de lui.', value: 'awake' },
          { text: 'Le laisser dormir : la vie reviendra lentement, par nos mains, nos chambres, nos graines.', value: 'dormant' },
          { text: 'Le libérer : ouvrir ses chambres et disperser ses graines au vent. Il cessera d’être une machine.', value: 'freed' },
        ],
      },
    ]);
    if (!choice) return;
    g.setFlag('fin');
    g.flags.finChoix = choice;
    heart.data.state = choice;
    heart.state = choice;
    await this.cine.run(async (c) => {
      c.focus(heart.cx, heart.cy, 0.8);
      c.zoom(2);
      if (choice === 'awake') {
        c.sfx('heartbeat');
        c.shake(6);
        await c.caption('Le Cœur se contracte. Une fois. La Sève remonte dans mille conduites.', 4);
        c.sfx('heartbeat');
        await c.caption('Très loin à l’ouest, les dunes frémissent.', 3.5);
      } else if (choice === 'dormant') {
        await c.caption('Tu retires ta main. Le Cœur continue de dormir.', 3.5);
        await c.caption('Ce qui reviendra sera lent, fragile, et ne devra rien à personne.', 4);
      } else {
        c.sfx('rumble');
        c.shake(4);
        await c.caption('Les chambres du Cœur s’ouvrent. Des graines s’envolent par milliers.', 4);
        await c.caption('Le vent les emporte vers l’ouest. Le Cœur devient forêt.', 4);
      }
      await c.fade(1, 2);
      this.applyEnding(choice);
      c.release();
      c.zoom(0);
      await c.fade(0, 1);
    });
    openEnding(g, choice);
  }

  applyEnding(choice) {
    const g = this.game;
    const eco = g.ecology;
    for (const z of eco.zones) {
      if (choice === 'awake') {
        z.perm = Math.min(0.6, z.perm + 0.3);
        if (!z.plants.mousse) z.plants.mousse = 0.1;
        if (!z.plants.herbe) z.plants.herbe = 0.1;
      } else if (choice === 'freed') {
        const x = z.i * 24;
        if (x > 1800) {
          z.perm = Math.min(0.6, z.perm + 0.35);
          z.plants.herbe = Math.max(z.plants.herbe || 0, 0.3);
          z.plants.arbre = Math.max(z.plants.arbre || 0, 0.2);
        }
        z.perm = Math.min(0.6, z.perm + 0.08);
        if (!z.plants.herbe) z.plants.herbe = 0.05;
      }
    }
    g.save && g.save(true);
  }
}
