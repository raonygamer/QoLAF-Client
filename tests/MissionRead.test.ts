import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { API } from '../src/api/Types';
import { bindGameClasses } from '../src/game/Bindings';
import { installMissionRead } from '../src/missions/MissionRead';
// @ts-expect-error actual host dispatcher
import { Hooks } from './fixtures/HostCore.js';

test('mission viewing sends once without RPC ownership and preserves native viewed/hint logic', () => {
  class Scene {
    sent: string[] = [];
    requests: string[] = [];
    send(type: string) {
      this.sent.push(type);
    }
    rpc(type: string, _callback: (() => void) | null) {
      this.requests.push(type);
    }
  }
  class List {
    missions = [{ viewed: false }, { viewed: true }];
    hintsHidden = 0;
    fail = false;
    constructor(readonly g: Scene) {}
    trySetMissionsViewed() {
      if (this.fail) throw new Error('native screen failure');
      let changed = false;
      for (const mission of this.missions) {
        if (!mission.viewed) {
          mission.viewed = true;
          changed = true;
        }
      }
      if (changed) this.g.rpc('setMissionsViewed', null);
      this.hintsHidden++;
    }
  }
  const classes: Record<string, unknown> = {
    'core.scene.SceneBase': Scene,
    'core.states.gameStates.missions.MissionsList': List,
  };
  const cleanup: Array<() => void> = [];
  const hooks = new Hooks((error: unknown) => {
    throw error;
  });
  const api = {
    cls: (name: string) => classes[name] ?? {},
    around: (owner: object, key: string, fn: unknown) => {
      const off = hooks.add(owner, key, 'around', fn);
      cleanup.push(off);
      return off;
    },
  } as unknown as API;
  bindGameClasses(api);
  installMissionRead(api);
  const scene = new Scene();
  const list = new List(scene);
  list.trySetMissionsViewed();
  list.trySetMissionsViewed();
  assert.deepEqual(scene.sent, ['setMissionsViewed']);
  assert.deepEqual(scene.requests, []);
  assert.ok(list.missions.every((m) => m.viewed));
  assert.equal(list.hintsHidden, 2);
  list.fail = true;
  assert.throws(() => list.trySetMissionsViewed(), /native screen failure/);
  scene.rpc('setMissionsViewed', null);
  assert.deepEqual(scene.requests, ['setMissionsViewed'], 'scope releases after a throw');
  cleanup.reverse().forEach((off) => off());
  list.fail = false;
  list.missions[0].viewed = false;
  list.trySetMissionsViewed();
  assert.equal(scene.requests.length, 2, 'unsafe unload restores native behavior');
});
