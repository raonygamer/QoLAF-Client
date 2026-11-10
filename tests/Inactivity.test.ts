import assert from 'node:assert/strict';
import { test } from 'node:test';
// @ts-expect-error actual host hooks
import { Hooks } from './Fixtures/HostCore.js';
import { installInactivityPreference } from '../src/Runtime/Inactivity';

test('persistent inactivity setting and transient owners retain native timeout when disabled', () => {
  const hooks = new Hooks(),
    cleanups: Function[] = [];
  let actions = 0,
    saved = 0,
    preference = false,
    nativeChecks = 0;
  class Game {
    automationManager = { transientDontKickActive: false };
    static playerPerformedAction() {
      actions++;
    }
    disconnectIfInactive() {
      nativeChecks++;
      return 'native-check';
    }
  }
  const settings = {
    get dontKick() {
      return preference;
    },
    set dontKick(value: boolean) {
      preference = value;
      saved++;
    },
  };
  const classes: any = {
    'core.scene.Game': Game,
    'core.scene.SceneBase': { clientSettings: settings },
  };
  const game: any = new Game();
  installInactivityPreference(
    {
      cls: (name: string) => classes[name],
      defer: (fn: Function) => cleanups.push(fn),
      around: (target: any, name: string, fn: Function) =>
        cleanups.push(hooks.add(target, name, 'around', fn)),
    } as any,
    game,
  );
  assert.equal(game.disconnectIfInactive(), 'native-check');
  assert.equal(game.setInactivityDisconnectPrevention(true), true);
  assert.equal(game.persistentInactivityDisconnectPrevention, true);
  assert.equal(game.get_inactivityDisconnectPreventionActive(), true);
  assert.equal(game.disconnectIfInactive(), undefined);
  assert.equal(saved, 1);
  assert.equal(actions, 1);
  assert.equal(game.toggleInactivityDisconnectPrevention(), false);
  assert.equal(game.disconnectIfInactive(), 'native-check');
  game.automationManager.transientDontKickActive = true;
  assert.equal(game.inactivityDisconnectPreventionActive, true);
  assert.equal(game.persistentInactivityDisconnectPrevention, false);
  assert.equal(game.disconnectIfInactive(), undefined);
  assert.equal(saved, 2, 'temporary ownership never changes the saved preference');
  assert.equal(actions, 2, 'explicit preference changes reset inactivity in either direction');
  assert.equal(new Game().disconnectIfInactive(), 'native-check', 'other rooms are not affected');
  cleanups.reverse().forEach((fn) => fn());
  assert.equal(game.disconnectIfInactive(), 'native-check');
  assert.equal(nativeChecks, 4);
  assert.equal('toggleInactivityDisconnectPrevention' in game, false);
  assert.equal('inactivityDisconnectPreventionActive' in game, false);
});
