// Cinématiques : séquences scriptées en temps de jeu (caméra, textes, bandes noires).

export class Cine {
  constructor(game) {
    this.game = game;
    this.active = false;
    this.waits = [];
    this.speed = 1;
  }

  // Lance une séquence ; fn reçoit des outils asynchrones.
  async run(fn) {
    const g = this.game;
    if (this.active) return;
    this.active = true;
    this.speed = 1;
    g.player.frozen = true;
    g.ui.setCine(true);
    g.building.active && g.building.close();
    const c = {
      wait: (s) => this.wait(s),
      focus: (x, y, speed = 1.5) => (g.camera.focus = { x, y, speed }),
      release: () => (g.camera.focus = null),
      caption: async (text, s = 3.5, big = false) => {
        g.ui.caption(text, big);
        await this.wait(s);
        g.ui.caption('');
      },
      shake: (a) => g.camera.shake(a),
      zoom: (i) => g.camera.setZoomIndex(i),
      fade: async (a, s = 1) => {
        g.ui.fade(a, s / this.speed);
        await this.wait(s);
      },
      sfx: (n, o) => g.audio && g.audio.sfx(n, o),
    };
    try {
      await fn(c);
    } finally {
      g.camera.focus = null;
      g.player.frozen = false;
      g.ui.setCine(false);
      g.ui.caption('');
      this.active = false;
    }
  }

  wait(s) {
    return new Promise((resolve) => this.waits.push({ t: s, resolve }));
  }

  update(dt) {
    const input = this.game.input;
    if (this.active && (input.hitRaw('pause') || input.hitRaw('confirm'))) this.speed = 6;
    const k = dt * this.speed;
    for (const w of this.waits) w.t -= k;
    const done = this.waits.filter((w) => w.t <= 0);
    this.waits = this.waits.filter((w) => w.t > 0);
    for (const w of done) w.resolve();
  }
}
