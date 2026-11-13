import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { API } from '../src/api/Types';
import { bindGameClasses } from '../src/game/Bindings';
import { installInstantCulling } from '../src/projectile/InstantCulling';
// @ts-expect-error production hook dispatcher
import { Hooks } from './fixtures/HostCore.js';
// @ts-expect-error captured native culling prefix
import { createNativeProjectileCull } from './fixtures/NativeProjectileCull.js';

class Point {
  constructor(
    public x = 0,
    public y = 0,
  ) {}
  subtract(other: Point) {
    return new Point(this.x - other.x, this.y - other.y);
  }
}

test('instant ray culling includes zoomed viewport and restores native camera query before construction', () => {
  let zoom = 1;
  let ai = 'instant';
  let fail = false;
  const center = new Point(0, 0);
  class Camera {
    focusTarget: object | null = null;
    getCameraCenter() {
      return center;
    }
  }
  const camera = new Camera();
  const nativeCenter = camera.getCameraCenter;
  const stage = { get_stageWidth: () => 800, get_stageHeight: () => 600 };
  const game = {
    camera,
    canvas: { get_scaleX: () => zoom },
    get_stage: () => stage,
    get_me: () => ({ ship: {} }),
  };
  const position = new Point(700, 0);
  const clip = {};
  const owner = { get_pos: () => position, get_movieClip: () => clip };
  const weapon = { type: 'projectile', range: 300, speed: 0, ttl: 100, global: false };
  const shot = {};
  const factory = {
    create: createNativeProjectileCull(() => {
      assert.equal(camera.getCameraCenter(), center, 'construction sees actual camera position');
      if (fail) throw new Error('construction failed');
      return shot;
    }) as (
      key: string,
      scene: typeof game,
      unit: typeof owner,
      gun: typeof weapon,
      heading?: { pos: Point },
    ) => object | null,
  };
  const classes: Record<string, unknown> = {
    'core.projectile.ProjectileFactory': factory,
    'camerafocus.StarlingCameraFocus': Camera,
    'openfl.geom.Point': Point,
    'data.DataLocator': { getService: () => ({ loadKey: () => ({ ai }) }) },
  };
  const cleanups: Array<() => void> = [];
  const hooks = new Hooks((error: unknown) => {
    throw error;
  });
  const api = {
    cls: (name: string) => classes[name] ?? {},
    around: (object: object, name: string, fn: unknown) => {
      const off = hooks.add(object, name, 'around', fn);
      cleanups.push(off);
      return off;
    },
  } as unknown as API;
  bindGameClasses(api);
  installInstantCulling(api);
  const create = () => factory.create('ray', game, owner, weapon);
  try {
    assert.equal(create(), shot, 'offscreen origin can reach viewport');
    position.x = 801;
    assert.equal(create(), null);
    zoom = 0.5;
    assert.equal(create(), shot, 'zoom-out extends visible radius');
    position.x = 1301;
    assert.equal(create(), null);
    assert.equal(
      factory.create('ray', game, owner, weapon, { pos: new Point(200, 0) }),
      shot,
      'server heading chooses origin',
    );
    zoom = -0.5;
    position.x = 1000;
    assert.equal(create(), shot);
    zoom = 0;
    weapon.global = true;
    position.x = 6001;
    assert.equal(create(), null, 'global weapon cap remains');
    camera.focusTarget = clip;
    assert.equal(create(), shot, 'focused owner retains native exemption');
    camera.focusTarget = null;
    weapon.global = false;
    zoom = 1;
    position.x = 700;
    ai = 'bullet';
    assert.equal(create(), null, 'ordinary projectiles retain native culling');
    ai = 'instant';
    fail = true;
    assert.throws(create, /construction failed/);
    assert.equal(camera.getCameraCenter(), center, 'exception leaves no pending override');
    assert.equal(cleanups.length, 2, 'shots do not accumulate disposable hooks');
  } finally {
    cleanups.reverse().forEach((off) => off());
  }
  fail = false;
  assert.equal(camera.getCameraCenter, nativeCenter);
  assert.equal(create(), null, 'unload restores native origin-only culling');
});
