import { DeathMessageSelection } from './DeathMessageSelection';
import { NexarEnemyIdentification } from '../ship/NexarEnemyIdentification';

/** Local flavor only: match a cached Aureus owner before interpreting a cause. */
export class AureusDeathMessages {
  // Ownership from assets/texts/cache.json (Enemies and Executor's Turrets).
  // Exact names avoid classifying unrelated player weapons as Aureus attacks.
  private static readonly OWNERS: Record<string, string> = {
    'Aureus Judicator': 'judicator',
    'Aureus Monachus': 'monachus',
    'Aureus Orb': 'orb',
    'Aureus Radiant': 'radiant',
    'Aureus Sidus': 'sidus',
    'Aureus Sidus Shard': 'shard',
    'Aureus Sidus Shard 88': 'shard',
    'Aureus Square': 'square',
    'Aureus Triad': 'triad',
    'Aureus Warrior': 'warrior',
    Executor: 'executor',
    // This spelling is the actual Executor turret name in the cache.
    'Boss Auerus Lightning': 'executor',
  };
  private static readonly WEAPONS: Record<string, string> = {
    // Judicator: 8_bQQruskEOG6JWP68OUAg, Z02JsLUEbEyMlAGVT91mNA,
    // iFJpW8UJnEev0Kt3AQ9kcQ.
    'Enemy Aureus Judicator Light 1': 'judicatorLight',
    'Enemy Aureus Judicator Light 2': 'judicatorLight',
    'Enemy Aureus Chrono Beam lvl 85': 'judicatorBeam',
    // Monachus: r-eV_tEV9EitYkUPZvRnew. Warrior: WwZ-G-ek5k6S8_MmdY9FMA.
    'Enemy Aureus Flamer lvl 75': 'monachusFlame',
    'Enemy Aureus Blaster lvl 75': 'warriorBlaster',
    // Orb: KhZ2KGlWE0633NY3JLlajw, d2c2PctvvkqYVBXGwaK92Q,
    // CzGtLJCfXk23UHAvrBQ94A. These three weapons have distinct damage types.
    'Enemy Aureus Orb 1': 'orbKinetic',
    'Enemy Aureus Orb 2': 'orbEnergy',
    'Enemy Aureus Orb 3': 'orbCorrosive',
    // Square: RMhFhzTzeUaBaG2at_Iqkg, ZgKzAMAy3kKp6tpupVbLKQ,
    // xllIv2kdH0ihdq98Fjgjig. All three projectiles use cluster AI.
    'Enemy Aureus Square Split 1': 'squareSplit',
    'Enemy Aureus Square Split 2': 'squareSplit',
    'Enemy Aureus Square Split 3': 'squareSplit',
    // Sidus owns Star Light 1 through 7; its shard owns only Broken Star Light.
    'Enemy Aureus Star Light 1': 'sidusLight',
    'Enemy Aureus Star Light 2': 'sidusLight',
    'Enemy Aureus Star Light 3': 'sidusLight',
    'Enemy Aureus Star Light 4': 'sidusLight',
    'Enemy Aureus Star Light 5': 'sidusLight',
    'Enemy Aureus Star Light 6': 'sidusLight',
    'Enemy Aureus Star Light 7': 'sidusLight',
    'Enemy Aureus Broken Star Light 1': 'shardLight',
    // Executor rIRINfHe_E2HfilbAfg-mA -> turret 86vPSZQeMkyidaC1qYcu0g
    // -> weapon CfhtzzXOME2jbmFExG1yUQ.
    'Boss Aureus Executor Lightning': 'executorLightning',
  };
  private static readonly WEAPON_OWNERS: Record<string, string> = {
    judicatorLight: 'judicator',
    judicatorBeam: 'judicator',
    monachusFlame: 'monachus',
    warriorBlaster: 'warrior',
    orbKinetic: 'orb',
    orbEnergy: 'orb',
    orbCorrosive: 'orb',
    squareSplit: 'square',
    sidusLight: 'sidus',
    shardLight: 'shard',
    executorLightning: 'executor',
  };
  private static readonly POOLS: Record<string, string[]> = {
    judicatorLight: [
      "[victim] was sentenced to stardust by [attacker]'s lightning.",
      "[victim] lost the appeal against [attacker]'s lightning.",
      "[attacker]'s lightning delivered the final verdict on [victim].",
    ],
    judicatorBeam: [
      "[victim] was erased by [attacker]'s beam.",
      "[victim] stood on the wrong side of [attacker]'s firing line.",
      "[attacker]'s beam closed the case on [victim].",
    ],
    monachusFlame: [
      "[victim] was roasted by [attacker]'s flames.",
      "[victim] got too close to [attacker]'s blue fire.",
    ],
    warriorBlaster: [
      '[victim] was blasted apart by [attacker].',
      "[victim] caught the wrong end of [attacker]'s blaster.",
    ],
    orbKinetic: [
      "[victim] was battered by [attacker]'s kinetic orbs.",
      "[victim] couldn't shake [attacker]'s kinetic orbs.",
    ],
    orbEnergy: [
      "[victim] was vaporized by [attacker]'s energy orbs.",
      "[victim] couldn't escape [attacker]'s glowing pursuit.",
    ],
    orbCorrosive: [
      "[victim] was dissolved by [attacker]'s corrosive orbs.",
      "[victim] discovered the caustic side of [attacker]'s orbs.",
    ],
    squareSplit: [
      "[victim] was boxed in by [attacker]'s splitting shots.",
      "[victim] ran out of angles against [attacker]'s splitting shots.",
    ],
    sidusLight: [
      "[victim] was crossed out by [attacker]'s beams.",
      "[victim] found the lethal side of [attacker]'s starlight.",
      "[attacker]'s beams turned [victim] into a fading constellation.",
    ],
    shardLight: [
      "[victim] underestimated [attacker]'s little beam.",
      "[victim] found out that [attacker]'s broken star still shines.",
    ],
    executorLightning: [
      "[victim] was executed by [attacker]'s lightning.",
      '[victim] became a lightning rod for [attacker].',
      "[attacker]'s lightning signed [victim]'s death warrant.",
    ],
    executorDefeat: [
      '[attacker] stomped [victim].',
      '[victim] was crushed by [attacker].',
      '[attacker] made short work of [victim].',
    ],
    radiantExplosion: [
      "[victim] was caught in [attacker]'s final flash.",
      '[attacker] went out with a bang and took [victim] along.',
    ],
    aureus: [
      '[victim] became another Aureus casualty at the hands of [attacker].',
      '[victim] underestimated [attacker].',
    ],
  };

  static choose(
    killerName: string | null,
    cause: string | null,
    selection: DeathMessageSelection | null = null,
  ): string | null {
    if (cause == 'sun' || cause == 'comet' || cause == 'suicide' || cause == 'Death Line')
      return null;
    let name: string = NexarEnemyIdentification.displayName(killerName);
    if (!Object.prototype.hasOwnProperty.call(AureusDeathMessages.OWNERS, name)) return null;
    let owner: string = AureusDeathMessages.OWNERS[name];
    // Unknown Executor causes have no documented melee flag. "Stomped"
    // is general defeat flavor, not an authoritative collision claim.
    // Keep that flavor scoped to the named boss, not its lightning turrets.
    let pool: string = name == 'Executor' ? 'executorDefeat' : 'aureus';
    if (cause != null && Object.prototype.hasOwnProperty.call(AureusDeathMessages.WEAPONS, cause)) {
      pool = AureusDeathMessages.WEAPONS[cause];
      if (AureusDeathMessages.WEAPON_OWNERS[pool] != owner) return null;
    } else if (cause == 'Kamikaze') {
      // Radiant is the only cached Aureus enemy with kamikaze=true.
      if (owner != 'radiant') return null;
      pool = 'radiantExplosion';
    }
    const variants: string[] = AureusDeathMessages.POOLS[pool];
    if (selection == null) {
      selection = new DeathMessageSelection(0, '', '', killerName, cause);
    }
    return variants[selection.index('AureusDeathMessages.' + pool, variants.length)];
  }
}
