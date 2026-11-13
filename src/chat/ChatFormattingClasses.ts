import type { API } from '../api/Types';
import type { Resolve } from '../runtime/HaxeInterop';
import { createBitmapInputAdapter } from '../ui/BitmapInputAdapter';
import { createChatComposerFormatButton } from '../ported/ChatComposerFormatButton';
import { createChatSelectionValueSlider } from '../ported/ChatSelectionValueSlider';
import { createChatSelectionFormatPopup } from '../ported/ChatSelectionFormatPopup';

export function createChatFormattingClasses(api: API, nativeResolve: Resolve): Resolve {
  const cache: Record<string, any> = {};
  const factories: Record<string, (resolve: Resolve) => any> = {
    'core.hud.components.chat.ChatComposerFormatButton': createChatComposerFormatButton,
    'core.hud.components.chat.ChatSelectionValueSlider': createChatSelectionValueSlider,
    'core.hud.components.chat.ChatSelectionFormatPopup': createChatSelectionFormatPopup,
    'core.hud.components.chat.rich.RichBitmapChatTextInput': (resolve) =>
      createBitmapInputAdapter(api, resolve),
  };
  const resolve: Resolve = (name) =>
    (cache[name] ??= factories[name] ? factories[name](resolve) : nativeResolve(name));
  return resolve;
}
