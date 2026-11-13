import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { API } from '../src/api/Types';
import { bindGameClasses } from '../src/game/Bindings';
import { installWeaponLifecycle } from '../src/weapon/WeaponLifecycle';
// @ts-expect-error exercise the actual host hook dispatcher
import { Hooks } from './fixtures/HostCore.js';

// @ts-expect-error captured native game setter
import { createNativeWeaponFire } from './fixtures/NativeWeaponFire.js';

function fixture() {
  class PlayerShip {
    player = { isMe: true };
    cleared = 0;
    killChargeUpEffect() {
      this.cleared++;
    }
  }
  const nativeFire = createNativeWeaponFire(PlayerShip, { __cast: (value: object) => value }, {});
  class Weapon {
    alive = true;
    _fire = true;
    get fire() {
      return this._fire;
    }
    unit: PlayerShip | object | null = new PlayerShip();
    hasChargeUp = false;
    chargeUpTime = 0;
    released = 0;
    lastFire = 1;
    burstCurrent = 2;
    reloadTime = 10;
    load = 50;
    g = {
      time: 100,
      hud: {
        powerBar: {
          updateLoadBar: (value: number) => {
            this.load = value;
          },
        },
      },
    };
    onChargeReleased() {
      this.released++;
    }
    destroyed = 0;
    set_fire(value: boolean) {
      return nativeFire.call(this, value);
    }
    destroy() {
      assert.equal(this.fire, false);
      this.destroyed++;
      this.alive = false;
    }
  }
  class Weapons {
    weapons: Weapon[] = [];
    removeWeapon(index: number) {
      this.weapons.splice(index, 1);
    }
  }
  class Game {
    weaponManager = new Weapons();
    exited = false;
    exit() {
      assert.equal(this.weaponManager.weapons.length, 0);
      this.exited = true;
    }
  }
  class Turret {
    weapon: Weapon | null = new Weapon();
    alive = true;
    constructor(public g: Game) {
      g.weaponManager.weapons.push(this.weapon!);
    }
    destroy() {
      this.alive = false;
    }
  }
  class Turrets {
    turrets: Turret[] = [];
    removeTurret(turret: Turret) {
      this.turrets.splice(this.turrets.indexOf(turret), 1);
    }
  }
  const hooks = new Hooks((error: unknown) => {
    throw error;
  });
  const cleanups: Array<() => void> = [];
  const hook = (kind: string) => (target: object, key: string, callback: Function) => {
    const cleanup = hooks.add(target, key, kind, callback);
    cleanups.push(cleanup);
    return cleanup;
  };
  const classes = {
    'core.scene.Game': Game,
    'core.ship.PlayerShip': PlayerShip,
    'core.turret.Turret': Turret,
    'core.turret.TurretManager': Turrets,
    'core.weapon.WeaponManager': Weapons,
  };
  const api = {
    cls: (name: string) => Reflect.get(classes, name) ?? {},
    before: hook('before'),
    around: hook('around'),
  } as unknown as API;
  bindGameClasses(api);
  installWeaponLifecycle(api);
  return {
    Game,
    Turret,
    Turrets,
    Weapon,
    PlayerShip,
    dispose: () => cleanups.reverse().forEach((fn) => fn()),
  };
}

test('destroyed turret stops firing but keeps weapon for rebuild; terminal removal releases once', () => {
  const f = fixture();
  const game = new f.Game();
  const turrets = new f.Turrets();
  const turret = new f.Turret(game),
    other = new f.Turret(game);
  turrets.turrets.push(turret, other);
  const weapon = turret.weapon!;
  weapon.hasChargeUp = true;
  weapon.chargeUpTime = 50;
  turret.destroy();
  assert.equal(weapon.released, 0);
  assert.equal(weapon.fire, false);
  assert.equal(weapon.destroyed, 0);
  assert.equal(turret.weapon, weapon);
  turrets.removeTurret(turret);
  turrets.removeTurret(turret);
  assert.equal(turret.weapon, null);
  assert.equal(weapon.destroyed, 1);
  assert.deepEqual(turrets.turrets, [other]);
  assert.deepEqual(game.weaponManager.weapons, [other.weapon]);
  game.weaponManager.removeWeapon(-1);
  assert.equal(game.weaponManager.weapons.length, 1);
  f.dispose();
});

test('room exit destroys remaining effects before native scene teardown, including repeated exit', () => {
  const f = fixture();
  for (let room = 0; room < 3; room++) {
    const game = new f.Game();
    const turret = new f.Turret(game);
    const weapon = turret.weapon!;
    game.exit();
    game.exit();
    assert.equal(weapon.fire, false);
    assert.equal(weapon.destroyed, 1);
    assert.equal(game.exited, true);
  }
  f.dispose();
});

test('native charged setter never fires during room exit or terminal weapon cleanup', () => {
  const f = fixture();
  try {
    for (const owner of [
      new f.PlayerShip(),
      Object.assign(new f.PlayerShip(), { player: { isMe: false } }),
      {},
      null,
    ]) {
      const game = new f.Game();
      const turret = new f.Turret(game);
      const weapon = turret.weapon!;
      weapon.unit = owner;
      weapon.hasChargeUp = true;
      weapon.chargeUpTime = 50;
      game.exit();
      game.exit();
      assert.equal(weapon.released, 0);
      assert.equal(weapon.chargeUpTime, 0);
      assert.equal(weapon.fire, false);
      assert.equal(weapon.destroyed, 1);
      assert.equal(weapon.lastFire, 0);
      assert.equal(weapon.burstCurrent, 0);
      if (owner instanceof f.PlayerShip) {
        assert.equal(owner.cleared, 1);
        assert.equal(weapon.load, owner.player.isMe ? 0 : 50);
      }
    }
    const ordinary = new f.Weapon();
    ordinary.hasChargeUp = true;
    ordinary.chargeUpTime = 50;
    ordinary.set_fire(false);
    assert.equal(ordinary.released, 1, 'normal release stays native');
  } finally {
    f.dispose();
  }
});
