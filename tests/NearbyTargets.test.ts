import { bindGameClasses, type GameScene, type Unit as NativeUnit } from '../src/game/Bindings';
import type { API } from '../src/api/Types';
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { NearbyTargets } from '../src/target/NearbyTargets';
import { TargetPresentation } from '../src/target/TargetPresentation';
import { TargetSystem } from '../src/target/TargetSystem';
import { defaults } from '../src/settings/Settings';

function fixture() {
  class Unit {
    alive = true;
    isHostile = true;
    pos = { x: 100, y: 0 };
    level = 10;
    parentObj: any = null;
    constructor(public id: number) {}
    get_pos() {
      return this.pos;
    }
    hasFaction() {
      return false;
    }
    get_id() {
      return this.id;
    }
  }
  class PlayerShip extends Unit {
    get_landed() {
      return false;
    }
    player = {
      isMe: false,
      group: null as any,
      get_group() {
        return this.group;
      },
    };
  }
  class Boss {
    level = 100;
  }
  class EnemyShip extends Unit {}
  const classes: Record<string, any> = {
    'core.unit.Unit': Unit,
    'core.ship.PlayerShip': PlayerShip,
    'core.ship.EnemyShip': EnemyShip,
    'core.boss.Boss': Boss,
  };
  const config = { ...defaults };
  const game = { me: { ship: new Unit(0), group: { get_id: () => 1 } } };
  game.me.ship.pos.x = 0;
  const target = new TargetSystem(
    { get_me: () => ({ ship: game.me.ship, get_group: () => game.me.group }) } as unknown as Pick<
      GameScene,
      'get_me'
    >,
    config,
  );
  bindGameClasses({ cls: (name: string) => classes[name] ?? {} } as unknown as API);
  const info = new TargetPresentation({
    get_me: () => ({ get_group: () => game.me.group }),
  } as unknown as Pick<GameScene, 'get_me'>);
  return {
    Unit: Unit as unknown as new (id: number) => Unit & NativeUnit,
    PlayerShip: PlayerShip as unknown as new (id: number) => PlayerShip & NativeUnit,
    Boss,
    config,
    target,
    nearby: new NearbyTargets(target, info, config),
  };
}

test('nearby rows reject removed and recycled objects until the next snapshot', () => {
  const { Unit, target, nearby } = fixture();
  const unit = new Unit(1);
  nearby.refresh([unit], 5);
  assert.equal(nearby.at(0), unit);
  target.remove(unit);
  // Pool reuse may leave alive=true without a frame between remove and add.
  unit.id = 2;
  assert.equal(nearby.at(0), null);
  assert.equal(nearby.select(unit), false);
  assert.equal(target.current, null);
  nearby.refresh([unit], 5);
  assert.equal(nearby.at(0), unit);
  assert.equal(nearby.select(unit), true);
  assert.equal(target.current, unit);
  assert.equal(target.locked, true);
});

test('active multipart boss disappears immediately from cached rows and cannot be selected twice', () => {
  const { Unit, Boss, target, nearby } = fixture();
  const boss = new Boss();
  const first = new Unit(1);
  const second = new Unit(2);
  first.parentObj = second.parentObj = boss;
  nearby.refresh([first, second], 5);
  assert.equal(nearby.at(0), first);
  assert.equal(nearby.at(1), null, 'deduplicate parts by boss identity');
  target.select(second, true);
  assert.equal(nearby.at(0), null, 'do not wait for the 250ms refresh');
  assert.equal(nearby.select(first), false);
  assert.equal(target.current, second);
});

test('source priority and distance sorting changes only when refreshing the snapshot', () => {
  const { Unit, PlayerShip, nearby } = fixture();
  const near = new Unit(1);
  const far = new Unit(2);
  far.pos.x = 200;
  const high = new Unit(3);
  high.level = 20;
  const player = new PlayerShip(4);
  const group = new PlayerShip(5);
  group.player.group = { get_id: () => 1 };
  const units = [group, far, near, high, player];
  nearby.refresh(units, 5);
  assert.deepEqual(
    [0, 1, 2, 3, 4].map((i) => nearby.at(i)),
    [player, high, near, far, group],
  );
  near.pos.x = 300;
  assert.equal(nearby.at(2), near, 'distance updates do not reorder within a snapshot');
  nearby.refresh(units, 3);
  assert.deepEqual(
    [0, 1, 2, 3].map((i) => nearby.at(i)),
    [player, high, far, null],
  );
  assert.equal(
    nearby.select(group),
    false,
    'a unit outside the displayed snapshot cannot be selected',
  );
});

test('cached rows and clicks revalidate range, hostility and alive state', () => {
  const { Unit, config, nearby } = fixture();
  const unit = new Unit(1);
  nearby.refresh([unit], 5);
  for (const invalidate of [
    () => {
      unit.alive = false;
    },
    () => {
      unit.isHostile = false;
    },
    () => {
      unit.pos.x = config.target_search_distance;
    },
  ]) {
    unit.alive = unit.isHostile = true;
    unit.pos.x = 100;
    invalidate();
    assert.equal(nearby.at(0), null);
    assert.equal(nearby.select(unit), false);
  }
});

test('Haxe group ID getters distinguish groupmates in radar sorting and automatic priority', () => {
  const { PlayerShip, target, nearby } = fixture();
  const groupmate = new PlayerShip(10),
    hostile = new PlayerShip(11);
  groupmate.player.group = { get_id: () => 1 };
  hostile.player.group = { get_id: () => 2 };
  target.select(groupmate, true);
  assert.equal(
    target.auto(hostile),
    true,
    'hostile player outranks groupmate even during target cooldown',
  );
  assert.equal(target.current, hostile);
  assert.equal(target.auto(groupmate), false);
  target.clear(true);
  nearby.refresh([groupmate, hostile], 2);
  assert.equal(nearby.at(0), hostile);
  assert.equal(nearby.at(1), groupmate);
});

test('native reset invalidates a snapshot even without a manager removal notification', () => {
  const { Unit, target, nearby } = fixture();
  let generation = 12;
  const unit = Object.assign(new Unit(1), { get_lifecycleId: () => generation });
  nearby.refresh([unit], 1);
  assert.equal(nearby.at(0), unit);
  generation++;
  unit.id = 2;
  assert.equal(nearby.at(0), null);
  assert.equal(nearby.select(unit), false);
  assert.equal(target.current, null);
  nearby.refresh([unit], 1);
  assert.equal(nearby.at(0), unit);
  target.remove(unit);
  assert.equal(nearby.at(0), null, 'removal invalidates before the next native reset');
  generation++;
  assert.equal(nearby.select(unit), false);
  nearby.refresh([unit], 1);
  assert.equal(nearby.select(unit), true);
});

test('equal-distance rows keep source ID order when manager iteration order changes', () => {
  const { Unit, nearby } = fixture();
  const units = [new Unit(9), new Unit(2), new Unit(5)];
  for (const order of [units, [...units].reverse(), [units[1], units[0], units[2]]]) {
    nearby.refresh(order, 3);
    assert.deepEqual(
      [0, 1, 2].map((index) => nearby.at(index)?.get_id()),
      [2, 5, 9],
    );
  }
});

test('source boss priority outranks ordinary level and excludes the active boss identity', () => {
  const { Unit, Boss, target, nearby } = fixture();
  const ordinary = new Unit(1);
  ordinary.level = 200;
  ordinary.pos.x = 1;
  const firstPart = new Unit(2);
  const secondPart = new Unit(3);
  firstPart.parentObj = secondPart.parentObj = new Boss();
  nearby.refresh([ordinary, firstPart, secondPart], 3);
  assert.equal(nearby.at(0), firstPart);
  assert.equal(nearby.at(1), ordinary);
  assert.equal(nearby.at(2), null);
  target.select(secondPart, true);
  nearby.refresh([ordinary, firstPart, secondPart], 3);
  assert.equal(nearby.at(0), ordinary);
  assert.equal(nearby.at(1), null);
});
