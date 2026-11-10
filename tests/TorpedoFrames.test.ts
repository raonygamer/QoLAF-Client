import assert from 'node:assert/strict';
import { test } from 'node:test';
import { projectileOffsetSeconds, TorpedoFrames } from '../src/rendering/TorpedoFrames';
import { drawProjectileFrame } from '../src/rendering/ProjectileFrames';
import { xhersixTorpedoWeaponKey } from '../src/projectile/XhersixTorpedoCue';
import type { Raw } from '../src/api/Types';

test('source projectile timeline accepts signed intervals only within its finite horizon', () => {
  assert.equal(projectileOffsetSeconds(1000, 1033, 250), -0.033);
  assert.equal(projectileOffsetSeconds(1250, 1000, 250), 0.25);
  assert.equal(projectileOffsetSeconds(750, 1000, 250), -0.25);
  for (const values of [
    [1251, 1000, 250],
    [749, 1000, 250],
    [NaN, 1000, 250],
    [1000, Infinity, 250],
    [1e16, 1e16, 250],
    [1000, 1000, -1],
    [1000, 1000, Infinity],
    [1000, 1000, 1e8],
  ])
    assert.ok(Number.isNaN(projectileOffsetSeconds(values[0], values[1], values[2])));
});

function fixture() {
  let now = 1000;
  let reads = 0;
  const game = {
    time: 990,
    gameStateMachine: { accumulator: 16.5 },
    clock: {
      getServerTime: () => {
        reads++;
        return now;
      },
    },
    getServerTime: () => assert.fail('display must not write the simulation clock'),
  };
  const projectile: Raw = {
    g: game,
    alive: true,
    isEnemy: true,
    ai: 'bullet',
    wave: false,
    weapon: { key: xhersixTorpedoWeaponKey },
    course: { time: 1033, pos: { x: 100, y: 200 }, speed: { x: 300, y: -100 } },
    ttl: 5000,
    rotation: 0,
    _mc: {
      set_x(value: number) {
        this.x = value;
      },
      set_y(value: number) {
        this.y = value;
      },
      set_rotation(value: number) {
        this.rotation = value;
      },
    } as Raw,
  };
  const frames = new TorpedoFrames();
  frames.capture(projectile, true);
  return {
    game,
    projectile,
    frames,
    setTime: (time: number) => {
      now = time;
    },
    reads: () => reads,
  };
}

test('torpedo display samples one clock per frame and moves smoothly without advancing physics', () => {
  for (const fps of [30, 60, 120, 180]) {
    const { frames, projectile, game, setTime, reads } = fixture();
    const original = structuredClone(projectile.course);
    let count = 0;
    for (let elapsed = 0; elapsed < 100; elapsed += 1000 / fps) {
      setTime(1000 + elapsed);
      frames.beginFrame(game);
      count++;
      for (let repeat = 0; repeat < 2; repeat++) {
        drawProjectileFrame(projectile, 0, undefined, (p, fallback) => frames.seconds(p, fallback));
        assert.ok(Math.abs(projectile._mc.x - (100 + 0.3 * (elapsed - 33))) < 1e-8);
        assert.ok(Math.abs(projectile._mc.y - (200 - 0.1 * (elapsed - 33))) < 1e-8);
      }
    }
    assert.equal(reads(), count);
    assert.equal(game.time, 990);
    assert.equal(projectile.ttl, 5000);
    assert.deepEqual(projectile.course, original);
  }
});

test('torpedo prediction is scoped to the captured setting and exact projectile kind', () => {
  const { frames, projectile, game, setTime } = fixture();
  assert.equal(frames.seconds(projectile, 0.01), -0.033, 'draw before first frame reads the clock');
  frames.beginFrame(game);
  for (const [key, value] of [
    ['isEnemy', false],
    ['ai', 'missile'],
    ['wave', true],
    ['weapon', { key: 'other' }],
  ] as const) {
    const previous = projectile[key];
    projectile[key] = value;
    assert.equal(frames.seconds(projectile, 0.01), 0.01);
    projectile[key] = previous;
  }
  setTime(5000);
  frames.beginFrame(game);
  assert.equal(
    frames.seconds(projectile, 0.01),
    0,
    'stale course must not extrapolate beyond the horizon',
  );
  frames.capture(projectile, false);
  assert.equal(frames.seconds(projectile, 0.01), 0.01);
  frames.capture(projectile, true);
  frames.reset(projectile);
  assert.equal(frames.seconds(projectile, 0.01), 0.01, 'pool reset removes old eligibility');
});
