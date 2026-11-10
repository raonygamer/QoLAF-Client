import { read, type Raw } from '../api/Types';
import { NativeUI } from '../ui/NativeUI';
export class TargetPresentation {
  constructor(
    private ui: NativeUI,
    private game: Raw,
  ) {}
  isPlayer(unit: Raw) {
    return !!unit && unit instanceof this.ui.cls('core.ship.PlayerShip');
  }
  sameGroup(unit: Raw) {
    const mine = read(read(this.game, 'me'), 'group'),
      theirs = read(unit?.player, 'group');
    return !!(mine && theirs && mine.id === theirs.id);
  }
  boss(unit: Raw | null) {
    let p = unit?.parentObj;
    const Boss = this.ui.cls('core.boss.Boss'),
      Unit = this.ui.cls('core.unit.Unit');
    for (let i = 0; p && i < 32; i++) {
      if (p instanceof Boss) return p;
      if (!(p instanceof Unit)) break;
      p = p.parentObj;
    }
    return null;
  }
  identity(unit: Raw) {
    return this.boss(unit) ?? unit;
  }
  level(unit: Raw) {
    return this.boss(unit)?.level ?? unit.level ?? 0;
  }
  bossIcon(unit: Raw) {
    return !!(unit && (unit.isBossUnit || this.boss(unit) || unit.miniboss));
  }
  hideStats(unit: Raw) {
    return this.isPlayer(unit) && unit.isHostile && !this.sameGroup(unit);
  }
  name(unit: Raw) {
    const compact = (name: string) =>
      name.toLowerCase().includes('regius') ? 'Exterminatore' : name;
    const boss = this.boss(unit);
    if (boss) return compact(boss.name || 'Unknown');
    if (unit instanceof this.ui.cls('core.spawner.Spawner')) {
      if (unit.factions?.length) return unit.factions[0] + ' Spawner';
      const t = unit.spawnerType;
      return (t ? t[0].toUpperCase() + t.slice(1) : 'Unknown') + ' Spawner';
    }
    return compact(
      String(read(unit, 'name', read(unit.player, 'name', 'Unknown')))
        .split('lvl')[0]
        .trim(),
    );
  }
  aura(unit: Raw) {
    const E = this.ui.cls('core.ship.EnemyShip');
    if (!(unit instanceof E)) return 0;
    const colors: Record<number, number> = {
      [E.RARE_TYPE_DEFENDER]: 0x00bff5,
      [E.RARE_TYPE_ATTACKER]: 0xb8000a,
      [E.RARE_TYPE_SPEEDER]: 0xff9970,
      [E.RARE_TYPE_LEGENDARY]: 0x44ff44,
      [E.RARE_TYPE_UNIQUE]: 0xffff22,
    };
    return colors[unit.rareType] ?? 0;
  }
  values(unit: Raw) {
    const boss = this.boss(unit);
    return boss
      ? { hp: boss.hp, hpMax: boss.hpMax, shield: 0, shieldMax: 0 }
      : {
          hp: unit.hp,
          hpMax: read(unit, 'hpMax'),
          shield: unit.shieldHp,
          shieldMax: read(unit, 'shieldHpMax'),
        };
  }
  compare(a: Raw, b: Raw, distance: (u: Raw) => number) {
    return (
      Number(this.sameGroup(a)) - Number(this.sameGroup(b)) ||
      Number(this.isPlayer(b)) - Number(this.isPlayer(a)) ||
      Number(this.bossIcon(b)) - Number(this.bossIcon(a)) ||
      this.level(b) - this.level(a) ||
      distance(a) - distance(b) ||
      a.id - b.id
    );
  }
}
export function levelColor(level: number) {
  return level >= 100 ? 0xff0033 : level >= 75 ? 0xff8c00 : level >= 50 ? 0x00ddff : 0x737373;
}
