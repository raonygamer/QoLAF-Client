import type { API } from '../api/Types';
import { GameReflection } from '../api/GameReflection';
import { SceneBase, GameScene, type Connection } from '../game/Bindings';

interface Watch {
  source: Connection;
  listener(): void;
  nativeListener(): void;
  fired: boolean;
}
const notifications = new WeakMap<SceneBase, Watch>();

export function gameDisconnectNotification(
  scene: SceneBase,
  source: Connection,
): (() => void) | undefined {
  const watch = notifications.get(scene);
  return watch?.source === source ? watch.listener : undefined;
}

/** Local and remote closes enter the same scene/socket-owned recovery callback. */
export function installGameDisconnect(api: API): void {
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
      scene.connection === watch.source &&
      watch.source.get_connected()
    ) {
      watch.source.addDisconnectHandler(watch.nativeListener);
    }
  };
  reflection.after(SceneBase.prototype, 'joinReady', function () {
    if (
      !this.clockInitComplete ||
      !this.userJoinedComplete ||
      retired.has(this) ||
      this.get_isLeaving()
    )
      return;
    const source = this.connection;
    if (!source) return;
    const nativeListener = reflection.bound(this, this.handleGameDisconnect);
    source.removeDisconnectHandler(nativeListener);
    if (watches.get(this)?.source === source) return;
    release(this);
    const watch: Watch = {
      source,
      nativeListener,
      fired: false,
      listener: () => {
        if (
          watch.fired ||
          retired.has(this) ||
          this.get_isLeaving() ||
          watches.get(this) !== watch ||
          this.connection !== source
        )
          return;
        watch.fired = true;
        this.handleGameDisconnect();
      },
    };
    watches.set(this, watch);
    notifications.set(this, watch);
    source.addDisconnectHandler(watch.listener);
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
    for (const scene of watches.keys()) release(scene, true);
  });
}
