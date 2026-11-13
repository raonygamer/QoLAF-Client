import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { API } from '../src/api/Types';
import { bindGameClasses } from '../src/game/Bindings';
import { installWeaponAcknowledgement } from '../src/weapon/WeaponAcknowledgement';
// @ts-expect-error actual host dispatcher
import { Hooks } from './fixtures/HostCore.js';

test('weapon acknowledgements stop live fire and validate self hotbar without restricting remote loadouts', () => {
  class Weapon {
    active = true;
    hotkey = 1;
    fire = true;
    stops = 0;
    get_fire() {
      return this.fire;
    }
    set_fire(value: boolean) {
      this.fire = value;
      this.stops++;
      return value;
    }
  }
  class NativePlayer {
    isMe = true;
    unlockedWeaponSlots = 2;
    selectedWeaponIndex = 0;
    calls = 0;
    ship: { weapons: Weapon[]; weaponIsChanging: boolean } | null = {
      weapons: [new Weapon(), new Weapon()],
      weaponIsChanging: true,
    };
    sendChangeWeapon(_hotkey: number) {}
    weaponChangeFailed(_message: object) {}
    fire(_message: object) {}
    onPlayerUpdate(_message: object) {}
    changeWeapon(message: { getInt(index: number): number }, offset: number) {
      this.calls++;
      this.selectedWeaponIndex = message.getInt(offset + 1);
      if (this.ship) this.ship.weaponIsChanging = false;
    }
  }
  const hooks = new Hooks();
  const cleanups: (() => void)[] = [];
  const api = {
    cls: () => NativePlayer,
    defer: (off: () => void) => {
      cleanups.push(off);
      return off;
    },
    around: (target: object, key: string, fn: (...args: never[]) => unknown) => {
      const off = hooks.add(target, key, 'around', fn);
      cleanups.push(off);
      return off;
    },
  } as unknown as API;
  bindGameClasses(api);
  installWeaponAcknowledgement(api);
  try {
    const player = new NativePlayer();
    const weapons = player.ship!.weapons;
    const message = {
      getInt: (offset: number) => {
        assert.equal(offset, 4);
        return 1;
      },
    };
    player.changeWeapon(message, 3);
    assert.equal(player.calls, 1);
    assert.equal(player.selectedWeaponIndex, 1);
    assert.ok(weapons.every((weapon) => !weapon.fire && weapon.stops === 1));
    player.changeWeapon(message, 3);
    assert.ok(
      weapons.every((weapon) => weapon.stops === 1),
      'do not retrigger stop setters',
    );
    for (const index of [-1, 99]) {
      player.ship!.weaponIsChanging = true;
      const calls: number = player.calls;
      player.changeWeapon({ getInt: () => index }, 0);
      assert.equal(player.calls, calls);
      assert.equal(player.ship!.weaponIsChanging, false);
    }
    for (const [active, hotkey] of [
      [false, 1],
      [true, 0],
      [true, 3],
    ] as const) {
      weapons[1].active = active;
      weapons[1].hotkey = hotkey;
      const calls: number = player.calls;
      player.changeWeapon(message, 3);
      assert.equal(player.calls, calls);
    }
    player.isMe = false;
    const calls: number = player.calls;
    player.changeWeapon(message, 3);
    assert.equal(player.calls, calls + 1);
    player.ship = null;
    player.changeWeapon(message, 3);
    assert.equal(player.calls, calls + 2, 'shipless native loadout persistence still runs');
  } finally {
    cleanups.reverse().forEach((off) => off());
  }
  const restored = new NativePlayer();
  restored.changeWeapon({ getInt: () => 0 }, 0);
  assert.equal(restored.ship!.weapons[0].fire, true);
});
