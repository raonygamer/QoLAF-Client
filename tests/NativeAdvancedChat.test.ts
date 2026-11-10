import assert from 'node:assert/strict';
import { test } from 'node:test';
import { installNativeAdvancedChat } from '../src/chat/NativeAdvancedChat';
import { clearLocalChat } from '../src/chat/LocalClientCommands';
import { Display } from './fixtures/NativeGame';
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
      return Math.max(0, this.get_numChildren() * 50 - 50);
    },
    scrollToPosition(_x: number, y: number) {
      this.position = y;
      this.moves.push(y);
    },
    arrange() {},
  });
  class Row extends Display {
    text = '';
    set_text(text: string) {
      this.text = text;
    }
  }
  const muted = new Set<string>();
  const log: Raw = Object.assign(new Display(), {
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
  log.advanced = advanced;
  log.addChild(advanced);
  const hooks = new Hooks();
  const cleanups: Array<() => void> = [];
  installNativeAdvancedChat(
    {
      cls: (name: string) =>
        name.endsWith('MessageLog') ? messages : { get_current: () => ({ juggler }) },
      before: (target: Raw, method: string, fn: Function) =>
        cleanups.push(hooks.add(target, method, 'before', fn)),
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

test('source row cap is exact for native addText and ignores/disposes player options', (t) => {
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
  assert.equal(first.disposed, true);
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
    ['one', 'two', 'three', 'new'],
  );
  assert.equal(f.scroll.position, 20);
  assert.deepEqual(f.scroll.moves, []);
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
