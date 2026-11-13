import type { Cleanup } from '../api/Types';
import type { GameScene, Room } from '../game/Bindings';
import type { ConnectionRetryPolicy } from './ConnectionRetryPolicy';

export interface GameJoinObserver {
  policy?: ConnectionRetryPolicy;
  entered(scene: GameScene): void;
  leaving(scene: GameScene): void;
  revealed(scene: GameScene): void;
  failed(reason: string, retryable: boolean): void;
}

const observers = new WeakMap<Room, GameJoinObserver>();

/** Recovery observes its own detached descriptor, never another room's join. */
export function watchGameJoin(room: Room, observer: GameJoinObserver): Cleanup {
  let active = true;
  const guarded: GameJoinObserver = {
    policy: observer.policy,
    entered: (scene) => {
      if (active) observer.entered(scene);
    },
    leaving: (scene) => {
      if (active) observer.leaving(scene);
    },
    revealed: (scene) => {
      if (active) observer.revealed(scene);
    },
    failed: (reason, retryable) => {
      if (active) observer.failed(reason, retryable);
    },
  };
  observers.set(room, guarded);
  return () => {
    active = false;
    if (observers.get(room) === guarded) observers.delete(room);
  };
}

export function observeGameJoin(room: Room): GameJoinObserver | undefined {
  return observers.get(room);
}
