import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { API } from '../src/api/Types';
import { bindGameClasses } from '../src/game/Bindings';
import { installNativeTurretUpdates } from '../src/turret/NativeTurretUpdates';
// @ts-expect-error actual host dispatcher
import { Hooks } from './fixtures/HostCore.js';

test('server turret update preserves local aim but applies health, target and firing', () => {
  const target = {};
  class Turret {
    id = 1;
    syncId = 3;
    parentObj = { get_id: () => 2 };
    hp = 100;
    shieldHp = 50;
    isInjured = false;
    rotation = 1.2;
    target: object | null = null;
    weapon: { set_fire: (fire: boolean) => void } | null = {
      set_fire: (fire) => {
        this.firing = fire;
      },
    };
    firing = false;
    get_id() {
      return this.id;
    }
    get_hpMax() {
      return 100;
    }
    get_shieldHpMax() {
      return 50;
    }
  }
  class Manager {
    turrets = [new Turret()];
    calls = 0;
    g = { shipManager: { getShipFromId: (id: number) => (id === 8 ? target : null) } };
    getTurretById(id: number, _silent = false) {
      this.calls++;
      return this.turrets.find((turret) => turret.id === id) ?? null;
    }
    getTurretsByParentAndSyncId(parent: number, sync: number) {
      return this.turrets.find((t) => t.parentObj.get_id() === parent && t.syncId === sync) ?? null;
    }
    getTurret() {
      const turret = new Turret();
      this.turrets.push(turret);
      return turret;
    }
    removeTurret(turret: Turret) {
      this.turrets.splice(this.turrets.indexOf(turret), 1);
    }
    onTurretUpdate(_message: object) {
      this.turrets[0].rotation = -2;
    }
  }
  const hooks = new Hooks((error: unknown) => {
    throw error;
  });
  const cleanups: Array<() => void> = [];
  const hook = (kind: string) => (owner: object, key: string, callback: Function) => {
    const off = hooks.add(owner, key, kind, callback);
    cleanups.push(off);
    return off;
  };
  const api = {
    cls: (name: string) => (name === 'core.turret.TurretManager' ? Manager : {}),
    around: hook('around'),
    after: hook('after'),
  } as unknown as API;
  bindGameClasses(api);
  installNativeTurretUpdates(api);
  const manager = new Manager(),
    turret = manager.turrets[0];
  const reads: number[] = [];
  const packet = {
    getInt: (index: number) => [1, 75, 20, 8][index],
    getNumber: (index: number) => {
      reads.push(index);
      return -2;
    },
    getBoolean: (index: number) => {
      assert.equal(index, 5);
      return true;
    },
  };
  try {
    manager.onTurretUpdate(packet);
    assert.deepEqual(
      [turret.hp, turret.shieldHp, turret.isInjured, turret.firing],
      [75, 20, true, true],
    );
    assert.equal(turret.target, target);
    assert.equal(turret.rotation, 1.2);
    assert.deepEqual(reads, [4]);
    assert.equal(manager.calls, 0);
    turret.weapon = null;
    manager.onTurretUpdate(packet);
    manager.removeTurret(turret);
    assert.equal(manager.getTurretById(1, true), null);
  } finally {
    cleanups.reverse().forEach((off) => off());
  }
  manager.turrets.push(turret);
  manager.onTurretUpdate(packet);
  assert.equal(turret.rotation, -2, 'unload restores native update');
});
