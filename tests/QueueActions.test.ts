import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { API } from '../src/api/Types';
import { bindGameClasses } from '../src/game/Bindings';
import { installQueueActions } from '../src/pvp/QueueActions';
// @ts-expect-error actual host hook dispatcher
import { Hooks } from './fixtures/HostCore.js';

test('queue buttons preserve state during service loss and resume native actions after reconnect', () => {
  class QueueButton {
    leaving = false;
    connected = true;
    waiting = false;
    accepted = false;
    removedQueues = 0;
    messages: string[] = [];
    events: object[] = [];
    g = {
      get_isLeaving: () => this.leaving,
      serviceConnection: { get_connected: () => this.connected },
    };
    join(event: object) {
      this.removedQueues++;
      this.waiting = true;
      this.messages.push('tryJoinQueue');
      this.events.push(event);
    }
    leave(event: object) {
      this.waiting = true;
      this.messages.push('tryLeaveQueue');
      this.events.push(event);
    }
    accept(event: object) {
      this.waiting = true;
      this.accepted = true;
      this.messages.push('acceptMatch');
      this.events.push(event);
    }
  }
  class QuickMatch extends QueueButton {}
  // The real classes own separate implementations of these three methods.
  for (const action of ['join', 'leave', 'accept'] as const) {
    Object.defineProperty(QuickMatch.prototype, action, {
      value: QueueButton.prototype[action],
      configurable: true,
      writable: true,
    });
  }
  const hooks = new Hooks((error: unknown) => {
    throw error;
  });
  const cleanups: (() => void)[] = [];
  const api = {
    cls: (name: string) =>
      name === 'core.hud.components.ButtonPvPQuickMatch' ? QuickMatch : QueueButton,
    around: (owner: object, key: string, callback: (...args: never[]) => unknown) => {
      const off = hooks.add(owner, key, 'around', callback);
      cleanups.push(off);
      return off;
    },
  } as unknown as API;
  bindGameClasses(api);
  installQueueActions(api);
  const event = {};
  try {
    for (const Button of [QueueButton, QuickMatch]) {
      for (const action of ['join', 'leave', 'accept'] as const) {
        const button = new Button();
        button.connected = false;
        button[action](event);
        button.connected = true;
        button.leaving = true;
        button[action](event);
        assert.equal(button.waiting, false);
        assert.equal(button.accepted, false);
        assert.equal(button.removedQueues, 0);
        assert.deepEqual(button.messages, []);
        button.leaving = false;
        button[action](event);
        assert.equal(button.waiting, true);
        assert.equal(button.accepted, action === 'accept');
        assert.equal(button.removedQueues, action === 'join' ? 1 : 0);
        assert.deepEqual(button.events, [event]);
        assert.deepEqual(button.messages, [
          {
            join: 'tryJoinQueue',
            leave: 'tryLeaveQueue',
            accept: 'acceptMatch',
          }[action],
        ]);
      }
    }
  } finally {
    cleanups.reverse().forEach((off) => off());
  }
  const restored = new QueueButton();
  restored.connected = false;
  restored.join(event);
  assert.equal(restored.waiting, true, 'unload restores native methods');
});
