import { DeathMessageSelection } from './DeathMessageSelection';

/** Local presentation templates only; the caller owns names, localization and output. */
export class DeathMessageVariants {
  private static readonly POOLS: Record<string, string[]> = {
    'Death Line': [
      '[victim] tried to cross through the wall.',
      "[victim] found out why it's called a Death Line.",
      "[victim]'s shortcut ended at the Death Line.",
    ],
    sun: [
      '[victim] flew too close to the sun.',
      '[victim] discovered that stars are not parking spots.',
      '[victim] took the scenic route through a star.',
      "[victim]'s hull warranty did not cover solar contact.",
    ],
    comet: [
      '[victim] lost a right-of-way dispute with a comet.',
      '[victim] discovered that comets do not yield.',
      "[victim] picked the wrong side of a comet's flight path.",
      '[victim] met a comet on a very tight schedule.',
    ],
    'Missile Launcher': [
      "[victim] could not shake [attacker]'s missiles.",
      "[attacker]'s missiles found [victim]'s forwarding address.",
      '[victim] ran out of sky before [attacker] ran out of missiles.',
      "[victim] received an express delivery from [attacker]'s missile launcher.",
    ],
    'Mine Launcher': [
      "[victim] found [attacker]'s mines the hard way.",
      "[victim] mistook [attacker]'s minefield for a shortcut.",
      '[attacker] left a mine where [victim] wanted to be.',
      "[victim] failed to read the fine print on [attacker]'s mines.",
    ],
    'Plasma Gun': [
      "[victim]'s hull could not take [attacker]'s plasma.",
      "[attacker]'s plasma gun settled the argument with [victim].",
      "[victim] overheated under [attacker]'s plasma fire.",
      "[victim] underestimated the temperature of [attacker]'s plasma.",
    ],
    'Lightning Gun': [
      "[victim] short-circuited under [attacker]'s lightning.",
      '[attacker] gave [victim] a shocking lesson in conductivity.',
      "[victim] became the ground wire for [attacker]'s lightning gun.",
      "[victim]'s surge protection failed against [attacker].",
    ],
    Blaster: [
      '[attacker] blasted [victim] out of the fight.',
      "[victim] could not argue with [attacker]'s blaster.",
      "[victim] stayed in [attacker]'s sights a little too long.",
      "[attacker]'s blaster put an end to [victim]'s flight plan.",
    ],
    'Nuke Launcher': [
      "[victim] was inside [attacker]'s blast radius.",
      "[attacker] brought a nuke to [victim]'s dogfight.",
      "[victim] learned that [attacker]'s nuke had no small-print warning.",
      "[victim]'s escape plan was smaller than [attacker]'s nuclear explosion.",
    ],
    'Acid Blaster': [
      "[victim]'s corrosion resistance failed against [attacker].",
      "[attacker]'s acid ate through [victim]'s flight plans.",
      "[victim]'s hull lost a chemistry test to [attacker].",
    ],
    'Energy Nova': [
      "[victim] was caught in [attacker]'s energy nova.",
      "[attacker]'s nova left [victim] nowhere to hide.",
      "[victim] stood too close to [attacker]'s big energy release.",
      "[attacker] ended [victim]'s flight with a nova pulse.",
    ],
    Railgun: [
      "[victim] crossed [attacker]'s railgun sightline.",
      "[attacker]'s railgun made a point that [victim] could not ignore.",
      "[victim] misjudged the business end of [attacker]'s railgun.",
      "[attacker] lined up a railgun shot with [victim]'s flight plan.",
    ],
    'Shadow Bomb': [
      "[victim] found [attacker]'s shadow bomb a moment too late.",
      "[attacker]'s shadow bomb ended [victim]'s quiet flight.",
      "[victim] underestimated the blast waiting in [attacker]'s shadows.",
      '[attacker] left [victim] a shadow bomb instead of a warning.',
    ],
    'Shadow Blaster': [
      '[attacker] caught [victim] with a shot from the shadows.',
      "[victim] lost track of [attacker]'s shadow blaster.",
      "[attacker]'s shadow blaster made [victim]'s outlook considerably darker.",
      "[victim] learned that [attacker]'s shadows could shoot back.",
    ],
    'Plasma Torpedos': [
      "[victim] could not clear [attacker]'s plasma torpedoes.",
      "[attacker]'s plasma torpedoes caught up with [victim].",
      "[victim]'s route intersected [attacker]'s plasma torpedo delivery.",
      '[attacker] sent [victim] a plasma torpedo-shaped change of plans.',
    ],
    'Kinetic Phase Blade': [
      "[attacker]'s kinetic phase blade cut [victim]'s flight short.",
      "[victim] was on the wrong side of [attacker]'s kinetic phase blade.",
      '[attacker] phased [victim] out of the fight.',
      "[victim]'s hull failed to make the cut against [attacker].",
    ],
  };

  static choose(
    cause: string | null,
    selection: DeathMessageSelection | null = null,
  ): string | null {
    if (cause == null || !Object.prototype.hasOwnProperty.call(DeathMessageVariants.POOLS, cause))
      return null;
    const pool: string[] = DeathMessageVariants.POOLS[cause];
    if (selection == null) {
      selection = new DeathMessageSelection(0, '', '', '', cause);
    }
    return pool[selection.index('DeathMessageVariants.' + cause, pool.length)];
  }
}
