import type { API } from '../api/Types';
import { GameReflection } from '../api/GameReflection';
import { SceneBase, GameScene, type Connection } from '../game/Bindings';

interface Watch {
  source: Connection;
  listener: () => void;
  nativeListener: () => void;
  fired: boolean;
}
const notifications = new WeakMap<SceneBase, Watch>();

export function serviceDisconnectNotification(
  scene: SceneBase,
  source: Connection,
): (() => void) | undefined {
  const watch = notifications.get(scene);
  return watch?.source === source ? watch.listener : undefined;
}

/** Guard native service recovery against disconnects from a replaced socket. */
export function installServiceDisconnect(api: API): void {
  const reflection = new GameReflection(api);
  const watches = new Map<SceneBase, Watch>();
  const retired = new WeakSet<SceneBase>();
  const release = (scene: SceneBase, restore = false) => {
    const watch = watches.get(scene);
    if (!watch) return;
    watches.delete(scene);
    if (notifications.get(scene) === watch) notifications.delete(scene);
    watch.source.removeDisconnectHandler(watch.listener);
    if (
      restore &&
      !watch.fired &&
      !scene.get_isLeaving() &&
      scene.serviceConnection === watch.source &&
      watch.source.get_connected()
    )
      watch.source.addDisconnectHandler(watch.nativeListener);
  };
  const attach = (scene: SceneBase) => {
    const source = scene.serviceConnection;
    if (!source || retired.has(scene) || scene.get_isLeaving()) return;
    const nativeListener = reflection.bound(scene, scene.handleServiceDisconnect);
    // Both native joinReady and replaceServiceConnection attach this closure.
    source.removeDisconnectHandler(nativeListener);
    if (watches.get(scene)?.source === source) return;
    release(scene);
    const watch: Watch = {
      source,
      nativeListener,
      fired: false,
      listener: () => {
        if (
          watch.fired ||
          retired.has(scene) ||
          scene.get_isLeaving() ||
          watches.get(scene) !== watch ||
          scene.serviceConnection !== source
        )
          return;
        watch.fired = true;
        scene.handleServiceDisconnect();
      },
    };
    watches.set(scene, watch);
    notifications.set(scene, watch);
    source.addDisconnectHandler(watch.listener);
  };
  reflection.after(SceneBase.prototype, 'joinReady', function () {
    if (this.clockInitComplete && this.userJoinedComplete) attach(this);
  });
  reflection.before(SceneBase.prototype, 'replaceServiceConnection', function (connection) {
    if (connection && connection !== this.serviceConnection && connection.get_connected())
      release(this);
  });
  reflection.after(SceneBase.prototype, 'replaceServiceConnection', function (_result, connection) {
    if (connection && this.serviceConnection === connection) attach(this);
  });
  const retire = (scene: SceneBase) => {
    retired.add(scene);
    release(scene);
  };
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
    for (const scene of [...watches.keys()]) release(scene, true);
  });
}
