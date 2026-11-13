import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { API } from '../src/api/Types';
import { bindGameClasses } from '../src/game/Bindings';
import { installCreditRefresh } from '../src/network/CreditRefresh';
// @ts-expect-error production hook dispatcher
import { Hooks } from './fixtures/HostCore.js';

test('balance refresh coalesces requests and isolates reentrant listeners and pending unload callbacks', () => {
  type Reply = (message: { getInt(index: number): number }) => void;
  const requests: Reply[] = [];
  const events: string[] = [];
  let fail = false;
  class Manager {
    static FLUX = 0;
    nativeCalls = 0;
    listener: (() => void) | undefined;
    g = {
      rpc(name: string, reply: Reply) {
        assert.equal(name, 'getFluxAmount');
        if (fail) throw new Error('transport');
        requests.push(reply);
      },
      hud: {
        updateCredits() {
          events.push(`hud:${Manager.FLUX}`);
        },
      },
    };
    dispatchEventWith(name: string) {
      events.push(name);
      this.listener?.();
    }
    refresh(_callback?: () => void) {
      this.nativeCalls++;
    }
  }
  const cleanups: Array<() => void> = [];
  const hooks = new Hooks((error: unknown) => {
    throw error;
  });
  const api = {
    cls: (name: string) => (name === 'core.credits.CreditManager' ? Manager : {}),
    around(owner: object, name: string, callback: unknown) {
      const off = hooks.add(owner, name, 'around', callback);
      cleanups.push(off);
      return off;
    },
  } as unknown as API;
  bindGameClasses(api);
  installCreditRefresh(api);
  const manager = new Manager();
  try {
    manager.refresh(() => events.push('first'));
    manager.refresh(() => events.push('second'));
    manager.refresh();
    assert.equal(requests.length, 1);
    manager.listener = () => {
      manager.listener = undefined;
      manager.refresh(() => events.push('reentrant'));
    };
    requests[0]({ getInt: () => 123 });
    assert.deepEqual(events, ['hud:123', 'refresh', 'first', 'second']);
    assert.equal(requests.length, 2);
    requests[1]({ getInt: () => 456 });
    assert.deepEqual(events.slice(-3), ['hud:456', 'refresh', 'reentrant']);
    fail = true;
    assert.throws(() => manager.refresh(), /transport/);
    fail = false;
    manager.refresh(() => events.push('pending'));
    assert.equal(requests.length, 3, 'failed submission must not block the next refresh');
  } finally {
    cleanups.reverse().forEach((off) => off());
  }
  requests[2]({ getInt: () => 789 });
  assert.deepEqual(events.slice(-3), ['hud:789', 'refresh', 'pending']);
  manager.refresh();
  assert.equal(manager.nativeCalls, 1);
});
