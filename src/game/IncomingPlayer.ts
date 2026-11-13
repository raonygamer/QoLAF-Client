import type { Player, Weapon } from './Bindings';

/** Added while the room's incoming-damage history is installed. */
export interface IncomingPlayer extends Player {
  recordIncomingWeaponHit?(weapon: Weapon): void;
  deathMessageWeapon?(killer: string, cause: string | null, damageType: number): string | null;
  recordDeathLineContact?(
    x1: number,
    y1: number,
    x2: number,
    y2: number,
    startX: number,
    startY: number,
  ): void;
}
