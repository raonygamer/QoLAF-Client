import type { Game } from './Game';

/** Source rejection result around the native Haxe method, which returns void. */
export interface ChatSubmission
  extends Omit<Game.core.hud.components.chat.ChatInputText, 'sendMessage'> {
  sendMessage(): boolean | void;
}
