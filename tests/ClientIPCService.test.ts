import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  ClientIPCService,
  type IPCClient,
  type IPCEnvironment,
  type IPCServerMessage,
  type IPCSocket,
} from '../src/ipc/ClientIPCService';
import { ClientIPCAssembler } from '../src/ipc/ClientIPCAssembler';
import { ClientIPCCodec, type IPCMessage } from '../src/ipc/ClientIPCCodec';
import { ClientIPCMessagePack } from '../src/ipc/ClientIPCMessagePack';
import { ClientIPCPolicy } from '../src/ipc/ClientIPCPolicy';

class Socket implements IPCSocket {
  connected = true;
  roomId = ClientIPCService.roomId;
  handlers = new Map<string, Array<(message: IPCServerMessage) => void>>();
  disconnectHandlers: Array<() => void> = [];
  writes: Array<{ at: number; type: string; fields: string[] }> = [];
  constructor(private now: () => number) {}
  addMessageHandler(type: string, handler: (message: IPCServerMessage) => void) {
    if (!this.handlers.has(type)) this.handlers.set(type, []);
    this.handlers.get(type)!.push(handler);
  }
  removeMessageHandler(type: string, handler: (message: IPCServerMessage) => void) {
    const handlers = this.handlers.get(type)!;
    const index = handlers.indexOf(handler);
    if (index >= 0) handlers.splice(index, 1);
  }
  addDisconnectHandler(handler: () => void) {
    this.disconnectHandlers.push(handler);
  }
  removeDisconnectHandler(handler: () => void) {
    const index = this.disconnectHandlers.indexOf(handler);
    if (index >= 0) this.disconnectHandlers.splice(index, 1);
  }
  send(type: string, ...fields: string[]) {
    this.writes.push({ at: this.now(), type, fields });
  }
  disconnect() {
    this.connected = false;
    for (const handler of this.disconnectHandlers) handler();
  }
  emit(type: string, fields: unknown[]) {
    // Match PlayerIO's live handler arrays to exercise deferred detach.
    for (const handler of this.handlers.get(type) ?? []) handler({ type, fields });
  }
}
function fixture(t: { after(fn: () => void): void }) {
  ClientIPCService.shutdown();
  let now = 0,
    wireId = 1000;
  const ticks = new Set<() => void>(),
    deferred: Array<() => void> = [],
    debug: string[] = [];
  const environment: IPCEnvironment = {
    now: () => now,
    random: () => 0.3,
    interval: (callback) => {
      ticks.add(callback);
      return () => {
        ticks.delete(callback);
      };
    },
    defer: (callback) => {
      deferred.push(callback);
    },
    debug: (text) => {
      debug.push(text);
    },
  };
  const requests: Array<{
    args: unknown[];
    success: (socket: IPCSocket) => void;
    failure: (error: unknown) => void;
  }> = [];
  const client: IPCClient & { connectUserId: string } = {
    connectUserId: 'owner',
    createJoinRoom: (room, type, visible, roomData, joinData, success, failure) => {
      requests.push({ args: [room, type, visible, roomData, joinData], success, failure });
    },
  };
  const service = ClientIPCService.ensure(client, '1.1.6 (Private)', environment)!;
  const flush = () => {
    while (deferred.length) deferred.shift()!();
  };
  const advance = (ms: number) => {
    const end = now + ms;
    while (now < end) {
      now = Math.min(end, now + 50);
      for (const tick of [...ticks]) tick();
      flush();
    }
  };
  const handshake = (): unknown[] => [
    'owner',
    1,
    'Owner',
    1,
    1,
    1,
    1,
    1,
    1,
    1,
    1,
    1,
    1,
    '',
    '',
    '',
    '',
    '',
    '',
  ];
  const connect = () => {
    const socket = new Socket(() => now);
    requests.at(-1)!.success(socket);
    socket.emit('joined', handshake());
    return socket;
  };
  const receive = (
    socket: Socket,
    message: IPCMessage,
    channel = 'local',
    sender = 'peer',
    name = 'Peer',
  ) => {
    const frames = ClientIPCCodec.frames(message, (wireId++).toString(16).padStart(12, '0'));
    for (const frame of frames) socket.emit('chatMsg', [channel, frame, sender, name, 0, 0]);
  };
  const hello = (
    socket: Socket,
    session = 'aaaaaaaaaaaa',
    token = 'bbbbbbbbbbbb',
    sender = 'peer',
    name = 'Peer',
    login = 'cccccccccccc',
  ) =>
    receive(
      socket,
      { type: 'qipc3.ipc.hello', fields: [4, session, token, login, '1.1.6', 'Private'] },
      'local',
      sender,
      name,
    );
  t.after(() => {
    ClientIPCService.shutdown();
    flush();
  });
  return {
    service,
    client,
    requests,
    connect,
    hello,
    receive,
    advance,
    handshake,
    flush,
    ticks,
    debug,
    now: () => now,
    socket: () => new Socket(() => now),
  };
}
function decoded(socket: Socket): IPCMessage[] {
  const assembler = new ClientIPCAssembler();
  const result: IPCMessage[] = [];
  for (const write of socket.writes) {
    const message = assembler.accept(
      write.fields.at(-1)!,
      write.fields[0],
      'owner',
      'Owner',
      write.at,
    );
    if (message)
      result.push(
        ...(message.type === ClientIPCMessagePack.type
          ? ClientIPCMessagePack.decode(message)!
          : [message]),
      );
  }
  return result;
}

test('IPC owns a hidden room and validates joined before discovery, preserving login across reconnect', (t) => {
  const f = fixture(t);
  assert.deepEqual(f.requests[0].args, [
    'Service-1409_24',
    'service',
    false,
    {},
    { client_version: 1409 },
  ]);
  assert.equal(f.service.connected, false);
  const login = f.service.loginId;
  const socket = f.connect();
  const session = f.service.sessionId;
  assert.equal(f.service.connected, true);
  socket.emit('joined', f.handshake());
  assert.equal(f.service.sessionId, session);
  f.advance(50);
  assert.deepEqual(decoded(socket)[0], {
    type: 'qipc3.ipc.hello',
    fields: [4, session, decoded(socket)[0].fields[2], login, '1.1.6', 'Private'],
  });
  socket.disconnect();
  assert.equal(f.service.connected, false);
  f.advance(1000);
  const next = f.connect();
  assert.equal(f.requests.length, 2);
  assert.equal(f.requests[1].args[2], false);
  assert.equal(f.service.loginId, login);
  assert.notEqual(f.service.sessionId, session);
  assert.equal(socket.handlers.get('joined')!.length, 0);
  assert.equal(next.connected, true);
});

test('join timeout and wrong handshakes invalidate stale callbacks and back off', (t) => {
  const f = fixture(t);
  f.advance(8000);
  const late = f.socket();
  f.requests[0].success(late);
  assert.equal(late.connected, false);
  f.advance(1000);
  const wrong = f.socket();
  f.requests[1].success(wrong);
  const invalid = f.handshake();
  invalid[0] = 'other';
  wrong.emit('joined', invalid);
  assert.equal(f.service.connected, false);
  f.flush();
  assert.equal(wrong.connected, false);
  f.advance(1950);
  assert.equal(f.requests.length, 2);
  f.advance(50);
  assert.equal(f.requests.length, 3);
  assert.equal(f.connect().connected, true);
  const fields = f.handshake();
  fields[1] = 2147483648;
  assert.equal(ClientIPCPolicy.validHandshake(fields, 'owner'), false);
});

test('peer notification waits for ACK write; wire identity, session metadata and retired sessions are authoritative', (t) => {
  const f = fixture(t),
    socket = f.connect();
  const events: string[] = [];
  f.service.addPeerHandler((id, name) => {
    events.push(`${id}:${name}`);
  });
  f.hello(socket);
  assert.equal(f.service.peerLoginInfo('peer'), null);
  f.advance(50);
  assert.deepEqual(events, []); // Local hello first.
  f.advance(200);
  assert.deepEqual(events, ['peer:Peer']);
  assert.equal(f.service.peerLoginInfo('peer')?.loginId, 'cccccccccccc');
  const acknowledgment = decoded(socket).find((message) => message.type === 'qipc3.ipc.helloAck')!;
  assert.equal(acknowledgment.fields[1], 'bbbbbbbbbbbb');
  f.hello(socket, 'aaaaaaaaaaaa', 'bbbbbbbbbbbb', 'peer', 'Peer', 'dddddddddddd');
  assert.equal(f.service.peerLoginInfo('peer')?.loginId, 'cccccccccccc');
  f.hello(socket, 'eeeeeeeeeeee', 'ffffffffffff', 'peer', 'Renamed');
  f.advance(200);
  assert.deepEqual(events, ['peer:Peer', 'peer:Renamed']);
  f.hello(socket); // Retired session cannot roll back a reconnect.
  assert.equal(f.service.peerSessionId('peer'), 'eeeeeeeeeeee');
});

test('private helloAck must answer a sent unexpired discovery token', (t) => {
  const f = fixture(t),
    socket = f.connect();
  const ack = (token: string) => ({
    type: 'qipc3.ipc.helloAck',
    fields: [4, token, 'aaaaaaaaaaaa', 'cccccccccccc', '1.1.6', 'Public'],
  });
  f.receive(socket, ack('000000000000'), 'private');
  assert.deepEqual(f.service.onlinePlayers, []);
  f.advance(50);
  const token = decoded(socket)[0].fields[2] as string;
  f.receive(socket, ack(token), 'local');
  assert.deepEqual(f.service.onlinePlayers, []);
  f.receive(socket, ack(token), 'private');
  assert.equal(f.service.peerLoginInfo('peer')?.build, 'Public');
});

test('dispatch uses authenticated envelope and rejects an entire mixed-channel pack before any callback', (t) => {
  const f = fixture(t),
    socket = f.connect();
  const calls: unknown[] = [];
  const handler = (message: IPCMessage, id: string, name: string) => {
    calls.push([message, id, name]);
  };
  f.service.addMessageHandler('qipc3.chat.qolaf', handler);
  const chat: IPCMessage = { type: 'qipc3.chat.qolaf', fields: ['hello'] };
  f.receive(socket, chat);
  assert.equal(calls.length, 0);
  f.hello(socket);
  f.advance(250);
  f.receive(socket, chat, 'private');
  assert.equal(calls.length, 0);
  f.receive(socket, chat, 'local', 'owner', 'Claimed');
  assert.equal(calls.length, 0);
  const pack = ClientIPCMessagePack.create([
    ClientIPCCodec.serialize(chat),
    ClientIPCCodec.serialize({ type: 'qipc3.room.request', fields: [] }),
  ]);
  f.receive(socket, pack);
  assert.equal(calls.length, 0);
  f.receive(socket, chat, 'local', 'peer', 'Renamed');
  assert.deepEqual(calls, [[chat, 'peer', 'Renamed']]);
  assert.equal(f.service.findPeer('@renamed')?.id, 'peer');
  f.service.removeMessageHandler('qipc3.chat.qolaf', handler);
  f.receive(socket, chat);
  assert.equal(calls.length, 1);
});

test('handler mutation and authentication disposal stop stale dispatch and remove SDK handlers after dispatch', (t) => {
  const f = fixture(t),
    socket = f.connect();
  f.hello(socket);
  f.advance(250);
  let later = 0,
    disposed = 0,
    sentinel = 0;
  f.service.addDisposeHandler(() => {
    disposed++;
  });
  f.service.addMessageHandler('qipc3.chat.qolaf', () => {
    ClientIPCService.shutdown();
  });
  f.service.addMessageHandler('qipc3.chat.qolaf', () => {
    later++;
  });
  socket.addMessageHandler('chatMsg', () => {
    sentinel++;
  });
  f.receive(socket, { type: 'qipc3.chat.qolaf', fields: ['hello'] });
  assert.equal(later, 0);
  assert.equal(disposed, 1);
  assert.equal(sentinel, 1);
  assert.equal(f.ticks.size, 0);
  f.flush();
  assert.equal(socket.connected, false);
  assert.equal(socket.handlers.get('chatMsg')!.length, 1);
  assert.equal(decoded(socket).filter((message) => message.type === 'qipc3.ipc.bye').length, 1);
  f.service.dispose();
  assert.equal(disposed, 1);
});

test('presence is session-bound, cannot create peers, and expires inactive peers', (t) => {
  const f = fixture(t),
    socket = f.connect();
  const presence = (session = 'aaaaaaaaaaaa') => ({
    type: 'qipc3.ipc.presence',
    fields: [session, 'cccccccccccc'],
  });
  f.receive(socket, presence());
  assert.deepEqual(f.service.onlinePlayers, []);
  f.hello(socket);
  f.advance(250);
  f.advance(100000);
  f.receive(socket, presence('dddddddddddd')); // Stale heartbeat cannot extend life.
  f.advance(51000);
  assert.equal(f.service.peerSessionId('peer'), null);
  f.hello(socket);
  f.advance(250);
  f.receive(socket, { type: 'qipc3.ipc.bye', fields: ['aaaaaaaaaaaa', 'cccccccccccc'] });
  assert.equal(f.service.peerSessionId('peer'), null);
  const messages = decoded(socket);
  assert.equal(messages.filter((message) => message.type === 'qipc3.ipc.hello').length, 3);
  assert.ok(messages.some((message) => message.type === 'qipc3.ipc.presence'));
});

test('server restrictions fail queued sends, duplicate login stops reconnects, and kick delays retry', (t) => {
  const f = fixture(t),
    socket = f.connect();
  const errors: string[] = [];
  assert.equal(
    f.service.broadcast(
      { type: 'qipc3.chat.qolaf', fields: ['test'] },
      { onError: (reason) => errors.push(reason) },
    ),
    true,
  );
  socket.emit('chatBan', [1, true]);
  assert.equal(errors.length, 1);
  assert.equal(f.service.paused, true);
  f.advance(5000);
  assert.equal(socket.writes.length, 0);
  socket.emit('chatBan', [0, false]);
  assert.equal(f.service.paused, false);
  socket.emit('kicked', []);
  f.advance(59950);
  assert.equal(f.requests.length, 1);
  f.advance(50);
  assert.equal(f.requests.length, 2);
  const next = f.connect();
  next.emit('duplicateLogin', []);
  assert.equal(ClientIPCService.instance, null);
  f.advance(100000);
  assert.equal(f.requests.length, 2);
});

test('missing-player notice cannot evict a peer after newer authenticated liveness', (t) => {
  const f = fixture(t),
    socket = f.connect();
  f.hello(socket);
  f.advance(250);
  f.service.send('peer', { type: 'qipc3.test', fields: [] });
  f.advance(200);
  f.receive(socket, { type: 'qipc3.ipc.presence', fields: ['aaaaaaaaaaaa', 'cccccccccccc'] });
  socket.emit('clientPrintMsg', ['Player Peer is not on the system.']);
  assert.equal(f.service.findPeer('peer')?.id, 'peer');
  f.service.send('peer', { type: 'qipc3.test', fields: [] });
  f.advance(200);
  socket.emit('clientPrintMsg', ['Player Peer is not on the system.']);
  assert.equal(f.service.findPeer('peer'), null);
});

test('allowlists keep public human chat and private room controls on their source channels', () => {
  assert.equal(ClientIPCPolicy.applicationAllowed('qipc3.chat.qolaf', 'private'), false);
  assert.equal(ClientIPCPolicy.applicationAllowed('qipc3.room.request', 'local'), false);
  assert.equal(ClientIPCPolicy.applicationAllowed('qipc3.radio.discover', 'local'), true);
  assert.equal(ClientIPCPolicy.applicationAllowed('qipc3.radio.discover', 'private'), false);
  assert.equal(ClientIPCPolicy.applicationAllowed('qipc3.radio.control', 'local'), false);
  assert.equal(ClientIPCPolicy.applicationAllowed('qipc3.radio.control', 'private'), true);
  assert.equal(ClientIPCPolicy.applicationAllowed('qipc3.ipc.hello', 'local'), false);
  assert.equal(ClientIPCPolicy.validVersion('1.1.6\n'), false);
});
