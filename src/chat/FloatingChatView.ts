import { read, type API, type Raw } from '../api/Types';
import { APIScope } from '../api/APIScope';
import type { Resolve } from '../runtime/HaxeInterop';
import type { DeviceSettings } from '../settings/DeviceSettings';
import type { ChatImageCache } from './ChatImageCache';
import type { ChatArtifactLinkResolver } from './ChatArtifactLinkResolver';
import { installNativeAdvancedChat } from './NativeAdvancedChat';
import { installNativeChatMessages } from './NativeChatMessages';
import type { Game } from '../game/Game';
import { ChatRows } from './ChatRows';
import { installNativeChatContext } from './NativeChatContext';
import { installNativeChatImageViewer } from './NativeChatImageViewer';
import { installNativeChatArtifactPreview } from './NativeChatArtifactPreview';
import { installNativeChatRolePreview } from './NativeChatRolePreview';
import { installNativeChatPingPreview } from './NativeChatPingPreview';

/** An independent native Advanced view using the shared source bitmap renderers. */
export class FloatingChatView {
  readonly node: Raw;
  readonly advanced: Game.core.hud.components.chat.ChatAdvanced & { clearMessages(): void };
  private readonly scope: APIScope;
  private readonly simple: Raw;
  private disposed = false;

  constructor(
    owner: API,
    game: Raw,
    resolve: Resolve,
    getQueue: () => Raw[],
    artifacts: ChatArtifactLinkResolver,
    images: ChatImageCache,
    preferences?: DeviceSettings,
  ) {
    this.scope = new APIScope(owner);
    const api = this.scope.api;
    const Sprite = resolve('starling.display.Sprite');
    const Advanced = api.cls('core.hud.components.chat.ChatAdvanced') as any;
    const Simple = api.cls('core.hud.components.chat.ChatSimple') as any;
    this.node = new Sprite();
    const log = this.node;
    // Read live scene data through the original game. Only message ownership is
    // replaced: native Advanced never sees the primary queue or its actions.
    const context = Object.create(game);
    context.messageLog = log;
    log.getQueue = getQueue;
    log.isMuted = (channel: string) => !!game.messageLog?.isMuted(channel);
    this.advanced = log.advanced = new Advanced(context);
    log.updateTexts = (row: Raw) => this.advanced.updateText(row);
    // Shared message/hover adapters also support Simple chat. Keep their native
    // companion detached; it never joins the floating window display tree.
    this.simple = log.simple = new Simple(context);
    log.addChild(this.advanced);
    const messages = installNativeChatMessages(
      api,
      context,
      resolve,
      preferences,
      images,
      artifacts,
    );
    installNativeAdvancedChat(api, context);
    api.defer(
      ChatRows.install(api, this.advanced, () => log.getQueue()).subscribe(({ node }) => {
        const scroll = this.advanced.scroll;
        node.set_width(read(scroll, 'width'));
        scroll.arrange();
      }),
    );
    installNativeChatContext(api, context, resolve, {});
    if (messages) {
      installNativeChatImageViewer(api, context, resolve, images, messages);
      installNativeChatArtifactPreview(api, context, resolve, messages, artifacts);
      installNativeChatRolePreview(api, context, resolve, messages);
      installNativeChatPingPreview(api, context, resolve, messages);
    }
    owner.defer(() => this.dispose());
  }

  append(row: Raw): void {
    if (!this.disposed) this.node.updateTexts(row);
  }

  clear(): void {
    if (!this.disposed) this.advanced.clearMessages();
  }

  resize(width: number, height: number): void {
    if (this.disposed) return;
    const scroll = this.advanced.scroll;
    const position = read(scroll, 'verticalScrollPosition', 0);
    const follow = position >= read(scroll, 'maxVerticalScrollPosition', 0) - 2;
    const background = this.advanced.scrollView.getChildAt(0);
    background.set_width(Math.max(1, width));
    background.set_height(Math.max(1, height));
    scroll.set_x(10);
    scroll.set_y(10);
    scroll.set_width(Math.max(1, width - 10));
    scroll.set_height(Math.max(1, height - 10));
    for (let i = 0; i < read(scroll, 'numChildren', 0); i++) {
      const row = scroll.getChildAt(i);
      if (row !== this.advanced.playerChatOptions) row.set_width(Math.max(1, width - 10));
    }
    scroll.arrange();
    scroll.scrollToPosition(0, follow ? read(scroll, 'maxVerticalScrollPosition', 0) : position);
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.scope.dispose();
    this.node.removeFromParent(true);
    this.simple.dispose();
  }
}
