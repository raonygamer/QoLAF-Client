import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { API } from '../src/api/Types';
import type { MissionDefinition } from '../src/game/MissionDefinition';
import { bindGameClasses } from '../src/game/Bindings';
import { installMissionDescription } from '../src/missions/MissionDescription';
// @ts-expect-error actual host dispatcher
import { Hooks } from './fixtures/HostCore.js';

test('completed mission placeholders are formatted before layout without touching other text', () => {
  class Text {
    text = '';
    set_htmlText(value: string) {
      return (this.text = value);
    }
  }
  class View {
    g = { name: 'Pilot' };
    mission = { finished: true };
    missionType: MissionDefinition = {
      completeDescription: '[player] recovered [amount]',
      value: 7,
    };
    description = new Text();
    measured = '';
    fail = false;
    static fixText(game: { name: string }, definition: MissionDefinition, text: string) {
      return text.replace('[player]', game.name).replace('[amount]', String(definition.value));
    }
    addDescription() {
      if (this.fail) throw new Error('native layout failure');
      this.description.set_htmlText(
        Object.hasOwn(this.missionType, 'nextMission')
          ? 'Proceed to next step'
          : (this.missionType.completeDescription ?? ''),
      );
      this.measured = this.description.text;
    }
  }
  const classes: Record<string, unknown> = {
    'core.states.gameStates.missions.MissionView': View,
    'core.hud.components.Text': Text,
    'generics.Localize': { t: (value: string) => value },
  };
  const cleanup: Array<() => void> = [];
  const hooks = new Hooks((error: unknown) => {
    throw error;
  });
  const api = {
    cls: (name: string) => classes[name] ?? {},
    around: (owner: object, key: string, fn: unknown) => {
      const off = hooks.add(owner, key, 'around', fn);
      cleanup.push(off);
      return off;
    },
  } as unknown as API;
  bindGameClasses(api);
  installMissionDescription(api);
  const view = new View();
  view.addDescription();
  assert.equal(view.measured, 'Pilot recovered 7');
  view.missionType.nextMission = 'next';
  view.addDescription();
  assert.equal(view.measured, 'Proceed to next step');
  delete view.missionType.nextMission;
  view.mission.finished = false;
  view.addDescription();
  assert.equal(view.measured, '[player] recovered [amount]');
  view.mission.finished = true;
  view.fail = true;
  assert.throws(() => view.addDescription(), /native layout failure/);
  const unrelated = new Text();
  unrelated.set_htmlText('[player] recovered [amount]');
  assert.equal(unrelated.text, '[player] recovered [amount]');
  cleanup.reverse().forEach((off) => off());
  view.fail = false;
  view.addDescription();
  assert.equal(view.measured, '[player] recovered [amount]');
});

test('translation precedes native mission substitution and unload restores vanilla formatting', async () => {
  const { readFileSync } = await import('node:fs');
  // @ts-expect-error extracted native game method
  const { createNativeMissionText } = await import('./fixtures/NativeMissionText.js');
  // @ts-expect-error original AS3 execution boundary
  const { install } = await import('./fixtures/As3Methods.js');
  const source = readFileSync(
    new URL('./fixtures/missions/MissionView.as', import.meta.url),
    'utf8',
  );
  const translations = new Map([
    ['Recover [amount] for [player]', '[player]: recupere [h][amount][/h]'],
    ['Mission complete', '[player], missão concluída: [amount]'],
  ]);
  const translate = (text: string) => translations.get(text) ?? text;
  class Text {
    set_htmlText(text: string) {
      return text;
    }
  }
  class View {
    static fixText = createNativeMissionText(
      { replace: (text: string, search: string, value: string) => text.split(search).join(value) },
      { string: String },
    );
    addDescription() {}
  }
  const native = View.fixText;
  const classes: Record<string, unknown> = {
    'core.states.gameStates.missions.MissionView': View,
    'core.hud.components.Text': Text,
    'generics.Localize': { t: translate },
  };
  const cleanup: Array<() => void> = [];
  const hooks = new Hooks((error: unknown) => {
    throw error;
  });
  const api = {
    cls: (name: string) => classes[name] ?? {},
    around(owner: object, key: string, fn: unknown) {
      const off = hooks.add(owner, key, 'around', fn);
      cleanup.push(off);
      return off;
    },
  } as unknown as API;
  bindGameClasses(api);
  installMissionDescription(api);
  const original = {
    Localize: { t: translate },
    fixText: (_game: object, _definition: object, _text: string) => '',
  };
  install(original, source, ['fixText']);
  try {
    for (const name of ['Pilot', '$& $1', 'Raony'])
      for (const value of [undefined, 0, 17, 999])
        for (const text of [
          'Recover [amount] for [player]',
          'Mission complete',
          '[h]Unknown[/h]',
          'Plain text',
        ]) {
          const definition = { value };
          const snapshot = JSON.stringify(definition);
          const actual = View.fixText(
            { get_me: () => ({ get_name: () => name }) },
            definition,
            text,
          );
          // AS3 String.replace treats replacement $ tokens specially; use plain names
          // for source parity, preserving the newer Haxe literal replacement behavior.
          if (!name.includes('$'))
            assert.equal(actual, original.fixText({ me: { name } }, definition, text));
          else if (text === 'Recover [amount] for [player]') assert.ok(actual.startsWith('$& $1:'));
          assert.equal(JSON.stringify(definition), snapshot);
        }
  } finally {
    cleanup.reverse().forEach((off) => off());
  }
  assert.equal(View.fixText, native);
  assert.equal(
    View.fixText({ get_me: () => ({ get_name: () => 'Pilot' }) }, { value: 7 }, 'Mission complete'),
    'Mission complete',
  );
});
