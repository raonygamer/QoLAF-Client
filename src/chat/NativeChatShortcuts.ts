import type { API } from '../api/Types';
import type { ChatInputText } from '../game/Bindings';
import type { NativeBitmapInput } from './rich/NativeBitmapInput';
import type { ChatImageShortcutStore } from './ChatImageShortcutStore';
import type { DeviceSettings } from '../settings/DeviceSettings';
import { ChatEmojiAutocompleteParser } from './ChatEmojiAutocompleteParser';
import { ChatDiscordImageLink } from './ChatDiscordImageLink';

/** Expand the original :image_alias: syntax at the visible caret, without submitting chat. */
export function installNativeChatShortcuts(
  api: API,
  chat: ChatInputText,
  editor: NativeBitmapInput,
  shortcuts: ChatImageShortcutStore,
  preferences?: DeviceSettings,
): void {
  const input = chat.input;
  const element = input.element;
  if (!element) return;
  let resolving = false;
  const refresh = () => {
    if (
      resolving ||
      editor.binding.isComposing ||
      !chat.isActive() ||
      !chat.get_visible() ||
      !(preferences?.get('enableNewChatIntegrationSystem') ?? true)
    )
      return;
    const mode = chat.chatMode === 'privateSaved' ? 'private' : chat.chatMode;
    if (!ChatDiscordImageLink.isEmbedChannel(mode)) return;
    const model = editor.model;
    const token = ChatEmojiAutocompleteParser.find(
      model.visibleText,
      model.selectionBegin,
      model.selectionEnd,
    );
    if (!token?.closed) return;
    const url = shortcuts.resolve(token.query);
    if (url === null) return;
    resolving = true;
    try {
      if (model.replaceRange(token.beginIndex, token.endIndex, url)) {
        editor.binding.project();
        input.dispatchEventWith('change', true);
        input.setFocus();
      }
    } finally {
      resolving = false;
    }
  };
  const selectionChanged = () => {
    if (element.ownerDocument.activeElement === element) refresh();
  };
  input.addEventListener('change', refresh);
  element.addEventListener('select', selectionChanged);
  element.ownerDocument.addEventListener('selectionchange', selectionChanged);
  api.defer(() => {
    input.removeEventListener('change', refresh);
    element.removeEventListener('select', selectionChanged);
    element.ownerDocument.removeEventListener('selectionchange', selectionChanged);
  });
}
