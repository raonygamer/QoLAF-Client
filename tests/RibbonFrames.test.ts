import type { Projectile } from '../src/game/Bindings';
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { drawProjectileFrame } from '../src/rendering/ProjectileFrames';
import { updateRibbonHead } from '../src/rendering/RibbonFrames';

test('ribbon head follows display frames while tail history and simulation remain unchanged', () => {
  const head = {
    x0: 0,
    y0: 0,
    x1: 0,
    y1: 0,
    alpha: 0.7,
    setTo2(x: number, y: number, width: number, angle: number, alpha = 1) {
      this.alpha = alpha;
      this.x0 = x + Math.sin(angle) * width;
      this.y0 = y - Math.cos(angle) * width;
      this.x1 = x - Math.sin(angle) * width;
      this.y1 = y + Math.cos(angle) * width;
    },
  };
  const vertices = [
    [0, 0],
    [0, 0],
    [-10, -2],
    [-10, 2],
  ];
  const alphas = [0, 0, 0.5, 0.5];
  const history = [{ x0: -3, y0: -2, x1: -3, y1: 2 }];
  const trail = {
    mFollowingRibbonSegmentLine: [head],
    mNumRibbonSegments: 2,
    mRibbonSegments: history,
    get_isPlaying: () => true,
    setVertexPosition(index: number, x: number, y: number) {
      vertices[index] = [x, y];
    },
    setVertexAlpha(index: number, alpha: number) {
      alphas[index] = alpha;
    },
    advanceTime() {
      assert.fail('render frames must not advance trail history');
    },
  };
  const clip = {
    x: 0,
    y: 0,
    rotation: 0,
    get_x() {
      return this.x;
    },
    get_y() {
      return this.y;
    },
    get_rotation() {
      return this.rotation;
    },
    set_x(x: number) {
      this.x = x;
    },
    set_y(y: number) {
      this.y = y;
    },
    set_rotation(rotation: number) {
      this.rotation = rotation;
    },
  };
  const p = {
    alive: true,
    isVisible: true,
    useRibbonOffset: true,
    get_radius: () => 5,
    ribbonThickness: 2,
    ribbonTrail: trail,
    followingRibbonSegment: head,
    _mc: clip,
    rotation: Math.PI / 2,
    get_rotation() {
      return this.rotation;
    },
    course: { pos: { x: 100, y: 200 }, speed: { x: 300, y: 0 } },
    g: { gameStateMachine: { accumulator: 0 } },
  };
  for (const fps of [60, 120, 180]) {
    for (let time = 0; time < 33; time += 1000 / fps) {
      p.g.gameStateMachine.accumulator = time;
      drawProjectileFrame(p as unknown as Projectile, 0);
      const centerX = (vertices[0][0] + vertices[1][0]) / 2;
      const centerY = (vertices[0][1] + vertices[1][1]) / 2;
      assert.ok(Math.abs(centerX - (100 + 0.3 * time)) < 1e-10);
      assert.equal(centerY, 195);
      assert.deepEqual(vertices.slice(2), [
        [-10, -2],
        [-10, 2],
      ]);
      assert.deepEqual(history, [{ x0: -3, y0: -2, x1: -3, y1: 2 }]);
      assert.deepEqual(alphas, [1, 1, 0.5, 0.5]);
    }
  }
  assert.deepEqual(p.course.pos, { x: 100, y: 200 });
  p.isVisible = false;
  const before = structuredClone(vertices);
  p.g.gameStateMachine.accumulator = 32;
  drawProjectileFrame(p as unknown as Projectile, 0);
  assert.deepEqual(vertices, before);
});

test('pooled or stopped ribbon heads are not written', () => {
  const trail = {
    mFollowingRibbonSegmentLine: null,
    mNumRibbonSegments: 0,
    get_isPlaying: () => false,
    setVertexPosition() {
      assert.fail('inactive trail');
    },
    setVertexAlpha() {
      assert.fail('inactive trail');
    },
  };
  updateRibbonHead(trail);
});
