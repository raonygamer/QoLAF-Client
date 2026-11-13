import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { API } from '../src/api/Types';
import { bindGameClasses, type GameScene } from '../src/game/Bindings';
import { installNativeEmperorCoordination } from '../src/ipc/NativeEmperorCoordination';
// @ts-expect-error actual host hook dispatcher
import { Hooks } from './fixtures/HostCore.js';

function fixture() {
  const cleanup: Array<() => void> = [];
  const timers = new Map<() => void, number>();
  const warnings: string[] = [],
    submitted: string[] = [];
  let text = '',
    active = true,
    leaving = false;
  const chat = {
    floatingContext: null as object | null,
    input: {
      get_text: () => text,
      set_text: (value: string) => {
        text = value;
      },
    },
    isActive: () => active,
    updateTab() {},
    sendMessage() {
      submitted.push(text);
      text = '';
      return true;
    },
  };
  const game = {
    chatInput: chat,
    messageLog: {},
    get_isLeaving: () => leaving,
    shipManager: { enemiesById: { h: {} }, killed() {} },
  };
  const hooks = new Hooks((error: unknown) => {
    throw error;
  });
  const hook = (kind: string) => (target: object, key: string, fn: Function) => {
    const dispose = hooks.add(target, key, kind, fn);
    cleanup.push(dispose);
    return dispose;
  };
  const api = {
    game,
    cls: () => ({ write: (value: string) => warnings.push(value) }),
    before: hook('before'),
    around: hook('around'),
    defer: (fn: () => void) => cleanup.push(fn),
    interval: (fn: () => void, ms: number) => {
      timers.set(fn, ms);
      const stop = () => {
        timers.delete(fn);
      };
      cleanup.push(stop);
      return stop;
    },
  } as unknown as API;
  bindGameClasses(api);
  installNativeEmperorCoordination(api, game as unknown as GameScene, () => {});
  return {
    chat,
    api,
    submitted,
    warnings,
    text: (value: string) => {
      text = value;
    },
    leave: () => {
      leaving = true;
    },
    active: (value: boolean) => {
      active = value;
    },
    flush: () => {
      for (const [fn, ms] of [...timers]) if (ms === 150) fn();
    },
    cleanup: () => cleanup.reverse().forEach((fn) => fn()),
  };
}

test('unavailable Emperor IPC routes shorthand through ordinary chat and warns only once', () => {
  const f = fixture();
  f.text(' /XR ');
  assert.equal(f.chat.sendMessage(), true);
  assert.deepEqual(f.submitted, ['xr']);
  assert.deepEqual(f.warnings, []);
  f.flush();
  f.flush();
  assert.equal(f.warnings.length, 1);
  assert.match(f.warnings[0], /Emperor status IPC is unavailable/);
  f.cleanup();
});

test('delayed Emperor warning is retired on scene departure or unsafe disable', () => {
  for (const retire of ['leave', 'cleanup'] as const) {
    const f = fixture();
    f.text('/yr');
    f.chat.sendMessage();
    f[retire]();
    f.flush();
    assert.deepEqual(f.warnings, []);
    if (retire !== 'cleanup') f.cleanup();
  }
});

test('floating, hidden and ordinary messages retain their existing submission path', () => {
  const f = fixture();
  f.chat.floatingContext = {};
  f.text('/zr');
  f.chat.sendMessage();
  f.chat.floatingContext = null;
  f.active(false);
  f.text('/xr');
  f.chat.sendMessage();
  f.active(true);
  f.text('hello');
  f.chat.sendMessage();
  f.flush();
  assert.deepEqual(f.submitted, ['/zr', '/xr', 'hello']);
  assert.deepEqual(f.warnings, []);
  f.cleanup();
});
