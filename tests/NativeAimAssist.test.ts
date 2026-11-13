import { bindGameClasses, type GameScene } from '../src/game/Bindings';
import assert from 'node:assert/strict';
import { test } from 'node:test';
// @ts-expect-error actual host hooks
import { Hooks } from './fixtures/HostCore.js';
import { installNativeControlTiming } from '../src/movement/NativeControlTiming';
import { installNativeAimAssist } from '../src/aim/NativeAimAssist';
import { installAutomationControls } from '../src/automation/AutomationControls';
import { createClientSettings } from '../src/ported/ClientSettings';

test('native assist integrates settings and confirmed targets while preserving throttle, ownership and cleanup', () => {
  const Settings = createClientSettings(() => ({}));
  let enabled = false;
  let usingMouse = true;
  let now = 1000;
  let pointerAngle = 0.1;
  let pointerRadius = 100;
  let direction = 0;
  let automated = false;
  let contactTarget = true;
  const commands: [number, boolean][] = [];
  const errors: unknown[] = [];
  const cleanups: (() => void)[] = [];
  const hooks = new Hooks((error: unknown) => errors.push(error));
  const course = { rotateLeft: false, rotateRight: false, time: 100 };
  const weapon = {
    fire: true,
    projectileFunction: 'bullet',
    range: 1000,
    reloadTime: 500,
    speed: 200,
    ttl: 1000,
  };
  const ship = {
    pos: { x: 0, y: 0 },
    engine: { get_rotationSpeed: () => 1 },
    get_rotation: () => 0,
    get_weapon: () => weapon,
    get_course: () => course,
    getGlobalPos: () => ({ x: 0, y: 0 }),
    channelingEnd: 0,
  };
  const game = {
    time: 1000,
    automationManager: {
      get controlsClaimed() {
        return automated;
      },
      ownsControls: () => automated,
    },
  };
  const target = {
    alive: true,
    isHostile: true,
    pos: { x: 300 * Math.cos(0.2), y: 300 * Math.sin(0.2) },
    speed: { x: 0, y: 0 },
  };
  const targets: any = { current: target, locked: false };
  class Play {
    static mouseBlocked = false;
    static mouseIntegrator = 0;
    static MOUSE_AIM_SEND_INTERVAL = 66;
    g = game;
    me = { ship, get_commandable: () => true };
    _loaded = true;
    mouseAimLastSendTime = 0;
    nativeAim = 0;
    nativeTurn = 0;
    keybinds = {
      isInputDown: (key: number) => key === (direction < 0 ? 13 : direction > 0 ? 14 : -1),
    };
    updateCommands() {
      this.handleTurn();
      return 'native commands';
    }
    updateMouseAim() {
      this.nativeAim++;
    }
    handleTurn() {
      this.nativeTurn++;
      if (usingMouse) this.updateMouseAim();
    }
    sendCommand(id: number, value: boolean) {
      commands.push([id, value]);
    }
    enter() {}
    exit() {}
    checkAccelerate() {}
    checkBoost() {}
  }
  const classes: any = {
    'core.states.gameStates.PlayState': Play,
    'core.scene.Game': { TICK_LENGTH: 33 },
    'core.scene.SceneBase': { settings: { get_mouseAim: () => usingMouse } },
    'starling.core.Starling': {
      get_current: () => ({
        get_nativeOverlay: () => ({
          get_mouseX: () => Math.cos(pointerAngle) * pointerRadius,
          get_mouseY: () => Math.sin(pointerAngle) * pointerRadius,
        }),
      }),
    },
  };
  const api: any = {
    cls: (name: string) => classes[name],
    defer: (fn: () => void) => cleanups.push(fn),
  };
  for (const kind of ['before', 'after', 'around'])
    api[kind] = (object: any, name: string, fn: Function) =>
      cleanups.push(hooks.add(object, name, kind, fn));
  const settings = {
    getAimAssistBoolean: (key: string) =>
      key === 'aim_assist_enabled' ? enabled : Settings.getAimAssistBooleanDefault(key),
    getAimAssistNumber: (key: string) => Settings.getAimAssistNumberDefault(key),
  };
  installAutomationControls(api);
  installNativeAimAssist(api, game, settings, targets, {
    now: () => now,
    lastContact: () => (contactTarget ? { unit: target, time: now } : undefined),
  });
  bindGameClasses({ ...api, cls: (name: string) => classes[name] ?? class {} });
  installNativeControlTiming(api, game as unknown as GameScene);
  const state = new Play();
  const frame = (delta = 66) => {
    now += delta;
    game.time += delta;
    course.time += delta;
    return state.updateCommands();
  };
  try {
    assert.equal(frame(), 'native commands');
    assert.equal(state.nativeAim, 0, 'disabled assist retains source manual steering');
    assert.deepEqual(commands, [[2, true]]);
    commands.length = 0;
    enabled = true;
    pointerAngle = 0.11;
    frame();
    assert.deepEqual(commands, [[2, true]]);
    assert.equal(state.nativeAim, 0);
    assert.ok(
      (state as any).currentAimAngle > pointerAngle,
      'property and Haxe getter both expose correction',
    );
    assert.equal((state as any).currentAimAngle, (state as any).get_currentAimAngle());
    (state as any).releaseAimAssist();
    assert.ok(Math.abs((state as any).currentAimAngle - pointerAngle) < 1e-12);
    frame(32);
    assert.equal(commands.length, 1, 'source 33ms course interval remains enforced');
    frame(1);
    assert.equal(commands.length, 2);
    commands.length = 0;
    course.rotateLeft = course.rotateRight = true;
    pointerRadius = 0;
    contactTarget = false;
    // Deadzone preserves the last intentional pointer angle instead of atan2(0, 0).
    frame();
    assert.ok(Math.abs((state as any).currentAimAngle - pointerAngle) < 1e-12);
    assert.equal(commands.length, 1, 'only one command is sent even if both turn flags are set');
    course.rotateLeft = course.rotateRight = false;
    automated = true;
    commands.length = 0;
    frame();
    assert.equal(commands.length, 0, 'automation without a supplied angle owns the controls');
    assert.ok(Number.isNaN((state as any).currentAimAngle));
    frame(10000);
    automated = false;
    pointerRadius = 100;
    pointerAngle = 0.19;
    contactTarget = true;
    frame(16);
    assert.ok(
      Math.abs((state as any).currentAimAngle - pointerAngle) < 1e-12,
      'returning from automation measures fast pointer movement against the latest frame',
    );
    state.exit();
    usingMouse = false;
    direction = 1;
    contactTarget = true;
    targets.locked = true;
    frame();
    const nativeTurns = state.nativeTurn;
    frame();
    assert.equal(
      state.nativeTurn,
      nativeTurns,
      'keyboard assist routes through aim only after acquisition',
    );
    assert.equal(Play.mouseBlocked, true);
    assert.deepEqual(errors, []);
  } finally {
    cleanups.reverse().forEach((cleanup) => cleanup());
  }
  const before = state.nativeAim;
  state.updateMouseAim();
  assert.equal(state.nativeAim, before + 1, 'session disposal restores native steering');
  assert.equal(Object.hasOwn(Play.prototype, 'currentAimAngle'), false);
  assert.equal(Object.hasOwn(Play.prototype, 'releaseAimAssist'), false);
});
