import type { API } from '../api/Types';
import type { GameScene } from '../game/Bindings';
import { GameReflection } from '../api/GameReflection';
import { RichChatMarkupValidator } from './rich/RichChatMarkupValidator';
import { ChatHistory } from './ChatHistory';
import { permitsArtifactDraft } from './NativeChatArtifactPolicy';
import { chatToggleAlreadySubmitted } from './NativeChatValidation';

/** Source input history survives room changes, but never browser/client restarts. */
export function installNativeChatHistory(
  api: API,
  game: GameScene,
  history = ChatHistory.session,
): void {
  const chat = game.chatInput,
    input = chat?.input;
  if (!chat || !input) return;
  const reflection = new GameReflection(api);
  const currentText = () => input.get_text();
  const updateDraft = () => history.updateDraft(currentText());
  input.addEventListener('change', updateDraft);
  api.defer(() => input.removeEventListener('change', updateDraft));
  reflection.before(chat, 'sendMessage', function () {
    if (chatToggleAlreadySubmitted(this)) return;
    // Record the complete submitted line, including local commands and channel
    // prefixes. Native sendLocal only records the message body in some channels.
    const text = currentText();
    if (RichChatMarkupValidator.isValid(text) && permitsArtifactDraft(chat, text))
      history.record(text);
  });
  reflection.around(chat, 'toggleChatMode', function (next) {
    const wasActive = this.isActive();
    const result = next();
    if (!wasActive && this.isActive()) history.begin(currentText());
    return result;
  });
  const navigate = (direction: 'previous' | 'next') => {
    const text = history[direction](currentText());
    input.set_text(text);
    input.selectRange(text.length, text.length);
  };
  reflection.around(chat, 'previous', function () {
    navigate('previous');
  });
  reflection.around(chat, 'next', function () {
    navigate('next');
  });
  history.begin(currentText());
}
