import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createClientSettings } from '../src/Ported/ClientSettings';
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
  const { sessionSettings } = await import('../src/Settings/RuntimeSettings');
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
  const first = sessionSettings(api, { me: { id: 'p1' } });
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
  cleanup
    .splice(0)
    .reverse()
    .forEach((fn) => fn());
  assert.equal(scene.clientSettings, prior);
  const restored = sessionSettings(api, { me: { id: 'p1' } });
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
  const other = sessionSettings(api, { me: { id: 'p2' } });
  assert.equal(other.config.auto_target, true);
  assert.equal(other.client.showRadarDPS, true);
  cleanup
    .splice(0)
    .reverse()
    .forEach((fn) => fn());
  assert.equal(scene.clientSettings, prior);
});
