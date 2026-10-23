// Colosses : le Dormeur enfoui, le Gardien, le chantier de la cale, la forge, le pilotage, les fonctions.
import { TILE, T, tileDef } from '../world/tiles.js';
import { CALE, CHASM } from '../world/generator.js';
import { MOD, LEG_ROWS, CMODULES, BASE_MODULES, DORMEUR, GARDIEN, parseColossus } from '../data/colossus.js';
import { Colossus } from '../entities/colossus.js';
import { Crate } from '../entities/crate.js';
import { analyzeColossus } from './colossusdesign.js';
import { planCost } from './inventory.js';
import { costText } from '../data/items.js';
import { openColossus, openForge } from '../ui/colossuspanel.js';

export class ColossusSystem {
  constructor(game) {
    this.game = game;
    game.colossusSys = this;
    game.sites = [];
    game.crates = [];
    this.known = new Set();
    this.forgeQueue = [];
    this.siteTimer = 0;
    this.working = null; // case où travaille le joueur
  }

  knownModules() {
    return [...this.known].map((id) => ({ id, ...CMODULES[id] }));
  }

  learnBase() {
    for (const m of BASE_MODULES) this.known.add(m);
    this.game.toast('Tu connais maintenant les plans des modules de colosse.', 'good');
  }

  planName(id) {
    return CMODULES[id] ? 'Module ' + CMODULES[id].name : null;
  }

  byType(t) {
    return this.game.colossi.find((c) => c.type === t);
  }

  // --- Apparition dans le monde ---------------------------------------------------
  spawn(pois) {
    const g = this.game;
    const w = g.world;
    const pd = pois.find((p) => p.type === 'dormeur');
    if (pd) {
      const cells = parseColossus(DORMEUR.rows, DORMEUR.states);
      const tx = pd.x - 12;
      // le dos du Dormeur affleure au sommet de la dune
      let top = 999;
      for (let x = tx; x < tx + 24; x++) top = Math.min(top, w.surface(x));
      const ty = top - 3;
      const c = new Colossus({ id: 'dormeur', name: DORMEUR.name, type: 'dormeur', cells, ox: tx * TILE, oy: ty * TILE, buried: true, palette: 'dormeur' });
      this.carve(c, ty);
      g.colossi.push(c);
    }
    const pg = pois.find((p) => p.type === 'gardien');
    if (pg) {
      const cells = parseColossus(GARDIEN.rows);
      const c = new Colossus({ id: 'gardien', name: GARDIEN.name, type: 'gardien', cells, ox: (pg.x - 10) * TILE, oy: 0, active: true, palette: 'gardien' });
      c.oy = pg.y * TILE - c.h;
      c.ai = guardianAI;
      c.data.patrol = [1446 * TILE, 1548 * TILE];
      g.colossi.push(c);
    }
  }

  // Dégage le sable à l'intérieur du Dormeur et creuse un accès jusqu'à sa trappe.
  carve(c, ty) {
    const w = this.game.world;
    const tx = Math.round(c.ox / TILE);
    for (let y = 0; y < c.gh; y++)
      for (let x = 0; x < c.gw; x++) {
        const id = c.grid.get(x, y);
        const inside = c.cellAtTile(x, y);
        if ((inside && !tileDef(id).solid) || id === T.LADDER || id === T.GRATE) w.raw(tx + x, ty + y, T.AIR);
      }
    // puits d'accès au-dessus de la salle de commande
    const cmd = c.cells.find((q) => q.m === 'commande');
    const hx = tx + cmd.x * MOD + 2;
    for (let y = ty - 12; y < ty + cmd.y * MOD; y++) {
      w.raw(hx, y, T.AIR);
      w.raw(hx - 1, y, T.AIR);
      w.raw(hx + 1, y, T.AIR);
    }
    w.raw(hx - 2, ty - 1, T.SAND);
    w.raw(hx + 2, ty - 1, T.SAND);
  }

  // --- Interactions : chaque case du colosse est un point d'action -------------------
  interactables() {
    const out = [];
    for (const c of this.game.colossi) {
      if (!c.anchors) c.anchors = {};
      for (const cell of c.cells) {
        const key = cell.x + ',' + cell.y;
        let a = c.anchors[key];
        if (!a) a = c.anchors[key] = { colossus: c, cell, interactable: true, prompt: (g) => this.cellPrompt(c, cell), interact: (g) => this.cellInteract(c, cell) };
        const r = c.cellRect(cell);
        a.x = r.x + 10;
        a.y = r.y + 8;
        a.w = r.w - 20;
        a.h = r.h - 8;
        out.push(a);
      }
    }
    return out;
  }

  cellPrompt(c, cell) {
    const g = this.game;
    const M = CMODULES[cell.m];
    const key = cell.x + ',' + cell.y;
    const work = c.work[key] || 0;
    if (this.working && this.working.cell === cell) return { text: `Au travail : ${M.name}`, info: `${Math.round((work / (M.work || 30)) * 100)} %` };
    switch (cell.state) {
      case 'plan':
        if ((M.grown || M.ancient) && g.inv.items[cell.m] > 0) return { text: `Greffer : ${M.name}` };
        if (M.grown) return { text: `Prévu : ${M.name}`, info: 'un organe à faire croître dans la Matrice' };
        if (M.ancient) return { text: `Prévu : ${M.name}`, info: 'un organe ancien, introuvable en forge' };
        return { text: `Prévu : ${M.name}`, info: 'à fabriquer à la forge' };
      case 'manquant':
        if ((M.grown || M.ancient) && g.inv.items[cell.m] > 0) return { text: `Greffer : ${M.name}` };
        if (M.grown) return { text: `Emplacement vide : ${M.name}`, info: 'un organe à faire croître dans la Matrice' };
        return { text: `Emplacement vide : ${M.name}`, info: 'facultatif si le colosse reste équilibré' };
      case 'livre':
        return { text: `Installer : ${M.name}`, info: `${Math.round((work / (M.work || 30)) * 100)} %` };
      case 'endommage': {
        if (c.paid[key]) return { text: `Réparer : ${M.name}`, info: `${Math.round((work / (M.work || 30)) * 100)} %` };
        return { text: `Réparer : ${M.name}`, cost: this.repairCost(cell) };
      }
    }
    if (cell.m === 'commande') {
      if (c.active && !c.buried) return { text: c.pilot ? 'Quitter les commandes' : 'Prendre les commandes', info: c.name };
      return { text: c.type === 'dormeur' ? 'Éveiller le Dormeur' : 'Activer le colosse', info: this.readiness(c) };
    }
    if (cell.m === 'memoire' && c.type === 'gardien' && !c.data.resolved) return { text: 'Toucher la mémoire du Gardien' };
    if (cell.m === 'habitat' && c.active) return { text: 'Se reposer dans l’habitat' };
    return { text: M.name, info: 'examiner', key: 'interact' };
  }

  repairCost(cell) {
    const base = CMODULES[cell.m].cost || { ferraille: 20 };
    const out = {};
    for (const [k, v] of Object.entries(base)) out[k] = Math.max(1, Math.round(v * 0.4));
    return out;
  }

  readiness(c) {
    const a = analyzeColossus(c.cells);
    const err = a.issues.find((i) => i.level === 'erreur');
    return err ? err.text : 'prêt';
  }

  cellInteract(c, cell) {
    const g = this.game;
    const M = CMODULES[cell.m];
    const key = cell.x + ',' + cell.y;
    if (this.working && this.working.cell === cell) {
      this.working = null;
      return;
    }
    switch (cell.state) {
      case 'plan':
      case 'manquant':
        if ((M.grown || M.ancient) && g.inv.items[cell.m] > 0) {
          g.inv.items[cell.m]--;
          cell.state = 'livre';
          c.work[key] = 0;
          this.startWork(c, cell);
        } else openColossus(g, c);
        return;
      case 'livre':
        this.startWork(c, cell);
        return;
      case 'endommage':
        if (!c.paid[key]) {
          const cost = this.repairCost(cell);
          if (!g.inv.pay(cost)) {
            g.toast('Il manque : ' + costText(g.inv.missing(cost)), 'bad');
            return;
          }
          c.paid[key] = true;
        }
        this.startWork(c, cell);
        return;
    }
    if (cell.m === 'commande') {
      if (c.active && !c.buried) this.togglePilot(c);
      else this.activate(c);
      return;
    }
    if (cell.m === 'memoire' && c.type === 'gardien' && !c.data.resolved) {
      this.guardianChoice(c);
      return;
    }
    if (cell.m === 'habitat' && c.active) {
      g.rest({ cx: g.player.cx, y: g.player.y, h: g.player.h, data: {} });
      return;
    }
    openColossus(g, c);
  }

  startWork(c, cell) {
    this.working = { colossus: c, cell };
    this.game.toast('Tu travailles au module. Reste à côté ; des robots soudeurs peuvent aider (ordre « Chantier »).');
  }

  // --- Travaux : le joueur et les robots ajoutent du travail ---------------------------
  update(dt) {
    const g = this.game;
    // sites pour les robots
    this.siteTimer -= dt;
    if (this.siteTimer <= 0) {
      this.siteTimer = 1;
      g.sites = [];
      for (const c of g.colossi)
        for (const cell of c.cells) {
          const key = cell.x + ',' + cell.y;
          if (cell.state === 'livre' || (cell.state === 'endommage' && c.paid[key])) {
            const r = c.cellRect(cell);
            g.sites.push({ x: r.x + r.w / 2, y: r.y + r.h - 20, label: CMODULES[cell.m].name, addWork: (k) => this.addWork(c, cell, k), done: false });
          }
        }
      // les gravats de la cale sont aussi un chantier
    }
    if (this.working) {
      const { colossus: c, cell } = this.working;
      const r = c.cellRect(cell);
      const p = g.player;
      const near = Math.abs(p.cx - (r.x + r.w / 2)) < r.w * 0.8 && Math.abs(p.cy - (r.y + r.h / 2)) < r.h;
      if (!near) this.working = null;
      else {
        p.using = true;
        this.addWork(c, cell, dt);
        if (Math.random() < dt * 5) g.particles.sparks(p.cx + p.facing * 8, p.cy - 4, 2);
        if (Math.random() < dt * 3) g.audio && g.audio.sfx('weld');
      }
    }
    // forge
    for (const job of this.forgeQueue) {
      const f = g.structures.find((s) => s.id === job.forge);
      if (!f || f.ruined) continue;
      f.busy = true;
      const eff = f.lieu && f.lieu.energyProd > 0 ? f.lieu.energyRatio : 0;
      f.active = eff > 0;
      job.progress += dt * eff * (g.survivors.bonus('robots') > 1 ? 1.25 : 1);
      if (job.progress >= job.total) {
        job.done = true;
        f.busy = false;
        this.forged(f, job);
      }
      break; // une seule pièce à la fois
    }
    this.forgeQueue = this.forgeQueue.filter((j) => !j.done);
    // pont roulant : les caisses posées dans la cale rejoignent seules leur place
    for (const crate of g.entities) {
      if (crate.kind !== 'crate' || crate.carrier || crate.delivered) continue;
      const tx = crate.cx / TILE;
      if (tx > CALE.x0 - 40 && tx < CALE.x1 + 50 && crate.payload.colossus) {
        crate.craneT = (crate.craneT || 0) + dt;
        if (crate.craneT > 1.5) {
          const d = this.destFor(crate);
          if (d) {
            crate.x += (d.x - crate.cx) * Math.min(1, dt * 1.2);
            crate.y += (d.y - 30 - crate.cy) * Math.min(1, dt * 1.2);
            crate.vy = 0;
            crate.hanging = true;
            if (Math.abs(d.x - crate.cx) < 6 && Math.abs(d.y - 30 - crate.cy) < 8) this.crateArrived(crate);
          }
        }
      }
    }
    g.crates = g.entities.filter((e) => e.kind === 'crate' && !e.delivered);
    // fonctions des colosses en marche
    for (const c of g.colossi) this.functions(c, dt);
    // pilotage : la caméra recule
    const pc = g.colossi.find((c) => c.pilot);
    if (pc) {
      const p = g.player;
      const cmd = pc.cells.find((q) => q.m === 'commande');
      const r = pc.cellRect(cmd);
      p.x = r.x + r.w / 2 - p.w / 2;
      p.y = r.y + r.h - TILE - p.h;
      p.vx = p.vy = 0;
      p.state = 'sit';
      g.ui.setStatus(this.pilotStatus(pc));
    }
  }

  addWork(c, cell, k) {
    const g = this.game;
    const key = cell.x + ',' + cell.y;
    const M = CMODULES[cell.m];
    c.work[key] = (c.work[key] || 0) + k;
    if (c.work[key] >= (M.work || 30)) {
      cell.state = 'ok';
      delete c.work[key];
      delete c.paid[key];
      if (this.working && this.working.cell === cell) this.working = null;
      c.build();
      g.audio && g.audio.sfx('build');
      g.toast(`${M.name} : installé.`, 'good');
      g.camera.shake(2);
      const a = analyzeColossus(c.cells);
      if (a.ok && !c.active) g.toast(`${c.name} semble prêt. Va dans sa salle de commande.`, 'good');
    }
  }

  // --- Caisses de modules ------------------------------------------------------------
  destFor(crate) {
    const c = this.game.colossi.find((q) => q.id === crate.payload.colossus);
    if (!c) return null;
    const cell = c.cells.find((q) => q.x === crate.payload.slot[0] && q.y === crate.payload.slot[1]);
    if (!cell) return null;
    const r = c.cellRect(cell);
    return { x: r.x + r.w / 2, y: r.y + r.h / 2 };
  }

  crateArrived(crate) {
    const g = this.game;
    const c = g.colossi.find((q) => q.id === crate.payload.colossus);
    if (!c) return;
    const cell = c.cells.find((q) => q.x === crate.payload.slot[0] && q.y === crate.payload.slot[1]);
    crate.delivered = true;
    g.entities = g.entities.filter((e) => e !== crate);
    if (g.player.dragging === crate) g.player.dragging = null;
    if (cell && (cell.state === 'plan' || cell.state === 'manquant')) {
      cell.state = 'livre';
      c.work[cell.x + ',' + cell.y] = 0;
      g.toast(`${CMODULES[cell.m].name} en place. Il reste à l’installer (souder, relier).`, 'good');
      g.audio && g.audio.sfx('thud');
    }
  }

  // --- Forge ---------------------------------------------------------------------------
  structurePrompt(s) {
    if (s.type !== 'forge' || s.ruined) return null;
    const j = this.forgeQueue.find((q) => q.forge === s.id);
    return { text: 'Forge colossale', info: j ? `${CMODULES[j.module].name} : ${Math.round((j.progress / j.total) * 100)} %` : s.lieu && s.lieu.energyProd > 0 ? 'prête' : 'il faut de l’énergie : un refuge et une chaudière à côté' };
  }

  structureInteract(s) {
    if (s.type !== 'forge' || s.ruined) return false;
    openForge(this.game, s);
    return true;
  }

  forgeCost(m) {
    return planCost(CMODULES[m].cost, this.known.has(m));
  }

  queueForge(forge, colossus, cell) {
    const g = this.game;
    const cost = this.forgeCost(cell.m);
    if (!g.inv.pay(cost)) return g.toast('Il manque : ' + costText(g.inv.missing(cost)), 'bad');
    this.forgeQueue.push({ forge: forge.id, colossus: colossus.id, slot: [cell.x, cell.y], module: cell.m, progress: 0, total: (CMODULES[cell.m].work || 30) * 1.2 });
    cell.queued = true;
    g.audio && g.audio.sfx('build');
  }

  forged(f, job) {
    const g = this.game;
    const M = CMODULES[job.module];
    const crate = new Crate(f.cx + 30, f.y + f.h, { module: job.module, colossus: job.colossus, slot: job.slot, label: M.name });
    g.entities.push(crate);
    g.toast(`La forge a produit : ${M.name}.`, 'good');
    g.audio && g.audio.sfx('anvil');
  }

  onRestored(s) {
    if (s.type === 'forge') this.game.toast('La forge colossale peut fabriquer des modules, si son lieu a de l’énergie.', 'good');
  }

  // --- Chantier : un nouveau colosse dans la cale ------------------------------------
  newChantier(cells, name) {
    const g = this.game;
    const maxY = Math.max(...cells.map((c) => c.y));
    const tx = CALE.x0 + 6;
    const bodyRows = (maxY + 1) * MOD;
    const legs = cells.some((c) => c.m === 'jambe') ? LEG_ROWS : 3;
    const oy = (CALE.floor + 1) * TILE - (bodyRows + legs) * TILE;
    const c = new Colossus({ id: 'construit' + (g.colossi.filter((q) => q.type === 'construit').length + 1), name: name || 'Mon colosse', type: 'construit', cells: cells.map((q) => ({ ...q, state: 'plan' })), ox: tx * TILE, oy, palette: 'built' });
    g.colossi.push(c);
    g.toast(`La quille de ${c.name} est posée dans la cale. Chaque module doit être forgé, apporté, installé.`, 'good');
    g.note('chantier');
    return c;
  }

  // Le terrain de la cale doit être dégagé là où se dressera le colosse.
  blockedTiles(c) {
    const w = this.game.world;
    const tx0 = Math.floor(c.ox / TILE);
    const ty0 = Math.floor(c.oy / TILE);
    let n = 0;
    for (let y = ty0; y < ty0 + c.gh; y++) for (let x = tx0; x < tx0 + c.gw; x++) if (tileDef(w.get(x, y)).solid) n++;
    return n;
  }

  // --- Activation, éveil --------------------------------------------------------------
  async activate(c) {
    const g = this.game;
    const a = analyzeColossus(c.cells);
    if (!a.ok) {
      const errs = a.issues.filter((i) => i.level === 'erreur').map((i) => i.text);
      g.ui.dialog([{ who: c.name, text: 'Le colosse ne répond pas encore. ' + errs.join(' ') }]);
      return;
    }
    if (c.type === 'construit' && this.blockedTiles(c) > 6) {
      g.toast('Les gravats de la cale entravent encore le colosse : dégage le terrain (robots, ordre « Déblayer »).', 'bad');
      return;
    }
    if (c.type === 'dormeur') await this.wakeDormeur(c);
    else await this.firstActivation(c);
  }

  async wakeDormeur(c) {
    const g = this.game;
    const w = g.world;
    await g.cine.run(async (k) => {
      k.focus(c.cx, c.cy, 0.8);
      k.zoom(3);
      k.sfx('heartbeat');
      await k.caption('Sous le sable, quelque chose prend une longue inspiration.', 3.5);
      k.sfx('rumble');
      // le sable s'écoule de ses épaules : un cratère restera
      const tx0 = Math.floor(c.ox / TILE) - 3;
      const ty0 = Math.floor(c.oy / TILE) - 14;
      const tx1 = tx0 + c.gw + 6;
      const ty1 = Math.floor((c.oy + c.h) / TILE);
      for (let y = ty0; y <= ty1; y += 2) {
        w.setArea(tx0, y, tx1, y + 1, T.AIR, (id) => id === T.SAND || id === T.ROCK || id === T.RUBBLE);
        k.shake(3);
        for (let i = 0; i < 4; i++) g.particles.dust(tx0 * TILE + Math.random() * (tx1 - tx0) * TILE, y * TILE, 0, 4);
        await k.wait(0.12);
      }
      c.buried = false;
      c.active = true;
      c.build();
      k.sfx('horn');
      k.shake(8);
      await k.caption('Le Dormeur se lève.', 3, true);
      // il se redresse jusqu'au fond du cratère
      for (let i = 0; i < 40; i++) {
        c.tryMove(g, 0.001, 0.05);
        await k.wait(0.05);
      }
      await k.caption('Il attend qu’on le guide.', 2.5);
      k.zoom(0);
      k.release();
    });
    g.setFlag('dormeur_eveille');
    g.note('dormeur_eveille');
    g.note('canal');
    g.toast('Dans sa salle de commande, tu peux maintenant piloter le Dormeur. Son bras peut creuser.', 'good');
    g.save && g.save(true);
  }

  async firstActivation(c) {
    const g = this.game;
    await g.cine.run(async (k) => {
      k.focus(c.cx, c.cy, 0.8);
      k.zoom(3);
      k.sfx('rumble');
      for (let i = 0; i < 6; i++) {
        k.shake(4);
        g.particles.steam(c.cx + (Math.random() - 0.5) * c.w, c.oy, 3, 2);
        await k.wait(0.4);
      }
      c.active = true;
      k.sfx('horn');
      k.shake(9);
      await k.caption(`${c.name} ouvre les yeux.`, 3, true);
      // il sort de la cale
      for (let i = 0; i < 60; i++) {
        c.tryMove(g, 0.001, 0.05);
        await k.wait(0.04);
      }
      await k.caption('Des heures de travail, des centaines de pièces. Et maintenant, un géant.', 3.5);
      k.zoom(0);
      k.release();
    });
    g.setFlag('colosse_construit');
    g.save && g.save(true);
  }

  togglePilot(c) {
    const g = this.game;
    if (c.pilot) {
      c.pilot = null;
      g.player.frozen = false;
      g.camera.setZoomIndex(0);
      g.ui.setStatus('');
      return;
    }
    c.pilot = g.player;
    g.player.frozen = true;
    g.camera.setZoomIndex(3);
    const k = (a) => g.input.label(a);
    g.toast(`Aux commandes de ${c.name} : ${k('left')} ${k('right')} pour marcher, 1 à 4 pour ses fonctions, ${k('interact')} pour quitter.`);
  }

  pilotStatus(c) {
    const a = analyzeColossus(c.cells);
    const fns = this.fnList(c);
    return `${c.name} · énergie ${a.energy >= 0 ? '+' : ''}${a.energy} · ` + fns.map((f, i) => `[${i + 1}] ${f.label}`).join(' · ');
  }

  fnList(c) {
    const a = analyzeColossus(c.cells);
    const out = [];
    if (a.fns.excavation) out.push({ id: 'excavation', label: 'Creuser' });
    if (a.fns.pont) out.push({ id: 'pont', label: `Déployer le pont (${a.reach})` });
    if (a.fns.arme) out.push({ id: 'arme', label: 'Canon' });
    if (a.fns.restauration) out.push({ id: 'serre', label: c.data.serreOn ? 'Serre : active' : 'Serre : au repos' });
    return out;
  }

  onKeys(input) {
    const g = this.game;
    const c = g.colossi.find((q) => q.pilot);
    if (!c) return;
    if (input.hit('interact')) {
      this.togglePilot(c);
      input.pressed.delete('KeyE');
      return;
    }
    const fns = this.fnList(c);
    for (let i = 0; i < fns.length; i++) if (input.keyHit('Digit' + (i + 1))) this.useFunction(c, fns[i].id);
  }

  // --- Fonctions : creuser, pont, canon, serre ------------------------------------
  useFunction(c, id) {
    const g = this.game;
    const w = g.world;
    const front = c.facing > 0 ? c.ox + c.w : c.ox;
    const fx = Math.floor(front / TILE) + c.facing * 3;
    const groundY = Math.floor((c.oy + c.h) / TILE);
    if (id === 'excavation' || id === 'arme') {
      const R = id === 'arme' ? 4 : 6;
      const cy = id === 'arme' ? Math.floor((c.oy + c.bodyRows * TILE * 0.6) / TILE) : groundY - 2;
      const cx = fx + c.facing * (id === 'arme' ? 8 : 2);
      let n = 0;
      for (let y = cy - R; y <= cy + R; y++)
        for (let x = cx - R; x <= cx + R; x++) {
          if ((x - cx) ** 2 + (y - cy) ** 2 > R * R) continue;
          if (w.sealed && w.sealed[x]) continue;
          const id2 = w.get(x, y);
          const d = tileDef(id2);
          if (!d.solid || id2 === T.BEDROCK || id2 === T.METAL) continue;
          w.raw(x, y, T.AIR);
          n++;
          if (d.yields && Math.random() < 0.3) g.inv.addAll(d.yields);
        }
      w.setArea(cx - R, cy - R, cx + R, cy + R, T.AIR, () => false);
      c.data.digging = 1;
      setTimeout(() => (c.data.digging = 0), 900);
      g.camera.shake(id === 'arme' ? 7 : 5);
      g.audio && g.audio.sfx(id === 'arme' ? 'cannon' : 'dig');
      for (let i = 0; i < 14; i++) g.particles.dust(cx * TILE + (Math.random() - 0.5) * R * 32, cy * TILE + (Math.random() - 0.5) * R * 32, c.facing, 3);
      if (id === 'arme') for (let i = 0; i < 6; i++) g.particles.steam(cx * TILE, cy * TILE, 2, 3);
      this.checkCanal(cx, cy);
      return;
    }
    if (id === 'pont') {
      const a = analyzeColossus(c.cells);
      // chercher le vide devant
      let x = Math.floor(front / TILE);
      let gap0 = null;
      for (let k = 0; k < 20; k++) {
        const xx = x + c.facing * k;
        if (w.surface(xx) > groundY + 6) {
          gap0 = xx;
          break;
        }
      }
      if (gap0 === null) return g.toast('Rien à franchir devant le colosse.', 'bad');
      let gap1 = null;
      for (let k = 0; k <= a.reach; k++) {
        const xx = gap0 + c.facing * k;
        if (w.surface(xx) <= groundY + 2) {
          gap1 = xx;
          break;
        }
      }
      if (gap1 === null) return g.toast(`Le vide est trop large pour ${a.reach} cases de pont. Il faudrait plus de modules de pont.`, 'bad');
      this.deployBridge(c, gap0, gap1, groundY);
    }
    if (id === 'serre') {
      c.data.serreOn = !c.data.serreOn;
      g.toast(c.data.serreOn ? 'La serre ambulante répand humidité et graines sur son passage.' : 'La serre ambulante se referme.');
    }
  }

  async deployBridge(c, x0, x1, y) {
    const g = this.game;
    const w = g.world;
    const a = Math.min(x0, x1);
    const b = Math.max(x0, x1);
    await g.cine.run(async (k) => {
      k.focus(((a + b) / 2) * TILE, y * TILE, 1);
      k.zoom(4);
      k.sfx('rumble');
      for (let x = c.facing > 0 ? a : b; c.facing > 0 ? x <= b : x >= a; x += c.facing) {
        w.raw(x, y, T.GIRDER);
        w.raw(x, y - 1, T.AIR);
        if ((x - a) % 10 === 5) for (let yy = y + 1; yy < y + 14; yy++) if (!w.solid(x, yy)) w.raw(x, yy, T.TRUSS);
        if ((x - a) % 3 === 0) {
          w.setArea(x - 2, y - 2, x + 1, y + 14, T.AIR, () => false);
          k.shake(1.5);
          await k.wait(0.06);
        }
      }
      w.setArea(a - 1, y - 2, b + 1, y + 14, T.AIR, () => false);
      await k.caption('Un pont de colosse enjambe le vide. Il restera là bien après nous.', 3.5);
      k.zoom(0);
      k.release();
    });
    if (a <= CHASM.x0 + 4 && b >= CHASM.x1 - 4) {
      g.setFlag('pont');
      g.note('pont');
    }
    g.save && g.save(true);
  }

  // L'ancien canal : creuser près de lui rend l'eau aux dunes.
  checkCanal(cx, cy) {
    const g = this.game;
    const p = g.pois.find((q) => q.type === 'canal');
    if (!p || g.flags.irrigation) return;
    if (cx >= p.x0 - 6 && cx <= p.x1 + 6 && Math.abs(cy - p.y) < 14) this.irrigate(p);
  }

  async irrigate(p) {
    const g = this.game;
    g.setFlag('irrigation');
    await g.cine.run(async (k) => {
      k.focus(p.x * TILE, p.y * TILE, 1);
      k.zoom(3);
      k.sfx('water');
      // le canal s'ouvre sur toute sa longueur, puis l'eau s'y engouffre
      for (let i = 0; i < p.tops.length; i++) {
        const x = p.x0 + i;
        const sy = p.tops[i];
        g.world.setArea(x, sy - 2, x, sy + 2, T.AIR, (id) => id === T.SAND || id === T.ROCK || id === T.RUBBLE);
        if (i % 4 === 0) {
          k.shake(1);
          await k.wait(0.04);
        }
      }
      for (let i = 0; i < p.tops.length; i++) {
        const x = p.x0 + i;
        g.world.setArea(x, p.tops[i] + 1, x, p.tops[i] + 2, T.WATER, (id) => id === T.AIR);
        if (i % 6 === 0) await k.wait(0.04);
      }
      await k.caption('Le bras du Dormeur crève la croûte. Dessous, l’ancien canal, et l’eau des conduites qui s’y engouffre.', 4.5);
      await k.caption('Les Dunes Muettes vont boire.', 3);
      k.zoom(0);
      k.release();
    });
    g.toast('Le désert devient plus humide : l’herbe pourra y tenir. Sème, arrose, relâche des brouteurs.', 'good');
  }

  functions(c, dt) {
    const g = this.game;
    if (!c.active || !c.data.serreOn || Math.abs(c.speed) < 1) return;
    const a = analyzeColossus(c.cells);
    const k = (a.fns.eau ? 2 : 1) * dt;
    const tx = Math.floor(c.cx / TILE);
    g.ecology.boost(tx, 100, 0.02 * k, 0.004 * k);
    c.data.sowT = (c.data.sowT || 0) + dt;
    if (c.data.sowT > 4) {
      c.data.sowT = 0;
      for (const id in g.inv.seeds) {
        if (g.inv.seeds[id] <= 0) continue;
        const z = g.ecology.zoneAt(tx, 100);
        if ((z.plants[id] || 0) > 0.05) continue;
        g.inv.seeds[id]--;
        g.ecology.plant(id, tx, 100, 0.1);
        break;
      }
    }
  }

  // --- Le Gardien -----------------------------------------------------------------------
  async guardianChoice(c) {
    const g = this.game;
    const r = await g.ui.dialog([
      { who: '', text: 'La mémoire du Gardien palpite sous ta main. Des images te traversent : une porte, un ordre, un temps si long qu’il n’a plus de forme.' },
      { who: '', text: '« Que personne ne passe. » C’est tout ce qui reste de lui.' },
      {
        who: '',
        text: 'Que fais-tu ?',
        choices: [
          { text: 'L’apaiser : poser les mains, attendre, lui faire comprendre que la garde est finie.', value: 'apaiser' },
          { text: 'Le démanteler : arracher la mémoire. La porte s’ouvrira, le colosse ne bougera plus jamais.', value: 'demanteler' },
        ],
      },
    ]);
    if (!r) return;
    c.data.resolved = r;
    const gate = g.pois.find((p) => p.type === 'porte_gardien');
    if (r === 'apaiser') {
      await g.cine.run(async (k) => {
        k.focus(c.cx, c.cy, 1);
        k.zoom(3);
        k.sfx('heartbeat');
        await k.caption('Longtemps, rien. Puis la lumière de la mémoire se fait plus douce.', 3.5);
        c.ai = null;
        c.speed = 0;
        c.data.calm = true;
        c.kneel = 1;
        k.sfx('horn');
        await k.caption('Le Gardien s’agenouille. Loin derrière lui, la grande porte s’ouvre.', 3.5);
        g.world.setArea(gate.x0, gate.y0, gate.x1, gate.y1, T.AIR);
        k.release();
        k.zoom(0);
      });
      g.setFlag('gardien', 'apaise');
      g.note('gardien_apaise');
    } else {
      await g.cine.run(async (k) => {
        k.focus(c.cx, c.cy, 1);
        k.zoom(3);
        k.sfx('rumble');
        k.shake(8);
        await k.caption('La mémoire se détache dans un bruit de racines arrachées.', 3);
        // le colosse s'effondre : un amas de métal reste dans la vallée
        const tx0 = Math.floor(c.ox / TILE);
        const gy = Math.floor((c.oy + c.h) / TILE);
        g.colossi = g.colossi.filter((q) => q !== c);
        for (let x = tx0 - 2; x < tx0 + c.gw + 2; x++) {
          const hh = Math.round(Math.sin(((x - tx0 + 2) / (c.gw + 4)) * Math.PI) * 7);
          for (let k2 = 1; k2 <= hh; k2++) g.world.raw(x, gy - k2, (x + k2) % 5 === 0 ? T.GEARBOX : (x * k2) % 3 ? T.SCRAP : T.METAL);
        }
        g.world.setArea(tx0 - 3, gy - 9, tx0 + c.gw + 3, gy, T.AIR, () => false);
        k.shake(10);
        k.sfx('thud');
        await k.caption('Le Gardien tombe. La porte de l’est s’ouvre sur la Serre.', 3.5);
        g.world.setArea(gate.x0, gate.y0, gate.x1, gate.y1, T.AIR);
        k.release();
        k.zoom(0);
      });
      g.inv.addAll({ ferraille: 60, rouages: 12 });
      g.inv.items.coeur_org = (g.inv.items.coeur_org || 0) + 1;
      g.toast('Tu récupères 60 ferraille, 12 rouages et son cœur organique, qui pourra animer un autre colosse.', 'good');
      g.setFlag('gardien', 'demonte');
      g.note('gardien_demonte');
    }
    g.save && g.save(true);
  }

  toJSON() {
    return { colossi: this.game.colossi.map((c) => c.toJSON()), known: [...this.known], forge: this.forgeQueue, crates: this.game.entities.filter((e) => e.kind === 'crate').map((c) => c.toJSON()) };
  }

  load(o) {
    if (!o) return;
    const g = this.game;
    this.known = new Set(o.known || []);
    this.forgeQueue = o.forge || [];
    g.colossi = (o.colossi || []).map((d) => {
      const c = new Colossus(d);
      if (d.type === 'gardien' && !d.data.resolved) {
        c.ai = guardianAI;
      }
      return c;
    });
    for (const d of o.crates || []) g.entities.push(new Crate(d.x, d.y, d.payload, { id: d.id }));
  }
}

// Patrouille du Gardien : il va et vient devant la porte et bouscule qui reste à ses pieds.
function guardianAI(c, dt, game) {
  const [a, b] = c.data.patrol;
  c.data.pause = (c.data.pause || 0) - dt;
  if (c.data.pause > 0) {
    c.speed *= 0.9;
    c.kneel += (0.6 - c.kneel) * dt;
    return;
  }
  c.kneel += (0 - c.kneel) * dt * 2;
  const dir = c.data.dir || 1;
  if (dir > 0 && c.ox > b) {
    c.data.dir = -1;
    c.data.pause = 7;
    c.facing = -1;
  } else if (dir < 0 && c.ox < a) {
    c.data.dir = 1;
    c.data.pause = 7;
    c.facing = 1;
  }
  c.facing = c.data.dir || 1;
  c.speed += (c.facing * 22 - c.speed) * Math.min(1, dt);
  // piétinement
  const p = game.player;
  if (p.onGround && p.groundRef === game.world && Math.abs(c.speed) > 5) {
    for (const f of c.feet()) {
      if (Math.abs(p.cx - f.x) < 34 && Math.abs(p.y + p.h - (c.oy + c.h)) < 40 && !p.stun) {
        p.vx = Math.sign(p.cx - f.x || 1) * 340;
        p.vy = -260;
        p.stun = 0.7;
        p.hurt = 0.8;
        game.camera.shake(6);
        game.audio && game.audio.sfx('hurt');
        if (!c.data.warned) {
          c.data.warned = true;
          game.toast('Le Gardien piétine tout ce qui reste à ses pieds. Grimpe par ses jambes quand il s’arrête.', 'bad');
          game.note('gardien');
        }
      }
    }
  }
}
