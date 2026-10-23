// Interface : HUD discret, invites contextuelles, panneaux, dialogues, cinématiques.
import { el, clear, canvasEl } from './dom.js';
import { RESOURCES, RES_ORDER, drawResIcon } from '../data/items.js';

export class UI {
  constructor(root) {
    this.root = root;
    this.game = null;
    this.panel = null;
    this.dialogState = null;
    this.cine = false;
    this.onClose = null;

    this.hud = el('div', { class: 'hud' });
    this.res = el('div', { class: 'hud-res' });
    this.promptEl = el('div', { class: 'prompt hidden' });
    this.bannerEl = el('div', { class: 'banner' });
    this.toastsEl = el('div', { class: 'toasts' });
    this.hintEl = el('div', { class: 'hint' });
    this.statusEl = el('div', { class: 'status' });
    this.hud.append(this.res, this.bannerEl, this.toastsEl, this.hintEl, this.statusEl);
    this.panelWrap = el('div', { class: 'panel-wrap hidden' });
    this.dialogEl = el('div', { class: 'dialog hidden' });
    this.cineTop = el('div', { class: 'cine-bar top' });
    this.cineBottom = el('div', { class: 'cine-bar bottom' });
    this.captionEl = el('div', { class: 'caption' });
    this.fadeEl = el('div', { class: 'fade' });
    root.append(this.hud, this.promptEl, this.panelWrap, this.dialogEl, this.cineTop, this.cineBottom, this.captionEl, this.fadeEl);
    this.resCache = '';
    this.resFlash = 0;
    this.toastIds = new Map();
  }

  blocking() {
    return !!this.panel || !!this.dialogState || this.cine;
  }

  // --- HUD ---------------------------------------------------------------------
  update(game, dt) {
    const inv = game.inv;
    if (inv) {
      const key = RES_ORDER.map((k) => inv.res[k] || 0).join(',');
      if (key !== this.resCache) {
        if (this.resCache) this.resFlash = 4;
        this.resCache = key;
        clear(this.res);
        for (const k of RES_ORDER) {
          const n = inv.res[k] || 0;
          if (!n && !inv.seen[k]) continue;
          const c = canvasEl(14, 14, 'ico');
          const g = c.getContext('2d');
          drawResIcon(g, k, 7, 7, 10);
          this.res.append(el('div', { class: 'res', title: RESOURCES[k].name }, c, el('span', {}, String(n))));
        }
      }
      this.resFlash = Math.max(0, this.resFlash - dt);
      this.res.classList.toggle('dim', this.resFlash <= 0 && !this.panel);
    }
    // toasts
    const live = new Set();
    for (const t of game.toasts) {
      live.add(t);
      let e = this.toastIds.get(t);
      if (!e) {
        e = el('div', { class: 'toast ' + (t.kind || '') }, t.text);
        this.toastIds.set(t, e);
        this.toastsEl.append(e);
      }
      e.style.opacity = Math.min(1, t.life);
    }
    for (const [t, e] of this.toastIds)
      if (!live.has(t)) {
        e.remove();
        this.toastIds.delete(t);
      }
  }

  setPrompt(text, sx, sy) {
    if (!text) {
      this.promptEl.classList.add('hidden');
      return;
    }
    if (this.promptEl.dataset.text !== text) {
      this.promptEl.dataset.text = text;
      this.promptEl.innerHTML = text;
    }
    this.promptEl.classList.remove('hidden');
    this.promptEl.style.left = Math.round(sx) + 'px';
    this.promptEl.style.top = Math.round(sy) + 'px';
  }

  setHint(text) {
    if (this.hintEl.dataset.text === text) return;
    this.hintEl.dataset.text = text || '';
    this.hintEl.innerHTML = text || '';
    this.hintEl.classList.toggle('show', !!text);
  }

  setStatus(html) {
    if (this.statusEl.dataset.html === html) return;
    this.statusEl.dataset.html = html || '';
    this.statusEl.innerHTML = html || '';
  }

  banner(title, sub) {
    clear(this.bannerEl);
    this.bannerEl.append(el('div', { class: 'b-title' }, title), el('div', { class: 'b-sub' }, sub || ''));
    this.bannerEl.classList.remove('show');
    void this.bannerEl.offsetWidth;
    this.bannerEl.classList.add('show');
  }

  // --- Panneaux ------------------------------------------------------------------
  openPanel(title, build, opts = {}) {
    this.closePanel(true);
    const body = el('div', { class: 'panel-body' });
    const close = el('button', { class: 'panel-close', title: 'Fermer (Échap)', onclick: () => this.closePanel() }, '×');
    const panel = el('div', { class: 'panel ' + (opts.cls || '') }, el('div', { class: 'panel-head' }, el('h2', {}, title), close), body);
    clear(this.panelWrap).append(panel);
    this.panelWrap.classList.remove('hidden');
    this.panel = { el: panel, body, opts, refresh: null };
    this.onClose = opts.onClose || null;
    const r = build(body, this.panel);
    if (typeof r === 'function') this.panel.refresh = r;
    return this.panel;
  }

  refreshPanel() {
    if (this.panel && this.panel.refresh) this.panel.refresh();
  }

  closePanel(silent) {
    if (!this.panel) return;
    const cb = this.onClose;
    this.panel = null;
    this.onClose = null;
    this.panelWrap.classList.add('hidden');
    clear(this.panelWrap);
    if (cb && !silent) cb();
    if (this.game && this.game.audio && !silent) this.game.audio.sfx('ui_close');
  }

  // --- Dialogues -----------------------------------------------------------------
  // lines : [{ who, text, choices: [{ text, value }] }]
  dialog(lines, opts = {}) {
    return new Promise((resolve) => {
      this.dialogState = { lines, i: 0, resolve, opts, shown: 0, full: false, result: null };
      this.dialogEl.classList.remove('hidden');
      this.renderDialog();
    });
  }

  renderDialog() {
    const d = this.dialogState;
    if (!d) return;
    const line = d.lines[d.i];
    clear(this.dialogEl);
    const text = el('div', { class: 'd-text' });
    this.dialogEl.append(el('div', { class: 'd-who' }, line.who || ''), text);
    d.textEl = text;
    d.shown = 0;
    d.full = false;
    d.choiceEls = null;
    if (line.choices) {
      const box = el('div', { class: 'd-choices hidden' });
      line.choices.forEach((c, k) =>
        box.append(
          el(
            'button',
            {
              class: 'd-choice',
              onclick: () => this.chooseDialog(c),
            },
            `${k + 1}. ${c.text}`,
          ),
        ),
      );
      this.dialogEl.append(box);
      d.choiceEls = box;
    } else this.dialogEl.append(el('div', { class: 'd-next' }, '▸'));
  }

  chooseDialog(c) {
    const d = this.dialogState;
    d.result = c.value;
    if (c.then) {
      d.lines.splice(d.i + 1, 0, ...c.then);
    }
    this.advanceDialog(true);
  }

  advanceDialog(force) {
    const d = this.dialogState;
    if (!d) return;
    const line = d.lines[d.i];
    if (!d.full) {
      d.shown = line.text.length;
      return;
    }
    if (line.choices && !force) return;
    d.i++;
    if (d.i >= d.lines.length) {
      this.dialogState = null;
      this.dialogEl.classList.add('hidden');
      d.resolve(d.result);
      return;
    }
    this.renderDialog();
  }

  tickDialog(dt, input) {
    const d = this.dialogState;
    if (!d) return;
    const line = d.lines[d.i];
    if (!d.full) {
      d.shown = Math.min(line.text.length, d.shown + dt * 55);
      d.textEl.textContent = line.text.slice(0, Math.floor(d.shown));
      if (d.shown >= line.text.length) {
        d.full = true;
        if (d.choiceEls) d.choiceEls.classList.remove('hidden');
      }
    }
    if (input.hitRaw('interact') || input.hitRaw('jump') || input.hitRaw('confirm') || input.mouse.leftPressed) {
      if (!(line.choices && d.full)) this.advanceDialog();
    }
    if (line.choices && d.full) {
      for (let k = 0; k < line.choices.length; k++) if (input.keyHit('Digit' + (k + 1)) || input.keyHit('Numpad' + (k + 1))) this.chooseDialog(line.choices[k]);
    }
  }

  // --- Cinématiques ----------------------------------------------------------------
  setCine(on) {
    this.cine = on;
    this.cineTop.classList.toggle('on', on);
    this.cineBottom.classList.toggle('on', on);
    if (!on) this.caption('');
  }

  caption(text, big = false) {
    this.captionEl.classList.toggle('big', big);
    if (!text) {
      this.captionEl.classList.remove('show');
      return;
    }
    this.captionEl.textContent = text;
    this.captionEl.classList.remove('show');
    void this.captionEl.offsetWidth;
    this.captionEl.classList.add('show');
  }

  fade(alpha, seconds = 1) {
    this.fadeEl.style.transition = `opacity ${seconds}s ease`;
    this.fadeEl.style.opacity = alpha;
  }
}
