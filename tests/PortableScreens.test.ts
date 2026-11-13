import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
// @ts-expect-error original AS3 execution boundary
import { install } from './fixtures/As3Methods.js';
import { test } from 'node:test';
import type { API } from '../src/api/Types';
import { installPortableScreens } from '../src/runtime/PortableScreens';

// Screen transitions only; these doubles do not claim native visual parity.
test('portable entry restrictions apply to hangar and Pirate Bay, not recycling or upgrades', () => {
  class Body {
    name = '';
    set_name(value: string) {
      this.name = value;
    }
  }
  class Landed {}
  class Roaming {}
  class Screen extends Landed {
    unloaded = false;
  }
  class Recycle extends Screen {}
  class Upgrade extends Screen {}
  class Hangar extends Screen {}
  class PirateBay extends Screen {}
  const errors: string[] = [];
  const transitions: Screen[] = [];
  const cleanups: (() => void)[] = [];
  const classes: Record<string, unknown> = {
    'core.solarSystem.Body': Body,
    'core.states.gameStates.LandedState': Landed,
    'core.states.gameStates.RoamingState': Roaming,
    'core.states.gameStates.LandedRecycle': Recycle,
    'core.states.gameStates.LandedUpgrade': Upgrade,
    'core.states.gameStates.LandedHangar': Hangar,
    'core.states.gameStates.LandedPiratebay': PirateBay,
    'core.hud.components.chat.MessageLog': { write: (message: string) => errors.push(message) },
  };
  const game = {
    chatInput: {},
    gameStateMachine: { activeState: {} },
    me: { isLanded: false, currentBody: null },
    fadeIntoState: (state: Screen) => transitions.push(state),
    enterState: (state: Screen) => transitions.push(state),
  };
  const api = {
    cls: (name: string) => classes[name],
    around: () => () => {},
    after: () => () => {},
    defer: (cleanup: () => void) => cleanups.push(cleanup),
  } as unknown as API;
  installPortableScreens(api, game);
  const portable = game as typeof game & {
    openPortableRecycle(transition?: boolean): Recycle;
    openPortableUpgrade(): Upgrade;
    openPortableHangar(): Hangar | undefined;
    openPortablePirateBay(): PirateBay | undefined;
  };
  try {
    const recycler = portable.openPortableRecycle(false);
    assert.ok(recycler instanceof Recycle);
    assert.equal(
      portable.openPortableRecycle(),
      recycler,
      'retain pending/open recycler ownership',
    );
    assert.equal(transitions.length, 1);
    const firstUpgrade = portable.openPortableUpgrade();
    assert.ok(firstUpgrade instanceof Upgrade);
    assert.notEqual(
      portable.openPortableUpgrade(),
      firstUpgrade,
      'source creates a fresh upgrade state',
    );
    assert.equal(portable.openPortableHangar(), undefined);
    assert.equal(errors.at(-1), 'Close the current screen before using /hangar.');
    const errorCount = errors.length;
    game.gameStateMachine.activeState = new PirateBay();
    assert.equal(portable.openPortablePirateBay(), undefined);
    assert.equal(
      errors.length,
      errorCount,
      'an existing native Pirate Bay is already the destination',
    );
    game.gameStateMachine.activeState = new Roaming();
    assert.ok(portable.openPortableHangar() instanceof Hangar);
  } finally {
    for (const cleanup of cleanups.reverse()) cleanup();
  }
});

test('portable leave matches both original states across lifecycle gates and repeated closes', () => {
  for (const name of ['Hangar', 'Piratebay']) {
    const source = readFileSync(
      new URL(`./fixtures/landed/Portable${name}State.as`, import.meta.url),
      'utf8',
    );
    for (const attached of [false, true])
      for (const unloaded of [false, true])
        for (const playerPresent of [false, true])
          for (const landed of [false, true])
            for (const bodyPresent of [false, true]) {
              const events: string[] = [];
              const expected: string[] = [];
              const player = playerPresent
                ? { isLanded: landed, currentBody: bodyPresent ? {} : null }
                : null;
              class Body {
                set_name(_name: string) {}
              }
              class Landed {}
              class Roaming {}
              class Screen extends Landed {
                sm = attached ? { revertState: () => events.push('revert') } : null;
                get_unloaded() {
                  return unloaded;
                }
                leave() {
                  events.push('native-takeoff');
                }
              }
              const cleanups: Array<() => void> = [];
              const classes: Record<string, unknown> = {
                'core.solarSystem.Body': Body,
                'core.states.gameStates.LandedState': Landed,
                'core.states.gameStates.RoamingState': Roaming,
                [`core.states.gameStates.Landed${name}`]: Screen,
                'core.hud.components.chat.MessageLog': { write() {} },
              };
              const game = {
                chatInput: {},
                me: player,
                gameStateMachine: { activeState: new Roaming() },
                dataManager: {
                  loadTable: () => ({
                    h: {
                      pirate: {
                        key: 'pirate',
                        name: 'Pirate Bay',
                        type: 'pirate',
                        shopItems: [],
                        payVaultItem: 'shop',
                      },
                    },
                  }),
                },
                fadeIntoState() {},
                enterLandedState: () => events.push('landed'),
              };
              const api = {
                cls: (key: string) => classes[key],
                around: () => () => {},
                after: () => () => {},
                defer: (fn: () => void) => cleanups.push(fn),
              } as unknown as API;
              const original = {
                sm: attached ? { revertState: () => expected.push('revert') } : null,
                _unloaded: unloaded,
                leaving: false,
                g: { me: player, enterLandedState: () => expected.push('landed') },
                leave() {},
              };
              install(original, source, ['leave']);
              installPortableScreens(api, game);
              try {
                const methods = game as typeof game & {
                  openPortableHangar(): Screen;
                  openPortablePirateBay(): Screen;
                };
                const state =
                  name === 'Hangar'
                    ? methods.openPortableHangar()
                    : methods.openPortablePirateBay();
                assert.ok(state);
                for (let attempt = 0; attempt < 3; attempt++) {
                  original.leave();
                  state.leave();
                }
                assert.deepEqual(
                  events,
                  expected,
                  JSON.stringify({ name, attached, unloaded, playerPresent, landed, bodyPresent }),
                );
                assert.ok(!events.includes('native-takeoff'));
              } finally {
                cleanups.reverse().forEach((fn) => fn());
              }
            }
  }
});
