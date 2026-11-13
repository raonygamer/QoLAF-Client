import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import {
  BossSpawnTimerCatalog,
  type BossTimerEntry,
  type TimerBody,
  type TimerDefinition,
  type TimerSpawner,
} from '../src/boss/BossSpawnTimerCatalog';
// @ts-expect-error Executes original AS3 methods with only language-boundary conversion.
import { install } from './fixtures/As3Methods.js';

function originalCatalog() {
  const scope = {
    ZHERSIS_KEY: '1gr5DQtiFU2VF1DR2lmd0A',
    MAX_ENEMY_OPTIONS: 512,
    MINUTE_MS: 60000,
    MAX_PERIOD_MS: 86400000,
    build: undefined as unknown as typeof BossSpawnTimerCatalog.build,
  };
  install(
    scope,
    // Remove comment apostrophes before the small AS3 fixture's string tokenizer.
    readFileSync(
      new URL('./fixtures/boss/BossSpawnTimerCatalog.as', import.meta.url),
      'utf8',
    ).replace(/\/\/[^\n]*/g, ''),
    ['build', 'addSlot', 'optionKeys', 'addSource', 'period', 'hasEvent', 'compareRows'],
  );
  return scope;
}

test('catalog matches original AS3 across timer limits, slot gating and option boundaries', () => {
  const original = originalCatalog();
  const bosses = { boss: { name: 'Boss lvl 150' } };
  const enemies: Record<string, TimerDefinition> = {
    mini: { name: 'Mini lvl 90', miniBoss: true },
    other: { name: 'Other', miniBoss: true },
    ordinary: { name: 'Ordinary', miniBoss: false },
  };
  const check = (body: TimerBody) => {
    assert.deepEqual(
      BossSpawnTimerCatalog.build([body], bosses, enemies),
      original.build([body], bosses, enemies),
    );
  };
  for (const period of [undefined, null, 0, -1, 0.5, 1440, 1440.001, NaN, Infinity, '5', 'bad']) {
    for (const capacity of [undefined, null, 0, -1, 1, 2, NaN, Infinity, '1']) {
      const spawner: TimerSpawner = {
        key: 'station',
        obj: { enemy: 'mini', resetTime: period, maxActiveEnemies: capacity },
      };
      check({ obj: { boss: 'boss', spawnTime: period }, spawners: [spawner] });
    }
  }
  for (const options of [
    [],
    ['mini'],
    ['mini', 'mini'],
    ['mini', 'other'],
    [null, {}, { key: null }, { key: 'mini', probability: 0 }],
    [
      { key: 'mini', probability: '1' },
      { key: 'other', probability: NaN },
    ],
    Array(512).fill('mini') as string[],
    [...(Array(512).fill('mini') as string[]), 'other'],
  ]) {
    for (const gated of [false, true]) {
      check({
        obj: { boss: 'boss', spawnTime: 5 },
        spawners: [
          {
            obj: {
              enemies: options,
              enemy: 'mini',
              resetTime: 2,
              spawnOnDeath: gated,
              hasSecondSpawn: true,
              enemy2: 'other',
              resetTime2: 3,
            },
          },
        ],
      });
    }
  }
});

test('catalog matches original source identity, seasonal merging and deterministic ordering', () => {
  const original = originalCatalog();
  const spawner: TimerSpawner = { key: 'station', obj: { enemy: 'mini', resetTime: 2 } };
  const body: TimerBody = { obj: { boss: 'b', spawnTime: 5 }, spawners: [spawner, spawner] };
  const seasonal: TimerBody = { obj: { boss: 'b', spawnTime: 1, event: 'season' } };
  const bodies = [body, seasonal, { obj: { boss: 'a', spawnTime: 1440 } }, body, null];
  const bosses = { a: { name: 'Alpha lvl 100' }, b: { name: 'alpha lvl 200' } };
  const enemies = { mini: { name: 'Mini', miniBoss: true } };
  for (const ordered of [bodies, [...bodies].reverse()]) {
    const rows: BossTimerEntry[] = BossSpawnTimerCatalog.build(ordered, bosses, enemies);
    assert.deepEqual(rows, original.build(ordered, bosses, enemies));
    assert.deepEqual(
      rows.map((row) => row.id),
      ['boss:a', 'boss:b', 'enemy:mini'],
    );
    assert.equal(rows[1].conditional, false);
    assert.equal(rows[1].sources.length, 2);
    assert.equal(rows[2].sources.length, 1);
    assert.equal(rows[2].sources[0].anchor, spawner);
  }
  assert.deepEqual(BossSpawnTimerCatalog.build(null, null, null), original.build(null, null, null));
});

test('catalog matches original disabled, mission and seasonal sources without changing anchors', () => {
  const original = originalCatalog();
  const key = BossSpawnTimerCatalog.zhersisKey;
  const enemies = { [key]: { name: 'Admiral Zhersis lvl 130', miniBoss: true } };
  for (let flags = 0; flags < 64; flags++) {
    const spawner: TimerSpawner = {
      key: 'station',
      isBossUnit: !!(flags & 1),
      obj: {
        active: !(flags & 2),
        enemy: key,
        resetTime: 1,
        triggeredByMission: !!(flags & 4),
        triggeredByTimer: !!(flags & 8),
        event: flags & 16 ? 'season' : '',
      },
    };
    const body: TimerBody = {
      obj: { active: !(flags & 32) },
      spawners: [null, spawner],
    };
    const before = structuredClone(body);
    const rows = BossSpawnTimerCatalog.build([body], null, enemies);
    assert.deepEqual(rows, original.build([body], null, enemies), `flags ${flags}`);
    assert.deepEqual(body, before, 'catalog must not mutate cache definitions or runtime anchors');
    if (rows.length) {
      assert.equal(rows[0].primary, true);
      assert.equal(rows[0].name, 'Admiral Zhersis');
      assert.equal(rows[0].sources[0].anchor, spawner);
    }
  }
});
