import assert from 'node:assert/strict';
import { test } from 'node:test';
import { bindGameClasses, type GameScene } from '../src/game/Bindings';
import { DeviceSettings } from '../src/settings/DeviceSettings';
import type { API } from '../src/api/Types';
import { installNativeWorldZoom } from '../src/movement/NativeWorldZoom';
import { Display } from './fixtures/NativeGame';
// @ts-expect-error actual host hook dispatcher
import { Hooks } from './fixtures/HostCore.js';

test('native world zoom respects overlays, radar, text focus and disconnected scenes', (t) => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const cleanup: Array<() => void> = [];
  t.after(() => cleanup.reverse().forEach((fn) => fn()));
  const win = new EventTarget();
  class Element {
    isContentEditable = false;
    tagName = 'INPUT';
  }
  const doc = { hidden: false, hasFocus: () => true, activeElement: null as Element | null };
  for (const [name, value] of Object.entries({
    window: win,
    document: doc,
    HTMLElement: Element,
  })) {
    const previous = Object.getOwnPropertyDescriptor(globalThis, name);
    Object.defineProperty(globalThis, name, { configurable: true, value });
    t.after(() => {
      if (previous) Object.defineProperty(globalThis, name, previous);
      else Reflect.deleteProperty(globalThis, name);
    });
  }
  let connected = true,
    recovered = false,
    radarVisible = false;
  const player = {
    zoom: 1,
    get_commandable: () => true,
    isLanded: false,
    get_isWarpJumping: () => false,
    ship: { alive: true, isTeleporting: false, stateMachine: { inState: () => true } },
  };
  let hit: object;
  const stage = { get_stageWidth: () => 800, get_stageHeight: () => 600, hitTest: () => hit };
  hit = stage;
  const canvas = { get_visible: () => true, contains: () => false };
  class PlayState {
    attached = true;
    container = Object.assign(new Display(), { get_stage: () => (this.attached ? stage : null) });
    get g() {
      return game;
    }
    keybinds = { isInputDown: (_key: number) => false };
    checkZoom() {}
    exit() {}
  }
  class RoamingState extends PlayState {
    get_loaded() {
      return true;
    }
    enter() {}
    exit() {
      super.exit();
    }
  }
  const cameraCalls: number[] = [];
  const cameraFrames: number[] = [];
  const game = {
    get_me: () => player,
    gameStateMachine: { currentState: new RoamingState() },
    canvas,
    camera: {
      zoomFocus: (value: number, frames: number) => {
        cameraCalls.push(value);
        cameraFrames.push(frames);
      },
    },
    get_stage: () => stage,
    get_isLeaving: () => false,
    get_connected: () => connected,
    serviceConnection: { get_connected: () => true },
    get_isRecoveringGameConnection: () => recovered,
    get_initialWorldIsRevealed: () => true,
    blockHotkeys: false,
    get_visible: () => true,
    get_alpha: () => 1,
    hud: {
      get_show: () => true,
      radar: {
        get_visible: () => radarVisible,
        get_stage: () => stage,
        globalToLocal: () => ({ x: 10, y: 10 }),
        radius: 50,
      },
    },
  };
  const classes: Record<string, unknown> = {
    'starling.filters.FragmentFilter': class {
      render() {}
    },
    'core.scene.Game': { instance: game },
    'core.states.gameStates.PlayState': PlayState,
    'core.states.gameStates.RoamingState': RoamingState,
    Login: { fadeScreen: null },
    'openfl.geom.Point': class {
      constructor(
        public x: number,
        public y: number,
      ) {}
    },
    'core.hud.components.ui.DomOverlay': {
      toCss: () => ({ x: 20, y: 30, width: 1600, height: 1200 }),
    },
  };
  const hooks = new Hooks();
  const api = {
    cls: (name: string) => classes[name] ?? {},
    defer: (fn: () => void) => cleanup.push(fn),
    around: (target: object, key: string, fn: Function) =>
      cleanup.push(hooks.add(target, key, 'around', fn)),
    after: (target: object, key: string, fn: Function) =>
      cleanup.push(hooks.add(target, key, 'after', fn)),
    before: (target: object, key: string, fn: Function) =>
      cleanup.push(hooks.add(target, key, 'before', fn)),
  } as unknown as API;
  bindGameClasses(api);
  let writes = 0;
  const preferences = new DeviceSettings({
    get: (_key, fallback) => fallback,
    set() {
      writes++;
    },
  });
  preferences.set('cameraZoom', 1);
  installNativeWorldZoom(api, game as unknown as GameScene, preferences);
  const wheel = () => {
    const event = Object.assign(new Event('wheel', { cancelable: true }), {
      deltaY: -120,
      clientX: 100,
      clientY: 100,
    });
    win.dispatchEvent(event);
    return event.defaultPrevented;
  };
  assert.equal(wheel(), true);
  assert.equal(player.zoom, 1.08);
  hit = {};
  assert.equal(wheel(), false);
  hit = stage;
  radarVisible = true;
  assert.equal(wheel(), false);
  radarVisible = false;
  doc.activeElement = new Element();
  assert.equal(wheel(), false);
  doc.activeElement = null;
  connected = false;
  assert.equal(wheel(), false);
  connected = true;
  recovered = true;
  assert.equal(wheel(), false);
  recovered = false;
  game.blockHotkeys = true;
  assert.equal(wheel(), false);
  game.blockHotkeys = false;
  assert.equal(player.zoom, 1.08, 'blocked gestures do not zoom');
  assert.equal(cameraCalls.at(-1), 1.08);
  game.gameStateMachine.currentState.exit();
  assert.equal(writes, 1, 'roaming exit flushes the pending wheel gesture');
  player.zoom = 0.75;
  game.gameStateMachine.currentState.enter();
  assert.equal(
    player.zoom,
    1.08,
    'returning to roaming restores saved zoom rather than a temporary camera effect',
  );
  assert.equal(cameraFrames.at(-1), 1, 'source roaming enter uses immediate one-frame focus');
  preferences.set('cameraZoom', 0.6);
  new RoamingState().enter();
  assert.equal(player.zoom, 0.6, 'every roaming entry applies the latest preference');
  class MapState extends PlayState {}
  const map = new MapState();
  map.keybinds.isInputDown = (key) => key === 27;
  map.checkZoom();
  assert.equal(writes, 1, 'held zoom input remains deferred');
  map.exit();
  assert.equal(writes, 2, 'leaving another PlayState flushes its unfinished keyboard gesture');
  map.exit();
  assert.equal(writes, 2, 'a repeated exit cannot flush the same gesture twice');
  const roaming = game.gameStateMachine.currentState;
  let zoomKeyHeld = true;
  roaming.keybinds.isInputDown = (key) => key === 27 && zoomKeyHeld;
  roaming.checkZoom();
  wheel();
  zoomKeyHeld = false;
  t.mock.timers.tick(250);
  assert.equal(writes, 3, 'idle timer reads released keys even without another command frame');
  wheel();
  zoomKeyHeld = true;
  t.mock.timers.tick(250);
  assert.equal(writes, 3, 'a newly pressed key keeps the wheel save deferred');
  roaming.attached = false;
  roaming.container.dispatchEventWith('removedFromStage');
  assert.equal(writes, 4, 'direct container removal commits the shared gesture');
  assert.equal(roaming.container.listeners('removedFromStage').length, 0);
  assert.equal(wheel(), false, 'detached roaming screen cannot consume world wheel input');
  t.mock.timers.tick(1000);
  assert.equal(writes, 4, 'removed screen has no pending wheel save');
});
