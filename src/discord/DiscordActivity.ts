import type { GameScene, Boss, Unit } from '../game/Bindings';
import { CLIENT_VERSION_LABEL } from '../login/LoginIdentity';
import { NexarEnemyIdentification } from '../ship/NexarEnemyIdentification';
import { EmperorReadyNotifier } from '../ipc/EmperorReadyNotifier';

export interface DiscordActivity {
  details: string;
  state: string;
}

const emperors = ['Emperor Xhersix', 'Emperor Yhgvis', 'Emperor Zharix'] as const;
const systemTypes: Record<string, string> = {
  friendly: 'Friendly',
  hostile: 'Hostile',
  clan: 'Clan Instance',
  survival: 'Survival',
  domination: 'Domination',
  deathmatch: 'Deathmatch',
  arena: 'Arena',
};

export function compactResource(value: number): string {
  if (value >= 1e9) return (value / 1e9).toFixed(1) + 'B';
  if (value >= 1e6) return (value / 1e6).toFixed(1) + 'M';
  if (value >= 1e3) return (value / 1e3).toFixed(1) + 'k';
  return String(Math.round(value));
}

function resource(value: number, maximum: number): string {
  if (!Number.isFinite(value) || !Number.isFinite(maximum) || maximum <= 0) return '--';
  value = Math.min(maximum, Math.max(0, value));
  return `${compactResource(value)}/${compactResource(maximum)} (${Math.round((100 * value) / maximum)}%)`;
}

/** Destroyed essential components retain their maxima, so progress cannot jump back up. */
export function bossVitals(
  parts: readonly Pick<
    Unit,
    'essential' | 'alive' | 'hp' | 'shieldHp' | 'get_hpMax' | 'get_shieldHpMax'
  >[],
): string {
  let hp = 0,
    hpMax = 0,
    shield = 0,
    shieldMax = 0;
  for (const part of parts) {
    if (!part.essential) continue;
    hpMax += Math.max(0, part.get_hpMax());
    shieldMax += Math.max(0, part.get_shieldHpMax());
    if (!part.alive) continue;
    hp += Math.max(0, part.hp);
    shield += Math.max(0, part.shieldHp);
  }
  if (hpMax <= 0 && shieldMax <= 0) return 'Boss nearby';
  return `HP ${resource(hp, hpMax)} | SH ${resource(shield, shieldMax)}`;
}

function nearbyBoss(game: GameScene): Boss | null {
  const position = game.get_me()?.ship?.get_pos();
  if (!position || !game.bossManager) return null;
  let nearest = 1000;
  let selected: Boss | null = null;
  for (const boss of game.bossManager.bosses) {
    if (
      !boss.alive ||
      !boss.isHostile ||
      boss.awaitingActivation ||
      NexarEnemyIdentification.displayName(boss.get_name()) === 'Three Emperors'
    )
      continue;
    const point = boss.get_pos();
    const distance =
      Math.hypot(point.x - position.x, point.y - position.y) - Math.max(0, boss.bossRadius);
    if (!Number.isFinite(distance) || distance > nearest) continue;
    selected = boss;
    nearest = distance;
  }
  return selected;
}

function emperorStatus(game: GameScene): string {
  const tracker = EmperorReadyNotifier.instance?.owns(game) ? EmperorReadyNotifier.instance : null;
  let active = game.shipManager.enemies.some(
    (enemy) =>
      enemy.alive &&
      emperors.some((name) => name === NexarEnemyIdentification.displayName(enemy.get_name())),
  );
  const rows = emperors.map((name) => {
    const status = tracker?.status(name);
    let text = 'Unknown';
    if (status?.known) {
      active = true;
      text = status.reconstructing
        ? 'Reconstructing'
        : `${status.ready ? 'Ready' : 'Active'} (${compactResource(status.hp)} HP)`;
    }
    return `${name.slice(8)}: ${text}`;
  });
  return active ? rows.join(' | ') : '';
}

/** Source DiscordActivity: reads existing state only, never fetches additional telemetry. */
export function snapshotDiscordActivity(game: GameScene | null): DiscordActivity {
  const activity = { details: 'In the menus', state: `QoLAF ${CLIENT_VERSION_LABEL}` };
  const player = game?.get_me();
  if (!game || !game.get_connected() || game.get_isLeaving() || !game.solarSystem || !player)
    return activity;
  const location = `${game.solarSystem.name} (${systemTypes[String(game.room?.data?.systemType ?? '')] ?? 'Unknown'})`;
  activity.details = `${player.isLanded ? 'Docked in' : 'Exploring'} ${location}`;
  const ship = player.ship;
  if (!player.isLanded && ship) {
    if (!ship.alive) activity.details = `Defeated in ${location}`;
    else if (player.get_isWarpJumping()) activity.details = `Travelling through ${location}`;
    else {
      if (EmperorReadyNotifier.isCoordinationArea(game)) {
        const trio = emperorStatus(game);
        if (trio) return { details: `Fighting the Three Emperors | ${location}`, state: trio };
      }
      const boss = nearbyBoss(game);
      if (boss)
        return {
          details: `Fighting ${NexarEnemyIdentification.displayName(boss.get_name())} | ${location}`,
          state: bossVitals(boss.allComponents),
        };
    }
  }
  const name = (player.get_name() ?? '').replace(/\s+/g, ' ').trim();
  return name
    ? { details: `Logged as ${name} (lvl ${player.get_level()})`, state: activity.details }
    : activity;
}

/** Source transport limit: 128 UTF-8 bytes, no controls or isolated surrogates. */
export function boundActivityText(value: string): string {
  let result = '',
    bytes = 0;
  const encoder = new TextEncoder();
  for (let character of value.replace(/[\x00-\x1f\x7f]/g, ' ')) {
    const code = character.codePointAt(0)!;
    if (code >= 0xd800 && code <= 0xdfff) character = '?';
    const count = encoder.encode(character).length;
    if (bytes + count > 128) break;
    result += character;
    bytes += count;
  }
  return result;
}
