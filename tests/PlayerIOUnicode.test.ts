import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { API } from '../src/api/Types';
import { installPlayerIOUnicode } from '../src/network/PlayerIOUnicode';
// @ts-expect-error captured upstream SDK
import { bytesFromString, stringFromBytes } from './fixtures/PlayerIOUnicode.js';
// @ts-expect-error production host dispatcher
import { Hooks } from './fixtures/HostCore.js';

test('SDK encoding preserves original emoji chat payloads and restores on unload', () => {
  const serializer = { bytesFromString: bytesFromString as (value: string) => number[] };
  assert.throws(() => serializer.bytesFromString('😀'), URIError);
  const hooks = new Hooks((error: unknown) => {
    throw error;
  });
  const cleanup: Array<() => void> = [];
  const api = {
    around(owner: object, method: string, callback: unknown) {
      const off = hooks.add(owner, method, 'around', callback);
      cleanup.push(off);
      return off;
    },
  } as unknown as API;
  installPlayerIOUnicode(api, serializer);
  try {
    for (const message of [
      '',
      'ordinary 100% chat',
      'ação 日本語',
      '😀',
      '👩🏽‍🚀',
      '🇧🇷',
      '<font color="#ff0000">hello 😀</font>',
      'x'.repeat(255) + '😀',
    ]) {
      const bytes = serializer.bytesFromString(message);
      assert.equal(stringFromBytes(bytes, 0, bytes.length), message);
      if (!/[\uD800-\uDFFF]/.test(message)) assert.deepEqual(bytes, bytesFromString(message));
    }
    assert.deepEqual(serializer.bytesFromString('😀'), [0xf0, 0x9f, 0x98, 0x80]);
    assert.deepEqual(serializer.bytesFromString('\ud800'), [0xef, 0xbf, 0xbd]);
  } finally {
    cleanup.reverse().forEach((off) => off());
  }
  assert.equal(serializer.bytesFromString, bytesFromString);
});

test('actual PlayerIO message framing round-trips Unicode with adjacent typed values', async () => {
  // @ts-expect-error captured SDK codec, without a network transport
  const { createCodec } = await import('./fixtures/PlayerIOCodec.js');
  const sdk = createCodec();
  const hooks = new Hooks((error: unknown) => {
    throw error;
  });
  const cleanups: Array<() => void> = [];
  installPlayerIOUnicode(
    {
      around(owner: object, method: string, callback: unknown) {
        const off = hooks.add(owner, method, 'around', callback);
        cleanups.push(off);
        return off;
      },
    } as unknown as API,
    sdk.binaryserializer,
  );
  try {
    const codec = new sdk.messageSerializer();
    for (const text of ['😀', '👩🏽‍🚀 hello 🇧🇷', 'x'.repeat(255) + '😀']) {
      const outgoing = new sdk.message('chatMsg');
      outgoing.addString('local');
      outgoing.addString(text);
      outgoing.addInt(12345);
      outgoing.addBoolean(true);
      const bytes = codec.serializeMessage(outgoing);
      const incoming = codec.deserializeMessage(bytes, 0, bytes.length);
      assert.equal(incoming.type, 'chatMsg');
      assert.equal(incoming.getString(0), 'local');
      assert.equal(incoming.getString(1), text);
      assert.equal(incoming.getInt(2), 12345);
      assert.equal(incoming.getBoolean(3), true);
    }
  } finally {
    cleanups.reverse().forEach((off) => off());
  }
});
