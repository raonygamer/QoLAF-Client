import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { API } from '../src/api/Types';
import { bindGameClasses } from '../src/game/Bindings';
import { installNativeRosterRetry } from '../src/pvp/NativeRosterRetry';
// @ts-expect-error use the real host hook dispatcher
import { Hooks } from './fixtures/HostCore.js';

test('native PvP and domination requests retain payload and only back off on a sent retry', () => {
  class Manager {
    requestTime = 0;
    roomStartTime = 0;
    scoreList: number[] = [];
    sent: string[] = [];
    g = { time: 1, playerManager: { get_players: () => [1, 2] } };
    update() {
      if (
        this.requestTime < this.g.time &&
        (this.roomStartTime === 0 ||
          this.g.playerManager.get_players().length > this.scoreList.length)
      ) {
        this.requestTime = this.g.time + 2000;
        this.sent.push('requestInitPlayers');
      }
    }
    m_pvpInitPlayers() {
      this.requestTime = this.g.time + 2000;
    }
  }
  class Domination extends Manager {
    update() {
      Manager.prototype.update.call(this);
    }
  }
  // The current Haxe domination update duplicates the request branch rather
  // than invoking its base method. Preserve that shape in the fixture.
  Object.defineProperty(Domination.prototype, 'update', {
    value: Manager.prototype.update,
    configurable: true,
    writable: true,
  });
  const hooks = new Hooks((error: unknown) => {
    throw error;
  });
  const cleanups: Array<() => void> = [];
  const hook = (kind: string) => (target: object, key: string, callback: Function) => {
    const off = hooks.add(target, key, kind, callback);
    cleanups.push(off);
    return off;
  };
  const classes = {
    'core.hud.components.pvp.PvpManager': Manager,
    'core.hud.components.pvp.DominationManager': Domination,
  };
  const api = {
    cls: (name: string) => Reflect.get(classes, name) ?? {},
    around: hook('around'),
    after: hook('after'),
  } as unknown as API;
  bindGameClasses(api);
  installNativeRosterRetry(api);
  try {
    for (const Type of [Manager, Domination]) {
      const manager = new Type();
      manager.update();
      assert.equal(manager.requestTime, 2001);
      manager.g.time = 1000;
      manager.update();
      assert.equal(manager.sent.length, 1);
      manager.g.time = 2002;
      manager.update();
      assert.equal(manager.requestTime, 5002);
      assert.deepEqual(manager.sent, ['requestInitPlayers', 'requestInitPlayers']);
      manager.g.time = 3000;
      manager.scoreList = [1];
      manager.m_pvpInitPlayers();
      assert.equal(manager.requestTime, 7500);
      manager.scoreList = [1, 2];
      manager.m_pvpInitPlayers();
      manager.roomStartTime = 1;
      manager.g.time = 8000;
      manager.update();
      assert.equal(manager.sent.length, 2);
      manager.scoreList.pop();
      manager.update();
      assert.equal(manager.requestTime, 10000);
    }
  } finally {
    cleanups.reverse().forEach((off) => off());
  }
  const plain = new Manager();
  plain.update();
  plain.g.time = 2002;
  plain.update();
  assert.equal(plain.requestTime, 4002);
});
