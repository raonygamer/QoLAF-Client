import type { API } from '../api/Types';
import { GameReflection } from '../api/GameReflection';
import { MessageLog, type GameScene, type PressButton } from '../game/Bindings';
import type { ChatSubmission } from '../game/ChatSubmission';
import { ChatArtifactChannelPolicy } from './ChatArtifactChannelPolicy';
import type { ArtifactComposer } from './NativeArtifactDraft';
import { ChatArtifactToken } from './rich/ChatArtifactToken';

export function permitsArtifactDraft(
  chat: Pick<ChatSubmission, 'parseCommand'>,
  text: string,
): boolean {
  if (!ChatArtifactToken.containsToken(text)) return true;
  const command = chat.parseCommand(text)[0];
  return ChatArtifactChannelPolicy.allows(ChatArtifactChannelPolicy.commandChannel(command));
}

/** Preserve the source's channel policy, including calls bypassing the composer. */
export function installNativeChatArtifactPolicy(api: API, game: GameScene): void {
  const chat: ChatSubmission | null = game.chatInput;
  if (!chat) return;
  const reflection = new GameReflection(api);
  const reject = () => {
    MessageLog.write(ChatArtifactChannelPolicy.restrictionMessage, 'error');
    return false;
  };

  reflection.around(chat, 'sendMessage', function (next) {
    if (!permitsArtifactDraft(this, this.input.get_text())) return reject();
    return next();
  });

  for (const [method, destination] of [
    ['sendGlobal', 'global'],
    ['sendGroup', 'group'],
    ['sendChatMessageMod', 'modchat'],
  ] as const) {
    reflection.around(chat, method, function (next, text) {
      if (ChatArtifactToken.containsToken(text) && !ChatArtifactChannelPolicy.allows(destination)) {
        reject();
        return;
      }
      return next(text);
    });
  }
  reflection.around(chat, 'sendLocal', function (next, text, channel) {
    // Haxe routes Clan through sendLocal(body, "clan"). Private recipients
    // never select a channel; sendPrivate is already an allowed destination.
    if (
      ChatArtifactToken.containsToken(text) &&
      !ChatArtifactChannelPolicy.allows(channel ?? 'local')
    ) {
      reject();
      return;
    }
    return next(text, channel);
  });
}

/** Native send guards also need the source's draft-time channel selection. */
export function installArtifactDraftChannels(
  api: API,
  game: GameScene,
  chat: ArtifactComposer | null = game.chatInput,
  fallback: 'qolaf' | 'clan' = 'qolaf',
): void {
  const reflection = new GameReflection(api);
  if (!chat?.tabs) return;
  let alive = true;
  let selecting = false;
  let previousMode = chat.chatMode;
  const disabledTabs = new Map<PressButton, boolean>();
  const restoreTabs = () => {
    for (const [button, enabled] of disabledTabs) button.set_isEnabled(enabled);
    disabledTabs.clear();
  };
  const refreshTabs = () => {
    const hasArtifact = ChatArtifactToken.containsToken(chat.input.get_text());
    const forbidden = new Set<PressButton>(
      chat.tabs.tabs.filter(
        (_, index) =>
          hasArtifact && !ChatArtifactChannelPolicy.allows(chat.tabs.dataProvider[index]?.chatMode),
      ),
    );
    for (const [button, enabled] of disabledTabs) {
      if (!forbidden.has(button)) {
        button.set_isEnabled(enabled);
        disabledTabs.delete(button);
      }
    }
    for (const button of forbidden) {
      if (!disabledTabs.has(button)) disabledTabs.set(button, button.get_isEnabled());
      button.set_isEnabled(false);
    }
  };
  const current = () => alive && api.game === game && !game.get_isLeaving();
  const select = (mode: string) => {
    selecting = true;
    // Native updateTab focuses even a hidden composer. A pasted/restored draft
    // may change its channel without opening it or taking keyboard ownership.
    const restoreFocus = !chat.isActive()
      ? reflection.around(chat.input, 'setFocus', () => {})
      : undefined;
    try {
      chat.chatMode = mode;
      chat.updateTab();
      chat.input.set_restrict(null);
      chat.rememberChatTab?.();
      chat.updateFormatControls?.();
      previousMode = chat.chatMode;
    } finally {
      restoreFocus?.();
      selecting = false;
    }
  };
  const refreshDraft = () => {
    if (!current() || selecting) return;
    refreshTabs();
    if (
      ChatArtifactToken.containsToken(chat.input.get_text()) &&
      !ChatArtifactChannelPolicy.allows(chat.chatMode)
    )
      select(fallback);
    else previousMode = chat.chatMode;
  };
  const channelChanged = () => {
    if (!current() || selecting) return;
    refreshTabs();
    if (
      ChatArtifactToken.containsToken(chat.input.get_text()) &&
      !ChatArtifactChannelPolicy.allows(chat.chatMode)
    ) {
      select(ChatArtifactChannelPolicy.allows(previousMode) ? previousMode : fallback);
    } else previousMode = chat.chatMode;
  };
  reflection.after(chat.tabs, 'rebuild', () => {
    if (current()) refreshTabs();
  });
  // Haxe assignments (history, successful sends, restored drafts) do not emit change.
  reflection.after(chat.input, 'set_text', refreshDraft);
  chat.input.addEventListener('change', refreshDraft);
  chat.tabs.addEventListener('change', channelChanged);
  api.defer(() => {
    alive = false;
    restoreTabs();
    chat.input.removeEventListener('change', refreshDraft);
    chat.tabs.removeEventListener('change', channelChanged);
  });
  refreshDraft();
}
