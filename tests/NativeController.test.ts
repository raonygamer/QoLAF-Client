import assert from 'node:assert/strict';
import { test } from 'node:test';
import { build } from 'esbuild';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import type { API } from '../src/api/Types';
import { defaultControllerPreferences } from '../src/controller/ControllerSettings';
// @ts-expect-error production hook dispatcher fixture
import { Hooks } from './fixtures/HostCore.js';

test('controller hooks merge keyboard input, preserve boost edges, cycle weapons, and unwind cleanly', async (t) => {
  const directory = await mkdtemp(join(tmpdir(), 'qolaf-controller-'));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const file = join(directory, 'controller.mjs');
  await build({
    stdin: {
      contents:
        "export { installNativeController } from './src/controller/NativeController'; export { bindGameClasses } from './src/game/Bindings';",
      resolveDir: process.cwd(),
    },
    outfile: file,
    bundle: true,
    platform: 'browser',
    format: 'esm',
    loader: { '.png': 'dataurl' },
  });
  const module = (await import(pathToFileURL(file).href)) as {
    bindGameClasses(api: API): void;
    installNativeController(api: API): void;
  };
  const globals = ['window', 'document', 'navigator', 'HTMLElement'] as const;
  const original = globals.map((name) => Object.getOwnPropertyDescriptor(globalThis, name));
  let focused = true;
  let connected = true;
  const buttons = Array.from({ length: 18 }, () => ({ value: 0 }));
  const pad = { buttons, axes: [0, 0, 0, 0], index: 0, id: 'Xbox', connected: true };
  Object.defineProperties(globalThis, {
    window: { configurable: true, value: new EventTarget() },
    document: {
      configurable: true,
      value: { hidden: false, hasFocus: () => focused, activeElement: null },
    },
    navigator: { configurable: true, value: { getGamepads: () => (connected ? [pad] : []) } },
    HTMLElement: { configurable: true, value: class {} },
  });
  class Display {
    addChild() {}
    set_touchable() {}
    set_x() {}
    removeFromParent() {}
  }
  const keyboard = new Set<number>();
  class Keys {
    isInputDown(action: number) {
      return keyboard.has(action);
    }
    isInputUp(action: number) {
      return !keyboard.has(action);
    }
    isInputPressed(_action: number) {
      return false;
    }
  }
  let boosts = 0;
  let commandable = true;
  let respawns = 0;
  const fire: boolean[] = [];
  const switches: number[] = [];
  const game = {
    send: (name: string) => {
      if (name === 'respawn') respawns++;
    },
    get_isLeaving: () => false,
    chatInput: { isActive: () => false },
    get_stage: () => null,
    hud: { weaponHotkeys: { selectedHotkey: { key: 1 } } },
  };
  class Roaming {
    g = game;
    keybinds = new Keys();
    me = {
      get_commandable: () => commandable,
      respawnReady: () => true,
      respawnNextReady: 123,
      ship: {
        weaponIsChanging: false,
        weapons: [
          { active: true, hotkey: 1 },
          { active: true, hotkey: 3 },
        ],
      },
      sendChangeWeapon: (key: number) => switches.push(key),
    };
    updateInput() {
      if (this.keybinds.isInputPressed(15)) boosts++;
      fire.push(this.keybinds.isInputDown(19));
      assert.equal(this.keybinds.isInputUp(19), !this.keybinds.isInputDown(19));
    }
  }
  const preferences = defaultControllerPreferences();
  preferences.enabled = true;
  const cleanups: (() => void)[] = [];
  const hooks = new Hooks((error: unknown) => {
    throw error;
  });
  const classes: Record<string, unknown> = {
    'data.KeyBinds': Keys,
    'core.states.gameStates.RoamingState': Roaming,
    'starling.display.Sprite': Display,
    'starling.display.Quad': Display,
    'starling.core.Starling': { get_current: () => null },
  };
  const api = {
    cls: (name: string) => classes[name] ?? {},
    storage: { get: () => preferences, set() {} },
    on() {
      return () => {};
    },
    defer(cleanup: () => void) {
      cleanups.push(cleanup);
      return cleanup;
    },
    around(target: object, key: string, callback: unknown) {
      const cleanup = hooks.add(target, key, 'around', callback);
      cleanups.push(cleanup);
      return cleanup;
    },
    log() {},
  } as unknown as API;
  module.bindGameClasses(api);
  module.installNativeController(api);
  t.after(() => cleanups.reverse().forEach((cleanup) => cleanup()));
  t.after(() =>
    globals.forEach((name, index) => {
      const descriptor = original[index];
      if (descriptor) Object.defineProperty(globalThis, name, descriptor);
      else Reflect.deleteProperty(globalThis, name);
    }),
  );
  const state = new Roaming();
  buttons[0].value = buttons[7].value = 1;
  state.updateInput();
  state.updateInput();
  assert.equal(boosts, 1, 'holding boost does not repeatedly activate it');
  assert.deepEqual(fire, [true, true]);
  buttons[7].value = 0;
  keyboard.add(19);
  state.updateInput();
  assert.equal(fire.at(-1), true, 'releasing controller fire preserves a held keyboard binding');
  keyboard.clear();
  buttons[5].value = 1;
  state.updateInput();
  state.updateInput();
  assert.deepEqual(switches, [3]);
  commandable = false;
  state.updateInput();
  assert.equal(respawns, 0, 'a held boost must not immediately respawn after death');
  buttons[0].value = 0;
  state.updateInput();
  buttons[0].value = 1;
  state.updateInput();
  state.updateInput();
  assert.equal(respawns, 1, 'respawn requires a fresh press and uses the native request');
  focused = false;
  state.updateInput();
  assert.equal(fire.at(-1), false);
  focused = true;
  connected = false;
  state.updateInput();
  assert.equal(fire.at(-1), false);
});
