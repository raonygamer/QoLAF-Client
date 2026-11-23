import assert from 'node:assert/strict';
import { test } from 'node:test';
import { bindGameClasses } from '../src/game/Bindings';
import { lightningNoise } from '../src/rendering/LightningNoise';
import { installWeaponLightning } from '../src/rendering/WeaponLightning';
import { weaponLaunchOffset } from '../src/rendering/WeaponLaunchPose';
// @ts-expect-error actual host dispatcher
import { Hooks } from './fixtures/HostCore.js';

test('lightning preserves the native node amplitudes, segment count and full reach', (t) => {
  t.mock.method(Math, 'random', () => 0.25);
  t.mock.method(performance, 'now', () => 130);
  class Batch {
    clear() {}
  }
  const segments: number[][] = [];
  let created = 0,
    returned = 0;
  const game: any = {
    linePool: {
      getLine() {
        created++;
        const points: number[] = [];
        return {
          init() {},
          set_blendMode() {},
          set_thickness() {},
          set_x(x: number) {
            points[0] = x;
          },
          set_y(y: number) {
            points[1] = y;
          },
          lineTo(x: number, y: number) {
            points[2] = x;
            points[3] = y;
          },
          points,
        };
      },
      removeLine() {
        returned++;
      },
    },
  };
  class Line extends Batch {
    g = game;
    lines = [];
    amplitude = 5;
    period = 100;
    nodeFrequence = 4;
    thickness = 2;
    get_x() {
      return 10;
    }
    get_y() {
      return 20;
    }
    get_color() {
      return 123;
    }
    lineTo(_x: number, _y: number) {
      throw Error('unexpected native path');
    }
    addMesh(segment: { points: number[] }) {
      segments.push([...segment.points]);
    }
  }
  const hooks = new Hooks();
  const api: any = {
    cls: (name: string) =>
      name === 'core.hud.components.BeamLine'
        ? Line
        : name === 'starling.display.MeshBatch'
          ? Batch
          : class {},
    around: (t: object, k: string, fn: Function) => hooks.add(t, k, 'around', fn),
  };
  bindGameClasses(api);
  installWeaponLightning(api, game);
  const line = new Line();
  line.lineTo(110, 20);
  assert.equal(created, 4);
  for (const [index, amplitude] of [5, 7.5, 10].entries()) {
    const node = index + 1;
    assert.deepEqual(segments[index].slice(2), [
      node * 25 + amplitude * lightningNoise(250 + node * 43.17, 2),
      amplitude * lightningNoise(250 + node * 29.53 + 13, 2),
    ]);
  }
  assert.deepEqual(segments[0].slice(0, 2), [0, 0]);
  assert.deepEqual(segments.at(-1)?.slice(2), [100, 0]);
  for (let i = 1; i < segments.length; i++)
    assert.deepEqual(segments[i].slice(0, 2), segments[i - 1].slice(2));
  line.lineTo(10, 30);
  assert.equal(returned, 3);
  assert.deepEqual(segments.at(-1), [0, 0, 0, 10]);
});

test('a muzzle launch takes the displayed ship rotation once and skips distant secondary origins', () => {
  const p: any = {
    unit: {
      weaponPos: { x: 10, y: 0 },
      hasRenderPosition: true,
      get_pos: () => ({ x: 100, y: 200 }),
      get_rotation: () => 0,
      get_renderRotation: () => Math.PI / 2,
      get_renderX: () => 101,
      get_renderY: () => 203,
      get_radius: () => 20,
    },
    course: { pos: { x: 110, y: 200 }, time: 123 },
    weapon: { positionOffsetX: 0, positionXVariance: 0, multiOffset: 0, positionYVariance: 0 },
  };
  const launch = weaponLaunchOffset(p)!;
  assert.ok(Math.abs(110 + launch.x - 101) < 1e-9);
  assert.equal(200 + launch.y, 213);
  assert.equal(launch.rotation, Math.PI / 2);
  p.course.pos.x = 1000;
  assert.equal(weaponLaunchOffset(p), undefined);
});
