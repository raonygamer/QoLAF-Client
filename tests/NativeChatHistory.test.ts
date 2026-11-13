import type { GameScene } from '../src/game/Bindings';
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { ChatHistory } from '../src/chat/ChatHistory';
import { installNativeChatHistory } from '../src/chat/NativeChatHistory';
import type { Raw } from '../src/api/Types';
// @ts-expect-error actual host hooks
import { Hooks } from './fixtures/HostCore.js';

function fixture(history: ChatHistory) {
  const hooks = new Hooks();
  const cleanups: (() => void)[] = [];
  const listeners = new Map<string, () => void>();
  const input = {
    text: '',
    selection: [0, 0],
    get_text() {
      return this.text;
    },
    set_text(text: string) {
      this.text = text;
    },
    selectRange(start: number, end: number) {
      this.selection = [start, end];
    },
    addEventListener(key: string, fn: () => void) {
      listeners.set(key, fn);
    },
    removeEventListener(key: string) {
      listeners.delete(key);
    },
  };
  const chat = {
    input,
    active: false,
    nativeTraversals: 0,
    isActive() {
      return this.active;
    },
    toggleChatMode() {
      this.active = !this.active;
    },
    sendMessage() {
      this.input.set_text('');
    },
    previous() {
      this.nativeTraversals++;
    },
    next() {
      this.nativeTraversals++;
    },
  };
  const api: Raw = {
    before: (object: Raw, name: string, fn: Function) =>
      cleanups.push(hooks.add(object, name, 'before', fn)),
    after: (object: Raw, name: string, fn: Function) =>
      cleanups.push(hooks.add(object, name, 'after', fn)),
    around: (object: Raw, name: string, fn: Function) =>
      cleanups.push(hooks.add(object, name, 'around', fn)),
    defer: (fn: () => void) => cleanups.push(fn),
  };
  installNativeChatHistory(api as any, { chatInput: chat } as unknown as GameScene, history);
  return { chat, input, listeners, cleanup: () => cleanups.reverse().forEach((fn) => fn()) };
}

test('native history records complete local commands, preserves drafts and restores native hooks on cleanup', () => {
  const history = new ChatHistory();
  const { chat, input, listeners, cleanup } = fixture(history);
  chat.toggleChatMode();
  input.text = '/echo';
  chat.sendMessage();
  input.text = '/timers';
  chat.sendMessage();
  input.text = '/timers';
  chat.sendMessage();
  assert.equal(history.length, 2);
  input.text = 'unfinished draft';
  listeners.get('change')!();
  chat.previous();
  assert.equal(input.text, '/timers');
  chat.previous();
  assert.equal(input.text, '/echo');
  input.text = 'edited old entry';
  listeners.get('change')!();
  chat.next();
  assert.equal(input.text, '/timers');
  chat.next();
  assert.equal(input.text, 'unfinished draft');
  assert.deepEqual(input.selection, [16, 16]);
  assert.equal(chat.nativeTraversals, 0);
  cleanup();
  assert.equal(listeners.size, 0);
  chat.previous();
  assert.equal(chat.nativeTraversals, 1);
});

test('history survives replacement game instances without retaining the old editor draft', () => {
  const history = new ChatHistory();
  const first = fixture(history);
  first.chat.toggleChatMode();
  first.input.text = '/local sample';
  first.chat.sendMessage();
  first.input.text = 'old room draft';
  first.chat.previous();
  first.cleanup();
  const second = fixture(history);
  second.chat.toggleChatMode();
  second.input.text = 'new room draft';
  second.chat.previous();
  assert.equal(second.input.text, '/local sample');
  second.chat.next();
  assert.equal(second.input.text, 'new room draft');
  second.cleanup();
});

test('opening the editor starts from the newest entry and empty submissions do not erase history', () => {
  const history = new ChatHistory(2);
  const { chat, input, cleanup } = fixture(history);
  for (const text of ['one', 'two', 'three', '']) {
    input.text = text;
    chat.sendMessage();
  }
  chat.previous();
  chat.previous();
  assert.equal(input.text, 'two');
  chat.toggleChatMode();
  chat.previous();
  assert.equal(input.text, 'three');
  assert.equal(history.length, 2);
  cleanup();
});
