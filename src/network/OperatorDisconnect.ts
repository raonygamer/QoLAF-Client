import type { API } from '../api/Types';
import { GameScene, JoinRoomLocator } from '../game/Bindings';
import { isRoomOperator } from '../chat/RoomControlIdentity';
import { writeConnectionStatus } from './ConnectionNotices';
import { gameDisconnectNotification } from './GameDisconnect';
import { serviceDisconnectNotification } from './ServiceDisconnect';

const closing = new WeakSet<GameScene>();
let recover: ((scene: GameScene) => void) | undefined;

export function operatorDisconnectActive(scene: GameScene): boolean {
  return closing.has(scene);
}

export function installOperatorRecovery(api: API, callback: (scene: GameScene) => void): void {
  recover = callback;
  api.defer(() => {
    if (recover === callback) recover = undefined;
  });
}

/** Cooperative client control; server security messages remain untouched. */
export function disconnectRoomByOperator(
  scene: GameScene,
  senderId: string,
  target: 'game' | 'service',
  reason: string,
): boolean {
  if (
    scene.noAutoReconnect ||
    scene.get_isLeaving() ||
    closing.has(scene) ||
    GameScene.instance !== scene ||
    !isRoomOperator(senderId) ||
    !scene.connection ||
    (target === 'service' && !scene.serviceConnection)
  )
    return false;
  if (!JoinRoomLocator.getService() || !recover) {
    writeConnectionStatus('Room reconnection is unavailable right now.');
    return false;
  }
  let shortReason = reason
    .replace(/[\x00-\x1f\x7f]/g, ' ')
    .trim()
    .slice(0, 30);
  const last = shortReason.charCodeAt(shortReason.length - 1);
  if (last >= 0xd800 && last <= 0xdbff) shortReason = shortReason.slice(0, -1);
  writeConnectionStatus('You got kicked by the operator of this client.');
  if (shortReason) writeConnectionStatus('Reason: ' + shortReason);
  const gameSocket = scene.connection;
  const serviceSocket = target === 'service' ? scene.serviceConnection : null;
  const gameClosed = gameDisconnectNotification(scene, gameSocket);
  const serviceClosed = serviceSocket && serviceDisconnectNotification(scene, serviceSocket);
  closing.add(scene);
  try {
    try {
      gameSocket.disconnect();
    } catch {
      if (gameSocket.get_connected())
        writeConnectionStatus('The Game room could not be disconnected.');
    }
    if (serviceSocket) {
      try {
        serviceSocket.disconnect();
      } catch {
        if (serviceSocket.get_connected())
          writeConnectionStatus('The Service room could not be disconnected.');
      }
    }
    if (!gameSocket.get_connected()) gameClosed?.();
    if (serviceSocket && !serviceSocket.get_connected()) serviceClosed?.();
  } finally {
    closing.delete(scene);
  }
  if (!gameSocket.get_connected() || (serviceSocket && !serviceSocket.get_connected()))
    recover?.(scene);
  return !gameSocket.get_connected() && (!serviceSocket || !serviceSocket.get_connected());
}
