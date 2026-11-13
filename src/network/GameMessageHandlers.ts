import { initialGameIsAbandoned, observeGameJoinResponse } from './InitialGameConnection';
import type { API } from '../api/Types';
import { GameReflection } from '../api/GameReflection';
import { SceneBase, GameScene, type Connection, type Message } from '../game/Bindings';

type Handler = (message: Message) => void;
interface Subscription {
  type: string;
  source: Connection | null;
  callback: Handler;
  wrapper: Handler;
}

/** Original scene-lifetime guard for persistent game-room message handlers. */
export function installGameMessageHandlers(api: API): void {
  const reflection = new GameReflection(api);
  const subscriptions = new Map<SceneBase, Set<Subscription>>();
  const retired = new WeakSet<SceneBase>();
  const detach = (type: string, subscription: Subscription) => {
    // Membership guards invalidate synchronously; preserve SDK dispatch indices.
    queueMicrotask(() => subscription.source?.removeMessageHandler(type, subscription.wrapper));
  };
  const create = (scene: SceneBase, type: string, callback: Handler, source: Connection | null) => {
    const subscription: Subscription = {
      type,
      source,
      callback,
      wrapper: (message) => {
        if (
          retired.has(scene) ||
          initialGameIsAbandoned(scene) ||
          scene.get_isLeaving() ||
          !source?.get_connected() ||
          scene.connection !== source ||
          !subscriptions.get(scene)?.has(subscription)
        )
          return;
        callback(message);
        observeGameJoinResponse(scene, message.type);
      },
    };
    return subscription;
  };
  const release = (scene: SceneBase, restore: boolean) => {
    const entries = subscriptions.get(scene);
    subscriptions.delete(scene);
    if (!entries) return;
    for (const entry of entries) {
      const type = entry.type;
      detach(type, entry);
      if (scene.connectionHandlers.h[type] === entry.wrapper) {
        if (restore) scene.connectionHandlers.h[type] = entry.callback;
        else delete scene.connectionHandlers.h[type];
      }
      // Game registrations may coexist for one type; restore every live
      // callback, not just the last one represented in the native dictionary.
      if (restore && !scene.get_isLeaving())
        scene.connection?.addMessageHandler(type, entry.callback);
    }
  };
  const retire = (scene: SceneBase) => {
    retired.add(scene);
    release(scene, false);
  };
  reflection.around(SceneBase.prototype, 'addMessageHandler', function (_next, type, callback) {
    if (retired.has(this) || this.get_isLeaving()) return;
    let entries = subscriptions.get(this);
    if (!entries) {
      entries = new Set();
      subscriptions.set(this, entries);
    }
    const entry = create(this, type, callback, this.connection);
    entries.add(entry);
    this.connectionHandlers.h[type] = entry.wrapper;
    entry.source?.addMessageHandler(type, entry.wrapper);
  });
  reflection.around(SceneBase.prototype, 'removeMessageHandler', function (next, type, callback) {
    const entries = subscriptions.get(this);
    const entry =
      entries &&
      [...entries].find(
        (subscription) =>
          subscription.type === type &&
          (subscription.callback === callback || subscription.wrapper === callback),
      );
    if (!entry) {
      const indexed = this.connectionHandlers.h[type];
      const result = next(type, callback);
      if (
        indexed &&
        subscriptions.get(this) === entries &&
        [...(entries ?? [])].some((subscription) => subscription.wrapper === indexed) &&
        !this.connectionHandlers.h[type]
      )
        this.connectionHandlers.h[type] = indexed;
      return result;
    }
    entries!.delete(entry);
    detach(type, entry);
    if (this.connectionHandlers.h[type] === entry.wrapper) {
      const remaining = [...entries!].filter((subscription) => subscription.type === type);
      const latest = remaining[remaining.length - 1];
      if (latest) this.connectionHandlers.h[type] = latest.wrapper;
      else delete this.connectionHandlers.h[type];
    }
  });
  reflection.before(SceneBase.prototype, 'exit', function () {
    retire(this);
  });
  reflection.before(GameScene.prototype, 'exit', function () {
    retire(this);
  });
  reflection.before(SceneBase.prototype, 'dispose', function () {
    retire(this);
  });
  api.defer(() => {
    for (const scene of [...subscriptions.keys()]) release(scene, true);
  });
}
