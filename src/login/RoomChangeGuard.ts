import type { Cleanup } from '../api/Types';
import type { JoinRoomManager } from '../game/Bindings';

const guards = new WeakMap<JoinRoomManager, () => void>();

/** An owned transition can reject unrelated room changes before they mutate UI/state. */
export function ownRoomChangeGuard(manager: JoinRoomManager, notify: () => void): Cleanup {
  guards.set(manager, notify);
  return () => {
    if (guards.get(manager) === notify) guards.delete(manager);
  };
}

export function hasRoomChangeGuard(manager: JoinRoomManager | null): boolean {
  return manager !== null && guards.has(manager);
}

export function rejectRoomChange(manager: JoinRoomManager | null): boolean {
  const notify = manager && guards.get(manager);
  if (!notify) return false;
  notify();
  return true;
}
