import { EmojiPickerCatalog } from '../chat/EmojiPickerCatalog';
import { ChatEmojiPickerModel } from '../chat/ChatEmojiPickerModel';
import { EmojiGlyphLookup } from '../chat/rich/EmojiGlyphLookup';
// Source port of core/hud/components/chat/ChatEmojiPicker.as.
import { bound, type Resolve } from '../runtime/As3';
export function createChatEmojiPicker(resolve: Resolve): any {
  const BitmapFontTextFormat: any = resolve('feathers.text.BitmapFontTextFormat');
  type BitmapFontTextFormat = any;
  const Point: any = resolve('openfl.geom.Point');
  type Point = any;
  const Rectangle: any = resolve('openfl.geom.Rectangle');
  type Rectangle = any;
  type IEventDispatcher = any;
  const MouseEvent: any = resolve('openfl.events.MouseEvent');
  type MouseEvent = any;
  // Resolving the class installs the Haxe property aliases used by the wheel bridge.
  const Starling: any = resolve('starling.core.Starling');
  type Starling = any;
  const DisplayObject: any = resolve('starling.display.DisplayObject');
  type DisplayObject = any;
  const Image: any = resolve('starling.display.Image');
  type Image = any;
  const MeshBatch: any = resolve('starling.display.MeshBatch');
  type MeshBatch = any;
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
  const BitmapChar: any = resolve('starling.text.BitmapChar');
  type BitmapChar = any;
  const BitmapFont: any = resolve('starling.text.BitmapFont');
  type BitmapFont = any;
  const Texture: any = resolve('starling.textures.Texture');
  type Texture = any;

  /**
   * Small, allocation-free emoji chooser for the advanced chat composer.
   *
   * The visible emoji grid is copied into one MeshBatch from the already loaded
   * Verdana/Noto atlas. It never creates a native TextField, rasterizes text, or
   * owns the shared font texture. Listen for EVENT_EMOJI_SELECTED and read the
   * selected Unicode string from Event.data.
   */

  class ChatEmojiPicker extends Sprite {
    public static EVENT_EMOJI_SELECTED: string = 'emojiSelected';
    public static EVENT_OPEN_CHANGED: string = 'emojiPickerOpenChanged';

    public static BUTTON_WIDTH: number = 36;
    public static BUTTON_HEIGHT: number = 32;
    public static PANEL_WIDTH: number = 376;
    public static PANEL_HEIGHT: number = 196;

    private static FONT_NAME: string = 'verdana48_bitmap';
    private static EMOJI_NATIVE_SIZE: number = 48;
    private static EMOJI_SIZE: number = 23;
    private static BUTTON_EMOJI_SIZE: number = 21;
    private static PANEL_GAP: number = 6;
    private static PANEL_PADDING: number = 8;
    private static CELL_SIZE: number = 30;
    private static COLUMNS: number = ChatEmojiPickerModel.COLUMNS;
    private static CATEGORY_TAB_Y: number = 4;
    private static CATEGORY_TAB_WIDTH: number = 45;
    private static CATEGORY_TAB_HEIGHT: number = 27;
    private static CATEGORY_ICON_SIZE: number = 18;
    private static GRID_Y: number = 38;
    private static GRID_HEIGHT: number =
      ChatEmojiPickerModel.VISIBLE_ROWS * ChatEmojiPicker.CELL_SIZE;
    private static SCROLL_TRACK_X: number = 370;
    private static SCROLL_TRACK_WIDTH: number = 4;
    private static SCROLL_HIT_X: number = 368;
    private static SCROLL_THUMB_MIN_HEIGHT: number = 14;

    // Keep the picker chrome in the same neutral charcoal family as the
    // integrated composer. The atlas images stay white-modulated below, so
    // these colors never tint the emoji glyphs themselves.
    private static BUTTON_IDLE_COLOR: number = 0x191919;
    private static BUTTON_HOVER_COLOR: number = 0x292929;
    private static BUTTON_DOWN_COLOR: number = 0x333333;
    private static BUTTON_SELECTED_COLOR: number = 0x3b3b3b;
    private static BUTTON_SELECTED_HOVER_COLOR: number = 0x444444;
    private static BUTTON_ALPHA: number = 0.86;
    private static PANEL_COLOR: number = 0x111111;
    private static PANEL_ALPHA: number = 0.94;
    private static BORDER_COLOR: number = 0x4a4a4a;
    private static BORDER_ALPHA: number = 0.8;
    private static CELL_HOVER_COLOR: number = 0x333333;
    private static CELL_DOWN_COLOR: number = 0x4a4a4a;
    private static CELL_HIGHLIGHT_ALPHA: number = 0.82;
    private static CATEGORY_SELECTED_COLOR: number = 0x3b3b3b;
    private static CATEGORY_HOVER_COLOR: number = 0x2d2d2d;
    private static SCROLL_TRACK_COLOR: number = 0x292929;
    private static SCROLL_THUMB_COLOR: number = 0x777777;

    private button: Sprite = null;
    private buttonBackground: Quad = null;
    private buttonGlyphs: MeshBatch = null;
    private panel: Sprite = null;
    private panelBackground: Quad = null;
    private hoverHighlight: Quad = null;
    private selectedCategoryHighlight: Quad = null;
    private categoryHoverHighlight: Quad = null;
    private scrollTrack: Quad = null;
    private scrollThumb: Quad = null;
    private panelGlyphs: MeshBatch = null;
    private helperImage: Image = null;
    private bitmapFont: BitmapFont = null;
    private outsideListenerStage: Stage = null;
    private wheelListenerStage: IEventDispatcher = null;
    private scratchPoint: Point = new Point();
    private nativePointerPoint: Point = new Point();
    private model: ChatEmojiPickerModel = new ChatEmojiPickerModel();
    private draggingScrollbar: boolean = false;
    private scrollDragOffset: number = 0;

    constructor() {
      super();
      this.createButton();
      this.createPanel();
      this.rebuildGlyphs();
      this.addEventListener(Event.ADDED_TO_STAGE, this.onAddedToStage);
      this.addEventListener(Event.REMOVED_FROM_STAGE, this.onRemovedFromStage);
    }

    public get isOpen(): boolean {
      return this.panel.visible;
    }

    @bound
    public open(): void {
      if (this.panel.visible) {
        return;
      }
      if (this.bitmapFont == null) {
        this.rebuildGlyphs();
      }
      this.panel.visible = true;
      this.updateButtonBackground();
      this.attachOutsideListener();
      this.attachWheelListener();
      this.dispatchEventWith(ChatEmojiPicker.EVENT_OPEN_CHANGED, false, true);
    }

    @bound
    public close(): void {
      if (!this.panel.visible) {
        return;
      }
      this.panel.visible = false;
      this.hoverHighlight.visible = false;
      this.categoryHoverHighlight.visible = false;
      this.draggingScrollbar = false;
      this.updateButtonBackground();
      this.detachOutsideListener();
      this.detachWheelListener();
      this.dispatchEventWith(ChatEmojiPicker.EVENT_OPEN_CHANGED, false, false);
    }

    @bound
    public toggle(): void {
      if (this.panel.visible) {
        this.close();
      } else {
        this.open();
      }
    }

    @bound
    private createButton(): void {
      this.button = new Sprite();
      this.buttonBackground = new Quad(
        ChatEmojiPicker.BUTTON_WIDTH,
        ChatEmojiPicker.BUTTON_HEIGHT,
        ChatEmojiPicker.BUTTON_IDLE_COLOR,
      );
      this.buttonBackground.alpha = ChatEmojiPicker.BUTTON_ALPHA;
      this.button.addChild(this.buttonBackground);
      this.buttonGlyphs = new MeshBatch();
      this.buttonGlyphs.touchable = false;
      this.buttonGlyphs.pixelSnapping = true;
      this.button.addChild(this.buttonGlyphs);
      this.button.addEventListener(TouchEvent.TOUCH, this.onButtonTouch);
      this.addChild(this.button);
    }

    @bound
    private createPanel(): void {
      this.panel = new Sprite();
      this.panel.x = ChatEmojiPicker.BUTTON_WIDTH - ChatEmojiPicker.PANEL_WIDTH;
      this.panel.y = -ChatEmojiPicker.PANEL_HEIGHT - ChatEmojiPicker.PANEL_GAP;

      this.panelBackground = new Quad(
        ChatEmojiPicker.PANEL_WIDTH,
        ChatEmojiPicker.PANEL_HEIGHT,
        ChatEmojiPicker.PANEL_COLOR,
      );
      this.panelBackground.alpha = ChatEmojiPicker.PANEL_ALPHA;
      this.panel.addChild(this.panelBackground);
      ChatEmojiPicker.addBorder(this.panel, 0, 0, ChatEmojiPicker.PANEL_WIDTH, 1);
      ChatEmojiPicker.addBorder(
        this.panel,
        0,
        ChatEmojiPicker.PANEL_HEIGHT - 1,
        ChatEmojiPicker.PANEL_WIDTH,
        1,
      );
      ChatEmojiPicker.addBorder(this.panel, 0, 0, 1, ChatEmojiPicker.PANEL_HEIGHT);
      ChatEmojiPicker.addBorder(
        this.panel,
        ChatEmojiPicker.PANEL_WIDTH - 1,
        0,
        1,
        ChatEmojiPicker.PANEL_HEIGHT,
      );

      this.selectedCategoryHighlight = new Quad(
        ChatEmojiPicker.CATEGORY_TAB_WIDTH - 2,
        ChatEmojiPicker.CATEGORY_TAB_HEIGHT,
        ChatEmojiPicker.CATEGORY_SELECTED_COLOR,
      );
      this.selectedCategoryHighlight.alpha = ChatEmojiPicker.CELL_HIGHLIGHT_ALPHA;
      this.selectedCategoryHighlight.touchable = false;
      this.panel.addChild(this.selectedCategoryHighlight);

      this.categoryHoverHighlight = new Quad(
        ChatEmojiPicker.CATEGORY_TAB_WIDTH - 2,
        ChatEmojiPicker.CATEGORY_TAB_HEIGHT,
        ChatEmojiPicker.CATEGORY_HOVER_COLOR,
      );
      this.categoryHoverHighlight.alpha = ChatEmojiPicker.CELL_HIGHLIGHT_ALPHA;
      this.categoryHoverHighlight.touchable = false;
      this.categoryHoverHighlight.visible = false;
      this.panel.addChild(this.categoryHoverHighlight);

      this.hoverHighlight = new Quad(
        ChatEmojiPicker.CELL_SIZE - 2,
        ChatEmojiPicker.CELL_SIZE - 2,
        ChatEmojiPicker.CELL_HOVER_COLOR,
      );
      this.hoverHighlight.alpha = ChatEmojiPicker.CELL_HIGHLIGHT_ALPHA;
      this.hoverHighlight.touchable = false;
      this.hoverHighlight.visible = false;
      this.panel.addChild(this.hoverHighlight);

      this.scrollTrack = new Quad(
        ChatEmojiPicker.SCROLL_TRACK_WIDTH,
        ChatEmojiPicker.GRID_HEIGHT,
        ChatEmojiPicker.SCROLL_TRACK_COLOR,
      );
      this.scrollTrack.x = ChatEmojiPicker.SCROLL_TRACK_X;
      this.scrollTrack.y = ChatEmojiPicker.GRID_Y;
      this.scrollTrack.alpha = 0.72;
      this.scrollTrack.touchable = false;
      this.panel.addChild(this.scrollTrack);

      this.scrollThumb = new Quad(
        ChatEmojiPicker.SCROLL_TRACK_WIDTH,
        ChatEmojiPicker.SCROLL_THUMB_MIN_HEIGHT,
        ChatEmojiPicker.SCROLL_THUMB_COLOR,
      );
      this.scrollThumb.x = ChatEmojiPicker.SCROLL_TRACK_X;
      this.scrollThumb.y = ChatEmojiPicker.GRID_Y;
      this.scrollThumb.alpha = 0.9;
      this.scrollThumb.touchable = false;
      this.panel.addChild(this.scrollThumb);

      this.panelGlyphs = new MeshBatch();
      this.panelGlyphs.touchable = false;
      this.panelGlyphs.pixelSnapping = true;
      this.panel.addChild(this.panelGlyphs);
      this.panel.addEventListener(TouchEvent.TOUCH, this.onPanelTouch);
      this.panel.visible = false;
      this.addChild(this.panel);
    }

    @bound
    private static addBorder(
      parent: Sprite,
      x: number,
      y: number,
      width: number,
      height: number,
    ): void {
      let border: Quad = new Quad(width, height, ChatEmojiPicker.BORDER_COLOR);
      border.alpha = ChatEmojiPicker.BORDER_ALPHA;
      border.x = x;
      border.y = y;
      border.touchable = false;
      parent.addChild(border);
    }

    @bound
    private rebuildGlyphs(): void {
      this.buttonGlyphs.clear();
      this.panelGlyphs.clear();
      let format: BitmapFontTextFormat = new BitmapFontTextFormat(
        ChatEmojiPicker.FONT_NAME,
        ChatEmojiPicker.EMOJI_NATIVE_SIZE,
        0xffffff,
      );
      this.bitmapFont = format.font;
      if (this.bitmapFont == null) {
        return;
      }

      this.addEmoji(
        this.buttonGlyphs,
        this.model.categoryIconAt(0),
        0,
        0,
        ChatEmojiPicker.BUTTON_WIDTH,
        ChatEmojiPicker.BUTTON_HEIGHT,
        ChatEmojiPicker.BUTTON_EMOJI_SIZE,
      );
      for (let category: number = 0; category < this.model.categoryCount; category++) {
        this.addEmoji(
          this.panelGlyphs,
          this.model.categoryIconAt(category),
          ChatEmojiPicker.PANEL_PADDING + category * ChatEmojiPicker.CATEGORY_TAB_WIDTH,
          ChatEmojiPicker.CATEGORY_TAB_Y,
          ChatEmojiPicker.CATEGORY_TAB_WIDTH,
          ChatEmojiPicker.CATEGORY_TAB_HEIGHT,
          ChatEmojiPicker.CATEGORY_ICON_SIZE,
        );
      }
      for (let i: number = 0; i < ChatEmojiPickerModel.VISIBLE_CELLS; i++) {
        let scalar: number = this.model.visibleScalarAt(i);
        if (scalar == 0) {
          continue;
        }
        let column: number = i % ChatEmojiPicker.COLUMNS;
        let row: number = Math.trunc(i / ChatEmojiPicker.COLUMNS);
        this.addEmoji(
          this.panelGlyphs,
          scalar,
          ChatEmojiPicker.PANEL_PADDING + column * ChatEmojiPicker.CELL_SIZE,
          ChatEmojiPicker.GRID_Y + row * ChatEmojiPicker.CELL_SIZE,
          ChatEmojiPicker.CELL_SIZE,
          ChatEmojiPicker.CELL_SIZE,
          ChatEmojiPicker.EMOJI_SIZE,
        );
      }
      this.updateCategoryHighlight();
      this.updateScrollbar();
    }

    @bound
    private updateCategoryHighlight(): void {
      this.selectedCategoryHighlight.x =
        ChatEmojiPicker.PANEL_PADDING +
        this.model.categoryIndex * ChatEmojiPicker.CATEGORY_TAB_WIDTH +
        1;
      this.selectedCategoryHighlight.y = ChatEmojiPicker.CATEGORY_TAB_Y;
    }

    @bound
    private updateScrollbar(): void {
      let thumbHeight: number = Math.max(
        ChatEmojiPicker.SCROLL_THUMB_MIN_HEIGHT,
        Math.round(ChatEmojiPicker.GRID_HEIGHT * this.model.visibleFraction),
      );
      this.scrollThumb.height = Math.min(ChatEmojiPicker.GRID_HEIGHT, thumbHeight);
      this.scrollThumb.y =
        ChatEmojiPicker.GRID_Y +
        Math.round(
          (ChatEmojiPicker.GRID_HEIGHT - this.scrollThumb.height) * this.model.scrollRatio,
        );
      this.scrollThumb.visible = this.model.maxScrollRow > 0;
      this.scrollTrack.visible = this.model.maxScrollRow > 0;
    }

    @bound
    private addEmoji(
      batch: MeshBatch,
      scalar: number,
      x: number,
      y: number,
      cellWidth: number,
      cellHeight: number,
      size: number,
    ): void {
      let glyphID: number = EmojiGlyphLookup.glyphIdForScalar(scalar);
      let character: BitmapChar = glyphID < 0 ? null : this.bitmapFont.getChar(glyphID);
      if (character == null) {
        return;
      }
      let texture: Texture = character.texture;
      let frame: Rectangle = texture.frame;
      if (
        (frame != null && (frame.width == 0 || frame.height == 0)) ||
        (frame == null && (texture.width == 0 || texture.height == 0))
      ) {
        return;
      }
      if (this.helperImage == null) {
        this.helperImage = new Image(texture);
      } else {
        this.helperImage.texture = texture;
        this.helperImage.readjustSize();
      }
      let scale: number = size / ChatEmojiPicker.EMOJI_NATIVE_SIZE;
      this.helperImage.scaleX = this.helperImage.scaleY = scale;
      this.helperImage.x = x + Math.round((cellWidth - character.width * scale) / 2);
      this.helperImage.y = y + Math.round((cellHeight - character.height * scale) / 2);
      this.helperImage.color = 0xffffff;
      this.helperImage.alpha = 1;
      this.helperImage.textureSmoothing = 'bilinear';
      this.helperImage.pixelSnapping = true;
      batch.addMesh(this.helperImage);
    }

    @bound
    private onButtonTouch(event: TouchEvent): void {
      let touch: Touch = event.getTouch(this.button);
      if (touch == null) {
        this.updateButtonBackground();
        return;
      }
      // Keep the composer focused while its own picker is being used. The
      // editor otherwise sees this same BEGAN at stage level as an outside
      // click and re-enables gameplay input behind the open picker.
      event.stopImmediatePropagation();
      if (touch.phase == TouchPhase.HOVER) {
        this.buttonBackground.color = this.panel.visible
          ? ChatEmojiPicker.BUTTON_SELECTED_HOVER_COLOR
          : ChatEmojiPicker.BUTTON_HOVER_COLOR;
      } else if (
        touch.phase == TouchPhase.BEGAN ||
        touch.phase == TouchPhase.MOVED ||
        touch.phase == TouchPhase.STATIONARY
      ) {
        this.buttonBackground.color = ChatEmojiPicker.BUTTON_DOWN_COLOR;
      } else {
        this.updateButtonBackground();
      }
      if (touch.phase == TouchPhase.ENDED && !touch.cancelled) {
        this.toggle();
      }
    }

    @bound
    private updateButtonBackground(): void {
      this.buttonBackground.color = this.panel.visible
        ? ChatEmojiPicker.BUTTON_SELECTED_COLOR
        : ChatEmojiPicker.BUTTON_IDLE_COLOR;
    }

    @bound
    private onPanelTouch(event: TouchEvent): void {
      let touch: Touch = event.getTouch(this.panel);
      if (touch == null) {
        this.hoverHighlight.visible = false;
        this.categoryHoverHighlight.visible = false;
        this.draggingScrollbar = false;
        return;
      }
      event.stopImmediatePropagation();
      touch.getLocation(this.panel, this.scratchPoint);

      if (
        this.draggingScrollbar ||
        (touch.phase == TouchPhase.BEGAN &&
          ChatEmojiPicker.scrollbarContains(this.scratchPoint.x, this.scratchPoint.y))
      ) {
        this.hoverHighlight.visible = false;
        this.categoryHoverHighlight.visible = false;
        if (!this.draggingScrollbar) {
          this.draggingScrollbar = true;
          this.scrollDragOffset =
            this.scratchPoint.y >= this.scrollThumb.y &&
            this.scratchPoint.y <= this.scrollThumb.y + this.scrollThumb.height
              ? this.scratchPoint.y - this.scrollThumb.y
              : this.scrollThumb.height / 2;
        }
        this.updateScrollFromPointer(this.scratchPoint.y);
        if (touch.phase == TouchPhase.ENDED || touch.cancelled) {
          this.draggingScrollbar = false;
        }
        return;
      }

      let categoryIndex: number = ChatEmojiPicker.categoryIndexAt(
        this.scratchPoint.x,
        this.scratchPoint.y,
      );
      if (categoryIndex >= 0) {
        this.hoverHighlight.visible = false;
        this.categoryHoverHighlight.x =
          ChatEmojiPicker.PANEL_PADDING + categoryIndex * ChatEmojiPicker.CATEGORY_TAB_WIDTH + 1;
        this.categoryHoverHighlight.y = ChatEmojiPicker.CATEGORY_TAB_Y;
        this.categoryHoverHighlight.visible = categoryIndex != this.model.categoryIndex;
        if (
          touch.phase == TouchPhase.ENDED &&
          !touch.cancelled &&
          this.model.selectCategory(categoryIndex)
        ) {
          this.categoryHoverHighlight.visible = false;
          this.rebuildGlyphs();
        }
        return;
      }

      this.categoryHoverHighlight.visible = false;
      let index: number = ChatEmojiPicker.emojiCellAt(this.scratchPoint.x, this.scratchPoint.y);
      let scalar: number = index < 0 ? 0 : this.model.visibleScalarAt(index);
      if (index < 0 || scalar == 0) {
        this.hoverHighlight.visible = false;
        return;
      }
      let column: number = index % ChatEmojiPicker.COLUMNS;
      let row: number = Math.trunc(index / ChatEmojiPicker.COLUMNS);
      this.hoverHighlight.color =
        touch.phase == TouchPhase.BEGAN ||
        touch.phase == TouchPhase.MOVED ||
        touch.phase == TouchPhase.STATIONARY
          ? ChatEmojiPicker.CELL_DOWN_COLOR
          : ChatEmojiPicker.CELL_HOVER_COLOR;
      this.hoverHighlight.x =
        ChatEmojiPicker.PANEL_PADDING + column * ChatEmojiPicker.CELL_SIZE + 1;
      this.hoverHighlight.y = ChatEmojiPicker.GRID_Y + row * ChatEmojiPicker.CELL_SIZE + 1;
      this.hoverHighlight.visible = true;
      if (touch.phase == TouchPhase.ENDED && !touch.cancelled) {
        let value: string = ChatEmojiPicker.unicodeForScalar(scalar);
        this.close();
        this.dispatchEventWith(ChatEmojiPicker.EVENT_EMOJI_SELECTED, false, value);
      }
    }

    @bound
    private static categoryIndexAt(x: number, y: number): number {
      if (
        x < ChatEmojiPicker.PANEL_PADDING ||
        x >=
          ChatEmojiPicker.PANEL_PADDING +
            EmojiPickerCatalog.CATEGORY_COUNT * ChatEmojiPicker.CATEGORY_TAB_WIDTH ||
        y < ChatEmojiPicker.CATEGORY_TAB_Y ||
        y >= ChatEmojiPicker.CATEGORY_TAB_Y + ChatEmojiPicker.CATEGORY_TAB_HEIGHT
      ) {
        return -1;
      }
      return Math.trunc((x - ChatEmojiPicker.PANEL_PADDING) / ChatEmojiPicker.CATEGORY_TAB_WIDTH);
    }

    @bound
    private static emojiCellAt(x: number, y: number): number {
      x -= ChatEmojiPicker.PANEL_PADDING;
      y -= ChatEmojiPicker.GRID_Y;
      if (
        x < 0 ||
        x >= ChatEmojiPicker.COLUMNS * ChatEmojiPicker.CELL_SIZE ||
        y < 0 ||
        y >= ChatEmojiPicker.GRID_HEIGHT
      ) {
        return -1;
      }
      let column: number = Math.trunc(x / ChatEmojiPicker.CELL_SIZE);
      let row: number = Math.trunc(y / ChatEmojiPicker.CELL_SIZE);
      return row * ChatEmojiPicker.COLUMNS + column;
    }

    @bound
    private static scrollbarContains(x: number, y: number): boolean {
      return (
        x >= ChatEmojiPicker.SCROLL_HIT_X &&
        x < ChatEmojiPicker.PANEL_WIDTH &&
        y >= ChatEmojiPicker.GRID_Y &&
        y <= ChatEmojiPicker.GRID_Y + ChatEmojiPicker.GRID_HEIGHT
      );
    }

    @bound
    private updateScrollFromPointer(pointerY: number): void {
      let travel: number = ChatEmojiPicker.GRID_HEIGHT - this.scrollThumb.height;
      let ratio: number =
        travel <= 0 ? 0 : (pointerY - ChatEmojiPicker.GRID_Y - this.scrollDragOffset) / travel;
      if (this.model.setScrollRatio(ratio)) {
        this.hoverHighlight.visible = false;
        this.rebuildGlyphs();
      }
    }

    @bound
    private static unicodeForScalar(scalar: number): string {
      let result: string;
      if (scalar <= 0xffff) {
        result = String.fromCharCode(scalar);
      } else {
        let value: number = scalar - 0x10000;
        result = String.fromCharCode(0xd800 + (value >> 10), 0xdc00 + (value & 0x3ff));
      }
      if (EmojiGlyphLookup.requiresVS16(scalar)) {
        result += String.fromCharCode(EmojiGlyphLookup.VS16);
      }
      return result;
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
    private attachWheelListener(): void {
      if (
        this.stage == null ||
        this.wheelListenerStage != null ||
        this.stage.starling == null ||
        this.stage.starling.nativeStage == null
      ) {
        return;
      }
      this.wheelListenerStage = this.stage.starling.nativeStage;
      this.wheelListenerStage.addEventListener(
        MouseEvent.MOUSE_WHEEL,
        this.onNativeMouseWheel,
        false,
        10000,
      );
    }

    @bound
    private detachWheelListener(): void {
      if (this.wheelListenerStage == null) {
        return;
      }
      this.wheelListenerStage.removeEventListener(MouseEvent.MOUSE_WHEEL, this.onNativeMouseWheel);
      this.wheelListenerStage = null;
    }

    @bound
    private onNativeMouseWheel(event: MouseEvent): void {
      if (!this.panel.visible || this.panel.stage == null || event.delta == 0) {
        return;
      }
      let starling: Starling = this.panel.stage.starling;
      if (
        starling == null ||
        starling.stage == null ||
        starling.viewPort == null ||
        starling.viewPort.width <= 0 ||
        starling.viewPort.height <= 0
      ) {
        return;
      }

      // Native mouse coordinates are in back-buffer pixels. Convert through
      // the active viewport before asking the Starling panel for local
      // coordinates, including non-1x DPI and letterboxed configurations.
      this.nativePointerPoint.setTo(
        (starling.stage.stageWidth * (event.stageX - starling.viewPort.x)) /
          starling.viewPort.width,
        (starling.stage.stageHeight * (event.stageY - starling.viewPort.y)) /
          starling.viewPort.height,
      );
      this.panel.globalToLocal(this.nativePointerPoint, this.scratchPoint);
      if (
        this.scratchPoint.x < 0 ||
        this.scratchPoint.x >= ChatEmojiPicker.PANEL_WIDTH ||
        this.scratchPoint.y < 0 ||
        this.scratchPoint.y >= ChatEmojiPicker.PANEL_HEIGHT
      ) {
        return;
      }

      // Flash reports positive delta for wheel-up. Keep each native event a
      // predictable single-row move instead of applying platform-specific
      // delta magnitudes directly.
      event.preventDefault();
      event.stopImmediatePropagation();
      if (this.model.scrollByRows(event.delta > 0 ? -1 : 1)) {
        this.hoverHighlight.visible = false;
        this.categoryHoverHighlight.visible = false;
        this.rebuildGlyphs();
      }
    }

    @bound
    private onAddedToStage(event: Event): void {
      if (this.panel.visible) {
        this.attachOutsideListener();
        this.attachWheelListener();
      }
    }

    @bound
    private onRemovedFromStage(event: Event): void {
      this.detachOutsideListener();
      this.detachWheelListener();
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
    /*override*/
    public dispose(): void {
      this.detachOutsideListener();
      this.detachWheelListener();
      this.removeEventListener(Event.ADDED_TO_STAGE, this.onAddedToStage);
      this.removeEventListener(Event.REMOVED_FROM_STAGE, this.onRemovedFromStage);
      this.button.removeEventListener(TouchEvent.TOUCH, this.onButtonTouch);
      this.panel.removeEventListener(TouchEvent.TOUCH, this.onPanelTouch);
      this.helperImage = null;
      this.bitmapFont = null;
      this.scratchPoint = null;
      this.nativePointerPoint = null;

      super.dispose();
    }
  }

  return ChatEmojiPicker;
}
