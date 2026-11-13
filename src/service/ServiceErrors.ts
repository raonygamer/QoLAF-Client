import type { Cleanup } from '../api/Types';
import type { Connection, JoinRoomManager, Message } from '../game/Bindings';

type ErrorOwner = (reason: string) => boolean;
const owners = new WeakMap<JoinRoomManager, ErrorOwner[]>();
const listeners = new WeakMap<Connection, Cleanup>();

/** Innermost initialization owns its cleanup; otherwise the recovery owns the error. */
export function ownServiceErrors(manager: JoinRoomManager, handler: ErrorOwner): Cleanup {
  const stack = owners.get(manager) ?? [];
  owners.set(manager, stack);
  stack.push(handler);
  return () => {
    const index = stack.indexOf(handler);
    if (index >= 0) stack.splice(index, 1);
    if (!stack.length && owners.get(manager) === stack) owners.delete(manager);
  };
}

/** Exactly one published error listener, even when a pooled socket becomes primary again. */
export function installServiceErrors(manager: JoinRoomManager, connection: Connection): Cleanup {
  listeners.get(connection)?.();
  let active = true;
  const error = (message: Message) => {
    if (!active || manager.serviceConnection !== connection || !connection.get_connected()) return;
    const reason = message.getString(0);
    const stack = owners.get(manager);
    if (stack) {
      // A handler may remove itself and its parent during failure cleanup.
      for (const owner of [...stack].reverse()) {
        if (stack.includes(owner) && owner(reason)) return;
      }
    }
    manager.showErrorDialog(
      reason.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'),
    );
  };
  const detach = () => {
    if (!active) return;
    active = false;
    if (listeners.get(connection) === detach) listeners.delete(connection);
    // The SDK walks live callback arrays. Removing this callback during an
    // error/disconnect dispatch would skip the next recovery listener.
    queueMicrotask(() => {
      connection.removeMessageHandler('error', error);
      connection.removeDisconnectHandler(detach);
    });
  };
  listeners.set(connection, detach);
  connection.addMessageHandler('error', error);
  connection.addDisconnectHandler(detach);
  return detach;
}
