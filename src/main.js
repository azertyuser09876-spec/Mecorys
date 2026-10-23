// Point d'entrée : écran titre, création du personnage, boucle de jeu à pas fixe.
import { Input } from './core/input.js';
import { Game } from './game.js';
import { UI } from './ui/ui.js';
import { Audio } from './audio/audio.js';
import { showTitle, openCreation, openPause } from './ui/title.js';
import { openJournal } from './ui/journal.js';
import { writeSave, restore } from './systems/save.js';
import { TILE } from './world/tiles.js';

const STEP = 1 / 60;

function boot() {
  const canvas = document.getElementById('screen');
  const input = new Input(canvas);
  const ui = new UI(document.getElementById('ui'));
  const audio = new Audio();
  const game = new Game(canvas, input, ui, audio);
  window.mecorys = game;
  const params = new URLSearchParams(location.search);

  game.save = (silent) => {
    try {
      writeSave(game);
      if (!silent) game.toast('Partie sauvegardée.', 'good');
    } catch (e) {
      game.toast('Impossible de sauvegarder (stockage du navigateur indisponible).', 'bad');
    }
  };
  game.openJournal = (tab) => openJournal(game, tab);

  game.newWorld(Number(params.get('seed')) || 1729);
  game.spawnFromPois();
  let mode = 'title';

  const startPlaying = () => {
    mode = 'play';
    game.titleMode = false;
    game.player.frozen = false;
    game.camera.focus = null;
  };

  const newGame = () => {
    openCreation(ui, async (look) => {
      game.player.look = look;
      startPlaying();
      game.save(true);
      await game.story.intro();
    });
  };

  const continueGame = (save) => {
    try {
      restore(game, save);
    } catch (e) {
      console.error(e);
      game.toast('La sauvegarde n’a pas pu être lue. Une nouvelle partie commence.', 'bad');
    }
    startPlaying();
    game.toast(`Jour ${game.env.day}. Le monde a gardé la mémoire de ce que tu as fait.`);
  };

  // Paramètres de développement : ?skip pour jouer tout de suite, ?x=&y= pour se placer
  if (params.has('skip') || params.has('x')) {
    startPlaying();
    if (params.has('x')) game.player.teleport(Number(params.get('x')) * TILE + 8, Number(params.get('y') || 100) * TILE);
    if (params.has('hour')) game.env.hour = Number(params.get('hour'));
    if (params.has('zoom')) {
      game.camera.setZoomIndex(Number(params.get('zoom')));
      game.camera.zoom = game.camera.targetZoom;
    }
    game.camera.follow(game.player.cx, game.player.cy, 1, game.bounds(), 0, true);
  } else {
    // décor de l'écran titre : l'aube sur les dunes
    game.env.hour = 6.6;
    game.titleMode = true;
    game.player.frozen = true;
    game.camera.setZoomIndex(2);
    game.camera.zoom = game.camera.targetZoom;
    game.camera.focus = { x: 300 * TILE, y: 96 * TILE, speed: 0.05 };
    game.camera.follow(300 * TILE, 96 * TILE, 1, game.bounds(), 0, true);
    showTitle(ui, { onNew: newGame, onContinue: continueGame, audio });
  }

  // le premier geste de l'utilisateur démarre le son
  const unlock = () => {
    audio.start();
    if (game.region()) audio.setRegion(game.region());
    window.removeEventListener('pointerdown', unlock);
    window.removeEventListener('keydown', unlock);
  };
  window.addEventListener('pointerdown', unlock);
  window.addEventListener('keydown', unlock);
  window.addEventListener('resize', () => game.renderer.resize());
  window.addEventListener('beforeunload', () => {
    if (mode === 'play') game.save(true);
  });

  let last = performance.now();
  let acc = 0;
  let frames = 0;
  let fpsTime = 0;
  function frame(now) {
    let dt = (now - last) / 1000;
    last = now;
    if (dt > 0.25) dt = 0.25;
    acc += dt;
    while (acc >= STEP) {
      if (mode === 'title') {
        game.camera.focus.x += 6 * STEP * 16;
        game.env.hour = Math.min(7.6, game.env.hour + STEP * 0.004);
      }
      if (mode === 'play' && !ui.blocking() && !game.building.active && input.hitRaw('pause') && !game.colossi.some((c) => c.pilot)) {
        openPause(game, { onTitle: () => location.reload() });
        input.pressed.delete('Escape');
      }
      game.update(STEP);
      input.endFrame();
      acc -= STEP;
    }
    game.render();
    frames++;
    fpsTime += dt;
    if (fpsTime > 0.5) {
      game.fps = frames / fpsTime;
      frames = 0;
      fpsTime = 0;
    }
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
}

boot();
