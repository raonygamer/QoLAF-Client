import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { API } from '../src/api/Types';
import { bindGameClasses, type GameScene } from '../src/game/Bindings';
import { DeviceSettings } from '../src/settings/DeviceSettings';
import { installNativeChatTab } from '../src/chat/NativeChatTab';
// @ts-expect-error actual host hook dispatcher
import { Hooks } from './fixtures/HostCore.js';

function fixture(mode: string, target = '', active = false, enabled = true) {
  const cleanups: Array<() => void> = [];
  const listeners = new Set<() => void>();
  const writes: Array<[string, string]> = [];
  let focus = 0;
  const chat = {
    chatMode: 'local',
    savedPrivateTarget: null as string | null,
    floatingContext: null as object | null,
    input: {
      setFocus: () => {
        focus++;
      },
    },
    tabs: {
      dataProvider: ['local', 'global', 'qolaf', 'clan'].map((chatMode) => ({
        chatMode,
        label: chatMode,
      })),
      set_dataProvider(value: Array<{ chatMode: string; label: string }>) {
        this.dataProvider = value;
      },
      addEventListener: (_: string, fn: () => void) => listeners.add(fn),
      removeEventListener: (_: string, fn: () => void) => listeners.delete(fn),
    },
    updateTab() {
      this.input.setFocus();
      listeners.forEach((fn) => fn());
    },
    sendPrivate(_text: string, recipient: string) {
      this.savedPrivateTarget = recipient;
    },
    isActive: () => active,
  };
  const settings = {
    advancedChatTab: { mode, privateTarget: target },
    setAdvancedChatTab: (mode: string, target: string) => writes.push([mode, target]),
  };
  const game = { chatInput: chat, get_isLeaving: () => false };
  const hooks = new Hooks((error: unknown) => {
    throw error;
  });
  const hook = (kind: string) => (object: object, key: string, callback: Function) => {
    const dispose = hooks.add(object, key, kind, callback);
    cleanups.push(dispose);
    return dispose;
  };
  const api = {
    game,
    cls: () => ({ clientSettings: settings }),
    defer: (fn: () => void) => cleanups.push(fn),
    around: hook('around'),
    after: hook('after'),
  } as unknown as API;
  bindGameClasses(api);
  const preferences = new DeviceSettings({ get: () => ({}), set: () => {} } as API['storage']);
  preferences.set('enableNewChatIntegrationSystem', enabled);
  installNativeChatTab(api, game as unknown as GameScene, preferences);
  return {
    chat,
    api,
    writes,
    focus: () => focus,
    listeners,
    cleanup: () => cleanups.reverse().forEach((fn) => fn()),
  };
}

test('restores channel and private recipient without focus, sending or settings writes', () => {
  for (const [mode, target] of [
    ['qolaf', ''],
    ['privateSaved', 'Pilot'],
  ]) {
    const f = fixture(mode, target);
    assert.equal(f.chat.chatMode, mode);
    assert.equal(f.focus(), 0);
    assert.deepEqual(f.writes, []);
    if (target) {
      assert.equal(f.chat.savedPrivateTarget, target);
      assert.deepEqual(f.chat.tabs.dataProvider.at(-1), { label: target, chatMode: mode });
    }
    f.chat.chatMode = 'clan';
    f.listeners.forEach((fn) => fn());
    assert.equal(f.writes.at(-1)?.[0], 'clan');
    f.cleanup();
    assert.equal(f.listeners.size, 0);
    assert.equal(Object.hasOwn(f.chat, 'rememberChatTab'), false);
    f.chat.input.setFocus();
    assert.equal(f.focus(), 1);
  }
});

test('legacy and floating composers do not persist; stale scenes cannot overwrite account settings', () => {
  const legacy = fixture('qolaf', '', false, false);
  assert.equal(legacy.chat.chatMode, 'local');
  legacy.chat.updateTab();
  assert.deepEqual(legacy.writes, []);
  legacy.cleanup();
  const f = fixture('global');
  f.chat.floatingContext = {};
  f.chat.updateTab();
  assert.deepEqual(f.writes, []);
  f.chat.floatingContext = null;
  Object.assign(f.api, { game: {} });
  f.chat.updateTab();
  assert.deepEqual(f.writes, []);
  f.cleanup();
});

test('unsafe enabling preserves active draft destination; unavailable saved channels fall back', () => {
  const active = fixture('global', '', true);
  assert.equal(active.chat.chatMode, 'local');
  assert.equal(active.focus(), 0);
  assert.deepEqual(active.writes, [['local', '']]);
  active.cleanup();
  const unavailable = fixture('modchat');
  assert.equal(unavailable.chat.chatMode, 'local');
  assert.equal(unavailable.focus(), 0);
  unavailable.cleanup();
});
