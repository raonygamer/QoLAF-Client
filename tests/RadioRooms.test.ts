import assert from 'node:assert/strict';
import test from 'node:test';
import { RadioRooms, type RadioRoomTransport } from '../src/radio/RadioRooms';
import type { IPCMessage } from '../src/ipc/ClientIPCCodec';
import type { IPCSendCallbacks } from '../src/ipc/ClientIPCQueue';
import type { ClientIPCService } from '../src/ipc/ClientIPCService';

// Compile-time contract: the production IPC service needs no replacement transport.
const ipcCompatible: (ipc: ClientIPCService) => RadioRoomTransport = (ipc) => ipc;
void ipcCompatible;

type Handler = (message: IPCMessage, sender: string, name: string) => void;
function network() {
  let time = 0;
  const peers = new Map<string, { rooms: RadioRooms; socket: Socket }>();
  const pending: (() => void)[] = [];
  class Socket implements RadioRoomTransport {
    connected = true;
    paused = false;
    sessionId: string;
    handlers = new Map<string, Set<Handler>>();
    disposals = new Set<() => void>();
    constructor(readonly id: string) {
      this.sessionId = id + '-session';
    }
    ownLoginInfo() {
      return { id: this.id, name: this.id };
    }
    peerSessionId(id: string) {
      const peer = peers.get(id);
      return peer?.socket.connected ? peer.socket.sessionId : null;
    }
    addMessageHandler(type: string, handler: Handler) {
      if (!this.handlers.has(type)) this.handlers.set(type, new Set());
      this.handlers.get(type)!.add(handler);
    }
    removeMessageHandler(type: string, handler: Handler) {
      this.handlers.get(type)?.delete(handler);
    }
    addDisposeHandler(handler: () => void) {
      this.disposals.add(handler);
    }
    removeDisposeHandler(handler: () => void) {
      this.disposals.delete(handler);
    }
    send(target: string, message: IPCMessage, callbacks: IPCSendCallbacks) {
      return this.enqueue(target, message, callbacks);
    }
    broadcast(message: IPCMessage, callbacks: IPCSendCallbacks) {
      return this.enqueue(null, message, callbacks);
    }
    private enqueue(
      target: string | null,
      message: IPCMessage,
      callbacks: IPCSendCallbacks,
    ): boolean {
      pending.push(() => {
        const prepared = callbacks.beforeSend ? callbacks.beforeSend() : message;
        if (!prepared) {
          callbacks.onError?.('stale');
          return;
        }
        callbacks.onSent?.();
        for (const [id, peer] of peers) {
          if (id === this.id || !peer.socket.connected || (target !== null && id !== target))
            continue;
          for (const handler of peer.socket.handlers.get(prepared.type) ?? [])
            handler({ ...prepared, fields: [...prepared.fields] }, this.id, this.id);
        }
      });
      return true;
    }
  }
  function add(id: string) {
    const socket = new Socket(id),
      rooms = new RadioRooms(
        () => time,
        () => 0.5,
      );
    peers.set(id, { socket, rooms });
    rooms.tick(socket, 100000 + time);
    return { socket, rooms };
  }
  function step(ms = 200) {
    time += ms;
    for (const peer of peers.values()) peer.rooms.tick(peer.socket, 100000 + time);
    let count = 0;
    while (pending.length) {
      assert.ok(++count < 1000);
      pending.shift()!();
    }
  }
  function until(predicate: () => boolean, limit = 150) {
    for (let i = 0; i < limit && !predicate(); i++) step();
    assert.equal(predicate(), true, 'condition did not become true');
  }
  return { add, step, until, peers };
}
function joined(password = '') {
  const n = network(),
    host = n.add('host'),
    guest = n.add('guest');
  host.rooms.create('Original radio', password);
  n.until(() => guest.rooms.rooms.length === 1);
  guest.rooms.join('host', guest.rooms.rooms[0].roomId, password);
  n.until(() => guest.rooms.synchronized && host.rooms.peers.length === 2);
  return { n, host, guest };
}

test('coordinator discovers and joins a protected room with non-ASCII password', () => {
  const { host, guest } = joined('café😀');
  assert.equal(guest.rooms.state?.name, 'Original radio');
  assert.deepEqual(
    guest.rooms.peers.map((p) => [p.id, p.role]),
    [
      ['host', 'host'],
      ['guest', 'listener'],
    ],
  );
  assert.equal(guest.rooms.host, false);
  assert.equal(guest.rooms.controller, false);
  assert.ok(host.rooms.invitationKey);
  const state = guest.rooms.state!;
  state.name = 'changed';
  assert.equal(guest.rooms.state?.name, 'Original radio');
});

test('incorrect password rejects the join without creating a host member', () => {
  const n = network(),
    host = n.add('host'),
    guest = n.add('guest');
  host.rooms.create('Protected', 'correct');
  n.until(() => guest.rooms.rooms.length === 1);
  guest.rooms.join('host', guest.rooms.rooms[0].roomId, 'wrong');
  n.until(() => !guest.rooms.joined);
  assert.match(guest.rooms.status, /Incorrect radio group password/);
  assert.equal(host.rooms.peers.length, 1);
});

test('buffer readiness synchronizes a track and DJ controls mutate only after leader receipt', () => {
  const { n, host, guest } = joined();
  host.rooms.enqueueTrack({ videoId: 'AbC_123-xyz', title: 'Track', durationMs: 60000 });
  n.until(() => guest.rooms.state?.queue.length === 1);
  host.rooms.ready('AbC_123-xyz');
  assert.equal(host.rooms.state?.waitingCount, 1);
  guest.rooms.ready('AbC_123-xyz');
  n.until(() => host.rooms.state?.buffering === false && guest.rooms.state?.buffering === false);
  assert.equal(host.rooms.state?.anchorAt, guest.rooms.state?.anchorAt);
  host.rooms.setDJ('guest', 'guest-session', true);
  n.until(() => guest.rooms.controller);
  assert.equal(guest.rooms.control('pause'), true);
  assert.equal(guest.rooms.state?.playing, true);
  n.until(() => host.rooms.state?.playing === false && guest.rooms.state?.playing === false);
  assert.equal(host.rooms.state?.revision, guest.rooms.state?.revision);
});

test('handoff changes roles on both peers and permits control from the previous leader', () => {
  const { n, host, guest } = joined();
  assert.equal(host.rooms.promoteLeader('guest', 'guest-session'), true);
  n.until(() => guest.rooms.host && host.rooms.synchronized && !host.rooms.host);
  n.until(() => host.rooms.peers.find((p) => p.id === 'host')?.role === 'dj');
  assert.equal(host.rooms.controller, true);
  assert.equal(guest.rooms.peers.find((p) => p.id === 'host')?.role, 'dj');
  assert.equal(host.rooms.state?.hostId, 'guest');
  assert.equal(guest.rooms.state?.hostId, 'guest');
});

test('delegated DJ succeeds a disconnected leader, while an ordinary listener waits then leaves', () => {
  const { n, host, guest } = joined();
  host.rooms.setDJ('guest', 'guest-session', true);
  n.until(() => guest.rooms.controller);
  host.socket.connected = false;
  n.until(() => guest.rooms.host);
  assert.equal(
    guest.rooms.peers.some((p) => p.id === 'host'),
    false,
  );
  const plain = joined();
  plain.host.socket.connected = false;
  plain.n.step();
  assert.equal(plain.guest.rooms.joined, true);
  assert.equal(plain.guest.rooms.synchronized, false);
  plain.n.step(30000);
  assert.equal(plain.guest.rooms.joined, false);
});

test('request moderation, kick, explicit rejoin and disposal use one session lifecycle', () => {
  const { n, host, guest } = joined();
  let request: { sender: string; id: string } | null = null;
  host.rooms.onTrackRequest = (_query, sender, id) => {
    request = { sender, id: id! };
    return true;
  };
  const outcomes: string[] = [];
  guest.rooms.onRequestResult = (_id, outcome) => {
    outcomes.push(outcome);
  };
  assert.equal(guest.rooms.requestTrack('a song'), true);
  n.until(() => outcomes.includes('pending'));
  assert.ok(request);
  const received = request as { sender: string; id: string };
  assert.equal(host.rooms.requestIsPending(received.sender, received.id), true);
  assert.equal(host.rooms.respondToRequest(received.sender, received.id, 'accepted'), true);
  n.until(() => outcomes.includes('accepted'));
  const room = host.rooms.state!.roomId;
  host.rooms.kickPeer('guest', 'guest-session');
  n.until(() => !guest.rooms.joined);
  guest.rooms.join('host', room);
  n.until(() => guest.rooms.synchronized);
  guest.rooms.dispose();
  assert.equal(
    [...guest.socket.handlers.values()].some((set) => set.size > 0),
    false,
  );
  assert.equal(guest.socket.disposals.size, 0);
});

test('leader reconnect invalidates the old group and guest session reconnect requires a fresh snapshot', () => {
  const first = joined();
  first.guest.socket.sessionId = 'guest-new-session';
  first.n.step();
  assert.equal(first.guest.rooms.synchronized, false);
  first.n.until(() => first.guest.rooms.synchronized);
  assert.equal(first.host.rooms.peers.find((p) => p.id === 'guest')?.session, 'guest-new-session');
  first.host.socket.sessionId = 'host-new-session';
  first.n.step();
  assert.equal(first.host.rooms.joined, false);
  assert.equal(first.guest.rooms.joined, false);
  assert.match(first.host.rooms.status, /leader reconnected/);
});

test('losing the shared game clock freezes leader playback without resuming it automatically', () => {
  const { n, host, guest } = joined();
  host.rooms.enqueueTrack({ videoId: 'AbC_123-xyz', title: 'Track', durationMs: 60000 });
  n.until(() => guest.rooms.state?.queue.length === 1);
  host.rooms.ready('AbC_123-xyz');
  guest.rooms.ready('AbC_123-xyz');
  n.until(() => host.rooms.state?.buffering === false);
  n.step(2000);
  const before = host.rooms.state!;
  host.rooms.tick(host.socket, NaN);
  assert.equal(host.rooms.synchronized, false);
  assert.equal(host.rooms.state?.playing, false);
  assert.ok(host.rooms.state!.positionMs >= before.positionMs);
  assert.match(host.rooms.status, /game clock/);
  n.step();
  assert.equal(host.rooms.synchronized, true);
  assert.equal(host.rooms.state?.playing, false);
});
