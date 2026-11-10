import assert from 'node:assert/strict';
import { test } from 'node:test';
import { TargetAimIndicator, loadTargetAimIndicator } from '../src/UI/TargetAimIndicator';
import { Display } from './Fixtures/NativeGame';

test('original three-arrow marker follows render pose and settings without changing the target', () => {
  class Arrow extends Display {
    rotation = 0;
    set_rotation(value: number) {
      this.rotation = value;
    }
    get_rotation() {
      return this.rotation;
    }
    set_color() {}
    alignPivot() {}
  }
  let disposed = 0;
  const ui: any = {
    sprite: () => new Display(),
    image: () => new Arrow(),
    dispose: (node: Display) => node.dispose(),
  };
  const unit = {
    alive: true,
    pos: { x: 999, y: 999 },
    movieClip: { x: 100, y: 200, width: 40, height: 20 },
  };
  const target: any = { current: unit, valid: (value: any) => value?.alive };
  const indicator = new TargetAimIndicator(ui, target, { dispose: () => disposed++ });
  indicator.update(0.5, false);
  assert.equal(indicator.node.get_visible(), true);
  const arrows = indicator.node.children as Arrow[];
  assert.equal(arrows.length, 3);
  assert.equal(arrows[0].get_x(), 145);
  assert.equal(arrows[0].get_y(), 200);
  assert.equal(arrows[0].get_rotation(), Math.PI);
  assert.ok(Math.abs(arrows[1].get_x() - 77.5) < 1e-9);
  unit.movieClip.x = 110;
  indicator.update(0.1, false);
  const radius = 45 + Math.sin(3) * 4;
  assert.ok(Math.abs(arrows[0].get_x() - (110 + radius * Math.cos((16 * Math.PI) / 180))) < 1e-9);
  indicator.update(0.1, true);
  assert.equal(indicator.node.get_visible(), false);
  unit.alive = false;
  indicator.update(0.1, false);
  assert.equal(indicator.node.get_visible(), false);
  assert.equal(target.current, unit);
  assert.deepEqual(unit.pos, { x: 999, y: 999 });
  indicator.dispose();
  assert.equal(disposed, 1);
});

test('target texture completing after session exit is disposed without attaching a marker', () => {
  let complete: Function = () => {};
  let cleanup: Function = () => {};
  let disposed = false;
  let attached = false;
  const ui: any = {
    api: {
      defer: (fn: Function) => {
        cleanup = fn;
      },
      log() {},
    },
    cls: () => ({
      loadFromBase64: () => ({
        onError() {},
        onComplete: (fn: Function) => {
          complete = fn;
        },
      }),
    }),
  };
  loadTargetAimIndicator(
    ui,
    {
      canvas: {
        addChild: () => {
          attached = true;
        },
      },
    },
    {} as any,
    'data:image/png;base64,AA==',
    () => {},
  );
  cleanup();
  complete({
    dispose: () => {
      disposed = true;
    },
  });
  assert.equal(disposed, true);
  assert.equal(attached, false);
});
