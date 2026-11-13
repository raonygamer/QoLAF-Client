import { DeathMessageSelection } from './DeathMessageSelection';

/** Cached ??? / Divider flavor for a caller-resolved cause; no hit attribution here. */
export class NetherDeathMessages {
  private static readonly POOLS: Record<string, string[]> = {
    beam: [
      "[victim] was erased by [attacker]'s void beam.",
      "[attacker]'s void beam left no escape route for [victim].",
      "[victim] found the wrong end of [attacker]'s void beam.",
    ],
    tentacles: [
      "[victim] got dragged into oblivion by [attacker]'s void tentacles.",
      "[victim] couldn't break free of [attacker]'s void tentacles.",
      "[attacker]'s void tentacles wrapped up [victim]'s flight.",
    ],
    divided: [
      '[attacker] took [victim] with it in a final blast.',
      "[victim] got caught in [attacker]'s parting explosion.",
    ],
    unknown: [
      '[victim] became another unanswered question for [attacker].',
      '[victim] got a fatal answer from [attacker].',
    ],
  };

  static choose(
    killerName: string | null,
    cause: string | null,
    selection: DeathMessageSelection | null = null,
  ): string | null {
    if (
      killerName == null ||
      cause == 'sun' ||
      cause == 'comet' ||
      cause == 'suicide' ||
      cause == 'Death Line'
    )
      return null;
    let attacker: string = killerName.replace(/\s+lvl\s+(?:\d+|\?+)(?=\s|$)/i, '');
    if (attacker != '???' && attacker != '??? Divider' && attacker != '??? Divided') {
      return null;
    }
    let pool: string = 'unknown';
    if (attacker == '??? Divided') {
      // Only the divided child has kamikaze=true and no ranged weapons.
      if (cause == 'Kamikaze') pool = 'divided';
    } else if (cause == 'Enemy ??? Beam lvl 89') {
      pool = 'beam'; // Weapons / 222ekuHQxE6j9IOXMVXs6g
    } else if (cause == 'Enemy ??? Void Tentacle') {
      pool = 'tentacles'; // Weapons / 0O4EOmZ-_USlz3RhlUCQ4Q
    } else if (cause == 'Kamikaze') {
      return null;
    }
    const variants: string[] = NetherDeathMessages.POOLS[pool];
    if (selection == null) {
      selection = new DeathMessageSelection(0, '', '', killerName, cause);
    }
    return variants[selection.index('NetherDeathMessages.' + pool, variants.length)];
  }
}
