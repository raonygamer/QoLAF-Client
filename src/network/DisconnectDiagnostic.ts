import { JoinRoomLocator, MessageLog, type GameScene } from '../game/Bindings';
import { writeConnectionStatus } from './ConnectionNotices';
import { gameRecoveryActive } from '../service/GameRecovery';
import { gameDisconnectNotification } from './GameDisconnect';
import { serviceDisconnectNotification } from './ServiceDisconnect';

const notice = writeConnectionStatus;

/** Original /disconnect command, also used by the clock-response watchdog. */
export function disconnectRoomForRecovery(scene: GameScene, argument: string): void {
  const target = argument.trim().toLowerCase();
  if (target !== 'game' && target !== 'service') {
    MessageLog.write('Usage: /disconnect <game|service>', 'error');
    return;
  }
  if (scene.get_isLeaving() || scene.noAutoReconnect || scene.idleDisconnected) {
    notice(
      'Disconnect diagnostic unavailable while leaving or after a server disconnect instruction.',
    );
    return;
  }
  const source = target === 'game' ? scene.connection : scene.serviceConnection;
  const label = target === 'game' ? 'Game' : 'Service';
  if (!source?.get_connected()) {
    notice(`${label} room is already disconnected; no additional disconnect requested.`);
    return;
  }
  const manager = JoinRoomLocator.getService();
  if (
    !manager ||
    manager.roomStateMachine.currentRoom !== scene ||
    gameRecoveryActive(manager) ||
    !scene.get_connected() ||
    !scene.serviceConnection?.get_connected()
  ) {
    notice('Wait for the current room recovery before running another disconnect diagnostic.');
    return;
  }
  const notify =
    target === 'game'
      ? gameDisconnectNotification(scene, source)
      : serviceDisconnectNotification(scene, source);
  if (!notify) {
    notice('Disconnect diagnostic unavailable until the room is initialized.');
    return;
  }
  try {
    source.disconnect();
  } catch {
    if (source.get_connected()) {
      notice(`The ${label} room socket could not be disconnected.`);
      return;
    }
  }
  // The captured callback absorbs duplicate synchronous/asynchronous notifications
  // and rejects replacements; local SDK close need not emit any notification.
  if (!source.get_connected()) notify();
}
