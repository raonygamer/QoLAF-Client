import type {} from '../game/Room';
import { Room, type GameScene, type JoinRoomManager } from '../game/Bindings';
import { ClientIPCService } from '../ipc/ClientIPCService';

/** Preserve the actual Game sector/assigned ID independently of current Service. */
export function snapshotRecoveryRoom(scene: GameScene, manager: JoinRoomManager): Room | null {
  if (!scene.room) return null;
  const room = new Room();
  room.id = scene.connection?.get_roomId() || scene.room.id;
  room.roomType = scene.room.roomType || 'game';
  room.joinOnly = scene.room.joinOnly;
  const scalars = (source: Room['data']): Room['data'] =>
    Object.fromEntries(
      Object.entries(source ?? {}).filter(
        ([, value]) =>
          typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean',
      ),
    );
  room.data = scalars(scene.room.data);
  room.joinData = scalars(scene.room.joinData);
  if (scene.solarSystem) room.data.solarSystemKey = scene.solarSystem.key;
  const me = scene.get_me();
  if (me) room.joinData.level = me.get_level();
  if (!('level' in room.joinData)) {
    const level = manager.playerInfo.level ?? 0;
    room.joinData.level = level > 0 ? level : 1;
  }
  room.joinData.client_version = ClientIPCService.serverVersion;
  room.joinData.session = manager.session;
  room.joinData.warpJump = false;
  return room.id && room.data.solarSystemKey ? room : null;
}
