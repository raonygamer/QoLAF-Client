import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import type { API } from '../src/api/Types';
import { bindGameClasses, type GameScene } from '../src/game/Bindings';
import { ShockwaveDistortion } from '../src/rendering/ShockwaveDistortion';
import type { RingDistortionTextures } from '../src/rendering/RingDistortionSource';
import { Display } from './fixtures/NativeGame';
// @ts-expect-error original AS3 method execution boundary
import { install } from './fixtures/As3Methods.js';

test('shockwave timing, culling and projection match original AS3 and dispose only once', () => {
  class Point {
    constructor(
      public x = 0,
      public y = 0,
    ) {}
  }
  class Image extends Display {
    disposals = 0;
    dispose() {
      this.disposals++;
      super.dispose();
    }
  }
  const api = {
    cls: (name: string) =>
      name === 'openfl.geom.Point' ? Point : name === 'starling.display.Image' ? Image : {},
  } as unknown as API;
  bindGameClasses(api);
  const textures = { get: () => ({}) } as unknown as RingDistortionTextures;
  const source = readFileSync(
    new URL('./fixtures/filters/ShockwaveDistortion.as', import.meta.url),
    'utf8',
  );
  let cases = 0;
  for (const radius of [1, 350, 700])
    for (const speed of [0, 175, 700])
      for (const scale of [0, 0.5, 2, -2]) {
        let visible = true;
        const radii: number[] = [];
        const positions: number[][] = [];
        const canvas = {
          scaleX: scale,
          scaleY: scale / 2,
          get_scaleX: () => scale,
          get_scaleY: () => scale / 2,
          localToGlobal(input: Point, output: Point) {
            output.x = input.x * scale + 50;
            output.y = (input.y * scale) / 2 - 80;
            return output;
          },
        };
        const game = {
          time: 1000,
          canvas,
          camera: {
            isCircleOnScreen(_x: number, _y: number, r: number) {
              radii.push(r);
              return visible;
            },
          },
        };
        const wave = new ShockwaveDistortion(
          api,
          textures,
          game as unknown as GameScene,
          20,
          30,
          radius,
          speed,
        );
        const original = {
          g: game,
          worldPosition: new Point(20, 30),
          screenPosition: new Point(),
          blastRadius: radius,
          startTime: 1080,
          duration: (radius / (speed > 0 ? speed : 350)) * 1000,
          RING_RADIUS: 0.45,
          RING_RANGE: 0.065,
          _source: {
            strength: 18,
            ringRadius: 128 * 0.45,
            effectiveStrength: 18,
            centerAt(...args: number[]) {
              positions.push(args);
              this.effectiveStrength = 18 * Math.max(0, args[5]);
            },
          },
          updatePosition: () => false,
        };
        install(original, source, ['updatePosition']);
        const centerAt = wave.source.centerAt.bind(wave.source);
        wave.source.centerAt = (...args: Parameters<typeof centerAt>) => {
          positions.push(args.map((v) => v ?? 1));
          centerAt(...args);
        };
        for (const progress of [-0.1, 0, 0.1, 0.5, 0.9, 1, 1.1]) {
          game.time = original.startTime + original.duration * progress;
          radii.length = positions.length = 0;
          assert.equal(wave.updatePosition(), original.updatePosition());
          if (positions.length) {
            assert.deepEqual(positions[0], positions[1]);
            assert.equal(radii[0], radii[1]);
          }
          assert.equal(wave.expired, game.time >= original.startTime + original.duration);
          cases++;
        }
        visible = false;
        game.time = original.startTime + original.duration / 2;
        assert.equal(wave.updatePosition(), false);
        const image = wave.source.image as Image;
        wave.dispose();
        wave.dispose();
        wave.source.dispose();
        assert.equal(image.disposals, 1);
        assert.equal(wave.updatePosition(), false);
      }
  assert.equal(cases, 252);
});
