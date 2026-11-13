import { DeathMessageSelection } from './DeathMessageSelection';
import { NexarEnemyIdentification } from '../ship/NexarEnemyIdentification';

/** NPC-only flavor from reported causes or a unique cached attack family, not hit proof. */
export class FactionDeathMessages {
  // These exact Enemy names and Weapon names come from assets/texts/cache.json.
  // Level suffixes are removed from both. Shared ship skins do not confer rank.
  private static readonly PROFILES: Record<string, string> = {
    'Nexar Blade': 'blade',
    'Nexar Vanguard': 'vanguard',
    'Commander Zherghur': 'blade',
    'Nexar Elite Blade': 'eliteBlade',
    'Nexar Commander': 'eliteBlade',
    'Rear Admiral Vorghis': 'eliteBlade',
    'Nexar Cluster Bomber': 'cluster',
    'Nexar Elite Edge': 'edge',
    'Commodore Herivis': 'edge',
    'Nexar Elite Phaser': 'phaser',
    'Captain Xhargrefh': 'phaser',
    'Nexar Elite Shadow': 'shadow',
    'Admiral Zhersis': 'shadow',
    'Nexar Elite Vindicator': 'vindicator',
    'Vice Admiral Ahrgeris': 'vindicator',
    'Nexar Fighter': 'fighter',
    'Nexar Projector': 'projector',
    'Lieutenant Commander Gerhavis': 'projector',
    'Nexar Skirmisher': 'skirmisher',
    'Nexar Stealth Bomber': 'bomber',
    'Nexar Tank': 'tank',
    'Lieutenant Xhaveris': 'tank',
    'Nexar Twin': 'twin',
    'Nexar Wave Generator': 'waveGenerator',
    'Nezerian Battlecruiser': 'battlecruiser',
    'Nezerian Battleship': 'battleship',
    'Nezerian Destoyer': 'destroyer',
    'Nezerian Fighter': 'nezFighter',
    'Nezerian Invading Fighter': 'nezFighter',
    'Nezerian Praetorian': 'praetorian',
    'Nezerian Regius Exterminatore': 'exterminatore',
    'Nezerian Dreadnought': 'dreadnought',
  };
  private static readonly OFFICERS: Record<string, boolean> = {
    'Commander Zherghur': true,
    'Nexar Commander': true,
    'Rear Admiral Vorghis': true,
    'Commodore Herivis': true,
    'Captain Xhargrefh': true,
    'Admiral Zhersis': true,
    'Vice Admiral Ahrgeris': true,
    'Lieutenant Commander Gerhavis': true,
    'Lieutenant Xhaveris': true,
  };
  // Exact causes must belong to this NPC profile. Flee weapons are included.
  // Unmapped causes may use a sole cached attack family as flavor; profiles
  // with multiple attack families retain actor-only wording.
  private static readonly ATTACKS: Record<string, Record<string, string>> = {
    blade: { 'Enemy Nexar Blade': 'nexarBlade' },
    // Vanguard's cached beam has the internal name Enemy Nexar Blade;
    // present it as the player's familiar Kinetic Phase Blade name.
    vanguard: {
      'Enemy Nexar Blade': 'nexarKineticPhaseBlade',
      'Kinetic Phase Blade': 'nexarKineticPhaseBlade',
    },
    eliteBlade: { 'Enemy Nexar Elite Blade': 'nexarBlade' },
    cluster: { 'Enemy Nexar Cluster Launcher': 'nexarCluster' },
    edge: {
      'Enemy Nexar Edge Blade': 'nexarEdgeBlade',
      'Enemy Nexar Edge Wave': 'nexarEdgeWave',
      'Enemy Nexar Edge Nova': 'nexarEdgeNova',
    },
    phaser: {
      'Enemy Nexar Phaser': 'nexarPhaser',
      'Enemy Nexar Twin Plasma': 'nexarTwinPlasma',
    },
    shadow: {
      'Enemy Nexar Shadow Blaster': 'nexarShadowBlaster',
      'Enemy Nexar Shadow Bomb': 'nexarShadowBomb',
    },
    vindicator: {
      'Enemy Nexar Vindicator Blaster': 'nexarVindicatorBlaster',
      'Enemy Nexar Cluster Vindicator': 'nexarVindicatorCluster',
      'Enemy Nexar Vindicator Projection': 'nexarVindicatorProjection',
    },
    fighter: { 'Enemy Nexar Slug Blaster': 'nexarSlugBlaster' },
    projector: { 'Enemy Nexar Projection': 'nexarProjection' },
    skirmisher: { 'Enemy Nexar Light Wave': 'nexarLightWave' },
    // Nexar Bomb is also the cached projectile name and an existing death cause.
    bomber: { 'Enemy Nexar Bomb': 'nexarBomb', 'Nexar Bomb': 'nexarBomb' },
    tank: { 'Enemy Nexar Gatling Gun': 'nexarGatling' },
    twin: { 'Enemy Nexar Twin Launcher': 'nexarTwinLauncher' },
    // Turrets / ekqTokKX_U2zwXT_AVC7Ew owns Weapons / eR54a3Bu4EuXFcLCOCfY9A.
    waveGenerator: { 'Enemy Nexar Wave': 'nexarGenerator' },
    battlecruiser: {
      'Enemy Nezerian Battlecruiser Blaster': 'nezerianBlaster',
      'Enemy Nezarian Nova': 'nezerianNova',
    },
    battleship: {
      'Enemy Nezerian Battleship Launcher': 'nezerianMissiles',
      'Enemy Nezerian Battleship Plasma Torpedo': 'nezerianTorpedoes',
      'Enemy Nezarian Nova': 'nezerianNova',
    },
    // Preserve the actual cache's Destoyer / Destoryer / Nezarian spellings.
    destroyer: { 'Enemy Nezerian Destoryer Lightning': 'nezerianLightning' },
    nezFighter: { 'Enemy Nezerian Fighter Blaster': 'nezerianBlaster' },
    praetorian: { 'Enemy Nezerian Praetorian Bombs': 'nezerianBombs' },
    exterminatore: {
      'Enemy Nezerian Nuke Very Long': 'nezerianNukes',
      'Enemy Nezerian Nuke Extreme': 'nezerianNukes',
      'Enemy Nezerian Nuke Short': 'nezerianNukes',
      'Enemy Nezerian Nuke Long': 'nezerianNukes',
    },
    dreadnought: {
      'Enemy Nezerian Beamer 1': 'nezerianBeams',
      'Enemy Nezerian Beamer 2': 'nezerianBeams',
      'Enemy Nezerian Beamer 3': 'nezerianBeams',
      'Enemy Nezerian Heavy Launcher': 'nezerianHeavyMissiles',
      'Enemy Nezerian Hunterkiller Launcher': 'nezerianHunterKillers',
      'Enemy Nezerian Plasma Blaster': 'nezerianPlasma',
    },
  };
  private static readonly POOLS: Record<string, string[]> = {
    nexarUnknown: ['[victim] was outmatched by [attacker].', "[attacker] ended [victim]'s flight."],
    nezerianUnknown: [
      "[victim] fell to [attacker]'s assault.",
      '[attacker] left [victim] no way out.',
    ],
    officerUnknown: [
      '[attacker] reported [victim] neutralized.',
      '[attacker] completed the engagement against [victim].',
    ],
    nexarBlade: [
      "[attacker]'s blade cut [victim]'s sortie short.",
      "[victim] found the sharp side of [attacker]'s blade.",
    ],
    nexarKineticPhaseBlade: [
      "[victim] got destroyed by [attacker]'s kinetic phase blade.",
      "[attacker]'s kinetic phase blade cut [victim]'s flight short.",
    ],
    nexarCluster: [
      "[victim] ran out of gaps in [attacker]'s cluster missiles.",
      "[attacker]'s cluster launcher gave [victim] too many problems at once.",
    ],
    nexarEdgeBlade: [
      "[attacker]'s edge blade crossed [victim]'s flight path.",
      "[victim] lost the cutting contest against [attacker]'s edge blade.",
    ],
    nexarEdgeWave: [
      "[victim] could not slip through [attacker]'s edge wave.",
      "[attacker]'s edge wave swept [victim] out of the fight.",
    ],
    nexarEdgeNova: [
      '[victim] chased [attacker] into an edge nova.',
      "[attacker]'s edge nova made [victim] regret closing in.",
    ],
    nexarPhaser: [
      "[attacker]'s phaser put [victim] out of phase with survival.",
      "[victim] stayed in [attacker]'s phaser beam too long.",
    ],
    nexarTwinPlasma: [
      "[attacker]'s twin plasma gave [victim] twice the heat.",
      "[victim] could not weather [attacker]'s twin-plasma fire.",
    ],
    nexarShadowBlaster: [
      "[attacker]'s shadow blaster darkened [victim]'s prospects.",
      "[victim] caught the wrong end of [attacker]'s shadow slug.",
    ],
    nexarShadowBomb: [
      '[victim] followed [attacker] into a shadow bomb.',
      "[attacker]'s parting shadow bomb ended [victim]'s pursuit.",
    ],
    nexarVindicatorBlaster: [
      "[attacker]'s Vindicator blaster settled [victim]'s challenge.",
      "[victim] failed to make it through [attacker]'s Vindicator fire.",
    ],
    nexarVindicatorCluster: [
      "[attacker]'s Vindicator cluster missiles crowded [victim] out of the sky.",
      "[victim] found no opening in [attacker]'s Vindicator missile spread.",
    ],
    nexarVindicatorProjection: [
      "[victim] underestimated [attacker]'s Vindicator projection.",
      "[attacker]'s Vindicator projection made a very real wreck of [victim].",
    ],
    nexarSlugBlaster: [
      "[attacker]'s slug blaster ended [victim]'s dogfight.",
      '[victim] could not dodge the last slug from [attacker].',
    ],
    nexarProjection: [
      "[victim] discovered that [attacker]'s projections were not harmless.",
      "[attacker]'s projection crossed [victim] off the flight roster.",
    ],
    nexarLightWave: [
      "[victim] failed to clear [attacker]'s light wave.",
      "[attacker]'s light wave swept away [victim]'s escape plan.",
    ],
    nexarGenerator: [
      "[victim] got swept away by [attacker]'s wave.",
      "[attacker]'s wave washed [victim] out of the fight.",
      "[victim] couldn't find a gap in [attacker]'s wave.",
    ],
    nexarBomb: [
      "[attacker]'s bomb interrupted [victim]'s quiet flight.",
      "[victim] found the explosive part of [attacker]'s stealth routine.",
    ],
    nexarGatling: [
      "[attacker]'s gatling gun outlasted [victim]'s hull.",
      "[victim] ran into [attacker]'s uninterrupted stream of gatling fire.",
    ],
    nexarTwinLauncher: [
      "[attacker]'s twin missiles caught [victim] between bad options.",
      "[victim] could not lose both missiles from [attacker]'s twin launcher.",
    ],
    nezerianBlaster: [
      "[attacker]'s blaster barrage ended [victim]'s patrol.",
      "[victim] stayed in [attacker]'s firing lane one shot too long.",
    ],
    nezerianMissiles: [
      "[attacker]'s homing missiles caught up with [victim].",
      "[victim] ran out of evasive maneuvers against [attacker]'s missiles.",
    ],
    nezerianTorpedoes: [
      "[attacker]'s plasma torpedoes intercepted [victim]'s escape route.",
      "[victim] failed to make room for [attacker]'s plasma torpedoes.",
    ],
    nezerianLightning: [
      "[attacker]'s lightning shorted out [victim]'s plans.",
      "[victim] could not break the circuit of [attacker]'s lightning.",
    ],
    nezerianBombs: [
      "[attacker]'s Praetorian bombs left [victim] nowhere comfortable to fly.",
      '[victim] lost track of one too many bombs from [attacker].',
    ],
    nezerianNukes: [
      "[victim] fell inside [attacker]'s nuclear blast radius.",
      "[attacker]'s nuke made [victim]'s escape distance look optimistic.",
    ],
    nezerianBeams: [
      "[attacker]'s focused beams wore through [victim]'s last defenses.",
      "[victim] held [attacker]'s beam focus for too long.",
    ],
    nezerianHeavyMissiles: [
      "[attacker]'s heavy missiles caught [victim] without an exit.",
      "[victim] underestimated the payload of [attacker]'s heavy launcher.",
    ],
    nezerianHunterKillers: [
      "[attacker]'s hunter-killer missiles completed their search for [victim].",
      "[victim] could not shake [attacker]'s hunter-killer missiles.",
    ],
    nezerianPlasma: [
      "[attacker]'s plasma barrage overwhelmed [victim].",
      "[victim] could not take the heat from [attacker]'s plasma blaster.",
    ],
    nezerianNova: [
      "[victim] got caught in [attacker]'s defensive nova.",
      "[attacker]'s nova cleared [victim] out of the immediate area.",
    ],
    officer_nexarBlade: [
      "[attacker] halted [victim]'s advance with a blade strike.",
      "[attacker]'s blade cut [victim]'s mission short.",
    ],
    officer_nexarEdgeBlade: [
      '[attacker] eliminated [victim] with a precise edge-blade strike.',
      "[attacker]'s edge blade broke through [victim]'s defenses.",
    ],
    officer_nexarEdgeWave: [
      "[attacker]'s edge-wave barrage neutralized [victim].",
      "[attacker] closed [victim]'s escape corridor with an edge wave.",
    ],
    officer_nexarEdgeNova: [
      "[attacker]'s edge nova terminated [victim]'s pursuit.",
      '[attacker] swept [victim] aside with an edge nova.',
    ],
    officer_nexarPhaser: [
      '[attacker] maintained phaser lock until [victim] was neutralized.',
      "[attacker]'s phaser beam cut [victim]'s flight short.",
    ],
    officer_nexarTwinPlasma: [
      "[attacker]'s twin-plasma salvo confirmed the kill on [victim].",
      '[attacker] neutralized [victim] with concentrated twin-plasma fire.',
    ],
    officer_nexarShadowBlaster: [
      "[attacker] confirmed [victim]'s destruction by shadow-blaster fire.",
      "[attacker]'s shadow blaster brought down [victim].",
    ],
    officer_nexarShadowBomb: [
      "[attacker]'s shadow bomb neutralized the pursuing [victim].",
      "[attacker]'s parting shadow bomb stopped [victim]'s pursuit.",
    ],
    officer_nexarVindicatorBlaster: [
      "[attacker]'s Vindicator blaster completed the intercept on [victim].",
      "[victim] fell under [attacker]'s Vindicator-blaster fire.",
    ],
    officer_nexarVindicatorCluster: [
      "[attacker]'s Vindicator cluster salvo sealed [victim]'s escape corridor.",
      '[attacker] cut off [victim] with a Vindicator cluster salvo.',
    ],
    officer_nexarVindicatorProjection: [
      "[attacker]'s Vindicator projection neutralized [victim] on approach.",
      "[attacker]'s Vindicator projection ended [victim]'s mission.",
    ],
    officer_nexarProjection: [
      "[attacker]'s projection executed the interception of [victim].",
      '[attacker] confirmed [victim] neutralized by projection fire.',
    ],
    officer_nexarGatling: [
      '[attacker] neutralized [victim] with sustained gatling fire.',
      "[attacker]'s gatling barrage overwhelmed [victim].",
    ],
  };

  static choose(
    killerName: string | null,
    cause: string | null,
    selection: DeathMessageSelection | null = null,
  ): string | null {
    if (
      cause == 'sun' ||
      cause == 'comet' ||
      cause == 'suicide' ||
      cause == 'Death Line' ||
      cause == 'Kamikaze'
    )
      return null;
    let attacker: string = NexarEnemyIdentification.displayName(killerName);
    if (!Object.prototype.hasOwnProperty.call(FactionDeathMessages.PROFILES, attacker)) return null;
    const attacks: Record<string, string> =
      FactionDeathMessages.ATTACKS[FactionDeathMessages.PROFILES[attacker]];
    let weaponName: string = NexarEnemyIdentification.displayName(cause);
    const officer: boolean = Object.prototype.hasOwnProperty.call(
      FactionDeathMessages.OFFICERS,
      attacker,
    );
    let genericPool: string = officer
      ? 'officerUnknown'
      : attacker.indexOf('Nezerian ') == 0
        ? 'nezerianUnknown'
        : 'nexarUnknown';
    let pool: string | null = null;
    if (Object.prototype.hasOwnProperty.call(attacks, weaponName)) {
      pool = attacks[weaponName];
    } else if (FactionDeathMessages.PROFILES[attacker] != 'destroyer') {
      // Nezerian Destoyer also has cached kinetic melee damage outside
      // FactionDeathMessages.ATTACKS; its lightning is not an unambiguous unknown-cause fallback.
      // Both missing and nonempty unmapped causes may use a profile's
      // sole attack family as flavor. A nonempty string is not itself a
      // recognized weapon, and must not bypass this loadout fallback.
      // Count distinct pools, not aliases. This is catalog inference only;
      // it does not confirm a local contact, server hit or fatal DOT tick.
      for (const candidate of Object.values(attacks)) {
        if (pool == null) {
          pool = candidate;
        } else if (pool != candidate) {
          pool = null;
          break;
        }
      }
    }
    if (pool != null && officer) pool = 'officer_' + pool;
    if (pool == null || !Object.prototype.hasOwnProperty.call(FactionDeathMessages.POOLS, pool))
      pool = genericPool;
    const variants: string[] = FactionDeathMessages.POOLS[pool];
    if (selection == null) {
      selection = new DeathMessageSelection(0, '', '', killerName, cause);
    }
    return variants[selection.index('FactionDeathMessages.' + pool, variants.length)];
  }
}
