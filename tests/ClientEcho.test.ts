import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { API } from '../src/api/Types';
import { bindGameClasses, type GameScene } from '../src/game/Bindings';
import { ClientIPCEcho, type ClientEchoEvent } from '../src/ipc/ClientIPCEcho';
import { runClientEcho } from '../src/chat/ClientEcho';

test('echo results follow room refreshes, bound encoded names, and reject stale account replies', () => {
  const writes: Array<[string, string | undefined]> = [];
  const log = { write: (text: string, kind?: string) => writes.push([text, kind]) };
  const client = { connectUserId: 'account' };
  const scene = (owner = client) =>
    ({
      client: owner,
      messageLog: {},
      get_isLeaving: () => false,
    }) as unknown as GameScene;
  const game = scene();
  const api = {
    game,
    cls: (name: string) => (name === 'core.hud.components.chat.MessageLog' ? log : {}),
  } as unknown as API;
  bindGameClasses(api);
  let report: (event: ClientEchoEvent) => void = () => assert.fail('No request installed');
  const transport = {
    request: (callback: typeof report) => {
      report = callback;
    },
  };
  const descriptor = Object.getOwnPropertyDescriptor(ClientIPCEcho, 'instance')!;
  Object.defineProperty(ClientIPCEcho, 'instance', { configurable: true, get: () => transport });
  const reply: ClientEchoEvent = {
    kind: 'reply',
    id: 'peer',
    name: '[error]' + '&'.repeat(100),
    version: '1.2.0 TS',
    build: 'Public',
    gameProtocol: 561,
    compatibility: 1,
    packetVersion: 3,
    discoverySchema: 1,
    elapsedMs: 12,
  };
  try {
    runClientEcho(api, game);
    report({ kind: 'start', expected: 1 });
    assert.equal(writes[0][0], 'Checking QoLAF clients over IPC...');
    Object.assign(api, { game: scene() });
    report(reply);
    assert.equal(writes.length, 2, 'same authenticated client can receive after /ref');
    assert.equal(
      writes[1][0],
      "<font color='#9B5CFF'>&#91;error&#93;" +
        '&amp;'.repeat(33) +
        '... - QoLAF (Server 561 / v1.2.0 TS (Public))</font>',
    );
    report({ kind: 'end', count: 1 });
    report({ kind: 'error', message: 'Transport unavailable' });
    assert.deepEqual(writes.slice(2), [
      ['Client check finished: 1 replies.', undefined],
      ['Transport unavailable', 'error'],
    ]);
    for (const next of [
      null,
      scene({ connectUserId: 'account' }),
      { ...scene(), get_isLeaving: () => true },
      { ...scene(), messageLog: null },
    ]) {
      Object.assign(api, { game: next });
      report(reply);
      assert.equal(writes.length, 4);
    }
    Object.assign(api, { game: scene() });
    client.connectUserId = 'another-account';
    report(reply);
    assert.equal(writes.length, 4, 'same client object with changed account is rejected');
    Object.defineProperty(ClientIPCEcho, 'instance', { configurable: true, get: () => null });
    runClientEcho(api, game);
    assert.deepEqual(writes.at(-1), ['Client IPC is not ready.', 'error']);
  } finally {
    Object.defineProperty(ClientIPCEcho, 'instance', descriptor);
  }
});
