import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { API } from '../src/api/Types';
import { bindGameClasses, type GameScene } from '../src/game/Bindings';
import { installDailyMissionLocalization } from '../src/missions/DailyMissionLocalization';
// @ts-expect-error actual host dispatcher
import { Hooks } from './fixtures/HostCore.js';

test('daily labels translate once on loading or hot enable and restore without changing definitions', () => {
  const definition = { name: 'Daily title', description: 'Daily description', level: 5 };
  const makeDaily = () => ({ ...definition, json: definition, status: 0, progress: 2 });
  const player = { dailyMissions: [makeDaily()] };
  const game = { get_me: () => player };
  let fail = false;
  class Manager {
    g = game;
    initDailyMissionsFromMessage(_message: object, offset: number) {
      if (fail) throw Error('native decode failed');
      player.dailyMissions.push(makeDaily());
      return offset + 5;
    }
  }
  let translations = 0;
  const classes: Record<string, unknown> = {
    'core.missions.DailyManager': Manager,
    'generics.Localize': {
      t: (text: string) => {
        translations++;
        return 'Translated ' + text;
      },
    },
  };
  const cleanup: Array<() => void> = [];
  const hooks = new Hooks((error: unknown) => {
    throw error;
  });
  let onGame: (game: GameScene) => void = () => {};
  const api = {
    cls: (name: string) => classes[name] ?? {},
    after(owner: object, name: string, callback: unknown) {
      const off = hooks.add(owner, name, 'after', callback);
      cleanup.push(off);
      return off;
    },
    onGame(callback: (game: GameScene) => void) {
      onGame = callback;
      callback(game as unknown as GameScene);
      return () => {};
    },
    defer: (callback: () => void) => cleanup.push(callback),
  } as unknown as API;
  bindGameClasses(api);
  installDailyMissionLocalization(api);
  const initial = player.dailyMissions[0];
  assert.equal(initial.name, 'Translated Daily title');
  assert.equal(initial.description, 'Translated Daily description');
  assert.equal(translations, 2);
  const manager = new Manager();
  assert.equal(manager.initDailyMissionsFromMessage({}, 10), 15);
  const added = player.dailyMissions[1];
  assert.equal(added.name, 'Translated Daily title');
  assert.equal(translations, 4);
  onGame(game as unknown as GameScene);
  assert.equal(translations, 4, 'revisiting the same instances does not retranslate');
  assert.deepEqual(definition, { name: 'Daily title', description: 'Daily description', level: 5 });
  assert.equal(initial.json, definition);
  assert.equal(initial.progress, 2);
  assert.equal(initial.status, 0);
  fail = true;
  assert.throws(() => manager.initDailyMissionsFromMessage({}, 10), /native decode failed/);
  assert.equal(translations, 4);
  added.name = 'Changed by another plugin';
  cleanup.reverse().forEach((off) => off());
  assert.equal(initial.name, definition.name);
  assert.equal(initial.description, definition.description);
  assert.equal(added.name, 'Changed by another plugin');
  assert.equal(added.description, definition.description);
  fail = false;
  manager.initDailyMissionsFromMessage({}, 0);
  assert.equal(player.dailyMissions[2].name, definition.name);
});
