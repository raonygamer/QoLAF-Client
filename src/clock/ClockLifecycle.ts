import type {} from '../game/Clock';
import type { API, Cleanup } from '../api/Types';
import { GameReflection } from '../api/GameReflection';
import { Clock, SceneBase, GameScene } from '../game/Bindings';

/** Permanently detach clocks belonging to scenes that have been discarded. */
export function installClockLifecycle(api: API): void {
  const reflection = new GameReflection(api);
  const disposed = new WeakSet<Clock>();
  const disconnects = new Map<Clock, Cleanup>();
  const previous = Object.getOwnPropertyDescriptor(Clock.prototype, 'dispose');
  Object.defineProperty(Clock.prototype, 'dispose', {
    configurable: true,
    writable: true,
    value: function (this: Clock): void {
      if (disposed.has(this)) return;
      disposed.add(this);
      disconnects.get(this)?.();
      disconnects.delete(this);
      this.connection.removeMessageHandler('serverTime', reflection.bound(this, this.onServerTime));
      this.responsePending = false;
      this.removeEventListeners();
    },
  });
  api.defer(() => {
    if (previous) Object.defineProperty(Clock.prototype, 'dispose', previous);
    else Reflect.deleteProperty(Clock.prototype, 'dispose');
  });
  reflection.around(Clock.prototype, 'start', function (next) {
    if (disposed.has(this)) return;
    if (!disconnects.has(this)) {
      const source = this.connection;
      const disconnected = () => {
        if (this.connection === source) this.dispose();
      };
      source.addDisconnectHandler(disconnected);
      disconnects.set(this, () => source.removeDisconnectHandler(disconnected));
    }
    next();
  });
  reflection.around(Clock.prototype, 'requestServerTime', function (next) {
    if (!disposed.has(this) && this.connection.get_connected()) next();
  });
  reflection.around(Clock.prototype, 'onServerTime', function (next, message) {
    if (!disposed.has(this)) next(message);
  });
  reflection.before(SceneBase.prototype, 'exit', function () {
    this.clock?.dispose();
  });
  reflection.before(GameScene.prototype, 'exit', function () {
    this.clock?.dispose();
  });
  reflection.before(SceneBase.prototype, 'dispose', function () {
    this.clock?.dispose();
  });
  api.defer(() => {
    for (const detach of disconnects.values()) detach();
    disconnects.clear();
  });
}
