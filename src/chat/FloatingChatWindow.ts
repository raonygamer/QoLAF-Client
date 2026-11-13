import { installArtifactDraftChannels } from './NativeChatArtifactPolicy';
import { Player, MessageLog, type GameScene } from '../game/Bindings';
import { read, type API, type Raw } from '../api/Types';
import { APIScope } from '../api/APIScope';
import type { Resolve } from '../runtime/HaxeInterop';
import type { DeviceSettings } from '../settings/DeviceSettings';
import type { ServiceConnectionPool } from '../service/ServiceConnectionPool';
import type { ChatImageCache } from './ChatImageCache';
import { ChatArtifactLinkResolver } from './ChatArtifactLinkResolver';
import { ChatArtifactTokenRegistry } from './rich/ChatArtifactTokenRegistry';
import { FloatingChatConnection } from './FloatingChatConnection';
import { FloatingChatModel } from './FloatingChatModel';
import { FloatingChatLayout } from './FloatingChatLayout';
import { FloatingChatComposer } from './FloatingChatComposer';
import { FloatingChatView } from './FloatingChatView';
import { createFloatingChatFormatter } from './FloatingChatPresentation';
import { createChatComposerFormatButton } from '../ported/ChatComposerFormatButton';
import { installNativeRichChatInput } from './NativeRichChatInput';
import { installNativeChatFormatting } from './NativeChatFormatting';
import { installNativeChatTheme } from './NativeChatTheme';
import { installCommandAutocomplete } from './ChatCommandAutocompletePopup';
import { ChatCommandSuggestion } from './ChatCommandSuggestion';

export function createFloatingChatWindow(resolve: Resolve) {
  const Sprite = resolve('starling.display.Sprite');
  const Quad = resolve('starling.display.Quad');
  const TextField = resolve('starling.text.TextField');
  const TextFormat = resolve('starling.text.TextFormat');
  const Fonts = resolve('core.text.VerdanaBitmapFontRegistry');
  const Button = createChatComposerFormatButton(resolve);

  return class FloatingChatWindow extends Sprite {
    readonly transport: FloatingChatConnection;
    readonly model: FloatingChatModel;
    readonly geometry: FloatingChatLayout;
    private readonly scope: APIScope;
    private readonly view: FloatingChatView;
    private readonly composer: FloatingChatComposer;
    private readonly artifacts: ChatArtifactLinkResolver;
    private readonly border = new Quad(1, 1, 0x596273);
    private readonly background = new Quad(1, 1, 0x0b0d12);
    private readonly titleBar = new Quad(1, 34, 0x20252d);
    private readonly title: Raw;
    private readonly state: Raw;
    private readonly closeButton = new Button(26, 24, 'X');
    private readonly reconnectButton = new Button(78, 24, 'Reconnect');
    private readonly grip = new Sprite();
    private listenerStage: Raw | null = null;
    private drag: {
      id: number;
      mode: string;
      x: number;
      y: number;
      startX: number;
      startY: number;
      width: number;
      height: number;
    } | null = null;
    private disposed = false;

    constructor(
      owner: API,
      game: GameScene,
      readonly serviceId: string,
      pool: ServiceConnectionPool,
      images: ChatImageCache,
      windowCount: number,
      private readonly closed: () => void,
      preferences?: DeviceSettings,
    ) {
      super();
      this.scope = new APIScope(owner);
      const api = this.scope.api;
      this.geometry = new FloatingChatLayout(windowCount);
      this.background.alpha = 0.96;
      for (const child of [this.border, this.background, this.titleBar]) this.addChild(child);
      this.title = this.label(serviceId, 13, 0xffdf89);
      this.state = this.label('Connecting...', 10, 0xaac0d4);
      for (const child of [this.title, this.state, this.closeButton, this.reconnectButton])
        this.addChild(child);
      this.closeButton.addEventListener('triggered', this.close);
      this.reconnectButton.addEventListener('triggered', this.reconnect);
      const Artifact = api.cls('core.artifact.Artifact') as any;
      this.artifacts = new ChatArtifactLinkResolver(
        game,
        (record) => new Artifact(record),
        (text) => api.cls('generics.Localize')!.t(text),
        () => performance.now(),
        new ChatArtifactTokenRegistry(),
      );
      this.model = new FloatingChatModel({
        playerId: () => game.get_me()?.id ?? '',
        canModerate: () => {
          const player = game.get_me();
          return !!(player?.isModerator || player?.isDeveloper);
        },
        knownPlayerNames: () => [
          ...(game.playerManager?.get_players() ?? []).map((player) => player.get_name()),
          ...(Player.onlineFriends ?? []).map((friend) => friend?.name ?? ''),
        ],
        maxLines: () => MessageLog.extendedMaxLines,
        formatRow: createFloatingChatFormatter(api, game),
        append: (row) => {
          this.artifacts.resolveText(row.text);
          this.view.append(row);
        },
        clear: () => this.view.clear(),
        selectChannel: (mode, target) => this.composer.selectChannel(mode, target ?? ''),
        send: (mode, body, target) => this.transport.send(mode, body, target),
      });
      this.view = new FloatingChatView(
        api,
        game,
        resolve,
        () => this.model.messages,
        this.artifacts,
        images,
        preferences,
      );
      this.addChild(this.view.node);
      this.composer = new FloatingChatComposer(
        api,
        game,
        this.geometry.width - 16,
        (text, mode, target) => this.model.send(text, mode, target),
      );
      this.addChild(this.composer.node);
      const context = Object.create(game);
      context.chatInput = this.composer.node;
      // Source floating composers keep artifact drafts in their chosen Service.
      // Install before the rich input's channel restriction listener.
      installArtifactDraftChannels(api, game, this.composer.node, 'clan');
      const integratedPreferences =
        preferences &&
        Object.assign(Object.create(preferences), {
          get: (key: Parameters<DeviceSettings['get']>[0]) =>
            key === 'enableNewChatIntegrationSystem' ? true : preferences.get(key),
        });
      const editor = installNativeRichChatInput(
        api,
        context,
        resolve,
        integratedPreferences,
        this.artifacts,
      );
      installNativeChatTheme(api, context, integratedPreferences);
      if (editor) {
        const formatting = installNativeChatFormatting(
          api,
          context,
          editor,
          resolve,
          integratedPreferences,
          images,
        );
        const suggestions = [
          new ChatCommandSuggestion('local', ' [message]', 'Local chat in this Service'),
          new ChatCommandSuggestion('global', ' [message]', 'Global chat'),
          new ChatCommandSuggestion('clan', ' [message]', 'Clan chat'),
          new ChatCommandSuggestion('group', ' [message]', 'Group chat'),
          new ChatCommandSuggestion('w', ' @Player message', 'Private message'),
          new ChatCommandSuggestion('r', ' message', 'Reply to the last private message'),
        ];
        if (read(game, 'me')?.isModerator || read(game, 'me')?.isDeveloper)
          suggestions.push(new ChatCommandSuggestion('modchat', ' [message]', 'Moderator chat'));
        const autocomplete = installCommandAutocomplete(
          api,
          context,
          () => formatting.isOpen,
          { editor, resolve, preferences: integratedPreferences },
          suggestions,
        );
        this.composer.dismissPopups = () => {
          formatting.close();
          autocomplete?.close();
        };
      }
      this.transport = new FloatingChatConnection(
        game,
        serviceId,
        pool,
        () => {
          const manager = api.cls('core.player.PlayerManager');
          return { minutes: manager?.banMinutes ?? 0, allChannels: !!manager?.isAllChannels };
        },
        (message) => this.model.receive(message),
        (text, error) => this.model.status(text, error),
        this.connectionChanged,
      );
      const hit = new Quad(20, 20, 0x596273);
      hit.alpha = 0.5;
      this.grip.addChild(hit);
      for (let n = 0; n < 3; n++) {
        const line = new Quad(3 + n * 4, 1, 0xc3cbd6);
        line.x = 16 - line.width;
        line.y = 8 + n * 4;
        this.grip.addChild(line);
      }
      this.addChild(this.grip);
      this.addEventListener('addedToStage', this.added);
      this.addEventListener('touch', this.touch);
      this.layout();
    }

    private label(text: string, size: number, color: number): Raw {
      const label = new TextField(
        200,
        34,
        text,
        new TextFormat(Fonts.fontNameForSize(size), size, color, 'left', 'center'),
      );
      label.touchable = false;
      label.wordWrap = false;
      return label;
    }

    bringToFront(): void {
      if (this.parent) this.parent.setChildIndex(this, this.parent.numChildren - 1);
    }
    private readonly added = () => {
      this.listenerStage?.removeEventListener('resize', this.constrain);
      this.listenerStage = this.stage;
      this.listenerStage?.addEventListener('resize', this.constrain);
      this.constrain();
    };
    private readonly constrain = () => {
      if (this.stage) this.geometry.constrain(this.stage.stageWidth, this.stage.stageHeight);
      this.layout();
    };
    private layout(): void {
      const g = this.geometry;
      const content = g.content(this.composer.height);
      this.x = g.x;
      this.y = g.y;
      this.border.width = g.width;
      this.border.height = g.height;
      this.background.x = this.background.y = 1;
      this.background.width = Math.max(1, g.width - 2);
      this.background.height = Math.max(1, g.height - 2);
      this.titleBar.x = this.titleBar.y = 1;
      this.titleBar.width = Math.max(1, g.width - 2);
      this.title.x = 8;
      this.title.width = content.titleWidth;
      this.closeButton.set_x(content.closeX);
      this.closeButton.set_y(5);
      this.reconnectButton.set_y(5);
      this.reconnectButton.set_x(content.reconnectX);
      this.state.x = content.stateX;
      this.state.width = 103;
      this.view.node.set_x(content.viewX);
      this.view.node.set_y(content.viewY);
      this.view.resize(content.viewWidth, content.viewHeight);
      this.composer.node.set_x(content.composerX);
      this.composer.node.set_y(content.composerY);
      this.composer.resize(content.viewWidth);
      this.grip.x = content.gripX;
      this.grip.y = content.gripY;
    }
    private readonly touch = (event: Raw) => {
      const touch = event.getTouch(this);
      if (!touch) return;
      if (touch.phase === 'began') {
        this.bringToFront();
        const mode = event.getTouch(this.grip, 'began')
          ? 'resize'
          : event.getTouch(this.titleBar, 'began')
            ? 'move'
            : null;
        if (!mode) return;
        const point = touch.getLocation(this.parent);
        this.drag = {
          id: touch.id,
          mode,
          x: point.x,
          y: point.y,
          startX: this.geometry.x,
          startY: this.geometry.y,
          width: this.geometry.width,
          height: this.geometry.height,
        };
      } else if (this.drag && this.drag.id === touch.id && touch.phase === 'moved') {
        const point = touch.getLocation(this.parent),
          drag = this.drag;
        if (drag.mode === 'move') {
          this.geometry.x = drag.startX + point.x - drag.x;
          this.geometry.y = drag.startY + point.y - drag.y;
        } else {
          this.geometry.width = Math.max(360, drag.width + point.x - drag.x);
          this.geometry.height = Math.max(240, drag.height + point.y - drag.y);
        }
        this.constrain();
      } else if (this.drag?.id === touch.id && touch.phase === 'ended') this.drag = null;
    };
    private readonly connectionChanged = () => {
      if (this.disposed) return;
      this.state.text = this.transport.connected
        ? 'Connected'
        : this.transport.connecting
          ? 'Connecting...'
          : 'Disconnected';
      this.reconnectButton.enabled = !this.transport.connected && !this.transport.connecting;
    };
    private readonly reconnect = () => this.transport.open();
    readonly close = () => {
      if (!this.disposed) this.removeFromParent(true);
    };
    dispose(): void {
      if (this.disposed) return;
      this.disposed = true;
      this.listenerStage?.removeEventListener('resize', this.constrain);
      this.listenerStage = null;
      this.removeEventListener('touch', this.touch);
      this.removeEventListener('addedToStage', this.added);
      this.transport.dispose();
      this.model.dispose();
      this.scope.dispose();
      this.artifacts.dispose();
      this.closed();
      super.dispose();
    }
  };
}
