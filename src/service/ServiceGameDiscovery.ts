import type { Cleanup } from '../api/Types';
import { MD5, Room, PlayerIOError, type JoinRoomManager, type RoomInfo } from '../game/Bindings';
import { ClientIPCService } from '../ipc/ClientIPCService';
import { isRetryableConnectionError } from '../login/ConnectionRetryPolicy';

/** Select within the accepted Service sector; never carry the old Game ID. */
export function discoverServiceGame(
  manager: JoinRoomManager,
  previous: Room,
  serviceId: string,
  clanId: string,
  success: (room: Room) => void,
  failure: (reason: string, retryable: boolean) => void,
  excludedGameId?: string,
): Cleanup {
  let active = true;
  const cancel = () => {
    active = false;
    clearTimeout(timer);
  };
  const fail = (reason: string, retryable: boolean) => {
    if (!active) return;
    cancel();
    failure(reason, retryable);
  };
  const timer = setTimeout(() => fail('The room connection timed out.', true), 15000);
  const room = new Room();
  room.id = null;
  room.roomType = previous.roomType;
  room.data = { ...previous.data, service: serviceId };
  room.joinData = { ...previous.joinData };
  const select = (rooms: RoomInfo[]) => {
    const found = rooms.find(
      (info) =>
        Number(info.data.version) >= ClientIPCService.serverVersion &&
        info.data.systemType === room.data.systemType &&
        info.onlineUsers < 15 &&
        info.data.modLocked !== 'true' &&
        info.data.modClosed !== 'true' &&
        (info.data.systemType !== 'hostile' ||
          (info.data.pvpAboveCap === 'true') === room.data.pvpAboveCap),
    );
    room.id = found?.id ?? null;
  };
  try {
    manager.client.multiplayer.listRooms(
      'game',
      {
        solarSystemKey: room.data.solarSystemKey,
        service: serviceId,
      },
      1000,
      0,
      (rooms) => {
        if (!active) return;
        const sectorRooms = rooms.filter(
          (info) => info.data.service === serviceId && info.id !== excludedGameId,
        );
        if (room.data.systemType === 'clan') {
          const canonicalId = MD5.hash(String(room.data.solarSystemKey) + clanId);
          const sectorId = MD5.hash(
            String(room.data.solarSystemKey) + clanId + ':service:' + serviceId,
          );
          const matches = sectorRooms.filter(
            (info) => info.id === canonicalId || info.id === sectorId,
          );
          select(matches);
          if (!room.id) {
            if (matches.some((info) => info.id === sectorId)) {
              fail('The target clan instance is full or unavailable.', false);
              return;
            }
            room.id = sectorId;
          }
        } else select(sectorRooms);
        cancel();
        success(room);
      },
      (error) => fail(error.message, isRetryableConnectionError(error)),
    );
  } catch (error) {
    if (!active) throw error;
    fail(
      "The target sector's Game rooms could not be listed.",
      error instanceof PlayerIOError && isRetryableConnectionError(error),
    );
  }
  return cancel;
}
