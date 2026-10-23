import { test } from 'node:test';
import assert from 'node:assert/strict';
import { generateWorld } from '../src/world/generator.js';
import { findPath } from '../src/systems/nav.js';
import { T } from '../src/world/tiles.js';

const { world, pois } = generateWorld(1729);
const P = (t, id) => pois.find((p) => p.type === t && (!id || p.id === id));
const player = { height: 2, stepUp: 2, maxDrop: 20, climbs: true, swims: true, jump: 4, radius: 700 };
const robot = { height: 2, stepUp: 2, maxDrop: 2, radius: 700 };
const reach = (a, b, opt) => !!findPath(world, a[0], a[1], (x, y) => Math.abs(x - b[0]) <= 1 && Math.abs(y - b[1]) <= 2, opt);

test('le monde est déterministe', () => {
  const again = generateWorld(1729).world;
  assert.equal(world.tiles.length, again.tiles.length);
  let same = true;
  for (let i = 0; i < world.tiles.length; i += 97) if (world.tiles[i] !== again.tiles[i]) same = false;
  assert.ok(same);
});

test('les lieux clés sont accessibles à pied', () => {
  const start = [P('start').x, 117];
  assert.ok(reach(start, [P('refuge').x, 116], player), 'abri');
  assert.ok(reach(start, [P('etabli').x, 115], player), 'établi');
  assert.ok(reach([546, 115], [P('plan', 'trotteur').x, P('plan', 'trotteur').y - 1], player), 'plan du Trotteur');
  assert.ok(reach([546, 115], [P('survivor', 'ilo').x, P('survivor', 'ilo').y - 1], player), 'cabine d’Ilo');
  assert.ok(reach([700, 115], [P('pompe').x, 57], player), 'salle des pompes');
  assert.ok(reach([700, 115], [P('survivor', 'sorrel').x, 199], player), 'Sorrel dans les conduites');
  assert.ok(reach([880, 57], [P('survivor', 'maelle').x, 86], player), 'pilotis de Maëlle');
});

test('un robot à roues traverse le désert jusqu’à la fonderie', () => {
  assert.ok(reach([44, 117], [536, 115], robot));
  assert.ok(reach([536, 115], [44, 117], robot));
});

test('la vallée reste fermée tant que le lac n’est pas vidé', () => {
  assert.equal(reach([700, 115], [1200, 127], player), false);
  const gate = P('porte_vanne');
  assert.equal(world.get(gate.x0, gate.y0 + 4), T.METAL);
});
