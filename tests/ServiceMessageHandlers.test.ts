import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { API } from '../src/api/Types';
import { bindGameClasses } from '../src/game/Bindings';
import { installServiceMessageHandlers } from '../src/network/ServiceMessageHandlers';
// @ts-expect-error real host hook dispatcher
import { Hooks } from './fixtures/HostCore.js';

type Handler = (message: { type: string }) => void;
function fixture() {
  class Connection {
    handlers: Array<{ type: string; callback: Handler }> = [];
    constructor(readonly id: string) {}
    get_connected() {
      return true;
    }
    get_roomId() {
      return this.id;
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
      for (const entry of this.handlers) if (entry.type === type) entry.callback({ type });
    }
  }
  class Scene {
    serviceConnection = new Connection('first');
    serviceRoomId = 'first';
    serviceHandlers = { h: {} as Record<string, Handler> };
    get_isLeaving() {
      return false;
    }
    addServiceMessageHandler(type: string, callback: Handler) {
      this.serviceHandlers.h[type] = callback;
      this.serviceConnection.addMessageHandler(type, callback);
    }
    removeServiceMessageHandler(type: string, callback: Handler) {
      delete this.serviceHandlers.h[type];
      this.serviceConnection.removeMessageHandler(type, callback);
    }
    replaceServiceConnection(connection: Connection) {
      this.serviceConnection = connection;
      for (const [type, callback] of Object.entries(this.serviceHandlers.h))
        connection.addMessageHandler(type, callback);
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
  installServiceMessageHandlers(api);
  return {
    scene: new Scene(),
    Connection,
    dispose: () => cleanups.reverse().forEach((cleanup) => cleanup()),
  };
}

test('stale Service cleanup preserves its replacement across reconnect and unload', async () => {
  const f = fixture();
  const received: string[] = [];
  const old = () => received.push('old');
  const current = () => received.push('current');
  try {
    f.scene.addServiceMessageHandler('roster', old);
    f.scene.addServiceMessageHandler('roster', current);
    f.scene.removeServiceMessageHandler('roster', old);
    f.scene.serviceConnection.dispatch('roster');
    assert.deepEqual(received, ['current']);
    assert.ok(
      f.scene.serviceHandlers.h.roster,
      'native removal cannot delete replacement bookkeeping',
    );
    const previousConnection = f.scene.serviceConnection;
    const replacement = new f.Connection('second');
    f.scene.replaceServiceConnection(replacement);
    previousConnection.dispatch('roster');
    replacement.dispatch('roster');
    assert.deepEqual(received, ['current', 'current']);
    await Promise.resolve();
    assert.equal(previousConnection.handlers.length, 0);
    f.dispose();
    replacement.dispatch('roster');
    assert.deepEqual(received, ['current', 'current', 'current']);
    await Promise.resolve();
    assert.equal(replacement.handlers.length, 1);
    assert.equal(replacement.handlers[0].callback, current);
  } finally {
    f.dispose();
    await Promise.resolve();
  }
});

test('removing the current Service callback invalidates queued dispatch immediately', async () => {
  const f = fixture();
  let calls = 0;
  const handler = () => {
    calls++;
  };
  try {
    f.scene.addServiceMessageHandler('roster', handler);
    const queued = f.scene.serviceConnection.handlers[0].callback;
    f.scene.removeServiceMessageHandler('roster', handler);
    queued({ type: 'roster' });
    assert.equal(calls, 0);
    assert.equal(f.scene.serviceHandlers.h.roster, undefined);
    await Promise.resolve();
    assert.equal(f.scene.serviceConnection.handlers.length, 0);
  } finally {
    f.dispose();
    await Promise.resolve();
  }
});
