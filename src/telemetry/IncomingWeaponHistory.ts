interface WeaponContact {
  attacker: string;
  parent: string;
  weapon: string;
  damageType: number;
  time: number;
}
interface WallContact {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  startX: number;
  startY: number;
  lifecycle: number;
  time: number;
}

/** Cosmetic fallback only: local contact is not proof of server damage. Holds no pooled game objects. */
export class IncomingWeaponHistory {
  private contacts: WeaponContact[] = [];
  private wall: WallContact | null = null;

  constructor(
    private lifecycle: number,
    private now: () => number,
  ) {}

  record(
    attackerName: string | null,
    bossTurretParentName: string | null,
    weapon: string | null,
    damageType: number,
    lifecycle: number,
  ): void {
    if (lifecycle !== this.lifecycle) {
      this.contacts.length = 0;
      this.lifecycle = lifecycle;
    }
    const attacker = normalizeAttacker(attackerName);
    const parent = normalizeAttacker(bossTurretParentName);
    if ((!attacker && !parent) || !weapon) return;
    const now = this.now();
    this.contacts = this.contacts.filter(
      (entry) =>
        now - entry.time <= 1500 &&
        now >= entry.time &&
        !(
          entry.attacker === attacker &&
          entry.parent === parent &&
          entry.weapon === weapon &&
          entry.damageType === damageType
        ),
    );
    this.contacts.push({ attacker, parent, weapon, damageType, time: now });
    if (this.contacts.length > 16) this.contacts.shift();
  }

  resolve(killer: string | null, damageType: number, lifecycle: number): string | null {
    if (lifecycle !== this.lifecycle) return null;
    killer = normalizeAttacker(killer);
    if (!killer) return null;
    const now = this.now();
    let result: string | null = null;
    for (const entry of this.contacts) {
      const age = now - entry.time;
      if (
        age < 0 ||
        age > 1500 ||
        entry.damageType !== damageType ||
        (entry.attacker !== killer && entry.parent !== killer)
      )
        continue;
      if (result !== null && result !== entry.weapon) return null;
      result = entry.weapon;
    }
    return result;
  }

  recordDeathLine(
    x1: number,
    y1: number,
    x2: number,
    y2: number,
    startX: number,
    startY: number,
    lifecycle: number,
  ): void {
    if (![x1, y1, x2, y2, startX, startY].every(Number.isFinite)) return;
    this.wall = { x1, y1, x2, y2, startX, startY, lifecycle, time: this.now() };
  }

  hasRecentDeathLineContact(x: number, y: number, radius: number, lifecycle: number): boolean {
    const wall = this.wall;
    if (
      !wall ||
      lifecycle !== wall.lifecycle ||
      ![x, y, radius].every(Number.isFinite) ||
      radius < 0
    )
      return false;
    const age = this.now() - wall.time;
    if (age < 0 || age > 1500) return false;
    const stopX = x - wall.startX,
      stopY = y - wall.startY;
    if (stopX * stopX + stopY * stopY <= 64) return true;
    const lineX = wall.x2 - wall.x1,
      lineY = wall.y2 - wall.y1;
    const lengthSquared = lineX * lineX + lineY * lineY;
    if (!Number.isFinite(lengthSquared)) return false;
    let fraction =
      lengthSquared > 0 ? ((x - wall.x1) * lineX + (y - wall.y1) * lineY) / lengthSquared : 0;
    if (!Number.isFinite(fraction)) return false;
    fraction = Math.max(0, Math.min(1, fraction));
    const dx = x - (wall.x1 + fraction * lineX),
      dy = y - (wall.y1 + fraction * lineY);
    const tolerance = (radius + 8) ** 2;
    return Number.isFinite(tolerance) && dx * dx + dy * dy <= tolerance;
  }
}

export function normalizeAttacker(value: string | null): string {
  value = (value ?? '').replace(/\s+lvl\s+(?:\d+|\?+)\s*$/i, '').trim();
  return value === 'Naxar Wave Generator' ? 'Nexar Wave Generator' : value;
}
