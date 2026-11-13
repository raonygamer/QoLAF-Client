import type { TargetSystem } from '../src/target/TargetSystem';
import type { BitmapData } from '../src/game/Bindings';
import { bindGameClasses, type Texture, type GameScene } from '../src/game/Bindings';
import type { API } from '../src/api/Types';
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { TargetAimIndicator, loadTargetAimIndicator } from '../src/ui/TargetAimIndicator';
import { Display } from './fixtures/NativeGame';

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
  bindGameClasses({
    cls: (name: string) =>
      ({
        'starling.display.Sprite': Display,
        'starling.display.Image': Arrow,
      })[name] ?? {},
  } as unknown as API);
  const unit = {
    alive: true,
    pos: { x: 999, y: 999 },
    movieClip: {
      x: 100,
      y: 200,
      get_x() {
        return this.x;
      },
      get_y() {
        return this.y;
      },
      get_width: () => 40,
      get_height: () => 20,
    },
    get_movieClip() {
      return this.movieClip;
    },
  };
  const target: any = { current: unit, valid: (value: any) => value?.alive };
  const indicator = new TargetAimIndicator(target, {
    dispose: () => disposed++,
  } as unknown as Texture);
  indicator.update(0.5, false);
  assert.equal(indicator.node.get_visible(), true);
  const arrows = (indicator.node as unknown as Display).children as Arrow[];
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
  const api = {
    defer: (fn: () => void) => {
      cleanup = fn;
    },
    log() {},
  } as unknown as API;
  bindGameClasses({
    cls: () => ({
      loadFromBase64: () => ({
        onError() {},
        onComplete: (fn: Function) => {
          complete = fn;
        },
      }),
    }),
  } as unknown as API);
  loadTargetAimIndicator(
    api,
    {
      canvas: {
        addChild: () => {
          attached = true;
        },
      },
    } as unknown as GameScene,
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

test('target bitmap survives texture restoration lifetime and is released on exit or setup failure', () => {
  for (const failAttachment of [false, true]) {
    class Arrow extends Display {
      set_color() {}
      alignPivot() {}
    }
    const disposed: string[] = [];
    const bitmap = { dispose: () => disposed.push('bitmap') } as unknown as BitmapData;
    const texture = { dispose: () => disposed.push('texture') };
    const classes: Record<string, unknown> = {
      'starling.display.Sprite': Display,
      'starling.display.Image': Arrow,
      'starling.textures.Texture': { fromBitmapData: () => texture },
      'openfl.display.BitmapData': {
        loadFromBase64: () => ({
          onError() {},
          onComplete(callback: (value: BitmapData) => void) {
            callback(bitmap);
          },
        }),
      },
    };
    bindGameClasses({ cls: (name: string) => classes[name] ?? {} } as unknown as API);
    let cleanup = () => {};
    let ready = false;
    const api = {
      defer: (callback: () => void) => {
        cleanup = callback;
      },
      log() {},
    } as unknown as API;
    const canvas = new Display();
    if (failAttachment)
      canvas.addChild = () => {
        throw new Error('Canvas disposed');
      };
    loadTargetAimIndicator(
      api,
      { canvas } as unknown as GameScene,
      {} as TargetSystem,
      'data:image/png;base64,AA==',
      () => {
        ready = true;
      },
    );
    assert.equal(ready, !failAttachment);
    assert.deepEqual(disposed, failAttachment ? ['texture', 'bitmap'] : []);
    cleanup();
    assert.deepEqual(disposed, ['texture', 'bitmap']);
  }
});
