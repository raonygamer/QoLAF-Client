import { bindGameClasses } from '../src/game/Bindings';
import type { API } from '../src/api/Types';
import assert from 'node:assert/strict';
import test from 'node:test';
import { cancelNativePlayerCommands } from '../src/movement/NativeCommandCancellation';
import { createNativeRadioChatBridge } from '../src/radio/NativeRadioChatBridge';
import type { Raw } from '../src/api/Types';

function bindFixture(play: Function, game: object): void {
  class Scene {}
  Object.setPrototypeOf(game, Scene.prototype);
  bindGameClasses({
    cls: (name: string) => (name === 'core.scene.Game' ? Scene : play),
  } as unknown as API);
}

test('modal cancellation releases each held axis and firing without activating shield or boost', () => {
  const sent: unknown[][] = [],
    zoomed: unknown[][] = [];
  let released = 0;
  const course = { accelerate: true, deaccelerate: true, rotateLeft: true, rotateRight: true };
  const weapons = [true, true].map((fire) => ({
    fire,
    set_fire(value: boolean) {
      this.fire = value;
    },
  }));
  class Play {
    static autoCruise = true;
    fireWithHotkeys = true;
    me = { ship: { get_course: () => course, get_isShooting: () => true, weapons } };
    releaseAimAssist() {
      released++;
    }
    sendCommand(...args: unknown[]) {
      sent.push(args);
    }
  }
  const play = new Play();
  const game = {
    gameStateMachine: { currentState: play },
    get_me: () => ({ zoom: 0.75 }),
    camera: { zoomFocus: (...args: unknown[]) => zoomed.push(args) },
  };
  bindFixture(Play, game);
  cancelNativePlayerCommands(game);
  assert.deepEqual(sent, [
    [0, false],
    [8, false],
    [1, false],
    [2, false],
    [3, false],
  ]);
  assert.deepEqual(
    weapons.map((weapon) => weapon.fire),
    [false, false],
  );
  assert.equal(Play.autoCruise, false);
  assert.equal(play.fireWithHotkeys, false);
  assert.equal(released, 1);
  assert.deepEqual(zoomed, [[0.75, 100]]);
});

test('cancellation ignores non-play screens and does not send already inactive commands', () => {
  const sent: number[] = [];
  class Play {
    static autoCruise = true;
    me: Raw = { ship: { get_course: () => ({ accelerate: false }), get_isShooting: () => false } };
    sendCommand(id: number) {
      sent.push(id);
    }
  }
  const game: Raw = {
    gameStateMachine: { currentState: {} },
    me: { zoom: 1 },
    get_me() {
      return this.me;
    },
    camera: { zoomFocus() {} },
  };
  bindFixture(Play, game);
  cancelNativePlayerCommands(game);
  assert.equal(Play.autoCruise, true);
  game.gameStateMachine.currentState = new Play();
  cancelNativePlayerCommands(game);
  assert.deepEqual(sent, []);
  game.gameStateMachine.currentState.me = null;
  assert.doesNotThrow(() => cancelNativePlayerCommands(game));
});

test('native radio focus follows DOM ownership before stale OpenFL focus and handles missing editors', () => {
  const document: Raw = { activeElement: null };
  const element: Raw = { tagName: 'TEXTAREA', ownerDocument: document };
  const other: Raw = { tagName: 'INPUT' };
  const native: Raw = { get_type: () => 'input' };
  const stage: Raw = { get_focus: () => native };
  const bridge = createNativeRadioChatBridge(
    { cls: () => ({ get_current: () => ({ get_nativeStage: () => stage }) }) },
    document as Document,
  );
  const game = {
    chatInput: {
      visible: true,
      isActive: () => true,
      input: { element, hasFocus: true },
      ownsComposerNativeFocus: (value: unknown) => value === native,
    },
  };
  document.activeElement = other;
  assert.equal(bridge.chatHasFocus(game), false);
  assert.equal(bridge.otherInputHasFocus(game), true);
  document.activeElement = element;
  assert.equal(bridge.chatHasFocus(game), true);
  document.activeElement = null;
  assert.equal(bridge.chatHasFocus(game), true);
  stage.get_focus = () => null;
  assert.equal(bridge.chatHasFocus({ chatInput: { visible: true, isActive: () => true } }), false);
});

test('modal cancellation clears charged weapons before the native fire command, without releasing a shot', async () => {
  // @ts-expect-error captured native game setter
  const { createNativeWeaponFire } = await import('./fixtures/NativeWeaponFire.js');
  for (const axes of Array.from({ length: 16 }, (_, index) => index)) {
    for (const charge of [0, 50]) {
      const sent: Array<[number, boolean]> = [];
      const course = {
        accelerate: !!(axes & 1),
        deaccelerate: !!(axes & 2),
        rotateLeft: !!(axes & 4),
        rotateRight: !!(axes & 8),
      };
      let released = 0,
        effects = 0,
        load = 50;
      class Ship {
        player = { isMe: true };
        weapons: Weapon[] = [];
        killChargeUpEffect() {
          effects++;
        }
        get_course() {
          return course;
        }
        get_isShooting() {
          return true;
        }
      }
      const nativeFire = createNativeWeaponFire(Ship, { __cast: (value: object) => value }, {});
      const ship = new Ship();
      class Weapon {
        unit = ship;
        _fire = true;
        hasChargeUp = true;
        chargeUpTime = charge;
        lastFire = 1;
        reloadTime = 10;
        burstCurrent = 2;
        g = {
          time: 100,
          hud: {
            powerBar: {
              updateLoadBar: (value: number) => {
                load = value;
              },
            },
          },
        };
        onChargeReleased() {
          released++;
        }
        set_fire(value: boolean) {
          return nativeFire.call(this, value);
        }
      }
      const weapon = new Weapon();
      ship.weapons.push(weapon);
      class Play {
        static autoCruise = true;
        fireWithHotkeys = true;
        me = { ship };
        sendCommand(command: number, active: boolean) {
          sent.push([command, active]);
          // Native command processing may also invoke the setter.
          if (command === 3) weapon.set_fire(active);
        }
      }
      class Scene {
        gameStateMachine = { currentState: new Play() };
        get_me() {
          return { zoom: 1 };
        }
        camera = { zoomFocus() {} };
      }
      const classes: Record<string, object> = {
        'core.scene.Game': Scene,
        'core.states.gameStates.PlayState': Play,
        'core.ship.PlayerShip': Ship,
      };
      bindGameClasses({ cls: (name: string) => classes[name] ?? class {} } as unknown as API);
      cancelNativePlayerCommands(new Scene());
      assert.equal(released, 0);
      assert.equal(weapon._fire, false);
      assert.equal(weapon.chargeUpTime, 0);
      assert.equal(effects, charge > 0 ? 1 : 0);
      assert.equal(load, charge > 0 ? 0 : 50);
      const expected: Array<[number, boolean]> = [];
      [0, 8, 1, 2].forEach((command, bit) => {
        if (axes & (1 << bit)) expected.push([command, false]);
      });
      expected.push([3, false]);
      assert.deepEqual(sent, expected);
    }
  }
});
