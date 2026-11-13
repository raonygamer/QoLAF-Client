import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { API } from '../src/api/Types';
import { bindGameClasses, type GameScene } from '../src/game/Bindings';
import { installNativeChatOverlays } from '../src/chat/NativeChatOverlays';
import { Display } from './fixtures/NativeGame';

test('a newly opened overlay is below both chat elements on the first frame', () => {
  const previousWindow = Object.getOwnPropertyDescriptor(globalThis, 'window');
  const target = Object.assign(new EventTarget(), { document: { activeElement: null } });
  Object.defineProperty(globalThis, 'window', { configurable: true, value: target });
  const cleanups: Array<() => void> = [];
  const frames: Array<(event: { game: GameScene }) => void> = [];
  const shown: { container: Display }[] = [];
  bindGameClasses({ cls: () => ({ shown }) } as unknown as API);
  const parent = new Display();
  const background = new Display();
  const log = new Display();
  let placements = 0;
  const chat = Object.assign(new Display(), {
    input: { element: null, updatePlacement: () => placements++ },
    isActive: () => false,
    toggleChatMode() {},
    closeChat() {},
  });
  let leaving = false;
  const game = {
    chatInput: chat,
    messageLog: log,
    get_isLeaving: () => leaving,
  } as unknown as GameScene;
  const api = {
    game,
    defer: (cleanup: () => void) => cleanups.push(cleanup),
    on: (_event: string, callback: (event: { game: GameScene }) => void) => frames.push(callback),
  } as unknown as API;
  for (const child of [background, log, chat]) parent.addChild(child);
  log.set_visible(false);
  try {
    installNativeChatOverlays(api, game);
    for (let screen = 0; screen < 3; screen++) {
      const overlay = new Display();
      parent.addChild(overlay);
      frames.forEach((frame) => frame({ game }));
      assert.deepEqual(parent.children.slice(-3), [overlay, log, chat]);
      assert.equal(log.get_visible(), true);
    }
    assert.equal(placements, 3);
    const tooltip = new Display();
    parent.addChild(tooltip);
    shown.push({ container: tooltip });
    frames.forEach((frame) => frame({ game }));
    assert.deepEqual(parent.children.slice(-3), [log, chat, tooltip]);
    frames.forEach((frame) => frame({ game }));
    assert.deepEqual(parent.children.slice(-3), [log, chat, tooltip]);
    const before = [...parent.children];
    leaving = true;
    frames.forEach((frame) => frame({ game }));
    assert.deepEqual(parent.children, before);
    assert.equal(placements, 5);
    leaving = false;
  } finally {
    cleanups.reverse().forEach((cleanup) => cleanup());
    if (previousWindow) Object.defineProperty(globalThis, 'window', previousWindow);
    else Reflect.deleteProperty(globalThis, 'window');
  }
  assert.equal(parent.getChildIndex(log), 1);
  assert.equal(parent.getChildIndex(chat), 2);
  assert.equal(log.get_visible(), false);
});
