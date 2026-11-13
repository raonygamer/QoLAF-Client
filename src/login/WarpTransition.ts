import type {} from '../game/GameRecovery';
import type { API } from '../api/Types';
import { GameReflection } from '../api/GameReflection';
import { GameScene, JoinRoomLocator, Login, RoamingState } from '../game/Bindings';
import { rejectRoomChange } from './RoomChangeGuard';
import { initialGameIsAbandoned } from '../network/InitialGameConnection';

const cancellations = new WeakMap<GameScene, () => void>();

export function isWarpJoinPending(scene: GameScene): boolean {
  return cancellations.has(scene);
}

export function cancelPendingWarpJoin(scene: GameScene): void {
  cancellations.get(scene)?.();
}

/** Preserve the original room's frame/ship state until discovery commits. */
export function installWarpTransition(
  api: API,
  resetClockObservation: (scene: GameScene) => void,
): void {
  const reflection = new GameReflection(api);
  const pending = new Set<GameScene>();
  reflection.around(GameScene.prototype, 'warpJump', function (next, system, room, type) {
    if (rejectRoomChange(JoinRoomLocator.getService())) return;
    if (pending.has(this) || this.get_isLeaving() || initialGameIsAbandoned(this)) return;
    const trackFPS = this.enableTrackFPS;
    const update = reflection.bound(this, this.update);
    pending.add(this);
    // No Game.update runs while discovery holds the frame listener. Explicitly
    // reset even a short/cancelled warp, as Game.warpJump does in the source.
    resetClockObservation(this);
    cancellations.set(this, () => {
      pending.delete(this);
      cancellations.delete(this);
      if (this.get_isLeaving() || initialGameIsAbandoned(this)) return;
      const recovering = this.get_isRecoveringGameConnection?.() === true;
      this.enableTrackFPS = !recovering && trackFPS;
      const player = this.get_me();
      if (player?.get_isWarpJumping()) {
        player.set_isWarpJumping(false);
        player.ship?.enterRoaming();
        if (this.gameStateMachine) this.enterState(new RoamingState(this));
      }
      if (!recovering) this.addEventListener('enterFrame', update);
      Login.fadeScreen?.fadeOut();
    });
    // The original shows a static cover while discovery is pending.
    const cover = Login.fadeScreen;
    const restoreCover = cover
      ? reflection.around(cover, 'show', function () {
          this.showStaticCover();
        })
      : undefined;
    try {
      next(system, room, type);
    } catch (error) {
      cancelPendingWarpJoin(this);
      throw error;
    } finally {
      restoreCover?.();
    }
  });
  reflection.before(GameScene.prototype, 'exit', function () {
    pending.delete(this);
    cancellations.delete(this);
  });
  api.defer(() => {
    for (const scene of pending) cancelPendingWarpJoin(scene);
  });
}
