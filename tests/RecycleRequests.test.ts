import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { API } from '../src/api/Types';
import { installRecycleRequests } from '../src/runtime/RecycleRequests';
// @ts-expect-error actual host dispatcher
import { Hooks } from './fixtures/HostCore.js';

test('late recycle replies reconcile captured cargo once after unload without invoking old UI', () => {
  const cleanups: Array<() => void> = [];
  const hooks = new Hooks((error: unknown) => {
    throw error;
  });
  const removals: Array<[string, number]> = [];
  const additions: Array<[string, string, number]> = [];
  const response = {
    length: 2,
    getString: (_offset: number) => 'metal',
    getInt: (_offset: number) => 7,
  };
  let reply: ((value: typeof response) => void) | undefined;
  const game = {
    rpcMessage(_message: { type: string }, callback: typeof reply) {
      reply = callback;
    },
  };
  class Recycle {
    g = game;
    recycling = false;
    unloaded = false;
    uiUpdates = 0;
    junkTextItems = [{ selected: true, obj: { key: 'junk' }, quantity: 4 }];
    myCargo = {
      removeJunk(key: string, count: number) {
        removals.push([key, count]);
      },
      addItem(table: string, key: string, count: number) {
        additions.push([table, key, count]);
      },
    };
    recycle() {
      this.recycling = true;
      this.g.rpcMessage({ type: 'recycleJunk' }, () => {
        this.uiUpdates++;
      });
    }
    execute() {}
  }
  const api = {
    cls: (name: string) => (name === 'core.states.gameStates.LandedRecycle' ? Recycle : undefined),
    around(owner: object, method: string, callback: unknown) {
      const off = hooks.add(owner, method, 'around', callback);
      cleanups.push(off);
      return off;
    },
    after(owner: object, method: string, callback: unknown) {
      const off = hooks.add(owner, method, 'after', callback);
      cleanups.push(off);
      return off;
    },
    defer: (off: () => void) => cleanups.push(off),
  } as unknown as API;
  installRecycleRequests(api, game);
  const state = new Recycle();
  state.recycle();
  assert.ok(reply);
  state.junkTextItems[0].quantity = 99;
  cleanups.reverse().forEach((off) => off());
  reply(response);
  reply(response);
  assert.deepEqual(removals, [['junk', 4]]);
  assert.deepEqual(additions, [['Commodities', 'metal', 7]]);
  assert.equal(state.uiUpdates, 0);
  assert.equal(state.recycling, false);
});
