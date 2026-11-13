import assert from 'node:assert/strict';
import test from 'node:test';
import { installNativeFloatingChat } from '../src/chat/NativeFloatingChat';
import { ClientIPCService } from '../src/ipc/ClientIPCService';

test('floating command rejects reserved, malformed and primary room requests before constructing a view', () => {
  const notices: [string, string][] = [];
  const cleanups: (() => void)[] = [];
  let intercept!: (next: () => unknown) => unknown;
  let draft = '';
  let primaryCalls = 0;
  const game: any = {
    get_stage: () => ({}),
    get_me: () => ({ id: 'self' }),
    get_connected: () => true,
    serviceConnection: {
      get_connected: () => true,
      roomId: `Service-${ClientIPCService.serverVersion}_1`,
    },
    chatInput: {
      input: {
        get_text: () => draft,
        set_text: (value: string) => {
          draft = value;
        },
      },
      updateTab() {},
      sendMessage() {},
    },
  };
  const api: any = {
    raw: { game },
    cls: (name: string) =>
      name.endsWith('MessageLog')
        ? { write: (text: string, type: string) => notices.push([text, type]) }
        : undefined,
    around: (_target: unknown, _method: string, callback: typeof intercept) => {
      intercept = callback;
    },
    defer: (callback: () => void) => cleanups.push(callback),
  };
  installNativeFloatingChat(
    api,
    game,
    () => assert.fail('rejected command constructed a window'),
    {} as any,
  );
  const invoke = (text: string) => {
    draft = text;
    return intercept(() => ++primaryCalls);
  };
  for (const value of ['24', '024', '  00024  ']) {
    invoke('/floatingchat ' + value);
    assert.deepEqual(notices.at(-1), [ClientIPCService.reservedMessage, 'error']);
    assert.equal(draft, '');
  }
  for (const value of ['', '-1', '2 3', '2147483648', 'NaN']) {
    invoke('/floatingchat ' + value);
    assert.match(notices.at(-1)![0], /^Usage:/);
  }
  invoke('/floatingchat 1');
  assert.match(notices.at(-1)![0], /^Your main chat is already connected/);
  game.get_connected = () => false;
  invoke('/floatingchat 2');
  assert.match(notices.at(-1)![0], /^Wait for your room connection/);
  assert.equal(primaryCalls, 0);
  invoke('ordinary message');
  invoke('/floatingchatty 2');
  assert.equal(primaryCalls, 2);
  cleanups.reverse().forEach((callback) => callback());
});
