import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { lineFitness, artifactFitness } from '../src/artifacts/Fitness';

// Captured original AS3 method body: its switch is also valid JavaScript.
// Keep this independent of the port so changing its arithmetic cannot silently
// change the expected ranking in this test.
const source: { body: string; types: string[] } = JSON.parse(
  readFileSync(new URL('./fixtures/ArtifactFitness.json', import.meta.url), 'utf8'),
);
const original = new Function('type', 'value', source.body) as (
  type: string,
  value: number,
) => number;

test('every artifact fitness modifier matches the original client arithmetic', () => {
  for (const type of [...source.types, 'unknown']) {
    for (const value of [-10, 0, 0.5, 1, 100, 999, 999.999, 1000, 1001, 10000]) {
      assert.equal(lineFitness(type, value), original(type, value), `${type}: ${value}`);
    }
  }
  const stats = source.types.map((type, index) => ({ type, value: index + 0.5 }));
  assert.equal(
    artifactFitness({ stats }),
    stats.reduce((sum, stat) => sum + original(stat.type, stat.value), 0),
  );
});
