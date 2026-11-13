import type { API } from '../api/Types';
import { GameReflection } from '../api/GameReflection';
import {
  GameScene,
  JoinRoomManager,
  JoinRoomLocator,
  WarpJumpState,
  type Connection,
  type RoomInfo,
  type PlayerIOError,
} from '../game/Bindings';
import { cancelPendingWarpJoin, isWarpJoinPending } from './WarpTransition';

interface Preparation {
  scene: GameScene;
  state: WarpJumpState;
  service: Connection;
  serviceId: string;
  destination: string;
  systemType: string;
  level: number;
  consumed: boolean;
  rooms?: RoomInfo[];
  success?: (rooms: RoomInfo[]) => void;
  failure?: (error: PlayerIOError) => void;
}

/** Discover during the warp animation; open a socket only at its visual commit. */
export function installPreparedWarp(api: API): void {
  const reflection = new GameReflection(api);
  const preparations = new Map<JoinRoomManager, Preparation>();
  const discard = (manager: JoinRoomManager) => preparations.delete(manager);
  const current = (manager: JoinRoomManager, preparation: Preparation): boolean =>
    preparations.get(manager) === preparation &&
    JoinRoomLocator.getService() === manager &&
    manager.roomStateMachine.currentRoom === preparation.scene &&
    !preparation.scene.get_isLeaving() &&
    (!preparation.consumed || isWarpJoinPending(preparation.scene)) &&
    manager.serviceConnection === preparation.service &&
    preparation.service.get_connected() &&
    preparation.service.get_roomId() === preparation.serviceId;

  reflection.before(GameScene.prototype, 'fadeIntoState', function (state) {
    if (!reflection.is(state, 'core.states.gameStates.WarpJumpState')) return;
    const manager = JoinRoomLocator.getService();
    if (!manager) return;
    discard(manager);
    const service = manager.serviceConnection;
    const player = this.get_me();
    if (!service?.get_connected() || !player || !state.destination) return;
    const roomId = state.roomId === 'reset' ? null : state.roomId || manager.get_desiredRoomId();
    // Explicit instances require no discovery; the normal commit already joins them directly.
    if (roomId || !manager.dataManager.loadKey('SolarSystems', state.destination)) return;
    const preparation: Preparation = {
      scene: this,
      state,
      service,
      serviceId: service.get_roomId(),
      destination: state.destination,
      systemType: state.systemType || manager.get_desiredSystemType(),
      level: player.get_level(),
      consumed: false,
    };
    preparations.set(manager, preparation);
    const stale = () => {
      if (preparations.get(manager) !== preparation) return;
      discard(manager);
      if (preparation.consumed) cancelPendingWarpJoin(preparation.scene);
    };
    try {
      manager.client.multiplayer.listRooms(
        'game',
        { solarSystemKey: preparation.destination, service: preparation.serviceId },
        1000,
        0,
        (rooms) => {
          if (!current(manager, preparation)) return stale();
          preparation.rooms = rooms;
          if (preparation.success) {
            discard(manager);
            preparation.success(rooms);
          }
        },
        (error) => {
          if (!current(manager, preparation)) return stale();
          discard(manager);
          // Before commit this is only a failed optimization. The ordinary join retries discovery.
          preparation.failure?.(error);
        },
      );
    } catch {
      discard(manager);
    }
  });

  reflection.around(JoinRoomManager.prototype, 'joinGame', function (next, system, data) {
    const preparation = preparations.get(this);
    if (
      !preparation ||
      !current(this, preparation) ||
      preparation.destination !== system ||
      preparation.systemType !== this.get_desiredSystemType() ||
      preparation.level !== Number(data.level) ||
      !data.warpJump ||
      this.get_desiredRoomId()
    ) {
      discard(this);
      return next(system, data);
    }
    if (preparation.consumed) return;
    preparation.consumed = true;
    const manager = this;
    // Let native joinGame build its descriptor and native handleRooms select the
    // current version/capacity-compatible room. Reuse only its discovery result.
    const restore = reflection.around(
      this.client.multiplayer,
      'listRooms',
      function (list, type, criteria, limit, offset, success, failure) {
        if (
          type !== 'game' ||
          criteria?.solarSystemKey !== preparation.destination ||
          criteria?.service !== preparation.serviceId
        )
          return list(type, criteria, limit, offset, success, failure);
        preparation.success = success;
        preparation.failure = failure;
        if (preparation.rooms) {
          discard(manager);
          success(preparation.rooms);
        }
      },
    );
    try {
      next(system, data);
    } catch (error) {
      discard(this);
      throw error;
    } finally {
      restore();
    }
  });
  reflection.before(WarpJumpState.prototype, 'exit', function () {
    for (const [manager, preparation] of preparations) {
      if (preparation.state === this && !preparation.consumed) discard(manager);
    }
  });
  reflection.before(GameScene.prototype, 'exit', function () {
    for (const [manager, preparation] of preparations) {
      if (preparation.scene === this) discard(manager);
    }
  });
  reflection.before(JoinRoomManager.prototype, 'joinServiceRoom', function () {
    // The source cancels prepared discovery as soon as a new Service join is
    // requested, before the old Service socket is replaced.
    discard(this);
  });
  api.defer(() => preparations.clear());
}
