import assert from 'node:assert/strict';
import { test } from 'node:test';
import { NativeIPCClient } from '../src/ipc/NativeIPCClient';
import { ClientIPCService, type IPCSocket } from '../src/ipc/ClientIPCService';
import { ClientIPCAssembler } from '../src/ipc/ClientIPCAssembler';
// @ts-expect-error Exact inspected Haxe boundary.
import { playerIoBoundary } from './fixtures/UpstreamPlayerIo.js';

function fixture() {
  const classes = playerIoBoundary();
  const messages = new Map<string, Function[]>(),
    disconnects: Function[] = [],
    sent: any[] = [];
  let join: any[] = [];
  const sdk = {
    connected: true,
    addMessageCallback(type: string, callback: Function) {
      if (!messages.has(type)) messages.set(type, []);
      messages.get(type)!.push(callback);
    },
    removeMessageCallback(callback: Function) {
      for (const values of messages.values()) {
        const index = values.indexOf(callback);
        if (index >= 0) values.splice(index, 1);
      }
    },
    addDisconnectCallback(callback: Function) {
      disconnects.push(callback);
    },
    removeDisconnectCallback(callback: Function) {
      const index = disconnects.indexOf(callback);
      if (index >= 0) disconnects.splice(index, 1);
    },
    createMessage(type: string) {
      return {
        type,
        fields: [] as unknown[],
        add(value: unknown) {
          this.fields.push(value);
        },
      };
    },
    sendMessage(message: unknown) {
      sent.push(message);
    },
    disconnect() {
      sdk.connected = false;
      for (const callback of disconnects) callback();
    },
  };
  const raw = {
    connectUserId: 'owner',
    multiplayer: new classes.Multiplayer({
      createJoinRoom(...args: any[]) {
        join = args;
        args[5](sdk);
      },
    }),
  };
  const client = new NativeIPCClient(raw);
  const emit = (type: string, fields: unknown[]) => {
    const message = {
      type,
      length: fields.length,
      _internal_: (key: string) => (key === 'get-objects' ? fields : []),
    };
    for (const callback of messages.get(type) ?? []) callback(message);
  };
  return { client, raw, sdk, messages, disconnects, sent, emit, join: () => join };
}

test('native adapter uses actual Haxe socket wrappers, preserves field types, and removes exact handler identities', () => {
  const f = fixture();
  let socket!: IPCSocket;
  f.client.createJoinRoom(
    'Service-1409_24',
    'service',
    false,
    {},
    { client_version: 1409 },
    (value) => {
      socket = value;
    },
    (error) => assert.fail(String(error)),
  );
  assert.deepEqual(f.join().slice(0, 5), [
    'Service-1409_24',
    'service',
    false,
    {},
    { client_version: 1409 },
  ]);
  assert.equal(socket.roomId, 'Service-1409_24');
  assert.equal(socket.connected, true);
  const received: unknown[] = [];
  const handler = (message: any) => {
    received.push(message);
    message.fields.push('mutation');
  };
  socket.addMessageHandler('chatBan', handler);
  socket.addMessageHandler('chatBan', handler);
  const fields = [1, true];
  f.emit('chatBan', fields);
  assert.equal(received.length, 1);
  assert.deepEqual(fields, [1, true]);
  socket.removeMessageHandler('chatBan', handler);
  f.emit('chatBan', fields);
  assert.equal(received.length, 1);
  let disconnected = 0;
  const off = () => {
    disconnected++;
  };
  socket.addDisconnectHandler(off);
  socket.removeDisconnectHandler(off);
  socket.send('chatMsg', 'private', 'Peer', 'ascii-frame');
  assert.deepEqual(f.sent[0].fields, ['private', 'Peer', 'ascii-frame']);
  socket.disconnect();
  assert.equal(disconnected, 0);
  assert.equal(socket.connected, false);
  f.raw.connectUserId = 'replacement';
  assert.equal(f.client.connectUserId, 'replacement');
});

test('service handshakes and sends discovery through actual Haxe Client/Connection/Message ABI offline', (t) => {
  const f = fixture();
  let now = 0;
  const ticks = new Set<() => void>(),
    deferred: Array<() => void> = [];
  ClientIPCService.shutdown();
  t.after(() => {
    ClientIPCService.shutdown();
    for (const callback of deferred) callback();
  });
  const service = ClientIPCService.ensure(f.client, '0.2.0 (Public)', {
    now: () => now,
    random: () => 0.2,
    interval: (callback) => {
      ticks.add(callback);
      return () => {
        ticks.delete(callback);
      };
    },
    defer: (callback) => {
      deferred.push(callback);
    },
    debug() {},
  })!;
  assert.equal(service.connected, false);
  f.emit('joined', ['owner', 1, 'Owner', 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, '', '', '', '', '', '']);
  assert.equal(service.connected, true);
  now = 50;
  for (const tick of ticks) tick();
  assert.equal(f.sent.length, 1);
  assert.equal(f.sent[0].type, 'chatMsg');
  assert.equal(f.sent[0].fields[0], 'local');
  const discovery = new ClientIPCAssembler().accept(
    f.sent[0].fields[1],
    'local',
    'owner',
    'Owner',
    now,
  )!;
  assert.equal(discovery.type, 'qipc3.ipc.hello');
  assert.deepEqual(discovery.fields.slice(4), ['0.2.0', 'Public']);
  f.raw.connectUserId = 'replacement';
  now = 100;
  for (const tick of [...ticks]) tick();
  assert.equal(ClientIPCService.instance, null);
  assert.equal(ticks.size, 0);
  for (const callback of deferred) callback();
  assert.equal(f.sdk.connected, false);
});
