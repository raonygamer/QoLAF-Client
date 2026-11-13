import type {} from '../game/Room';
import { GameReflection } from '../api/GameReflection';
import type { API } from '../api/Types';
import {
  DataLocator,
  JoinRoomLocator,
  JoinRoomManager,
  MD5,
  MessageLog,
  Player,
  Room,
  type GameScene,
  type RoomInfo,
} from '../game/Bindings';
import { ClientIPCService } from '../ipc/ClientIPCService';
import { serviceGameIsReady } from '../service/ServiceGameReadiness';

type RoomData = RoomInfo['data'] & { solarSystemKey: string; service: string; systemType: string };
type ValidRoom = RoomInfo & { data: RoomData };

interface ResolvedRoom {
  id: string | null;
  data: RoomData;
  joinOnly: boolean;
}

const roomTypes = new Set([
  'friendly',
  'hostile',
  'clan',
  'survival',
  'arena',
  'deathmatch',
  'domination',
]);

function validRoom(room: RoomInfo, destination: string): room is ValidRoom {
  return (
    !!room?.id &&
    room.data?.solarSystemKey === destination &&
    typeof room.data.service === 'string' &&
    room.data.service.length > 0 &&
    typeof room.data.systemType === 'string' &&
    roomTypes.has(room.data.systemType)
  );
}

/** Resolve the actual friend's sector before choosing an optional instance mode. */
function selectRoom(
  game: GameScene,
  rooms: RoomInfo[],
  exact: ValidRoom,
  mode: string,
): ResolvedRoom {
  if (!mode || mode === exact.data.systemType) {
    return { id: exact.id, data: { ...exact.data }, joinOnly: true };
  }
  const destination = exact.data.solarSystemKey;
  const system = DataLocator.getService().loadKey('SolarSystems', destination);
  if (!system) throw new Error("The friend's solar system is unavailable.");
  const player = game.get_me();
  if (!player) throw new Error('The current player is unavailable.');
  const data = {
    solarSystemKey: destination,
    service: exact.data.service,
    systemType: mode,
    pvpAboveCap: player.get_level() > system.pvpLvlCap,
  };
  let canonicalId = '';
  let sectorId = '';
  if (mode === 'clan') {
    if (!player.clanId) throw new Error('You must be in a clan to select a clan instance.');

    canonicalId = MD5.hash(destination + player.clanId);
    sectorId = MD5.hash(destination + player.clanId + ':service:' + data.service);
  }
  const candidates = rooms
    .filter((room): room is ValidRoom => validRoom(room, destination))
    .filter(
      (room) =>
        room.data.service === data.service &&
        (mode !== 'clan' || room.id === canonicalId || room.id === sectorId),
    );
  const selected = candidates.find(
    (room) =>
      Number(room.data.version) >= ClientIPCService.serverVersion &&
      room.data.systemType === mode &&
      room.onlineUsers < 15 &&
      String(room.data.modLocked) !== 'true' &&
      String(room.data.modClosed) !== 'true' &&
      (mode !== 'hostile' || (String(room.data.pvpAboveCap) === 'true') === data.pvpAboveCap),
  );
  if (selected) return { id: selected.id, data: { ...selected.data }, joinOnly: true };
  if (mode === 'clan' && candidates.some((room) => room.id === sectorId)) {
    throw new Error('The target clan instance is full or unavailable.');
  }
  return { id: mode === 'clan' ? sectorId : null, data, joinOnly: false };
}

/** Installs the missing resolved-room handoff around the current native transition. */
export function createFriendWarp(api: API): (game: GameScene, argument: string) => void {
  const reflection = new GameReflection(api);
  const log = MessageLog;
  const error = (message: string) => log.write('[error] ' + message, 'error');
  const managerClass = JoinRoomManager;
  let generation = 0;
  let prepared: { manager: JoinRoomManager; room: ResolvedRoom; current: () => boolean } | null =
    null;
  api.defer(() => {
    generation++;
    prepared = null;
  });
  if (managerClass) {
    reflection.around(managerClass.prototype, 'joinGame', function (next, destination, joinData) {
      const pending = prepared;
      const valid = pending?.current();
      generation++;
      prepared = null;
      if (
        !pending ||
        pending.manager !== this ||
        pending.room.data.solarSystemKey !== destination
      ) {
        return next(destination, joinData);
      }
      if (!valid) return;
      // Haxe joinGame would reconstruct metadata from the current Service and
      // createJoinRoom could recreate a vanished friend room. Preserve both the
      // resolved metadata and the original join-only contract instead.
      const room = new Room();
      room.joinOnly = pending.room.joinOnly;
      room.id = pending.room.id;
      room.roomType = 'game';
      room.data = pending.room.data;
      room.joinData = {
        ...joinData,
        client_version: ClientIPCService.serverVersion,
        session: this.session,
      };
      this.room = room;
      this.createJoin();
    });
  }
  return (game, argument) => {
    const suffix = /\s+(pve|pvp|ci|friendly|hostile|clan)\s*$/i.exec(argument);
    const query = (suffix ? argument.slice(0, suffix.index) : argument).trim().replace(/^@\s*/, '');
    const modeName = suffix?.[1].toLowerCase() ?? '';
    const mode =
      ({ pve: 'friendly', pvp: 'hostile', ci: 'clan' } as Record<string, string>)[modeName] ??
      modeName;
    if (!query) return error('Usage: /warptofriend @friend [pve|pvp|ci]');
    if (!game?.friendManager || !managerClass)
      return error('Friend locations are not available yet.');
    const manager = JoinRoomLocator.getService();
    if (!manager) return error('Friend locations are not available yet.');
    const service = game.serviceConnection;
    const sourceRoom = game.room;
    const request = ++generation;
    const current = () =>
      request === generation &&
      api.game === game &&
      !game.get_isLeaving() &&
      game.serviceConnection === service &&
      game.room === sourceRoom &&
      JoinRoomLocator.getService() === manager;
    game.friendManager.updateOnlineFriends(() => {
      if (!current()) return;
      const friends = Player.onlineFriends ?? [];
      const normalized = query.toLowerCase();
      const friend =
        friends.find(
          (entry) =>
            String(entry.id).toLowerCase() === normalized ||
            String(entry.name).toLowerCase() === normalized,
        ) ??
        friends.find((entry) =>
          String(entry.name ?? '')
            .toLowerCase()
            .startsWith(normalized),
        );
      if (!friend) return error('Online friend not found: ' + query);
      if (!friend.currentSolarSystem)
        return error('Friend location is unavailable: ' + friend.name);
      if (game.get_me()?.get_isWarpJumping()) return error('A warp jump is already in progress.');
      if (!friend.currentRoom)
        return error("That friend's room is unavailable. Try again after their location updates.");
      const ready = () => serviceGameIsReady(game) && !game.get_me()?.get_isWarpJumping();
      if (!ready())
        return error(
          'Wait for both rooms and the current room transition before warping to a friend.',
        );
      log.write("Warping to friend '" + friend.name + "'...");
      const failed = () => {
        if (current()) error("The friend's room metadata could not be loaded. Please retry.");
      };
      try {
        game.client.multiplayer.listRooms(
          'game',
          { solarSystemKey: friend.currentSolarSystem },
          1000,
          0,
          (rooms) => {
            if (!current() || !ready()) return;
            const exact = (rooms ?? []).find((room) => room?.id === friend.currentRoom);
            if (!exact || !validRoom(exact, friend.currentSolarSystem)) {
              error(
                "The friend's room metadata is unavailable; hidden or closed instances cannot be resolved safely.",
              );
              return;
            }
            if (exact.data.service === ClientIPCService.roomId)
              return error(ClientIPCService.reservedMessage);
            try {
              const room = selectRoom(game, rooms, exact, mode);
              prepared = { manager, room, current };
              log.write(
                'Warping to ' + room.data.systemType + " instance in the friend's system...",
              );
              game.warpJump(friend.currentSolarSystem, room.id ?? 'reset', room.data.systemType);
            } catch (reason) {
              prepared = null;
              error(reason instanceof Error ? reason.message : String(reason));
            }
          },
          failed,
        );
      } catch {
        failed();
      }
    });
  };
}
