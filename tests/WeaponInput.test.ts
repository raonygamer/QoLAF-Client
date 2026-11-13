import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { API } from '../src/api/Types';
import { bindGameClasses } from '../src/game/Bindings';
import { installWeaponInput } from '../src/weapon/WeaponInput';
// @ts-expect-error actual host dispatcher
import { Hooks } from './fixtures/HostCore.js';

test('safe-zone entry stops every held weapon once, resumes outside, and blocks overlapping switches', () => {
  const keys = new Set<number>(),
    commands: Array<[number, boolean]> = [],
    changes: number[] = [];
  let safe = true,
    fireWithHotkeys = true;
  class Weapon {
    fire = true;
    hasChargeUp = false;
    set_fire(value: boolean) {
      this.fire = value;
    }
  }
  const ship = {
    weapons: [new Weapon(), new Weapon()],
    weaponIsChanging: false,
    get_isShooting() {
      return this.weapons.some((weapon) => weapon.fire);
    },
  };
  class Play {
    fireWithHotkeys = false;
    me = { ship, get_inSafeZone: () => safe, sendChangeWeapon: (key: number) => changes.push(key) };
    g = { hud: { weaponHotkeys: { selectedHotkey: null as { key: number } | null } } };
    keybinds = {
      isInputDown: (key: number) => keys.has(key),
      isInputUp: (key: number) => !keys.has(key),
    };
    sendCommand(type: number, active: boolean) {
      commands.push([type, active]);
      for (const weapon of ship.weapons) weapon.fire = active;
    }
    handleWeaponFire() {
      throw Error('native handler should be replaced');
    }
  }
  const hooks = new Hooks((error: unknown) => {
      throw error;
    }),
    cleanup: Array<() => void> = [];
  const api = {
    cls: (name: string) =>
      name === 'core.states.gameStates.PlayState'
        ? Play
        : name === 'core.scene.SceneBase'
          ? { settings: { get_fireWithHotkeys: () => fireWithHotkeys } }
          : {},
    around(target: object, name: string, callback: unknown) {
      const off = hooks.add(target, name, 'around', callback);
      cleanup.push(off);
      return off;
    },
  } as unknown as API;
  bindGameClasses(api);
  installWeaponInput(api);
  try {
    const play = new Play();
    keys.add(19);
    keys.add(20);
    play.handleWeaponFire();
    play.handleWeaponFire();
    assert.deepEqual(commands, [[3, false]]);
    assert.ok(ship.weapons.every((weapon) => !weapon.fire));
    assert.equal(play.fireWithHotkeys, false);
    safe = false;
    play.handleWeaponFire();
    assert.deepEqual(commands.at(-1), [3, true]);
    safe = true;
    play.handleWeaponFire();
    assert.deepEqual(commands, [
      [3, false],
      [3, true],
      [3, false],
    ]);
    changes.length = 0;
    ship.weaponIsChanging = true;
    play.handleWeaponFire();
    assert.deepEqual(changes, [], 'null selected hotkey must not bypass weaponIsChanging');
    ship.weaponIsChanging = false;
    play.g.hud.weaponHotkeys.selectedHotkey = { key: 1 };
    play.handleWeaponFire();
    assert.deepEqual(changes, []);
    keys.add(21);
    play.handleWeaponFire();
    assert.deepEqual(changes, [], 'lowest held hotkey wins');
    keys.delete(20);
    play.handleWeaponFire();
    assert.deepEqual(changes, [2]);
    safe = false;
    keys.delete(19);
    fireWithHotkeys = false;
    play.handleWeaponFire();
    assert.equal(play.fireWithHotkeys, false);
    keys.add(19);
    play.handleWeaponFire();
    keys.clear();
    play.handleWeaponFire();
    assert.deepEqual(commands.at(-1), [3, false]);
  } finally {
    cleanup.reverse().forEach((off) => off());
  }
  assert.throws(() => new Play().handleWeaponFire(), /native handler/);
});
