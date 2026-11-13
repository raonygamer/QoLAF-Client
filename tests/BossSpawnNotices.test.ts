import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { API } from '../src/api/Types';
import { bindGameClasses } from '../src/game/Bindings';
import { installBossSpawnNotices } from '../src/boss/BossSpawnNotices';
// @ts-expect-error production hook dispatcher
import { Hooks } from './fixtures/HostCore.js';

test('boss notices translate the template and name and restore native behavior on unload', () => {
  const messages: string[] = [];
  class TextManager {
    createBossSpawnedText(text: string) {
      messages.push(text);
    }
  }
  const translations = new Map([
    ['[name] has spawned', 'Surgiu: [name]'],
    ['Emperor Xhersix', 'Imperador Xhersix'],
  ]);
  const classes: Record<string, unknown> = {
    'core.text.TextManager': TextManager,
    'generics.Localize': { t: (text: string) => translations.get(text) ?? text },
  };
  const cleanups: Array<() => void> = [];
  const hooks = new Hooks((error: unknown) => {
    throw error;
  });
  const api = {
    cls: (name: string) => classes[name] ?? {},
    around(owner: object, method: string, callback: unknown) {
      const off = hooks.add(owner, method, 'around', callback);
      cleanups.push(off);
      return off;
    },
  } as unknown as API;
  bindGameClasses(api);
  installBossSpawnNotices(api);
  const manager = new TextManager();
  try {
    manager.createBossSpawnedText('Emperor Xhersix has spawned');
    manager.createBossSpawnedText('Unknown has spawned');
    manager.createBossSpawnedText('Already translated notice');
    assert.deepEqual(messages, [
      'Surgiu: Imperador Xhersix',
      'Surgiu: Unknown',
      'Already translated notice',
    ]);
    translations.clear();
    manager.createBossSpawnedText('Emperor Xhersix has spawned');
    assert.equal(messages.at(-1), 'Emperor Xhersix has spawned');
  } finally {
    cleanups.reverse().forEach((off) => off());
  }
  translations.set('[name] has spawned', 'Surgiu: [name]');
  manager.createBossSpawnedText('Unknown has spawned');
  assert.equal(messages.at(-1), 'Unknown has spawned');
});
