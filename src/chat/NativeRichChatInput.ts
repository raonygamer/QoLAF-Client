import type { API } from '../api/Types';
import { Localize, type GameScene } from '../game/Bindings';
import type { Resolve } from '../runtime/HaxeInterop';
import { bindNativeBitmapInput, type NativeBitmapInput } from './rich/NativeBitmapInput';
import type { DeviceSettings } from '../settings/DeviceSettings';
import { GlobalChatSanitizer } from './GlobalChatSanitizer';
import type { ChatArtifactLinkResolver } from './ChatArtifactLinkResolver';

/** Keep native chat identity and source channel restrictions around the shared bitmap input. */
export function installNativeRichChatInput(
  api: API,
  game: GameScene,
  resolve: Resolve,
  preferences?: DeviceSettings,
  artifacts?: Pick<ChatArtifactLinkResolver, 'resolvePresentation' | 'resolveText' | 'onResolved'>,
): NativeBitmapInput | undefined {
  const chat = game.chatInput;
  if (!chat) return;
  const input = chat.input;
  if (!input?.element) return;
  const editor = bindNativeBitmapInput(
    api,
    input,
    resolve,
    () => chat.isActive(),
    artifacts?.resolvePresentation,
  );
  if (artifacts) {
    const resolveDraft = () => artifacts.resolveText(input.get_text());
    input.addEventListener('change', resolveDraft);
    api.defer(() => input.removeEventListener('change', resolveDraft));
    api.defer(
      artifacts.onResolved(() => {
        editor.model.refreshArtifactLabels();
        editor.view.refreshArtifactLabels();
        editor.binding.project();
      }),
    );
    resolveDraft();
  }
  const syncPrompt = () => {
    const integrated = preferences?.get('enableNewChatIntegrationSystem') ?? true;
    editor.view.setPrompt(integrated ? Localize.t('Type text here...') : '');
  };
  if (preferences)
    api.defer(
      preferences.subscribe((key) => {
        if (key === 'enableNewChatIntegrationSystem') syncPrompt();
      }),
    );
  syncPrompt();
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
