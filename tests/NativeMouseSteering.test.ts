import assert from 'node:assert/strict';
import test from 'node:test';
import type { API, Raw } from '../src/api/Types';
import { installNativeAimAssist } from '../src/aim/NativeAimAssist';
import { createClientSettings } from '../src/ported/ClientSettings';

test('disabled aim assist still uses source manual steering and preserves deadzone heading', () => {
  const sent: [number, boolean][] = [];
  class Play {
    static mouseBlocked = false;
    g: any;
    me: any;
    keybinds = { isInputDown: () => false };
    updateCommands() {
      this.handleTurn();
    }
    handleTurn() {
      this.updateMouseAim();
    }
    get_currentAimAngle() {
      return 999;
    }
    updateMouseAim() {
      throw new Error('Fell back to upstream 66ms steering');
    }
    sendCommand(type: number, active: boolean) {
      sent.push([type, active]);
    }
  }
  const course = { rotateLeft: false, rotateRight: false };
  const ship = {
    course,
    engine: { rotationSpeed: 1 },
    rotation: 0,
    pos: { x: 0, y: 0 },
    getGlobalPos: () => ({ x: 0, y: 0 }),
  };
  const game = { me: { ship } };
  const overlay = { mouseX: 100, mouseY: 100 };
  const classes: Raw = {
    'core.states.gameStates.PlayState': Play,
    'core.scene.SceneBase': { settings: { mouseAim: true } },
    'starling.core.Starling': { current: { nativeOverlay: overlay } },
    'core.scene.Game': { TICK_LENGTH: 33 },
  };
  const api = {
    cls: (name: string) => classes[name],
    defer: () => () => {},
    around(target: Raw, key: string, hook: Function) {
      const original = target[key];
      target[key] = function (this: Raw, ...args: unknown[]) {
        return hook.call(this, original.bind(this), ...args);
      };
    },
    before(this: Raw, target: Raw, key: string, hook: Function) {
      this.around(target, key, function (this: Raw, next: Function, ...args: unknown[]) {
        hook.apply(this, args);
        return next(...args);
      });
    },
    after(this: Raw, target: Raw, key: string, hook: Function) {
      this.around(target, key, function (this: Raw, next: Function, ...args: unknown[]) {
        const value = next(...args);
        hook.call(this, value, ...args);
        return value;
      });
    },
  } as unknown as API;
  const Settings = createClientSettings(() => ({}));
  installNativeAimAssist(
    api,
    game,
    {
      getAimAssistBoolean: () => false,
      getAimAssistNumber: (key) => Settings.getAimAssistNumberDefault(key),
    },
    { current: null, locked: false } as any,
    { now: () => 1000, lastContact: () => null } as any,
  );
  const play = new Play();
  play.g = game;
  play.me = game.me;
  play.updateCommands();
  assert.deepEqual(sent, [[2, true]]);
  assert.equal(play.get_currentAimAngle(), Math.PI / 4);
  sent.length = 0;
  overlay.mouseX = 0;
  overlay.mouseY = 0;
  play.updateCommands();
  assert.deepEqual(sent, [[2, true]]);
  assert.equal(play.get_currentAimAngle(), Math.PI / 4);
  sent.length = 0;
  ship.rotation = Math.PI / 4;
  course.rotateLeft = course.rotateRight = true;
  play.updateCommands();
  assert.deepEqual(sent, [
    [1, false],
    [2, false],
  ]);
});
