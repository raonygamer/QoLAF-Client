import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import type { API } from '../src/api/Types';
import { bindGameClasses } from '../src/game/Bindings';
import { installLandedExploreInput } from '../src/movement/LandedExploreInput';
// @ts-expect-error captured native methods
import * as native from './fixtures/NativeLandedExecute.js';
const { createLandedStateExecute, createLandedExploreExecute } = native;
// @ts-expect-error source execution boundary
import { install } from './fixtures/As3Methods.js';
// @ts-expect-error actual host dispatcher
import { Hooks } from './fixtures/HostCore.js';

test('exploration delegates leave keys once while preserving native landed guards and child screens', () => {
  class SelectTeam {}
  class Report {}
  class Landed {
    execute(): void {}
    leave() {
      this.leaves++;
    }
    hideMenu() {
      this.menusClosed++;
      this.menuHud = null;
    }
    leaves = 0;
    menusClosed = 0;
    draws = 0;
    updates = 0;
    closes = 0;
    reverted = 0;
    active = true;
    loaded = true;
    blocked = false;
    leaving = false;
    key = 'escape';
    child = 'normal';
    leaveButton = {
      visible: false,
      set_visible(value: boolean) {
        this.visible = value;
      },
    };
    menuHud: { update: () => void } | null = null;
    get _loaded() {
      return this.loaded;
    }
    keybinds = {
      get_isEscPressed: () => this.key === 'escape',
      get_isEnterPressed: () => false,
      isInputPressed: () => this.key === 'land',
    };
    input = { isKeyPressed: () => false };
    sceneSM = {
      inState: (state: object) =>
        this.child === 'select'
          ? state === SelectTeam
          : this.child === 'report' && state === Report,
      revertState: () => {
        this.reverted++;
      },
    };
    g = {
      get_isLeaving: () => this.leaving,
      draw: () => {
        this.draws++;
      },
      get blockHotkeys() {
        return false;
      },
      chatInput: {
        isActive: () => this.active,
        closeChat: () => {
          this.closes++;
          this.active = false;
        },
        toggleChatMode() {},
        next() {},
        previous() {},
      },
    };
    constructor() {
      Object.defineProperty(this.g, 'blockHotkeys', { get: () => this.blocked });
    }
  }
  Landed.prototype.execute = createLandedStateExecute();
  class Explore extends Landed {}
  Explore.prototype.execute = createLandedExploreExecute(Landed, SelectTeam, Report);
  const broken = new Explore();
  broken.execute!();
  assert.equal(broken.closes, 1);
  assert.equal(
    broken.leaves,
    1,
    'captured native duplicate handler incorrectly leaves after closing chat',
  );
  const original = Explore.prototype.execute;
  const classes: Record<string, unknown> = {
    'core.states.gameStates.LandedExplore': Explore,
    'core.states.gameStates.LandedState': Landed,
    'core.states.exploreStates.SelectTeamState': SelectTeam,
    'core.states.exploreStates.ReportState': Report,
  };
  const cleanups: Array<() => void> = [];
  const hooks = new Hooks((error: unknown) => {
    throw error;
  });
  const api = {
    cls: (name: string) => classes[name] ?? {},
    around(owner: object, key: string, fn: unknown) {
      const off = hooks.add(owner, key, 'around', fn);
      cleanups.push(off);
      return off;
    },
  } as unknown as API;
  bindGameClasses(api);
  installLandedExploreInput(api);
  const source = readFileSync(
    new URL('./fixtures/landed/LandedExplore.as', import.meta.url),
    'utf8',
  )
    .replace('super.execute()', 'baseExecute()')
    .replaceAll('keybinds.isEscPressed', 'keybinds.get_isEscPressed()');
  const snapshot = (state: Landed) => ({
    leaves: state.leaves,
    menus: state.menusClosed,
    draws: state.draws,
    updates: state.updates,
    closes: state.closes,
    reverted: state.reverted,
    active: state.active,
    visible: state.leaveButton.visible,
  });
  let cases = 0;
  try {
    for (const active of [false, true])
      for (const loaded of [false, true])
        for (const blocked of [false, true])
          for (const leaving of [false, true])
            for (const menu of [false, true])
              for (const key of ['none', 'escape', 'land'])
                for (const child of ['normal', 'select', 'report']) {
                  const actual = Object.assign(new Explore(), {
                    active,
                    loaded,
                    blocked,
                    leaving,
                    key,
                    child,
                  });
                  const expected = Object.assign(new Landed(), {
                    active,
                    loaded,
                    blocked,
                    leaving,
                    key,
                    child,
                    SelectTeamState: SelectTeam,
                    ReportState: Report,
                    baseExecute: () => {},
                  });
                  expected.baseExecute = () => Landed.prototype.execute!.call(expected);
                  if (menu) {
                    actual.menuHud = {
                      update: () => {
                        actual.updates++;
                      },
                    };
                    expected.menuHud = {
                      update: () => {
                        expected.updates++;
                      },
                    };
                  }
                  install(expected, source, ['execute']);
                  expected.execute!();
                  actual.execute!();
                  assert.deepEqual(
                    snapshot(actual),
                    snapshot(expected),
                    JSON.stringify({ active, loaded, blocked, leaving, menu, key, child }),
                  );
                  assert.ok(actual.leaves <= 1);
                  cases++;
                }
  } finally {
    cleanups.reverse().forEach((off) => off());
  }
  assert.equal(cases, 288);
  assert.equal(Explore.prototype.execute, original);
});
