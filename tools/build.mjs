// Construit le jeu en un seul fichier HTML autonome : dist/mecorys.html
import { build } from 'esbuild';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..');
const out = await build({
  entryPoints: [root + '/src/main.js'],
  bundle: true,
  format: 'iife',
  minify: true,
  write: false,
  target: ['es2020'],
  legalComments: 'none',
});
const js = out.outputFiles[0].text.replace(/<\/script/gi, '<\\/script');
const css = readFileSync(root + '/www/style.css', 'utf8');
const html = `<!doctype html>
<html lang="fr">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Mecorys</title>
<style>${css}</style>
</head>
<body>
<canvas id="screen"></canvas>
<div id="ui"></div>
<script>${js}</script>
</body>
</html>
`;
mkdirSync(root + '/dist', { recursive: true });
writeFileSync(root + '/dist/mecorys.html', html);
// version de développement (fichiers séparés)
await build({ entryPoints: [root + '/src/main.js'], bundle: true, format: 'iife', outfile: root + '/www/mecorys.js', logLevel: 'error' });
console.log(`dist/mecorys.html : ${(html.length / 1024).toFixed(0)} Ko`);
