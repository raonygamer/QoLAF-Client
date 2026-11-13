import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { API } from '../src/api/Types';
import type { Connection } from '../src/game/Bindings';
import { installServerEndpoints } from '../src/network/ServerEndpoints';
// @ts-expect-error actual host dispatcher
import { Hooks } from './fixtures/HostCore.js';

test('selected service/game transports stay separate and unload restores SDK constructors', () => {
  const cleanups: (() => void)[] = [];
  const hooks = new Hooks();
  const api = {
    defer: (cleanup: () => void) => cleanups.push(cleanup),
    around: (target: object, key: string, callback: Function) =>
      cleanups.push(hooks.add(target, key, 'around', callback)),
  } as unknown as API;
  class Transport {
    sent: unknown[] = [];
    constructor(
      _binary: boolean,
      _secure: boolean,
      readonly address: string,
    ) {}
    sendMessage(message: unknown) {
      this.sent.push(message);
    }
  }
  class SDKConnection {
    connected = true;
    transport: Transport | null = null;
    sendMessage(message: unknown) {
      this.transport?.sendMessage(message);
    }
  }
  const sdk = { connection: SDKConnection, websocketConnection: Transport };
  const endpoint = installServerEndpoints(api, sdk);
  const service = new sdk.connection();
  const game = new sdk.connection();
  const wrap = (raw: SDKConnection) =>
    ({ raw, get_connected: () => raw.connected }) as unknown as Connection;
  const serviceWrapper = wrap(service),
    gameWrapper = wrap(game);
  // A failed candidate must not be attributed to either room.
  new sdk.websocketConnection(true, true, '192.0.2.1:443');
  assert.equal(endpoint(serviceWrapper), null);
  service.transport = new sdk.websocketConnection(true, true, '192.0.2.2:443');
  game.transport = new sdk.websocketConnection(true, true, '[2001:db8::3]:443');
  const message = { type: 'join' };
  service.sendMessage(message);
  game.sendMessage(message);
  assert.equal(endpoint(serviceWrapper), '192.0.2.2');
  assert.equal(endpoint(gameWrapper), '[2001:db8::3]');
  assert.equal(service.transport.sent[0], message, 'observation must preserve the exact message');
  service.connected = false;
  assert.equal(endpoint(serviceWrapper), null);
  cleanups.reverse().forEach((cleanup) => cleanup());
  assert.equal(sdk.connection, SDKConnection);
  assert.equal(sdk.websocketConnection, Transport);
  assert.equal(Object.hasOwn(game.transport, 'sendMessage'), false);
  assert.equal(Object.hasOwn(game, 'sendMessage'), false);
  // The Service connection normally survives /ref and plugin hot reload.
  const restoredEndpoint = installServerEndpoints(api, sdk);
  service.connected = true;
  assert.equal(restoredEndpoint(serviceWrapper), '192.0.2.2');
  assert.equal(restoredEndpoint(gameWrapper), '[2001:db8::3]');
  const untouchedSDK = { connection: SDKConnection, websocketConnection: Transport };
  assert.equal(
    installServerEndpoints(api, untouchedSDK)(serviceWrapper),
    null,
    'metadata must not bleed into an unrelated SDK instance',
  );
  cleanups.reverse().forEach((cleanup) => cleanup());
});

test('missing browser SDK reports unavailable without installing partial hooks', () => {
  const api = {
    defer() {
      throw Error('Unexpected hook');
    },
  } as unknown as API;
  assert.equal(installServerEndpoints(api, null)(null), null);
  assert.equal(installServerEndpoints(api, {})(null), null);
});

test('bundled PlayerIO constructors associate only the successful fallback socket', async () => {
  const { readFile } = await import('node:fs/promises');
  const { runInNewContext } = await import('node:vm');
  const source = await readFile(
    new URL('./fixtures/PlayerIOTransport.js', import.meta.url),
    'utf8',
  );
  const timers: (() => void)[] = [];
  const sockets: Socket[] = [];
  class Socket {
    onopen = () => {};
    onclose = () => {};
    onerror = () => {};
    onmessage = () => {};
    sent: unknown[] = [];
    constructor(readonly url: string) {
      sockets.push(this);
    }
    send(value: unknown) {
      this.sent.push(value);
    }
    close() {}
  }
  class Message {
    constructor(readonly type: string) {}
    addString(_value: string) {}
  }
  interface NativeConnection {
    connected: boolean;
    sendMessage(message: unknown): void;
    disconnect(): void;
  }
  const sdk = {
    message: Message,
    messageSerializer: class {
      serializeMessage() {
        return [1, 2, 3];
      }
    },
    debugLog() {},
    handleError() {
      throw Error('Unexpected exhausted endpoints');
    },
    runCallback(callback: (connection: unknown) => void, connection: unknown) {
      callback(connection);
    },
  };
  runInNewContext(source, {
    _pio: sdk,
    navigator: { userAgent: 'Firefox/130' },
    window: {},
    WebSocket: Socket,
    Uint8Array,
    setTimeout(callback: () => void) {
      timers.push(callback);
      return timers.length;
    },
    clearTimeout() {},
  });
  const constructors = sdk as typeof sdk & {
    connection: new (...args: unknown[]) => NativeConnection;
  };
  const cleanups: (() => void)[] = [];
  const hooks = new Hooks();
  const api = {
    defer: (cleanup: () => void) => cleanups.push(cleanup),
    around: (target: object, key: string, callback: Function) =>
      cleanups.push(hooks.add(target, key, 'around', callback)),
  } as unknown as API;
  const endpoint = installServerEndpoints(api, sdk);
  const connection = new constructors.connection(
    null,
    null,
    true,
    [
      { address: '192.0.2.10', port: 443 },
      { address: '192.0.2.20', port: 443 },
    ],
    'fixture-join-key',
    {},
    () => {},
    () => {},
  );
  const wrapped = {
    raw: connection,
    get_connected: () => connection.connected,
  } as unknown as Connection;
  assert.equal(endpoint(wrapped), null);
  timers[0](); // First endpoint times out; native SDK selects its second candidate.
  assert.equal(sockets.length, 2);
  sockets[1].onopen(); // Native SDK sends its join message on the selected transport.
  assert.equal(connection.connected, true);
  assert.equal(endpoint(wrapped), '192.0.2.20');
  assert.equal(sockets[0].sent.length, 0);
  assert.equal(sockets[1].sent.length, 1);
  connection.disconnect();
  assert.equal(endpoint(wrapped), null);
  cleanups.reverse().forEach((cleanup) => cleanup());
});
