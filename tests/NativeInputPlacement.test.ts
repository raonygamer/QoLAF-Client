import assert from 'node:assert/strict';
import { test } from 'node:test';
import { placeNativeInput } from '../src/ui/NativeInputPlacement';

test('scaled popup input uses rendered bounds and scales CSS font/padding once', () => {
  const bounds = { x: 905, y: 150, width: 100.42105263157896, height: 16.42105263157896 };
  const placed: any[] = [];
  const element = { style: {} as Record<string, string> };
  const input = {
    element,
    get_width: () => 159,
    get_height: () => 26,
    textFormat: { size: 14 },
    paddingLeft: 8,
    paddingRight: 8,
    paddingTop: 3,
    paddingBottom: 3,
  };
  const overlay = {
    globalRect: () => bounds,
    toCss: (r: any) => ({ ...r }),
    place: (...args: any[]) => placed.push(args),
  };
  placeNativeInput(input, overlay);
  assert.deepEqual(placed, [[element, bounds, true]]);
  assert.equal(element.style.fontSize, `${(14 * bounds.height) / 26}px`);
  assert.equal(element.style.paddingLeft, `${(8 * bounds.width) / 159}px`);
  assert.ok(Math.abs(parseFloat(element.style.paddingTop) - (3 * bounds.height) / 26) < 1e-10);
  // Repeated frame placement must not multiply already-scaled CSS values.
  const initial = { ...element.style };
  for (let frame = 0; frame < 120; frame++) placeNativeInput(input, overlay);
  assert.deepEqual(element.style, initial);
  overlay.toCss = (r) => ({ ...r, width: r.width * 2, height: r.height * 2 });
  placeNativeInput(input, overlay);
  assert.equal(element.style.fontSize, `${(14 * bounds.height * 2) / 26}px`);
});

test('input placement leaves invalid/zero-size controls and absent native bridges alone', () => {
  const input = { element: { style: {} }, width: 0, height: 24 };
  const overlay = {
    globalRect: () => ({}),
    toCss: () => ({ width: 0, height: 24 }),
    place: () => assert.fail('must not place'),
  };
  placeNativeInput(input, overlay);
  placeNativeInput(input, undefined);
  placeNativeInput({}, overlay);
  assert.deepEqual(input.element.style, {});
});
