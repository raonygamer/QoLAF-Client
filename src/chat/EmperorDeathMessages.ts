import { DeathMessageSelection } from './DeathMessageSelection';
import { NexarEnemyIdentification } from '../ship/NexarEnemyIdentification';

/** Flavor for the reported killer and caller-resolved cause; no hit attribution here. */
export class EmperorDeathMessages {
  private static readonly POOLS: Record<string, string[]> = {
    torpedoes: [
      "[victim] got exploded by [attacker]'s torpedoes.",
      "[victim] got obliterated by [attacker]'s torpedoes.",
      "[victim] burnt to death by [attacker]'s torpedoes.",
      "[victim] couldn't outrun [attacker]'s torpedoes.",
      "[victim] was reduced to stardust by [attacker]'s torpedoes.",
    ],
    blaster: [
      "[victim] got pierced by [attacker]'s shadow blaster.",
      "[victim] was erased by [attacker]'s shadow blaster.",
      "[victim] became target practice for [attacker]'s shadow blaster.",
      "[victim] found no shelter from [attacker]'s shadow blaster.",
    ],
    bombs: [
      "[victim] got exploded to pieces by [attacker]'s shadow bombs.",
      "[victim] vanished in the blast of [attacker]'s shadow bombs.",
      '[victim] chased [attacker] straight into a shadow bomb.',
      "[victim] found the explosive side of [attacker]'s shadow bombs.",
    ],
    blade: [
      "[victim] got destroyed by [attacker]'s kinetic phase blade.",
      "[victim] was cut out of existence by [attacker]'s kinetic phase blade.",
      "[victim] lost an argument with [attacker]'s kinetic phase blade.",
      "[victim] discovered the sharp end of [attacker]'s kinetic phase blade.",
    ],
    emperor: [
      '[victim] became another victory for [attacker].',
      '[victim] underestimated [attacker].',
    ],
  };

  static choose(
    killerName: string | null,
    cause: string | null,
    selection: DeathMessageSelection | null = null,
  ): string | null {
    // Preserve environmental and self-inflicted messages even if a stale
    // attacker name accompanies the cause.
    if (
      cause == 'sun' ||
      cause == 'comet' ||
      cause == 'suicide' ||
      cause == 'Death Line' ||
      cause == 'Kamikaze'
    )
      return null;
    let attacker: string = NexarEnemyIdentification.displayName(killerName);
    let pool: string = 'emperor';
    switch (attacker) {
      case 'Emperor Xhersix':
        // Its sole cached offensive weapon is the torpedo. Unknown
        // nonempty causes must not disable this loadout-based flavor.
        // The fatal header has no separate impact/burn flag; the burn
        // wording is flavor, not an inferred fatal DoT tick.
        pool = 'torpedoes';
        break;
      case 'Emperor Zharix':
        if (cause == 'Emperor Zharix Shadow Blaster' || cause == 'Shadow Blaster') {
          pool = 'blaster';
        } else if (cause == 'Emperor Zharix Flee Bomb' || cause == 'Shadow Bomb') {
          pool = 'bombs';
        }
        break;
      case 'Emperor Yhgvis':
        // Unlike Zharix, Yhgvis has only one cached offensive weapon
        // and no melee/kamikaze attack. No reported weapon is required.
        pool = 'blade';
        break;
      default:
        return null;
    }
    const variants: string[] = EmperorDeathMessages.POOLS[pool];
    if (selection == null) {
      selection = new DeathMessageSelection(0, '', '', killerName, cause);
    }
    return variants[selection.index('EmperorDeathMessages.' + pool, variants.length)];
  }
}
