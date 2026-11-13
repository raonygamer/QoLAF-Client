import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { API } from '../src/api/Types';
import { bindGameClasses, type GameScene } from '../src/game/Bindings';
import { DeviceSettings } from '../src/settings/DeviceSettings';
import { installRespawn } from '../src/runtime/Respawn';
// @ts-expect-error actual host hook dispatcher
import { Hooks } from './fixtures/HostCore.js';

function fixture() {
  const cleanup: Array<() => void> = [];
  let commandable = false,
    ready = false,
    survival = false,
    lives = 1;
  let nativeInput = 0;
  const sends: string[] = [];
  const player = {
    isMe: true,
    respawnNextReady: 5000,
    get_commandable: () => commandable,
    respawnReady: () => ready,
  };
  const game = {
    time: 4200,
    solarSystem: { isPvpSystemInEditor: false },
    hud: { uberStats: { getMyLives: () => lives } },
    isSystemTypeSurvival: () => survival,
    send: (type: string) => sends.push(type),
  };
  class Roaming {
    g = game;
    me = player;
    updateInput() {
      nativeInput++;
    }
  }
  class Killed {
    enter() {}
    g = game;
    player = player;
    text = '';
    size = 0;
    pivots = 0;
    respawnText = {
      set_text: (text: string) => {
        this.text = text;
      },
      get_format: () => ({
        set_size: (size: number) => {
          this.size = size;
        },
      }),
      alignPivot: () => {
        this.pivots++;
      },
    };
    execute() {
      this.text = 'native';
    }
  }
  const hooks = new Hooks((error: unknown) => {
    throw error;
  });
  const hook = (kind: string) => (target: object, key: string, callback: Function) => {
    const dispose = hooks.add(target, key, kind, callback);
    cleanup.push(dispose);
    return dispose;
  };
  const api = {
    cls: (name: string) =>
      name === 'core.states.gameStates.RoamingState'
        ? Roaming
        : name === 'core.states.player.Killed'
          ? Killed
          : {},
    around: hook('around'),
    after: hook('after'),
  } as unknown as API;
  const preferences = new DeviceSettings({ get: (_key, fallback) => fallback, set() {} });
  bindGameClasses(api);
  installRespawn(api, game as unknown as GameScene, preferences);
  return {
    game,
    player,
    roaming: new Roaming(),
    killed: new Killed(),
    preferences,
    sends,
    nativeInput: () => nativeInput,
    ready: (value: boolean) => {
      ready = value;
    },
    commandable: (value: boolean) => {
      commandable = value;
    },
    survival: (value: boolean, count: number) => {
      survival = value;
      lives = count;
    },
    cleanup: () => cleanup.reverse().forEach((fn) => fn()),
  };
}

test('automatic respawn waits for native readiness; manual mode and live players retain native input', () => {
  const f = fixture();
  f.roaming.updateInput();
  assert.deepEqual(f.sends, []);
  f.ready(true);
  f.roaming.updateInput();
  assert.deepEqual(f.sends, ['respawn']);
  assert.equal(f.player.respawnNextReady, 0);
  f.preferences.set('disableSpaceToRespawn', false);
  f.roaming.updateInput();
  f.preferences.set('disableSpaceToRespawn', true);
  f.commandable(true);
  f.roaming.updateInput();
  assert.equal(f.nativeInput(), 2);
  assert.equal(f.sends.length, 1);
  f.cleanup();
  f.roaming.updateInput();
  assert.equal(f.nativeInput(), 3);
});

test('automatic prompt distinguishes survival exit and preserves countdown/editor/remote-player text', () => {
  const f = fixture();
  f.killed.execute();
  assert.equal(f.killed.text, 'Respawning...');
  assert.equal(f.killed.size, 20);
  assert.equal(f.killed.pivots, 1);
  f.survival(true, 0);
  f.killed.execute();
  assert.equal(f.killed.text, 'Leaving...');
  f.game.time = 4000;
  f.killed.execute();
  assert.equal(f.killed.text, 'native');
  f.game.time = 4200;
  f.game.solarSystem.isPvpSystemInEditor = true;
  f.killed.execute();
  assert.equal(f.killed.text, 'native');
  f.game.solarSystem.isPvpSystemInEditor = false;
  f.player.isMe = false;
  f.killed.execute();
  assert.equal(f.killed.text, 'native');
  f.cleanup();
});

test('hooks do not change another game scene', () => {
  const f = fixture();
  f.ready(true);
  f.roaming.g = { ...f.game };
  f.roaming.updateInput();
  f.killed.g = { ...f.game };
  f.killed.execute();
  assert.equal(f.nativeInput(), 1);
  assert.deepEqual(f.sends, []);
  assert.equal(f.killed.text, 'native');
  f.cleanup();
});
