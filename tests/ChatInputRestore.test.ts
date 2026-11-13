import test from 'node:test';
import assert from 'node:assert/strict';
import type { API } from '../src/api/Types';
import type { GameScene } from '../src/game/Bindings';
import { Display } from './fixtures/NativeGame';
import { restoreChatInputOnUnload } from '../src/chat/ChatInputRestore';

test('hot reload restores input geometry after adapters and updates the DOM placement', () => {
  const input = Object.assign(new Display(), {
    rectangle: [0, 0],
    updatePlacement(this: Display & { rectangle: number[] }) {
      this.rectangle = [this.get_width(), this.get_height()];
    },
  });
  input.set_width(500);
  input.set_height(24);
  input.set_y(24);
  const tabs = new Display();
  tabs.set_width(500);
  tabs.set_height(24);
  const chat = Object.assign(new Display(), { input, tabs });
  chat.set_x(200);
  chat.set_y(600);
  const game = { chatInput: chat, get_isLeaving: () => false } as unknown as GameScene;
  for (let cycle = 0; cycle < 3; cycle++) {
    const cleanups: (() => void)[] = [];
    const api = {
      defer: (cleanup: () => void) => {
        cleanups.push(cleanup);
        return cleanup;
      },
    } as API;
    restoreChatInputOnUnload(api, game);
    input.set_width(508);
    input.set_height(39);
    input.set_y(32);
    tabs.set_width(672);
    chat.set_x(20);
    // Another adapter restores its intermediate measurements first.
    api.defer(() => {
      input.set_width(680);
      input.set_height(39);
    });
    cleanups.reverse().forEach((cleanup) => cleanup());
    assert.deepEqual(input.rectangle, [500, 24]);
    assert.equal(input.get_y(), 24);
    assert.equal(tabs.get_width(), 500);
    assert.equal(chat.get_x(), 200);
    assert.equal(chat.get_scaleX(), 1);
  }
});
