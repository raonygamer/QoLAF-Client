import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import type { Beam } from '../src/game/Bindings';
import { BeamRenderGeometry } from '../src/weapon/BeamRenderGeometry';
// @ts-expect-error original AS3 execution boundary
import { install } from './fixtures/As3Methods.js';

const point = () => ({ x: 0, y: 0 });
const effect = () => ({ posX: 0, posY: 0, angle: 0, isEmitting: true });
function unit(x: number, y: number, rotation = 0) {
  return {
    alive: true,
    renderX: x,
    renderY: y,
    renderRotation: rotation,
    get_renderX: () => x,
    get_renderY: () => y,
    get_renderRotation: () => rotation,
    weaponPos: { x: 12, y: -7 },
  };
}

test('beam geometry and emitter transforms match original AS3 across mounts and body intersections', () => {
  const source = readFileSync(new URL('./fixtures/weapon/Beam.as', import.meta.url), 'utf8');
  let cases = 0;
  for (const angle of [-Math.PI, -1.2, 0, 0.7, Math.PI / 2, Math.PI])
    for (const twin of [false, true])
      for (const offset of [-20, 0, 30])
        for (const targetMode of ['none', 'unit', 'body', 'inside'] as const) {
          const owner = unit(100, 200, angle);
          const target = targetMode === 'unit' ? unit(350, -20) : null;
          const body =
            targetMode === 'body' || targetMode === 'inside'
              ? {
                  ...unit(110, 210),
                  radius: targetMode === 'inside' ? 500 : 10,
                  get_radius() {
                    return this.radius;
                  },
                }
              : null;
          const original = {
            unit: owner,
            targetBody: body,
            twin,
            twinOffset: 3,
            positionOffsetX: offset,
            positionOffsetY: -offset,
            range: 250,
            key: 'ordinary',
            _fire: true,
            renderTwin: false,
            renderStartPos: point(),
            renderStartPos2: point(),
            renderEndPos: point(),
            startEffect: [effect()],
            startEffect2: [effect()],
            endEffect: [effect()],
            resolveVisualTarget: () => target,
            ClientDevVisual: { PHASE_BLADE: 'phase' },
            PlayerShip: class {},
            updateRenderGeometry: () => null,
          };
          install(original, source, ['updateRenderGeometry']);
          const returned = original.updateRenderGeometry();
          const beam = {
            ...original,
            target,
            startEffect: [effect()],
            startEffect2: [effect()],
            endEffect: [effect()],
          };
          const view = new BeamRenderGeometry();
          view.update(beam as unknown as Beam);
          view.updateEmitters(beam as unknown as Beam);
          const context = JSON.stringify({ angle, twin, offset, targetMode });
          const close = (actual: number, expected: number) =>
            assert.ok(Math.abs(actual - expected) < 1e-9, `${context}: ${actual} != ${expected}`);
          for (const [actual, expected] of [
            [view.start, original.renderStartPos],
            [view.end, original.renderEndPos],
          ]) {
            close(actual.x, expected.x);
            close(actual.y, expected.y);
          }
          if (twin) {
            close(view.second.x, original.renderStartPos2.x);
            close(view.second.y, original.renderStartPos2.y);
          }
          for (const key of ['startEffect', 'startEffect2', 'endEffect'] as const) {
            close(beam[key][0].posX, original[key][0].posX);
            close(beam[key][0].posY, original[key][0].posY);
            close(beam[key][0].angle, original[key][0].angle);
          }
          assert.equal(view.twin, original.renderTwin);
          assert.equal(returned, target);
          cases++;
        }
  assert.equal(cases, 144);
});
