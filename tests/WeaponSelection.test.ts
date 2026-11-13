import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { API } from '../src/api/Types';
import { bindGameClasses, type Player } from '../src/game/Bindings';
import { WeaponSelection } from '../src/weapon/WeaponSelection';
import { installWeaponSnapshots } from '../src/weapon/WeaponSnapshots';
// @ts-expect-error actual host dispatcher
import { Hooks } from './fixtures/HostCore.js';

class Weapon {
  active = true;
  hotkey = 1;
  key = 'one';
  fire = false;
  writes = 0;
  target: object | null = null;
  reloadTime = 0;
  get_fire() {
    return this.fire;
  }
  set_fire(value: boolean) {
    this.writes++;
    return (this.fire = value);
  }
}
class Beam extends Weapon {
  secondaryTargets: object[] = [];
}
class Teleport extends Weapon {}
class Pilot {
  isMe = true;
  selectedWeaponIndex = 0;
  unlockedWeaponSlots = 2;
  ship = this.makeShip();
  makeShip() {
    const second = new Weapon();
    second.hotkey = 2;
    second.key = 'two';
    return {
      weapons: [new Weapon(), second],
      weaponIsChanging: false,
      lifecycle: 1,
      hp: 100,
      shieldHp: 100,
      isInjured: false,
      energy: 0,
      weaponHeat: {
        setHeat: (value: number) => {
          this.ship.energy = value;
        },
      },
      get_lifecycleId() {
        return this.lifecycle;
      },
      get_hpMax: () => 100,
      get_shieldHpMax: () => 100,
      get_weapon: () => this.ship.weapons[this.selectedWeaponIndex],
    };
  }
  typed() {
    return this as unknown as Player;
  }
}

test('pending switch tracks acknowledgement, failure rollback, reentrancy and reused ships', () => {
  const pilot = new Pilot();
  const state = new WeaponSelection(pilot.typed());
  const send = () => {
    pilot.ship.weaponIsChanging = true;
    pilot.selectedWeaponIndex = 1;
  };
  const generation = state.request(2, send);
  assert.equal(generation, 1);
  assert.equal(
    state.request(1, () => assert.fail('duplicate send')),
    0,
  );
  assert.equal(state.acceptReceived(0), false);
  assert.equal(state.acceptReceived(1), true);
  assert.equal(state.pendingGeneration, generation, 'snapshot is not an acknowledgement');
  pilot.ship.weaponIsChanging = false;
  state.acknowledge(1);
  assert.equal(state.resolvedSuccessfully, true);
  assert.equal(state.resolvedKey, 'two');
  pilot.selectedWeaponIndex = 0;
  state.request(2, send);
  state.failed();
  assert.equal(pilot.selectedWeaponIndex, 0);
  assert.equal(pilot.ship.weaponIsChanging, false);
  assert.throws(
    () =>
      state.request(2, () => {
        send();
        throw Error('send failed');
      }),
    /send failed/,
  );
  assert.equal(pilot.selectedWeaponIndex, 0);
  assert.equal(state.pendingGeneration, 0);
  state.request(2, send);
  pilot.ship.lifecycle++;
  pilot.selectedWeaponIndex = 1;
  state.failed();
  assert.equal(pilot.selectedWeaponIndex, 1, 'failure must not roll back a reused ship');
  pilot.ship = pilot.makeShip();
  state.request(2, () => {
    send();
    pilot.ship.weaponIsChanging = false;
    state.acknowledge(1);
  });
  assert.equal(state.pendingGeneration, 0, 'synchronous reply resolves safely');
  assert.equal(state.resolvedSuccessfully, true);
});

test('stale weapon packets preserve health and heat; valid packets honor bundled boundaries', () => {
  const pilot = new Pilot();
  const state = new WeaponSelection(pilot.typed());
  const targets = new Map([
    [12, { id: 12 }],
    [13, { id: 13 }],
  ]);
  class Manager {
    g = { unitManager: { getTarget: (id: number) => targets.get(id) ?? null } };
    get_playersById() {
      return { h: { pilot } };
    }
    fire(_message: object, _offset = 0, _length = 0) {}
    onPlayerUpdate(_message: object) {}
  }
  const packet = (values: (string | number | boolean)[]) => ({
    length: values.length,
    getString: (i: number) => String(values[i]),
    getInt: (i: number) => Number(values[i]),
    getNumber: (i: number) => Number(values[i]),
    getBoolean: (i: number) => Boolean(values[i]),
    kindAt: (i: number) => (typeof values[i] === 'number' ? 0 : 1),
  });
  const hooks = new Hooks();
  const cleanups: (() => void)[] = [];
  const api = {
    cls: (name: string) =>
      name.endsWith('.Beam') ? Beam : name.endsWith('.Teleport') ? Teleport : Manager,
    defer: (off: () => void) => {
      cleanups.push(off);
      return off;
    },
    around: (owner: object, key: string, fn: (...args: never[]) => unknown) => {
      const off = hooks.add(owner, key, 'around', fn);
      cleanups.push(off);
      return off;
    },
  } as unknown as API;
  bindGameClasses(api);
  installWeaponSnapshots(api, () => state);
  const manager = new Manager();
  try {
    state.request(2, () => {
      pilot.ship.weaponIsChanging = true;
      pilot.selectedWeaponIndex = 1;
    });
    pilot.ship.weapons[1].fire = true;
    pilot.ship.weapons[0].fire = true;
    manager.onPlayerUpdate(packet(['pilot', 70, 80, 0, 0.7, false, -1]));
    assert.equal(pilot.ship.hp, 70);
    assert.equal(pilot.ship.shieldHp, 80);
    assert.equal(pilot.ship.energy, 0.7);
    assert.equal(pilot.ship.isInjured, true);
    assert.equal(pilot.selectedWeaponIndex, 1);
    assert.equal(pilot.ship.weapons[1].fire, true);
    assert.equal(pilot.ship.weapons[0].fire, false);
    manager.fire(packet(['pilot', 0, true, 12, 0.4]));
    assert.equal(pilot.ship.energy, 0.4);
    assert.equal(pilot.ship.weapons[0].fire, false);
    pilot.ship.weaponIsChanging = false;
    state.acknowledge(1);
    manager.onPlayerUpdate(packet(['pilot', 75, 85, 1, 0.8, true, 12]));
    assert.equal(pilot.ship.weapons[1].writes, 0, 'same firing state does not retrigger');
    assert.equal(pilot.ship.weapons[1].target, targets.get(12));
    const beam = new Beam();
    beam.hotkey = 2;
    pilot.ship.weapons[1] = beam;
    manager.fire(packet(['header', 'header', 'pilot', 1, true, 12, 0.9, 13, 12]), 2, 8);
    assert.deepEqual(beam.secondaryTargets, [targets.get(13)], 'next bundled packet is excluded');
    manager.fire(packet(['pilot', 1, true, -1, 0.9, 13, 'end', 12]));
    assert.deepEqual(
      beam.secondaryTargets,
      [targets.get(13)],
      'new Haxe non-integer terminator retained',
    );
  } finally {
    cleanups.reverse().forEach((off) => off());
  }
});

test('installed hooks share pending state across send, rejection and acknowledgement', async () => {
  const { installWeaponAcknowledgement } = await import('../src/weapon/WeaponAcknowledgement');
  class NativePilot extends Pilot {
    sends = 0;
    sendChangeWeapon(hotkey: number) {
      this.sends++;
      this.ship.weaponIsChanging = true;
      this.selectedWeaponIndex = this.ship.weapons.findIndex((weapon) => weapon.hotkey === hotkey);
    }
    changeWeapon(message: { getInt(index: number): number }, offset: number) {
      this.selectedWeaponIndex = message.getInt(offset + 1);
      this.ship.weaponIsChanging = false;
    }
  }
  const pilot = new NativePilot();
  class Manager {
    get_playersById() {
      return { h: { pilot } };
    }
    weaponChangeFailed(_message: object) {
      assert.fail('old handler bypassed');
    }
    fire(_message: object) {}
    onPlayerUpdate(_message: object) {}
  }
  const hooks = new Hooks();
  const cleanups: (() => void)[] = [];
  const api = {
    cls: (name: string) => (name === 'core.player.Player' ? NativePilot : Manager),
    defer: (off: () => void) => {
      cleanups.push(off);
      return off;
    },
    around: (owner: object, key: string, fn: (...args: never[]) => unknown) => {
      const off = hooks.add(owner, key, 'around', fn);
      cleanups.push(off);
      return off;
    },
  } as unknown as API;
  bindGameClasses(api);
  installWeaponAcknowledgement(api);
  const client = pilot.typed();
  try {
    assert.equal(client.canSelectWeaponIndex(1), true);
    const generation = client.requestWeaponChange(2);
    assert.equal(generation, 1);
    assert.equal(client.weaponChangePendingGeneration, generation);
    assert.equal(client.get_weaponChangePendingGeneration(), generation);
    assert.equal(client.weaponChangeRequestedKey, 'two');
    assert.equal(client.acceptReceivedWeaponSelection(0), false);
    pilot.sendChangeWeapon(1);
    assert.equal(pilot.sends, 1);
    assert.equal(pilot.selectedWeaponIndex, 1);
    new Manager().weaponChangeFailed({ getString: () => 'pilot' });
    assert.equal(pilot.selectedWeaponIndex, 0);
    assert.equal(pilot.ship.weaponIsChanging, false);
    assert.equal(client.weaponChangeResolvedGeneration, generation);
    assert.equal(client.weaponChangeResolvedSuccessfully, false);
    assert.equal(client.weaponChangePendingGeneration, 0);
    pilot.sendChangeWeapon(2);
    pilot.changeWeapon({ getInt: () => 1 }, 0);
    assert.equal(client.get_weaponChangeResolvedSuccessfully(), true);
    assert.equal(client.get_weaponChangeResolvedKey(), 'two');
    assert.equal(client.get_acknowledgedWeaponKey(), 'two');
    pilot.sendChangeWeapon(1);
    assert.equal(pilot.sends, 3, 'acknowledgement releases the pending request');
    assert.equal(pilot.selectedWeaponIndex, 0);
  } finally {
    cleanups.reverse().forEach((off) => off());
  }
  assert.equal('requestWeaponChange' in pilot, false);
  assert.equal('weaponChangePendingGeneration' in pilot, false);
  assert.equal('get_weaponChangePendingGeneration' in pilot, false);
});
