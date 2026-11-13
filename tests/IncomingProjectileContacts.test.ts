import { bindGameClasses, type GameScene } from '../src/game/Bindings';
import type { API } from '../src/api/Types';
import assert from 'node:assert/strict';
import test from 'node:test';
// @ts-expect-error actual host hook implementation
import { Hooks } from './fixtures/HostCore.js';
import { installIncomingProjectileContacts as installNativeContacts } from '../src/telemetry/IncomingProjectileContacts';

function installIncomingProjectileContacts(api: API, game: unknown): void {
  class UnusedContactState {
    enter() {}
    execute() {}
    shoot() {}
  }
  bindGameClasses({ ...api, cls: (name: string) => api.cls(name) ?? UnusedContactState });
  installNativeContacts(api, game as GameScene);
}

test('NPC contact capture requires a native collision exit and deduplicates destroy/explode', () => {
  const game = { get_isLeaving: () => false };
  const contacts: any[] = [];
  class Ship {
    get_pos() {
      return { x: 0, y: 0 };
    }
  }
  class PlayerShip extends Ship {
    alive = true;
    invulnerable = false;
    player: any = { ship: this, recordIncomingWeaponHit: (weapon: any) => contacts.push(weapon) };
  }
  class Projectile {
    weapon: any;
    destroy() {
      this.explode();
    }
    explode() {}
  }
  class Bullet {
    m = game;
    isEnemy = true;
    p = new Projectile();
    target = new PlayerShip();
    hit = false;
    execute() {
      this.target.get_pos();
      this.target.get_pos();
      if (this.hit) this.p.destroy();
    }
  }
  class Bouncing extends Bullet {}
  class Stuck {
    p: any;
    stuckUnit: any;
    enter() {}
  }
  class MissileStuck extends Stuck {
    m = game;
  }
  const classes: any = {
    'core.ship.Ship': Ship,
    'core.ship.PlayerShip': PlayerShip,
    'core.projectile.Projectile': Projectile,
    'core.states.aistates.ProjectileBullet': Bullet,
    'core.states.aistates.Bouncing': Bouncing,
    'core.states.aistates.ProjectileStuck': Stuck,
    'core.states.aistates.MissileStuck': MissileStuck,
    'core.weapon.Damage': { HEAL: 7 },
  };
  const hooks = new Hooks();
  const releases: Function[] = [];
  installIncomingProjectileContacts(
    {
      cls: (name: string) => classes[name],
      before: (target: any, key: string, fn: Function) =>
        releases.push(hooks.add(target, key, 'before', fn)),
      after: (target: any, key: string, fn: Function) =>
        releases.push(hooks.add(target, key, 'after', fn)),
      around: (target: any, key: string, fn: Function) =>
        releases.push(hooks.add(target, key, 'around', fn)),
    } as any,
    game,
  );
  const bullet = new Bullet();
  const weapon = { g: game, unit: {}, dmg: { type: 0, dmg: () => 10 } };
  bullet.p.weapon = weapon;
  bullet.execute();
  assert.equal(contacts.length, 0);
  bullet.p.destroy();
  assert.equal(contacts.length, 0, 'destruction outside collision scan is not evidence');
  bullet.hit = true;
  bullet.execute();
  assert.deepEqual(contacts, [weapon]);
  bullet.target.invulnerable = true;
  bullet.execute();
  assert.equal(contacts.length, 1);
  bullet.target.invulnerable = false;
  bullet.target.player.ship = {};
  bullet.execute();
  assert.equal(contacts.length, 1, 'mirrors do not provide their owner current-ship evidence');
  bullet.target.player.ship = bullet.target;
  bullet.p.weapon = { ...weapon, unit: new PlayerShip() };
  bullet.execute();
  assert.equal(contacts.length, 1, 'player weapons are excluded');
  bullet.p.weapon = { ...weapon, unit: { owner: {} } };
  bullet.execute();
  assert.equal(contacts.length, 1, 'owned units are excluded');
  bullet.p.weapon = { ...weapon, dmg: { type: 7, dmg: () => 10 } };
  bullet.execute();
  assert.equal(contacts.length, 1, 'healing is excluded');
  bullet.p.weapon = { ...weapon, dmg: { type: 0, dmg: () => NaN } };
  bullet.execute();
  assert.equal(contacts.length, 1, 'invalid damage is excluded');
  bullet.p.weapon = weapon;
  const missile = new MissileStuck();
  missile.p = bullet.p;
  missile.stuckUnit = bullet.target;
  missile.enter();
  assert.equal(
    contacts.length,
    2,
    'missile stuck entry has an explicit native contact without a bullet scan',
  );
  for (const release of releases.reverse()) release();
});

test('NPC beam history records firing ticks rather than drawing or aiming between ticks', () => {
  const game = { time: 100, get_isLeaving: () => false };
  let contacts = 0;
  class Ship {
    get_pos() {
      return { x: 0, y: 0 };
    }
  }
  class PlayerShip extends Ship {
    alive = true;
    invulnerable = false;
    player = {
      ship: this,
      recordIncomingWeaponHit: () => {
        contacts++;
      },
    };
  }
  class Projectile {
    destroy() {}
    explode() {}
  }
  class Beam {
    g = game;
    unit = {};
    dmg = { type: 0, dmg: () => 10 };
    target: PlayerShip | null = new PlayerShip();
    targetBody: object | null = null;
    fireNextTime = 0;
    lastFire = 0;
    shoot() {
      if (this.targetBody || !this.target?.alive) return;
      if (this.fireNextTime < game.time) {
        this.lastFire = game.time;
        this.fireNextTime = game.time + 33;
      }
    }
  }
  const classes: any = {
    'core.ship.Ship': Ship,
    'core.ship.PlayerShip': PlayerShip,
    'core.projectile.Projectile': Projectile,
    'core.weapon.Beam': Beam,
    'core.weapon.Damage': { HEAL: 7 },
  };
  const hooks = new Hooks();
  const releases: Function[] = [];
  installIncomingProjectileContacts(
    {
      cls: (name: string) => classes[name],
      before: (target: any, key: string, fn: Function) =>
        releases.push(hooks.add(target, key, 'before', fn)),
      after: (target: any, key: string, fn: Function) =>
        releases.push(hooks.add(target, key, 'after', fn)),
      around: (target: any, key: string, fn: Function) =>
        releases.push(hooks.add(target, key, 'around', fn)),
    } as any,
    game,
  );
  const beam = new Beam();
  beam.shoot();
  assert.equal(contacts, 1);
  beam.shoot();
  assert.equal(contacts, 1);
  game.time = 133;
  beam.shoot();
  assert.equal(contacts, 1, 'strict fireNextTime boundary');
  game.time = 134;
  beam.shoot();
  assert.equal(contacts, 2);
  game.time = 200;
  beam.targetBody = {};
  beam.shoot();
  assert.equal(contacts, 2);
  beam.targetBody = null;
  beam.target = null;
  beam.shoot();
  assert.equal(contacts, 2);
  for (const release of releases.reverse()) release();
});

test('current native NPC bullet and bouncing collisions preserve physics and record each victim once', async () => {
  const { createProjectileBulletExecute, createBouncingExecute } = await import(
    './fixtures/NativeProjectileContacts.js'
  );
  for (const [family, execute] of [
    ['bullet', createProjectileBulletExecute(class {})],
    ['bouncing', createBouncingExecute(class {})],
  ] as const) {
    for (const [hits, distance] of [
      [1, 4],
      [10, 4],
      [10, 100],
    ] as const) {
      const records: PlayerShip[] = [];
      const game = {
        time: 1000,
        get_isLeaving: () => false,
        shipManager: { players: [] as PlayerShip[] },
      };
      class Ship {
        constructor(readonly pos: { x: number; y: number }) {}
        get_pos() {
          return this.pos;
        }
      }
      class PlayerShip extends Ship {
        alive = true;
        invulnerable = false;
        collisionRadius = 2;
        player = { ship: this, recordIncomingWeaponHit: () => records.push(this) };
      }
      game.shipManager.players.push(
        new PlayerShip({ x: distance, y: distance }),
        new PlayerShip({ x: distance + 2, y: distance + 2 }),
      );
      class Projectile {
        g = game;
        unit = { lastBulletLocal: 0 };
        weapon = { g: game, unit: this.unit, dmg: { type: 0, dmg: () => 10 } };
        numberOfHits: number = hits;
        alive = true;
        target = null;
        isBomb = false;
        convergenceTime = 1;
        convergenceCounter = 1;
        error = null;
        oldPos = { x: 0, y: 0 };
        course = { pos: { x: 0, y: 0 } };
        speedMax = 100;
        collisionRadius = 1;
        explosions = 0;
        removals = 0;
        updateHeading() {
          this.course.pos.x += 10;
          this.course.pos.y += 10;
        }
        explode() {
          this.explosions++;
        }
        destroy() {
          this.removals++;
          this.explode();
          this.alive = false;
        }
      }
      class State {
        m = game;
        p = new Projectile();
        isEnemy = true;
        nextLocalUpdate = 0;
        firstUpdate = true;
        execute() {
          return execute.call(this);
        }
      }
      const snapshot = (state: State) => ({
        pos: { ...state.p.course.pos },
        alive: state.p.alive,
        explosions: state.p.explosions,
        removals: state.p.removals,
        hits: state.p.numberOfHits,
        next: state.nextLocalUpdate,
      });
      const baseline = new State();
      baseline.execute();
      const classes: Record<string, object> = {
        'core.ship.Ship': Ship,
        'core.ship.PlayerShip': PlayerShip,
        'core.projectile.Projectile': Projectile,
        [`core.states.aistates.${family === 'bullet' ? 'ProjectileBullet' : 'Bouncing'}`]: State,
        'core.weapon.Damage': { HEAL: 7 },
      };
      const hooks = new Hooks((error: unknown) => {
        throw error;
      });
      const releases: Array<() => void> = [];
      const hook =
        (kind: string) =>
        (target: object, key: string, callback: (...args: never[]) => unknown) => {
          const off = hooks.add(target, key, kind, callback);
          releases.push(off);
          return off;
        };
      installIncomingProjectileContacts(
        {
          cls: (name: string) => classes[name],
          before: hook('before'),
          after: hook('after'),
          around: hook('around'),
        } as unknown as API,
        game,
      );
      try {
        const observed = new State();
        observed.execute();
        assert.deepEqual(snapshot(observed), snapshot(baseline), family);
        const count = distance === 100 ? 0 : hits === 1 ? 1 : 2;
        assert.equal(
          baseline.p.explosions,
          count,
          'native fixture actually reaches expected branches',
        );
        assert.deepEqual(records, game.shipManager.players.slice(0, count), family);
        observed.p.destroy();
        assert.equal(records.length, count, 'destruction outside a collision scan adds no history');
      } finally {
        releases.reverse().forEach((off) => off());
      }
    }
  }
});
