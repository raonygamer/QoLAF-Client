import type { API } from '../api/Types';
import { GameReflection } from '../api/GameReflection';
import { SceneBase, type Connection, type Message } from '../game/Bindings';
import { GlobalChatSanitizer } from '../chat/GlobalChatSanitizer';
import { notifyServiceUnavailable } from './ConnectionNotices';

/** Original transport guard; payload errors on a connected socket still propagate. */
export function sendServiceMessage(
  scene: SceneBase,
  source: Connection | null,
  message: Message,
): boolean {
  if (scene.get_isLeaving()) return false;
  if (!source || source !== scene.serviceConnection || !source.get_connected()) {
    notifyServiceUnavailable(scene);
    return false;
  }
  try {
    source.sendMessage(message);
    return true;
  } catch (error) {
    if (source.get_connected()) throw error;
    notifyServiceUnavailable(scene);
    return false;
  }
}

/** Apply source send semantics to every caller, including native chat and plugins. */
export function installSceneMessages(api: API): void {
  const reflection = new GameReflection(api);
  reflection.around(SceneBase.prototype, 'sendToServiceRoom', function (next, type, values = []) {
    if (this.get_isLeaving()) return;
    if (!this.serviceConnection?.get_connected()) {
      notifyServiceUnavailable(this);
      return;
    }
    if (type === 'chatMsg' && values.length > 1 && String(values[0]) === 'global') {
      const text = GlobalChatSanitizer.stripHTML(values[1] == null ? '' : String(values[1]));
      if (!text.length) return;
      // AS3 rest arguments were fresh; Haxe receives a caller-owned array.
      values = [...values];
      values[1] = text;
    }
    return next(type, values);
  });
  reflection.around(SceneBase.prototype, 'sendMessageToServiceRoom', function (_next, message) {
    sendServiceMessage(this, this.serviceConnection, message);
  });
  reflection.around(SceneBase.prototype, 'sendMessage', function (next, message) {
    if (!this.get_isLeaving() && this.connection?.get_connected()) return next(message);
  });
}
