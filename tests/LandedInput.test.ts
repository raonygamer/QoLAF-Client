import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import type { API } from '../src/api/Types';
import { bindGameClasses } from '../src/game/Bindings';
import { installLandedInput } from '../src/movement/LandedInput';
// @ts-expect-error original source boundary
import { install } from './fixtures/As3Methods.js';
// @ts-expect-error actual host dispatcher
import { Hooks } from './fixtures/HostCore.js';

test('landed keys match source focus and priority rules without changing draw or loading gates', () => {
  class Landed {
    events: string[] = [];
    _loaded = true;
    active = false;
    focused = false;
    leaving = false;
    blocked = false;
    key = 'none';
    menuHud: { update: () => void } | null = null;
    element = { ownerDocument: { activeElement: null as object | null } };
    chat = {
      isActive: () => this.active,
      hasInputFocus: () => this.active && this.focused,
      closeChat: () => {
        this.events.push('close');
        this.active = false;
      },
      toggleChatMode: () => {
        this.events.push('toggle');
      },
      next: () => {
        this.events.push('next');
      },
      previous: () => {
        this.events.push('previous');
      },
      showWhatsNewIfNeeded() {},
      input: { element: this.element },
    };
    g = {
      get_isLeaving: () => this.leaving,
      isLeaving: false,
      blockHotkeys: false,
      chatInput: this.chat,
      draw: () => {
        this.events.push('draw');
      },
    };
    keybinds = {
      isEscPressed: false,
      isEnterPressed: false,
      get_isEscPressed: () => this.key === 'escape',
      get_isEnterPressed: () => this.key === 'enter',
      isInputPressed: (action: number) => action === 10 && this.key === 'land',
    };
    input = {
      isKeyPressed: (key: number) =>
        key === (this.key === 'down' ? 40 : this.key === 'up' ? 38 : -1),
    };
    leave() {
      this.events.push('leave');
    }
    hideMenu() {
      this.events.push('hide');
      this.menuHud = null;
    }
    execute() {
      this.events.push('vanilla');
    }
    prepare(menu: boolean) {
      this.g.isLeaving = this.leaving;
      this.g.blockHotkeys = this.blocked;
      this.keybinds.isEscPressed = this.key === 'escape';
      this.keybinds.isEnterPressed = this.key === 'enter';
      this.element.ownerDocument.activeElement = this.focused ? this.element : null;
      if (menu)
        this.menuHud = {
          update: () => {
            this.events.push('menu');
          },
        };
    }
  }
  const original = Landed.prototype.execute;
  const cleanup: Array<() => void> = [];
  const hooks = new Hooks((error: unknown) => {
    throw error;
  });
  const api = {
    cls: (name: string) => (name === 'core.states.gameStates.LandedState' ? Landed : {}),
    around(owner: object, name: string, callback: unknown) {
      const off = hooks.add(owner, name, 'around', callback);
      cleanup.push(off);
      return off;
    },
  } as unknown as API;
  bindGameClasses(api);
  installLandedInput(api);
  const source = readFileSync(new URL('./fixtures/landed/LandedState.as', import.meta.url), 'utf8');
  let cases = 0;
  try {
    for (const active of [false, true])
      for (const focused of [false, true])
        for (const _loaded of [false, true])
          for (const blocked of [false, true])
            for (const leaving of [false, true])
              for (const menu of [false, true])
                for (const key of ['none', 'escape', 'enter', 'land', 'down', 'up']) {
                  const options = { active, focused, _loaded, blocked, leaving, key };
                  const actual = Object.assign(new Landed(), options);
                  const expected = Object.assign(new Landed(), options);
                  actual.prepare(menu);
                  expected.prepare(menu);
                  install(expected, source, ['execute']);
                  expected.execute();
                  actual.execute();
                  assert.deepEqual(
                    actual.events,
                    expected.events,
                    JSON.stringify({ ...options, menu }),
                  );
                  assert.equal(actual.active, expected.active);
                  cases++;
                }
  } finally {
    cleanup.reverse().forEach((off) => off());
  }
  assert.equal(cases, 384);
  assert.equal(Landed.prototype.execute, original);
});
