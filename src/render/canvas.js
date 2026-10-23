// Création de surfaces de dessin hors écran.

export function makeCanvas(w, h) {
  if (typeof OffscreenCanvas !== 'undefined') {
    const c = new OffscreenCanvas(w, h);
    return c;
  }
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  return c;
}

export function ctx2d(c) {
  const g = c.getContext('2d');
  g.imageSmoothingEnabled = false;
  return g;
}
