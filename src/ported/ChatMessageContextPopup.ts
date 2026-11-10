// Source port of core/hud/components/chat/ChatMessageContextPopup.as.
import type { ChatMessageContextData } from '../chat/ChatMessageContextData';
import { bound, type Resolve } from '../runtime/As3';
export function createChatMessageContextPopup(resolve: Resolve): any {
  const VerdanaBitmapFontRegistry: any = resolve('core.text.VerdanaBitmapFontRegistry');
  type VerdanaBitmapFontRegistry = any;
  const Point: any = resolve('openfl.geom.Point');
  type Point = any;
  const DisplayObject: any = resolve('starling.display.DisplayObject');
  type DisplayObject = any;
  const Quad: any = resolve('starling.display.Quad');
  type Quad = any;
  const Sprite: any = resolve('starling.display.Sprite');
  type Sprite = any;
  const Stage: any = resolve('starling.display.Stage');
  type Stage = any;
  const Event: any = resolve('starling.events.Event');
  type Event = any;
  const Touch: any = resolve('starling.events.Touch');
  type Touch = any;
  const TouchEvent: any = resolve('starling.events.TouchEvent');
  type TouchEvent = any;
  const TouchPhase: any = resolve('starling.events.TouchPhase');
  type TouchPhase = any;
  const TextField: any = resolve('starling.text.TextField');
  type TextField = any;
  const TextFormat: any = resolve('starling.text.TextFormat');
  type TextFormat = any;

  /** Dark, chat-local context menu for one Advanced-chat message. */
  /*[Event(name="chatMessageContextCopy", type="starling.events.Event")]*/
  /*[Event(name="chatMessageContextBlock", type="starling.events.Event")]*/
  /*[Event(name="chatMessageContextClose", type="starling.events.Event")]*/

  class ChatMessageContextPopup extends Sprite {
    public static COPY: string = 'chatMessageContextCopy';
    public static BLOCK: string = 'chatMessageContextBlock';
    public static CLOSE: string = 'chatMessageContextClose';

    public static MENU_WIDTH: number = 310;
    private static ROW_HEIGHT: number = 32;
    private static PADDING: number = 1;
    private static POINTER_GAP: number = 3;
    private static PANEL_COLOR: number = 0x111111;
    private static BORDER_COLOR: number = 0x4a4a4a;
    private static ROW_HOVER_COLOR: number = 0x303030;
    private static ROW_DOWN_COLOR: number = 0x3c3c3c;
    private static TEXT_COLOR: number = 0xffffff;

    private background: Quad = null;
    private rows: Quad[] = [];
    private labels: TextField[] = [];
    private actionTypes: string[] = [];
    private actionValues: string[] = [];
    private context: ChatMessageContextData | null = null;
    private outsideListenerStage: Stage = null;
    private scratchPoint: Point = new Point();
    private preferredX: number = NaN;
    private preferredY: number = NaN;
    private availableWidth: number = NaN;
    private availableHeight: number = NaN;
    private menuHeight: number = 1;

    constructor() {
      super();
      this.background = new Quad(
        ChatMessageContextPopup.MENU_WIDTH,
        1,
        ChatMessageContextPopup.PANEL_COLOR,
      );
      this.background.alpha = 0.96;
      this.addChild(this.background);
      this.addEventListener(TouchEvent.TOUCH, this.onMenuTouch);
      this.addEventListener(Event.ADDED_TO_STAGE, this.onAddedToStage);
      this.addEventListener(Event.REMOVED_FROM_STAGE, this.onRemovedFromStage);
      this.visible = false;
    }

    public get isOpen(): boolean {
      return this.visible && this.context != null;
    }

    @bound
    public showFor(
      value: ChatMessageContextData,
      pointerX: number,
      pointerY: number,
      maxWidth: number,
      maxHeight: number,
    ): void {
      this.context = value;
      this.preferredX = pointerX;
      this.preferredY = pointerY;
      this.availableWidth = maxWidth;
      this.availableHeight = maxHeight;
      this.rebuildRows();
      this.positionMenu();
      this.visible = this.context != null && this.rows.length > 0;
      this.resetHighlights();
      if (this.visible) {
        this.attachOutsideListener();
      } else {
        this.detachOutsideListener();
      }
    }

    /** Refresh asynchronously resolved clan metadata without moving the menu. */
    @bound
    public updateData(value: ChatMessageContextData): void {
      if (!this.isOpen || value == null) {
        return;
      }
      this.context = value;
      this.rebuildRows();
      this.positionMenu();
      this.resetHighlights();
    }

    @bound
    public containsStagePoint(point: Point): boolean {
      if (!this.isOpen || point == null || this.stage == null) {
        return false;
      }
      this.globalToLocal(point, this.scratchPoint);
      return (
        this.scratchPoint.x >= 0 &&
        this.scratchPoint.x < ChatMessageContextPopup.MENU_WIDTH &&
        this.scratchPoint.y >= 0 &&
        this.scratchPoint.y < this.menuHeight
      );
    }

    @bound
    public close(dispatchClose: boolean = true): void {
      if (!this.isOpen) {
        this.visible = false;
        this.context = null;
        this.detachOutsideListener();
        return;
      }
      this.visible = false;
      this.context = null;
      this.resetHighlights();
      this.detachOutsideListener();
      if (dispatchClose) {
        this.dispatchEventWith(ChatMessageContextPopup.CLOSE);
      }
    }

    @bound
    private rebuildRows(): void {
      this.clearRows();
      if (this.context == null) {
        this.background.height = 1;
        this.menuHeight = 1;
        return;
      }
      this.addAction(
        'Copy message content',
        ChatMessageContextPopup.COPY,
        this.context.messageText,
      );
      if (this.context.canBlock) {
        this.addAction('Block this person', ChatMessageContextPopup.BLOCK, '');
      }
      if (this.context.hasPlayerId) {
        this.addAction(
          "Get this person's player ID",
          ChatMessageContextPopup.COPY,
          this.context.playerId,
        );
      }
      if (this.context.hasClanName) {
        this.addAction(
          "Get this person's clan name",
          ChatMessageContextPopup.COPY,
          this.context.clanName,
        );
      }
      if (this.context.hasClanId) {
        this.addAction(
          "Get this person's clan ID",
          ChatMessageContextPopup.COPY,
          this.context.clanId,
        );
      }
      this.menuHeight =
        ChatMessageContextPopup.PADDING * 2 + this.rows.length * ChatMessageContextPopup.ROW_HEIGHT;
      this.background.height = Math.max(1, this.menuHeight);
      this.addBorder(0, 0, ChatMessageContextPopup.MENU_WIDTH, 1);
      this.addBorder(0, this.menuHeight - 1, ChatMessageContextPopup.MENU_WIDTH, 1);
      this.addBorder(0, 0, 1, this.menuHeight);
      this.addBorder(ChatMessageContextPopup.MENU_WIDTH - 1, 0, 1, this.menuHeight);
    }

    @bound
    private addAction(caption: string, eventType: string, value: string): void {
      let index: number = this.rows.length;
      let row: Quad = new Quad(
        ChatMessageContextPopup.MENU_WIDTH - ChatMessageContextPopup.PADDING * 2,
        ChatMessageContextPopup.ROW_HEIGHT,
        ChatMessageContextPopup.ROW_HOVER_COLOR,
      );
      row.x = ChatMessageContextPopup.PADDING;
      row.y = ChatMessageContextPopup.PADDING + index * ChatMessageContextPopup.ROW_HEIGHT;
      row.alpha = 0.001;
      this.addChild(row);
      this.rows.push(row);

      let label: TextField = new TextField(
        ChatMessageContextPopup.MENU_WIDTH - 20,
        ChatMessageContextPopup.ROW_HEIGHT,
        caption,
        new TextFormat(
          VerdanaBitmapFontRegistry.fontNameForSize(11),
          11,
          ChatMessageContextPopup.TEXT_COLOR,
          'left',
        ),
      );
      label.x = 10;
      label.y = row.y;
      label.touchable = false;
      this.addChild(label);
      this.labels.push(label);
      this.actionTypes.push(eventType);
      this.actionValues.push(value == null ? '' : value);
    }

    @bound
    private addBorder(x: number, y: number, width: number, height: number): void {
      let border: Quad = new Quad(width, height, ChatMessageContextPopup.BORDER_COLOR);
      border.x = x;
      border.y = y;
      border.alpha = 0.8;
      border.touchable = false;
      this.addChild(border);
    }

    @bound
    private clearRows(): void {
      while (this.numChildren > 1) {
        this.removeChildAt(this.numChildren - 1, true);
      }
      this.rows.length = 0;
      this.labels.length = 0;
      this.actionTypes.length = 0;
      this.actionValues.length = 0;
    }

    @bound
    private positionMenu(): void {
      let desiredX: number = this.preferredX + ChatMessageContextPopup.POINTER_GAP;
      let desiredY: number = this.preferredY + ChatMessageContextPopup.POINTER_GAP;
      if (desiredY + this.menuHeight > this.availableHeight) {
        desiredY = this.preferredY - this.menuHeight - ChatMessageContextPopup.POINTER_GAP;
      }
      this.x = Math.max(
        0,
        Math.min(Math.max(0, this.availableWidth - ChatMessageContextPopup.MENU_WIDTH), desiredX),
      );
      this.y = Math.max(0, Math.min(Math.max(0, this.availableHeight - this.menuHeight), desiredY));
    }

    @bound
    private onMenuTouch(event: TouchEvent): void {
      let touch: Touch = event.getTouch(this);
      if (touch == null) {
        this.resetHighlights();
        return;
      }
      event.stopImmediatePropagation();
      touch.getLocation(this, this.scratchPoint);
      let index: number = this.rowIndexAt(this.scratchPoint.x, this.scratchPoint.y);
      this.updateHighlights(index, touch.phase);
      if (index < 0 || touch.phase != TouchPhase.ENDED || touch.cancelled) {
        return;
      }
      let eventType: string = this.actionTypes[index];
      let eventData: any =
        eventType == ChatMessageContextPopup.BLOCK ? this.context : this.actionValues[index];
      // Closing before dispatch makes a synchronous queue refresh harmless.
      this.close(false);
      this.dispatchEventWith(eventType, false, eventData);
      this.dispatchEventWith(ChatMessageContextPopup.CLOSE);
    }

    @bound
    private rowIndexAt(localX: number, localY: number): number {
      if (
        localX < ChatMessageContextPopup.PADDING ||
        localX >= ChatMessageContextPopup.MENU_WIDTH - ChatMessageContextPopup.PADDING ||
        localY < ChatMessageContextPopup.PADDING ||
        localY >= this.menuHeight - ChatMessageContextPopup.PADDING
      ) {
        return -1;
      }
      let index: number = Math.trunc(
        (localY - ChatMessageContextPopup.PADDING) / ChatMessageContextPopup.ROW_HEIGHT,
      );
      return index >= 0 && index < this.rows.length ? index : -1;
    }

    @bound
    private updateHighlights(index: number, phase: string): void {
      for (let i: number = 0; i < this.rows.length; i++) {
        let active: boolean = i == index;
        this.rows[i].color =
          phase == TouchPhase.BEGAN || phase == TouchPhase.MOVED || phase == TouchPhase.STATIONARY
            ? ChatMessageContextPopup.ROW_DOWN_COLOR
            : ChatMessageContextPopup.ROW_HOVER_COLOR;
        this.rows[i].alpha = active ? 0.92 : 0.001;
      }
    }

    @bound
    private resetHighlights(): void {
      for (const row of this.rows) {
        row.alpha = 0.001;
      }
    }

    @bound
    private attachOutsideListener(): void {
      if (this.stage == null || this.outsideListenerStage != null) {
        return;
      }
      this.outsideListenerStage = this.stage;
      this.outsideListenerStage.addEventListener(TouchEvent.TOUCH, this.onStageTouch);
    }

    @bound
    private detachOutsideListener(): void {
      if (this.outsideListenerStage == null) {
        return;
      }
      this.outsideListenerStage.removeEventListener(TouchEvent.TOUCH, this.onStageTouch);
      this.outsideListenerStage = null;
    }

    @bound
    private onStageTouch(event: TouchEvent): void {
      let touch: Touch = event.getTouch(this.stage, TouchPhase.BEGAN);
      if (touch == null) {
        return;
      }
      let target: DisplayObject = touch.target;
      if (target == null || !this.contains(target)) {
        this.close();
      }
    }

    @bound
    private onAddedToStage(event: Event): void {
      if (this.isOpen) {
        this.attachOutsideListener();
      }
    }

    @bound
    private onRemovedFromStage(event: Event): void {
      this.visible = false;
      this.context = null;
      this.detachOutsideListener();
    }

    @bound
    /*override*/
    public dispose(): void {
      this.close(false);
      this.removeEventListener(TouchEvent.TOUCH, this.onMenuTouch);
      this.removeEventListener(Event.ADDED_TO_STAGE, this.onAddedToStage);
      this.removeEventListener(Event.REMOVED_FROM_STAGE, this.onRemovedFromStage);
      this.clearRows();
      this.scratchPoint = null;
      this.background = null;
      super.dispose();
    }
  }

  return ChatMessageContextPopup;
}
