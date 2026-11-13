import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { API } from '../src/api/Types';
import {
  bindGameClasses,
  type JoinRoomManager,
  type Connection,
  type Message,
} from '../src/game/Bindings';
import type { Game } from '../src/game/Game';
import type { LoginLoadingStatus } from '../src/login/LoginLoadingStatus';
import { StartupServiceJoin } from '../src/login/StartupServiceJoin';
import { Socket, joined } from './fixtures/ServiceRoom';

function fixture() {
  type Join = Parameters<Game.playerio.Multiplayer['createJoinRoom']>;
  const requests: Join[] = [];
  const errors: string[] = [];
  const status: string[] = [];
  let joins = 0;
  let pings = 0;
  let current = true;
  class SDKError extends Error {}
  bindGameClasses({
    cls: (name: string) => {
      if (name === 'startSetup.StartSetup')
        return { showProgressText: (text: string) => status.push(text) };
      if (name === 'generics.Localize') return { t: (text: string) => text };
      if (name === 'playerio.PlayerIOError') return SDKError;
      return {};
    },
  } as API);
  const manager = {
    session: 'native-session',
    client: {
      multiplayer: {
        createJoinRoom: (...args: Join) => {
          requests.push(args);
        },
      },
    },
    serviceConnection: null as Connection | null,
    startServicePing: () => {
      pings++;
    },
    onJoinedServiceRoom: () => {
      joins++;
    },
    showErrorDialog: (message: string) => {
      errors.push(message);
    },
  };
  const loading = {
    setNetwork: (text: string, detail = '') => {
      status.push(text, detail);
    },
    setDetail: (text: string) => {
      status.push(text);
    },
  };
  const attempt = new StartupServiceJoin(
    manager as unknown as JoinRoomManager,
    loading as unknown as LoginLoadingStatus,
    () => current,
    1413,
  );
  return {
    attempt,
    manager,
    requests,
    errors,
    status,
    joins: () => joins,
    pings: () => pings,
    retire: () => {
      current = false;
    },
  };
}

test('startup rejects cancelled and duplicate SDK sockets without retiring the accepted connection', async () => {
  const f = fixture();
  f.attempt.start('Service-1413_0');
  f.attempt.cancel();
  const stale = new Socket('Service-1413_0');
  f.requests[0][5](stale);
  assert.equal(stale.disconnects, 1);
  f.attempt.start('Service-1413_1');
  assert.deepEqual(f.requests[1].slice(0, 5), [
    'Service-1413_1',
    'service',
    true,
    {},
    { client_version: 1413, session: 'native-session' },
  ]);
  const accepted = new Socket('Service-1413_1');
  f.requests[1][5](accepted);
  f.requests[1][5](accepted);
  const duplicate = new Socket('Service-1413_1');
  f.requests[1][5](duplicate);
  assert.equal(duplicate.disconnects, 1);
  accepted.emit(joined());
  accepted.emit(joined());
  assert.equal(f.joins(), 1);
  assert.equal(f.pings(), 1);
  assert.equal(f.manager.serviceConnection, accepted);
  await Promise.resolve();
  assert.equal(accepted.messages.get('joined')?.length, 0);
  accepted.emit({ type: 'error', getString: () => '<service error>' });
  assert.deepEqual(f.errors, ['&lt;service error&gt;']);
  f.attempt.cancel();
  assert.equal(accepted.disconnects, 0, 'published connection belongs to the game now');
  await Promise.resolve();
  assert.equal(accepted.messages.get('error')?.length, 0);
});

test('startup retries temporary locks after two seconds and cancellation retires the timer', async (t) => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const f = fixture();
  f.attempt.start('Service-1413_0');
  const socket = new Socket('Service-1413_0');
  f.requests[0][5](socket);
  socket.emit({ type: 'error', getString: () => 'Your account is still in the game.' });
  assert.equal(socket.disconnects, 1);
  assert.ok(f.status.includes('Previous Game session is still closing; retrying... (1/3)'));
  assert.deepEqual(f.errors, []);
  t.mock.timers.tick(1999);
  assert.equal(f.requests.length, 1);
  t.mock.timers.tick(1);
  assert.equal(f.requests.length, 2);
  f.attempt.cancel();
  const late = new Socket('Service-1413_0');
  f.requests[1][5](late);
  assert.equal(late.disconnects, 1);
  t.mock.timers.tick(10_000);
  assert.equal(f.requests.length, 2);
  assert.equal(f.joins(), 0);
  await Promise.resolve();
});

test('duplicate-login rejection is terminal and retired managers cannot publish a handshake', async (t) => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const f = fixture();
  f.attempt.start('Service-1413_0');
  const socket = new Socket('Service-1413_0');
  f.requests[0][5](socket);
  socket.emit({ type: 'duplicateLogin', getString: () => 'Your account is still in the game.' });
  assert.equal(socket.disconnects, 1);
  assert.deepEqual(f.errors, ['The Service room rejected the connection. Please sign in again.']);
  t.mock.timers.tick(10_000);
  assert.equal(f.requests.length, 1);
  f.attempt.start('Service-1413_1');
  const retired = new Socket('Service-1413_1');
  f.requests[1][5](retired);
  f.retire();
  retired.emit(joined());
  assert.equal(f.joins(), 0);
  f.attempt.cancel();
  assert.equal(retired.disconnects, 1);
  await Promise.resolve();
});

test('startup stops after the source three retries instead of looping indefinitely', async (t) => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const f = fixture();
  f.attempt.start('Service-1413_0');
  for (let attempt = 0; attempt < 4; attempt++) {
    assert.equal(f.requests.length, attempt + 1);
    const socket = new Socket('Service-1413_0');
    f.requests[attempt][5](socket);
    socket.emit({ type: 'error', getString: () => "You're not allowed to join yet." });
    assert.equal(socket.disconnects, 1);
    t.mock.timers.tick(2000);
    await Promise.resolve();
  }
  assert.equal(f.requests.length, 4);
  assert.deepEqual(f.errors, ["You're not allowed to join yet."]);
  t.mock.timers.tick(60_000);
  assert.equal(f.requests.length, 4);
});

test('cancelled accepted socket cannot publish a queued handshake into the next login', async () => {
  const f = fixture();
  f.attempt.start('Service-1413_0');
  const cancelled = new Socket('Service-1413_0');
  f.requests[0][5](cancelled);
  const queuedJoin = cancelled.messageHandlers.find((entry) => entry.type === 'joined')!.handler;
  const queuedError = cancelled.messageHandlers.find((entry) => entry.type === 'error')!.handler;
  f.attempt.cancel();
  assert.equal(cancelled.disconnects, 1);
  f.attempt.start('Service-1413_1');
  const current = new Socket('Service-1413_1');
  f.requests[1][5](current);
  queuedJoin(joined() as unknown as Message);
  queuedError({
    ...joined(),
    type: 'error',
    getString: () => 'old login failed',
  } as unknown as Message);
  assert.equal(f.manager.serviceConnection, null);
  assert.equal(f.joins(), 0);
  assert.deepEqual(f.errors, []);
  current.emit(joined());
  assert.equal(f.manager.serviceConnection, current);
  assert.equal(f.joins(), 1);
  assert.equal(f.pings(), 1);
  queuedJoin(joined() as unknown as Message);
  assert.equal(f.manager.serviceConnection, current);
  assert.equal(f.joins(), 1);
  await Promise.resolve();
  assert.equal(cancelled.messageHandlers.length, 0);
  assert.equal(cancelled.disconnected.length, 0);
  f.attempt.cancel();
  assert.equal(current.disconnects, 0, 'committed connection belongs to the new session');
  await Promise.resolve();
});
