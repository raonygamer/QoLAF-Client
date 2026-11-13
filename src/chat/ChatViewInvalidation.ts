import type { Cleanup } from '../api/Types';

const listeners = new WeakMap<object, Set<() => void>>();

/** Close preview adapters before clear/rebuild, independently of installation order. */
export function onChatViewInvalidation(view: object, close: () => void): Cleanup {
  let callbacks = listeners.get(view);
  if (!callbacks) {
    callbacks = new Set();
    listeners.set(view, callbacks);
  }
  callbacks.add(close);
  return () => {
    callbacks.delete(close);
    if (!callbacks.size && listeners.get(view) === callbacks) listeners.delete(view);
  };
}

export function invalidateChatView(view: object): void {
  for (const close of [...(listeners.get(view) ?? [])]) close();
}
