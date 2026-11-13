import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { API } from '../src/api/Types';
import { bindGameClasses } from '../src/game/Bindings';
import { installRoamingInput } from '../src/movement/RoamingInput';
// @ts-expect-error actual host dispatcher
import { Hooks } from './fixtures/HostCore.js';

test('roaming gates controls on chat focus and preserves automation, Enter priority and native dead input', () => {
  const events: string[] = [];
  class Chat {
    active = true;
    element = { ownerDocument: { activeElement: null as object | null } };
    input = { element: this.element };
    isActive() {
      return this.active;
    }
    toggleChatMode() {
      events.push('toggle');
      this.active = !this.active;
    }
    closeChat() {
      events.push('close');
      this.active = false;
    }
    next() {
      events.push('next');
    }
    previous() {
      events.push('previous');
    }
  }
  class Roaming {
    commandable = true;
    loaded = true;
    key = 0;
    fail = false;
    me = { get_commandable: () => this.commandable };
    g = { chatInput: new Chat(), automationManager: { controlsClaimed: false } };
    input = { isKeyPressed: (code: number) => code === this.key };
    get_loaded() {
      return this.loaded;
    }
    updateCommands() {
      events.push('commands');
    }
    checkAccelerate(blocked: boolean) {
      events.push(`throttle:${blocked}`);
    }
    updateInput() {
      if (this.fail) throw new Error('native');
      if (!this.commandable || !this.loaded) {
        events.push('native-gate');
        return;
      }
      if (this.g.chatInput.isActive()) this.checkAccelerate(true);
      else this.updateCommands();
    }
  }
  const hooks = new Hooks(() => {}),
    cleanup: Array<() => void> = [];
  const api = {
    cls: (name: string) =>
      name === 'core.states.gameStates.RoamingState'
        ? Roaming
        : name === 'core.hud.components.chat.ChatInputText'
          ? Chat
          : {},
    around(owner: object, name: string, callback: unknown) {
      const off = hooks.add(owner, name, 'around', callback);
      cleanup.push(off);
      return off;
    },
  } as unknown as API;
  bindGameClasses(api);
  installRoamingInput(api);
  const state = new Roaming();
  try {
    const chat = state.g.chatInput;
    state.updateInput();
    assert.deepEqual(events.splice(0), ['commands']);
    assert.equal(chat.isActive(), true);
    chat.element.ownerDocument.activeElement = chat.element;
    state.updateInput();
    assert.deepEqual(events.splice(0), ['throttle:true']);
    state.g.automationManager.controlsClaimed = true;
    state.key = 40;
    state.updateInput();
    assert.deepEqual(events.splice(0), ['next', 'commands']);
    state.key = 13;
    state.updateInput();
    assert.deepEqual(events.splice(0), ['toggle']);
    state.commandable = false;
    state.updateInput();
    assert.deepEqual(events.splice(0), ['native-gate']);
    state.commandable = true;
    state.key = 0;
    chat.active = true;
    chat.element.ownerDocument.activeElement = null;
    state.fail = true;
    assert.throws(() => state.updateInput(), /native/);
    assert.equal(chat.isActive(), true, 'exception cannot leak the scoped focus override');
    assert.equal(cleanup.length, 2, 'frame execution does not accumulate temporary hooks');
  } finally {
    cleanup.reverse().forEach((off) => off());
  }
  state.fail = false;
  state.updateInput();
  assert.deepEqual(events, ['throttle:true']);
});
