import { bindGameClasses } from '../src/game/Bindings';
import assert from 'node:assert/strict';
import { test } from 'node:test';
// @ts-expect-error actual host hooks
import { Hooks } from './fixtures/HostCore.js';
import { installNativeThrottle } from '../src/movement/NativeThrottle';
import { installAutomationControls } from '../src/automation/AutomationControls';
import { installNativeControlTiming } from '../src/movement/NativeControlTiming';

test('automation ownership gates physical input and routes source steering through native commands', () => {
  const calls: any[] = [];
  const hooks = new Hooks();
  const cleanup: Function[] = [];
  let owner = '';
  const course = { time: 100, rotateRight: false, rotateLeft: false };
  const ship = {
    get_course: () => course,
    engine: { get_rotationSpeed: () => 2 },
    get_rotation: () => 0,
    getGlobalPos: () => ({ x: 10, y: 20 }),
    get_usingBoost: () => false,
    channelingEnd: 0,
    isTeleporting: false,
  };
  class Play {
    _loaded = true;
    me = { get_commandable: () => true, ship };
    g = {
      time: 200,
      automationManager: {
        get controlsClaimed() {
          return !!owner;
        },
        ownsControls(id: string) {
          return !!id && owner === id;
        },
      },
    };
    updateCommands() {
      calls.push(['native input']);
      return 'native-result';
    }
    checkAccelerate(suppressed: boolean) {
      calls.push(['native acceleration', suppressed]);
    }
    handleTurn() {
      calls.push(['player turn']);
    }
    checkBoost() {}
    sendCommand(id: number, enabled: boolean) {
      calls.push([id, enabled]);
    }
    enter() {}
    exit() {}
  }
  class Roaming extends Play {}
  class Settings extends Play {}
  const classes: any = {
    'core.states.gameStates.PlayState': Play,
    'core.states.gameStates.RoamingState': Roaming,
    'core.scene.Game': { TICK_LENGTH: 33 },
    'core.scene.SceneBase': { settings: { get_mouseAim: () => true } },
    'starling.core.Starling': {
      get_current: () => ({
        get_nativeOverlay: () => ({ get_mouseX: () => 10, get_mouseY: () => 30 }),
      }),
    },
    'generics.Util': {
      clampRadians: (angle: number) => ((angle % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2),
      angleDifference: (rotation: number, angle: number) =>
        (() => {
          const difference = rotation - angle;
          return difference > Math.PI
            ? difference - Math.PI * 2
            : difference < -Math.PI
              ? difference + Math.PI * 2
              : difference;
        })(),
    },
  };
  const api = {
    cls: (name: string) => classes[name],
    defer: (fn: Function) => cleanup.push(fn),
    around: (object: any, name: string, fn: Function) =>
      cleanup.push(hooks.add(object, name, 'around', fn)),
    before: (object: any, name: string, fn: Function) =>
      cleanup.push(hooks.add(object, name, 'before', fn)),
  } as any;
  installAutomationControls(api);
  const play: any = new Roaming();
  assert.equal(play.updateCommands(), 'native-result');
  play.checkAccelerate(true);
  assert.deepEqual(calls.splice(0), [['native input'], ['native acceleration', true]]);
  assert.equal(play.currentAimControlMode, 'PlayerControlled');
  assert.equal(play.currentAimAngle, Math.PI / 2);
  assert.equal(play.setAutomationAimAngle('one', 1), false);
  owner = 'one';
  bindGameClasses({ ...api, cls: (name: string) => classes[name] ?? class {} });
  installNativeThrottle(api, play.g, () => {
    throw new Error('Physical throttle command sent while automation owns controls');
  });
  installNativeControlTiming(api, play.g);
  assert.equal(play.setAutomationAimAngle('other', 1), false);
  assert.equal(play.setAutomationAimAngle('one', Infinity), false);
  assert.equal(play.setAutomationAimAngle('one', NaN), false);
  assert.equal(play.setAutomationAimAngle('one', 1), true);
  assert.equal(play.currentAimControlMode, 'AutomationControlled');
  assert.equal(play.currentAimAngle, 1);
  play.updateCommands();
  assert.deepEqual(calls.splice(0), [[2, true]]);
  play.updateCommands();
  assert.deepEqual(calls, [], 'same serialized course tick cannot send twice');
  course.time += 33;
  course.rotateLeft = true;
  play.checkAccelerate(true);
  assert.deepEqual(
    calls.splice(0),
    [[1, false]],
    'chat path retains owned steering and releases opposite turn first',
  );
  course.rotateLeft = false;
  course.rotateRight = true;
  course.time += 33;
  play.setAutomationAimAngle('one', 0);
  play.updateCommands();
  assert.deepEqual(calls.splice(0), [[2, false]], 'settled target releases turn');
  assert.equal(play.clearAutomationAimAngle('other'), false);
  assert.equal(play.clearAutomationAimAngle('one'), true);
  assert.deepEqual(calls.splice(0), [[2, false]]);
  assert.ok(Number.isNaN(play.currentAimAngle));
  course.rotateRight = false;
  play.setAutomationAimAngle('one', 1);
  ship.isTeleporting = true;
  course.rotateLeft = true;
  play.updateCommands();
  assert.deepEqual(calls.splice(0), [[1, false]], 'teleporting cannot start automation steering');
  ship.isTeleporting = false;
  course.rotateLeft = false;
  const settings = new Settings();
  settings.checkAccelerate(true);
  assert.deepEqual(calls, [], 'settings does not run the roaming chat steering path');
  owner = 'two';
  assert.ok(
    Number.isNaN(play.currentAimAngle),
    'ownership transfer cannot inherit another module aim',
  );
  play.setAutomationAimAngle('two', -1);
  course.time = 10;
  play.updateCommands();
  assert.deepEqual(
    calls.splice(0),
    [[1, true]],
    'negative angle normalization and course rollback',
  );
  owner = '';
  assert.equal(play.updateCommands(), 'native-result');
  assert.deepEqual(calls.splice(0), [['native input']]);
  owner = 'two';
  assert.ok(Number.isNaN(play.currentAimAngle), 'release resets previous automation aim');
  play.setAutomationAimAngle('two', 2);
  play.exit();
  assert.ok(Number.isNaN(play.currentAimAngle));
  owner = '';
  course.time = 43;
  play.handleTurn();
  assert.deepEqual(calls.splice(0), [['player turn']]);
  owner = 'two';
  play.setAutomationAimAngle('two', 1);
  play.updateCommands();
  assert.deepEqual(calls, [], 'claiming controls preserves the player turn clock');
  course.time = 76;
  play.updateCommands();
  assert.deepEqual(calls.splice(0), [[2, true]]);
  play.clearAutomationAimAngle('two');
  play.setAutomationAimAngle('two', -1);
  play.updateCommands();
  assert.deepEqual(calls, [], 'clearing and setting a target cannot restart the turn clock');
  owner = '';
  play.handleTurn();
  assert.deepEqual(calls, [], 'releasing controls preserves the automation turn clock');
  course.time = 108;
  play.handleTurn();
  assert.deepEqual(calls, [], '32ms is still inside the source throttle interval');
  course.time = 109;
  play.handleTurn();
  assert.deepEqual(calls.splice(0), [['player turn']]);
  cleanup.reverse().forEach((fn) => fn());
  assert.equal('setAutomationAimAngle' in play, false);
  assert.equal('currentAimAngle' in play, false);
  assert.equal('AIM_CONTROL_PLAYER_CONTROLLED' in Play, false);
  assert.equal(play.updateCommands(), 'native-result');
});
