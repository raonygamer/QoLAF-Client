import assert from 'node:assert/strict';
import test from 'node:test';
import { ServiceConnectionPool } from '../src/service/ServiceConnectionPool';

import { Socket, joined, serviceFixture as fixture } from './fixtures/ServiceRoom';

test('Service room validation and handshake keep canonical current-protocol identity', () => {
  const f = fixture();
  assert.equal(f.pool.serviceIdFromIndex('002'), 'Service-1412_2');
  for (const room of [
    'Service-1412_02',
    'Service-1411_2',
    'Service-1412_999',
    'Service-1412_-1',
    'Service-1412_2147483648',
  ])
    assert.equal(f.pool.isValidServiceId(room), false);
  assert.equal(f.pool.isValidServiceId('Service-1412_0'), true);
  assert.equal(ServiceConnectionPool.isValidServiceHandshake(joined(), 'self'), true);
  assert.equal(ServiceConnectionPool.isValidServiceHandshake(joined('other'), 'self'), false);
  assert.equal(
    ServiceConnectionPool.isValidServiceHandshake({ ...joined(), getNumber: () => NaN }, 'self'),
    false,
  );
  assert.equal(
    ServiceConnectionPool.isValidServiceHandshake(
      {
        ...joined(),
        getInt: () => {
          throw Error('type');
        },
      },
      'self',
    ),
    false,
  );
});

test('shared joins verify once, reuse synchronously, preserve bans, and close on final lease', () => {
  const f = fixture();
  const ready: unknown[] = [];
  const a = f.pool.acquire(
    f.game,
    'Service-1412_2',
    (c) => ready.push(c),
    () => {},
  );
  const b = f.pool.acquire(
    f.game,
    'Service-1412_2',
    (c) => ready.push(c),
    () => {},
  );
  assert.equal(f.joins.length, 1);
  assert.deepEqual(f.joins[0].data, { client_version: 1412 });
  assert.equal(f.pool.hasService(f.game, 'Service-1412_2'), true);
  const socket = new Socket('Service-1412_2');
  f.joins[0].ready(socket);
  assert.equal(a.connection, null);
  socket.emit(joined());
  assert.deepEqual(ready, [socket, socket]);
  socket.emit(joined());
  assert.equal(ready.length, 2);
  socket.emit({ type: 'chatBan', getInt: () => 2, getBoolean: () => true });
  assert.equal(b.chatBanMinutes, 2);
  assert.equal(b.chatBanAllChannels, true);
  f.advance(60001);
  assert.equal(a.chatBanMinutes, 1);
  let synchronous = false;
  const c = f.pool.acquire(
    f.game,
    socket.roomId,
    () => {
      synchronous = true;
    },
    () => {},
  );
  assert.equal(synchronous, true);
  assert.deepEqual(f.pool.connectedRoomIds(f.game), [socket.roomId]);
  a.dispose();
  b.dispose();
  assert.equal(socket.disconnects, 0);
  c.dispose();
  assert.equal(socket.disconnects, 1);
  assert.equal(f.pollers.size, 0);
  f.flush();
  assert.equal(socket.messages.get('joined')!.length, 0);
});

test('timeout and stale joins release candidates without disconnecting a published primary', () => {
  const f = fixture();
  const lost: string[] = [];
  f.pool.acquire(
    f.game,
    'Service-1412_2',
    () => assert.fail(),
    (_reason, kind) => lost.push(kind),
  );
  f.advance(8000);
  assert.deepEqual(lost, ['timeout']);
  const late = new Socket('Service-1412_2');
  f.joins[0].ready(late);
  assert.equal(late.disconnects, 1);
  const lease = f.pool.acquire(
    f.game,
    'Service-1412_3',
    () => assert.fail(),
    () => {},
  );
  lease.dispose();
  f.joins[1].ready(f.game.serviceConnection);
  assert.equal(f.game.serviceConnection.disconnects, 0);
  f.pool.acquire(
    f.game,
    'Service-1412_4',
    () => assert.fail(),
    () => {},
  );
  f.replaceGame();
  f.advance(250);
  const changed = new Socket('Service-1412_4');
  f.joins[2].ready(changed);
  assert.equal(changed.disconnects, 1);
});

test('primary adoption leaves live dispatch intact and relinquishment retains auxiliary ownership', () => {
  const f = fixture();
  const lease = f.pool.acquire(
    f.game,
    'Service-1412_2',
    () => {},
    () => {},
  );
  const socket = new Socket('Service-1412_2');
  f.joins[0].ready(socket);
  const greeting = joined();
  socket.emit(greeting);
  assert.deepEqual(f.pool.takeReadyForPrimary(f.game, socket.roomId), {
    connection: socket,
    joined: greeting,
  });
  f.game.serviceConnection = socket;
  assert.deepEqual(f.pool.connectedRoomIds(f.game), []);
  let primaryCalls = 0;
  socket.addMessageHandler('kicked', () => primaryCalls++);
  socket.emit({ type: 'kicked' });
  assert.equal(primaryCalls, 1);
  assert.equal(lease.connection, socket);
  assert.equal(f.pool.releasePrimary(f.game, socket), true);
  lease.dispose();
  assert.equal(socket.disconnects, 0, 'briefly published former primary remains connected');
  f.game.serviceConnection = new Socket('Service-1412_3');
  f.advance(250);
  assert.equal(socket.disconnects, 1);
  f.flush();
  assert.equal(socket.messages.get('kicked')!.length, 1, 'only pool handlers are detached');
});

test('consumer failure does not skip other leases or PlayerIO live-array listeners', () => {
  const f = fixture();
  let ready = 0,
    native = 0;
  f.pool.acquire(
    f.game,
    'Service-1412_2',
    () => {
      throw Error('consumer');
    },
    () => {},
  );
  const b = f.pool.acquire(
    f.game,
    'Service-1412_2',
    () => ready++,
    () => {},
  );
  const socket = new Socket('Service-1412_2');
  f.joins[0].ready(socket);
  socket.emit(joined());
  assert.equal(ready, 1);
  assert.equal(b.connection, socket);
  socket.addMessageHandler('error', () => native++);
  socket.emit({ type: 'error', length: 1, getString: () => 'rejected' });
  assert.equal(native, 1);
  assert.equal(b.connection, null);
  f.flush();
  assert.equal(socket.messages.get('error')!.length, 1);
});
