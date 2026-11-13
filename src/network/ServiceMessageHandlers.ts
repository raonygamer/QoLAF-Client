import type { API } from '../api/Types';
import { GameReflection } from '../api/GameReflection';
import { SceneBase, GameScene, type Connection, type Message } from '../game/Bindings';
import { servicePoolFor } from '../service/ServicePools';

type Handler = (message: Message) => void;
interface Subscription {
  source: Connection | null;
  callback: Handler;
  wrapper: Handler;
}

/** Persistent subscriptions survive service replacement; old socket messages do not. */
export function installServiceMessageHandlers(api: API): void {
  const reflection = new GameReflection(api);
  const subscriptions = new Map<SceneBase, Map<string, Subscription>>();
  const retired = new WeakSet<SceneBase>();
  const detach = (type: string, subscription: Subscription) => {
    // Replacement/removal invalidates the map entry before the next callback.
    // Delay splicing the SDK's live array until its current dispatch finishes.
    queueMicrotask(() => subscription.source?.removeMessageHandler(type, subscription.wrapper));
  };
  const create = (scene: SceneBase, type: string, callback: Handler, source: Connection | null) => {
    const subscription: Subscription = {
      source,
      callback,
      wrapper: (message) => {
        if (
          retired.has(scene) ||
          scene.get_isLeaving() ||
          !source?.get_connected() ||
          scene.serviceConnection !== source ||
          subscriptions.get(scene)?.get(type) !== subscription
        )
          return;
        callback(message);
      },
    };
    return subscription;
  };
  const release = (scene: SceneBase, restore: boolean) => {
    const entries = subscriptions.get(scene);
    subscriptions.delete(scene);
    if (!entries) return;
    for (const [type, entry] of entries) {
      detach(type, entry);
      if (scene.serviceHandlers.h[type] !== entry.wrapper) continue;
      if (restore) {
        scene.serviceHandlers.h[type] = entry.callback;
        if (!scene.get_isLeaving())
          scene.serviceConnection?.addMessageHandler(type, entry.callback);
      } else delete scene.serviceHandlers.h[type];
    }
  };
  const retire = (scene: SceneBase) => {
    retired.add(scene);
    release(scene, false);
  };
  reflection.around(
    SceneBase.prototype,
    'addServiceMessageHandler',
    function (_next, type, callback) {
      if (retired.has(this) || this.get_isLeaving()) return;
      let entries = subscriptions.get(this);
      if (!entries) {
        entries = new Map();
        subscriptions.set(this, entries);
      }
      const previous = entries.get(type);
      if (previous) detach(type, previous);
      const entry = create(this, type, callback, this.serviceConnection);
      entries.set(type, entry);
      this.serviceHandlers.h[type] = entry.wrapper;
      entry.source?.addMessageHandler(type, entry.wrapper);
    },
  );
  reflection.around(
    SceneBase.prototype,
    'removeServiceMessageHandler',
    function (next, type, callback) {
      const entries = subscriptions.get(this);
      const entry = entries?.get(type);
      if (!entry) return next(type, callback);
      if (entry.callback !== callback && entry.wrapper !== callback) {
        // A closed view may still remove its old callback after another view
        // took over this type. Keep native callback removal, but preserve the
        // replacement's dictionary entry for reconnect and unload.
        const result = next(type, callback);
        if (subscriptions.get(this)?.get(type) === entry)
          this.serviceHandlers.h[type] = entry.wrapper;
        return result;
      }
      entries!.delete(type);
      detach(type, entry);
      if (this.serviceHandlers.h[type] === entry.wrapper) delete this.serviceHandlers.h[type];
    },
  );
  reflection.around(SceneBase.prototype, 'replaceServiceConnection', function (next, connection) {
    if (
      retired.has(this) ||
      this.get_isLeaving() ||
      !connection?.get_connected() ||
      connection === this.serviceConnection
    )
      return;
    const previousConnection = this.serviceConnection;
    const entries = subscriptions.get(this);
    if (entries) {
      for (const [type, previous] of entries) {
        detach(type, previous);
        const entry = create(this, type, previous.callback, connection);
        entries.set(type, entry);
        this.serviceHandlers.h[type] = entry.wrapper;
      }
    }
    // Native replacement owns the disconnect listener and attaches the map's
    // current wrappers. Never replay one-shot RPCs here.
    next(connection);
    this.serviceRoomId = connection.get_roomId();
    if (this.serviceConnection === connection && reflection.is(this, 'core.scene.Game')) {
      servicePoolFor(this)?.retireDisconnectedPrimary(this, previousConnection);
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
