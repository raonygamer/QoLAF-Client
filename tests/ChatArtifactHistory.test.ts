import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { API } from '../src/api/Types';
import { bindGameClasses, type GameScene } from '../src/game/Bindings';
import type { ChatMessage } from '../src/game/ChatMessage';
import { installChatArtifactHistory } from '../src/chat/ChatArtifactHistory';
// @ts-expect-error actual host dispatcher
import { Hooks } from './fixtures/HostCore.js';

test('history scans newest first, retries pending rows and leaves settled rows alone', () => {
  const row = (text: string): ChatMessage => ({ text, timeout: 0 });
  const queue = [row('old'), row('middle'), row('new')];
  const advanced = new EventTarget();
  let active = true;
  const observed: string[] = [];
  const log = {
    advanced,
    contains: () => active,
    updateTexts(message: ChatMessage) {
      assert.ok(observed.includes(message.text), 'lookup precedes native delivery');
    },
  };
  const originalUpdate = log.updateTexts;
  const cleanups: (() => void)[] = [];
  const hooks = new Hooks();
  const api = {
    cls: () => ({ textQueue: queue }),
    before: (target: object, method: string, callback: (...args: never[]) => unknown) => {
      const remove = hooks.add(target, method, 'before', callback);
      cleanups.push(remove);
      return remove;
    },
    defer: (callback: () => void) => cleanups.push(callback),
  } as unknown as API;
  bindGameClasses(api);
  let settleAll = false;
  installChatArtifactHistory(api, { messageLog: log } as unknown as GameScene, {
    resolveText(text) {
      observed.push(text!);
      return settleAll || text === 'new';
    },
  });
  try {
    assert.deepEqual(observed, ['new', 'middle', 'old']);
    assert.deepEqual(
      queue.map((message) => message.artifactLinksScanned),
      [false, false, true],
    );
    observed.length = 0;
    settleAll = true;
    advanced.dispatchEvent(new Event('addedToStage'));
    assert.deepEqual(observed, ['middle', 'old']);
    observed.length = 0;
    advanced.dispatchEvent(new Event('addedToStage'));
    assert.deepEqual(observed, [], 'settled negative results are not retried on reopening');
    active = false;
    const received = row('received while Simple is open');
    log.updateTexts(received);
    assert.equal(received.artifactLinksScanned, true);
  } finally {
    cleanups.reverse().forEach((cleanup) => cleanup());
  }
  observed.length = 0;
  queue.push(row('after unload'));
  advanced.dispatchEvent(new Event('addedToStage'));
  assert.deepEqual(observed, []);
  assert.equal(log.updateTexts, originalUpdate);
});
