import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { API } from '../src/api/Types';
import { bindGameClasses } from '../src/game/Bindings';
import { installWeaponLifecycle } from '../src/weapon/WeaponLifecycle';
import { installNativeWeaponDraw } from '../src/weapon/NativeWeaponDraw';
import { DrawableWeapons } from '../src/weapon/DrawableWeapons';
// @ts-expect-error actual host dispatcher
import { Hooks } from './fixtures/HostCore.js';

test('drawable membership preserves order and ignores repeated removals', () => {
  const a = { draws: true },
    b = { draws: false },
    c = { draws: true };
  const all = [a, b, c];
  const list = new DrawableWeapons(
    () => all,
    (item) => item.draws,
  );
  assert.deepEqual(list.values, [a, c]);
  all.splice(0, 1);
  list.removed(a);
  list.removed(a);
  assert.deepEqual(list.values, [c]);
  const d = { draws: true };
  all.push(d);
  list.added(d);
  assert.deepEqual(list.values, [c, d]);
  all.length = 0;
  assert.deepEqual(list.values, []);
});

test('scene draw keeps native world order, visible gating and weapon factory/removal lifecycle', () => {
  const order: string[] = [];
  class Weapon {
    alive = true;
    destroyed = 0;
    set_fire(_value: boolean) {}
    destroy() {
      this.alive = false;
      this.destroyed++;
    }
    draw() {}
  }
  class Beam extends Weapon {
    draw() {
      order.push('beam');
    }
  }
  class Manager {
    weapons: Weapon[] = [new Weapon(), new Beam()];
    getWeapon(kind: string) {
      const weapon = kind === 'beam' ? new Beam() : new Weapon();
      this.weapons.push(weapon);
      return weapon;
    }
    removeWeapon(index: number) {
      this.weapons.splice(index, 1);
    }
  }
  const group = (name: string) => [
    { isAddedToCanvas: true, draw: () => order.push(name) },
    {
      isAddedToCanvas: false,
      draw: () => {
        throw new Error('hidden object drawn');
      },
    },
  ];
  class Scene {
    parallaxManager = { draw: () => order.push('parallax') };
    bodyManager = { bodies: group('body') };
    spawnManager = { spawners: group('spawner') };
    turretManager = { turrets: group('turret') };
    dropManager = { drops: group('drop') };
    bossManager = { bosses: group('boss') };
    shipManager = { ships: group('ship') };
    projectileManager = { projectiles: group('projectile') };
    weaponManager = new Manager();
    exit() {}
    draw() {
      order.push('native');
      for (const weapon of this.weaponManager.weapons) weapon.draw();
    }
  }
  class Turret {
    destroy() {}
  }
  class TurretManager {
    removeTurret() {}
  }
  const classes = {
    'core.turret.Turret': Turret,
    'core.turret.TurretManager': TurretManager,
    'core.scene.Game': Scene,
    'core.weapon.Weapon': Weapon,
    'core.weapon.WeaponManager': Manager,
  };
  const hooks = new Hooks((error: unknown) => {
      throw error;
    }),
    cleanups: Array<() => void> = [];
  const hook = (kind: string) => (target: object, key: string, callback: Function) => {
    const off = hooks.add(target, key, kind, callback);
    cleanups.push(off);
    return off;
  };
  const api = {
    cls: (name: string) => Reflect.get(classes, name) ?? {},
    before: hook('before'),
    around: hook('around'),
    after: hook('after'),
  } as unknown as API;
  bindGameClasses(api);
  installWeaponLifecycle(api);
  installNativeWeaponDraw(api);
  const scene = new Scene(),
    originalDraw = Weapon.prototype.draw;
  try {
    scene.draw();
    assert.deepEqual(order, [
      'parallax',
      'body',
      'spawner',
      'turret',
      'drop',
      'boss',
      'ship',
      'projectile',
      'beam',
    ]);
    const beam = scene.weaponManager.getWeapon('beam');
    scene.weaponManager.getWeapon('blaster');
    order.length = 0;
    scene.draw();
    assert.equal(order.filter((value) => value === 'beam').length, 2);
    scene.weaponManager.removeWeapon(scene.weaponManager.weapons.indexOf(beam));
    order.length = 0;
    scene.draw();
    assert.equal(order.filter((value) => value === 'beam').length, 1);
    Weapon.prototype.draw = () => order.push('plugin-base');
    order.length = 0;
    scene.draw();
    assert.equal(order[0], 'native');
    assert.ok(order.includes('plugin-base'));
    Weapon.prototype.draw = originalDraw;
    // Cache is already populated: teardown must remove its beam references too.
    const remaining = [...scene.weaponManager.weapons];
    scene.exit();
    scene.exit();
    assert.equal(scene.weaponManager.weapons.length, 0);
    assert.ok(remaining.every((weapon) => weapon.destroyed === 1));
    order.length = 0;
    scene.draw();
    assert.equal(order.includes('beam'), false);
    scene.weaponManager.getWeapon('beam');
    order.length = 0;
    scene.draw();
    assert.equal(order.filter((value) => value === 'beam').length, 1);
  } finally {
    Weapon.prototype.draw = originalDraw;
    cleanups.reverse().forEach((off) => off());
  }
  order.length = 0;
  scene.draw();
  assert.equal(order[0], 'native');
});
