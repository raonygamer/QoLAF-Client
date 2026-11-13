import type { API } from '../api/Types';
import { GameReflection } from '../api/GameReflection';
import { MessageLog, type GameScene } from '../game/Bindings';
import { RichChatMarkupValidator } from './rich/RichChatMarkupValidator';
import type { ChatSubmission } from '../game/ChatSubmission';
import { permitsArtifactDraft } from './NativeChatArtifactPolicy';
import { ChatArtifactChannelPolicy } from './ChatArtifactChannelPolicy';

const submittedToggles = new WeakSet<object>();

/** Native toggle calls sendMessage again after the source submission check. */
export function chatToggleAlreadySubmitted(chat: object): boolean {
  return submittedToggles.has(chat);
}

/** Source sendMessage rejects malformed markup before commands or transmission. */
export function installNativeChatValidation(api: API, game: GameScene): void {
  const chat: ChatSubmission | null = game.chatInput;
  if (!chat) return;
  const reflection = new GameReflection(api);
  const validate = (): boolean => {
    const text = chat.input.get_text();
    const markupError = RichChatMarkupValidator.validationError(text);
    const error = markupError
      ? 'Message not sent: ' + markupError
      : permitsArtifactDraft(chat, text)
        ? ''
        : ChatArtifactChannelPolicy.restrictionMessage;
    if (!error) return true;
    MessageLog.write(error, 'error');
    chat.input.setFocus();
    return false;
  };
  reflection.around(chat, 'sendMessage', function (next) {
    if (submittedToggles.has(this)) return;
    if (validate()) return next();
    return false;
  });
  reflection.around(chat, 'toggleChatMode', function (next) {
    if (!this.isActive()) return next();
    // Source submits while the composer is still open and only closes on
    // acceptance. Native toggle hides first and ignores the return value.
    if (this.sendMessage() === false) {
      this.input.setFocus();
      return;
    }
    // A command may itself close the composer or leave the current scene.
    // Do not let native toggle reopen a composer that submission already hid.
    if (!this.isActive()) return;
    submittedToggles.add(this);
    try {
      return next();
    } finally {
      submittedToggles.delete(this);
    }
  });
}
