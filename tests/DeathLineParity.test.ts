import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { crossesDeathLine, isEscapingCollision } from '../src/movement/DeathLineCollision';
// @ts-expect-error original AS3 execution boundary
import { install } from './fixtures/As3Methods.js';

test('death-line sweep and overlap escape match the original AS3 across orientations and clearances', () => {
  const source = readFileSync(new URL('./fixtures/movement/DeathLine.as', import.meta.url), 'utf8');
  const original = {
    x: 0,
    y: 0,
    toX: 0,
    toY: 0,
    lineIntersection2: (
      _dx: number,
      _dy: number,
      _sx: number,
      _sy: number,
      _radius: number,
    ): boolean => false,
    isEscapingCollision: (
      _dx: number,
      _dy: number,
      _sx: number,
      _sy: number,
      _radius: number,
    ): boolean => false,
    distanceSquaredToSegment: () => 0,
  };
  install(original, source, [
    'lineIntersection2',
    'isEscapingCollision',
    'distanceSquaredToSegment',
  ]);
  let cases = 0;
  for (const angle of [0, 0.3, Math.PI / 2, Math.PI, -1.7]) {
    for (const length of [0, 1, 200]) {
      original.x = 31;
      original.y = -27;
      original.toX = original.x + Math.cos(angle) * length;
      original.toY = original.y + Math.sin(angle) * length;
      for (const radius of [-1, 0, 2, 50]) {
        for (const startAcross of [-60, -2, 0, 2, 60]) {
          for (const destinationAcross of [-60, -2, 0, 2, 60]) {
            for (const along of [-5, 0, length / 2, length, length + 5]) {
              const sx = original.x + Math.cos(angle) * along - Math.sin(angle) * startAcross;
              const sy = original.y + Math.sin(angle) * along + Math.cos(angle) * startAcross;
              const dx = original.x + Math.cos(angle) * along - Math.sin(angle) * destinationAcross;
              const dy = original.y + Math.sin(angle) * along + Math.cos(angle) * destinationAcross;
              const context = JSON.stringify({
                angle,
                length,
                radius,
                startAcross,
                destinationAcross,
                along,
              });
              assert.equal(
                crossesDeathLine(original, dx, dy, sx, sy, radius),
                original.lineIntersection2(dx, dy, sx, sy, radius),
                context,
              );
              assert.equal(
                isEscapingCollision(original, dx, dy, sx, sy, radius),
                original.isEscapingCollision(dx, dy, sx, sy, radius),
                context,
              );
              cases++;
            }
          }
        }
      }
    }
  }
  assert.equal(cases, 7500);
});
