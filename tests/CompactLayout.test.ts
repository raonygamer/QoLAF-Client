import assert from 'node:assert/strict';
import { test } from 'node:test';
import { compactLayout } from '../src/Map/CompactLayout';

test('compact map reproduces original progression, branch lanes and independent systems', () => {
  const layout = compactLayout(540, 240);
  const positions = new Map(layout.map((entry) => [entry.name, entry]));
  assert.equal(layout.length, 20);
  assert.equal(positions.size, 20);
  assert.deepEqual(positions.get('Azuron'), {
    name: 'Azuron',
    x: 50,
    y: 31.200000000000003,
    label: 'above',
  });
  assert.equal(positions.get('Durian')!.x, 350);
  assert.equal(positions.get('Co-op Survival')!.x, 450);
  assert.equal(positions.get('Vibrilian')!.label, 'aboveRight');
  assert.equal(positions.get('Neurona')!.label, 'below');
  const hozar = positions.get('Hozar')!,
    zergilin = positions.get('Zergilin')!;
  assert.equal(hozar.x, zergilin.x);
  assert.ok(Math.abs((hozar.y + zergilin.y) / 2 - 240 * 0.36) < 1e-9);
  const wider = new Map(compactLayout(900, 600).map((entry) => [entry.name, entry]));
  assert.equal(wider.get('Dev')!.x, 710);
  assert.equal(wider.get('Dev')!.y, 534);
  assert.equal(wider.get('Ulgor')!.x, wider.get('Dev')!.x);
  assert.ok(wider.get('Ulgor')!.y < wider.get('Dev')!.y);
});
