import type {} from '../game/LoadingCover';
import type { API } from '../api/Types';
import { GameReflection } from '../api/GameReflection';
import { GameScene, JoinRoomLocator, JoinRoomManager, Login, type Room } from '../game/Bindings';
import { rejectRoomChange } from './RoomChangeGuard';

const refreshingRooms = new WeakSet<Room>();
export function isRefreshingRoom(room: Room): boolean {
  return refreshingRooms.has(room);
}

export function inheritRoomRefresh(source: Room, destination: Room): void {
  if (refreshingRooms.has(source)) refreshingRooms.add(destination);
}

/** Explicit /ref keeps Service and quietly waits for its previous Game session. */
export function installRoomRefresh(api: API): void {
  const reflection = new GameReflection(api);
  const refreshingManagers = new WeakSet<JoinRoomManager>();
  reflection.before(JoinRoomManager.prototype, 'createJoin', function () {
    if (refreshingManagers.has(this) && this.room) refreshingRooms.add(this.room);
  });
  reflection.around(GameScene.prototype, 'reload', function (next) {
    const manager = JoinRoomLocator.getService();
    if (rejectRoomChange(manager)) return;
    const cover = Login.fadeScreen;
    // The inner GameRecovery reload hook owns a disconnected Service.
    // Keep explicit-refresh flags confined to the healthy-Service path.
    if (!manager || !cover || !this.solarSystem || !this.serviceConnection?.get_connected())
      return next();
    refreshingManagers.add(manager);
    const restore = reflection.around(cover, 'show', function () {
      this.showStaticCover();
    });
    try {
      next();
    } finally {
      restore();
      refreshingManagers.delete(manager);
    }
  });
}
