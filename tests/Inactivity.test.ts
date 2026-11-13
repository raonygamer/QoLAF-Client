import { bindGameClasses } from '../src/game/Bindings';
import type { API } from '../src/api/Types';
import assert from 'node:assert/strict';
import { test } from 'node:test';
// @ts-expect-error actual host hooks
import { Hooks } from './fixtures/HostCore.js';
import { installInactivityPreference } from '../src/runtime/Inactivity';
import { installSessionProtection } from '../src/runtime/SessionProtection';

for (const earlySession of [false, true])
test(`native inactivity timer remains protected with ${earlySession ? 'saved settings before fonts or HUD exist' : 'direct guard installation'}`, async (t) => {
  // @ts-expect-error captured current Haxe method
  const { nativeInactivity } = await import('./fixtures/NativeInactivity.js');
  let now = 1794500000000;
  t.mock.method(Date.prototype, 'getTime', () => now);
  class Timer {
    run = () => {};
    stopped = false;
    stop() {
      this.stopped = true;
    }
  }
  class Game {
    static lastActive = now | 0;
    static playerPerformedAction() {
      Game.lastActive = now | 0;
    }
    idleTimer: Timer | null = null;
    get_me() { return { id: 'test-player' }; }
    kicks = 0;
    serviceConnection = { disconnect() {} };
    automationManager = { transientDontKickActive: false };
    disconnectIfInactive() {}
    stopIdleTimer() {
      this.idleTimer?.stop();
      this.idleTimer = null;
    }
    disconnect() {
      this.kicks++;
    }
    removeEventListener() {}
    update() {}
    showErrorDialog() {}
  }
  Game.prototype.disconnectIfInactive = nativeInactivity(
    Game,
    Timer,
    { s: { get_nativeStage: () => ({ set_frameRate() {} }) } },
    (owner: object, method: () => void) => method.bind(owner),
  );
  let settings = { dontKick: true };
  bindGameClasses({
    cls: (name: string) =>
      name === 'core.scene.Game'
        ? Game
        : name === 'core.scene.SceneBase'
          ? { clientSettings: settings }
          : {},
  } as unknown as API);
  const game = new Game();
  game.disconnectIfInactive();
  const timer = game.idleTimer!;
  const originalRun = timer.run;
  const hooks = new Hooks();
  const cleanups: (() => void)[] = [];
  const api = {
      storage: {
        get: (key: string) => key === 'client-settings' ? { 'test-player': { dont_kick: true } } : null,
        set() {},
      },
      log() {},
      defer: (fn: () => void) => cleanups.push(fn),
      around: (target: object, name: string, fn: (...args: never[]) => unknown) =>
        cleanups.push(hooks.add(target, name, 'around', fn)),
    } as unknown as API;
  const scene = game as unknown as import('../src/game/AutomationGame').AutomationGame;
  if (earlySession) settings = installSessionProtection(api, scene).client;
  else installInactivityPreference(api, scene);
  try {
    // No animation frames or input for much longer than the native 10-minute timeout.
    now += 3600000;
    timer.run();
    assert.equal(game.kicks, 0);
    assert.equal(game.idleTimer, timer, 'protection does not stop the recurring timer');
    assert.equal(Game.lastActive, 1794500000000 | 0, 'protection does not fabricate user input');
    // Recreated timers must be guarded too, even with a stale native callback.
    game.stopIdleTimer();
    game.disconnectIfInactive();
    const replacement = game.idleTimer!;
    now += 3600000;
    replacement.run();
    assert.equal(game.kicks, 0);
    timer.run();
    assert.equal(game.kicks, 0, 'retired timer is inert');
    settings.dontKick = false;
    game.automationManager.transientDontKickActive = true;
    replacement.run();
    assert.equal(game.kicks, 0, 'temporary owner protects with preference off');
    game.automationManager.transientDontKickActive = false;
    Game.playerPerformedAction();
    now += 600001;
    replacement.run();
    assert.equal(game.kicks, 0, 'original client allows more than vanilla ten minutes');
    now += 1200000;
    replacement.run();
    assert.equal(game.kicks, 1);
    assert.equal(replacement.stopped, true);
  } finally {
    cleanups.reverse().forEach((fn) => fn());
  }
  assert.equal(timer.run, originalRun);
});
