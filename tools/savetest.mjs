// Vérifie qu'une partie sauvegardée se recharge fidèlement (deux chargements de page).
import { build } from 'esbuild';
import { createRequire } from 'node:module';
import { resolve } from 'node:path';

const require = createRequire(import.meta.url);
let chromium;
try {
  ({ chromium } = require('playwright'));
} catch {
  ({ chromium } = require('/opt/node22/lib/node_modules/playwright'));
}
const root = resolve(import.meta.dirname, '..');
await build({ entryPoints: [root + '/src/main.js'], bundle: true, format: 'iife', outfile: root + '/www/mecorys.js', logLevel: 'error' });
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
const url = 'file://' + root + '/www/index.html';

await page.goto(url + '?skip');
await page.waitForTimeout(800);
const before = await page.evaluate(async () => {
  const g = window.mecorys;
  const step = async (n) => {
    for (let i = 0; i < n; i++) {
      g.update(1 / 60);
      g.input.endFrame();
      await null;
    }
  };
  g.inv.addAll({ ferraille: 50, rouages: 5, fibre: 20, pierre: 10 });
  const ab = g.structures.find((s) => s.type === 'refuge');
  g.structureInteract(ab);
  g.world.set(80, 115, 0);
  g.learnPlan('trotteur', true);
  const et = g.structures.find((s) => s.type === 'etabli');
  et.ruined = false;
  const d = g.robots.designs.find((x) => x.id === 'trotteur');
  g.robots.queueOf(et).push({ name: 'Bidule', cells: d.cells, source: 'trotteur', progress: 0, total: 1 });
  await step(120);
  g.ecology.plant('herbe', 100, 110, 0.3);
  g.player.teleport(200 * 16, 100 * 16);
  await step(30);
  g.save(true);
  return { res: g.inv.res.ferraille, robots: g.robots.list.length, abri: ab.ruined, tile: g.world.get(80, 115), journal: g.journal.length, x: Math.round(g.player.cx / 16), herbe: g.ecology.zoneAt(100, 110).plants.herbe.toFixed(2) };
});
await page.goto(url);
await page.waitForTimeout(800);
await page.click('.title-btns button');
await page.waitForTimeout(800);
const after = await page.evaluate(() => {
  const g = window.mecorys;
  const ab = g.structures.find((s) => s.type === 'refuge');
  return { res: g.inv.res.ferraille, robots: g.robots.list.length, abri: ab.ruined, tile: g.world.get(80, 115), journal: g.journal.length, x: Math.round(g.player.cx / 16), herbe: g.ecology.zoneAt(100, 110).plants.herbe.toFixed(2) };
});
await browser.close();
console.log('avant ', JSON.stringify(before));
console.log('après ', JSON.stringify(after));
const ok = ['robots', 'abri', 'tile', 'journal', 'x'].every((k) => before[k] === after[k]) && Math.abs(before.res - after.res) <= 2;
console.log(ok ? 'SAUVEGARDE OK' : 'SAUVEGARDE DIFFÉRENTE');
if (errors.length) console.log('ERREURS', errors);
process.exit(ok && !errors.length ? 0 : 1);
