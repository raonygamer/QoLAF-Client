import type { API } from '../api/Types';
import { GameReflection } from '../api/GameReflection';
import { GameScene, SceneBase, MessageLog } from '../game/Bindings';

let pending: string[] = [];
let unavailable = new WeakSet<GameScene>();
const escapeText = (text: string) =>
  text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

/** Source notices survive the gap between disposing one chat view and creating another. */
export function writeConnectionStatus(text: string): void {
  const scene = GameScene.instance;
  if (!scene || scene.get_isLeaving() || !scene.messageLog) {
    pending.push(text);
    if (pending.length > 12) pending.shift();
    return;
  }
  MessageLog.write(`<FONT COLOR='#82cfff'>${escapeText(text)}</FONT>`);
}

/** Source manager notices are purple in a live chat, blue when deferred. */
export function writeRoomTransitionNotice(text: string): void {
  const scene = GameScene.instance;
  if (!scene || scene.get_isLeaving() || !scene.messageLog) {
    writeConnectionStatus(text);
    return;
  }
  MessageLog.write(`<FONT COLOR='#c6a0ff'>${escapeText(text)}</FONT>`);
}

export function notifyServiceUnavailable(scene: SceneBase): void {
  if (
    !(scene instanceof GameScene) ||
    scene.get_isLeaving() ||
    scene.noAutoReconnect ||
    unavailable.has(scene)
  )
    return;
  unavailable.add(scene);
  writeConnectionStatus(
    'Service room unavailable; request not sent. Please try again after reconnecting.',
  );
}

export function installConnectionNotices(api: API): void {
  const reflection = new GameReflection(api);
  reflection.before(SceneBase.prototype, 'addChildToOverlay', function (child) {
    if (GameScene.instance !== this || child !== GameScene.instance.messageLog) return;
    const notices = pending;
    pending = [];
    for (const text of notices) writeConnectionStatus(text);
  });
  reflection.after(SceneBase.prototype, 'replaceServiceConnection', function (_result, connection) {
    if (
      this instanceof GameScene &&
      this.serviceConnection === connection &&
      connection.get_connected()
    )
      unavailable.delete(this);
  });
  api.defer(() => {
    pending = [];
    unavailable = new WeakSet();
  });
}
