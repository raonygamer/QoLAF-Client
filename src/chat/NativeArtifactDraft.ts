import { MessageLog, type Artifact, type ChatInputText, type GameScene } from '../game/Bindings';
import type { API } from '../api/Types';
import type { ChatArtifactLinkResolver } from './ChatArtifactLinkResolver';
import { ChatArtifactChannelPolicy } from './ChatArtifactChannelPolicy';
import { ChatArtifactToken } from './rich/ChatArtifactToken';
import type { NativeBitmapInput } from './rich/NativeBitmapInput';

export interface ArtifactComposer extends ChatInputText {
  insertArtifactLink?: (ownerId: string, artifact: Artifact) => void;
  rememberChatTab?(): void;
  updateFormatControls?(): void;
}

/** Source insertArtifactLink: choose an allowed tab and edit the unsent composer. */
export function installNativeArtifactDraft(
  api: API,
  game: GameScene,
  editor: NativeBitmapInput | undefined,
  artifacts: ChatArtifactLinkResolver,
  closeAutocomplete: () => void = () => {},
): void {
  const chat: ArtifactComposer | null = game.chatInput;
  if (!chat) return;
  const previous = Object.getOwnPropertyDescriptor(chat, 'insertArtifactLink');
  let alive = true;
  const current = () =>
    alive && api.game === game && game.chatInput === chat && !game.get_isLeaving();
  const insertArtifactLink = (ownerId: string, artifact: Artifact) => {
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
        MessageLog.write('The artifact link does not fit in the chat input.', 'error');
      editor.binding.project();
      closeAutocomplete();
      chat.input.setFocus();
    });
  };
  chat.insertArtifactLink = insertArtifactLink;
  api.defer(() => {
    alive = false;
    if (chat.insertArtifactLink !== insertArtifactLink) return;
    if (previous) Object.defineProperty(chat, 'insertArtifactLink', previous);
    else delete chat.insertArtifactLink;
  });
}
