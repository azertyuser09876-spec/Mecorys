// Capture d'écran du jeu dans Chromium (outil de développement).
// Usage : node tools/shot.mjs nom "x=44&y=118&hour=10" [attente_ms] [script.js]
import { build } from 'esbuild';
import { createRequire } from 'node:module';
import { mkdirSync, readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';

const require = createRequire(import.meta.url);
let chromium;
try {
  ({ chromium } = require('playwright'));
} catch {
  ({ chromium } = require('/opt/node22/lib/node_modules/playwright'));
}

const [name = 'shot', query = '', wait = '1500', script = ''] = process.argv.slice(2);
const root = resolve(import.meta.dirname, '..');
await build({ entryPoints: [root + '/src/main.js'], bundle: true, format: 'iife', outfile: root + '/www/mecorys.js', logLevel: 'error' });
mkdirSync(root + '/shots', { recursive: true });

const browser = await chromium.launch({ args: ['--autoplay-policy=no-user-gesture-required'] });
const page = await browser.newPage({ viewport: { width: Number(process.env.W || 1280), height: Number(process.env.H || 720) } });
const errors = [];
page.on('pageerror', (e) => errors.push(e.message + '\n' + e.stack));
page.on('console', (m) => {
  if (m.type() === 'error' || m.type() === 'warning' || process.env.LOG) console.log('[console]', m.type(), m.text());
});
await page.goto("file://" + root + "/www/index.html?" + (query.includes("x=") || query.includes("skip") || query.includes("title") ? query : query + "&skip"));
await page.waitForTimeout(Number(wait));
if (script) {
  const code = existsSync(script) ? readFileSync(script, 'utf8') : script;
  const out = await page.evaluate(code);
  if (out !== undefined) console.log('[script]', JSON.stringify(out));
  await page.waitForTimeout(Number(process.env.AFTER || 600));
}
await page.screenshot({ path: root + '/shots/' + name + '.png' });
if (errors.length) console.log('ERREURS:\n' + errors.join('\n'));
await browser.close();
console.log('ok shots/' + name + '.png');
