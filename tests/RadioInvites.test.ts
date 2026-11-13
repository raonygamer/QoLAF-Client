import assert from 'node:assert/strict';
import test from 'node:test';
import {
  RadioInvites,
  type RadioInviteTransport,
  type RadioInviteEnvironment,
} from '../src/radio/RadioInvites';
import { selectRadioInviteTargets } from '../src/radio/RadioInviteTargets';
import type { RadioService } from '../src/radio/RadioService';
import type { IPCMessage } from '../src/ipc/ClientIPCCodec';
import type { IPCSendCallbacks } from '../src/ipc/ClientIPCQueue';

function fixture(host: boolean) {
  let now = 0,
    opened = 0,
    created = 0;
  const timers = new Set<{ callback: () => void; at: number }>();
  const handlers = new Map<string, (message: IPCMessage, sender: string, name: string) => void>();
  const sent: { target: string; message: IPCMessage; callbacks: IPCSendCallbacks }[] = [],
    notes: string[] = [],
    joins: unknown[][] = [];
  const peerSessions = new Map([
    ['host', 'host-session'],
    ['guest', 'guest-session'],
    ['third', 'third-session'],
  ]);
  const identity = host ? 'host' : 'guest';
  const radio = {
    available: true,
    open: () => {
      opened++;
    },
    rooms: {
      host,
      synchronized: true,
      transferringLeadership: false,
      state: { roomId: 'room', name: 'Radio' },
      peers: [{ id: identity }],
      invitationKey: 'a'.repeat(64),
      joinInvitation: (...args: unknown[]) => {
        joins.push(args);
        return true;
      },
    },
  };
  let existing = host;
  const ipc: RadioInviteTransport = {
    connected: true,
    paused: false,
    sessionId: identity + '-session',
    onlinePlayers: [
      { id: 'guest', name: 'Guest' },
      { id: 'third', name: 'Third' },
    ],
    ownLoginInfo: () => ({ id: identity }),
    peerSessionId: (id) => peerSessions.get(id) ?? null,
    findPeer: (name) => ipc.onlinePlayers.find((p) => p.name === name || p.id === name) ?? null,
    addMessageHandler: (type, handler) => {
      handlers.set(type, handler);
    },
    removeMessageHandler: (type) => {
      handlers.delete(type);
    },
    addDisposeHandler: () => {},
    removeDisposeHandler: () => {},
    broadcast: () => true,
    send: (target, message, callbacks) => {
      sent.push({ target, message, callbacks });
      return true;
    },
  };
  const environment: RadioInviteEnvironment = {
    now: () => now,
    clock: () => 100000 + now,
    after: (callback, ms) => {
      const timer = { callback, at: now + ms };
      timers.add(timer);
      return () => {
        timers.delete(timer);
      };
    },
    currentTransport: () => ipc,
    existingRadio: () => (existing ? (radio as unknown as RadioService) : null),
    getRadio: () => {
      created++;
      existing = true;
      return radio as unknown as RadioService;
    },
    currentGame: () => null,
    inCurrentRoom: () => false,
    note: (text) => {
      notes.push(text);
    },
  };
  const invites = new RadioInvites(ipc, environment);
  const receive = (message: IPCMessage, sender: string) =>
    handlers.get(message.type)?.(message, sender, sender);
  return {
    invites,
    ipc,
    radio,
    sent,
    notes,
    joins,
    handlers,
    peerSessions,
    receive,
    created: () => created,
    opened: () => opened,
    timers,
    advance: (ms: number) => {
      now += ms;
      for (const timer of [...timers])
        if (timer.at <= now) {
          timers.delete(timer);
          timer.callback();
        }
    },
  };
}
function prepare(f: ReturnType<typeof fixture>, index: number) {
  const item = f.sent[index];
  const message = item.callbacks.beforeSend ? item.callbacks.beforeSend() : item.message;
  assert.ok(message);
  item.callbacks.onSent?.();
  return message;
}

test('target grammar resolves complete quoted lists before sending anything', () => {
  const peers = [
    { id: 'a', name: 'One, Two' },
    { id: 'b', name: 'Other' },
  ];
  const find = (name: string) => peers.find((p) => p.name === name) ?? null;
  assert.deepEqual(
    selectRadioInviteTargets('[@"One, Two", @Other]', peers, find, () => true)?.peers,
    peers,
  );
  assert.equal(
    selectRadioInviteTargets('[@Other, @Missing]', peers, find, () => true),
    null,
  );
  assert.equal(
    selectRadioInviteTargets('[@Other,]', peers, find, () => true),
    null,
  );
  assert.equal(
    selectRadioInviteTargets('[@"One, Two]', peers, find, () => true),
    null,
  );
  assert.deepEqual(selectRadioInviteTargets('roompeers', peers, find, (id) => id === 'a')?.peers, [
    peers[0],
  ]);
});

test('receiving never starts Radio; explicit acceptance requires correlated leader confirmation', () => {
  const host = fixture(true),
    guest = fixture(false);
  host.invites.invite('@Guest');
  const invitation = prepare(host, 0);
  guest.receive(invitation, 'host');
  guest.receive(invitation, 'host');
  assert.equal(guest.created(), 0);
  assert.equal(guest.opened(), 0);
  assert.equal(guest.notes.length, 1);
  guest.invites.respond('accept');
  assert.equal(guest.created(), 1);
  assert.equal(guest.opened(), 1);
  host.receive(prepare(guest, 0), 'guest');
  const confirmation = prepare(host, 1);
  const stale = { ...confirmation, fields: [...confirmation.fields] };
  stale.fields[2] = 'wrong-token';
  guest.receive(stale, 'host');
  assert.equal(guest.joins.length, 0);
  guest.receive(confirmation, 'host');
  assert.deepEqual(guest.joins, [['host', 'host-session', 'room', 'Radio', 'a'.repeat(64)]]);
  assert.equal(guest.timers.size, 0);
});

test('bulk invites are paced and session changes invalidate deferred transmission', () => {
  const f = fixture(true);
  f.invites.invite('allpeers');
  assert.equal(f.sent.length, 1);
  f.advance(60000);
  const first = prepare(f, 0);
  assert.equal(first.fields[5], 340000);
  f.advance(199);
  assert.equal(f.sent.length, 1);
  f.advance(1);
  assert.equal(f.sent.length, 2);
  f.peerSessions.set('third', 'third-reconnected');
  assert.equal(f.sent[1].callbacks.beforeSend!(), null);
  f.sent[1].callbacks.onError!('session changed');
  assert.match(f.notes.at(-1)!, /Couldn't send/);
});

test('IPC queue saturation retries the same invite and expiry never starts the service', () => {
  const f = fixture(true);
  f.invites.invite('@Guest');
  f.sent[0].callbacks.onError!('queue is full');
  f.advance(200);
  assert.equal(f.sent.length, 2);
  const invite = prepare(f, 1),
    guest = fixture(false);
  guest.receive(invite, 'host');
  guest.advance(180000);
  assert.equal(guest.sent[0].message.fields[4], 'expired');
  assert.equal(guest.created(), 0);
  guest.invites.respond('accept');
  assert.match(guest.notes.at(-1)!, /no pending/);
});

test('decline and changed-session acceptance cannot join, and disposal clears handlers/timers', () => {
  const host = fixture(true),
    guest = fixture(false);
  host.invites.invite('@Guest');
  const invitation = prepare(host, 0);
  guest.receive(invitation, 'host');
  guest.invites.respond('decline');
  assert.equal(guest.sent[0].message.fields[4], 'deny');
  assert.equal(guest.created(), 0);
  const next = fixture(false);
  next.receive(invitation, 'host');
  next.peerSessions.set('host', 'replacement');
  next.invites.respond('accept');
  assert.equal(next.created(), 0);
  assert.equal(next.joins.length, 0);
  next.invites.dispose();
  assert.equal(next.handlers.size, 0);
  assert.equal(next.timers.size, 0);
});
