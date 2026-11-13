import type { API } from '../api/Types';
import { GameReflection } from '../api/GameReflection';
import { MessageLog, type GameScene } from '../game/Bindings';
import type { ChatSubmission } from '../game/ChatSubmission';

interface EmperorComposer extends ChatSubmission {
  floatingContext?: object | null;
  rememberChatTab?(): void;
}
import { ChatHistory } from '../chat/ChatHistory';
import { ClientIPCService } from './ClientIPCService';
import { EmperorReadyNotifier } from './EmperorReadyNotifier';

/** One notifier and command hook per native Game, disposed with its scene. */
export function installNativeEmperorCoordination(
  api: API,
  game: GameScene,
  ping: () => void,
): void {
  const reflection = new GameReflection(api);
  let tracker: EmperorReadyNotifier | null = null;
  let transport: ClientIPCService | null = null;
  const ensure = () => {
    const current = ClientIPCService.instance;
    if (current === transport) return;
    tracker?.dispose();
    transport = current;
    tracker = current ? new EmperorReadyNotifier(api, game, current, ping) : null;
  };
  ensure();
  api.interval(ensure, 250);
  api.defer(() => tracker?.dispose());
  reflection.before(game.shipManager, 'killed', function (message, start) {
    const enemy = this.enemiesById.h[message.getInt(start)];
    if (enemy) tracker?.enemyKilled(enemy);
  });
  const chat: EmperorComposer | null = game.chatInput;
  if (!chat) return;
  reflection.around(chat, 'sendMessage', function (next, ...args) {
    const text = this.input.get_text();
    const shortcut = /^\/?(xr|yr|zr)$/i.exec(text.trim());
    if (!shortcut || this.floatingContext || !this.isActive()) return next(...args);
    const code = shortcut[1].toLowerCase();
    const warning =
      tracker?.manualPublish(code) ?? (tracker ? null : 'Emperor status IPC is unavailable.');
    if (warning === null) {
      ChatHistory.session.record(text);
      this.input.set_text('');
      this.updateTab();
      this.rememberChatTab?.();
      return true;
    }
    // A failed /xr is ordinary selected-channel chat, not an unknown command.
    this.input.set_text(code);
    const result = next(...args);
    let stop = () => {};
    stop = api.interval(() => {
      stop();
      if (api.game !== game || game.get_isLeaving() || !game.messageLog) return;
      MessageLog.write("<font color='#9098a5'>[Emperor] " + warning + '</font>');
    }, 150);
    return result;
  });
}
