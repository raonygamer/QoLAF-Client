import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { API } from '../src/api/Types';
import { bindGameClasses } from '../src/game/Bindings';
import { installPlayerProjectilePackets } from '../src/projectile/PlayerProjectilePackets';
// @ts-expect-error production dispatcher
import { Hooks } from './fixtures/HostCore.js';

test('late player shots use packet weapon without changing selection and preserve native stall checks', () => {
  class Packet {
    constructor(public values: Array<string | number>) {}
    get length() {
      return this.values.length;
    }
    getInt(index: number) {
      return Number(this.values[index]) | 0;
    }
    getNumber(index: number) {
      return Number(this.values[index]);
    }
    getString(index: number) {
      return String(this.values[index]);
    }
  }
  class Heading {
    pos = { x: 0, y: 0 };
    parseMessage(message: Packet, offset: number) {
      this.pos.x = message.getNumber(offset);
      this.pos.y = message.getNumber(offset + 1);
    }
  }
  class Gun {
    stalled = false;
    shots: unknown[][] = [];
    shootSyncedProjectile(...args: unknown[]) {
      this.shots.push(args);
    }
  }
  const selected = new Gun();
  const holstered = new Gun();
  const player = { selectedWeaponIndex: 0, ship: { weapons: [selected, holstered, {}] } };
  const victim = { id: 55 };
  class Manager {
    nativeCalls = 0;
    g = {
      playerManager: { get_playersById: () => ({ h: { player } }) },
      unitManager: { getTarget: (id: number) => (id === 55 ? victim : null) },
    };
    skipWhileStalled(weapon: Gun) {
      return weapon.stalled;
    }
    addPlayerProjectile(_packet: Packet) {
      this.nativeCalls++;
    }
  }
  const effects: unknown[][] = [];
  const classes: Record<string, unknown> = {
    'core.projectile.ProjectileManager': Manager,
    'core.weapon.ProjectileGun': Gun,
    'movement.Heading': Heading,
    'core.particle.EmitterFactory': { create: (...args: unknown[]) => effects.push(args) },
  };
  const cleanup: Array<() => void> = [];
  const hooks = new Hooks((error: unknown) => {
    throw error;
  });
  const api = {
    cls: (name: string) => classes[name] ?? {},
    around: (owner: object, name: string, callback: unknown) => {
      const off = hooks.add(owner, name, 'around', callback);
      cleanup.push(off);
      return off;
    },
  } as unknown as API;
  bindGameClasses(api);
  installPlayerProjectilePackets(api);
  const record = (id: number, weapon: number) => [
    id,
    'player',
    weapon,
    55,
    123,
    10.5,
    -20.5,
    ...Array<number>(8).fill(0),
    3,
    4,
    5,
    600,
  ];
  const manager = new Manager();
  try {
    manager.addPlayerProjectile(new Packet(record(1, 1)));
    assert.equal(player.selectedWeaponIndex, 0);
    assert.equal(selected.shots.length, 0);
    assert.equal(holstered.shots.length, 1);
    const shot = holstered.shots[0];
    assert.deepEqual([shot[0], shot[1], ...shot.slice(3)], [1, victim, 3, 123, 4, 5, 600]);
    assert.deepEqual((shot[2] as Heading).pos, { x: 10.5, y: -20.5 });
    holstered.stalled = true;
    manager.addPlayerProjectile(new Packet([...record(2, 1), ...record(3, 0)]));
    assert.equal(holstered.shots.length, 1);
    assert.equal(selected.shots.length, 1, 'stalled record does not discard next shot');
    manager.addPlayerProjectile(new Packet([...record(4, 2), ...record(5, 0)]));
    assert.equal(selected.shots.length, 2, 'non-projectile weapon is skipped');
    manager.addPlayerProjectile(new Packet(record(6, 0).slice(0, -1)));
    assert.equal(selected.shots.length, 2, 'incomplete record is ignored');
    manager.addPlayerProjectile(new Packet([...record(-1, 0), ...record(7, 0)]));
    assert.equal(effects.length, 1);
    assert.deepEqual(effects[0].slice(2), [10, -20, null, true]);
    assert.equal(selected.shots.length, 2, 'effect sentinel retains native terminal behavior');
  } finally {
    cleanup.reverse().forEach((off) => off());
  }
  manager.addPlayerProjectile(new Packet(record(8, 0)));
  assert.equal(manager.nativeCalls, 1);
});
