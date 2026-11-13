import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { API } from '../src/api/Types';
import { bindGameClasses } from '../src/game/Bindings';
import { installFrameRate } from '../src/rendering/FrameRate';
import { DeviceSettings } from '../src/settings/DeviceSettings';
// @ts-expect-error actual host dispatcher
import { Hooks } from './fixtures/HostCore.js';

for (const nativeHTML5 of [false, true])
  for (const alreadyStarted of [false, true]) {
    test(`frame limit covers login and room changes, restores on unload (started=${alreadyStarted}, HTML5=${nativeHTML5})`, () => {
      let current: Renderer | null = null;
      const cleanup: Array<() => void> = [];
      const gameListeners: Array<() => void> = [];
      class Renderer {
        static get_current() {
          return current;
        }
        rate = 60;
        skip = true;
        writes = 0;
        backend = { framePeriod: -1 };
        stage = {
          window: nativeHTML5 ? { application: { __backend: this.backend } } : undefined,
          get_frameRate: () =>
            nativeHTML5
              ? this.backend.framePeriod < 0
                ? 60
                : 1000 / this.backend.framePeriod
              : this.rate,
          set_frameRate: (rate: number) => {
            this.writes++;
            if (nativeHTML5) this.backend.framePeriod = rate >= 60 ? -1 : 1000 / rate;
            return (this.rate = rate);
          },
        };
        get_nativeStage() {
          return this.stage;
        }
        get_skipUnchangedFrames() {
          return this.skip;
        }
        set_skipUnchangedFrames(skip: boolean) {
          return (this.skip = skip);
        }
        start() {
          current = this;
        }
      }
      class Login {
        init() {}
      }
      const renderer = new Renderer();
      if (alreadyStarted) renderer.start();
      const hooks = new Hooks((error: unknown) => {
        throw error;
      });
      const api = {
        cls: (name: string) =>
          name === 'starling.core.Starling' ? Renderer : name === 'Login' ? Login : {},
        defer: (fn: () => void) => cleanup.push(fn),
        after: (owner: object, method: string, fn: unknown) => {
          const off = hooks.add(owner, method, 'after', fn);
          cleanup.push(off);
          return off;
        },
        onGame: (fn: () => void) => gameListeners.push(fn),
      } as unknown as API;
      bindGameClasses(api);
      const settings = new DeviceSettings({ get: (_key, fallback) => fallback, set() {} });
      settings.set('renderFrameRate', 144);
      installFrameRate(api, settings);
      if (!alreadyStarted) {
        assert.equal(renderer.stage.get_frameRate(), 60);
        renderer.start();
      }
      assert.equal(
        renderer.stage.get_frameRate(),
        144,
        'saved limit applies before entering a room',
      );
      assert.equal(renderer.skip, false);
      new Login().init();
      gameListeners.forEach((fn) => fn());
      gameListeners.forEach((fn) => fn());
      assert.equal(
        renderer.writes,
        1,
        'room transitions do not reset or reapply an unchanged limit',
      );
      settings.set('renderFrameRate', 241);
      assert.equal(renderer.stage.get_frameRate(), nativeHTML5 ? 60 : 1000);
      if (nativeHTML5) assert.equal(renderer.backend.framePeriod, -1);
      settings.set('renderFrameRate', 30);
      assert.ok(Math.abs(renderer.stage.get_frameRate() - 30) < 1e-9);
      cleanup.reverse().forEach((fn) => fn());
      assert.equal(renderer.stage.get_frameRate(), 60);
      assert.equal(renderer.skip, true);
      settings.set('renderFrameRate', 120);
      new Login().init();
      gameListeners.forEach((fn) => fn());
      assert.equal(renderer.stage.get_frameRate(), 60, 'unloaded callbacks cannot reapply the cap');
    });
  }
