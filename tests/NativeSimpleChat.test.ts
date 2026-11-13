import { bindGameClasses, type GameScene } from '../src/game/Bindings';
import { onChatViewInvalidation } from '../src/chat/ChatViewInvalidation';
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { installNativeSimpleChat } from '../src/chat/NativeSimpleChat';
import type { Raw } from '../src/api/Types';
// @ts-expect-error actual host hooks
import { Hooks } from './fixtures/HostCore.js';

function fixture() {
  const hooks = new Hooks();
  const cleanups: (() => void)[] = [];
  const messages = { textQueue: [] as Raw[] };
  const tf = {
    text: '',
    writes: 0,
    get_text() {
      return this.text;
    },
    set_text(text: string) {
      this.text = text;
      this.writes++;
    },
  };
  const simple = { tf, nextTimeout: 0, update() {}, updateTexts() {} };
  const log = {
    simple,
    advanced: false,
    advancedUpdates: 0,
    contains(view: unknown) {
      return view === simple && !this.advanced;
    },
    isMuted(type: string) {
      return type === 'muted';
    },
    updateTexts() {
      this.advancedUpdates++;
    },
    toggleView() {
      this.advanced = !this.advanced;
      if (!this.advanced) tf.set_text('cached native projection');
    },
  };
  const game = { messageLog: log, time: 1000 };
  const api: any = {
    cls: () => messages,
    defer: (cleanup: () => void) => cleanups.push(cleanup),
    around: (object: Raw, name: string, fn: Function) =>
      cleanups.push(hooks.add(object, name, 'around', fn)),
    after: (object: Raw, name: string, fn: Function) =>
      cleanups.push(hooks.add(object, name, 'after', fn)),
  };
  bindGameClasses(api);
  installNativeSimpleChat(api, game as unknown as GameScene);
  const enqueue = (text: string, timeout = 2000, type = 'local') => {
    messages.textQueue.push({ text, timeout, type });
    log.updateTexts();
  };
  return {
    game,
    log,
    simple,
    tf,
    messages,
    enqueue,
    cleanup: () => cleanups.reverse().forEach((fn) => fn()),
  };
}

test('simple chat batches received rows, caps at ten, skips muted rows and expires exactly on time', () => {
  const f = fixture();
  for (let i = 0; i < 12; i++) f.enqueue(`row ${i}`);
  f.enqueue('hidden', 2000, 'muted');
  f.simple.update();
  assert.equal(f.tf.text, '');
  f.game.time = 1100;
  f.simple.update();
  assert.equal(f.tf.text, Array.from({ length: 10 }, (_, i) => `row ${i + 2}\n`).join(''));
  assert.equal(f.simple.nextTimeout, 2000);
  const writes = f.tf.writes;
  f.game.time = 1999;
  f.simple.update();
  assert.equal(f.tf.writes, writes);
  f.game.time = 2000;
  f.simple.update();
  assert.equal(f.tf.text, '');
  assert.equal(f.simple.nextTimeout, 0);
  f.cleanup();
});

test('expiry uses earliest visible timeout and advanced view retains its native receive path', () => {
  const f = fixture();
  f.enqueue('older', 1200);
  f.enqueue('newer', 3000);
  f.game.time = 1100;
  f.simple.update();
  assert.equal(f.simple.nextTimeout, 1200);
  f.game.time = 1200;
  f.simple.update();
  assert.equal(f.tf.text, 'newer\n');
  f.log.toggleView();
  f.enqueue('advanced arrival', 3000);
  assert.equal(f.log.advancedUpdates, 1);
  f.log.toggleView();
  assert.equal(f.tf.text, 'newer\nadvanced arrival\n');
  f.messages.textQueue.length = 0;
  f.simple.updateTexts();
  assert.equal(f.tf.text, '');
  f.cleanup();
  f.log.updateTexts();
  assert.equal(f.log.advancedUpdates, 2);
});

test('simple chat invalidates hover cards before rebuilds and expiry without waiting for a hover frame', () => {
  const f = fixture();
  const beforeRebuild: string[] = [];
  const unsubscribe = onChatViewInvalidation(f.simple, () => beforeRebuild.push(f.tf.text));
  try {
    f.enqueue('temporary', 1200);
    f.game.time = 1100;
    f.simple.update();
    assert.deepEqual(beforeRebuild, ['']);
    f.game.time = 1200;
    f.simple.update();
    assert.deepEqual(beforeRebuild, ['', 'temporary\n']);
    assert.equal(f.tf.text, '');
    unsubscribe();
    f.simple.updateTexts();
    assert.equal(beforeRebuild.length, 2);
  } finally {
    unsubscribe();
    f.cleanup();
  }
});
