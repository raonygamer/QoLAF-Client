import { bindGameClasses } from '../src/game/Bindings';
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createBeamOrbitLightning, supportsBeamOrbit } from '../src/rendering/BeamOrbitLightning';
import { Mesh, Vertices, Indices } from './fixtures/AuraMesh';

test('beam orbit eligibility uses the source weapon keys, never display names', () => {
  for (const key of [
    'mG64bGPqEUaJHvf2sadUHg',
    'AoaS8cYoZk6Sg11nJdYqIw',
    'iFJpW8UJnEev0Kt3AQ9kcQ',
    'u0LhYHLM1UKe2v2_f0Jh0Q',
    '222ekuHQxE6j9IOXMVXs6g',
  ])
    assert.equal(supportsBeamOrbit({ weapon: { key } }), true);
  const namedWeapon = { name: 'Chrono Beam', key: 'other' };
  assert.equal(supportsBeamOrbit({ weapon: namedWeapon }), false);
  assert.equal(supportsBeamOrbit({}), false);
});

test('orbit mesh rejects invalid rays, collapses unused geometry and stops after disposal', () => {
  const classes: Record<string, any> = {
    'starling.display.Mesh': Mesh,
    'starling.rendering.VertexData': Vertices,
    'starling.rendering.IndexData': Indices,
  };
  bindGameClasses({ cls: (name: string) => classes[name] ?? class {} } as any);
  const Orbit = createBeamOrbitLightning();
  const mesh = new Orbit();
  mesh.drawBetween(10, 20, 10, 620, 50, 0xff8800, 200, 2);
  assert.equal(mesh.get_visible(), true);
  assert.equal(mesh.get_alpha(), 1);
  assert.equal(mesh.get_rotation(), Math.PI / 2);
  assert.ok(
    mesh
      .get_vertexData()
      .points.slice(192)
      .some((p: number[]) => p[0] !== 0),
  );
  mesh.drawBetween(10, 20, 110, 20, 4, 0xff8800, 200, 0.4);
  assert.ok(
    mesh
      .get_vertexData()
      .points.slice(96)
      .every((p: number[]) => p.every((v) => v === 0)),
  );
  for (const length of [0, 23, 10001, NaN, Infinity]) {
    mesh.drawBetween(0, 0, length, 0, 4, 0, 200, 1);
    assert.equal(mesh.get_visible(), false);
  }
  mesh.drawBetween(0, 0, 100, 0, 4, 0, Infinity, 1);
  assert.equal(mesh.get_visible(), false);
  mesh.dispose();
  mesh.dispose();
  mesh.drawBetween(0, 0, 100, 0, 4, 0, 0, 1);
  assert.equal(mesh.get_visible(), false);
  assert.ok(mesh instanceof Mesh);
  assert.equal(mesh.disposed, true);
});

test('lightning evolves continuously across shape keyframes', async () => {
  const { lightningNoise } = await import('../src/rendering/LightningNoise');
  for (let frame = 1; frame < 8; frame++) {
    const before = lightningNoise(42, frame - 0.0001);
    const after = lightningNoise(42, frame + 0.0001);
    assert.ok(Math.abs(before - after) < 0.000001);
    assert.notEqual(lightningNoise(42, frame + 0.5), after);
  }
});
