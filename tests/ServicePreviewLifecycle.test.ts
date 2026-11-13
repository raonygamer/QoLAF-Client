import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { API } from '../src/api/Types';
import { bindGameClasses, type Connection, type Message } from '../src/game/Bindings';
import { installServicePreviewLifecycle } from '../src/service/ServicePreviewLifecycle';
import { Socket } from './fixtures/ServiceRoom';
// @ts-expect-error actual host hook dispatcher
import { Hooks } from './fixtures/HostCore.js';

test('preview disposal closes sockets and rejects pending joins and stale messages', () => {
  const hooks = new Hooks((error: unknown) => {
    throw error;
  });
  const cleanups: Array<() => void> = [];
  const requests: Array<{
    success: (connection: Connection) => void;
    failure: (error: Error) => void;
  }> = [];
  const multiplayer = {
    joinRoom(
      _id: string,
      _data: object,
      success: (connection: Connection) => void,
      failure: (error: Error) => void,
    ) {
      requests.push({ success, failure });
    },
  };
  let killedTweens = 0;
  class Preview {
    connection: Connection | null = null;
    errors = 0;
    updates = 0;
    disposals = 0;
    friends = {
      set_text: (_text: string) => {
        this.errors++;
      },
      set_color() {},
    };
    join() {
      multiplayer.joinRoom(
        'room',
        { client_version: 1413, preview: 'true' },
        (socket) => this.joined(socket),
        () => {
          this.errors++;
        },
      );
    }
    joined(_connection: Connection) {
      throw new Error('native joined must be replaced');
    }
    onPreview(_message: Message) {
      this.updates++;
    }
    onOnlineFriends(_message: Message) {
      this.updates++;
    }
    dispose() {
      this.disposals++;
    }
  }
  const api = {
    cls: (name: string) =>
      name === 'core.login.ServiceRoomPreview'
        ? Preview
        : name === 'Login'
          ? { client: { multiplayer } }
          : name === 'com.greensock.TweenMax'
            ? {
                killTweensOf: () => {
                  killedTweens++;
                },
              }
            : {},
    around: (target: object, key: string, callback: unknown) => {
      const cleanup = hooks.add(target, key, 'around', callback);
      cleanups.push(cleanup);
      return cleanup;
    },
    defer: (cleanup: () => void) => cleanups.push(cleanup),
  } as unknown as API;
  bindGameClasses(api);
  installServicePreviewLifecycle(api);
  try {
    const preview = new Preview();
    preview.join();
    const socket = new Socket('room');
    requests[0].success(socket);
    const stalePreview = socket.messages.get('preview')![0];
    const staleError = socket.messages.get('error')![0];
    socket.emit({ type: 'preview' });
    socket.emit({ type: 'onlineFriends' });
    socket.emit({ type: 'error', getString: () => 'failure' });
    assert.equal(preview.updates, 2);
    assert.equal(preview.errors, 1);
    preview.joined(socket);
    assert.equal(socket.messages.get('preview')!.length, 1, 'duplicate ready does not reconnect');
    preview.dispose();
    preview.dispose();
    assert.equal(preview.disposals, 1);
    assert.equal(killedTweens, 1);
    assert.equal(socket.disconnects, 1);
    assert.equal(preview.connection, null);
    assert.ok([...socket.messages.values()].every((handlers) => handlers.length === 0));
    stalePreview({});
    staleError({ getString: () => 'late' });
    assert.equal(preview.updates, 2);
    assert.equal(preview.errors, 1);
    const pending = new Preview();
    pending.join();
    pending.dispose();
    const late = new Socket('room');
    requests[1].success(late);
    requests[1].failure(new Error('late failure'));
    assert.equal(late.disconnects, 1);
    assert.equal(pending.errors, 0);
    const unloading = new Preview();
    unloading.join();
    cleanups.reverse().forEach((cleanup) => cleanup());
    cleanups.length = 0;
    const afterUnload = new Socket('room');
    requests[2].success(afterUnload);
    assert.equal(afterUnload.disconnects, 1, 'pending callback remains retired after hooks unload');
    const restored = new Preview();
    restored.dispose();
    restored.dispose();
    assert.equal(restored.disposals, 2);
  } finally {
    cleanups.reverse().forEach((cleanup) => cleanup());
  }
});
