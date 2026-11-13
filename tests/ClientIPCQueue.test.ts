import assert from 'node:assert/strict';
import { test } from 'node:test';
import { ClientIPCQueue, type IPCPeerTarget } from '../src/ipc/ClientIPCQueue';
import { ClientIPCCodec, type IPCMessage } from '../src/ipc/ClientIPCCodec';
import { ClientIPCAssembler } from '../src/ipc/ClientIPCAssembler';
import { ClientIPCMessagePack } from '../src/ipc/ClientIPCMessagePack';

function fixture() {
  let now = 0,
    serial = 0;
  const state = { connected: true, paused: false, generation: 1, current: true };
  const peer: IPCPeerTarget = {
    id: 'peer',
    name: 'Peer',
    sessionId: 'aaaaaaaaaaaa',
    seenVersion: 1,
  };
  const writes: Array<{ target: string; name: string | null; frame: string; at: number }> = [];
  const failures: string[] = [];
  const queue = new ClientIPCQueue({
    now: () => now,
    nextId: () => (++serial).toString(16).padStart(12, '0'),
    current: () => state.current,
    get connected() {
      return state.connected;
    },
    get paused() {
      return state.paused;
    },
    get generation() {
      return state.generation;
    },
    peer: (id) => (id === peer.id ? peer : undefined),
    write: (target, name, frame) => {
      writes.push({ target, name, frame, at: now });
    },
    written: () => {},
    lost: (reason) => {
      failures.push(reason);
      queue.fail(reason);
    },
  });
  const pump = (at: number) => {
    now = at;
    queue.pump(now);
  };
  return {
    queue,
    peer,
    state,
    writes,
    failures,
    pump,
    setTime: (at: number) => {
      now = at;
    },
  };
}
const privateMessage: IPCMessage = { type: 'qipc3.test', fields: ['body'] };
const localMessage: IPCMessage = { type: 'qipc3.chat.qolaf', fields: ['body'] };
function unpack(frame: string): IPCMessage {
  return new ClientIPCAssembler().accept(frame, 'local', 'owner', 'Owner', 0)!;
}

test('Local maintains 1s cadence while private frames fill 200ms gaps', () => {
  const f = fixture();
  f.queue.enqueue(null, null, 'broadcastLocal', { ...localMessage, fields: ['x'.repeat(300)] });
  f.queue.enqueue('peer', 'Peer', 'peerMessage', { ...privateMessage, fields: ['x'.repeat(300)] });
  for (let at = 0; at <= 2400; at += 50) f.pump(at);
  const local = f.writes.filter((write) => write.target === 'broadcastLocal');
  assert.deepEqual(
    local.map((write) => write.at),
    [0, 1000, 2000],
  );
  const pm = f.writes.filter((write) => write.target === 'peerMessage');
  assert.ok(pm.length >= 5);
  for (let index = 1; index < f.writes.length; index++)
    assert.ok(f.writes[index].at - f.writes[index - 1].at >= 200);
});

test('tiny compatible messages pack once and complete each callback exactly once', () => {
  const f = fixture(),
    completed: number[] = [];
  const first = new Uint8Array([3]);
  for (let i = 0; i < 3; i++)
    f.queue.enqueue(
      null,
      null,
      'broadcastLocal',
      { type: 'qipc3.pod.rare', fields: [first] },
      { onSent: () => completed.push(i) },
    );
  first[0] = 9;
  f.pump(0);
  assert.equal(f.writes.length, 1);
  assert.deepEqual(completed, [0, 1, 2]);
  const pack = unpack(f.writes[0].frame);
  assert.equal(pack.type, ClientIPCMessagePack.type);
  assert.deepEqual(
    ClientIPCMessagePack.decode(pack)?.map((message) => message.fields[0]),
    [new Uint8Array([3]), new Uint8Array([3]), new Uint8Array([3])],
  );
  assert.equal(f.queue.length, 0);
});

test('packing stops at an intervening destination and never turns small messages into multipart work', () => {
  const f = fixture();
  f.queue.enqueue('peer', 'Peer', 'peerMessage', privateMessage);
  f.queue.enqueue(null, null, 'broadcastLocal', localMessage);
  f.queue.enqueue('peer', 'Peer', 'peerMessage', privateMessage);
  f.pump(0);
  f.pump(200);
  // Local was drained first, so the now-contiguous PM pair can pack.
  assert.equal(f.writes[0].target, 'broadcastLocal');
  assert.equal(unpack(f.writes[1].frame).type, ClientIPCMessagePack.type);
  const g = fixture();
  g.queue.enqueue('peer', 'Peer', 'peerMessage', privateMessage);
  g.queue.enqueue('other', 'Other', 'peerMessage', privateMessage);
  g.queue.enqueue('peer', 'Peer', 'peerMessage', privateMessage);
  g.pump(0);
  assert.equal(unpack(g.writes[0].frame).type, privateMessage.type);
  const h = fixture();
  for (let i = 0; i < 2; i++)
    h.queue.enqueue(null, null, 'broadcastLocal', { ...localMessage, fields: ['x'.repeat(40)] });
  h.pump(0);
  assert.equal(unpack(h.writes[0].frame).type, localMessage.type);
  assert.equal(h.queue.length, 1);
});

test('presence interrupts multipart Local traffic; private controls have a 2s priority allowance', () => {
  const f = fixture();
  f.queue.enqueue(null, null, 'broadcastLocal', { ...localMessage, fields: ['x'.repeat(1000)] });
  f.pump(0);
  f.queue.enqueue(null, null, 'broadcastLocal', {
    type: 'qipc3.ipc.presence',
    fields: ['aaaaaaaaaaaa', 'bbbbbbbbbbbb'],
  });
  f.pump(1000);
  assert.equal(unpack(f.writes[1].frame).type, 'qipc3.ipc.presence');
  const g = fixture();
  g.queue.enqueue('peer', 'Peer', 'peerMessage', { ...privateMessage, fields: ['x'.repeat(1000)] });
  const control = { type: 'qipc3.ipc.helloAck', fields: [4] };
  g.queue.enqueue('peer', 'Peer', 'peerMessage', control);
  g.pump(0);
  assert.equal(unpack(g.writes[0].frame).type, control.type);
  g.queue.enqueue('peer', 'Peer', 'peerMessage', control);
  g.pump(200);
  assert.equal(ClientIPCCodec.parse(g.writes[1].frame)?.kind, 'b');
  g.pump(2000);
  assert.equal(unpack(g.writes[2].frame).type, control.type);
});

test('radio priority does not bypass pacing or liveness controls', () => {
  const f = fixture();
  f.queue.enqueue('peer', 'Peer', 'peerMessage', privateMessage);
  f.queue.enqueue('peer', 'Peer', 'peerMessage', { type: 'qipc3.radio.state', fields: [] });
  f.queue.enqueue(null, null, 'broadcastLocal', { type: 'qipc3.ipc.presence', fields: [] });
  f.pump(0);
  f.pump(199);
  f.pump(200);
  assert.equal(f.writes.length, 2);
  assert.equal(unpack(f.writes[0].frame).type, 'qipc3.ipc.presence');
  assert.equal(unpack(f.writes[1].frame).type, 'qipc3.radio.state');
});

test('beforeSend is rebuilt once, revalidates destination and measures cadence after preparation', () => {
  const f = fixture();
  let calls = 0;
  f.queue.enqueue(null, null, 'broadcastLocal', localMessage, {
    beforeSend: () => {
      calls++;
      f.setTime(500);
      return { ...localMessage, fields: ['updated'] };
    },
  });
  f.queue.enqueue(null, null, 'broadcastLocal', localMessage);
  f.pump(0);
  f.pump(1000);
  f.pump(1499);
  assert.equal(f.writes.length, 1);
  assert.equal(calls, 1);
  assert.equal(f.writes[0].at, 500);
  assert.deepEqual(unpack(f.writes[0].frame).fields, ['updated']);
  f.pump(1500);
  assert.equal(f.writes.length, 2);
  const errors: string[] = [];
  f.queue.enqueue(null, null, 'broadcastLocal', localMessage, {
    beforeSend: () => privateMessage,
    onError: (reason) => errors.push(reason),
  });
  f.pump(2500);
  assert.equal(f.writes.length, 2);
  assert.equal(errors.length, 1);
});

test('peer reconnect, generation changes and factory disposal cancel without stale writes', () => {
  for (const mutation of ['peer', 'generation', 'dispose']) {
    const f = fixture(),
      errors: string[] = [];
    f.queue.enqueue('peer', 'Peer', 'peerMessage', privateMessage, {
      onError: (reason) => errors.push(reason),
      beforeSend:
        mutation === 'dispose'
          ? () => {
              f.state.current = false;
              f.queue.fail('disposed');
              return privateMessage;
            }
          : undefined,
    });
    if (mutation === 'peer') f.peer.sessionId = 'bbbbbbbbbbbb';
    if (mutation === 'generation') f.state.generation++;
    f.pump(0);
    assert.equal(f.writes.length, 0);
    assert.equal(errors.length, 1);
    assert.equal(f.queue.length, 0);
  }
});

test('queued expiry differs from active transfer deadline and inactivity expiry', () => {
  const f = fixture(),
    errors: string[] = [];
  f.queue.enqueue(null, null, 'broadcastLocal', localMessage, {
    onError: (reason) => errors.push(reason),
  });
  f.queue.expire(119999);
  assert.equal(errors.length, 0);
  f.queue.expire(120000);
  assert.equal(errors.length, 1);
  const g = fixture();
  g.queue.enqueue(null, null, 'broadcastLocal', { ...localMessage, fields: ['x'.repeat(20000)] });
  for (let at = 0; at <= 121000; at += 1000) {
    g.pump(at);
    g.queue.expire(at);
  }
  assert.ok(g.queue.length > 0); // Long legitimate transfer survives queue's 120s age limit.
  g.queue.expire(151000);
  assert.equal(g.queue.length, 0);
});

test('queue and byte bounds release capacity after failure and isolate throwing completion callbacks', () => {
  const f = fixture();
  for (let index = 0; index < 32; index++)
    assert.equal(f.queue.enqueue(null, null, 'broadcastLocal', localMessage), true);
  assert.equal(f.queue.enqueue(null, null, 'broadcastLocal', localMessage), false);
  f.queue.fail('reset');
  assert.equal(f.queue.length, 0);
  const large = { ...localMessage, fields: [new Uint8Array(65000)] };
  assert.equal(f.queue.enqueue(null, null, 'broadcastLocal', large), true);
  assert.equal(f.queue.enqueue(null, null, 'broadcastLocal', large), true);
  assert.equal(f.queue.enqueue(null, null, 'broadcastLocal', large), false);
  f.queue.fail('reset');
  let completed = 0;
  f.queue.enqueue(null, null, 'broadcastLocal', localMessage, {
    onSent: () => {
      throw Error('consumer');
    },
  });
  f.queue.enqueue(null, null, 'broadcastLocal', localMessage, {
    onSent: () => {
      completed++;
    },
  });
  f.pump(0);
  assert.equal(completed, 1);
  assert.equal(f.queue.length, 0);
});
