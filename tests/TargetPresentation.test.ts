import { bindGameClasses, type Unit as NativeUnit, type GameScene } from '../src/game/Bindings';
import type { API } from '../src/api/Types';
import assert from 'node:assert/strict';
import test from 'node:test';
import { TargetPresentation } from '../src/target/TargetPresentation';

function fixture() {
  class Unit {
    parentObj: any = null;
    name = '';
    hp = 40;
    shieldHp = 15;
    get_hpMax() {
      return 100;
    }
    get_shieldHpMax() {
      return 60;
    }
    get_name() {
      return this.name;
    }
  }
  class PlayerShip extends Unit {
    player = { get_group: () => ({ get_id: () => 1 }) };
  }
  class EnemyShip extends Unit {
    miniboss = true;
  }
  class Boss {
    name = 'Regius';
    hp = 300;
    hpMax = 800;
    get_name() {
      return this.name;
    }
  }
  class Spawner extends Unit {
    factions: string[] = [];
    spawnerType = '';
  }
  const classes: Record<string, any> = {
    'core.unit.Unit': Unit,
    'core.boss.Boss': Boss,
    'core.spawner.Spawner': Spawner,
    'core.ship.PlayerShip': PlayerShip,
    'core.ship.EnemyShip': EnemyShip,
  };
  bindGameClasses({ cls: (name: string) => classes[name] ?? {} } as unknown as API);
  const presentation = new TargetPresentation({
    get_me: () => ({ get_group: () => ({ get_id: () => 1 }) }),
  } as unknown as Pick<GameScene, 'get_me'>);
  return {
    presentation,
    Unit: Unit as unknown as new () => Unit & NativeUnit,
    Boss,
    Spawner: Spawner as unknown as new () => Spawner & NativeUnit,
    PlayerShip: PlayerShip as unknown as new () => PlayerShip & NativeUnit,
    EnemyShip: EnemyShip as unknown as new () => EnemyShip & NativeUnit,
  };
}

test('boss-owned spawners retain source faction/type labels before boss-name resolution', () => {
  const { presentation, Boss, Spawner } = fixture();
  const spawner = new Spawner();
  spawner.parentObj = new Boss();
  spawner.factions = ['Nexar'];
  assert.equal(presentation.name(spawner), 'Nexar Spawner');
  spawner.factions = [];
  spawner.spawnerType = 'elite';
  assert.equal(presentation.name(spawner), 'Elite Spawner');
  spawner.spawnerType = '';
  assert.equal(presentation.name(spawner), 'Unknown Spawner');
});

test('target names preserve source unknown fallback, level stripping and boss compaction', () => {
  const { presentation, Unit, Boss } = fixture();
  assert.equal(presentation.name(null), 'Unknown');
  const unit = new Unit();
  assert.equal(presentation.name(unit), 'Unknown');
  unit.name = '  Scout lvl 85  ';
  assert.equal(presentation.name(unit), 'Scout');
  unit.parentObj = new Boss();
  assert.equal(presentation.name(unit), 'Exterminatore');
  unit.parentObj.name = '';
  assert.equal(presentation.name(unit), 'Unknown');
});

test('target priority restricts group and miniboss flags to their source unit classes', () => {
  const { presentation, Unit, PlayerShip, EnemyShip } = fixture();
  const playerLike = Object.assign(new Unit(), { player: { group: { id: 1 } }, miniboss: true });
  assert.equal(presentation.sameGroup(playerLike), false);
  assert.equal(presentation.bossIcon(playerLike), false);
  assert.equal(presentation.sameGroup(new PlayerShip()), true);
  assert.equal(presentation.bossIcon(new EnemyShip()), true);
  assert.equal(presentation.bossIcon(Object.assign(new Unit(), { isBossUnit: true })), true);
});

test('target stats use native maximum getters and aggregate boss health without component shields', () => {
  const { presentation, Unit, Boss } = fixture();
  const unit = new Unit();
  assert.deepEqual(presentation.values(unit), { hp: 40, hpMax: 100, shield: 15, shieldMax: 60 });
  unit.parentObj = new Boss();
  assert.deepEqual(presentation.values(unit), { hp: 300, hpMax: 800, shield: 0, shieldMax: 0 });
});

test('active boss-owned spawners show boss name while nearby rows retain spawner labels', () => {
  const { presentation, Boss, Spawner, Unit } = fixture();
  const spawner = new Spawner();
  spawner.factions = ['Nexar'];
  spawner.parentObj = new Boss();
  assert.equal(presentation.name(spawner), 'Nexar Spawner');
  assert.equal(presentation.activeName(spawner), 'Exterminatore');
  spawner.parentObj.name = 'Emperor';
  assert.equal(presentation.activeName(spawner), 'Emperor');
  const ordinary = new Unit();
  ordinary.name = 'Scout lvl 85';
  assert.equal(presentation.activeName(ordinary), 'Scout');
  assert.equal(presentation.activeName(null), 'Unknown');
});
