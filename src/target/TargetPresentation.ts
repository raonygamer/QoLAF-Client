import { samePlayerGroup } from './PlayerGroup';
import { Boss, EnemyShip, PlayerShip, Spawner, Unit, type GameScene } from '../game/Bindings';
export class TargetPresentation {
  constructor(private readonly game: Pick<GameScene, 'get_me'>) {}
  isPlayer(unit: Unit): unit is PlayerShip {
    return !!unit && unit instanceof PlayerShip;
  }
  sameGroup(unit: Unit): boolean {
    return this.isPlayer(unit) && samePlayerGroup(this.game.get_me(), unit.player);
  }
  boss(unit: Unit | null): Boss | null {
    let p = unit?.parentObj;
    for (let i = 0; p && i < 32; i++) {
      if (p instanceof Boss) return p;
      if (!(p instanceof Unit)) break;
      p = p.parentObj;
    }
    return null;
  }
  identity(unit: Unit) {
    return this.boss(unit) ?? unit;
  }
  level(unit: Unit) {
    return this.boss(unit)?.level ?? unit.level ?? 0;
  }
  bossIcon(unit: Unit) {
    return !!(
      unit &&
      (unit.isBossUnit || this.boss(unit) || (unit instanceof EnemyShip && unit.miniboss))
    );
  }
  hideStats(unit: Unit) {
    return this.isPlayer(unit) && unit.isHostile && !this.sameGroup(unit);
  }
  activeName(unit: Unit | null): string {
    const boss = this.boss(unit);
    return boss ? this.compactName(boss.get_name() || 'Unknown') : this.name(unit);
  }
  private compactName(name: string): string {
    return name.toLowerCase().includes('regius') ? 'Exterminatore' : name;
  }
  name(unit: Unit | null) {
    if (!unit) return 'Unknown';
    if (unit instanceof Spawner) {
      if (unit.factions?.length) return unit.factions[0] + ' Spawner';
      const t = unit.spawnerType;
      return (t ? t[0].toUpperCase() + t.slice(1) : 'Unknown') + ' Spawner';
    }
    const boss = this.boss(unit);
    if (boss) return this.compactName(boss.get_name() || 'Unknown');
    return this.compactName((unit.get_name() || 'Unknown').split('lvl')[0].trim());
  }
  aura(unit: Unit) {
    if (!(unit instanceof EnemyShip)) return 0;
    const colors: Record<number, number> = {
      [EnemyShip.RARE_TYPE_DEFENDER]: 0x00bff5,
      [EnemyShip.RARE_TYPE_ATTACKER]: 0xb8000a,
      [EnemyShip.RARE_TYPE_SPEEDER]: 0xff9970,
      [EnemyShip.RARE_TYPE_LEGENDARY]: 0x44ff44,
      [EnemyShip.RARE_TYPE_UNIQUE]: 0xffff22,
    };
    return colors[unit.rareType] ?? 0;
  }
  values(unit: Unit) {
    const boss = this.boss(unit);
    return boss
      ? { hp: boss.hp, hpMax: boss.hpMax, shield: 0, shieldMax: 0 }
      : {
          hp: unit.hp,
          hpMax: unit.get_hpMax(),
          shield: unit.shieldHp,
          shieldMax: unit.get_shieldHpMax(),
        };
  }
  compare(a: Unit, b: Unit, distance: (u: Unit) => number) {
    return (
      Number(this.sameGroup(a)) - Number(this.sameGroup(b)) ||
      Number(this.isPlayer(b)) - Number(this.isPlayer(a)) ||
      Number(this.bossIcon(b)) - Number(this.bossIcon(a)) ||
      this.level(b) - this.level(a) ||
      distance(a) - distance(b) ||
      a.get_id() - b.get_id()
    );
  }
}
export function levelColor(level: number) {
  return level >= 100 ? 0xff0033 : level >= 75 ? 0xff8c00 : level >= 50 ? 0x00ddff : 0x737373;
}
