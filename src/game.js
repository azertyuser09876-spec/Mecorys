// Cœur du jeu : relie le monde, les entités, les systèmes, le rendu et l'interface.
import { TILE, T, tileDef } from './world/tiles.js';
import { generateWorld } from './world/generator.js';
import { regionAt } from './world/regions.js';
import { Player } from './entities/player.js';
import { Structure } from './entities/structure.js';
import { Pickup } from './entities/pickup.js';
import { Prop } from './entities/prop.js';
import { Camera } from './render/camera.js';
import { Particles, Weather } from './render/particles.js';
import { Renderer } from './render/renderer.js';
import { skyState } from './render/background.js';
import { Inventory } from './systems/inventory.js';
import { Lieux } from './systems/lieux.js';
import { Building } from './systems/building.js';
import { Ecology } from './systems/ecology.js';
import { Robots } from './systems/robots.js';
import { Survivors } from './systems/survivors.js';
import { Life } from './systems/life.js';
import { openJournal } from './ui/journal.js';
import { Story } from './story/story.js';
import { ColossusSystem } from './systems/colossi.js';
import { STRUCT } from './data/structures.js';
import { RESOURCES, SAMPLES, costText } from './data/items.js';
import { LORE, JOURNAL, REGION_SUB } from './data/texts.js';

import { DAY_LENGTH } from './core/config.js';
export { DAY_LENGTH };
const INTERACT_RANGE = 30;

export class Game {
  constructor(canvas, input, ui, audio) {
    this.canvas = canvas;
    this.input = input;
    this.ui = ui;
    ui.game = this;
    this.audio = audio;
    this.renderer = new Renderer(canvas);
    this.camera = new Camera();
    this.particles = new Particles();
    this.weather = new Weather();
    this.env = { time: 0, hour: 8, day: 1, wind: 0.5 };
    this.entities = [];
    this.structures = [];
    this.colossi = [];
    this.toasts = [];
    this.flags = {};
    this.journal = [];
    this.inv = new Inventory();
    this.lieux = new Lieux(this);
    this.building = new Building(this);
    this.ecology = new Ecology(this);
    this.systems = []; // systèmes additionnels : update(dt), draw...(g)
    this.robots = this.addSystem(new Robots(this));
    this.survivors = this.addSystem(new Survivors(this));
    this.life = this.addSystem(new Life(this));
    this.story = this.addSystem(new Story(this));
    this.colossusSys = this.addSystem(new ColossusSystem(this));
    this.paused = false;
    this.debug = false;
    this.fps = 60;
    this.seed = 1729;
    this.regionId = null;
    this.focus = null;
    this.playTime = 0;
  }

  addSystem(sys) {
    this.systems.push(sys);
    return sys;
  }

  // --- Création du monde ------------------------------------------------------------
  newWorld(seed = 1729) {
    this.seed = seed;
    const gen = generateWorld(seed);
    this.world = gen.world;
    this.pois = gen.pois;
    this.ground = gen.ground;
    this.player = new Player(0, 0);
    const start = this.pois.find((p) => p.type === 'start');
    this.player.teleport(start.x * TILE + 8, start.y * TILE);
    this.respawnPoint = { x: start.x, y: start.y };
    this.ecology.init();
  }

  spawnFromPois() {
    this.pois.forEach((p, i) => {
      const uid = 'poi' + i;
      switch (p.type) {
        case 'refuge':
          this.addStructure(new Structure('refuge', p.x - 2, p.y, { ruined: p.ruined, id: uid, data: { name: 'L’Abri des dunes', poi: p.id } }));
          break;
        case 'etabli':
          this.addStructure(new Structure('etabli', p.x - 1, p.y, { ruined: true, id: uid }));
          break;
        case 'pompe':
          this.addStructure(new Structure('pompe_barrage', p.x, p.y, { ruined: true, found: true, id: uid }));
          break;
        case 'vanne':
          this.addStructure(new Structure('vanne', p.x, p.y, { found: true, id: uid }));
          break;
        case 'matrice':
          this.addStructure(new Structure('matrice', p.x - 10, p.y, { ruined: true, found: true, id: uid }));
          break;
        case 'pod':
          this.addStructure(new Structure('capsule', p.x - 1, p.y, { found: true, id: uid, data: { who: p.id } }));
          break;
        case 'archives':
          this.addStructure(new Structure('archives', p.x - 2, p.y, { found: true, id: uid }));
          break;
        case 'forge':
          this.addStructure(new Structure('forge', p.x - 2, p.y, { ruined: true, id: uid }));
          break;
        case 'chambre':
          this.addStructure(new Structure('chambre', p.x - 2, p.y, { ruined: true, id: uid }));
          break;
        case 'coeur':
          this.addStructure(new Structure('coeur', p.x - 6, p.y - 6, { found: true, id: uid }));
          break;
        case 'plan':
          this.entities.push(new Pickup('plan', p.x * TILE + 8, p.y * TILE, { id: p.id, uid }));
          break;
        case 'sample':
          this.entities.push(new Pickup('sample', p.x * TILE + 8, p.y * TILE, { id: p.id, uid }));
          break;
        case 'cache':
          this.entities.push(new Pickup('cache', p.x * TILE + 8, p.y * TILE, { items: p.items, uid }));
          break;
        case 'lore': {
          const pr = new Prop('lore', p.x, p.y, { id: p.id });
          pr.uid = uid;
          this.entities.push(pr);
          break;
        }
        case 'prop': {
          const pr = new Prop(p.kind, p.x - Math.floor((p.w || 2) / 2), p.y, p);
          this.entities.push(pr);
          break;
        }
      }
    });
    this.ecology.spawnNests(this.pois);
    for (const sys of this.systems) sys.spawn && sys.spawn(this.pois);
  }

  addStructure(s) {
    s.checkCover && s.checkCover(this.world);
    this.structures.push(s);
    if (s.type === 'refuge') this.lieux.rebuild();
    else this.lieux.compute();
    return s;
  }

  removeStructure(s) {
    this.structures = this.structures.filter((q) => q !== s);
    if (s.type === 'refuge') this.lieux.rebuild();
    else this.lieux.compute();
  }

  structureAt(tx, ty) {
    const px = tx * TILE + 8;
    const py = ty * TILE + 8;
    for (const s of this.structures) if (px >= s.x && px < s.x + s.w && py >= s.y && py < s.y + s.h) return s;
    return null;
  }

  structuresOf(type) {
    return this.structures.filter((s) => s.type === type);
  }

  bounds() {
    return { w: this.world.w * TILE, h: this.world.h * TILE };
  }

  grids() {
    if (!this._grids) this._grids = [this.world];
    this._grids.length = 1;
    for (const c of this.colossi) if (c.grid) this._grids.push(c.grid);
    return this._grids;
  }

  mouseWorld() {
    const m = this.input.mouse;
    const s = this.renderer.scale;
    return this.camera.toWorld(m.sx / s, m.sy / s);
  }

  screenOf(wx, wy) {
    const p = this.camera.toScreen(wx, wy);
    return { x: p.x * this.renderer.scale, y: p.y * this.renderer.scale };
  }

  toast(text, kind = 'info') {
    if (this.toasts.some((t) => t.text === text && t.life > 1)) return;
    this.toasts.push({ text, kind, life: kind === 'lore' ? 9 : 5 });
    if (this.toasts.length > 4) this.toasts.shift();
  }

  note(id) {
    if (this.journal.some((j) => j.id === id)) return false;
    const text = JOURNAL[id];
    if (!text) return false;
    this.journal.push({ id, text, day: this.env.day, hour: Math.floor(this.env.hour) });
    this.toast('Carnet : ' + text, 'lore');
    this.audio && this.audio.sfx('note');
    return true;
  }

  setFlag(id, v = true) {
    const was = this.flags[id];
    this.flags[id] = v;
    return !was;
  }

  faint(reason) {
    this.toast(reason, 'bad');
    const p = this.player;
    if (p.riding) p.riding.dismount(this);
    const spot = this.respawnPoint;
    this.ui.fade(1, 0.4);
    setTimeout(() => {
      p.teleport(spot.x * TILE + 8, spot.y * TILE);
      p.stun = 1;
      this.camera.follow(p.cx, p.cy, 1, this.bounds(), 0, true);
      this.ui.fade(0, 1.2);
    }, 450);
  }

  dismantle(tx, ty, by) {
    const id = this.world.get(tx, ty);
    const d = tileDef(id);
    if (id === T.AIR) return null;
    this.world.set(tx, ty, T.AIR);
    this.particles.burst(tx * TILE + 8, ty * TILE + 8, d.mat, tx, ty, 8);
    this.audio && this.audio.sfx('break', { mat: d.mat });
    if (by === 'player' && d.yields) {
      this.inv.addAll(d.yields);
      for (const s of this.systems) s.onDismantle && s.onDismantle(tx, ty, id, by);
    }
    this.onTileRemoved(tx, ty, id);
    return d.yields;
  }

  onTileRemoved(tx, ty, id) {
    // Les objets posés au-dessus retombent
    for (const e of this.entities) if (e.kind === 'pickup') e.settled = false;
  }

  // --- Interactions ------------------------------------------------------------------
  interactables() {
    const out = [];
    for (const e of this.entities) if (e.interactable) out.push(e);
    for (const s of this.structures) if (s.interactable) out.push(s);
    for (const sys of this.systems) if (sys.interactables) out.push(...sys.interactables());
    return out;
  }

  nearestInteractable() {
    const p = this.player;
    let best = null;
    let bd = INTERACT_RANGE;
    for (const e of this.interactables()) {
      const dx = Math.max(e.x - p.cx, 0, p.cx - (e.x + e.w));
      const dy = Math.max(e.y - p.cy, 0, p.cy - (e.y + e.h));
      const d = Math.hypot(dx, dy * 1.2);
      if (d < bd) {
        const pr = e.prompt && e.prompt(this);
        if (!pr) continue;
        bd = d;
        best = { e, pr };
      }
    }
    return best;
  }

  promptHtml(pr) {
    const key = this.input.label(pr.key || 'interact');
    let h = `<kbd>${key}</kbd>${pr.text}`;
    if (pr.cost) h += `<span class="cost ${this.inv.has(pr.cost) ? '' : 'bad'}">${costText(pr.cost)}</span>`;
    if (pr.info) h += `<span class="cost">${pr.info}</span>`;
    return h;
  }

  pickupPrompt(pk) {
    if (pk.type === 'cache') return { text: 'Fouiller la caisse' };
    if (pk.type === 'sample') return { text: 'Prendre : ' + (SAMPLES[pk.data.id] ? SAMPLES[pk.data.id].name : 'échantillon') };
    if (pk.type === 'plan') return { text: 'Prendre le plan' };
    if (pk.type === 'res') return { text: 'Ramasser' };
    return null;
  }

  collect(pk) {
    this.entities = this.entities.filter((e) => e !== pk);
    this.audio && this.audio.sfx('pickup');
    if (pk.type === 'cache') {
      this.inv.addAll(pk.data.items);
      this.toast('Trouvé : ' + costText(pk.data.items), 'good');
    } else if (pk.type === 'sample') {
      this.inv.addSample(pk.data.id);
      const s = SAMPLES[pk.data.id];
      this.toast(`Échantillon : ${s.name}. ${s.desc}`, 'good');
      for (const sys of this.systems) sys.onSample && sys.onSample(pk.data.id);
    } else if (pk.type === 'plan') {
      this.learnPlan(pk.data.id, true);
    } else if (pk.type === 'res') {
      this.inv.add(pk.data.res, pk.data.n || 1);
    }
  }

  learnPlan(id, found) {
    this.inv.plans.add(id);
    if (found) this.inv.foundPlans.add(id);
    const name = this.planName(id);
    this.toast(`Plan trouvé : ${name}. Construire d’après ce plan coûte environ 5 % de ressources en moins.`, 'good');
    for (const sys of this.systems) sys.onPlan && sys.onPlan(id);
    if (this.building.active) this.building.renderBar();
  }

  planName(id) {
    for (const k in STRUCT) if (STRUCT[k].plan === id || k === id) return STRUCT[k].name;
    for (const sys of this.systems) if (sys.planName) {
      const n = sys.planName(id);
      if (n) return n;
    }
    return id;
  }

  readProp(pr) {
    if (pr.type === 'well') {
      this.toast('Le fond est sec et craquelé. Une pierre jetée ne fait aucun bruit d’eau.', 'lore');
      return;
    }
    const L = LORE[pr.data.id];
    if (!L) return;
    pr.read = true;
    this.ui.dialog([{ who: L.title, text: L.text }]);
    for (const sys of this.systems) sys.onLore && sys.onLore(pr.data.id);
  }

  structurePrompt(s) {
    const d = s.def;
    if (s.ruined) {
      const cost = s.restoreCost();
      const verb = s.type === 'matrice' ? 'Restaurer la Matrice' : s.type === 'pompe_barrage' ? 'Réparer la pompe' : `Remettre en état : ${d.name}`;
      return { text: verb, cost };
    }
    for (const sys of this.systems) if (sys.structurePrompt) {
      const r = sys.structurePrompt(s);
      if (r) return r;
    }
    switch (s.type) {
      case 'refuge':
        return { text: 'Se reposer', info: s.data.name };
      case 'chaudiere':
      case 'moulin':
        return { text: d.name, key: 'interact', info: `${(s.producing || 0).toFixed(1)} énergie` };
      case 'citerne':
      case 'pompe':
        return { text: d.name, key: 'interact', info: `${(s.producing || 0).toFixed(1)} eau` + (s.type === 'pompe' && !s.producing ? ' — pas d’eau proche' : '') };
      case 'lanterne':
        return null;
      default:
        return { text: d.name };
    }
  }

  structureInteract(s) {
    if (s.ruined) {
      const cost = s.restoreCost();
      if (!this.inv.pay(cost)) {
        this.toast('Il manque : ' + costText(this.inv.missing(cost)), 'bad');
        this.audio && this.audio.sfx('deny');
        return;
      }
      s.ruined = false;
      this.audio && this.audio.sfx('build');
      for (let k = 0; k < 10; k++) this.particles.dust(s.x + Math.random() * s.w, s.y + s.h, 0, 2);
      this.onRestored(s);
      return;
    }
    for (const sys of this.systems) if (sys.structureInteract && sys.structureInteract(s)) return;
    if (s.type === 'refuge') this.rest(s);
    else if (s.type === 'chaudiere' || s.type === 'moulin' || s.type === 'citerne' || s.type === 'pompe') this.toast(s.def.desc);
  }

  onRestored(s) {
    if (s.type === 'refuge') {
      this.lieux.rebuild();
      this.respawnPoint = { x: Math.floor(s.cx / TILE), y: Math.floor((s.y + s.h) / TILE) };
      this.toast(`${s.data.name} est devenu un lieu habitable.`, 'good');
      this.note('refuge');
      this.save && this.save();
    }
    if (s.type === 'etabli') {
      this.inv.plans.add('etabli');
      this.toast('L’établi fonctionne. Tu peux concevoir des robots ici, ou construire d’autres établis.', 'good');
    }
    if (s.type === 'forge') {
      this.inv.plans.add('forge');
      this.inv.foundPlans.add('forge');
    }
    if (s.type === 'chambre') {
      this.inv.plans.add('chambre');
      this.inv.foundPlans.add('chambre');
    }
    this.lieux.compute();
    for (const sys of this.systems) sys.onRestored && sys.onRestored(s);
  }

  onBuilt(s) {
    if (s.type === 'refuge') {
      this.respawnPoint = { x: Math.floor(s.cx / TILE), y: Math.floor((s.y + s.h) / TILE) };
      this.toast(`Nouveau lieu habitable : ${s.data.name}.`, 'good');
      this.note('refuge');
    }
    for (const sys of this.systems) sys.onBuilt && sys.onBuilt(s);
  }

  rest(s) {
    this.respawnPoint = { x: Math.floor(s.cx / TILE), y: Math.floor((s.y + s.h) / TILE) };
    const night = this.env.hour > 19 || this.env.hour < 6;
    this.ui.fade(1, 0.8);
    this.audio && this.audio.sfx('rest');
    setTimeout(() => {
      if (night) {
        if (this.env.hour > 12) this.env.day++;
        this.env.hour = 6.5;
      } else this.env.hour = Math.min(23.9, this.env.hour + 2);
      this.save && this.save();
      this.toast(night ? 'Tu as dormi jusqu’à l’aube. Partie sauvegardée.' : 'Tu t’es reposé un moment. Partie sauvegardée.', 'good');
      this.ui.fade(0, 1.4);
    }, 900);
  }

  // --- Boucle -----------------------------------------------------------------------
  update(dt) {
    const input = this.input;
    const ui = this.ui;
    this.playTime += dt;
    this.env.time += dt;
    const prevHour = this.env.hour;
    this.env.hour = (this.env.hour + (dt / DAY_LENGTH) * 24) % 24;
    if (this.env.hour < prevHour) this.env.day++;
    this.env.wind = 0.6 + Math.sin(this.env.time * 0.05) * 0.4 + Math.sin(this.env.time * 0.31) * 0.1;

    if (ui.dialogState) ui.tickDialog(dt, input);
    else if (ui.panel) {
      if (input.hitRaw('pause') || (ui.panel.opts.toggleKey && input.hitRaw(ui.panel.opts.toggleKey))) ui.closePanel();
    } else if (!ui.cine) this.handleKeys();

    if (input.hit('zoomOut') || (input.mouse.wheel > 0 && !ui.panel)) this.camera.setZoomIndex(this.camera.zoomIndex + 1);
    if (input.hit('zoomIn') || (input.mouse.wheel < 0 && !ui.panel)) this.camera.setZoomIndex(this.camera.zoomIndex - 1);
    if (input.hitRaw('debug')) this.debug = !this.debug;

    this.building.update(dt);
    this.player.update(dt, this);
    for (const c of this.colossi) c.update(dt, this);
    for (const e of this.entities) e.update && e.update(dt, this);
    for (const s of this.structures) s.update(dt, this);
    for (const sys of this.systems) sys.update && sys.update(dt);
    this.lieux.update(dt);
    this.ecology.update(dt);
    this.particles.update(dt);

    // Invite contextuelle
    let target = null;
    if (!ui.blocking() && !this.building.active && !this.player.riding && !this.player.frozen) target = this.nearestInteractable();
    this.target = target;
    if (target) {
      const e = target.e;
      const sp = this.screenOf(e.x + e.w / 2, e.y - 4);
      ui.setPrompt(this.promptHtml(target.pr), sp.x, sp.y);
      if (input.hit('interact')) {
        e.interact(this);
        input.pressed.delete('KeyE');
      }
    } else ui.setPrompt(null);

    // Région
    const region = this.region();
    if (region.id !== this.regionId) {
      const first = !this.flags['vu_' + region.id];
      this.regionId = region.id;
      if (first) {
        this.flags['vu_' + region.id] = true;
        ui.banner(region.name, REGION_SUB[region.id]);
      }
      this.audio && this.audio.setRegion(region);
      for (const sys of this.systems) sys.onRegion && sys.onRegion(region, first);
    }

    // Caméra et météo
    const prevX = this.camera.x;
    const prevY = this.camera.y;
    const f = this.focus || this.player;
    this.camera.follow(f.cx, f.cy, dt, this.bounds(), this.focus ? 0 : this.player.facing);
    this.weather.update(dt, region.weather, this.env.wind, this.camera.vw, this.camera.vh, (this.camera.x - prevX) * this.camera.zoom, (this.camera.y - prevY) * this.camera.zoom);
    for (const t of this.toasts) t.life -= dt;
    this.toasts = this.toasts.filter((t) => t.life > 0);
    ui.update(this, dt);
    this.audio && this.audio.update(dt, this);
  }

  handleKeys() {
    const input = this.input;
    if (input.hit('build')) this.building.toggle();
    if (input.hit('journal')) openJournal(this);
    if (input.hit('lantern')) {
      this.player.lantern = !this.player.lantern;
      this.audio && this.audio.sfx('click');
    }
    for (const sys of this.systems) sys.onKeys && sys.onKeys(input);
  }

  region() {
    return regionAt(Math.floor(this.player.cx / TILE), Math.floor(this.player.cy / TILE));
  }

  render() {
    this.renderer.render(this);
  }

  // --- Rendu : appelé par le moteur de rendu ---------------------------------------
  drawWorldBack(g, view) {
    for (const c of this.colossi) if (c.buried) c.drawBehind(g, this, view);
  }

  drawWorld(g, view) {
    this.ecology.drawBack(g, view);
    for (const s of this.structures) if (this.inView(s, view)) s.draw(g, this);
    for (const c of this.colossi) if (c.drawBody) c.drawBody(g, this, view);
    for (const sys of this.systems) sys.drawBack && sys.drawBack(g, view);
    for (const e of this.entities) if (e.draw && this.inView(e, view)) e.draw(g, this);
    this.ecology.drawCreatures(g, view);
    for (const sys of this.systems) sys.draw && sys.draw(g, view);
    this.player.draw(g, this);
  }

  drawWorldFront(g, view) {
    for (const c of this.colossi) if (c.drawFront) c.drawFront(g, this, view);
    this.ecology.drawFront(g, view);
    this.particles.draw(g);
  }

  inView(e, view) {
    const m = 96;
    return e.x + (e.w || 0) > view.x - m && e.x < view.x + view.w + m && e.y + (e.h || 0) > view.y - m && e.y < view.y + view.h + m;
  }

  drawOverlay(g, view) {
    const p = this.player;
    if (p.hover && !this.ui.blocking() && !this.building.active) {
      const { tx, ty, def } = p.hover;
      g.strokeStyle = def.tool === 'main' ? 'rgba(255,240,200,0.8)' : 'rgba(255,140,120,0.6)';
      g.lineWidth = 1 / this.camera.zoom;
      g.strokeRect(tx * TILE + 0.5, ty * TILE + 0.5, TILE - 1, TILE - 1);
      if (p.useProgress > 0) {
        g.fillStyle = 'rgba(255,240,200,0.85)';
        g.fillRect(tx * TILE, ty * TILE + TILE + 2, TILE * Math.min(1, p.useProgress / def.time), 2);
      }
    }
    this.building.draw(g);
    for (const sys of this.systems) sys.drawOverlay && sys.drawOverlay(g, view);
  }

  drawScreen(g, vw, vh) {
    for (const sys of this.systems) sys.drawScreen && sys.drawScreen(g, vw, vh);
    if (this.debug) {
      g.fillStyle = 'rgba(0,0,0,0.5)';
      g.fillRect(4, 40, 240, 54);
      g.fillStyle = '#fff';
      g.font = '8px monospace';
      const p = this.player;
      g.fillText(`fps ${this.fps.toFixed(0)}  tuile ${Math.floor(p.cx / TILE)},${Math.floor(p.cy / TILE)}`, 8, 50);
      g.fillText(`état ${p.state}  zoom ${this.camera.zoom.toFixed(2)}  ${this.region().name}`, 8, 60);
      g.fillText(`heure ${this.env.hour.toFixed(1)} jour ${this.env.day}  entités ${this.entities.length}`, 8, 70);
    }
  }

  lights(view) {
    const out = [];
    const p = this.player;
    out.push({ x: p.cx, y: p.cy - 4, r: 40, i: 0.22 });
    if (p.lantern) out.push({ x: p.cx + p.facing * 4, y: p.cy - 4, r: 120, i: 0.85 });
    for (const s of this.structures) {
      if (!this.inView(s, view)) continue;
      const L = s.light && s.light();
      if (L) out.push(L);
    }
    for (const e of this.entities) {
      if (!e.light || !this.inView(e, view)) continue;
      const L = e.light(this);
      if (L) out.push(L);
    }
    for (const sys of this.systems) if (sys.lights) sys.lights(out, view);
    for (const c of this.colossi) c.lights(out);
    this.ecology.lights(out, view);
    return out;
  }
}
