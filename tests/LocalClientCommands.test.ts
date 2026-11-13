import { bindGameClasses } from '../src/game/Bindings';
import { onChatViewInvalidation } from '../src/chat/ChatViewInvalidation';
import { ClientIPCService } from '../src/ipc/ClientIPCService';
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { ChatCommandRegistry } from '../src/chat/ChatCommandRegistry';
import {
  clearLocalChat,
  customCommandHelp,
  installLocalClientCommands,
} from '../src/chat/LocalClientCommands';
import type { Raw } from '../src/api/Types';
// @ts-expect-error actual host hooks
import { Hooks } from './fixtures/HostCore.js';

function fixture() {
  const messages: unknown[][] = [],
    queue = [{ text: 'old message' }];
  const registry = new ChatCommandRegistry();
  const scene: Raw = { clientSettings: { showSecondaryBossTimers: false } };
  const log = {
    textQueue: queue,
    write: (...args: unknown[]) => messages.push(args),
    writeChatMsg: (...args: unknown[]) => messages.push(args),
  };
  let simpleText = 'old message',
    disposed = 0,
    tabsUpdated = 0;
  const rows = [{}];
  const history = ['sent draft'];
  const game = {
    messageLog: {
      nextTimeout: 123,
      simple: {
        nextTimeout: 123,
        tf: {
          set_text: (text: string) => {
            simpleText = text;
          },
          set_y() {},
        },
      },
      advanced: {
        playerChatOptions: {
          removeFromParent: (dispose: boolean) => {
            if (dispose) disposed++;
          },
        },
        scroll: {
          removeChildren: (start: number, end: number, dispose: boolean) => {
            assert.deepEqual([start, end, dispose], [0, -1, true]);
            rows.length = 0;
          },
          scrollToPosition: (x: number, y: number) => assert.deepEqual([x, y], [0, 0]),
        },
      },
    },
  };
  class Chat {
    g = game;
    history = history;
    input = {
      text: '',
      get_text() {
        return this.text;
      },
      set_text(value: string) {
        this.text = value;
      },
    };
    nativeCalls = 0;
    parseCommand(text: string) {
      const i = text.indexOf(' ');
      return i < 0 ? [text.slice(1)] : [text.slice(1, i), text.slice(i + 1)];
    }
    sendMessage() {
      this.nativeCalls++;
      return 123;
    }
    updateTab() {
      tabsUpdated++;
    }
    listCommands() {
      log.write('native help');
    }
  }
  const hooks = new Hooks(),
    cleanups: (() => void)[] = [];
  const classes: Raw = {
    'core.hud.components.chat.ChatInputText': Chat,
    'core.hud.components.chat.MessageLog': log,
    'core.scene.SceneBase': scene,
    'af.ChatCommandRegistry': registry,
  };
  class NativeClock {
    requestServerTime() {}
    dispose() {}
  }
  classes['clock.Clock'] = NativeClock;
  bindGameClasses({ cls: (name: string) => classes[name] ?? NativeClock } as any);
  installLocalClientCommands({
    on: () => () => {},
    before: (target: Raw, key: string, fn: Function) =>
      cleanups.push(hooks.add(target, key, 'before', fn)),
    defer: (cleanup: () => void) => cleanups.push(cleanup),
    interval: () => () => {},
    cls: (name: string) => classes[name],
    around: (target: Raw, key: string, fn: Function) =>
      cleanups.push(hooks.add(target, key, 'around', fn)),
    after: (target: Raw, key: string, fn: Function) =>
      cleanups.push(hooks.add(target, key, 'after', fn)),
  } as any);
  const chat = new Chat();
  const send = (text: string) => {
    chat.input.text = text;
    return chat.sendMessage();
  };
  return {
    scene,
    log,
    game,
    registry,
    chat,
    send,
    messages,
    queue,
    history,
    rows,
    simpleText: () => simpleText,
    disposed: () => disposed,
    tabsUpdated: () => tabsUpdated,
    cleanup: () => cleanups.reverse().forEach((fn) => fn()),
  };
}

test('local commands preserve native dispatch, validate timers, and report port identity locally', () => {
  const f = fixture();
  assert.equal(f.send('/local untouched'), 123);
  assert.equal(f.send('ordinary text'), 123);
  assert.equal(f.chat.nativeCalls, 2);
  f.send('/timers yes');
  assert.equal(f.scene.clientSettings.showSecondaryBossTimers, false);
  assert.deepEqual(f.messages.at(-1), ['Usage: /timers', 'error']);
  f.send('/timers');
  assert.equal(f.scene.clientSettings.showSecondaryBossTimers, true);
  assert.deepEqual(f.messages.at(-1), ['Secondary boss timers enabled.']);
  f.send('/timers  ');
  assert.equal(f.scene.clientSettings.showSecondaryBossTimers, false);
  f.scene.clientSettings = null;
  f.send('/timers');
  assert.deepEqual(f.messages.at(-1), ['Timer settings are not available yet.', 'error']);
  f.send('/echo');
  assert.equal(f.messages.at(-1)?.[0], 'death');
  assert.match(String(f.messages.at(-1)?.[1]), /QoLAF \(Server \d+ \/ v1\.2\.0 TS \(Public\)\)/);
  assert.equal(f.chat.input.text, '');
  assert.equal(f.tabsUpdated(), 5);
  assert.equal(f.chat.nativeCalls, 2);
  f.cleanup();
  assert.equal(f.send('/timers'), 123);
});

test('clear removes both views and shared queue in place without touching sent history', () => {
  const f = fixture(),
    queue = f.log.textQueue;
  const cleared: string[] = [];
  const closeSimple = onChatViewInvalidation(f.game.messageLog.simple, () =>
    cleared.push('simple'),
  );
  const closeAdvanced = onChatViewInvalidation(f.game.messageLog.advanced, () =>
    cleared.push('advanced'),
  );
  f.send('/clearchat');
  assert.deepEqual(cleared, ['simple', 'advanced']);
  closeSimple();
  closeAdvanced();
  assert.equal(f.log.textQueue, queue);
  assert.equal(queue.length, 0);
  assert.equal(f.game.messageLog.nextTimeout, 0);
  assert.equal(f.game.messageLog.simple.nextTimeout, 0);
  assert.equal(f.simpleText(), '');
  assert.equal(f.rows.length, 0);
  assert.equal(f.disposed(), 1);
  assert.equal(f.game.messageLog.advanced.playerChatOptions, null);
  assert.deepEqual(f.history, ['sent draft']);
  assert.equal(f.messages.length, 0);
  assert.equal(f.chat.nativeCalls, 0);
  f.send('/clearchat');
  assert.equal(f.disposed(), 1);
  let called = 0;
  clearLocalChat({ messageLog: { clearMessages: () => called++ } }, f.log);
  assert.equal(called, 1);
  f.cleanup();
});

test('help follows live command ownership, escapes metadata, and reserves local command names', () => {
  const f = fixture();
  const owner = {};
  f.registry.registerOwnedCommand(
    owner,
    'custom:timers',
    { description: 'custom timer' },
    () => {},
  );
  f.registry.registerOwnedCommand(
    owner,
    'custom:hello',
    { description: '<unsafe> & "quoted"', mandatory: ['target'] },
    () => {},
  );
  const help = customCommandHelp(f.registry.getHelpEntries());
  assert.equal(help[0], "''Custom commands''");
  assert.match(help[1], /''\/hello &lt;target&gt;'' \(also \/custom:hello\)/);
  assert.match(help[1], /&lt;unsafe&gt; &amp; &quot;quoted&quot;/);
  assert.equal(help[2], "''/custom:timers'' - custom timer");
  f.chat.listCommands();
  assert.deepEqual(f.messages[0], ['native help']);
  assert.ok(f.messages.some((row) => row[0] === help[1]));
  f.registry.unregisterOwner(owner);
  assert.deepEqual(customCommandHelp(f.registry.getHelpEntries()), []);
  f.cleanup();
});

test('QIPC debug command reports unavailable service and toggles the current service locally', () => {
  ClientIPCService.shutdown();
  const f = fixture();
  try {
    f.send('/qipc3dbg');
    assert.deepEqual(f.messages.at(-1), [
      'QIPC3 debug unavailable: IPC is not initialized.',
      'error',
    ]);
    const ipc = ClientIPCService.ensure(
      { connectUserId: 'debug-owner', createJoinRoom() {} },
      '1.1.23 (Public)',
      {
        now: () => 0,
        random: () => 0.5,
        interval: () => () => {},
        defer: (callback) => callback(),
        debug() {},
      },
    );
    assert.ok(ipc);
    f.send('/qipc3dbg');
    assert.deepEqual(f.messages.at(-1), ['QIPC3 debug enabled.', 'debug']);
    f.send('/qipc3dbg');
    assert.deepEqual(f.messages.at(-1), ['QIPC3 debug disabled.', 'debug']);
    assert.equal(f.chat.nativeCalls, 0, 'debug commands never reach the native chat transport');
    assert.equal(f.chat.input.text, '');
    assert.equal(f.tabsUpdated(), 3);
  } finally {
    ClientIPCService.shutdown();
    f.cleanup();
  }
});

test('each client help description is emitted as text with the default message type', () => {
  const f = fixture();
  try {
    f.chat.listCommands();
    assert.ok(f.messages.every((args) => args.length === 1));
    const text = f.messages.map((args) => args[0]);
    assert.ok(text.some((line) => typeof line === 'string' && line.startsWith("''/torptiming ")));
    assert.ok(
      text.includes(
        "''/ref, /refresh, /upstream'' refreshes the current Game room while keeping the same Service connection and loaded plugins",
      ),
    );
    assert.ok(text.some((line) => typeof line === 'string' && line.includes('parallel samples')));
    assert.ok(!text.some((line) => typeof line === 'string' && line.includes('/switchservice')));
  } finally {
    f.cleanup();
  }
});

test('room refresh aliases keep command hooks; only restart reloads the launcher', () => {
  const f = fixture();
  const previousWindow = Object.getOwnPropertyDescriptor(globalThis, 'window');
  let rooms = 0;
  let launcherReloads = 0;
  Object.assign(f.game, {
    reload() {
      assert.equal(f.chat.input.text, '', 'clear before native chat can be disposed');
      rooms++;
    },
  });
  Object.defineProperty(globalThis, 'window', {
    configurable: true,
    value: {
      top: {
        location: {
          reload() {
            assert.equal(f.chat.input.text, '');
            launcherReloads++;
          },
        },
      },
      location: {
        reload() {
          assert.fail('must reload launcher, not only game frame');
        },
      },
    },
  });
  try {
    for (const command of ['/ref', '/refresh', '/upstream', '/ref']) {
      f.send(command);
      assert.equal(launcherReloads, 0);
    }
    assert.equal(rooms, 4);
    assert.equal(f.chat.nativeCalls, 0);
    f.send('/timers');
    assert.equal(f.scene.clientSettings.showSecondaryBossTimers, true);
    f.send('/restart');
    assert.equal(launcherReloads, 1);
    assert.equal(rooms, 4);
  } finally {
    f.cleanup();
    if (previousWindow) Object.defineProperty(globalThis, 'window', previousWindow);
    else Reflect.deleteProperty(globalThis, 'window');
  }
});
