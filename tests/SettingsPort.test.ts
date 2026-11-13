import { bindGameClasses, type GameScene } from '../src/game/Bindings';
import type { API } from '../src/api/Types';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createClientSettings } from '../src/ported/ClientSettings';
test('complete ClientSettings source port preserves per-player defaults, clamping and serialization', () => {
  const saved: any = { data: {}, flush() {} };
  const game: any = { instance: { me: { id: 'player-one' } } };
  const definitions: any = {
    'core.scene.Game': game,
    'core.scene.SceneBase': {},
    'openfl.geom.Point': class {
      constructor(
        public x = 0,
        public y = 0,
      ) {}
    },
    'openfl.net.SharedObject': { getLocal: () => saved },
  };
  const Settings = createClientSettings((name) => {
    assert.ok(definitions[name], name);
    return definitions[name];
  });
  const settings = new Settings();
  assert.equal(settings.autoTarget, true);
  assert.equal(settings.targetSearchDistance, 2000);
  settings.targetSearchDistance = 99999;
  assert.equal(settings.targetSearchDistance, 5000);
  settings.nearbyEnemyRadarLines = -100;
  assert.equal(settings.nearbyEnemyRadarLines, 0);
  settings.autoTarget = false;
  settings.save();
  const restored = new Settings();
  assert.equal(restored.autoTarget, false);
  game.instance.me.id = 'player-two';
  assert.equal(restored.autoTarget, true);
  assert.equal(restored.nearbyEnemyRadarLines, 5);
  game.instance.me.id = 'player-one';
  assert.equal(restored.autoTarget, false);
});

test('runtime settings migrate the old subset once and share live values with source pages', async () => {
  const { sessionSettings } = await import('../src/settings/RuntimeSettings');
  const data = new Map<string, any>([
    ['settings.p1', { auto_target: false, target_info_x: 0.3, target_search_distance: 90000 }],
  ]);
  const cleanup: Function[] = [];
  const prior = { old: true };
  const scene: any = { clientSettings: prior };
  const api: any = {
    storage: {
      get: (key: string, fallback: any) =>
        data.has(key) ? structuredClone(data.get(key)) : fallback,
      set: (key: string, value: any) => data.set(key, structuredClone(value)),
    },
    cls: (name: string) =>
      name === 'core.scene.SceneBase'
        ? scene
        : name === 'openfl.geom.Point'
          ? class {
              constructor(
                public x = 0,
                public y = 0,
              ) {}
            }
          : undefined,
    defer: (fn: Function) => cleanup.push(fn),
  };
  bindGameClasses({ cls: (name: string) => api.cls(name) ?? {} } as unknown as API);
  const game = (id: string) => ({ get_me: () => ({ id }) }) as unknown as GameScene;
  const first = sessionSettings(api, game('p1'));
  assert.equal(first.config.auto_target, false);
  assert.equal(first.config.target_info_x, 0.3);
  assert.equal(first.config.target_search_distance, 5000);
  assert.equal(scene.clientSettings, first.client);
  first.client.autoTarget = true;
  assert.equal(first.config.auto_target, true);
  first.config.target_info_y = 0.4;
  assert.equal(first.client.targetInfoPosition.x, 0.3);
  assert.equal(first.client.targetInfoPosition.y, 0.4);
  first.config.nearby_enemy_radar_lines = 999;
  assert.equal(first.client.nearbyEnemyRadarLines, 10);
  first.client.showRadarDPS = false;
  first.client.dontKick = true;
  cleanup
    .splice(0)
    .reverse()
    .forEach((fn) => fn());
  assert.equal(scene.clientSettings, prior);
  const restored = sessionSettings(api, game('p1'));
  assert.equal(restored.client.dontKick, true, 'inactivity preference survives room recreation');
  assert.equal(
    restored.config.auto_target,
    true,
    'old subset must not overwrite canonical preferences',
  );
  assert.equal(
    restored.client.showRadarDPS,
    false,
    'full settings survive, beyond the initial subset',
  );
  cleanup
    .splice(0)
    .reverse()
    .forEach((fn) => fn());
  const other = sessionSettings(api, game('p2'));
  assert.equal(other.config.auto_target, true);
  assert.equal(other.client.showRadarDPS, true);
  assert.equal(other.client.dontKick, false, 'inactivity preference belongs to the account');
  cleanup
    .splice(0)
    .reverse()
    .forEach((fn) => fn());
  assert.equal(scene.clientSettings, prior);
});

test('settings reject malformed account records and tolerate own-property names in saved data', () => {
  const saved: { data: { settings: unknown }; flush(): void } = {
    data: { settings: null },
    flush() {},
  };
  const definitions: Record<string, unknown> = {
    'core.scene.Game': { instance: { me: { id: 'p1' } } },
    'openfl.geom.Point': class {
      constructor(
        public x = 0,
        public y = 0,
      ) {}
    },
    'openfl.net.SharedObject': { getLocal: () => saved },
  };
  const Settings = createClientSettings((name) => definitions[name]);
  for (const invalid of [null, 12, 'invalid', []]) {
    saved.data.settings = { p1: invalid, p2: { auto_target: false } };
    const settings = new Settings();
    assert.equal(settings.autoTarget, true);
    settings.autoTarget = false;
    const persisted = saved.data.settings as Record<string, unknown>;
    assert.deepEqual(persisted.p2, { auto_target: false });
    assert.equal(new Settings().autoTarget, false);
  }
  saved.data.settings = {
    hasOwnProperty: false,
    p1: {
      hasOwnProperty: false,
      auto_target: false,
      advanced_chat_tab: { mode: 'privateSaved', privateTarget: 42 },
    },
  };
  const settings = new Settings();
  assert.equal(settings.autoTarget, false);
  assert.deepEqual(settings.advancedChatTab, { mode: 'local', privateTarget: '' });
});
