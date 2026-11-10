import assert from 'node:assert/strict';
import { test } from 'node:test';
import { ClientDevVisual } from '../src/visuals/ClientDevVisual';
import { clientDevVisualShader } from '../src/visuals/ClientDevVisualShader';
import { isClientDeveloper } from '../src/visuals/ClientVisualAuthority';

test('visual state validation rejects malformed palettes and preserves an independent draft', () => {
  const defaults = ClientDevVisual.defaults();
  const draft = ClientDevVisual.settings(defaults)!;
  draft.colorA = 0;
  assert.equal(defaults.colorA, 0x00ffaa);
  for (const bad of [
    [],
    false,
    1,
    '',
    { ...defaults, period: 999 },
    { ...defaults, angle: 360 },
    { ...defaults, phase: 0.5 },
    { ...defaults, reverse: 1 },
    { ...defaults, colorA: 0x1000000 },
    { ...defaults, spread: NaN },
    { ...defaults, palette: 'unknown' },
  ]) {
    assert.equal(ClientDevVisual.settings(bad), null);
  }
  assert.equal(ClientDevVisual.fromState({ devvis: 'RAINBOWWAVE' }), 'rainbowwave');
  assert.equal(ClientDevVisual.fromState({ devvis: {} }), null);
  assert.equal(ClientDevVisual.settingsFromState({ devvisSettings: null }), null);
  assert.deepEqual(ClientDevVisual.settingsFromState(Object.create(null)), defaults);
});

test('source palette has exact cycle, gradient, reversal and spatial phase behavior', () => {
  const settings = ClientDevVisual.defaults();
  assert.equal(ClientDevVisual.colorAt('rainbow', settings, 0), 0xff0000);
  assert.equal(ClientDevVisual.colorAt('rainbow', settings, 2000), 0x00ff00);
  assert.equal(ClientDevVisual.colorAt('rainbow', settings, 4000), 0x0000ff);
  assert.equal(ClientDevVisual.colorAt('rainbow', settings, 6000), 0xff0000);
  settings.palette = 'gradient';
  settings.colorA = 0x123456;
  settings.colorB = 0xabcdef;
  assert.equal(ClientDevVisual.colorAt('rainbow', settings, 0), settings.colorA);
  assert.equal(ClientDevVisual.colorAt('rainbow', settings, 3000), settings.colorB);
  assert.equal(ClientDevVisual.colorAt('rainbow', settings, 1500), 0x5f81a3);
  settings.palette = 'solid';
  assert.equal(ClientDevVisual.colorAt('rainbowcircle', settings, 876, -5, 10), settings.colorA);
  settings.reverse = true;
  assert.equal(ClientDevVisual.phaseAt(1500, settings), -0.25);
  settings.palette = 'spectrum';
  settings.reverse = false;
  settings.angle = 0;
  assert.equal(ClientDevVisual.colorAt('rainbowwave', settings, 0, 0, 99), 0xff0000);
  assert.equal(ClientDevVisual.colorAt('rainbowcircle', settings, 0, 0.5, 0.5), 0xff0000);
});

test('world-to-hull maps rotated, scaled points to the same normalized palette coordinates', () => {
  const image = {
    rotation: Math.PI / 2,
    texture: { width: 100, height: 50 },
    scaleX: 2,
    scaleY: 3,
    pivotX: 50,
    pivotY: 25,
    x: 400,
    y: 300,
  };
  let matrix: number[] = [];
  ClientDevVisual.worldToHull(image, {
    setTo: (...values: number[]) => {
      matrix = values;
    },
  });
  const [a, b, c, d, tx, ty] = matrix;
  const point = (x: number, y: number) => [a * x + c * y + tx, b * x + d * y + ty];
  for (const [actual, expected] of point(400, 300).map((v) => [v, 0.5]))
    assert.ok(Math.abs(actual - expected) < 1e-10);
  const right = point(400, 400);
  assert.ok(Math.abs(right[0] - 1) < 1e-10);
  assert.ok(Math.abs(right[1] - 0.5) < 1e-10);
});

test('hull and beam shaders retain distinct saturation handling for every original palette', () => {
  const tex = () => 'tex ft0, v0, fs0 <2d,linear,clamp>\n';
  for (const mode of [1, 2, 3])
    for (const palette of ClientDevVisual.PALETTES) {
      const hull = clientDevVisualShader(mode, { palette }, false, tex);
      const beam = clientDevVisualShader(mode, { palette }, true, tex);
      assert.equal((hull.fragment.match(/tex /g) ?? []).length, 1);
      assert.match(hull.fragment, /min ft3.y/);
      assert.doesNotMatch(beam.fragment, /min ft3.y/);
      assert.match(beam.fragment, /mul ft0.xyz, ft2.xyz, ft3.xxx/);
      assert.match(hull.vertex, /mov v2, va3/);
    }
  assert.equal(isClientDeveloper('simple1789865760026'), true);
  assert.equal(isClientDeveloper('TheNull'), false);
  assert.equal(isClientDeveloper({ role: 'developer' }), false);
});
