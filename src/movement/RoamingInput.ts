import type { API } from '../api/Types';
import { ChatInputText, RoamingState } from '../game/Bindings';
import type { AutomationGame } from '../game/AutomationGame';

/** Source chat focus gates around native roaming actions and current respawn behavior. */
export function installRoamingInput(api: API): void {
  let unfocused: ChatInputText | null = null;
  api.around(ChatInputText.prototype, 'isActive', function (next) {
    return this === unfocused ? false : next();
  });
  api.around(RoamingState.prototype, 'updateInput', function (next) {
    if (!this.me?.get_commandable() || !this.get_loaded()) return next();
    const chat = this.g.chatInput;
    if (!chat) return next();
    if (this.input.isKeyPressed(13)) {
      chat.toggleChatMode();
      return;
    }
    const element = chat.input.element;
    const focused = chat.isActive() && element && element.ownerDocument.activeElement === element;
    if (focused) {
      if (this.input.isKeyPressed(27)) chat.closeChat();
      if (this.input.isKeyPressed(40)) chat.next();
      if (this.input.isKeyPressed(38)) chat.previous();
      const game: AutomationGame = this.g;
      if (game.automationManager?.controlsClaimed) this.updateCommands();
      else this.checkAccelerate(true);
      return;
    }
    // Native updateInput checks visibility instead of focus. Scope that query
    // to this invocation so chat remains open while ordinary controls resume.
    const previous = unfocused;
    unfocused = chat;
    try {
      return next();
    } finally {
      unfocused = previous;
    }
  });
}
