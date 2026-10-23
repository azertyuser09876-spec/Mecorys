// L'humain contrôlé par le joueur : marche, saut, escalade, nage, rebords, outil.
import { TILE, T, tileDef } from '../world/tiles.js';
import { moveBody, boxBlocked, climbAt, liquidAt, pointTile } from '../world/physics.js';
import { drawHuman, updateScarf, defaultLook } from '../render/character.js';
import { clamp } from '../core/rng.js';

const WALK = 80;
const RUN = 132;
const ACC = 950;
const DEC = 1300;
const AIR_ACC = 560;
const GRAV = 980;
const JUMP = 305;
const MAX_FALL = 820;
const CLIMB = 62;
const SWIM = 74;
const REACH = 3.4 * TILE;

export class Player {
  constructor(x, y, look) {
    this.x = x;
    this.y = y;
    this.w = 10;
    this.h = 26;
    this.vx = 0;
    this.vy = 0;
    this.facing = 1;
    this.state = 'ground';
    this.onGround = false;
    this.coyote = 0;
    this.jumpBuf = 0;
    this.dropTimer = 0;
    this.phase = 0;
    this.t = 0;
    this.look = look || defaultLook();
    this.scarf = [];
    this.breath = 1;
    this.fallStartY = y;
    this.airTime = 0;
    this.stun = 0;
    this.mantle = null;
    this.visualDY = 0;
    this.useTarget = null;
    this.useProgress = 0;
    this.using = false;
    this.lantern = false;
    this.riding = null;
    this.frozen = false;
    this.hurt = 0;
    this.stepTimer = 0;
    this.lastSurface = T.SAND;
  }

  get cx() {
    return this.x + this.w / 2;
  }
  get cy() {
    return this.y + this.h / 2;
  }
  get feetX() {
    return this.x + this.w / 2;
  }
  get feetY() {
    return this.y + this.h;
  }

  teleport(x, y) {
    this.x = x - this.w / 2;
    this.y = y - this.h;
    this.vx = this.vy = 0;
    this.fallStartY = this.y;
    this.state = 'air';
    this.scarf.length = 0;
  }

  update(dt, game) {
    this.t += dt;
    const input = game.input;
    const grids = game.grids();
    const canAct = !this.frozen && !game.ui.blocking();

    let mx = 0;
    let my = 0;
    if (canAct) {
      if (input.is('left')) mx -= 1;
      if (input.is('right')) mx += 1;
      if (input.is('up')) my -= 1;
      if (input.is('down')) my += 1;
    }
    const run = canAct && input.is('run');
    if (canAct && input.hit('jump')) this.jumpBuf = 0.13;
    else this.jumpBuf = Math.max(0, this.jumpBuf - dt);
    this.coyote = Math.max(0, this.coyote - dt);
    this.dropTimer = Math.max(0, this.dropTimer - dt);
    this.visualDY *= Math.pow(0.0005, dt);
    if (Math.abs(this.visualDY) < 0.2) this.visualDY = 0;
    this.hurt = Math.max(0, this.hurt - dt);

    if (this.riding) {
      this.x = this.riding.seatX() - this.w / 2;
      this.y = this.riding.seatY() - this.h;
      this.vx = this.riding.vx;
      this.vy = 0;
      this.facing = this.riding.facing;
      this.state = 'ride';
      return;
    }

    // Transport par un colosse ou une plateforme mobile
    if (this.carrier) {
      this.x += this.carrier.dx || 0;
      this.y += this.carrier.dy || 0;
    }

    if (this.stun > 0) {
      this.stun -= dt;
      mx = 0;
      my = 0;
    }

    if (this.mantle) {
      const m = this.mantle;
      m.t += dt / m.dur;
      const k = Math.min(1, m.t);
      const e = k < 0.5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2;
      this.x = m.x0 + (m.x1 - m.x0) * e;
      this.y = m.y0 + (m.y1 - m.y0) * Math.min(1, e * 1.4);
      if (k >= 1) {
        this.mantle = null;
        this.state = 'ground';
        this.vx = this.facing * 20;
        this.vy = 0;
        this.fallStartY = this.y;
      }
      this.phase += dt * 10;
      return;
    }

    const inWater = liquidAt(grids, this.cx, this.cy);
    const headWater = liquidAt(grids, this.cx, this.y + 3);
    const climbG = climbAt(grids, this.cx, this.cy);

    // Changements d'état
    if (inWater && this.state !== 'swim') {
      this.state = 'swim';
      this.vy *= 0.35;
      this.fallStartY = this.y;
      game.audio && game.audio.sfx('splash', { x: this.cx, y: this.cy });
      game.particles.splash(this.cx, this.cy);
    } else if (!inWater && this.state === 'swim') {
      this.state = 'air';
      this.fallStartY = this.y;
    }
    // descendre une échelle qui part sous une passerelle
    if (this.state !== 'climb' && this.onGround && my > 0 && !climbG && this.onPlatform(grids) && climbAt(grids, this.cx, this.y + this.h + 10)) {
      this.state = 'climb';
      this.y += 4;
      this.vx = this.vy = 0;
      this.dropTimer = 0;
    }
    if (this.state !== 'climb' && this.state !== 'swim' && climbG && my !== 0 && this.dropTimer <= 0) {
      // On s'agrippe à une échelle ou une liane
      if (!(my > 0 && this.onGround && !climbAt(grids, this.cx, this.y + this.h + 4))) {
        this.state = 'climb';
        this.vx = 0;
        this.vy = 0;
      }
    }

    if (this.state === 'climb') {
      if (!climbG) {
        // Arrivée en haut : petit saut pour se hisser
        this.state = 'air';
        if (my < 0) this.vy = -150;
        this.fallStartY = this.y;
      } else {
        this.vx = mx * CLIMB * 0.7;
        this.vy = my * CLIMB * (run ? 1.5 : 1);
        if (mx !== 0) this.facing = mx;
        if (mx !== 0 || my !== 0) this.phase += dt * 9;
        moveBody(this, dt, grids, { drop: true });
        this.fallStartY = this.y;
        if (this.jumpBuf > 0) {
          this.jumpBuf = 0;
          this.state = 'air';
          this.vy = -JUMP * 0.75;
          this.vx = (mx || this.facing) * 70;
          this.dropTimer = 0.25;
        }
        if (this.onGround && my > 0) this.state = 'ground';
        this.updateScarf(game, dt);
        this.toolUpdate(dt, game);
        return;
      }
    }

    if (this.state === 'swim') {
      const target = SWIM * (run ? 1.35 : 1);
      this.vx += (mx * target - this.vx) * Math.min(1, dt * 4);
      const surfacing = !headWater;
      let ty = my * target;
      if (my === 0) ty = surfacing ? 0 : -18; // flottabilité douce
      this.vy += (ty - this.vy) * Math.min(1, dt * 3.5);
      if (surfacing && this.jumpBuf > 0) {
        this.vy = -JUMP * 0.85;
        this.jumpBuf = 0;
      }
      if (mx !== 0) this.facing = mx;
      this.phase += dt * (Math.abs(this.vx) + Math.abs(this.vy) > 10 ? 6 : 2);
      moveBody(this, dt, grids, { drop: true });
      if (headWater) {
        this.breath -= dt / 14;
        if (this.breath <= 0) {
          this.breath = 1;
          game.faint('Tu as manqué d’air.');
          return;
        }
      } else this.breath = Math.min(1, this.breath + dt / 2);
      this.updateScarf(game, dt);
      this.toolUpdate(dt, game);
      return;
    }
    this.breath = Math.min(1, this.breath + dt / 2);

    // --- Au sol ou en l'air
    const crouch = this.onGround && my > 0 && !climbG;
    const target = mx * (run ? RUN : WALK) * (crouch ? 0.35 : 1);
    const acc = this.onGround ? (mx !== 0 ? ACC : DEC) : AIR_ACC;
    if (this.vx < target) this.vx = Math.min(target, this.vx + acc * dt);
    else if (this.vx > target) this.vx = Math.max(target, this.vx - acc * dt);
    if (mx !== 0) this.facing = mx;

    this.vy = Math.min(MAX_FALL, this.vy + GRAV * dt);
    if (this.jumpBuf > 0 && (this.onGround || this.coyote > 0)) {
      if (my > 0 && this.onPlatform(grids)) {
        // Traverser la passerelle
        this.dropTimer = 0.3;
        this.y += 2;
      } else {
        this.vy = -JUMP * (run && Math.abs(this.vx) > WALK ? 1.04 : 1);
        game.audio && game.audio.sfx('jump');
      }
      this.jumpBuf = 0;
      this.coyote = 0;
      this.onGround = false;
    }
    // Saut court si on relâche
    if (this.vy < -80 && canAct && !input.is('jump')) this.vy += GRAV * dt * 1.4;

    const wasGround = this.onGround;
    const prevVy = this.vy;
    moveBody(this, dt, grids, { stepUp: TILE, drop: this.dropTimer > 0 });
    if (this.stepped) this.visualDY += this.stepped;

    // Atterrissage
    if (this.onGround) {
      this.carrier = this.groundRef && this.groundRef.carrier ? this.groundRef : null;
      if (!wasGround) this.land(prevVy, game);
      this.coyote = 0.1;
      this.fallStartY = this.y;
      this.airTime = 0;
    } else {
      this.carrier = null;
      this.airTime += dt;
      if (wasGround && this.vy >= 0) this.coyote = 0.1;
      // Agripper un rebord
      if (mx !== 0 && this.vy > -40) this.tryMantle(grids, mx);
    }

    // Animation
    if (this.onGround) {
      const sp = Math.abs(this.vx);
      this.state = crouch ? 'crouch' : sp > 4 ? (sp > WALK + 8 ? 'run' : 'walk') : 'idle';
      this.phase += dt * (sp / 7.5);
      if (sp > 4) {
        this.stepTimer -= dt * sp;
        if (this.stepTimer <= 0) {
          this.stepTimer = sp > WALK + 8 ? 30 : 36;
          const under = pointTile(grids, this.cx, this.y + this.h + 2).id;
          this.lastSurface = under;
          game.audio && game.audio.sfx('step', { surface: tileDef(under).mat, run: sp > WALK + 8 });
          if (tileDef(under).mat === 'sand' && sp > WALK + 8) game.particles.dust(this.cx, this.y + this.h, -this.facing);
        }
      }
    } else this.state = this.vy < 0 ? 'jump' : 'fall';

    this.updateScarf(game, dt);
    this.toolUpdate(dt, game);
  }

  onPlatform(grids) {
    const id = pointTile(grids, this.cx, this.y + this.h + 2).id;
    return tileDef(id).oneWay;
  }

  land(vy, game) {
    const drop = (this.y - this.fallStartY) / TILE;
    if (drop > 22) {
      game.faint('La chute t’a assommé.');
      return;
    }
    if (drop > 10) {
      this.stun = 0.6;
      this.vx *= 0.2;
      game.particles.dust(this.cx, this.y + this.h, 0, 10);
      game.camera.shake(3);
      game.audio && game.audio.sfx('thud');
    } else if (vy > 200) {
      game.particles.dust(this.cx, this.y + this.h, 0, 4);
      game.audio && game.audio.sfx('land');
    }
  }

  tryMantle(grids, dir) {
    const fx = dir > 0 ? this.x + this.w + 2 : this.x - 2;
    const tx = Math.floor(fx / TILE);
    // On cherche une arête accessible avec les mains
    for (let dy = -6; dy <= 16; dy += 2) {
      const py = this.y + dy;
      const ty = Math.floor(py / TILE);
      const edgeTop = ty * TILE;
      if (Math.abs(edgeTop - py) > 3) continue;
      const solidHere = boxBlocked(grids, tx * TILE + 1, edgeTop + 1, TILE - 2, 2);
      const freeAbove = !boxBlocked(grids, tx * TILE + 1, edgeTop - this.h, TILE - 2, this.h - 0.5);
      if (solidHere && freeAbove) {
        const x1 = dir > 0 ? tx * TILE + 1 : tx * TILE + TILE - this.w - 1;
        const y1 = edgeTop - this.h;
        if (boxBlocked(grids, x1, y1, this.w, this.h)) continue;
        this.mantle = { x0: this.x, y0: this.y, x1, y1, t: 0, dur: 0.32 };
        this.state = 'climb';
        this.vx = 0;
        this.vy = 0;
        return true;
      }
    }
    return false;
  }

  updateScarf(game, dt) {
    const f = this.facing;
    const ax = this.cx + f * 0.6;
    const ay = this.y + this.h - 21 + this.visualDY;
    const wind = (game.env.wind || 0) - this.vx * 0.02;
    updateScarf(this.scarf, ax, ay, wind, dt, f);
  }

  // Démantèlement à l'outil
  toolUpdate(dt, game) {
    const input = game.input;
    this.using = false;
    if (this.frozen || game.ui.blocking() || game.building.active) {
      this.useProgress = 0;
      return;
    }
    const m = game.mouseWorld();
    const tx = Math.floor(m.x / TILE);
    const ty = Math.floor(m.y / TILE);
    const dist = Math.hypot(tx * TILE + 8 - this.cx, ty * TILE + 8 - (this.y + 8));
    const id = game.world.get(tx, ty);
    const d = tileDef(id);
    this.hover = null;
    if (dist <= REACH && (d.tool === 'main' || d.tool === 'foreuse')) this.hover = { tx, ty, def: d };
    if (!input.mouse.left || !this.hover) {
      this.useProgress = 0;
      this.useTarget = null;
      return;
    }
    if (d.tool !== 'main') {
      if (input.mouse.leftPressed) game.toast('Trop dur pour l’outil : une foreuse pourrait en venir à bout.');
      return;
    }
    const key = tx + ',' + ty;
    if (this.useTarget !== key) {
      this.useTarget = key;
      this.useProgress = 0;
    }
    this.using = true;
    this.facing = tx * TILE + 8 > this.cx ? 1 : -1;
    this.useProgress += dt * (game.bonus ? game.bonus.toolSpeed || 1 : 1);
    this.hitTimer = (this.hitTimer || 0) - dt;
    if (this.hitTimer <= 0) {
      this.hitTimer = 0.22;
      game.audio && game.audio.sfx('hit', { mat: d.mat });
      game.particles.chips(tx * TILE + 8, ty * TILE + 8, d.mat, tx, ty);
    }
    if (this.useProgress >= d.time) {
      this.useProgress = 0;
      this.useTarget = null;
      game.dismantle(tx, ty, 'player');
    }
  }

  draw(g, game) {
    const pose = {
      facing: this.facing,
      phase: this.phase,
      state: this.state === 'ground' ? 'idle' : this.state === 'ride' ? 'sit' : this.state,
      t: this.t,
      use: this.using,
      scarf: this.scarf,
    };
    if (this.mantle) pose.state = 'climb';
    const blink = this.hurt > 0 && Math.floor(this.hurt * 20) % 2 === 0;
    if (blink) return;
    // suivre les pentes dessinées
    const target = this.onGround && !this.mantle ? game.world.slopeOffset(this.feetX, this.feetY) : 0;
    if (target !== 0) this.visualDY = 0;
    this.slopeDY = this.slopeDY === undefined ? target : this.slopeDY + (target - this.slopeDY) * 0.5;
    drawHuman(g, this.x + this.w / 2, this.y + this.h + this.visualDY + this.slopeDY, this.look, pose, { tool: true });
  }
}

export { REACH };
