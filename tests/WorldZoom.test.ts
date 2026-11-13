import assert from 'node:assert/strict';
import { test } from 'node:test';
import { WorldZoom } from '../src/movement/WorldZoom';

function fixture() {
  let value = 1;
  let flushes = 0;
  const saved: number[] = [];
  const zoom = new WorldZoom(
    () => value,
    (next) => {
      value = next;
    },
    (next) => saved.push(next),
    () => flushes++,
  );
  return { zoom, saved, value: () => value, flushes: () => flushes };
}

test('wheel zoom normalizes delta magnitude, clamps and flushes after a gesture', (t) => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const f = fixture();
  f.zoom.wheel(-1);
  assert.equal(f.value(), 1.08);
  f.zoom.wheel(-900);
  assert.equal(f.value(), 1.08 * 1.08);
  assert.equal(f.flushes(), 0);
  t.mock.timers.tick(249);
  assert.equal(f.flushes(), 0);
  t.mock.timers.tick(1);
  assert.equal(f.flushes(), 1);
  for (let i = 0; i < 100; i++) f.zoom.wheel(1);
  assert.equal(f.value(), 0.25);
  f.zoom.dispose();
  assert.equal(f.flushes(), 2);
  t.mock.timers.tick(1000);
  assert.equal(f.flushes(), 2);
});

test('keyboard zoom resets with both keys and shares deferred saving with wheel input', (t) => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const f = fixture();
  f.zoom.keyboard(false, true);
  assert.equal(f.value(), 0.98);
  f.zoom.keyboard(true, false);
  assert.equal(f.value(), 1);
  f.zoom.wheel(-1);
  t.mock.timers.tick(250);
  assert.equal(f.flushes(), 0, 'held keyboard gesture owns the pending save');
  f.zoom.keyboard(false, false);
  assert.equal(f.flushes(), 1);
  f.zoom.keyboard(true, true);
  assert.equal(f.value(), 1);
  f.zoom.keyboard(false, false);
  assert.equal(f.flushes(), 2);
  assert.equal(WorldZoom.clamp(NaN), 1);
  assert.equal(WorldZoom.clamp(900), 2);
});
