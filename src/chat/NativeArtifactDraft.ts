import type { API, Raw } from '../api/Types';
import type { ChatArtifactLinkResolver } from './ChatArtifactLinkResolver';
import { ChatArtifactChannelPolicy } from './ChatArtifactChannelPolicy';
import { ChatArtifactToken } from './rich/ChatArtifactToken';
import type { NativeBitmapInput } from './rich/NativeBitmapInput';

/** Source insertArtifactLink: choose an allowed tab and edit the unsent composer. */
export function installNativeArtifactDraft(
  api: API,
  game: Raw,
  editor: NativeBitmapInput | undefined,
  artifacts: ChatArtifactLinkResolver,
): void {
  const chat = game.chatInput;
  if (!chat) return;
  const previous = Object.getOwnPropertyDescriptor(chat, 'insertArtifactLink');
  const log = api.cls('core.hud.components.chat.MessageLog');
  let alive = true;
  const current = () => alive && api.game === game && !game.isLeaving;
  chat.insertArtifactLink = (ownerId: string, artifact: Raw) => {
    if (!current() || !editor || !artifact?.revealed) return;
    const token = ChatArtifactToken.encode(ownerId, artifact.id);
    if (!token) return;
    const destination = ChatArtifactChannelPolicy.defaultDestination(chat.chatMode);
    if (destination !== chat.chatMode) {
      chat.chatMode = destination;
      chat.updateTab();
      chat.input.set_restrict?.(null);
      chat.rememberChatTab?.();
      chat.updateFormatControls?.();
    }
    artifacts.registerLocal(ownerId, artifact);
    // Native toggleChatMode sends on close. Only call it while closed.
    if (!chat.isActive()) chat.toggleChatMode();
    queueMicrotask(() => {
      if (!current() || !chat.isActive()) return;
      const model = editor.model;
      const begin = model.sourceSelectionBegin;
      const end = model.sourceSelectionEnd;
      let insertion = token;
      if (begin > 0 && !/\s/.test(model.text.charAt(begin - 1))) insertion = ' ' + insertion;
      if (end === model.text.length || !/\s/.test(model.text.charAt(end))) insertion += ' ';
      if (!model.replaceSelection(insertion))
        log?.write('The artifact link does not fit in the chat input.', 'error');
      editor.binding.project();
      chat.input.setFocus();
    });
  };
  api.defer(() => {
    alive = false;
    if (previous) Object.defineProperty(chat, 'insertArtifactLink', previous);
    else delete chat.insertArtifactLink;
  });
}
