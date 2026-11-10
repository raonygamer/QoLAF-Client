import { type API, type Raw } from '../api/Types';
import type { Resolve } from '../runtime/As3';
import { bindNativeBitmapInput, type NativeBitmapInput } from './rich/NativeBitmapInput';
import { GlobalChatSanitizer } from './GlobalChatSanitizer';

/** Keep native chat identity and source channel restrictions around the shared bitmap input. */
export function installNativeRichChatInput(
  api: API,
  game: Raw,
  resolve: Resolve,
): NativeBitmapInput | undefined {
  const chat = game.chatInput;
  const input = chat?.input;
  if (!input?.element) return;
  const editor = bindNativeBitmapInput(api, input, resolve, () => chat.isActive());
  const syncChannel = () => {
    const restriction = chat.chatMode === 'global' ? '^<>=&#[]{}' : null;
    if (input.restrict !== restriction) input.set_restrict(restriction);
  };
  api.before(input, 'updatePlacement', syncChannel);
  if (typeof chat.sendGlobal === 'function')
    api.around(chat, 'sendGlobal', (next, value) => {
      const plain = GlobalChatSanitizer.stripHTML(value);
      if (plain.length) return next(plain);
    });
  api.after(chat, 'toggleChatMode', editor.layout);
  chat.tabs.addEventListener('change', syncChannel);
  api.defer(() => chat.tabs.removeEventListener('change', syncChannel));
  syncChannel();
  return editor;
}
