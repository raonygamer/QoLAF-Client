import { read, type Raw } from '../api/Types';

export interface RadioChatFocus {
  nativeInput(): unknown | null;
  ownsInput(chat: Raw, focused: unknown): boolean;
  logicalFocus(chat: Raw): boolean;
  cancelCommands(game: Raw): void;
}

/** Reorders existing siblings without removing the composer or disturbing its native focus. */
export class RadioChatBridge {
  private owner: Raw | null = null;
  private view: Raw | null = null;
  private layer: Raw | null = null;
  private logIndex = -1;
  private inputIndex = -1;
  constructor(private focus: RadioChatFocus) {}

  attach(game: Raw, popup: Raw): void {
    const layer = read(popup, 'parent');
    if (!game || !popup || !layer) return;
    if (this.view) this.detach(this.view);
    this.owner = game;
    this.view = popup;
    this.layer = layer;
    this.logIndex =
      game.messageLog && read(game.messageLog, 'parent') === layer
        ? layer.getChildIndex(game.messageLog)
        : -1;
    this.inputIndex =
      game.chatInput && read(game.chatInput, 'parent') === layer
        ? layer.getChildIndex(game.chatInput)
        : -1;
    if (this.logIndex >= 0) layer.setChildIndex(game.messageLog, read(layer, 'numChildren') - 1);
    if (this.inputIndex >= 0) layer.setChildIndex(game.chatInput, read(layer, 'numChildren') - 1);
    game.blockHotkeys = true;
    this.focus.cancelCommands(game);
  }

  detach(popup: Raw): void {
    if (!popup || popup !== this.view || !this.owner) return;
    const restore = (child: Raw, index: number) => {
      if (!this.layer || !child || read(child, 'parent') !== this.layer || index < 0) return;
      this.layer.setChildIndex(child, Math.min(index, read(this.layer, 'numChildren') - 1));
    };
    if (this.logIndex <= this.inputIndex) {
      restore(this.owner.messageLog, this.logIndex);
      restore(this.owner.chatInput, this.inputIndex);
    } else {
      restore(this.owner.chatInput, this.inputIndex);
      restore(this.owner.messageLog, this.logIndex);
    }
    this.owner = this.view = this.layer = null;
    this.logIndex = this.inputIndex = -1;
  }
  hasPopup(scene: Raw): boolean {
    return this.owner === scene && !!this.view && read(this.view, 'parent') === this.layer;
  }
  allowsChat(game: Raw): boolean {
    return (
      this.hasPopup(game) &&
      !game.isLeaving &&
      read(this.view, 'visible', false) &&
      !!game.messageLog &&
      read(game.messageLog, 'visible', false) &&
      !!game.chatInput &&
      read(game.messageLog, 'parent') === this.layer &&
      read(game.chatInput, 'parent') === this.layer &&
      this.isTopmost()
    );
  }
  chatHasFocus(game: Raw): boolean {
    const chat = game?.chatInput;
    if (!chat?.isActive()) return false;
    const focused = this.focus.nativeInput();
    return focused !== null ? this.focus.ownsInput(chat, focused) : this.focus.logicalFocus(chat);
  }
  otherInputHasFocus(game: Raw): boolean {
    const focused = this.focus.nativeInput();
    return focused !== null && (!game?.chatInput || !this.focus.ownsInput(game.chatInput, focused));
  }
  handleEscape(game: Raw, popup: Raw): boolean {
    if (!this.ownsEscape(game, popup)) return true;
    if (game.chatInput?.isActive() && !this.otherInputHasFocus(game)) {
      game.chatInput.closeChat();
      return true;
    }
    return false;
  }
  ownsEscape(game: Raw, popup: Raw): boolean {
    return popup === this.view && game === this.owner && this.isTopmost();
  }
  private isTopmost(): boolean {
    if (!this.view || !this.layer || read(this.view, 'parent') !== this.layer) return false;
    for (
      let i = this.layer.getChildIndex(this.view) + 1;
      i < read(this.layer, 'numChildren');
      i++
    ) {
      const child = this.layer.getChildAt(i);
      if (
        read(child, 'visible', false) &&
        child !== this.owner?.messageLog &&
        child !== this.owner?.chatInput
      )
        return false;
    }
    return true;
  }
}
