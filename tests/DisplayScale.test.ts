import assert from 'node:assert/strict';
import { test } from 'node:test';
import { installDisplayScale, scaledStageSize } from '../src/Rendering/DisplayScale';
import { DeviceSettings } from '../src/Settings/DeviceSettings';

test('DPI uses original even physical and logical sizes', () => {
  assert.equal(scaledStageSize(1879, 1), 1878);
  assert.equal(scaledStageSize(1879, 1.25), 1502);
  assert.equal(scaledStageSize(965, 1.25), 770);
  assert.equal(scaledStageSize(1, 2), 2);
  assert.equal(scaledStageSize(965, 0.5), 1928);
});

test('DPI survives cached resize callbacks, updates layout and restores on unload', () => {
  class Stage {
    width = 0;
    height = 0;
    resizes = 0;
    set_stageWidth(value: number) {
      this.width = value;
    }
    set_stageHeight(value: number) {
      this.height = value;
    }
    dispatchEventWith(type: string) {
      assert.equal(type, 'resize');
      // Reproduce RymdenRunt's pre-bound resize callback: physical stage -> logical stage.
      this.set_stageWidth(native.stageWidth - (native.stageWidth % 2));
      this.set_stageHeight(native.stageHeight - (native.stageHeight % 2));
      this.resizes++;
    }
  }
  const native = { stageWidth: 1879, stageHeight: 965 };
  const stage = new Stage();
  const other = new Stage();
  const starling = { stage, nativeStage: native };
  const cleanups: Function[] = [];
  const settings = new DeviceSettings({ get: (_key, fallback) => fallback, set() {} });
  const api: any = {
    cls: (name: string) =>
      name === 'starling.display.Stage'
        ? Stage
        : name === 'starling.core.Starling'
          ? { get_current: () => starling }
          : undefined,
    defer: (fn: Function) => cleanups.push(fn),
    around: (target: any, key: string, hook: Function) => {
      const original = target[key];
      target[key] = function (...args: any[]) {
        return hook.call(this, original.bind(this), ...args);
      };
      cleanups.push(() => {
        target[key] = original;
      });
    },
    onGame() {},
  };
  installDisplayScale(api, settings);
  settings.set('dpiScale', 1.25);
  assert.equal(stage.width, 1502);
  assert.equal(stage.height, 770);
  other.set_stageWidth(501);
  assert.equal(other.width, 501, 'unrelated Starling stages remain untouched');
  native.stageWidth = 1281;
  native.stageHeight = 721;
  stage.dispatchEventWith('resize');
  assert.equal(stage.width, 1024);
  assert.equal(stage.height, 576);
  settings.set('dpiScale', 1.25);
  assert.equal(stage.width, 1024, 'no double-scaling');
  cleanups.reverse().forEach((fn) => fn());
  assert.equal(stage.width, 1280);
  assert.equal(stage.height, 720);
  settings.set('dpiScale', 2);
  assert.equal(stage.width, 1280, 'subscription removed');
});
