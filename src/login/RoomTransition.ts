import { isRefreshingRoom } from './RoomRefresh';
import { rejectRoomChange } from './RoomChangeGuard';
import { gameRoomDestinationError } from './RoomDestination';
import { cancelPendingWarpJoin } from './WarpTransition';
import type {} from '../game/LoadingCover';
import type { API } from '../api/Types';
import { GameReflection } from '../api/GameReflection';
import { JoinRoomManager, JoinRoomLocator, Login, type FadeScreen } from '../game/Bindings';

interface Transition {
  close: () => void;
  cancel: () => void;
  waiting: boolean;
  failed: boolean;
}

const commits = new WeakMap<JoinRoomManager, (send: () => void) => void>();
const cancellations = new WeakMap<JoinRoomManager, (manager: JoinRoomManager) => void>();

/** Invalidate discovery and any cover callback before recovery takes ownership. */
export function cancelRoomTransition(manager: JoinRoomManager): void {
  cancellations.get(manager)?.(manager);
}

export function commitRoomTransition(manager: JoinRoomManager, send: () => void): void {
  const commit = commits.get(manager);
  if (commit) commit(send);
  else {
    manager.roomStateMachine.closeCurrentRoom();
    send();
  }
}

/** Preserve the current room during discovery; tear it down behind a presented cover. */
export function installRoomTransition(api: API): void {
  const reflection = new GameReflection(api);
  const transitions = new Map<JoinRoomManager, Transition>();
  let disposed = false;
  const cancelTransition = (manager: JoinRoomManager) => {
    const transition = transitions.get(manager);
    if (!transition) return;
    transition.failed = true;
    transition.cancel();
    transitions.delete(manager);
    if (cancellations.get(manager) === cancelTransition) {
      cancellations.delete(manager);
      commits.delete(manager);
    }
  };

  const restoreRoom = (manager: JoinRoomManager) => {
    const room = manager.roomStateMachine.currentRoom;
    if (reflection.is(room, 'core.scene.Game') && !room.get_isLeaving()) {
      cancelPendingWarpJoin(room);
      Login.fadeScreen?.fadeOut();
    }
  };

  reflection.around(JoinRoomManager.prototype, 'joinGame', function (next, system, data) {
    if (rejectRoomChange(this)) return;
    transitions.get(this)?.cancel();
    const transition: Transition = {
      close: this.roomStateMachine.closeCurrentRoom.bind(this.roomStateMachine),
      cancel: () => {},
      waiting: false,
      failed: false,
    };
    transitions.set(this, transition);
    cancellations.set(this, cancelTransition);
    const current = () =>
      !disposed &&
      !transition.failed &&
      transitions.get(this) === transition &&
      JoinRoomLocator.getService() === this;
    const manager = this;
    // Native joinGame closes before room discovery. The source client keeps the
    // old room alive until createJoin commits to the selected destination.
    const restoreClose = reflection.around(
      this.roomStateMachine,
      'closeCurrentRoom',
      function () {},
    );
    const restoreList = reflection.around(
      this.client.multiplayer,
      'listRooms',
      function (list, type, criteria, limit, offset, success, failure) {
        return list(
          type,
          criteria,
          limit,
          offset,
          (rooms) => {
            if (current()) success(rooms);
          },
          (error) => {
            if (!current()) return;
            transition.failed = true;
            transition.cancel();
            restoreRoom(manager);
            manager.showErrorDialog(
              'Listing of game rooms failed. Contact us on Discord for support.',
              true,
              error,
            );
          },
        );
      },
    );
    try {
      next(system, data);
    } catch (error) {
      transition.failed = true;
      transition.cancel();
      restoreRoom(this);
      throw error;
    } finally {
      restoreList();
      restoreClose();
    }
  });

  function commit(this: JoinRoomManager, send: () => void): void {
    if (disposed) return;
    commits.set(this, (send) => commit.call(this, send));
    const activeScene = this.roomStateMachine.currentRoom;
    if (
      this.room?.data &&
      reflection.is(activeScene, 'core.scene.Game') &&
      activeScene.connection?.get_roomId() === this.room?.id &&
      activeScene.room?.data?.service
    ) {
      // Refresh can target an older sector after a Service-only switch.
      this.room.data.service = activeScene.room.data.service;
      this.room.data.systemType = activeScene.room.data.systemType;
      this.room.joinOnly = this.room.joinOnly || activeScene.room.joinOnly;
    }
    const destinationError = gameRoomDestinationError(this.room);
    if (destinationError) {
      restoreRoom(this);
      this.showErrorDialog(destinationError);
      return;
    }
    let transition = transitions.get(this);
    if (!transition) {
      transition = {
        close: this.roomStateMachine.closeCurrentRoom.bind(this.roomStateMachine),
        cancel: () => {},
        waiting: false,
        failed: false,
      };
      transitions.set(this, transition);
      cancellations.set(this, cancelTransition);
    }
    if (transition.waiting || transition.failed) return;
    const close = () => {
      try {
        transition.close();
        return true;
      } catch {
        transition.failed = true;
        this.showErrorDialog(
          'The previous Game room could not be closed. Please refresh the client.',
        );
        return false;
      }
    };
    const previousRoom = this.roomStateMachine.currentRoom;
    const cover: FadeScreen | null = Login.fadeScreen;
    if (!previousRoom) return send();
    if (!cover) {
      if (close()) send();
      return;
    }
    const destination = this.room;
    const owner = transition;
    owner.waiting = true;
    const token = cover.showStaticCoverUntilPresented(() => {
      owner.waiting = false;
      owner.cancel = () => {};
      if (
        disposed ||
        transitions.get(this) !== owner ||
        JoinRoomLocator.getService() !== this ||
        this.room !== destination ||
        this.roomStateMachine.currentRoom !== previousRoom
      )
        return;
      if (!close()) return;
      cover.resumeLoadingAfterTeardown(!isRefreshingRoom(destination));
      send();
    });
    owner.cancel = () => {
      cover.cancelStaticCoverWait(token);
      owner.waiting = false;
    };
  }
  reflection.around(JoinRoomManager.prototype, 'createJoin', function (next, retry) {
    commit.call(this, () => next(retry));
  });
  api.defer(() => {
    disposed = true;
    for (const manager of transitions.keys()) cancelTransition(manager);
  });
}
