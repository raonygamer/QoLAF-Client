import assert from 'node:assert/strict';
import { test } from 'node:test';
import { circleInCameraView, updateCameraView } from '../src/rendering/CameraView';
import { updateBodyVisibility, installBodyVisibility } from '../src/rendering/BodyVisibility';
// @ts-expect-error actual host hooks
import { Hooks } from './fixtures/HostCore.js';

class Point {
  x = 0;
  y = 0;
  setTo(x: number, y: number) {
    this.x = x;
    this.y = y;
  }
}
function cameraFixture(width = 800, height = 600) {
  return {
    _stage: { get_stageWidth: () => width, get_stageHeight: () => height },
    _stageContainer: {
      x: 200,
      y: 100,
      scale: 0.5,
      get_scaleX() {
        return this.scale;
      },
      get_scaleY() {
        return this.scale;
      },
      globalToLocal(input: Point, output: Point) {
        output.setTo((input.x - this.x) / this.scale, (input.y - this.y) / this.scale);
      },
    },
    _zoomFactor: 0.1,
  } as any;
}

test('large effects enclosing the viewport remain visible, including edge intersections', () => {
  const camera = { _upperLeftX: -400, _lowerRightX: 400, _upperLeftY: -300, _lowerRightY: 300 };
  // The actual native algorithm misses an enclosing sun when none of its corners
  // land inside the viewport. This is the original client's overlap correction.
  const native = (x: number, y: number, radius: number) =>
    [
      [x + radius, y + radius],
      [x - radius, y + radius],
      [x + radius, y - radius],
      [x - radius, y - radius],
    ].some(([a, b]) => a >= -400 && a <= 400 && b >= -300 && b <= 300);
  assert.equal(native(0, 0, 1000), false);
  assert.equal(circleInCameraView(camera, 0, 0, 1000), true);
  assert.equal(circleInCameraView(camera, 900, 0, 500), true);
  assert.equal(circleInCameraView(camera, 901, 0, 500), false);
  assert.equal(circleInCameraView(camera, 0, 0, 1), true);
});

test('camera uses displayed zoom and offsets, and revisions persist across stationary render frames', () => {
  const camera = cameraFixture();
  const corner = new Point();
  updateCameraView(camera, corner);
  assert.equal(camera._upperLeftX, -400);
  assert.equal(camera._upperLeftY, -200);
  assert.equal(camera._lowerRightX, 1200);
  assert.equal(camera._lowerRightY, 1000);
  assert.equal(camera._worldCullingRadius, 1600);
  assert.equal(camera._viewSizeRevision, 1);
  camera._stageContainer.x += 5;
  for (let i = 0; i < 6; i++) updateCameraView(camera, corner);
  assert.equal(camera._viewSizeRevision, 1);
  camera._stageContainer.scale = 1;
  updateCameraView(camera, corner);
  for (let i = 0; i < 6; i++) updateCameraView(camera, corner);
  assert.equal(camera._viewSizeRevision, 2);
  assert.equal(camera._worldCullingRadius, 800);
  camera._stageContainer.scale = 0;
  updateCameraView(camera, corner);
  assert.equal(camera._worldCullingRadius, 800, 'degenerate transform keeps last valid bounds');
});

test('portrait culling includes all viewport corners', () => {
  const camera = cameraFixture(300, 1600);
  updateCameraView(camera, new Point());
  assert.equal(camera._worldCullingRadius, Math.hypot(600, 3200) * 0.5);
});

test('body culling includes sprite and zone extent without altering course', () => {
  const camera = cameraFixture();
  updateCameraView(camera, new Point());
  const body: any = {
    g: { camera, get_me: () => ({ ship: {} }) },
    type: 'sun',
    pos: { x: 3500, y: 400 },
    _mc: { get_width: () => 1600, get_height: () => 1600 },
    safeZoneRadius: 0,
    hostileZoneRadius: 0,
    isAddedToCanvas: false,
    addToCanvasForReal() {
      this.isAddedToCanvas = true;
    },
    removeFromCanvas() {
      this.isAddedToCanvas = false;
    },
  };
  updateBodyVisibility(body);
  assert.equal(body.isAddedToCanvas, true, 'visible edge of a large sun remains attached');
  assert.deepEqual(body.pos, { x: 3500, y: 400 });
  body._mc = null;
  updateBodyVisibility(body);
  assert.equal(body.isAddedToCanvas, false);
  body.safeZoneRadius = 1000;
  updateBodyVisibility(body);
  assert.equal(body.isAddedToCanvas, true, 'safe-zone rings count toward visual extent');
  body.type = 'hidden';
  body.pos.x = 1e8;
  updateBodyVisibility(body);
  assert.equal(body.isAddedToCanvas, true, 'hidden body lifecycle remains native');
});

test('body ticks invalidate distance cache after zoom or resize even after intervening frames', () => {
  const camera = cameraFixture();
  updateCameraView(camera, new Point());
  class Body {
    g = { camera, get_me: () => ({ ship: {} }) };
    pos = { x: 10000, y: 10000 };
    type = 'planet';
    safeZoneRadius = 0;
    hostileZoneRadius = 0;
    nextDistanceCalculation = 9999;
    lastViewSizeRevision = 1;
    updateIsNear() {}
    updateBody() {
      if (this.nextDistanceCalculation <= 0) this.updateIsNear();
      else this.nextDistanceCalculation -= 33;
    }
  }
  const hooks = new Hooks();
  const cleanup: Function[] = [];
  installBodyVisibility({
    cls: () => Body,
    around: (object: any, key: string, fn: Function) =>
      cleanup.push(hooks.add(object, key, 'around', fn)),
    before: (object: any, key: string, fn: Function) =>
      cleanup.push(hooks.add(object, key, 'before', fn)),
  } as any);
  const body = new Body();
  camera._stageContainer.scale = 0.25;
  for (let i = 0; i < 8; i++) updateCameraView(camera, new Point());
  body.updateBody();
  assert.equal(body.lastViewSizeRevision, 2);
  assert.notEqual(body.nextDistanceCalculation, 9999 - 33);
  camera.isZooming = true;
  body.nextDistanceCalculation = 9999;
  body.updateBody();
  assert.notEqual(body.nextDistanceCalculation, 9999 - 33);
  cleanup.reverse().forEach((fn) => fn());
});
