import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { API } from '../src/api/Types';
import { bindGameClasses, type GameScene } from '../src/game/Bindings';
import { installProjectileTargetHistory } from '../src/telemetry/ProjectileTargetHistory';
// @ts-expect-error production hook dispatcher
import { Hooks } from './fixtures/HostCore.js';

test('target lifecycle capture follows only native unit-target assignments in the owned scene', () => {
  const game = {} as GameScene;
  const previous = {};
  const next = {};
  class Packet {
    constructor(public values: number[]) {}
    get length() {
      return this.values.length;
    }
    getInt(index: number) {
      return this.values[index];
    }
  }
  const shot = { target: previous };
  class Manager {
    g = game;
    projectilesById = { h: { '7': shot } as Record<string, typeof shot> };
    handleBouncing(_message: Packet, _offset: number) {
      shot.target = next;
    }
    updateCourse(_message: Packet) {
      shot.target = next;
    }
  }
  const cleanups: Array<() => void> = [];
  const hooks = new Hooks((error: unknown) => {
    throw error;
  });
  const api = {
    cls: (name: string) => (name === 'core.projectile.ProjectileManager' ? Manager : {}),
    after: (owner: object, method: string, callback: unknown) => {
      const off = hooks.add(owner, method, 'after', callback);
      cleanups.push(off);
      return off;
    },
  } as unknown as API;
  bindGameClasses(api);
  const captured: object[] = [];
  installProjectileTargetHistory(api, game, (projectile) => {
    if (projectile.target) captured.push(projectile.target);
  });
  const manager = new Manager();
  const record = (id: number, type: number) => [id, type, ...Array<number>(12).fill(0)];
  try {
    manager.handleBouncing(new Packet([0, 0, 7, 55]), 2);
    assert.deepEqual(captured, [next], 'capture occurs after native assignment at supplied offset');
    manager.updateCourse(
      new Packet([...record(999, 1), ...record(7, 0), ...record(7, 1), ...record(7, 2)]),
    );
    assert.equal(captured.length, 2, 'only known unit-target record refreshes snapshot');
    manager.updateCourse(new Packet([7, 1]));
    assert.equal(captured.length, 2, 'truncated record is ignored');
    manager.g = {} as GameScene;
    manager.handleBouncing(new Packet([7, 55]), 0);
    manager.updateCourse(new Packet(record(7, 1)));
    assert.equal(captured.length, 2);
  } finally {
    cleanups.reverse().forEach((off) => off());
  }
  manager.g = game;
  manager.handleBouncing(new Packet([7, 55]), 0);
  assert.equal(captured.length, 2, 'unload removes capture');
});
