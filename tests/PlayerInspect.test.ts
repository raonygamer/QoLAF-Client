import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createPlayerInspectViewModel } from '../src/inspect/PlayerInspectViewModel';
import { createPlayerInspectProjection } from '../src/inspect/PlayerInspectProjection';
import { CargoReadQueue, installNativeCargoQueue } from '../src/inspect/CargoReadQueue';

function models() {
  const tables: Record<string, Record<string, any>> = {
    Skins: {
      skin: {
        name: 'Test ship',
        ship: 'hull',
        upgrades: [{ table: 'Weapons', tech: 'gun', level: 2 }],
      },
    },
    Ships: { hull: { bitmap: 'shipImage', hp: 100, shieldHp: 50 } },
    Weapons: { gun: { name: 'Test gun', techIcon: 'gunImage' } },
  };
  const locator = {
    getService: () => ({
      loadKey: (table: string, key: string) => tables[table]?.[key],
      loadTable: (table: string) => tables[table],
    }),
  };
  const resolveMetadata = (name: string) => {
    if (name === 'data.DataLocator') return locator;
    throw new Error(`Unexpected native dependency: ${name}`);
  };
  const View = createPlayerInspectViewModel(resolveMetadata);
  const Projection = createPlayerInspectProjection((name) =>
    name === 'af.PlayerInspectViewModel' ? View : resolveMetadata(name),
  );
  return { View, Projection };
}
const saved = () => ({
  key: 'owner',
  name: '<Pilot>',
  level: 9,
  activeSkin: 'skin',
  fleet: {
    skin: {
      weapons: ['gun'],
      weaponsState: [true],
      weaponsHotkeys: [1],
      activeWeapon: 'gun',
      techSkills: [{ table: 'Weapons', tech: 'gun', level: 4 }],
    },
  },
  artifactSetups: [{ name: 'Loadout', slots: ['first', null, 'third'] }],
  activeArtifactSetup: 0,
});

test('inspect fleet and weapon cards detach saved values without creating gameplay objects', () => {
  const { View, Projection } = models();
  const record = saved();
  const original = structuredClone(record);
  const ships = View.fleet(record);
  assert.equal(ships.length, 1);
  assert.equal(ships[0].name, 'Test ship');
  assert.equal(ships[0].bitmap, 'shipImage');
  assert.equal(ships[0].weapons[0].equipped, true);
  assert.equal(ships[0].weapons[0].hotkey, 1);
  assert.equal(ships[0].builtins[0].name, 'Test gun');
  const weapons = View.weapons(record);
  assert.equal(weapons[0].dps, null);
  const sections = Projection.sections(record);
  assert.equal(sections.length, 6);
  assert.ok(
    sections
      .find((entry: any) => entry.label === 'Stats')
      .rows.some((line: string) => line.includes('unavailable')),
  );
  assert.ok(sections[0].rows.some((line: string) => line.includes('&lt;Pilot&gt;')));
  ships[0].weapons[0].details.push('changed detached card');
  assert.deepEqual(record, original);
});

test('remote empty defaults do not erase saved equipment or artifact slots', () => {
  const { View } = models();
  const record = saved();
  const live = {
    activeSkin: 'skin',
    fleet: [],
    weapons: [],
    isMe: false,
    ship: null,
    artifactSetups: [],
    activeArtifactSetup: 0,
  };
  assert.equal(View.weapons(record, live)[0].key, 'gun');
  assert.deepEqual(View.artifactSets(record, live)[0].slots, ['first', null, 'third']);
  assert.equal(View.artifactSets(record, live)[0].active, true);
  assert.deepEqual(View.artifactSets(record, { ...live, isMe: true }), []);
});

test('inspect nominal DPS validates snapshot stats and preserves the source burst formula', () => {
  const { View } = models();
  const weapon = { dmg: { dmg: () => 100 }, reloadTime: 500, burst: 3, multiNrOfP: 2 };
  assert.equal(View.weaponDps(weapon), 600000 / 566);
  assert.equal(View.weaponDps({ ...weapon, burst: 1.5 }), null);
  assert.equal(View.weaponDps({ ...weapon, reloadTime: 0 }), null);
  assert.equal(View.weaponDps({ ...weapon, dmg: null }), null);
  const record = saved();
  record.fleet.skin.weaponsHotkeys = [1.5];
  assert.equal(View.weapons(record)[0].hotkey, null);
});

const message = (amount: number) => ({
  get_length: () => 4,
  getString: () => '',
  getInt: () => amount,
});
test('cargo reads are serialized and duplicate replies cannot leak into another owner', () => {
  const callbacks: Function[] = [];
  const sent: unknown[][] = [];
  const received: number[] = [];
  const queue = new CargoReadQueue(
    (callback, args) => {
      callbacks.push(callback);
      sent.push(args);
    },
    () => true,
  );
  queue.enqueue(['first', 'Commodities'], (value) => received.push(value.getInt(3)));
  queue.enqueue(['second', 'Commodities'], (value) => received.push(value.getInt(3)));
  assert.equal(sent.length, 1);
  callbacks[0](message(7));
  assert.equal(sent.length, 2);
  callbacks[0](message(99));
  callbacks[1](message(8));
  assert.deepEqual(received, [7, 8]);
  queue.dispose();
});

test('cargo sender failures fail closed and room teardown rejects stale replies', () => {
  const errors: string[] = [];
  let sends = 0;
  const failed = new CargoReadQueue(
    () => {
      sends++;
      throw Error('send failed');
    },
    () => true,
  );
  failed.enqueue(
    ['first'],
    () => {},
    (error) => errors.push(error),
  );
  failed.enqueue(
    ['second'],
    () => {},
    (error) => errors.push(error),
  );
  assert.equal(sends, 1);
  assert.equal(errors.length, 2);
  let receive: Function = () => {};
  let current = true;
  let called = false;
  const queue = new CargoReadQueue(
    (callback) => {
      receive = callback;
    },
    () => current,
  );
  queue.enqueue(['first'], () => {
    called = true;
  });
  current = false;
  receive(message(1));
  assert.equal(called, false);
});

test('room fleet snapshots tolerate empty slots and resolve live weapon DPS', () => {
  const { Projection } = models();
  const live = {
    id: 'owner',
    name: 'Pilot',
    level: 9,
    activeSkin: 'skin',
    isMe: true,
    fleet: [null, { skin: 'skin' }],
    weapons: [],
    weaponsState: [],
    weaponsHotkeys: [],
    techSkills: [],
    artifactSetups: [],
    activeArtifactSetup: 0,
    ship: {
      hp: 80,
      get_hpMax: () => 100,
      shieldHp: 25,
      get_shieldHpMax: () => 50,
      weaponHeat: { get_heat: () => 120, get_max: () => 160 },
      weapons: [{ key: 'gun', dmg: { dmg: () => 100 }, reloadTime: 500, burst: 1, multiNrOfP: 1 }],
    },
  };
  const sections = Projection.sections(saved(), live);
  const stats = sections.find((section: any) => section.label === 'Stats').rows;
  assert.ok(stats.some((row: string) => row.includes('health 80 / 100; shield 25 / 50')));
  assert.ok(stats.includes('Power: 120 / 160'));
  assert.ok(
    sections
      .find((section: any) => section.label === 'Weapons')
      .rows.some((row: string) => row.includes('nominal DPS 200.0')),
  );
});

test('native cargo RPC preserves the Haxe argument array and serializes native and inspector reads', () => {
  const sent: any[][] = [];
  const game: any = { rpc: (...args: any[]) => sent.push(args) };
  const cleanup: Function[] = [];
  const api: any = {
    game,
    defer: (fn: Function) => cleanup.push(fn),
    around: (target: any, key: string, wrap: Function) => {
      const previous = target[key].bind(target);
      target[key] = (...args: any[]) => wrap(previous, ...args);
    },
  };
  const queue = installNativeCargoQueue(api, game);
  const received: string[] = [];
  game.rpc('getCargo', () => received.push('native'), ['native-player', 'Commodities']);
  queue.enqueue(['inspected-player', 'Commodities'], () => received.push('inspector'));
  assert.equal(sent.length, 1);
  assert.deepEqual(sent[0][2], ['native-player', 'Commodities']);
  sent[0][1]({ get_length: () => 0 });
  assert.deepEqual(sent[1][2], ['inspected-player', 'Commodities']);
  sent[1][1]({ get_length: () => 0 });
  assert.deepEqual(received, ['native', 'inspector']);
  game.rpc('unrelated', () => {}, ['unchanged']);
  assert.deepEqual(sent[2].slice(2), [['unchanged']]);
  cleanup.forEach((fn) => fn());
});
