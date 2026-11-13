import type { API } from '../api/Types';
import { GameReflection } from '../api/GameReflection';
import { LandedState } from '../game/Bindings';

/** Original landed key priority: close chat, close menu, then leave. */
export function installLandedInput(api: API): void {
  const reflection = new GameReflection(api);
  reflection.around(LandedState.prototype, 'execute', function () {
    const game = this.g;
    if (game.get_isLeaving()) return;
    game.draw();
    this.menuHud?.update();
    // Welcome/changelog delivery is owned by the session release sequence.
    if (!this._loaded || game.blockHotkeys) return;
    const chat = game.chatInput;
    if (!chat) return;
    if (this.keybinds.get_isEscPressed()) {
      if (chat.isActive()) chat.closeChat();
      else if (this.menuHud) this.hideMenu();
      else this.leave();
      return;
    }
    if (this.keybinds.get_isEnterPressed()) {
      chat.toggleChatMode();
      return;
    }
    const element = chat.input.element;
    if (chat.isActive() && element && element.ownerDocument.activeElement === element) {
      if (this.input.isKeyPressed(40)) chat.next();
      if (this.input.isKeyPressed(38)) chat.previous();
      return;
    }
    if (this.keybinds.isInputPressed(10)) {
      if (this.menuHud) this.hideMenu();
      else this.leave();
    }
  });
}
