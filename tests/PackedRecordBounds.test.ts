import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { API } from '../src/api/Types';
import type { Game } from '../src/game/Game';
import { bindGameClasses } from '../src/game/Bindings';
import { PackedRecordBounds } from '../src/network/PackedRecordBounds';
// @ts-expect-error actual host dispatcher
import { Hooks } from './fixtures/HostCore.js';

test('packet bounds isolate adjacent records and restore nested dispatch even after failure', () => {
  let inspect: (message: Game.playerio.Message) => void = () => {};
  class Dispatcher {
    handleMessagePack(message: Game.playerio.Message) {
      inspect(message);
    }
  }
  const hooks = new Hooks((error: unknown) => {
    throw error;
  });
  const cleanups: Array<() => void> = [];
  const api = {
    cls: (name: string) => (name === 'core.sync.MessagePackHandler' ? Dispatcher : {}),
    around(owner: object, key: string, callback: Function) {
      const off = hooks.add(owner, key, 'around', callback);
      cleanups.push(off);
      return off;
    },
  } as unknown as API;
  bindGameClasses(api);
  const bounds = new PackedRecordBounds(api);
  const packet = (values: number[]): Game.playerio.Message =>
    ({
      length: values.length,
      getInt: (index: number) => {
        if (index >= values.length) throw new RangeError('packet end');
        return values[index];
      },
    }) as Game.playerio.Message;
  const message = packet([0, 5, 42, 0, 1, 0, 6, 43, 0, 1, 99]);
  const dispatcher = new Dispatcher();
  try {
    inspect = (current) => {
      assert.equal(bounds.end(current, 2), 5, 'no target in first fire record');
      assert.equal(bounds.end(current, 7), 11, 'target belongs to second record');
      assert.equal(bounds.end(current, 3), 3, 'unknown payload offset is unreadable');
      inspect = () => {
        throw new Error('nested failure');
      };
      assert.throws(() => dispatcher.handleMessagePack(current), /nested failure/);
      assert.equal(bounds.end(current, 2), 5, 'outer boundaries survive nested dispatch');
    };
    dispatcher.handleMessagePack(message);
    assert.equal(bounds.end(message, 2), 11, 'standalone message after dispatch');
    assert.equal(bounds.end(message, 2, 5), 5);
    assert.equal(bounds.end(message, 2, 100), 11);
    for (const length of [0, 1, -1, 1.5, NaN, 99]) {
      const malformed = packet([0, length, 42, 0, 1]);
      inspect = (current) => assert.equal(bounds.end(current, 2), 2);
      dispatcher.handleMessagePack(malformed);
    }
  } finally {
    cleanups.reverse().forEach((off) => off());
  }
});
