import { read, type API, type Raw } from '../api/Types';
import { cancelNativePlayerCommands } from '../movement/NativeCommandCancellation';
import { RadioChatBridge } from './RadioChatBridge';

/** Native Starling layering with the port's DOM-backed text-editor focus. */
export function createNativeRadioChatBridge(
  api: Pick<API, 'cls'>,
  document: Document,
): RadioChatBridge {
  const inputElement = (chat: Raw) => chat.input?.element;
  return new RadioChatBridge({
    nativeInput: () => {
      const element = document.activeElement;
      if (
        element &&
        (element.tagName === 'INPUT' ||
          element.tagName === 'TEXTAREA' ||
          (element as HTMLElement).isContentEditable)
      )
        return element;
      const stage = read(read(api.cls('starling.core.Starling'), 'current'), 'nativeStage');
      const focused = read(stage, 'focus');
      return focused && read(focused, 'type') === 'input' ? focused : null;
    },
    ownsInput: (chat, focused) =>
      inputElement(chat) === focused || !!chat.ownsComposerNativeFocus?.(focused),
    logicalFocus: (chat) =>
      read(chat, 'visible', false) &&
      ((!!inputElement(chat) &&
        inputElement(chat).ownerDocument?.activeElement === inputElement(chat)) ||
        read(chat.input, 'hasFocus', false)),
    cancelCommands: (game) => cancelNativePlayerCommands(game),
  });
}
