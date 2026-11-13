import { bindGameClasses, type GameScene } from '../src/game/Bindings';
import assert from 'node:assert/strict';
import test from 'node:test';
import type { API, Raw } from '../src/api/Types';
import { installNativeControlTiming } from '../src/movement/NativeControlTiming';

function fixture() {
  let turns = 0,
    boostCommands = 0,
    resets = 0,
    clears = 0;
  class Play {
    g: any;
    me: any;
    _loaded = true;
    keybinds = { isInputPressed: () => true };
    handleTurn() {
      turns++;
    }
    checkBoost() {
      throw new Error('Native boost wall-clock path should be replaced');
    }
    updateCommands() {}
  }
  const course = {
    time: 99,
    accelerate: true,
    deaccelerate: true,
    rotateLeft: true,
    rotateRight: true,
  };
  const ship = {
    course,
    get_course: () => course,
    get_usingBoost: () => false,
    channelingEnd: 200,
    usingBoost: false,
    clearConvergeTarget() {
      clears++;
    },
  };
  const me = {
    ship,
    commandable: true,
    get_commandable() {
      return this.commandable;
    },
    zoom: 1,
  };
  const game = {
    time: 100,
    me,
    automationManager: { controlsClaimed: false },
    commandManager: {
      addBoostCommand() {
        boostCommands++;
      },
      forceMovementReplayState() {
        resets++;
      },
    },
  };
  const api = {
    cls: () => ({ prototype: Play.prototype }),
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
  } as unknown as API;
  bindGameClasses(api);
  installNativeControlTiming(api, game as unknown as GameScene);
  const play = new Play();
  play.g = game;
  play.me = me;
  return { play, course, game, counts: () => ({ turns, boostCommands, resets, clears }) };
}

test('turn and boost cadence follows course time, including backward lifecycle changes', () => {
  const f = fixture();
  f.play.handleTurn();
  f.play.checkBoost();
  f.game.time += 1000;
  f.play.handleTurn();
  f.play.checkBoost();
  assert.deepEqual(f.counts(), { turns: 1, boostCommands: 1, resets: 0, clears: 0 });
  f.course.time += 32;
  f.play.handleTurn();
  f.play.checkBoost();
  assert.equal(f.counts().turns, 1);
  f.course.time++;
  f.play.handleTurn();
  f.play.checkBoost();
  assert.equal(f.counts().turns, 2);
  assert.equal(f.counts().boostCommands, 2);
  f.course.time = 0;
  f.play.handleTurn();
  f.play.checkBoost();
  assert.equal(f.counts().turns, 3);
  assert.equal(f.counts().boostCommands, 3);
});

test('channeling resets retained steering once per tick while retaining braking state', () => {
  const f = fixture();
  f.play.updateCommands();
  f.play.updateCommands();
  assert.equal(f.counts().resets, 1);
  assert.equal(f.counts().clears, 1);
  assert.equal(f.course.accelerate, false);
  assert.equal(f.course.rotateLeft, false);
  assert.equal(f.course.rotateRight, false);
  assert.equal(f.course.deaccelerate, true);
  f.course.time += 33;
  f.play.updateCommands();
  assert.equal(f.counts().resets, 2);
  f.game.automationManager.controlsClaimed = true;
  f.course.time += 33;
  f.play.updateCommands();
  assert.equal(f.counts().resets, 2);
});
