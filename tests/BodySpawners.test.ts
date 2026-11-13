import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { API } from '../src/api/Types';
import { bindGameClasses } from '../src/game/Bindings';
import { installBodySpawners } from '../src/world/BodySpawners';
// @ts-expect-error production hook dispatcher
import { Hooks } from './fixtures/HostCore.js';

test('body spawners share table grouping while retaining native construction order and count', () => {
  let scans = 0;
  const a = { body: 'planet', type: 'organic' };
  const b = { body: 'planet', type: 'ordinary' };
  const c = { body: 'moon' };
  let table: object | null = new Proxy(
    { a, b, c, unused: { body: null } },
    {
      ownKeys(target) {
        scans++;
        return Reflect.ownKeys(target);
      },
    },
  );
  const events: unknown[][] = [];
  class Body {
    hostileZoneRadius = 99;
    collisionRadius = 21;
    nativeCalls = 0;
    dataManager = {
      loadTable: (name: string) => {
        assert.equal(name, 'Spawners');
        return table;
      },
    };
    addSpawners(_definition: object, _key: string) {
      this.nativeCalls++;
    }
    preDraw(definition: object) {
      events.push(['draw', this, definition, this.hostileZoneRadius]);
    }
    createSpawner(definition: object, key: string, parent: Body, count: number) {
      events.push(['create', definition, key, parent, count]);
    }
  }
  const cleanup: Array<() => void> = [];
  const hooks = new Hooks((error: unknown) => {
    throw error;
  });
  const api = {
    cls: (name: string) => (name === 'core.solarSystem.Body' ? Body : {}),
    around: (owner: object, key: string, callback: unknown) => {
      const off = hooks.add(owner, key, 'around', callback);
      cleanup.push(off);
      return off;
    },
  } as unknown as API;
  bindGameClasses(api);
  installBodySpawners(api);
  const planet = new Body();
  const moon = new Body();
  const definition = {};
  try {
    planet.addSpawners(definition, 'planet');
    assert.deepEqual(events, [
      ['draw', planet, definition, 31],
      ['create', a, 'a', planet, 2],
      ['create', b, 'b', planet, 2],
    ]);
    events.length = 0;
    moon.addSpawners(definition, 'moon');
    assert.deepEqual(events, [
      ['draw', moon, definition, 31],
      ['create', c, 'c', moon, 1],
    ]);
    assert.equal(scans, 1, 'whole data table is scanned once across bodies');
    events.length = 0;
    planet.addSpawners(definition, 'empty');
    assert.deepEqual(events, [['draw', planet, definition, 0]]);
    assert.equal(scans, 1);
    const replacement = { body: 'planet' };
    table = { replacement };
    events.length = 0;
    planet.addSpawners(definition, 'planet');
    assert.deepEqual(events, [
      ['draw', planet, definition, 31],
      ['create', replacement, 'replacement', planet, 1],
    ]);
    table = null;
    events.length = 0;
    planet.addSpawners(definition, 'planet');
    assert.deepEqual(events, [['draw', planet, definition, 0]]);
  } finally {
    cleanup.reverse().forEach((off) => off());
  }
  planet.addSpawners(definition, 'planet');
  assert.equal(planet.nativeCalls, 1);
});
