// Survivants : rencontres, décisions autonomes, activités, besoins et liens.
import { TILE } from '../world/tiles.js';
import { PEOPLE, ACTIVITIES, PRIORITIES, priorityActivities, BANTER } from '../data/survivors.js';
import { Survivor } from '../entities/survivor.js';
import { DAY_LENGTH } from '../core/config.js';

export class Survivors {
  constructor(game) {
    this.game = game;
    this.timer = 2;
    this.dayT = 0;
    this.banterT = 30;
    this.talking = null;
    this.created = []; // humains créés : définitions propres
  }

  get list() {
    return this.game.entities.filter((e) => e.kind === 'survivor');
  }

  get(id) {
    return this.list.find((s) => s.id === id);
  }

  defOf(id) {
    return PEOPLE[id] || this.created.find((c) => c.id === id);
  }

  spawn(pois) {
    for (const p of pois) {
      if (p.type !== 'survivor') continue;
      const def = PEOPLE[p.id];
      if (!def) continue;
      this.game.entities.push(new Survivor(p.id, def, p.x * TILE + 8, p.y * TILE));
    }
  }

  add(id, def, x, y, opts) {
    const s = new Survivor(id, def, x, y, opts);
    this.game.entities.push(s);
    return s;
  }

  residents(lieu) {
    return this.list.filter((s) => s.home === lieu.id);
  }

  bonus(kind) {
    const has = (id) => {
      const s = this.get(id);
      return s && (s.home || this.defOf(id).stays) && s.met;
    };
    if (kind === 'robots') return has('ilo') ? 1.5 : 1;
    if (kind === 'vie') return has('nadja') ? 1.5 : 1;
    if (kind === 'jardin') return has('maelle') ? 1.5 : 1;
    return 1;
  }

  statusOf(s) {
    const L = this.game.lieux.list.find((l) => l.id === s.home);
    const act = ACTIVITIES[s.activity] ? ACTIVITIES[s.activity].label : '';
    const mood = s.mood > 0.7 ? 'paisible' : s.mood > 0.4 ? 'soucieux' : 'malheureux';
    return `${L ? L.name : ''} · ${act} · ${mood}`;
  }

  // Conditions qu'un survivant attend d'un lieu
  check(s, lieu) {
    const game = this.game;
    const def = this.defOf(s.id);
    const miss = [];
    const res = this.residents(lieu).filter((r) => r !== s).length;
    if (lieu.beds <= res) miss.push('une place pour dormir (un refuge de plus)');
    const n = def.needs || {};
    if (n.etabli && !lieu.has.etabli && !game.structures.some((x) => x.type === 'etabli' && !x.ruined && x.lieu === lieu)) miss.push('un établi');
    if (n.vanne && !game.flags.vanne) miss.push('que l’eau du lac reparte');
    if (n.eau && !(lieu.waterProd > 0.5)) miss.push('de l’eau dans ce lieu');
    return { ok: miss.length === 0, miss };
  }

  bestLieu(s) {
    let best = null;
    let bs = -Infinity;
    for (const l of this.game.lieux.list) {
      const c = this.check(s, l);
      if (!c.ok) continue;
      let score = (l.waterProd || 0) * 0.5 + (l.energyProd || 0) * 0.2 + this.residents(l).length * 0.8 + this.game.ecology.humidityAt(l.tx) * 3;
      const def = this.defOf(s.id);
      for (const a of def.likes) for (const st of (ACTIVITIES[a] || { near: [] }).near) if (l.has[st]) score += 1.5;
      if (score > bs) {
        bs = score;
        best = l;
      }
    }
    return best;
  }

  async talk(s) {
    const game = this.game;
    const def = this.defOf(s.id);
    this.talking = s;
    game.audio && game.audio.sfx('talk');
    if (!s.met) {
      s.met = true;
      await game.ui.dialog(def.first.map((l) => ({ ...l })));
      game.note(s.id);
      if (def.stays) game.toast(`${s.name} restera ici. ${def.skillText}`, 'good');
      else game.toast(`${s.name} cherche : ${def.needText}.`);
      this.timer = 1;
    } else if (s.home) {
      const line = def.home[Math.floor(Math.random() * def.home.length)];
      await game.ui.dialog([{ who: s.name, text: line }]);
    } else if (def.stays) {
      await this.talkStayer(s, def);
    } else {
      // dire précisément ce qui manque dans le lieu le plus proche
      const near = game.lieux.list.slice().sort((a, b) => Math.abs(a.tx * TILE - s.cx) - Math.abs(b.tx * TILE - s.cx))[0];
      let text = def.waiting[Math.floor(Math.random() * def.waiting.length)] || '…';
      if (near) {
        const c = this.check(s, near);
        if (!c.ok) text += ` (À ${near.name}, il manque ${c.miss.join(', ')}.)`;
      } else text += ' (Il n’existe encore aucun lieu habitable.)';
      await game.ui.dialog([{ who: s.name, text }]);
    }
    this.talking = null;
  }

  async talkStayer(s, def) {
    const game = this.game;
    const lines = [{ who: s.name, text: def.home[Math.floor(Math.random() * def.home.length)] }];
    // Sorrel traduit et révèle des plans
    if (s.id === 'sorrel') {
      const read = game.entities.filter((e) => e.kind === 'prop' && e.read).length;
      if (read >= 3 && !game.inv.plans.has('soudeur')) {
        lines.push({ who: 'Sorrel', text: 'Tu as lu assez de murs pour comprendre ceci. Voilà comment les Anciens assemblaient leurs géants : un robot soudeur. Prends ce plan.' });
        await game.ui.dialog(lines);
        game.learnPlan('soudeur', true);
        return;
      }
      if (read >= 6 && !game.inv.plans.has('jardinier')) {
        lines.push({ who: 'Sorrel', text: 'Ils faisaient voler de petits jardiniers au-dessus des dunes. Un ballon, un arroseur. Tiens.' });
        await game.ui.dialog(lines);
        game.learnPlan('jardinier', true);
        return;
      }
      if (read < 3) lines.push({ who: 'Sorrel', text: 'Lis d’abord les murs, là-haut. Reviens quand tu en auras lu quelques-uns.' });
    }
    await game.ui.dialog(lines);
  }

  update(dt) {
    const game = this.game;
    const list = this.list;
    this.timer -= dt;
    if (this.timer <= 0) {
      this.timer = 4;
      for (const s of list) this.decide(s);
    }
    // repas quotidien
    this.dayT += dt;
    if (this.dayT >= DAY_LENGTH) {
      this.dayT = 0;
      for (const s of list) {
        if (!s.home) continue;
        if (game.inv.res.vivres > 0) {
          game.inv.res.vivres--;
          s.mood = Math.min(1, s.mood + 0.1);
        } else {
          s.mood = Math.max(0, s.mood - 0.12);
          if (s.mood < 0.45) s.say('Il n’y a plus rien à manger…', 6);
        }
        if (s.id === 'tam' || s.activity === 'exploration') {
          const gift = { ferraille: 4 + Math.floor(Math.random() * 6), fibre: 3, rouages: Math.random() < 0.5 ? 1 : 0 };
          game.inv.addAll(gift);
          game.toast(`${s.name} est revenu de voyage avec des ressources.`, 'good');
        }
      }
    }
    // activités
    for (const s of list) {
      if (s.leaveT > 0) {
        s.leaveT -= dt;
        if (s.leaveT <= 0 && s.travel) s.away = 8 + Math.random() * 8;
      }
      if (s.away > 0) {
        s.away -= dt;
        if (s.away <= 0) this.arrive(s);
        continue;
      }
      if (s.pendingSay) {
        s.pendingSay.t -= dt;
        if (s.pendingSay.t <= 0) {
          s.say(s.pendingSay.text, 5);
          s.pendingSay = null;
        }
      }
      s.actT -= dt;
      if (s.home && s.actT <= 0 && !s.travel) this.chooseActivity(s);
      if (s.goalX === null && !s.travel) {
        s.atSpot = true;
        if (Math.random() < dt * 0.05 && s.activity !== 'repos') s.goTo(s.cx + (Math.random() - 0.5) * 60, s.y + s.h - 4);
      }
    }
    // conversations spontanées
    this.banterT -= dt;
    if (this.banterT <= 0) {
      this.banterT = 40 + Math.random() * 40;
      for (const [a, b, la, lb] of BANTER) {
        const A = this.get(a);
        const B = this.get(b);
        if (!A || !B || !A.home || A.home !== B.home || A.away > 0 || B.away > 0) continue;
        if (Math.abs(A.cx - B.cx) > 300) continue;
        if (Math.random() < 0.5) continue;
        A.say(la, 5);
        B.pendingSay = { text: lb, t: 2.5 };
        break;
      }
    }
  }

  decide(s) {
    const game = this.game;
    const def = this.defOf(s.id);
    if (!s.met || def.stays || s.travel || s.away > 0) return;
    // partir si malheureux
    if (s.home && s.mood < 0.15) {
      const L = game.lieux.list.find((l) => l.id === s.home);
      game.toast(`${s.name} a quitté ${L ? L.name : 'son lieu'} : il n’y avait plus de quoi vivre.`, 'bad');
      s.home = null;
      s.mood = 0.5;
      this.leave(s, s.origin);
      return;
    }
    if (s.home && !game.lieux.list.some((l) => l.id === s.home)) s.home = null;
    if (s.home) return;
    const L = this.bestLieu(s);
    if (!L) return;
    s.home = L.id;
    game.toast(def.joining ? def.joining.replace('{lieu}', L.name) : `${s.name} s’installe à ${L.name}.`, 'good');
    game.audio && game.audio.sfx('note');
    this.leave(s, { x: L.refuge.cx + (Math.random() - 0.5) * 40, y: L.refuge.y + L.refuge.h });
  }

  // Voyage : on s'éloigne, puis on réapparaît à destination hors de la vue du joueur.
  leave(s, dest) {
    s.travel = dest;
    s.goTo(s.cx + (dest.x > s.cx ? 400 : -400), s.y + s.h - 4);
    s.leaveT = 5;
  }

  arrive(s) {
    const d = s.travel || s.origin;
    s.travel = null;
    s.x = d.x - s.w / 2;
    s.y = d.y - s.h - 1;
    s.vx = s.vy = 0;
    s.goalX = null;
    s.path = null;
    s.actT = 0;
  }

  chooseActivity(s) {
    const game = this.game;
    const def = this.defOf(s.id);
    const L = game.lieux.list.find((l) => l.id === s.home);
    if (!L) return;
    const prio = priorityActivities(L.priority);
    const options = {};
    for (const a of Object.keys(ACTIVITIES)) {
      const A = ACTIVITIES[a];
      if (a === 'lecture' && s.id !== 'sorrel') continue;
      if (a === 'exploration' && s.id !== 'tam') continue;
      const spots = A.near.length ? (L.structs || []).filter((x) => A.near.includes(x.type)) : [L.refuge];
      if (!spots.length) continue;
      let w = 1;
      if (def.likes.includes(a)) w += 2;
      if (prio.includes(a)) w += def.dislikes.includes(a) ? 0 : 3;
      if (def.dislikes.includes(a)) w *= 0.15;
      options[a] = { w, spots };
    }
    const keys = Object.keys(options);
    if (!keys.length) return;
    let r = Math.random() * keys.reduce((t, k) => t + options[k].w, 0);
    let pick = keys[0];
    for (const k of keys) {
      r -= options[k].w;
      if (r <= 0) {
        pick = k;
        break;
      }
    }
    s.activity = pick;
    s.actT = 25 + Math.random() * 30;
    s.atSpot = false;
    if (pick === 'exploration') {
      s.away = 50 + Math.random() * 40;
      s.travel = { x: s.cx, y: s.y + s.h };
      return;
    }
    const spot = options[pick].spots[Math.floor(Math.random() * options[pick].spots.length)];
    s.goTo(spot.cx + (Math.random() - 0.5) * Math.min(30, spot.w), spot.y + spot.h - 4);
  }

  setPriority(lieu, p) {
    const game = this.game;
    lieu.priority = p;
    for (const s of this.residents(lieu)) {
      const def = this.defOf(s.id);
      const acts = priorityActivities(p);
      const no = acts.find((a) => def.dislikes.includes(a));
      if (no && def.refuse && def.refuse[no]) {
        s.say(def.refuse[no], 6);
        game.toast(`${s.name} refuse : « ${def.refuse[no]} »`);
      }
      s.actT = Math.random() * 3;
    }
    game.toast(`Priorité de ${lieu.name} : ${PRIORITIES[p]}. Les habitants décideront d’eux-mêmes.`);
  }

  onRegion(region, first) {
    // Tam arrive quand le monde commence à changer
  }

  toJSON() {
    return { people: this.list.map((s) => s.toJSON()), created: this.created, dayT: this.dayT };
  }

  load(o) {
    if (!o) return;
    this.created = o.created || [];
    this.dayT = o.dayT || 0;
    for (const d of o.people || []) {
      const def = this.defOf(d.id);
      if (!def) continue;
      const s = this.add(d.id, def, d.x, d.y, d);
      if (d.away > 0) s.away = d.away;
    }
  }
}
