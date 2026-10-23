// Technologie de vie : chambres de croissance, Matrice, potagers, création d'êtres et d'humains.
import { TILE } from '../world/tiles.js';
import { SAMPLES } from '../data/items.js';
import { PLANTS, ANIMALS } from '../data/species.js';
import { Crate } from '../entities/crate.js';
import { openLife, openSow } from '../ui/lifepanel.js';

export const JOBS = {
  plante: { cost: { biomasse: 4 }, time: 40, label: 'Faire germer' },
  animal: { cost: { biomasse: 8 }, time: 70, label: 'Faire éclore' },
  organe: { cost: { biomasse: 20, rouages: 2 }, time: 120, label: 'Cultiver l’organe' },
  creation: { cost: { biomasse: 25, rouages: 2 }, time: 120, label: 'Faire naître' },
  humain: { cost: { biomasse: 60, rouages: 8, ferraille: 20 }, time: 300, label: 'Laisser naître' },
};

export class Life {
  constructor(game) {
    this.game = game;
    this.jobs = {}; // id de structure -> travail en cours
    this.humans = 0;
  }

  chambers() {
    return this.game.structures.filter((s) => (s.type === 'chambre' || s.type === 'matrice') && !s.ruined);
  }

  isMatrice(s) {
    return s.type === 'matrice';
  }

  // vitesse : énergie et eau du lieu (la Matrice puise dans sa propre Sève), soins de Nadja
  speed(s) {
    const g = this.game;
    let k = 1;
    if (s.type === 'chambre') {
      if (!s.lieu) return 0;
      const e = s.lieu.energyProd > 0 ? s.lieu.energyRatio : 0;
      const w = s.lieu.waterProd > 0 ? s.lieu.waterRatio : 0;
      k = Math.min(e, w);
    }
    return k * (g.survivors ? g.survivors.bonus('vie') : 1);
  }

  why(s) {
    if (s.type !== 'chambre') return '';
    if (!s.lieu) return 'Hors d’un lieu habitable : pas d’énergie ni d’eau.';
    if (!(s.lieu.energyProd > 0)) return 'Il faut de l’énergie dans ce lieu (moulin, chaudière).';
    if (!(s.lieu.waterProd > 0)) return 'Il faut de l’eau dans ce lieu (citerne, pompe).';
    return '';
  }

  start(s, kind, model, extra = {}) {
    const g = this.game;
    const J = JOBS[kind];
    if (this.jobs[s.id]) return g.toast('Cette chambre travaille déjà.', 'bad');
    if (!g.inv.pay(J.cost)) return g.toast('Il manque de la biomasse ou des pièces.', 'bad');
    this.jobs[s.id] = { kind, model, progress: 0, total: J.time, extra };
    s.busy = true;
    g.audio && g.audio.sfx('life');
    g.lieux.compute();
  }

  update(dt) {
    const g = this.game;
    for (const s of this.chambers()) {
      const j = this.jobs[s.id];
      s.busy = !!j;
      s.active = !!j && this.speed(s) > 0;
      s.progress = j ? j.progress / j.total : 0;
      if (!j) continue;
      j.progress += dt * this.speed(s);
      if (Math.random() < dt * 2) g.particles.motes(s.cx, s.cy, 'rgba(200,255,220,0.8)', 1);
      if (j.progress >= j.total) {
        delete this.jobs[s.id];
        s.busy = false;
        this.finish(s, j);
        g.ui.refreshPanel();
      }
    }
    // potagers
    for (const s of g.structures) if (s.type === 'potager' && !s.ruined) this.farm(s, dt);
    // Matrice restaurée : elle respire
    for (const s of g.structures) if (s.type === 'matrice' && !s.ruined) s.data.life = Math.min(1, (s.data.life || 0) + dt * 0.05);
  }

  finish(s, j) {
    const g = this.game;
    const inv = g.inv;
    if (j.kind === 'plante') {
      inv.seeds[j.model] = (inv.seeds[j.model] || 0) + 4;
      g.toast(`Germination réussie : 4 sachets de ${this.name(j.model).toLowerCase()}. Sème-les là où l’humidité leur convient.`, 'good');
    } else if (j.kind === 'animal' || j.kind === 'creation') {
      inv.eggs[j.model] = (inv.eggs[j.model] || 0) + 3;
      const n = this.name(j.model);
      g.toast(`Trois jeunes ${n.toLowerCase()} sont prêts à être relâchés (carnet, ou ici même).`, 'good');
      g.setFlag('premier_animal');
    } else if (j.kind === 'organe') {
      const c = new Crate(s.cx, s.y + s.h, { module: j.model, label: 'Organe d’équilibre', organic: true });
      g.entities.push(c);
      g.toast('L’organe d’équilibre a fini de croître. Il doit être porté jusqu’au Dormeur.', 'good');
    } else if (j.kind === 'humain') {
      g.story && g.story.humanBorn(s, j.extra);
    }
    g.audio && g.audio.sfx('birth');
  }

  name(id) {
    const d = this.game.ecology.speciesDef(id);
    return d ? d.name : id;
  }

  farm(s, dt) {
    const g = this.game;
    if (!s.data.crop) return;
    const w = s.lieu ? (s.lieu.waterProd > 0 ? s.lieu.waterRatio : 0) : 0;
    const gardener = g.survivors && g.survivors.list.some((p) => p.activity === 'jardin' && p.atSpot && Math.abs(p.cx - s.cx) < 50);
    const rate = (1 / 100) * w * (g.survivors ? g.survivors.bonus('jardin') : 1) * (gardener ? 1.4 : 1);
    s.dry = w <= 0;
    s.growth = s.data.growth = Math.min(1, (s.data.growth || 0) + dt * rate);
    if (s.growth >= 1) {
      s.data.growth = s.growth = 0.25;
      const P = PLANTS[s.data.crop] || g.ecology.custom[s.data.crop];
      if (P && P.food) g.inv.add('vivres', 3);
      g.inv.seeds[s.data.crop] = (g.inv.seeds[s.data.crop] || 0) + 1;
      if (Math.abs(s.cx - g.player.cx) < 200) g.toast(P && P.food ? 'Récolte : 3 vivres et des graines.' : 'Le potager a donné des graines.', 'good');
    }
    s.crop = s.data.crop;
  }

  // --- liaisons avec le jeu ---------------------------------------------------------
  onSample(id) {
    const S = SAMPLES[id];
    if (S && S.kind === 'plante') {
      const inv = this.game.inv;
      inv.seeds[S.species] = (inv.seeds[S.species] || 0) + 2;
      this.game.toast(`Tu en tires aussi deux poignées de graines (${PLANTS[S.species].name.toLowerCase()}).`);
    }
  }

  structurePrompt(s) {
    if (s.type === 'chambre' || s.type === 'matrice') {
      const j = this.jobs[s.id];
      return { text: s.type === 'matrice' ? 'Approcher la Matrice' : 'Chambre de croissance', info: j ? `croissance : ${Math.round((j.progress / j.total) * 100)} %` : this.why(s) };
    }
    if (s.type === 'potager') {
      if (!s.data.crop) return { text: 'Semer', info: 'potager vide' };
      return { text: 'Potager', info: `${this.name(s.data.crop)} · ${Math.round((s.data.growth || 0) * 100)} %` + (s.dry ? ' · sans eau' : '') };
    }
    return null;
  }

  structureInteract(s) {
    if (s.type === 'chambre' || s.type === 'matrice') {
      openLife(this.game, s);
      return true;
    }
    if (s.type === 'potager') {
      if (!s.data.crop) openSow(this.game, s);
      else this.game.toast(`${this.name(s.data.crop)} pousse ici.` + (s.dry ? ' Le lieu manque d’eau.' : ''));
      return true;
    }
    return false;
  }

  onRestored(s) {
    if (s.type === 'matrice') this.game.story && this.game.story.matriceRestored(s);
  }

  // Semer et relâcher à l'endroit où se trouve le joueur
  sowHere(id) {
    const g = this.game;
    const p = g.player;
    const tx = Math.floor(p.cx / TILE);
    const ty = Math.floor(p.cy / TILE);
    if (!(g.inv.seeds[id] > 0)) return;
    const P = g.ecology.speciesDef(id);
    const h = g.ecology.humidityAt(tx, ty);
    g.inv.seeds[id]--;
    g.ecology.plant(id, tx, ty, 0.08);
    if (h < (P.humidity || 0)) g.toast(`Semé, mais le sol est trop sec ici (${Math.round(h * 100)} % d’humidité, il en faudrait ${Math.round(P.humidity * 100)} %). Les graines risquent de mourir.`, 'bad');
    else g.toast(`${P.name} semée ici.`, 'good');
    g.audio && g.audio.sfx('place');
  }

  releaseHere(id) {
    const g = this.game;
    const p = g.player;
    const n = g.inv.eggs[id] || 0;
    if (!n) return;
    const tx = Math.floor(p.cx / TILE);
    const ty = Math.floor(p.cy / TILE);
    const z = g.ecology.release(id, tx, ty, n);
    g.inv.eggs[id] = 0;
    const A = g.ecology.speciesDef(id);
    const food = z ? g.ecology.foodFor(z, A) : 0;
    if (food < 0.15) g.toast(`${A.name} relâchés. Ils ne trouveront pas grand-chose à manger ici (il leur faut : ${A.eats}).`, 'bad');
    else g.toast(`${A.name} relâchés. Ils vivront selon leur nature.`, 'good');
    g.ecology.bestiary[id] = true;
    g.audio && g.audio.sfx('birth');
  }

  toJSON() {
    return { jobs: this.jobs, humans: this.humans };
  }

  load(o) {
    if (!o) return;
    this.jobs = o.jobs || {};
    this.humans = o.humans || 0;
  }
}

export function modelKind(id) {
  const S = SAMPLES[id];
  if (!S) return null;
  if (S.kind === 'plante') return 'plante';
  if (S.kind === 'animal') return 'animal';
  if (S.kind === 'organe') return 'organe';
  if (S.kind === 'humain') return 'humain';
  return null;
}

export { ANIMALS };
