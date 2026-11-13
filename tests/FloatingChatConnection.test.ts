import assert from 'node:assert/strict';
import test from 'node:test';
import { FloatingChatConnection } from '../src/chat/FloatingChatConnection';
import { claimFloatingChatSendSlot } from '../src/chat/FloatingChatSendSlot';
import { Socket, joined, serviceFixture } from './fixtures/ServiceRoom';

function fixture() {
  const f = serviceFixture();
  f.game.time = 1000;
  f.game.chatInput = { g: f.game, nextRdySendTime: 0, nextGlobalRdySendTime: 0 };
  f.game.chatInput.claimFloatingChatSendSlot = (channel: string) =>
    claimFloatingChatSendSlot(f.game.chatInput, channel);
  f.game.messageLog = { isMuted: () => false };
  const rows: any[] = [],
    statuses: [string, boolean][] = [];
  const bans = { minutes: 0, allChannels: false };
  const connection = new FloatingChatConnection(
    f.game,
    'Service-1412_2',
    f.pool,
    () => bans,
    (row) => rows.push(row),
    (text, error) => statuses.push([text, error]),
    () => {},
  );
  connection.open();
  const socket = new Socket('Service-1412_2');
  f.joins[0].ready(socket);
  socket.emit(joined());
  return { ...f, connection, socket, rows, statuses, bans };
}

test('auxiliary receive forwards chat only after verification, without primary dispatch', () => {
  const f = fixture();
  assert.equal(f.connection.connected, true);
  const row = { type: 'chatMsg', length: 6 };
  f.socket.emit(row);
  f.socket.emit({ type: 'chatMsg', length: 4 });
  f.socket.emit({
    type: 'clientPrintMsg',
    length: 2,
    getString: (i: number) => (i ? 'error' : '<server>'),
  });
  assert.deepEqual(f.rows, [row]);
  assert.deepEqual(f.statuses.at(-1), ['<server>', true]);
  assert.equal(f.game.serviceConnection.roomId, 'Service-1412_1');
  assert.equal(f.socket.sent.length, 0);
  f.replaceGame();
  f.socket.emit(row);
  assert.equal(f.rows.length, 1);
  assert.equal(f.connection.connected, false);
  assert.equal(f.socket.disconnects, 1);
  f.flush();
  assert.equal(f.socket.messages.get('chatMsg')!.length, 0);
});

test('send uses native variadic packets and shares primary composer limits', () => {
  const f = fixture();
  assert.equal(f.connection.send('local', 'hello'), true);
  assert.equal(f.connection.send('clan', 'too soon'), false);
  assert.equal(f.connection.send('global', '<b>plain</b>'), true);
  assert.equal(f.connection.send('private', 'hi', '  Friend  '), true);
  f.game.me.get_group = () => ({ get_players: () => [{ id: 'self' }, null, { id: 'other' }] });
  assert.equal(f.connection.send('group', 'together'), true);
  assert.deepEqual(f.socket.sent, [
    ['chatMsg', 'local', 'hello'],
    ['chatMsg', 'global', 'plain'],
    ['chatMsg', 'private', 'Friend', 'hi'],
    ['chatMsg', 'group', 'self,other', 'together'],
  ]);
  assert.equal(f.game.chatInput.nextGlobalRdySendTime, 31000);
  assert.equal(f.connection.send('private', 'x'.repeat(151), 'Friend'), false);
  assert.equal(f.connection.send('private', 'hi', 'bad\nname'), false);
  assert.equal(f.connection.send('modchat', 'hi'), false);
  assert.equal(f.connection.send('unknown', 'hi'), false);
  assert.equal(f.socket.sent.length, 4);
  f.connection.dispose();
});

test('socket and primary bans combine, preserve clan exemption, and expire monotonically', () => {
  const f = fixture();
  f.bans.minutes = 2;
  assert.equal(f.connection.send('global', 'blocked'), false);
  assert.equal(f.connection.send('private', 'allowed', 'Friend'), true);
  f.socket.emit({ type: 'chatBan', getInt: () => 3, getBoolean: () => true });
  assert.equal(f.connection.send('private', 'blocked', 'Friend'), false);
  assert.equal(f.connection.send('clan', 'allowed'), true);
  f.advance(180001);
  assert.equal(f.connection.send('private', 'expired', 'Friend'), true);
  assert.equal(f.connection.send('global', 'primary still banned'), false);
  f.connection.dispose();
});

test('synchronous reuse can close from ready callback without retaining a lease', () => {
  const f = fixture();
  let second!: FloatingChatConnection;
  second = new FloatingChatConnection(
    f.game,
    f.socket.roomId,
    f.pool,
    () => f.bans,
    () => {},
    () => {},
    () => {
      if (second.connected) second.dispose();
    },
  );
  second.open();
  assert.equal(second.connected, false);
  assert.equal(f.socket.disconnects, 0);
  f.flush();
  assert.equal(f.socket.messages.get('chatMsg')!.length, 1);
  f.connection.dispose();
  assert.equal(f.socket.disconnects, 1, 'closed reused view retained no lease');
});

test('acquisition errors retain the SDK message and allow reopening', () => {
  for (const error of [new Error('Service unavailable'), { message: 'Service unavailable' }]) {
    const f = serviceFixture();
    const statuses: Array<[string, boolean]> = [];
    const acquire = f.pool.acquire;
    f.pool.acquire = () => {
      throw error;
    };
    const connection = new FloatingChatConnection(
      f.game,
      'Service-1412_2',
      f.pool,
      () => ({ minutes: 0, allChannels: false }),
      () => {},
      (text, isError) => statuses.push([text, isError]),
      () => {},
    );
    connection.open();
    assert.deepEqual(statuses.at(-1), [
      "Couldn't connect to Service-1412_2: Service unavailable",
      true,
    ]);
    assert.equal(connection.connecting, false);
    assert.equal(connection.connected, false);
    f.pool.acquire = acquire;
    connection.open();
    assert.equal(connection.connecting, true);
    const socket = new Socket('Service-1412_2');
    f.joins[0].ready(socket);
    socket.emit(joined());
    assert.equal(connection.connected, true);
    connection.dispose();
    assert.equal(socket.disconnects, 1);
  }
});
