import { read, type API, type Raw } from '../api/Types';
import { ChatFriendPingData } from './ChatFriendPingData';
import { ChatFriendPingFormatter } from './ChatFriendPingFormatter';

/** Same own/online/offline precedence as MessageLog. Snapshot values, never retain live players. */
export function friendPingTargets(api: API, game: Raw): ChatFriendPingData[] {
  const targets: ChatFriendPingData[] = [];
  const seen = new Set<string>();
  const system = game.solarSystem;
  const room = game.room;
  const players: Raw[] = read(game.playerManager, 'players', []);
  const currentType = String(room?.data?.systemType ?? '').toLowerCase();
  const append = (data: Partial<ChatFriendPingData>, player?: Raw) => {
    if (!data.name?.trim() || seen.has(data.name.toLowerCase())) return;
    seen.add(data.name.toLowerCase());
    const target = Object.assign(new ChatFriendPingData(), data);
    const fleet = player?.getActiveFleetObj?.();
    if (fleet)
      for (const key of ['shipHue', 'shipBrightness', 'shipSaturation', 'shipContrast'] as const)
        target[key] = read(fleet, key, 0);
    targets.push(target);
  };
  const me = read(game, 'me');
  if (me)
    append(
      {
        playerId: game.client?.connectUserId ?? '',
        name: read(me, 'name', ''),
        skin: read(me, 'activeSkin', ''),
        level: read(me, 'level', 0),
        clanName: me.clanName ?? '',
        solarSystem: system?.name ?? '',
        solarSystemKey: system?.key ?? '',
        room: room?.id ?? '',
        systemType: currentType,
      },
      me,
    );
  const Player = api.cls('core.player.Player');
  for (const friend of [...(Player?.onlineFriends ?? []), ...(Player?.friends ?? [])]) {
    if (!friend) continue;
    let live = friend.id ? players.find((player) => player.id === friend.id) : undefined;
    if (!live && friend.name) {
      const matches = players.filter(
        (player) => read(player, 'name', '').toLowerCase() === friend.name.toLowerCase(),
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
        name: live ? read(live, 'name', '') : (friend.name ?? ''),
        skin: live ? read(live, 'activeSkin', '') : (friend.skin ?? ''),
        level: live ? read(live, 'level', 0) : (friend.level ?? 0),
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
