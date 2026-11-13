import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { API } from '../src/api/Types';
import { bindGameClasses } from '../src/game/Bindings';
import { installGameMessageHandlers } from '../src/network/GameMessageHandlers';
// @ts-expect-error real host hook dispatcher
import { Hooks } from './fixtures/HostCore.js';

type Handler = (message: { type: string }) => void;
function fixture() {
  class Connection {
    handlers: Array<{ type: string; callback: Handler }> = [];
    get_connected() {
      return true;
    }
    addMessageHandler(type: string, callback: Handler) {
      this.handlers.push({ type, callback });
    }
    removeMessageHandler(type: string, callback: Handler) {
      const index = this.handlers.findIndex(
        (entry) => entry.type === type && entry.callback === callback,
      );
      if (index >= 0) this.handlers.splice(index, 1);
    }
    dispatch(type: string) {
      // Match SDK iteration over its live array, not a copied test-only queue.
      for (let index = 0; index < this.handlers.length; index++) {
        const entry = this.handlers[index];
        if (entry.type === type) entry.callback({ type });
      }
    }
  }
  class Scene {
    connection = new Connection();
    connectionHandlers = { h: {} as Record<string, Handler> };
    get_isLeaving() {
      return false;
    }
    addMessageHandler(type: string, callback: Handler) {
      this.connectionHandlers.h[type] = callback;
      this.connection.addMessageHandler(type, callback);
    }
    removeMessageHandler(type: string, callback: Handler) {
      delete this.connectionHandlers.h[type];
      this.connection.removeMessageHandler(type, callback);
    }
    exit() {}
    dispose() {}
  }
  class Game extends Scene {}
  const cleanups: Array<() => void> = [];
  const hooks = new Hooks((error: unknown) => {
    throw error;
  });
  const hook = (kind: string) => (target: object, name: string, callback: Function) => {
    const remove = hooks.add(target, name, kind, callback);
    cleanups.push(remove);
    return remove;
  };
  const api = {
    cls: (name: string) =>
      name === 'core.scene.SceneBase' ? Scene : name === 'core.scene.Game' ? Game : {},
    around: hook('around'),
    before: hook('before'),
    defer: (cleanup: () => void) => {
      cleanups.push(cleanup);
      return cleanup;
    },
  } as unknown as API;
  bindGameClasses(api);
  installGameMessageHandlers(api);
  return { game: new Game(), dispose: () => cleanups.reverse().forEach((cleanup) => cleanup()) };
}

test('same-type handlers are removed by callback identity, including during dispatch', async () => {
  const f = fixture();
  const received: string[] = [];
  const first = () => received.push('first');
  const second = () => received.push('second');
  try {
    f.game.addMessageHandler('shared', first);
    f.game.addMessageHandler('shared', second);
    f.game.removeMessageHandler('shared', first);
    f.game.connection.dispatch('shared');
    assert.deepEqual(received, ['second']);
    await Promise.resolve();
    assert.equal(f.game.connection.handlers.length, 1);
    f.game.removeMessageHandler('shared', first);
    assert.ok(
      f.game.connectionHandlers.h.shared,
      'repeated stale cleanup preserves the live index',
    );
    f.game.addMessageHandler('shared', first);
    f.game.removeMessageHandler('shared', first);
    assert.ok(f.game.connectionHandlers.h.shared, 'latest surviving handler stays indexed');
    await Promise.resolve();
    f.game.removeMessageHandler('shared', second);
    await Promise.resolve();
    assert.equal(f.game.connection.handlers.length, 0);
    received.length = 0;
    const removeNext = () => {
      received.push('remover');
      f.game.removeMessageHandler('dispatch', second);
    };
    f.game.addMessageHandler('dispatch', removeNext);
    f.game.addMessageHandler('dispatch', second);
    f.game.addMessageHandler('dispatch', first);
    f.game.connection.dispatch('dispatch');
    assert.deepEqual(
      received,
      ['remover', 'first'],
      'removed callback is inert; following callback is not skipped',
    );
    await Promise.resolve();
    assert.equal(f.game.connection.handlers.length, 2);
  } finally {
    f.dispose();
    await Promise.resolve();
  }
});

test('scene exit invalidates queued callbacks immediately and hot unload restores live callbacks once', async () => {
  const f = fixture();
  let calls = 0;
  const first = () => {
    calls++;
  };
  const second = () => {
    calls += 10;
  };
  f.game.addMessageHandler('shared', first);
  f.game.addMessageHandler('shared', second);
  f.dispose();
  f.game.connection.dispatch('shared');
  assert.equal(calls, 11);
  await Promise.resolve();
  assert.equal(f.game.connection.handlers.length, 2);
  const exited = fixture();
  try {
    exited.game.addMessageHandler('shared', first);
    const queued = exited.game.connection.handlers[0].callback;
    exited.game.exit();
    queued({ type: 'shared' });
    assert.equal(calls, 11);
    await Promise.resolve();
    assert.equal(exited.game.connection.handlers.length, 0);
  } finally {
    exited.dispose();
    await Promise.resolve();
  }
});
