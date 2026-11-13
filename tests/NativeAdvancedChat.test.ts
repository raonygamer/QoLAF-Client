import assert from 'node:assert/strict';
import { test } from 'node:test';
import { installNativeAdvancedChat } from '../src/chat/NativeAdvancedChat';
import { clearLocalChat } from '../src/chat/LocalClientCommands';
import { Display, Stage } from './fixtures/NativeGame';
import { bindGameClasses } from '../src/game/Bindings';
import type { API } from '../src/api/Types';
import type { Raw } from '../src/api/Types';
// @ts-expect-error inspected upstream method
import { makeAddText } from './fixtures/UpstreamAdvancedChat.js';
// @ts-expect-error actual host dispatcher
import { Hooks } from './fixtures/HostCore.js';

function fixture(limit = 3) {
  let now = 0;
  const jobs = new Map<Function, number>();
  const juggler = {
    delayCall(fn: Function, seconds: number) {
      jobs.set(fn, now + seconds);
    },
    removeDelayedCalls(fn: Function) {
      jobs.delete(fn);
    },
  };
  const advance = (seconds: number) => {
    const end = now + seconds;
    while (true) {
      const entry = [...jobs].sort((a, b) => a[1] - b[1])[0];
      if (!entry || entry[1] > end + 1e-9) break;
      now = entry[1];
      jobs.delete(entry[0]);
      entry[0]();
    }
    now = end;
  };
  const messages: Raw = { extendedMaxLines: limit, textQueue: [] };
  const scroll: Raw = Object.assign(new Display(), {
    position: 0,
    moves: [] as number[],
    get_verticalScrollPosition() {
      return this.position;
    },
    get_maxVerticalScrollPosition(this: Raw) {
      return Math.max(0, this.contentBottom() - 50);
    },
    scrollToPosition(_x: number, y: number) {
      if (this.position !== y) this.moves.push(y);
      this.position = y;
    },
    contentBottom(this: Display) {
      return this.get_numChildren() * 50;
    },
    get_height: () => 50,
    get_width: () => 500,
    arrange() {},
  });
  scroll.content = scroll;
  class Row extends Display {
    field = { get_text: () => this.text };
    get_height() {
      return 50;
    }
    text = '';
    set_text(text: string) {
      this.text = text;
    }
  }
  bindGameClasses({
    cls: (name: string) => (name === 'core.hud.components.ui.WrapText' ? Row : {}),
  } as unknown as API);
  const muted = new Set<string>();
  const log: Raw = Object.assign(new Display(), {
    toggleMuted: (type: string, value: boolean) => {
      if (value && !muted.has(type)) muted.add(type);
      else muted.delete(type);
    },
    isMuted: (type: string) => muted.has(type),
    getQueue: () => messages.textQueue.filter((m: Raw) => !muted.has(m.type)),
  });
  const game = { messageLog: log, get_me: () => ({ id: 'me' }) };
  const advanced: Raw = Object.assign(new Display(), {
    g: game,
    scroll,
    playerChatOptions: null,
    addText: makeAddText(Row, messages, Display),
    updateText() {
      throw Error('Native immediate update was not replaced');
    },
  });
  const stage = new Stage();
  stage.addChild(log as unknown as Display);
  log.advanced = advanced;
  log.addChild(advanced);
  const hooks = new Hooks();
  const cleanups: Array<() => void> = [];
  installNativeAdvancedChat(
    {
      game,
      cls: (name: string) =>
        name.endsWith('MessageLog') ? messages : { get_current: () => ({ juggler }) },
      before: (target: Raw, method: string, fn: Function) =>
        cleanups.push(hooks.add(target, method, 'before', fn)),
      after: (target: Raw, method: string, fn: Function) =>
        cleanups.push(hooks.add(target, method, 'after', fn)),
      around: (target: Raw, method: string, fn: Function) =>
        cleanups.push(hooks.add(target, method, 'around', fn)),
      defer: (fn: () => void) => cleanups.push(fn),
    } as any,
    game,
  );
  const receive = (text: string, type = 'local') => {
    const message = { text, type };
    messages.textQueue.push(message);
    advanced.updateText(message);
    return message;
  };
  return {
    advanced,
    scroll,
    log,
    game,
    messages,
    muted,
    jobs,
    advance,
    receive,
    cleanup: () => cleanups.reverse().forEach((fn) => fn()),
  };
}

test('advanced receive batches 100 ms and remembers bottom before rows change its maximum', (t) => {
  const f = fixture();
  t.after(f.cleanup);
  f.receive('one');
  f.receive('two');
  f.advance(0.099);
  assert.equal(f.scroll.get_numChildren(), 0);
  f.advance(0.001);
  assert.equal(f.scroll.get_numChildren(), 2);
  assert.equal(f.scroll.position, 0);
  f.advance(0.149);
  assert.deepEqual(f.scroll.moves, []);
  f.advance(0.001);
  assert.equal(f.scroll.position, 50);
  f.scroll.moves.length = 0;
  f.receive('three');
  f.advance(0.1);
  f.receive('four');
  f.advance(0.1);
  f.advance(0.149);
  assert.deepEqual(f.scroll.moves, []);
  f.advance(0.001);
  assert.deepEqual(f.scroll.moves, [100]);
});

test('virtual row cap removes old messages and disposes legacy player options', (t) => {
  const f = fixture();
  t.after(f.cleanup);
  for (const text of ['one', 'two', 'three']) f.advanced.addText({ text });
  const first = f.scroll.getChildAt(0);
  f.advanced.addText({ text: '/ignored' });
  assert.equal(first.disposed, false);
  const options = new Display();
  f.advanced.playerChatOptions = options;
  f.scroll.addChildAt(options, 1);
  f.advanced.addText({ text: 'four' });
  assert.equal(f.scroll.get_numChildren(), 3);
  assert.deepEqual(
    f.scroll.children.map((row: Raw) => row.text),
    ['two', 'three', 'four'],
  );
  assert.ok(
    first.disposed || first.text !== 'one',
    'a pooled row must release the evicted message',
  );
  assert.equal(f.scroll.contentBottom(), 150);
  assert.equal(options.disposed, true);
  assert.equal(f.advanced.playerChatOptions, null);
});

test('reading history does not follow new rows and pending mute/block changes are rechecked', (t) => {
  const f = fixture(10);
  t.after(f.cleanup);
  for (const text of ['one', 'two', 'three']) f.advanced.addText({ text });
  f.scroll.position = 20;
  f.receive('new');
  f.receive('muted', 'global');
  const blocked = f.receive('blocked');
  f.muted.add('global');
  f.messages.textQueue = f.messages.textQueue.filter((m: Raw) => m !== blocked);
  f.advance(0.5);
  assert.deepEqual(
    f.scroll.children.map((row: Raw) => row.text),
    ['one', 'two', 'three'],
  );
  assert.equal(f.scroll.position, 20);
  assert.deepEqual(f.scroll.moves, []);
  assert.equal(f.scroll.contentBottom(), 200, 'muted and removed messages never enter the list');
  f.scroll.position = 150;
  f.scroll.dispatchEventWith('scroll');
  assert.equal(
    f.scroll.children.at(-1).text,
    'new',
    'offscreen message materializes when scrolled into view',
  );
});

test('channel toggles refresh retained history and cancel pending batches in either chat view', (t) => {
  const f = fixture();
  t.after(f.cleanup);
  f.receive('global history', 'global');
  f.advance(0.5);
  f.receive('pending local');
  f.log.toggleMuted('global', true);
  assert.deepEqual(
    f.scroll.children.map((row: Raw) => row.text),
    ['pending local'],
  );
  f.advance(0.5);
  assert.deepEqual(
    f.scroll.children.map((row: Raw) => row.text),
    ['pending local'],
  );
  assert.equal(f.messages.textQueue.length, 2, 'muting retains history for later unmute');
  f.log.toggleMuted('global', false);
  assert.deepEqual(
    f.scroll.children.map((row: Raw) => row.text),
    ['global history', 'pending local'],
  );
  let simpleRefreshes = 0;
  f.log.removeChild(f.advanced);
  f.log.simple = Object.assign(new Display(), { updateTexts: () => simpleRefreshes++ });
  f.log.addChild(f.log.simple);
  f.log.toggleMuted('local', true);
  assert.equal(simpleRefreshes, 1, 'the active simple view refreshes too');
});

test('clear, hide and disposal cancel pending batches without repopulating chat', () => {
  const f = fixture();
  f.receive('clear pending');
  clearLocalChat(f.game, f.messages);
  f.advance(1);
  assert.equal(f.scroll.get_numChildren(), 0);
  assert.equal(f.messages.textQueue.length, 0);
  f.receive('hide pending');
  f.advanced.dispatchEventWith('removedFromStage');
  f.advance(1);
  assert.equal(f.scroll.get_numChildren(), 0);
  f.receive('dispose pending');
  f.cleanup();
  f.advance(1);
  assert.equal(f.jobs.size, 0);
  assert.equal(f.scroll.get_numChildren(), 0);
  assert.equal(Object.hasOwn(f.advanced, 'clearMessages'), false);
});

test('unsafe disable rebuilds visible native rows only after the virtual hooks are gone', async () => {
  const f = fixture();
  f.receive('one');
  f.receive('two');
  f.advance(0.25);
  f.scroll.position = 20;
  f.cleanup();
  assert.equal(f.scroll.get_numChildren(), 0);
  await Promise.resolve();
  assert.deepEqual(
    f.scroll.children.map((row: Raw) => row.text),
    ['one', 'two'],
  );
  assert.equal(f.scroll.position, 20);
  assert.equal(f.jobs.size, 0, 'restoring native chat must not leave delayed plugin jumps');
});
