import { read, type API, type Raw } from '../api/Types';
import { portedClasses } from '../ported/Registry';
import { ChatArtifactToken } from '../chat/rich/ChatArtifactToken';
import type { ChatArtifactLinkResolver } from '../chat/ChatArtifactLinkResolver';
import { installNativeArtifactDraft } from '../chat/NativeArtifactDraft';
import type { NativeBitmapInput } from '../chat/rich/NativeBitmapInput';
import { installPopupKeyboard } from '../dialogs/NativePopupKeyboard';
import { installNativeCargoQueue } from './CargoReadQueue';
import { createInspectTabs } from './InspectTabs';
import { createPlayerInspectViewModel } from './PlayerInspectViewModel';
import { createPlayerInspectProjection } from './PlayerInspectProjection';
import { createPlayerInspectCard } from './PlayerInspectCard';
import { createPlayerInspectPopup } from './PlayerInspectPopup';

/** Session-owned read-only inspector, using the authenticated account's normal APIs. */
export function installNativePlayerInspect(
  api: API,
  game: Raw,
  editor: NativeBitmapInput | undefined,
  artifacts: ChatArtifactLinkResolver,
): void {
  const chat = game.chatInput;
  if (!chat) return;
  const nativeResolve = portedClasses(api).resolve;
  const log = api.cls('core.hud.components.chat.MessageLog');
  const queue = installNativeCargoQueue(api, game);
  const cache: Record<string, any> = {
    'core.hud.components.chat.ChatArtifactToken': ChatArtifactToken,
    'core.hud.components.cargo.CargoReadQueue': {
      read(
        owner: Raw,
        id: string,
        callback: (value: Raw) => void,
        onError: (reason: string) => void,
      ) {
        if (owner !== game) {
          onError("The cargo request's room is no longer active.");
          return;
        }
        queue.enqueue([id, 'Commodities'], callback, onError);
      },
    },
    'feathers.data.ListCollection': class ListCollection extends Array {
      constructor(items: any[]) {
        super(...items);
      }
    },
    'openfl.system.System': {
      setClipboard(value: string) {
        void navigator.clipboard
          .writeText(value)
          .catch(() => log?.write('Unable to copy player ID.', 'error'));
      },
    },
  };
  const resolve = (name: string): any => {
    if (cache[name]) return cache[name];
    switch (name) {
      case 'af.PlayerInspectViewModel':
        return (cache[name] = createPlayerInspectViewModel(resolve));
      case 'af.PlayerInspectProjection':
        return (cache[name] = createPlayerInspectProjection(resolve));
      case 'qolaf.inspect.PlayerInspectCard':
        return (cache[name] = createPlayerInspectCard(resolve));
      case 'feathers.controls.TabBar':
        return (cache[name] = createInspectTabs(resolve));
      case 'feathers.controls.ScrollContainer':
        return nativeResolve('core.hud.components.ui.ScrollBox');
      default:
        return nativeResolve(name);
    }
  };
  let Popup: any;
  const open = (argument: string) => {
    if (!Popup) Popup = createPlayerInspectPopup(resolve);
    Popup.open(game, argument);
  };
  const previousOpen = Object.getOwnPropertyDescriptor(chat, 'openPlayerInspect');
  chat.openPlayerInspect = open;
  installNativeArtifactDraft(api, game, editor, artifacts);
  api.around(chat, 'sendMessage', (next, ...args) => {
    const value = chat.input.get_text();
    const [command, argument = ''] = value.startsWith('/') ? chat.parseCommand(value) : [];
    if (command !== 'inspect') return next(...args);
    open(argument);
    chat.input.set_text('');
    chat.updateTab();
  });
  api.cls('af.ChatCommandRegistry')?.reserveBuiltInCommands(['inspect']);
  api.defer(
    installPopupKeyboard(
      window,
      () => !!Popup?.isOpen(),
      () => Popup?.dismissActive(),
    ),
  );
  api.defer(() => {
    Popup?.dismissActive();
    if (previousOpen) Object.defineProperty(chat, 'openPlayerInspect', previousOpen);
    else delete chat.openPlayerInspect;
  });
}
