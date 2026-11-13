import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { API } from '../src/api/Types';
import { bindGameClasses } from '../src/game/Bindings';
import { installWarpAnnouncement } from '../src/chat/WarpAnnouncement';
// @ts-expect-error real host hook dispatcher
import { Hooks } from './fixtures/HostCore.js';

test('Argoon spelling is scoped to the original player ID and warp announcement', () => {
  const output: string[] = [];
  const log = {
    writeChatMsg: (_channel: string, text: string) => {
      output.push(text);
    },
  };
  class Manager {
    destination = 'Argon';
    initWarpJump(_message: object) {
      log.writeChatMsg('join_leave', 'TheSerene warp jumped to ' + this.destination);
      log.writeChatMsg('local', 'TheSerene warp jumped to Argon');
    }
  }
  const hooks = new Hooks();
  const cleanups: (() => void)[] = [];
  const api = {
    cls: (name: string) => (name.endsWith('.PlayerManager') ? Manager : log),
    around: (owner: object, key: string, fn: (...args: never[]) => unknown) => {
      const off = hooks.add(owner, key, 'around', fn);
      cleanups.push(off);
      return off;
    },
  } as unknown as API;
  bindGameClasses(api);
  installWarpAnnouncement(api);
  const manager = new Manager();
  try {
    manager.initWarpJump({ length: 1, getString: () => 'kong4106679' });
    assert.deepEqual(output.splice(0), [
      'TheSerene warp jumped to Argoon',
      'TheSerene warp jumped to Argon',
    ]);
    manager.initWarpJump({ length: 1, getString: () => 'different-id' });
    assert.equal(output.shift(), 'TheSerene warp jumped to Argon');
    output.length = 0;
    manager.destination = 'Hyperion';
    manager.initWarpJump({ length: 1, getString: () => 'kong4106679' });
    assert.equal(output.shift(), 'TheSerene warp jumped to Hyperion');
    log.writeChatMsg('join_leave', 'TheSerene warp jumped to Argon');
    assert.equal(output.at(-1), 'TheSerene warp jumped to Argon');
  } finally {
    cleanups.reverse().forEach((off) => off());
  }
  manager.destination = 'Argon';
  manager.initWarpJump({ length: 1, getString: () => 'kong4106679' });
  assert.equal(output.at(-2), 'TheSerene warp jumped to Argon');
});
