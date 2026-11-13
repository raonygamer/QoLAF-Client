import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { API } from '../src/api/Types';
import { bindGameClasses } from '../src/game/Bindings';
import { installPlayerMessageGuards } from '../src/ship/PlayerMessageGuards';
// @ts-expect-error actual host dispatcher
import { Hooks } from './fixtures/HostCore.js';

test('late speed and landing messages skip missing ships and preserve native handling', () => {
  interface Player {
    ship: { engine: { speed: number } | null } | null;
  }
  class Manager {
    players: Record<string, Player | undefined> = {};
    speedCalls = 0;
    landingCalls = 0;
    get_playersById() {
      return { h: this.players };
    }
    setSpeed(message: { getString(index: number): string; getNumber(index: number): number }) {
      this.speedCalls++;
      this.players[message.getString(0)]!.ship!.engine!.speed = message.getNumber(1);
    }
    landFailed(_message: object) {
      this.landingCalls++;
    }
  }
  const hooks = new Hooks();
  const cleanups: (() => void)[] = [];
  const logs: unknown[][] = [];
  const api = {
    cls: () => Manager,
    log: (...args: unknown[]) => logs.push(args),
    around: (target: object, key: string, fn: (...args: never[]) => unknown) => {
      const off = hooks.add(target, key, 'around', fn);
      cleanups.push(off);
      return off;
    },
  } as unknown as API;
  bindGameClasses(api);
  installPlayerMessageGuards(api);
  const manager = new Manager();
  const packet = { getString: () => 'pilot', getNumber: () => 450 };
  try {
    for (const player of [undefined, { ship: null }]) {
      manager.players.pilot = player;
      manager.setSpeed(packet);
      manager.landFailed(packet);
    }
    assert.equal(manager.speedCalls, 0);
    assert.equal(manager.landingCalls, 0);
    assert.equal(logs.length, 2);
    manager.players.pilot = { ship: { engine: null } };
    manager.setSpeed(packet);
    assert.equal(manager.speedCalls, 0);
    manager.landFailed(packet);
    assert.equal(manager.landingCalls, 1, 'landing only needs an existing ship');
    const engine = { speed: 10 };
    manager.players.pilot.ship = { engine };
    manager.setSpeed(packet);
    assert.equal(engine.speed, 450);
    assert.equal(manager.speedCalls, 1);
  } finally {
    cleanups.reverse().forEach((off) => off());
  }
  manager.setSpeed(packet);
  assert.equal(manager.speedCalls, 2);
});
