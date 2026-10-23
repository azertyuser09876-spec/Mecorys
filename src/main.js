// Point d'entrée : crée le jeu et lance la boucle à pas fixe.
import { Input } from './core/input.js';
import { Game } from './game.js';
import { UI } from './ui/ui.js';

const STEP = 1 / 60;

function boot() {
  const canvas = document.getElementById('screen');
  const input = new Input(canvas);
  const ui = new UI(document.getElementById('ui'));
  const game = new Game(canvas, input, ui, null);
  window.mecorys = game;

  const params = new URLSearchParams(location.search);
  game.newWorld(Number(params.get('seed')) || 1729);
  game.spawnFromPois();
  if (params.has('x')) {
    game.player.teleport(Number(params.get('x')) * 16 + 8, Number(params.get('y') || 100) * 16);
  }
  if (params.has('hour')) game.env.hour = Number(params.get('hour'));
  if (params.has('zoom')) {
    game.camera.setZoomIndex(Number(params.get('zoom')));
    game.camera.zoom = game.camera.targetZoom;
  }
  game.camera.follow(game.player.cx, game.player.cy, 1, game.bounds(), 0, true);

  window.addEventListener('resize', () => game.renderer.resize());

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
