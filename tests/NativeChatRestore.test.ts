import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { ChatMessage } from '../src/game/ChatMessage';
import { NativeChatRestore } from '../src/chat/NativeChatRestore';

function fixture(position = 30) {
  const rows: ChatMessage[] = [];
  const scroll = {
    position,
    maximum: 100,
    get_verticalScrollPosition() {
      return this.position;
    },
    get_maxVerticalScrollPosition() {
      return this.maximum;
    },
    removeChildren() {
      rows.length = 0;
    },
    arrange() {
      this.maximum = rows.length * 50;
    },
    scrollToPosition(_x: number, y: number) {
      this.position = y;
    },
  };
  let hooked = true;
  const view = {
    scroll,
    addText(message: ChatMessage) {
      assert.equal(hooked, false, 'native rebuilding must wait for hook removal');
      rows.push(message);
    },
  };
  return {
    view,
    rows,
    removeHooks: () => {
      hooked = false;
    },
  };
}
const messages = [
  { text: 'retained', type: 'local' },
  { text: 'new', type: 'clan' },
] as ChatMessage[];

test('unsafe disable restores native chat after cleanup and preserves reading position', async () => {
  for (const [position, expected] of [
    [30, 30],
    [100, 150],
  ]) {
    const f = fixture(position);
    const restore = new NativeChatRestore(f.view);
    const queue = [...messages, { text: 'third', type: 'local' } as ChatMessage];
    restore.schedule(
      () => true,
      () => queue,
    );
    assert.deepEqual(f.rows, []);
    f.removeHooks();
    f.view.scroll.position = 0; // virtual list teardown
    await Promise.resolve();
    assert.deepEqual(f.rows, queue);
    assert.equal(f.view.scroll.position, expected);
  }
});

test('old teardown cannot overwrite an immediately re-enabled or departed scene', async () => {
  const f = fixture();
  new NativeChatRestore(f.view).schedule(
    () => true,
    () => messages,
  );
  const next = new NativeChatRestore(f.view);
  f.removeHooks();
  await Promise.resolve();
  assert.deepEqual(f.rows, []);
  next.schedule(
    () => false,
    () => messages,
  );
  await Promise.resolve();
  assert.deepEqual(f.rows, []);
});

test('restoration reads the current filtered queue once and clamps a shortened history', async () => {
  const f = fixture(60);
  const restore = new NativeChatRestore(f.view);
  let queue = messages;
  restore.schedule(
    () => true,
    () => queue,
  );
  restore.schedule(
    () => true,
    () => messages,
  );
  queue = messages.slice(0, 1);
  f.removeHooks();
  await Promise.resolve();
  assert.deepEqual(f.rows, queue);
  assert.equal(f.view.scroll.position, 50);
});
