import type { API } from '../api/Types';
import { Player, type GameScene } from '../game/Bindings';
import { ChatFriendPingData } from './ChatFriendPingData';
import { ChatFriendPingFormatter } from './ChatFriendPingFormatter';

/** Same own/online/offline precedence as MessageLog. Snapshot values, never retain live players. */
export function friendPingTargets(_api: API, game: GameScene): ChatFriendPingData[] {
  const targets: ChatFriendPingData[] = [];
  const seen = new Set<string>();
  const system = game.solarSystem;
  const room = game.room;
  const players = game.playerManager?.get_players() ?? [];
  const playersById = game.playerManager?.get_playersById().h;
  const currentType = String(room?.data?.systemType ?? '').toLowerCase();
  const append = (data: Partial<ChatFriendPingData>, player?: Player) => {
    if (!data.name?.trim() || seen.has(data.name.toLowerCase())) return;
    seen.add(data.name.toLowerCase());
    const target = Object.assign(new ChatFriendPingData(), data);
    const fleet = player?.getActiveFleetObj();
    if (fleet)
      for (const key of ['shipHue', 'shipBrightness', 'shipSaturation', 'shipContrast'] as const)
        target[key] = fleet[key];
    targets.push(target);
  };
  const me = game.get_me();
  if (me)
    append(
      {
        playerId: game.client?.connectUserId ?? '',
        name: me.get_name(),
        skin: me.activeSkin,
        level: me.get_level(),
        clanName: me.clanName ?? '',
        solarSystem: system?.name ?? '',
        solarSystemKey: system?.key ?? '',
        room: room?.id ?? '',
        systemType: currentType,
      },
      me,
    );
  for (const friend of [...(Player.onlineFriends ?? []), ...(Player.friends ?? [])]) {
    if (!friend) continue;
    let live = friend.id ? playersById?.[friend.id] : undefined;
    if (!live && friend.name) {
      const matches = players.filter(
        (player) => player.get_name()?.toLowerCase() === friend.name.toLowerCase(),
      );
      if (matches.length === 1) live = matches[0];
    }
    const key = friend.currentSolarSystem || (live ? system?.key : '') || '';
    let displayName = key;
    if (key && game.dataManager) {
      try {
        displayName = game.dataManager.loadKey('SolarSystems', key)?.name ?? key;
      } catch {
        /* Preserve the known key when its display record is unavailable. */
      }
    }
    append(
      {
        playerId: live?.id ?? friend.id ?? '',
        name: live ? live.get_name() : (friend.name ?? ''),
        skin: live ? live.activeSkin : (friend.skin ?? ''),
        level: live ? live.get_level() : (friend.level ?? 0),
        clanName: live?.clanName ?? '',
        solarSystem: displayName,
        solarSystemKey: key,
        room: friend.currentRoom || (live ? room?.id : '') || '',
        systemType: live ? currentType : '',
      },
      live,
    );
  }
  return targets;
}

export function snapshotFriendPings(
  source: string,
  targets: ChatFriendPingData[],
): ChatFriendPingData[] {
  const byName = new Map(targets.map((target) => [target.name.trim().toLowerCase(), target]));
  return ChatFriendPingFormatter.findMatches(
    source,
    targets.map((target) => target.name),
  ).map((match) =>
    Object.assign(new ChatFriendPingData(), byName.get(match.name.toLowerCase()), {
      beginIndex: match.begin,
      endIndex: match.end,
    }),
  );
}
