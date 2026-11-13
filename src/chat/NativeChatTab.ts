import type { API } from '../api/Types';
import { GameReflection } from '../api/GameReflection';
import { SceneBase, type ChatInputText, type GameScene } from '../game/Bindings';
import type { DeviceSettings } from '../settings/DeviceSettings';

interface PersistentComposer extends ChatInputText {
  floatingContext?: object | null;
  rememberChatTab?: () => void;
}

/** Keep the main composer's channel and recipient across room changes and logins. */
export function installNativeChatTab(
  api: API,
  game: GameScene,
  preferences?: DeviceSettings,
): void {
  const chat: PersistentComposer | null = game.chatInput;
  if (!chat?.tabs || !preferences) return;
  const reflection = new GameReflection(api);
  let alive = true;
  let restoring = false;
  const enabled = () =>
    alive &&
    api.game === game &&
    !game.get_isLeaving() &&
    chat.floatingContext == null &&
    preferences.get('enableNewChatIntegrationSystem');
  const remember = () => {
    if (!restoring && enabled())
      SceneBase.clientSettings?.setAdvancedChatTab(chat.chatMode, chat.savedPrivateTarget ?? '');
  };
  const descriptor = Object.getOwnPropertyDescriptor(chat, 'rememberChatTab');
  Object.defineProperty(chat, 'rememberChatTab', {
    configurable: true,
    writable: true,
    value: remember,
  });
  // Native change listeners are bound before installation. Listen on the tabs
  // themselves so mouse selections and cached Haxe callbacks are both covered.
  chat.tabs.addEventListener('change', remember);
  reflection.after(chat, 'updateTab', remember);
  reflection.after(chat, 'sendPrivate', remember);
  api.defer(() => {
    alive = false;
    chat.tabs.removeEventListener('change', remember);
    if (chat.rememberChatTab === remember) {
      if (descriptor) Object.defineProperty(chat, 'rememberChatTab', descriptor);
      else delete chat.rememberChatTab;
    }
  });

  if (!enabled() || !SceneBase.clientSettings) return;
  // Unsafe enabling while composing must preserve the current draft destination.
  if (chat.isActive()) {
    remember();
    return;
  }
  const saved = SceneBase.clientSettings.advancedChatTab;
  restoring = true;
  // Native onTabChange always focuses the DOM input, even when hidden.
  const restoreFocus = reflection.around(chat.input, 'setFocus', () => {});
  try {
    if (saved.mode === 'privateSaved') {
      chat.savedPrivateTarget = saved.privateTarget;
      const tabs = chat.tabs.dataProvider.slice();
      const entry = { label: saved.privateTarget, chatMode: 'privateSaved' };
      const index = tabs.findIndex((tab) => tab.chatMode === 'privateSaved');
      if (index < 0) tabs.push(entry);
      else tabs[index] = entry;
      chat.tabs.set_dataProvider(tabs);
    }
    chat.chatMode = chat.tabs.dataProvider.some((tab) => tab.chatMode === saved.mode)
      ? saved.mode
      : 'local';
    chat.updateTab();
  } finally {
    restoreFocus();
    restoring = false;
  }
}
