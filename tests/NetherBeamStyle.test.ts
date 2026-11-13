import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { API } from '../src/api/Types';
import type { ProjectileAISettings } from '../src/game/ProjectileAISettings';
import { bindGameClasses } from '../src/game/Bindings';
type Settings = ProjectileAISettings & { range?: number; ttl?: number };
interface ProjectileFixture {
  unit: object;
  weapon: { key: string };
  ai?: string;
}
import { installNetherBeamStyle } from '../src/rendering/NetherBeamStyle';
// @ts-expect-error production hook dispatcher
import { Hooks } from './fixtures/HostCore.js';

test('Nether beam uses Chrono appearance without substituting AI, range, TTL or shared data', () => {
  class Enemy {
    constructor(private nether = true) {}
    hasFaction(name: string) {
      return this.nether && name === 'Nether';
    }
  }
  let style: Settings | null = {
    ai: 'bullet',
    color: 1,
    glowColor: 2,
    thickness: 3,
    alpha: 0.4,
    range: 999,
    ttl: 999,
  };
  const original = Object.freeze({
    ai: 'instant',
    color: 10,
    glowColor: 20,
    thickness: 30,
    alpha: 1,
    amplitude: 7,
    frequency: 20,
    range: 375,
    ttl: 33,
  });
  const factory = {
    createProjectileAI(input: Settings, _game: object, p: ProjectileFixture) {
      p.ai = input.ai;
      return input;
    },
  };
  const classes: Record<string, unknown> = {
    'core.states.aistates.AIStateFactory': factory,
    'core.ship.EnemyShip': Enemy,
    'data.DataLocator': {
      getService: () => ({
        loadKey: (table: string, key: string) => {
          assert.equal(table, 'Projectiles');
          assert.equal(key, '-gg79fF6tUObIXe40zzifg');
          return style;
        },
      }),
    },
  };
  const hooks = new Hooks();
  const remove: Array<() => void> = [];
  const api = {
    cls: (name: string) => classes[name],
    around: (target: object, method: string, fn: unknown) => {
      const off = hooks.add(target, method, 'around', fn);
      remove.push(off);
      return off;
    },
  } as unknown as API;
  bindGameClasses({ ...api, cls: (name: string) => classes[name] ?? {} } as API);
  installNetherBeamStyle(api);
  const projectile: ProjectileFixture = {
    unit: new Enemy(),
    weapon: { key: '222ekuHQxE6j9IOXMVXs6g' },
  };
  const result = factory.createProjectileAI(original, {}, projectile);
  assert.equal(result.color, 1);
  assert.equal(result.glowColor, 2);
  assert.equal(result.thickness, 3);
  assert.equal(result.alpha, 0.4);
  assert.equal(result.range, 375);
  assert.equal(result.ttl, 33);
  assert.equal(result.ai, 'instant');
  assert.equal(projectile.ai, 'instant');
  assert.equal(Object.hasOwn(result, 'amplitude'), false);
  assert.equal(Object.hasOwn(result, 'frequency'), false);
  assert.equal(original.color, 10);
  style = { ...style, amplitude: 2, frequency: 5, texture: 'chrono' };
  const second = factory.createProjectileAI(original, {}, projectile);
  assert.equal(second.amplitude, 2);
  assert.equal(second.frequency, 5);
  assert.equal(second.texture, 'chrono');
  for (const unit of [{}, new Enemy(false)]) {
    projectile.unit = unit;
    assert.equal(factory.createProjectileAI(original, {}, projectile), original);
  }
  projectile.unit = new Enemy();
  projectile.weapon.key = 'other';
  assert.equal(factory.createProjectileAI(original, {}, projectile), original);
  projectile.weapon.key = '222ekuHQxE6j9IOXMVXs6g';
  style = null;
  assert.equal(factory.createProjectileAI(original, {}, projectile), original);
  remove.forEach((fn) => fn());
});
