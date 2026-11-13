import { initialGameIsAbandoned } from '../network/InitialGameConnection';
import type { API, Cleanup } from '../api/Types';
import { writeConnectionStatus, writeRoomTransitionNotice } from '../network/ConnectionNotices';
import { gameRecoveryActive } from './GameRecovery';
import { operatorDisconnectActive } from '../network/OperatorDisconnect';
import { reconnectServiceViews } from './ServiceViews';
import { GameReflection } from '../api/GameReflection';
import { GameScene, JoinRoomLocator, PopupMessage, type JoinRoomManager } from '../game/Bindings';

interface Recovery {
  manager: JoinRoomManager;
  roomId: string;
  attempt: number;
  running: boolean;
  stopped: boolean;
  timer?: ReturnType<typeof setTimeout>;
  closePopup?: Cleanup;
}

const delays = [1000, 2000, 4000, 8000, 15000];
const escapeText = (text: string) =>
  text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

/** Source bounded recovery for Service-only loss while the Game remains live. */
export function installServiceRecovery(api: API): void {
  const reflection = new GameReflection(api);
  const recoveries = new Map<GameScene, Recovery>();
  const release = (scene: GameScene) => {
    const recovery = recoveries.get(scene);
    if (!recovery) return;
    recoveries.delete(scene);
    clearTimeout(recovery.timer);
    recovery.closePopup?.();
  };
  const current = (scene: GameScene, recovery: Recovery) =>
    recoveries.get(scene) === recovery &&
    JoinRoomLocator.getService() === recovery.manager &&
    recovery.manager.roomStateMachine.currentRoom === scene &&
    !scene.get_isLeaving() &&
    !initialGameIsAbandoned(scene) &&
    !scene.noAutoReconnect &&
    scene.get_connected();
  const failed = (scene: GameScene, recovery: Recovery, reason: string, retryable: boolean) => {
    if (!current(scene, recovery)) return;
    recovery.running = false;
    if (!retryable) {
      recovery.stopped = true;
      scene.noAutoReconnect = true;
      recovery.manager.showErrorDialog(`Reconnection stopped: ${escapeText(reason)}`);
      return;
    }
    if (recovery.attempt < delays.length) {
      if (recovery.attempt === 1) writeRoomTransitionNotice('Retrying room connection...');
      schedule(scene, recovery);
      return;
    }
    writeRoomTransitionNotice('Reconnect failed. Choose Retry.');
    const popup = new PopupMessage('Retry');
    popup.set_text(
      'The room could not be reconnected.<br/>' +
        escapeText(reason) +
        '<br/><br/>Check your connection, then choose Retry.',
    );
    const close = () => {
      popup.removeEventListener('close', retry);
      popup.removeFromParent(true);
      recovery.closePopup = undefined;
    };
    const retry = () => {
      if (!current(scene, recovery)) return;
      close();
      recovery.attempt = 0;
      schedule(scene, recovery);
    };
    recovery.closePopup = close;
    popup.addEventListener('close', retry);
    recovery.manager.stage.addChild(popup);
  };
  function schedule(scene: GameScene, recovery: Recovery): void {
    if (
      !current(scene, recovery) ||
      recovery.running ||
      recovery.timer ||
      recovery.closePopup ||
      recovery.stopped
    )
      return;
    recovery.timer = setTimeout(
      () => {
        recovery.timer = undefined;
        if (!current(scene, recovery)) return release(scene);
        recovery.running = true;
        recovery.attempt++;
        scene.serviceReconnectAttempt = recovery.attempt;
        recovery.manager.reconnectServiceRoom(
          recovery.roomId,
          (connection) => {
            if (!current(scene, recovery)) return;
            if (!connection.get_connected()) {
              failed(scene, recovery, 'The Service room disconnected during initialization.', true);
              return;
            }
            scene.replaceServiceConnection(connection);
            scene.serviceReconnectAttempt = 0;
            release(scene);
            if (scene.solarSystem && scene.get_me()) scene.updateServiceRoom();
            reconnectServiceViews(scene);
          },
          (reason = 'The room connection timed out.', retryable = true) => {
            failed(scene, recovery, reason, retryable);
          },
        );
      },
      delays[recovery.attempt] ?? delays[delays.length - 1],
    );
  }
  reflection.around(GameScene.prototype, 'scheduleServiceReconnect', function () {
    if (initialGameIsAbandoned(this)) return;
    if (gameRecoveryActive(JoinRoomLocator.getService())) return;
    let recovery = recoveries.get(this);
    if (!recovery) {
      const manager = JoinRoomLocator.getService();
      if (!manager || this.get_isLeaving() || this.noAutoReconnect || !this.get_connected()) return;
      recovery = {
        manager,
        roomId: this.serviceRoomId,
        attempt: 0,
        running: false,
        stopped: false,
      };
      recoveries.set(this, recovery);
    }
    schedule(this, recovery);
  });
  reflection.around(GameScene.prototype, 'handleServiceDisconnect', function () {
    if (operatorDisconnectActive(this) || initialGameIsAbandoned(this)) return;
    if (gameRecoveryActive(JoinRoomLocator.getService())) return;
    if (
      this.noAutoReconnect ||
      this.get_isLeaving() ||
      this.disconnectPopup ||
      !this.get_connected()
    )
      return;
    if (!recoveries.has(this)) writeConnectionStatus('Service disconnected; reconnecting...');
    this.scheduleServiceReconnect();
  });
  reflection.before(GameScene.prototype, 'stopServiceReconnect', function () {
    release(this);
  });
  reflection.before(GameScene.prototype, 'exit', function () {
    release(this);
  });
  reflection.before(GameScene.prototype, 'dispose', function () {
    release(this);
  });
  api.defer(() => {
    for (const scene of recoveries.keys()) release(scene);
  });
}
