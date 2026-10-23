import { test } from 'node:test';
import assert from 'node:assert/strict';
import { analyze, designCost } from '../src/systems/robotdesign.js';
import { FOUND_DESIGNS } from '../src/data/modules.js';
import { planCost } from '../src/systems/inventory.js';

test('les plans trouvés sont tous fonctionnels', () => {
  for (const [id, d] of Object.entries(FOUND_DESIGNS)) {
    const a = analyze(d.cells);
    assert.ok(a.ok, `${id} : ${a.issues.map((i) => i.text).join(' / ')}`);
  }
});

test('un robot sans noyau est refusé', () => {
  const a = analyze([{ x: 0, y: 0, m: 'roue' }]);
  assert.equal(a.ok, false);
  assert.ok(a.issues.some((i) => /noyau/.test(i.text)));
});

test('un module détaché est signalé', () => {
  const a = analyze([
    { x: 0, y: 0, m: 'noyau' },
    { x: 1, y: 0, m: 'ressort' },
    { x: 0, y: 1, m: 'roue' },
    { x: 1, y: 1, m: 'roue' },
    { x: 4, y: 0, m: 'pince' },
  ]);
  assert.equal(a.ok, false);
  assert.ok(a.bad.has(4));
});

test('un robot déséquilibré bascule', () => {
  const a = analyze([
    { x: 0, y: 1, m: 'roue' },
    { x: 0, y: 0, m: 'noyau' },
    { x: 1, y: 0, m: 'chaudiere' },
    { x: 2, y: 0, m: 'chaudiere' },
    { x: 3, y: 0, m: 'chaudiere' },
  ]);
  assert.equal(a.stable, false);
});

test('un plan coûte environ 5 % de moins', () => {
  const cost = { ferraille: 40, pierre: 20, rouages: 2 };
  const opt = planCost(cost, true);
  const before = 62;
  const after = Object.values(opt).reduce((a, b) => a + b, 0);
  assert.equal(before - after, 3);
  assert.equal(opt.rouages, 2);
  assert.deepEqual(planCost({ ferraille: 3 }, true), { ferraille: 3 });
  assert.ok(designCost(FOUND_DESIGNS.trotteur.cells).ferraille > 0);
});
