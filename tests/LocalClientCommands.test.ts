import assert from 'node:assert/strict';
import { test } from 'node:test';
import { ChatCommandRegistry } from '../src/Chat/ChatCommandRegistry';
import {
  clearLocalChat,
  customCommandHelp,
  installLocalClientCommands,
} from '../src/Chat/LocalClientCommands';
import type { Raw } from '../src/Api/Types';
// @ts-expect-error actual host hooks
import { Hooks } from './Fixtures/HostCore.js';

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
  installLocalClientCommands({
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
  assert.match(String(f.messages.at(-1)?.[1]), /TypeScript port 0\.2\.0-dev/);
  assert.equal(f.chat.input.text, '');
  assert.equal(f.tabsUpdated(), 5);
  assert.equal(f.chat.nativeCalls, 2);
  f.cleanup();
  assert.equal(f.send('/timers'), 123);
});

test('clear removes both views and shared queue in place without touching sent history', () => {
  const f = fixture(),
    queue = f.log.textQueue;
  f.send('/clearchat');
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
