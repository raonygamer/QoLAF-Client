// Source port of core/hud/components/chat/ChatImageViewerWindow.as.
import { bound, type Resolve } from '../runtime/HaxeInterop';
import type { Raw } from '../api/Types';
import type { ChatImageCache } from '../chat/ChatImageCache';
import type { ChatImageAsset } from '../chat/ChatImageAsset';
import type { ChatDiscordImageLink } from '../chat/ChatDiscordImageLink';

export function createChatImageViewerWindow(
  resolve: Resolve,
  cache: ChatImageCache,
  getTimer: () => number = () => performance.now(),
) {
  type Game = Raw;
  const VerdanaBitmapFontRegistry = resolve('core.text.VerdanaBitmapFontRegistry');
  type VerdanaBitmapFontRegistry = Raw;
  const Point = resolve('openfl.geom.Point');
  type Point = Raw;
  const ChatComposerFormatButton = resolve('core.hud.components.chat.ChatComposerFormatButton');
  type ChatComposerFormatButton = Raw;
  const Image = resolve('starling.display.Image');
  type Image = Raw;
  const Quad = resolve('starling.display.Quad');
  type Quad = Raw;
  const Sprite = resolve('starling.display.Sprite');
  type Sprite = Raw;
  const Stage = resolve('starling.display.Stage');
  type Stage = Raw;
  const Event = resolve('starling.events.Event');
  type Event = Raw;
  const Touch = resolve('starling.events.Touch');
  type Touch = Raw;
  const TouchEvent = resolve('starling.events.TouchEvent');
  type TouchEvent = Raw;
  const TouchPhase = resolve('starling.events.TouchPhase');
  type TouchPhase = Raw;
  const TextField = resolve('starling.text.TextField');
  type TextField = Raw;
  const TextFormat = resolve('starling.text.TextFormat');
  type TextFormat = Raw;
  /** Movable/resizable in-client viewer for one validated remote image. */

  class ChatImageViewerWindow extends Sprite {
    static closeForOwner(owner: Game): void {
      for (const window of [...ChatImageViewerWindow.windows]) {
        if (window.game === owner) window.removeFromParent(true);
      }
    }
    private static windows: ChatImageViewerWindow[] = [];
    private static TITLE_HEIGHT: number = 34;
    private static PADDING: number = 8;
    private static MIN_WIDTH: number = 320;
    private static MIN_HEIGHT: number = 220;
    private static DEFAULT_WIDTH: number = 700;
    private static DEFAULT_HEIGHT: number = 520;

    private game: Game | null;
    private link: ChatDiscordImageLink | null = null;
    private border: Quad = new Quad(1, 1, 0x596273);
    private background: Quad = new Quad(1, 1, 0x0b0d12);
    private titleBar: Quad = new Quad(1, ChatImageViewerWindow.TITLE_HEIGHT, 0x20252d);
    private title: TextField;
    private status: TextField;
    private closeButton: ChatComposerFormatButton;
    private grip: Sprite = new Sprite();
    private image: Image | null = null;
    private asset: ChatImageAsset | null = null;
    private animationFrame: number = 0;
    private nextFrameAt: number = 0;
    private listenerStage: Stage | null = null;
    private panelWidth: number = ChatImageViewerWindow.DEFAULT_WIDTH;
    private panelHeight: number = ChatImageViewerWindow.DEFAULT_HEIGHT;
    private sourceWidth: number = 0;
    private sourceHeight: number = 0;
    private dragMode: string | null = null;
    private pointerId: number = -1;
    private pointerStart: Point = new Point();
    private startX: number = 0;
    private startY: number = 0;
    private startWidth: number = 0;
    private startHeight: number = 0;
    private disposed: boolean = false;

    @bound
    public static open(owner: Game, imageLink: ChatDiscordImageLink): void {
      if (owner == null || owner.isLeaving || owner.stage == null || imageLink == null) {
        return;
      }
      for (const current of ChatImageViewerWindow.windows) {
        if (
          current.game === owner &&
          current.link != null &&
          current.link.rawURL == imageLink.rawURL
        ) {
          current.bringToFront();
          return;
        }
      }
      let window: ChatImageViewerWindow = new ChatImageViewerWindow(owner, imageLink);
      ChatImageViewerWindow.windows.push(window);
      owner.addChildToOverlay(window);
    }

    constructor(owner: Game, imageLink: ChatDiscordImageLink) {
      super();
      this.game = owner;
      this.link = imageLink;
      this.background.alpha = 0.98;
      this.addChild(this.border);
      this.addChild(this.background);

      this.titleBar.touchable = true;
      this.addChild(this.titleBar);
      this.title = this.label(imageLink.fileName, 12, 0xffdf89, 'left');
      this.addChild(this.title);
      this.status = this.label('Loading image...', 12, 0xb9c4d2, 'center');
      this.status.touchable = false;
      this.addChild(this.status);

      this.closeButton = new ChatComposerFormatButton(26, 24, 'X');
      this.closeButton.addEventListener(Event.TRIGGERED, this.onClose);
      this.addChild(this.closeButton);

      let gripHit: Quad = new Quad(20, 20, 0x596273);
      gripHit.alpha = 0.5;
      this.grip.addChild(gripHit);
      for (let n: number = 0; n < 3; n++) {
        let line: Quad = new Quad(3 + n * 4, 1, 0xc3cbd6);
        line.x = 16 - line.width;
        line.y = 8 + n * 4;
        this.grip.addChild(line);
      }
      this.addChild(this.grip);

      this.x = 92 + (ChatImageViewerWindow.windows.length % 6) * 28;
      this.y = 76 + (ChatImageViewerWindow.windows.length % 6) * 28;
      this.addEventListener(Event.ADDED_TO_STAGE, this.onAdded);
      this.addEventListener(TouchEvent.TOUCH, this.onTouch);
      this.layout();
      this.loadImage();
    }

    @bound
    private loadImage(): void {
      this.status.text = 'Loading image...';
      this.status.visible = true;
      cache.acquire(
        this.link!,
        (loaded: ChatImageAsset): void => {
          if (this.disposed) {
            cache.release(loaded);
            return;
          }
          if (loaded == null || loaded.frames == null || loaded.frames.length == 0) {
            if (loaded != null) cache.release(loaded);
            this.status.text = '[Image unavailable]';
            this.status.visible = true;
            return;
          }
          this.asset = loaded;
          this.sourceWidth = this.asset.width;
          this.sourceHeight = this.asset.height;
          this.image = new Image(this.asset.frames[0]);
          this.image!.touchable = false;
          this.addChildAt(this.image, 2);
          this.title.text =
            this.link!.fileName + '  •  ' + this.asset.width + 'x' + this.asset.height;
          this.status.visible = false;
          this.animationFrame = 0;
          if (this.asset.animated) {
            this.nextFrameAt = getTimer() + this.asset.delayAt(0);
            this.addEventListener(Event.ENTER_FRAME, this.onAnimationFrame);
          }
          this.layoutImage();
        },
        (reason: string): void => {
          if (this.disposed) return;
          this.status.text = '[Image unavailable]';
          this.status.visible = true;
        },
      );
    }

    @bound
    private onAnimationFrame(event: Event): void {
      if (this.asset == null || !this.asset.animated || this.image == null) return;
      let now: number = getTimer();
      let guard: number = 0;
      while (now >= this.nextFrameAt && guard++ < this.asset.frames.length + 1) {
        this.animationFrame = (this.animationFrame + 1) % this.asset.frames.length;
        this.image.texture = this.asset.frames[this.animationFrame];
        this.nextFrameAt += this.asset.delayAt(this.animationFrame);
      }
    }

    @bound
    private onAdded(event: Event): void {
      this.listenerStage = this.stage;
      this.listenerStage!.addEventListener(Event.RESIZE, this.onResize);
      this.constrain();
      this.bringToFront();
    }

    @bound
    private onResize(event: Event): void {
      this.constrain();
    }

    @bound
    private constrain(): void {
      if (this.stage != null) {
        this.panelWidth = Math.max(
          Math.min(ChatImageViewerWindow.MIN_WIDTH, this.stage.stageWidth),
          Math.min(this.panelWidth, this.stage.stageWidth),
        );
        this.panelHeight = Math.max(
          Math.min(ChatImageViewerWindow.MIN_HEIGHT, this.stage.stageHeight),
          Math.min(this.panelHeight, this.stage.stageHeight),
        );
        this.x = Math.max(0, Math.min(this.x, this.stage.stageWidth - this.panelWidth));
        this.y = Math.max(0, Math.min(this.y, this.stage.stageHeight - this.panelHeight));
      }
      this.layout();
    }

    @bound
    private layout(): void {
      this.border.width = this.panelWidth;
      this.border.height = this.panelHeight;
      this.background.x = this.background.y = 1;
      this.background.width = Math.max(1, this.panelWidth - 2);
      this.background.height = Math.max(1, this.panelHeight - 2);
      this.titleBar.x = this.titleBar.y = 1;
      this.titleBar.width = Math.max(1, this.panelWidth - 2);
      this.title.x = ChatImageViewerWindow.PADDING;
      this.title.y = 0;
      this.title.width = Math.max(1, this.panelWidth - 50);
      this.title.height = ChatImageViewerWindow.TITLE_HEIGHT;
      this.closeButton.x = this.panelWidth - 32;
      this.closeButton.y = 5;
      this.status.x = ChatImageViewerWindow.PADDING;
      this.status.y = ChatImageViewerWindow.TITLE_HEIGHT + ChatImageViewerWindow.PADDING;
      this.status.width = Math.max(1, this.panelWidth - ChatImageViewerWindow.PADDING * 2);
      this.status.height = Math.max(
        1,
        this.panelHeight - ChatImageViewerWindow.TITLE_HEIGHT - ChatImageViewerWindow.PADDING * 2,
      );
      this.grip.x = this.panelWidth - 21;
      this.grip.y = this.panelHeight - 21;
      this.layoutImage();
    }

    @bound
    private layoutImage(): void {
      if (this.image == null || this.sourceWidth <= 0 || this.sourceHeight <= 0) {
        return;
      }
      let contentX: number = ChatImageViewerWindow.PADDING;
      let contentY: number = ChatImageViewerWindow.TITLE_HEIGHT + ChatImageViewerWindow.PADDING;
      let contentWidth: number = Math.max(1, this.panelWidth - ChatImageViewerWindow.PADDING * 2);
      let contentHeight: number = Math.max(
        1,
        this.panelHeight - ChatImageViewerWindow.TITLE_HEIGHT - ChatImageViewerWindow.PADDING * 2,
      );
      this.image.scaleX = this.image.scaleY = 1;
      let scale: number = Math.min(
        contentWidth / this.sourceWidth,
        contentHeight / this.sourceHeight,
        1,
      );
      this.image.scaleX = this.image.scaleY = scale;
      this.image.x = contentX + Math.round((contentWidth - this.image.width) / 2);
      this.image.y = contentY + Math.round((contentHeight - this.image.height) / 2);
    }

    @bound
    private bringToFront(): void {
      if (this.parent != null) {
        this.parent.setChildIndex(this, this.parent.numChildren - 1);
      }
    }

    @bound
    private onTouch(event: TouchEvent): void {
      let touch: Touch = event.getTouch(this);
      if (touch == null) return;
      if (touch.phase == TouchPhase.BEGAN) {
        this.bringToFront();
        if (event.getTouch(this.grip, TouchPhase.BEGAN) != null) {
          this.dragMode = 'resize';
        } else if (event.getTouch(this.titleBar, TouchPhase.BEGAN) != null) {
          this.dragMode = 'move';
        } else {
          return;
        }
        this.pointerId = touch.id;
        touch.getLocation(this.parent, this.pointerStart);
        this.startX = this.x;
        this.startY = this.y;
        this.startWidth = this.panelWidth;
        this.startHeight = this.panelHeight;
      } else if (
        touch.id == this.pointerId &&
        touch.phase == TouchPhase.MOVED &&
        this.dragMode != null
      ) {
        let point: Point = touch.getLocation(this.parent);
        if (this.dragMode == 'move') {
          this.x = this.startX + point.x - this.pointerStart.x;
          this.y = this.startY + point.y - this.pointerStart.y;
        } else {
          this.panelWidth = Math.max(
            ChatImageViewerWindow.MIN_WIDTH,
            this.startWidth + point.x - this.pointerStart.x,
          );
          this.panelHeight = Math.max(
            ChatImageViewerWindow.MIN_HEIGHT,
            this.startHeight + point.y - this.pointerStart.y,
          );
        }
        this.constrain();
      } else if (touch.id == this.pointerId && touch.phase == TouchPhase.ENDED) {
        this.dragMode = null;
        this.pointerId = -1;
      }
    }

    @bound
    private label(text: string, size: number, color: number, align: string): TextField {
      let result: TextField = new TextField(
        1,
        1,
        text,
        new TextFormat(
          VerdanaBitmapFontRegistry.fontNameForSize(size),
          size,
          color,
          align,
          'center',
        ),
      );
      result.touchable = false;
      result.wordWrap = false;
      return result;
    }

    @bound
    private onClose(event: Event): void {
      this.removeFromParent(true);
    }

    @bound
    public dispose(): void {
      if (this.disposed) return;
      this.disposed = true;
      let index: number = ChatImageViewerWindow.windows.indexOf(this);
      if (index >= 0) ChatImageViewerWindow.windows.splice(index, 1);
      if (this.listenerStage != null) {
        this.listenerStage.removeEventListener(Event.RESIZE, this.onResize);
      }
      this.listenerStage = null;
      this.removeEventListener(Event.ENTER_FRAME, this.onAnimationFrame);
      if (this.asset != null) {
        cache.release(this.asset);
        this.asset = null;
      }
      this.removeEventListener(TouchEvent.TOUCH, this.onTouch);
      this.removeEventListener(Event.ADDED_TO_STAGE, this.onAdded);
      super.dispose();
      this.game = null;
      this.link = null;
      this.image = null;
    }
  }

  return ChatImageViewerWindow;
}
