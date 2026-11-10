import { read, type API, type Raw } from '../api/Types';
import { ChatHistory } from './ChatHistory';

/** Source input history survives room changes, but never browser/client restarts. */
export function installNativeChatHistory(api: API, game: Raw, history = ChatHistory.session): void {
  const chat = game.chatInput,
    input = chat?.input;
  if (!input) return;
  const currentText = () => read(input, 'text', '');
  const updateDraft = () => history.updateDraft(currentText());
  input.addEventListener('change', updateDraft);
  api.defer(() => input.removeEventListener('change', updateDraft));
  api.before(chat, 'sendMessage', function () {
    // Record the complete submitted line, including local commands and channel
    // prefixes. Native sendLocal only records the message body in some channels.
    history.record(currentText());
  });
  api.after(chat, 'toggleChatMode', function () {
    if (chat.isActive()) history.begin(currentText());
  });
  const navigate = (direction: 'previous' | 'next') => {
    const text = history[direction](currentText());
    input.set_text(text);
    input.selectRange(text.length, text.length);
  };
  api.around(chat, 'previous', function () {
    navigate('previous');
  });
  api.around(chat, 'next', function () {
    navigate('next');
  });
  history.begin(currentText());
}
