import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { API } from '../src/api/Types';
import { bindGameClasses, type Client } from '../src/game/Bindings';
import type { Game } from '../src/game/Game';
import { authenticateLoginProfile } from '../src/login/LoginAuthentication';
import { siteProfile } from '../src/login/LoginProfile';

test('cancelled provider callbacks cannot log in or report an old failure during retry', () => {
  type Request = [
    stage: Game.openfl.display.Stage,
    gameId: string,
    email: string,
    password: string,
    success: (client: Client) => void,
    failure: (error: unknown) => void,
  ];
  const requests: Request[] = [];
  bindGameClasses({
    cls: (name: string) =>
      name === 'playerio.PlayerIO'
        ? { quickConnect: { simpleConnect: (...args: Request) => requests.push(args) } }
        : name === 'Login'
          ? { gameId: 'test-game' }
          : {},
  } as unknown as API);
  const stage = {} as Game.openfl.display.Stage;
  const controller = new AbortController();
  const successes: Client[] = [];
  const failures: unknown[] = [];
  const profile = siteProfile('example@example.invalid', 'fixture', 'simple');
  authenticateLoginProfile(
    profile,
    stage,
    controller.signal,
    (client) => successes.push(client),
    (error) => failures.push(error),
  );
  controller.abort();
  authenticateLoginProfile(
    profile,
    stage,
    new AbortController().signal,
    (client) => successes.push(client),
    (error) => failures.push(error),
  );
  const client = {} as Client;
  requests[0][4](client);
  requests[0][5](new Error('late failure'));
  assert.deepEqual(successes, []);
  assert.deepEqual(failures, []);
  requests[1][4](client);
  assert.deepEqual(successes, [client]);
  authenticateLoginProfile(
    profile,
    stage,
    controller.signal,
    () => assert.fail('already aborted'),
    () => assert.fail('already aborted'),
  );
  assert.equal(requests.length, 2);
});

test('Armor cancellation during response decoding prevents a subsequent SDK connection', async (t) => {
  bindGameClasses({ cls: () => ({ gameId: 'test-game' }) } as unknown as API);
  let complete!: (text: string) => void;
  const text = new Promise<string>((resolve) => {
    complete = resolve;
  });
  const controller = new AbortController();
  t.mock.method(globalThis, 'fetch', async (_url: URL, init: RequestInit) => {
    assert.equal(init.signal, controller.signal);
    return { ok: true, text: () => text } as Response;
  });
  let sdkAccesses = 0;
  const sdkDescriptor = Object.getOwnPropertyDescriptor(globalThis, '_pio');
  Object.defineProperty(globalThis, '_pio', {
    configurable: true,
    get() {
      sdkAccesses++;
      return undefined;
    },
  });
  t.after(() => {
    if (sdkDescriptor) Object.defineProperty(globalThis, '_pio', sdkDescriptor);
    else Reflect.deleteProperty(globalThis, '_pio');
  });
  let callbacks = 0;
  authenticateLoginProfile(
    siteProfile('fixture', 'fixture', 'armor'),
    {} as Game.openfl.display.Stage,
    controller.signal,
    () => callbacks++,
    () => callbacks++,
  );
  await Promise.resolve();
  controller.abort();
  complete('id\ntoken');
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(callbacks, 0);
  assert.equal(sdkAccesses, 0);
});
