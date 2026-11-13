import type {} from '../game/LoadingCover';
import type { API } from '../api/Types';
import { GameReflection } from '../api/GameReflection';
import { GameScene, JoinRoomLocator, Login, MessageLog, type Clock } from '../game/Bindings';
import { disconnectRoomForRecovery } from '../network/DisconnectDiagnostic';
import { gameRecoveryActive } from '../service/GameRecovery';
import { serviceGameIsReady } from '../service/ServiceGameReadiness';
import { isWarpJoinPending } from '../login/WarpTransition';
import { clockResponseSamples } from './ClockResponseSamples';
import { ClockResponseWatchdog } from './ClockResponseWatchdog';

export function installNativeClockWatchdog(api: API): (scene: GameScene) => void {
  const reflection = new GameReflection(api);
  const observations = new Map<GameScene, { clock: Clock; watchdog: ClockResponseWatchdog }>();
  const resetScene = (scene: GameScene) => {
    const observation = observations.get(scene);
    if (observation) observation.watchdog.reset(clockResponseSamples(observation.clock).sequence);
  };
  const reset = () => {
    for (const { clock, watchdog } of observations.values()) {
      watchdog.reset(clockResponseSamples(clock).sequence);
    }
  };
  // Polling alone misses focus leaving and returning between adjacent frames.
  window.addEventListener('focus', reset);
  window.addEventListener('blur', reset);
  document.addEventListener('visibilitychange', reset);
  reflection.around(GameScene.prototype, 'update', function (next, event) {
    const clock = this.clock;
    if (!clock) {
      observations.delete(this);
      return next(event);
    }
    let observation = observations.get(this);
    if (observation?.clock !== clock) {
      observation = { clock, watchdog: new ClockResponseWatchdog() };
      observations.set(this, observation);
    }
    const manager = JoinRoomLocator.getService();
    const me = this.get_me();
    const active =
      manager?.roomStateMachine.currentRoom === this &&
      !document.hidden &&
      document.hasFocus() &&
      serviceGameIsReady(this) &&
      !this.noAutoReconnect &&
      !this.idleDisconnected &&
      !gameRecoveryActive(manager) &&
      !isWarpJoinPending(this) &&
      !!me &&
      !me.get_isWarpJumping() &&
      !Login.fadeScreen?.get_isCoverVisible() &&
      !!this.gameStateMachine?.currentState?.get_loaded();
    if (!observation.watchdog.update(active, clockResponseSamples(clock))) return next(event);
    api.log('Game reconnect: foreground clock response exceeded 10 seconds');
    MessageLog.write(
      "<FONT COLOR='#ff8d85'>Game connection: clock response exceeded 10s; reconnecting...</FONT>",
    );
    disconnectRoomForRecovery(this, 'game');
    // Recovery may have disposed every scene manager: never continue this frame.
  });
  const retire = (scene: GameScene) => observations.delete(scene);
  reflection.before(GameScene.prototype, 'exit', function () {
    retire(this);
  });
  reflection.before(GameScene.prototype, 'dispose', function () {
    retire(this);
  });
  api.defer(() => {
    window.removeEventListener('focus', reset);
    window.removeEventListener('blur', reset);
    document.removeEventListener('visibilitychange', reset);
    observations.clear();
  });
  return resetScene;
}
