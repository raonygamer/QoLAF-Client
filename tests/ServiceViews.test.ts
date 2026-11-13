import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { API } from '../src/api/Types';
import { bindGameClasses } from '../src/game/Bindings';
import { installServiceViews } from '../src/service/ServiceViews';
// @ts-expect-error actual host dispatcher
import { Hooks } from './fixtures/HostCore.js';

test('friend refresh coalesces consumers, retries failures and releases pending ownership on unload', () => {
  class Friends {
    onlineFriendsCallbacks: Array<() => void> = [];
    onlineFriendsTimer = null;
    sent = 0;
    connected = true;
    fail = false;
    g = {
      serviceConnection: { get_connected: () => this.connected },
      sendToServiceRoom: () => {
        if (this.fail) throw new Error('disconnected');
        this.sent++;
      },
    };
    updateOnlineFriends(_callback: (() => void) | null) {}
    onOnlineFriends() {
      const callbacks = this.onlineFriendsCallbacks;
      this.onlineFriendsCallbacks = [];
      callbacks.forEach((callback) => callback());
    }
  }
  class QueueManager {
    handleQueueInfo() {}
  }
  class QueueInfo {
    update() {}
    getTimeout() {}
    createAcceptPopup() {}
  }
  class Scene {
    handleServiceDisconnect() {}
    exit() {}
    dispose() {}
  }
  const classes: Record<string, unknown> = {
    'core.friend.FriendManager': Friends,
    'core.scene.Game': Scene,
    'core.queue.QueueManager': QueueManager,
    'core.queue.QueueInfoHolder': QueueInfo,
  };
  const cleanup: Array<() => void> = [];
  const hooks = new Hooks((error: unknown) => {
    throw error;
  });
  const register = (kind: string) => (owner: object, key: string, fn: unknown) => {
    const off = hooks.add(owner, key, kind, fn);
    cleanup.push(off);
    return off;
  };
  const api = {
    cls: (name: string) => classes[name] ?? {},
    around: register('around'),
    before: register('before'),
    defer: (off: () => void) => cleanup.push(off),
  } as unknown as API;
  bindGameClasses(api);
  installServiceViews(api);
  const friends = new Friends();
  let calls = 0;
  const first = () => calls++;
  friends.updateOnlineFriends(first);
  friends.updateOnlineFriends(first);
  friends.updateOnlineFriends(() => calls++);
  assert.equal(friends.sent, 1);
  friends.onOnlineFriends();
  assert.equal(calls, 2);
  friends.connected = false;
  friends.updateOnlineFriends(first);
  assert.equal(friends.sent, 1);
  friends.connected = true;
  friends.updateOnlineFriends(null);
  assert.equal(friends.sent, 2);
  friends.onOnlineFriends();
  assert.equal(calls, 3);
  friends.fail = true;
  assert.throws(() => friends.updateOnlineFriends(first), /disconnected/);
  assert.equal(friends.onlineFriendsCallbacks.length, 0);
  friends.fail = false;
  friends.updateOnlineFriends(null);
  assert.equal(friends.sent, 3);
  cleanup
    .splice(0)
    .reverse()
    .forEach((off) => off());
  friends.onOnlineFriends(); // Response while disabled cannot reach our hook.
  installServiceViews(api);
  friends.updateOnlineFriends(first);
  assert.equal(friends.sent, 4, 'reenabling must not retain stale pending ownership');
  friends.onOnlineFriends();
  assert.equal(calls, 4);
  cleanup.reverse().forEach((off) => off());
});
