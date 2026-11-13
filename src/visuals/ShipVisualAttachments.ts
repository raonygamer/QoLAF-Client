import { read, type Raw } from '../api/Types';

interface AttachmentSnapshot {
  engineX: number;
  engineY: number;
  weaponX: number;
  weaponY: number;
  engine: Raw | null;
  dual: boolean;
  dualDistance: number;
}

/** Owns appearance-specific attachments without replacing ship or weapon stats. */
export class ShipVisualAttachments {
  private original: AttachmentSnapshot | null = null;
  private visual: Raw | null = null;
  private engineVisual: Raw | null = null;
  useVisualEmitters = false;
  shootingPointIndex = -1;

  constructor(private ship: Raw) {}

  select(visual: Raw, engine: Raw | null): void {
    if (!this.original) {
      this.original = {
        engineX: this.ship.enginePos.x,
        engineY: this.ship.enginePos.y,
        weaponX: this.ship.weaponPos.x,
        weaponY: this.ship.weaponPos.y,
        engine: this.ship.engine?.obj ?? null,
        dual: this.ship.engine?.dual ?? false,
        dualDistance: this.ship.engine?.dualDistance ?? 0,
      };
    }
    this.visual = visual;
    this.engineVisual = engine;
    this.useVisualEmitters = true;
    this.shootingPointIndex = -1;
    this.apply();
  }

  private configureEngine(object: Raw | null, dual: boolean, distance: number): void {
    const engine = this.ship.engine;
    if (
      !engine ||
      !object ||
      (engine.obj === object && engine.dual === dual && engine.dualDistance === distance)
    )
      return;
    engine.hide();
    engine.obj = object;
    engine.dual = dual;
    engine.dualDistance = distance;
    engine.show();
  }

  private apply(): void {
    const original = this.original;
    if (!original) return;
    const visual = this.useVisualEmitters ? this.visual : null;
    if (visual && Object.hasOwn(visual, 'enginePosX') && Object.hasOwn(visual, 'enginePosY')) {
      this.ship.enginePos.x = Number(visual.enginePosX);
      this.ship.enginePos.y = Number(visual.enginePosY);
    } else {
      this.ship.enginePos.x = original.engineX;
      this.ship.enginePos.y = original.engineY;
    }
    if (visual && Object.hasOwn(visual, 'weaponPosX') && Object.hasOwn(visual, 'weaponPosY')) {
      this.ship.weaponPos.x = Number(visual.weaponPosX);
      this.ship.weaponPos.y = Number(visual.weaponPosY);
    } else {
      this.ship.weaponPos.x = original.weaponX;
      this.ship.weaponPos.y = original.weaponY;
    }
    const engine = visual ? this.engineVisual : null;
    this.configureEngine(
      engine ?? original.engine,
      engine ? Boolean(engine.dual) : original.dual,
      engine ? Number(engine.dualDistance) | 0 : original.dualDistance,
    );
  }

  toggleEmitters(): Raw | null {
    if (!this.original || !this.visual) return null;
    this.useVisualEmitters = !this.useVisualEmitters;
    this.shootingPointIndex = -1;
    this.apply();
    return {
      enabled: this.useVisualEmitters,
      engineX: this.ship.enginePos.x,
      engineY: this.ship.enginePos.y,
      weaponX: this.ship.weaponPos.x,
      weaponY: this.ship.weaponPos.y,
      customEngine: this.useVisualEmitters && this.engineVisual != null,
    };
  }

  cycleShootingPoint(): Raw | null {
    return this.setShootingPoint(this.shootingPointIndex + 1);
  }

  setShootingPoint(index: number): Raw | null {
    const visual = this.visual;
    if (
      !this.original ||
      !visual ||
      !Object.hasOwn(visual, 'weaponPosX') ||
      !Object.hasOwn(visual, 'weaponPosY')
    )
      return null;
    this.useVisualEmitters = true;
    this.apply();
    const x = Number(visual.weaponPosX),
      y = Number(visual.weaponPosY);
    const weapon = read(this.ship, 'weapon');
    let count = 1;
    if (weapon && weapon.multiNrOfP > 1 && Math.abs(weapon.multiOffset) > 0) {
      count = weapon.multiNrOfP;
      this.shootingPointIndex = ((Math.trunc(index) % count) + count) % count;
      this.ship.weaponPos.y =
        y + (weapon.multiOffset * (this.shootingPointIndex - 0.5 * (count - 1))) / count;
    } else if (y !== 0) {
      count = 2;
      this.shootingPointIndex = ((Math.trunc(index) % count) + count) % count;
      this.ship.weaponPos.y = this.shootingPointIndex === 0 ? y : -y;
    } else {
      this.shootingPointIndex = 0;
      this.ship.weaponPos.y = y;
    }
    this.ship.weaponPos.x = x;
    return {
      index: this.shootingPointIndex + 1,
      count,
      x,
      y: this.ship.weaponPos.y,
      weapon: weapon?.name ?? 'current weapon',
    };
  }

  restore(): void {
    this.useVisualEmitters = false;
    this.apply();
    this.clear();
  }

  /** Pool reset discards ownership; it must not recreate emitters on a dying ship. */
  clear(): void {
    this.original = this.visual = this.engineVisual = null;
    this.useVisualEmitters = false;
    this.shootingPointIndex = -1;
  }
}
