import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { API } from '../src/api/Types';
import { aliasProperties, type Resolve } from '../src/runtime/HaxeInterop';
import { createProfilerWindow } from '../src/network/ProfilerWindow';
import { createDisposeDebugWindow } from '../src/network/DisposeDebugWindow';
import { Display } from './fixtures/NativeGame';
import { overlayClasses } from './fixtures/NativeOverlay';

for (const [name, factory] of [
  ['profiler', createProfilerWindow],
  ['disposal', createDisposeDebugWindow],
] as const) {
  test(`${name} redraw reacquires native graphics aliases after room cleanup`, () => {
    const classes = {
      ...overlayClasses(Display, true),
      'openfl.geom.Point': class {
        constructor(
          public x = 0,
          public y = 0,
        ) {}
      },
      'openfl.ui.Keyboard': { ESCAPE: 27 },
    };
    let previous: ReturnType<typeof factory> | undefined;
    for (let room = 0; room < 4; room++) {
      const cleanups: Array<() => void> = [];
      const scope = {
        defer: (cleanup: () => void) => {
          cleanups.push(cleanup);
          return cleanup;
        },
      } as API;
      const resolve: Resolve = (name) => {
        const native = Reflect.get(classes, name);
        assert.ok(native, name);
        aliasProperties(scope, native);
        return native;
      };
      const Window = factory(resolve);
      if (previous) assert.equal(Window, previous, 'retains saved window geometry across rooms');
      previous = Window;
      const panel = new Window(); // Constructor redraw really invokes graphics.clear().
      panel.dispose();
      for (const cleanup of cleanups.reverse()) cleanup();
      assert.equal('graphics' in classes['openfl.display.Sprite'].prototype, false);
      if (room === 0)
        assert.throws(
          () => new Window(),
          /reading 'clear'/,
          'old cached-constructor path reproduces the reported failure',
        );
    }
  });
}
