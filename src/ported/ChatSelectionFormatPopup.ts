// Source port of core/hud/components/chat/ChatSelectionFormatPopup.as.
import type { NativeFocusBridge } from '../ui/BitmapInputAdapter';
import { bound, type Resolve } from '../runtime/HaxeInterop';
export function createChatSelectionFormatPopup(resolve: Resolve): any {
  const ChatSelectionValueSlider: any = resolve(
    'core.hud.components.chat.ChatSelectionValueSlider',
  );
  type ChatSelectionValueSlider = any;
  const RichBitmapFontTextRenderer: any = resolve(
    'core.hud.components.chat.rich.RichBitmapFontTextRenderer',
  );
  type RichBitmapFontTextRenderer = any;
  const RichBitmapChatTextInput: any = resolve(
    'core.hud.components.chat.rich.RichBitmapChatTextInput',
  );
  type RichBitmapChatTextInput = any;
  const RichBitmapMarkup: any = resolve('core.hud.components.chat.rich.RichBitmapMarkup');
  type RichBitmapMarkup = any;
  const RichBitmapMarkupParser: any = resolve(
    'core.hud.components.chat.rich.RichBitmapMarkupParser',
  );
  type RichBitmapMarkupParser = any;
  const VerdanaBitmapFontRegistry: any = resolve('core.text.VerdanaBitmapFontRegistry');
  type VerdanaBitmapFontRegistry = any;
  const BitmapFontTextFormat: any = resolve('feathers.text.BitmapFontTextFormat');
  type BitmapFontTextFormat = any;
  const Point: any = resolve('openfl.geom.Point');
  type Point = any;
  const Keyboard: any = resolve('openfl.ui.Keyboard');
  type Keyboard = any;
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

  /**
   * Compact context menu and formatting panels for a selected chat range.
   *
   * The owner supplies coordinates in this component's coordinate space. The
   * menu and detail panel have independent anchors so that the menu can appear
   * at the pointer while the sliders remain directly below the chat input.
   * Event.data for COLOR_CHANGE is a uint and Event.data for SIZE_CHANGE is an
   * int. COPY and PASTE carry no data.
   */
  /*[Event(name="chatSelectionCopy", type="starling.events.Event")]*/
  /*[Event(name="chatSelectionPaste", type="starling.events.Event")]*/
  /*[Event(name="chatSelectionColorChange", type="starling.events.Event")]*/
  /*[Event(name="chatSelectionSizeChange", type="starling.events.Event")]*/
  /*[Event(name="chatSelectionDetailHeightChange", type="starling.events.Event")]*/
  /*[Event(name="chatSelectionPopupClose", type="starling.events.Event")]*/

  class ChatSelectionFormatPopup extends Sprite {
    public static COPY: string = 'chatSelectionCopy';
    public static PASTE: string = 'chatSelectionPaste';
    public static COLOR_CHANGE: string = 'chatSelectionColorChange';
    public static SIZE_CHANGE: string = 'chatSelectionSizeChange';
    public static DETAIL_HEIGHT_CHANGE: string = 'chatSelectionDetailHeightChange';
    public static CLOSE: string = 'chatSelectionPopupClose';

    public static MENU_WIDTH: number = 286;
    public static MENU_HEIGHT: number = 138;
    public static PANEL_WIDTH: number = 336;
    public static COLOR_PANEL_HEIGHT: number = 228;
    public static SIZE_PANEL_HEIGHT: number = 166;

    private static PREVIEW_FONT_NAME: string = 'verdana48_bitmap';
    private static MIN_FORMAT_SIZE: number = 12;
    private static MAX_FORMAT_SIZE: number = 48;
    private static MENU_ROW_HEIGHT: number = 34;
    private static MENU_PADDING: number = 1;
    private static PANEL_GAP: number = 5;
    private static PREVIEW_X: number = 10;
    private static PREVIEW_Y: number = 36;
    private static PREVIEW_WIDTH: number = ChatSelectionFormatPopup.PANEL_WIDTH - 20;
    // Verdana's 48 px atlas has a ~66 px line height. Leave padding around a
    // full native-size line so neither its glyphs nor emoji touch the mask.
    private static PREVIEW_HEIGHT: number = 76;
    private static PREVIEW_INSET: number = 1;
    private static PREVIEW_TEXT_X: number = 8;
    private static SLIDER_WIDTH: number = 226;
    private static SLIDER_HEIGHT: number = 24;
    private static HEX_INPUT_X: number = 224;
    private static HEX_INPUT_Y: number = 3;
    private static HEX_INPUT_WIDTH: number = 74;
    private static HEX_INPUT_HEIGHT: number = 27;
    private static HEX_COLOR_PATTERN: RegExp = /^[0-9a-fA-F]{6}$/;

    private static PANEL_COLOR: number = 0x111111;
    private static PANEL_ALPHA: number = 0.96;
    private static BORDER_COLOR: number = 0x4a4a4a;
    private static ROW_HOVER_COLOR: number = 0x303030;
    private static ROW_DOWN_COLOR: number = 0x3c3c3c;
    private static TEXT_COLOR: number = 0xffffff;
    private static MUTED_TEXT_COLOR: number = 0xbcbcbc;
    private static DISABLED_TEXT_COLOR: number = 0x666666;

    private static MENU_COPY: number = 0;
    private static MENU_PASTE: number = 1;
    private static MENU_COLOR: number = 2;
    private static MENU_SIZE: number = 3;
    private static MODE_NONE: number = 0;
    private static MODE_COLOR: number = 1;
    private static MODE_SIZE: number = 2;

    private menuPanel: Sprite = null;
    private menuRows: Quad[] = [];
    private menuLabels: TextField[] = [];
    private detailPanel: Sprite = null;
    private detailBackground: Quad = null;
    private detailLeftBorder: Quad = null;
    private detailRightBorder: Quad = null;
    private detailTitle: TextField = null;
    private backLabel: TextField = null;
    private hexLabel: TextField = null;
    private hexInput: RichBitmapChatTextInput = null;
    private hexNativeFocus: NativeFocusBridge | null = null;
    private previewViewport: Sprite = null;
    private previewBackground: Quad = null;
    private previewRenderer: RichBitmapFontTextRenderer = null;
    private previewMask: Quad = null;
    private colorSwatchBorder: Quad = null;
    private colorSwatch: Quad = null;
    private redSlider: ChatSelectionValueSlider = null;
    private greenSlider: ChatSelectionValueSlider = null;
    private blueSlider: ChatSelectionValueSlider = null;
    private sizeSlider: ChatSelectionValueSlider = null;
    private channelLabels: TextField[] = [];
    private channelValues: TextField[] = [];
    private sizeValue: TextField = null;
    private outsideListenerStage: Stage = null;
    private scratchPoint: Point = new Point();
    private parsedPreview: RichBitmapMarkup = new RichBitmapMarkup();
    private previewSource: string = '';
    private panelAnchorX: number = NaN;
    private panelAnchorY: number = NaN;
    private panelAnchorAboveY: number = NaN;
    private panelAnchorWasSet: boolean = false;
    private mode: number = ChatSelectionFormatPopup.MODE_NONE;
    private syncingHexInput: boolean = false;
    private _selectedColor: number = 0xffffff;
    private _selectedSize: number = 14;
    private _copyEnabled: boolean = true;
    private _pasteEnabled: boolean = true;
    private _formatEnabled: boolean = true;

    constructor() {
      super();
      this.createMenu();
      this.createDetailPanel();
      this.visible = false;
      this.addEventListener(Event.ADDED_TO_STAGE, this.onAddedToStage);
      this.addEventListener(Event.REMOVED_FROM_STAGE, this.onRemovedFromStage);
    }

    public get isOpen(): boolean {
      return this.visible && (this.menuPanel.visible || this.detailPanel.visible);
    }

    public get selectedColor(): number {
      return this._selectedColor;
    }

    public set selectedColor(value: number) {
      value &= 0xffffff;
      if (this._selectedColor == value) {
        this.syncHexInput();
        return;
      }
      this._selectedColor = value;
      this.syncColorSliders();
      this.updatePreview();
    }

    public get selectedSize(): number {
      return this._selectedSize;
    }

    public set selectedSize(value: number) {
      value = Math.max(
        ChatSelectionFormatPopup.MIN_FORMAT_SIZE,
        Math.min(ChatSelectionFormatPopup.MAX_FORMAT_SIZE, value | 0),
      );
      if (this._selectedSize == value) {
        return;
      }
      this._selectedSize = value;
      this.sizeSlider.value = value;
      this.updateSizeValue();
      this.updatePreview();
    }

    public get copyEnabled(): boolean {
      return this._copyEnabled;
    }

    public set copyEnabled(value: boolean) {
      this._copyEnabled = value;
      this.refreshMenuLabels();
    }

    public get pasteEnabled(): boolean {
      return this._pasteEnabled;
    }

    public set pasteEnabled(value: boolean) {
      this._pasteEnabled = value;
      this.refreshMenuLabels();
    }

    public get formatEnabled(): boolean {
      return this._formatEnabled;
    }

    public set formatEnabled(value: boolean) {
      this._formatEnabled = value;
      this.refreshMenuLabels();
    }

    /** Raw rich-chat markup for the selected range. */
    @bound
    public setSelectionPreview(value: string): void {
      this.previewSource = value == null ? '' : value;
      this.updatePreview();
    }

    @bound
    public setValues(color: number, size: number): void {
      this._selectedColor = color & 0xffffff;
      this._selectedSize = Math.max(
        ChatSelectionFormatPopup.MIN_FORMAT_SIZE,
        Math.min(ChatSelectionFormatPopup.MAX_FORMAT_SIZE, size | 0),
      );
      this.syncColorSliders();
      this.sizeSlider.value = this._selectedSize;
      this.updateSizeValue();
      this.updatePreview();
    }

    @bound
    public setMenuEnabled(canCopy: boolean, canPaste: boolean, canFormat: boolean = true): void {
      this._copyEnabled = canCopy;
      this._pasteEnabled = canPaste;
      this._formatEnabled = canFormat;
      this.refreshMenuLabels();
    }

    /**
     * Set the preferred below-input anchor and an optional input-top fallback.
     * The detail panel stays below the input whenever it fits on stage, and
     * flips above it on short windows instead of clipping the controls.
     */
    @bound
    public setPanelAnchor(x: number, y: number, aboveY: number = NaN): void {
      this.panelAnchorX = x;
      this.panelAnchorY = y;
      this.panelAnchorAboveY = aboveY;
      this.panelAnchorWasSet = true;
      this.detailPanel.x = x;
      this.detailPanel.y = y;
    }

    /** Show the compact menu at a local-space pointer position. */
    @bound
    public showMenu(x: number, y: number): void {
      this.clearHexInputFocus();
      if (this.mode != ChatSelectionFormatPopup.MODE_NONE) {
        this.dispatchEventWith(ChatSelectionFormatPopup.DETAIL_HEIGHT_CHANGE, false, 0);
      }
      this.menuPanel.x = x;
      this.menuPanel.y = y;
      if (!this.panelAnchorWasSet) {
        this.detailPanel.x = x;
        this.detailPanel.y =
          y + ChatSelectionFormatPopup.MENU_HEIGHT + ChatSelectionFormatPopup.PANEL_GAP;
      }
      this.mode = ChatSelectionFormatPopup.MODE_NONE;
      this.resetMenuHighlights();
      this.detailPanel.visible = false;
      this.menuPanel.visible = true;
      this.visible = true;
      this.attachOutsideListener();
    }

    @bound
    public showColorPanel(): void {
      if (!this._formatEnabled) {
        return;
      }
      this.configureHexInputEditor();
      this.mode = ChatSelectionFormatPopup.MODE_COLOR;
      this.dispatchEventWith(
        ChatSelectionFormatPopup.DETAIL_HEIGHT_CHANGE,
        false,
        ChatSelectionFormatPopup.COLOR_PANEL_HEIGHT,
      );
      this.configureDetailPanel();
      this.menuPanel.visible = false;
      this.detailPanel.visible = true;
      this.visible = true;
      this.attachOutsideListener();
    }

    @bound
    public showSizePanel(): void {
      if (!this._formatEnabled) {
        return;
      }
      this.clearHexInputFocus();
      this.mode = ChatSelectionFormatPopup.MODE_SIZE;
      this.dispatchEventWith(
        ChatSelectionFormatPopup.DETAIL_HEIGHT_CHANGE,
        false,
        ChatSelectionFormatPopup.SIZE_PANEL_HEIGHT,
      );
      this.configureDetailPanel();
      this.menuPanel.visible = false;
      this.detailPanel.visible = true;
      this.visible = true;
      this.attachOutsideListener();
    }

    @bound
    public close(): void {
      if (!this.isOpen) {
        return;
      }
      this.clearHexInputFocus();
      if (this.mode != ChatSelectionFormatPopup.MODE_NONE) {
        this.dispatchEventWith(ChatSelectionFormatPopup.DETAIL_HEIGHT_CHANGE, false, 0);
      }
      this.menuPanel.visible = false;
      this.detailPanel.visible = false;
      this.visible = false;
      this.mode = ChatSelectionFormatPopup.MODE_NONE;
      this.detachOutsideListener();
      this.dispatchEventWith(ChatSelectionFormatPopup.CLOSE);
    }

    @bound
    private createMenu(): void {
      this.menuPanel = new Sprite();
      this.addChild(this.menuPanel);
      let background: Quad = new Quad(
        ChatSelectionFormatPopup.MENU_WIDTH,
        ChatSelectionFormatPopup.MENU_HEIGHT,
        ChatSelectionFormatPopup.PANEL_COLOR,
      );
      background.alpha = ChatSelectionFormatPopup.PANEL_ALPHA;
      this.menuPanel.addChild(background);
      ChatSelectionFormatPopup.addBorder(
        this.menuPanel,
        0,
        0,
        ChatSelectionFormatPopup.MENU_WIDTH,
        1,
      );
      ChatSelectionFormatPopup.addBorder(
        this.menuPanel,
        0,
        ChatSelectionFormatPopup.MENU_HEIGHT - 1,
        ChatSelectionFormatPopup.MENU_WIDTH,
        1,
      );
      ChatSelectionFormatPopup.addBorder(
        this.menuPanel,
        0,
        0,
        1,
        ChatSelectionFormatPopup.MENU_HEIGHT,
      );
      ChatSelectionFormatPopup.addBorder(
        this.menuPanel,
        ChatSelectionFormatPopup.MENU_WIDTH - 1,
        0,
        1,
        ChatSelectionFormatPopup.MENU_HEIGHT,
      );

      let captions: string[] = [
        'Copy',
        'Paste',
        'Color this message part with...',
        'Size this message part to...',
      ];
      for (let i: number = 0; i < captions.length; i++) {
        let row: Quad = new Quad(
          ChatSelectionFormatPopup.MENU_WIDTH - ChatSelectionFormatPopup.MENU_PADDING * 2,
          ChatSelectionFormatPopup.MENU_ROW_HEIGHT,
          ChatSelectionFormatPopup.ROW_HOVER_COLOR,
        );
        row.x = ChatSelectionFormatPopup.MENU_PADDING;
        row.y =
          ChatSelectionFormatPopup.MENU_PADDING + i * ChatSelectionFormatPopup.MENU_ROW_HEIGHT;
        row.alpha = 0.001;
        this.menuPanel.addChild(row);
        this.menuRows.push(row);

        let label: TextField = ChatSelectionFormatPopup.createLabel(
          ChatSelectionFormatPopup.MENU_WIDTH - 20,
          ChatSelectionFormatPopup.MENU_ROW_HEIGHT,
          captions[i],
          12,
          ChatSelectionFormatPopup.TEXT_COLOR,
          'left',
        );
        label.x = 10;
        label.y = row.y;
        this.menuPanel.addChild(label);
        this.menuLabels.push(label);
      }
      let separator: Quad = new Quad(
        ChatSelectionFormatPopup.MENU_WIDTH - 12,
        1,
        ChatSelectionFormatPopup.BORDER_COLOR,
      );
      separator.x = 6;
      separator.y =
        ChatSelectionFormatPopup.MENU_PADDING + ChatSelectionFormatPopup.MENU_ROW_HEIGHT * 2;
      separator.alpha = 0.65;
      separator.touchable = false;
      this.menuPanel.addChild(separator);
      this.menuPanel.addEventListener(TouchEvent.TOUCH, this.onMenuTouch);
      this.refreshMenuLabels();
    }

    @bound
    private createDetailPanel(): void {
      this.detailPanel = new Sprite();
      this.detailPanel.visible = false;
      this.addChild(this.detailPanel);

      this.detailBackground = new Quad(
        ChatSelectionFormatPopup.PANEL_WIDTH,
        ChatSelectionFormatPopup.COLOR_PANEL_HEIGHT,
        ChatSelectionFormatPopup.PANEL_COLOR,
      );
      this.detailBackground.alpha = ChatSelectionFormatPopup.PANEL_ALPHA;
      this.detailPanel.addChild(this.detailBackground);
      ChatSelectionFormatPopup.addBorder(
        this.detailPanel,
        0,
        0,
        ChatSelectionFormatPopup.PANEL_WIDTH,
        1,
      );
      this.detailLeftBorder = ChatSelectionFormatPopup.addBorder(
        this.detailPanel,
        0,
        0,
        1,
        ChatSelectionFormatPopup.COLOR_PANEL_HEIGHT,
      );
      this.detailRightBorder = ChatSelectionFormatPopup.addBorder(
        this.detailPanel,
        ChatSelectionFormatPopup.PANEL_WIDTH - 1,
        0,
        1,
        ChatSelectionFormatPopup.COLOR_PANEL_HEIGHT,
      );

      this.backLabel = ChatSelectionFormatPopup.createLabel(
        62,
        30,
        '< Back',
        11,
        ChatSelectionFormatPopup.MUTED_TEXT_COLOR,
        'left',
      );
      this.backLabel.x = 9;
      this.detailPanel.addChild(this.backLabel);
      this.detailTitle = ChatSelectionFormatPopup.createLabel(
        136,
        30,
        '',
        12,
        ChatSelectionFormatPopup.TEXT_COLOR,
        'center',
      );
      this.detailTitle.x = 70;
      this.detailPanel.addChild(this.detailTitle);

      this.hexLabel = ChatSelectionFormatPopup.createLabel(
        14,
        30,
        '#',
        12,
        ChatSelectionFormatPopup.MUTED_TEXT_COLOR,
        'center',
      );
      this.hexLabel.x = ChatSelectionFormatPopup.HEX_INPUT_X - 15;
      this.detailPanel.addChild(this.hexLabel);
      this.hexInput = new RichBitmapChatTextInput();
      this.hexInput.styleName = 'chat_bitmap_input';
      this.hexInput.x = ChatSelectionFormatPopup.HEX_INPUT_X;
      this.hexInput.y = ChatSelectionFormatPopup.HEX_INPUT_Y;
      this.hexInput.width = ChatSelectionFormatPopup.HEX_INPUT_WIDTH;
      this.hexInput.height = ChatSelectionFormatPopup.HEX_INPUT_HEIGHT;
      this.hexInput.maxChars = 6;
      this.hexInput.restrict = '0-9a-fA-F';
      this.hexInput.addEventListener(Event.CHANGE, this.onHexInputChange);
      this.hexInput.addEventListener('focusOut', this.onHexInputFocusOut);
      this.detailPanel.addChild(this.hexInput);
      this.colorSwatchBorder = new Quad(22, 22, ChatSelectionFormatPopup.BORDER_COLOR);
      this.colorSwatchBorder.x = ChatSelectionFormatPopup.PANEL_WIDTH - 31;
      this.colorSwatchBorder.y = 5;
      this.colorSwatchBorder.touchable = false;
      this.detailPanel.addChild(this.colorSwatchBorder);
      this.colorSwatch = new Quad(18, 18, this._selectedColor);
      this.colorSwatch.x = ChatSelectionFormatPopup.PANEL_WIDTH - 29;
      this.colorSwatch.y = 7;
      this.colorSwatch.touchable = false;
      this.detailPanel.addChild(this.colorSwatch);

      this.previewViewport = new Sprite();
      this.previewViewport.x = ChatSelectionFormatPopup.PREVIEW_X;
      this.previewViewport.y = ChatSelectionFormatPopup.PREVIEW_Y;
      this.detailPanel.addChild(this.previewViewport);
      this.previewBackground = new Quad(
        ChatSelectionFormatPopup.PREVIEW_WIDTH,
        ChatSelectionFormatPopup.PREVIEW_HEIGHT,
        0x080808,
      );
      this.previewBackground.alpha = 0.94;
      this.previewViewport.addChild(this.previewBackground);
      ChatSelectionFormatPopup.addBorder(
        this.previewViewport,
        0,
        0,
        ChatSelectionFormatPopup.PREVIEW_WIDTH,
        1,
      );
      ChatSelectionFormatPopup.addBorder(
        this.previewViewport,
        0,
        ChatSelectionFormatPopup.PREVIEW_HEIGHT - 1,
        ChatSelectionFormatPopup.PREVIEW_WIDTH,
        1,
      );
      ChatSelectionFormatPopup.addBorder(
        this.previewViewport,
        0,
        0,
        1,
        ChatSelectionFormatPopup.PREVIEW_HEIGHT,
      );
      ChatSelectionFormatPopup.addBorder(
        this.previewViewport,
        ChatSelectionFormatPopup.PREVIEW_WIDTH - 1,
        0,
        1,
        ChatSelectionFormatPopup.PREVIEW_HEIGHT,
      );

      this.previewRenderer = new RichBitmapFontTextRenderer();
      this.previewRenderer.textFormat = new BitmapFontTextFormat(
        ChatSelectionFormatPopup.PREVIEW_FONT_NAME,
        this._selectedSize,
        this._selectedColor,
      );
      this.previewRenderer.textureSmoothing = 'bilinear';
      this.previewRenderer.pixelSnapping = false;
      this.previewRenderer.truncateToFit = false;
      this.previewRenderer.useSeparateBatch = false;
      this.previewRenderer.wordWrap = false;
      this.previewRenderer.touchable = false;
      this.previewRenderer.x = ChatSelectionFormatPopup.PREVIEW_TEXT_X;
      this.previewViewport.addChild(this.previewRenderer);
      this.previewMask = new Quad(
        ChatSelectionFormatPopup.PREVIEW_WIDTH - ChatSelectionFormatPopup.PREVIEW_INSET * 2,
        ChatSelectionFormatPopup.PREVIEW_HEIGHT - ChatSelectionFormatPopup.PREVIEW_INSET * 2,
        0xff00ff,
      );
      this.previewRenderer.mask = this.previewMask;
      this.positionPreviewMask();

      this.redSlider = this.createChannelSlider();
      this.greenSlider = this.createChannelSlider();
      this.blueSlider = this.createChannelSlider();
      let channelNames: string[] = ['R', 'G', 'B'];
      let sliders: ChatSelectionValueSlider[] = this.colorSliders;
      for (let i: number = 0; i < sliders.length; i++) {
        let rowY: number =
          ChatSelectionFormatPopup.PREVIEW_Y +
          ChatSelectionFormatPopup.PREVIEW_HEIGHT +
          10 +
          i * 32;
        let channelLabel: TextField = ChatSelectionFormatPopup.createLabel(
          20,
          28,
          channelNames[i],
          12,
          ChatSelectionFormatPopup.TEXT_COLOR,
          'left',
        );
        channelLabel.x = 12;
        channelLabel.y = rowY - 2;
        this.detailPanel.addChild(channelLabel);
        this.channelLabels.push(channelLabel);
        sliders[i].x = 34;
        sliders[i].y = rowY;
        this.detailPanel.addChild(sliders[i]);
        let channelValue: TextField = ChatSelectionFormatPopup.createLabel(
          48,
          28,
          '0',
          11,
          ChatSelectionFormatPopup.MUTED_TEXT_COLOR,
          'right',
        );
        channelValue.x = 276;
        channelValue.y = rowY - 2;
        this.detailPanel.addChild(channelValue);
        this.channelValues.push(channelValue);
      }

      this.sizeSlider = new ChatSelectionValueSlider(
        ChatSelectionFormatPopup.MIN_FORMAT_SIZE,
        ChatSelectionFormatPopup.MAX_FORMAT_SIZE,
        1,
        ChatSelectionFormatPopup.SLIDER_WIDTH + 24,
        ChatSelectionFormatPopup.SLIDER_HEIGHT,
      );
      this.sizeSlider.x = 12;
      this.sizeSlider.y =
        ChatSelectionFormatPopup.PREVIEW_Y + ChatSelectionFormatPopup.PREVIEW_HEIGHT + 14;
      this.sizeSlider.addEventListener(Event.CHANGE, this.onSizeSliderChange);
      this.detailPanel.addChild(this.sizeSlider);
      this.sizeValue = ChatSelectionFormatPopup.createLabel(
        58,
        28,
        '14 px',
        11,
        ChatSelectionFormatPopup.MUTED_TEXT_COLOR,
        'right',
      );
      this.sizeValue.x = 266;
      this.sizeValue.y = this.sizeSlider.y - 2;
      this.detailPanel.addChild(this.sizeValue);

      let bottomBorder: Quad = new Quad(
        ChatSelectionFormatPopup.PANEL_WIDTH,
        1,
        ChatSelectionFormatPopup.BORDER_COLOR,
      );
      bottomBorder.name = 'detailBottomBorder';
      bottomBorder.touchable = false;
      this.detailPanel.addChild(bottomBorder);
      this.detailPanel.addEventListener(TouchEvent.TOUCH, this.onDetailTouch);
      this.syncColorSliders();
      this.sizeSlider.value = this._selectedSize;
      this.updateChannelValues();
      this.updateSizeValue();
    }

    @bound
    private createChannelSlider(): ChatSelectionValueSlider {
      let slider: ChatSelectionValueSlider = new ChatSelectionValueSlider(
        0,
        255,
        1,
        ChatSelectionFormatPopup.SLIDER_WIDTH,
        ChatSelectionFormatPopup.SLIDER_HEIGHT,
      );
      slider.addEventListener(Event.CHANGE, this.onColorSliderChange);
      return slider;
    }

    private get colorSliders(): ChatSelectionValueSlider[] {
      return [this.redSlider, this.greenSlider, this.blueSlider];
    }

    @bound
    private configureDetailPanel(): void {
      let colorMode: boolean = this.mode == ChatSelectionFormatPopup.MODE_COLOR;
      let height: number = colorMode
        ? ChatSelectionFormatPopup.COLOR_PANEL_HEIGHT
        : ChatSelectionFormatPopup.SIZE_PANEL_HEIGHT;
      this.detailBackground.height = height;
      this.detailLeftBorder.height = height;
      this.detailRightBorder.height = height;
      this.detailTitle.text = colorMode ? 'Text color' : 'Text size';
      this.hexLabel.visible = colorMode;
      this.hexInput.visible = colorMode;
      this.colorSwatchBorder.visible = colorMode;
      this.colorSwatch.visible = colorMode;
      for (const label of this.channelLabels) {
        label.visible = colorMode;
      }
      for (const value of this.channelValues) {
        value.visible = colorMode;
      }
      this.redSlider.visible = colorMode;
      this.greenSlider.visible = colorMode;
      this.blueSlider.visible = colorMode;
      this.sizeSlider.visible = !colorMode;
      this.sizeValue.visible = !colorMode;
      let bottom: DisplayObject = this.detailPanel.getChildByName('detailBottomBorder');
      bottom.y = height - 1;
      this.positionDetailPanel(height);
      this.updatePreview();
    }

    @bound
    private positionDetailPanel(height: number): void {
      if (!this.panelAnchorWasSet) {
        return;
      }
      let desired: Point = this.localToGlobal(new Point(this.panelAnchorX, this.panelAnchorY));
      let ownerStage: Stage = this.stage;
      if (ownerStage != null) {
        if (
          desired.y + height > ownerStage.stageHeight &&
          this.panelAnchorAboveY == this.panelAnchorAboveY
        ) {
          let above: Point = this.localToGlobal(
            new Point(this.panelAnchorX, this.panelAnchorAboveY - height),
          );
          if (above.y >= 0) {
            desired.y = above.y;
          }
        }
        desired.x = Math.max(
          0,
          Math.min(desired.x, ownerStage.stageWidth - ChatSelectionFormatPopup.PANEL_WIDTH),
        );
        desired.y = Math.max(0, Math.min(desired.y, ownerStage.stageHeight - height));
      }
      let local: Point = this.globalToLocal(desired);
      this.detailPanel.x = local.x;
      this.detailPanel.y = local.y;
    }

    @bound
    private onMenuTouch(event: TouchEvent): void {
      let touch: Touch = event.getTouch(this.menuPanel);
      if (touch == null) {
        this.resetMenuHighlights();
        return;
      }
      // A menu click may synchronously restore editor focus. Do not let the
      // same bubbling touch reach the editor's outside-click blur handler.
      event.stopImmediatePropagation();
      touch.getLocation(this.menuPanel, this.scratchPoint);
      let index: number = this.menuIndexAt(this.scratchPoint.x, this.scratchPoint.y);
      this.updateMenuHighlights(index, touch.phase);
      if (
        index < 0 ||
        touch.phase != TouchPhase.ENDED ||
        touch.cancelled ||
        !this.menuIndexEnabled(index)
      ) {
        return;
      }
      if (index == ChatSelectionFormatPopup.MENU_COPY) {
        this.dispatchEventWith(ChatSelectionFormatPopup.COPY);
        this.close();
      } else if (index == ChatSelectionFormatPopup.MENU_PASTE) {
        this.dispatchEventWith(ChatSelectionFormatPopup.PASTE);
        this.close();
      } else if (index == ChatSelectionFormatPopup.MENU_COLOR) {
        this.showColorPanel();
      } else if (index == ChatSelectionFormatPopup.MENU_SIZE) {
        this.showSizePanel();
      }
    }

    @bound
    private menuIndexAt(x: number, y: number): number {
      if (
        x < ChatSelectionFormatPopup.MENU_PADDING ||
        x >= ChatSelectionFormatPopup.MENU_WIDTH - ChatSelectionFormatPopup.MENU_PADDING ||
        y < ChatSelectionFormatPopup.MENU_PADDING ||
        y >= ChatSelectionFormatPopup.MENU_HEIGHT - ChatSelectionFormatPopup.MENU_PADDING
      ) {
        return -1;
      }
      let index: number = Math.trunc(
        (y - ChatSelectionFormatPopup.MENU_PADDING) / ChatSelectionFormatPopup.MENU_ROW_HEIGHT,
      );
      return index >= 0 && index < this.menuRows.length ? index : -1;
    }

    @bound
    private menuIndexEnabled(index: number): boolean {
      if (index == ChatSelectionFormatPopup.MENU_COPY) {
        return this._copyEnabled;
      }
      if (index == ChatSelectionFormatPopup.MENU_PASTE) {
        return this._pasteEnabled;
      }
      return this._formatEnabled;
    }

    @bound
    private updateMenuHighlights(index: number, phase: string): void {
      for (let i: number = 0; i < this.menuRows.length; i++) {
        let active: boolean = i == index && this.menuIndexEnabled(i);
        this.menuRows[i].color =
          phase == TouchPhase.BEGAN || phase == TouchPhase.MOVED || phase == TouchPhase.STATIONARY
            ? ChatSelectionFormatPopup.ROW_DOWN_COLOR
            : ChatSelectionFormatPopup.ROW_HOVER_COLOR;
        this.menuRows[i].alpha = active ? 0.92 : 0.001;
      }
    }

    @bound
    private resetMenuHighlights(): void {
      for (const row of this.menuRows) {
        row.alpha = 0.001;
      }
    }

    @bound
    private refreshMenuLabels(): void {
      if (this.menuLabels.length < 4) {
        return;
      }
      this.menuLabels[ChatSelectionFormatPopup.MENU_COPY].format.color = this._copyEnabled
        ? ChatSelectionFormatPopup.TEXT_COLOR
        : ChatSelectionFormatPopup.DISABLED_TEXT_COLOR;
      this.menuLabels[ChatSelectionFormatPopup.MENU_PASTE].format.color = this._pasteEnabled
        ? ChatSelectionFormatPopup.TEXT_COLOR
        : ChatSelectionFormatPopup.DISABLED_TEXT_COLOR;
      this.menuLabels[ChatSelectionFormatPopup.MENU_COLOR].format.color = this._formatEnabled
        ? ChatSelectionFormatPopup.TEXT_COLOR
        : ChatSelectionFormatPopup.DISABLED_TEXT_COLOR;
      this.menuLabels[ChatSelectionFormatPopup.MENU_SIZE].format.color = this._formatEnabled
        ? ChatSelectionFormatPopup.TEXT_COLOR
        : ChatSelectionFormatPopup.DISABLED_TEXT_COLOR;
    }

    @bound
    private onDetailTouch(event: TouchEvent): void {
      let panelTouch: Touch = event.getTouch(this.detailPanel);
      if (panelTouch == null) {
        return;
      }
      // Slider changes restore the saved selection during this touch. Keep
      // that focus/selection alive after the event finishes bubbling.
      event.stopImmediatePropagation();
      let touch: Touch = event.getTouch(this.detailPanel, TouchPhase.ENDED);
      if (touch == null || touch.cancelled) {
        return;
      }
      touch.getLocation(this.detailPanel, this.scratchPoint);
      if (
        this.scratchPoint.x >= 0 &&
        this.scratchPoint.x <= 70 &&
        this.scratchPoint.y >= 0 &&
        this.scratchPoint.y <= 30
      ) {
        this.showMenu(this.menuPanel.x, this.menuPanel.y);
      }
    }

    @bound
    private onColorSliderChange(event: Event): void {
      this._selectedColor =
        (Number(Math.round(this.redSlider.value)) << 16) |
        (Number(Math.round(this.greenSlider.value)) << 8) |
        Number(Math.round(this.blueSlider.value));
      this.updateChannelValues();
      this.colorSwatch.color = this._selectedColor;
      this.syncHexInput();
      this.updatePreview();
      this.dispatchEventWith(ChatSelectionFormatPopup.COLOR_CHANGE, false, this._selectedColor);
    }

    @bound
    private onHexInputChange(event: Event): void {
      if (
        this.syncingHexInput ||
        this.hexInput == null ||
        !ChatSelectionFormatPopup.HEX_COLOR_PATTERN.test(this.hexInput.text)
      ) {
        return;
      }
      let next: number = Number(parseInt(this.hexInput.text, 16)) & 0xffffff;
      if (this._selectedColor == next) {
        return;
      }
      this._selectedColor = next;
      this.redSlider.value = (this._selectedColor >> 16) & 0xff;
      this.greenSlider.value = (this._selectedColor >> 8) & 0xff;
      this.blueSlider.value = this._selectedColor & 0xff;
      this.updateChannelValues();
      this.colorSwatch.color = this._selectedColor;
      this.updatePreview();
      let refocusHex: boolean = this.hexInput.hasFocus;
      this.dispatchEventWith(ChatSelectionFormatPopup.COLOR_CHANGE, false, this._selectedColor);
      // Applying the format restores focus to the main composer. Return the
      // native keyboard bridge to this still-open field so a user can make
      // another edit without clicking it again.
      if (this.visible && this.mode == ChatSelectionFormatPopup.MODE_COLOR && refocusHex) {
        this.hexInput.setFocus();
      }
    }

    @bound
    private onHexInputFocusOut(event: Event): void {
      // A partial edit is not a color. Restore the last applied six-digit
      // value when focus leaves, also normalizing valid lowercase input.
      this.syncHexInput();
    }

    @bound
    private onHexNativeKeyDown(event: globalThis.KeyboardEvent): void {
      if (
        event.keyCode != Keyboard.ENTER &&
        event.keyCode != Keyboard.NUMPAD_ENTER &&
        event.keyCode != Keyboard.UP &&
        event.keyCode != Keyboard.DOWN &&
        event.keyCode != Keyboard.TAB
      ) {
        return;
      }
      event.preventDefault();
      event.stopImmediatePropagation();
      if (event.keyCode == Keyboard.ENTER || event.keyCode == Keyboard.NUMPAD_ENTER) {
        if (!ChatSelectionFormatPopup.HEX_COLOR_PATTERN.test(this.hexInput.text)) {
          this.syncHexInput();
        }
        this.hexInput.selectRange(this.hexInput.text.length, this.hexInput.text.length);
      }
    }

    @bound
    private configureHexInputEditor(): void {
      if (this.hexInput == null || this.hexInput.stage == null) {
        return;
      }
      this.hexInput.validate();
      // The shared chat style initializes with the message composer's
      // 150-character limit and user-selected font size. Reapply the compact
      // hexadecimal editor contract after that style has run.
      this.hexInput.maxChars = 6;
      this.hexInput.restrict = '0-9a-fA-F';
      this.hexInput.paddingLeft = 5;
      this.hexInput.paddingRight = 5;
      this.hexInput.paddingTop = 2;
      this.hexInput.paddingBottom = 2;
      this.hexInput.textEditorProperties.textFormat = new BitmapFontTextFormat(
        VerdanaBitmapFontRegistry.fontNameForSize(12),
        12,
        ChatSelectionFormatPopup.TEXT_COLOR,
      );
      const hexEditor: { nativeFocus: NativeFocusBridge } | null = this.hexInput.richEditor;
      const nativeFocus = hexEditor?.nativeFocus ?? null;
      if (this.hexNativeFocus === nativeFocus) {
        return;
      }
      if (this.hexNativeFocus != null) {
        this.hexNativeFocus.removeEventListener('keyDown', this.onHexNativeKeyDown);
      }
      this.hexNativeFocus = nativeFocus;
      if (this.hexNativeFocus != null) {
        this.hexNativeFocus.addEventListener(
          'keyDown',
          this.onHexNativeKeyDown,
          false,
          30000,
          true,
        );
      }
    }

    @bound
    private onSizeSliderChange(event: Event): void {
      this._selectedSize = Number(Math.round(this.sizeSlider.value));
      this.updateSizeValue();
      this.updatePreview();
      this.dispatchEventWith(ChatSelectionFormatPopup.SIZE_CHANGE, false, this._selectedSize);
    }

    @bound
    private syncColorSliders(): void {
      if (this.redSlider == null) {
        return;
      }
      this.redSlider.value = (this._selectedColor >> 16) & 0xff;
      this.greenSlider.value = (this._selectedColor >> 8) & 0xff;
      this.blueSlider.value = this._selectedColor & 0xff;
      this.colorSwatch.color = this._selectedColor;
      this.updateChannelValues();
      this.syncHexInput();
    }

    @bound
    private syncHexInput(): void {
      if (this.hexInput == null) {
        return;
      }
      let value: string = ChatSelectionFormatPopup.colorHex(this._selectedColor).toUpperCase();
      if (this.hexInput.text == value) {
        return;
      }
      this.syncingHexInput = true;
      this.hexInput.text = value;
      this.syncingHexInput = false;
    }

    @bound
    private clearHexInputFocus(): void {
      if (this.hexInput != null && this.hexInput.hasFocus) {
        this.hexInput.clearFocus();
      }
    }

    @bound
    private updateChannelValues(): void {
      if (this.channelValues.length < 3 || this.redSlider == null) {
        return;
      }
      this.channelValues[0].text = String(Math.round(this.redSlider.value));
      this.channelValues[1].text = String(Math.round(this.greenSlider.value));
      this.channelValues[2].text = String(Math.round(this.blueSlider.value));
    }

    @bound
    private updateSizeValue(): void {
      if (this.sizeValue != null) {
        this.sizeValue.text = String(this._selectedSize) + ' px';
      }
    }

    @bound
    private updatePreview(): void {
      if (this.previewRenderer == null) {
        return;
      }
      this.previewRenderer.textFormat = new BitmapFontTextFormat(
        ChatSelectionFormatPopup.PREVIEW_FONT_NAME,
        this._selectedSize,
        this._selectedColor,
      );
      this.previewRenderer.text = this.createPreviewMarkup(
        this.mode == ChatSelectionFormatPopup.MODE_COLOR,
        this.mode == ChatSelectionFormatPopup.MODE_SIZE,
      );
      this.previewRenderer.set_width(NaN);
      this.previewRenderer.set_height(NaN);
      this.previewRenderer.validate();
      let measured: Point = this.previewRenderer.measureText();
      this.previewRenderer.y = Math.round(
        (ChatSelectionFormatPopup.PREVIEW_HEIGHT - measured.y) / 2,
      );
      this.previewRenderer.y = Math.max(
        ChatSelectionFormatPopup.PREVIEW_INSET,
        this.previewRenderer.y,
      );
      this.positionPreviewMask();
    }

    /** Keep the renderer-local mask aligned with the preview's inner edge. */
    @bound
    private positionPreviewMask(): void {
      if (this.previewMask == null || this.previewRenderer == null) {
        return;
      }
      this.previewMask.x = ChatSelectionFormatPopup.PREVIEW_INSET - this.previewRenderer.x;
      this.previewMask.y = ChatSelectionFormatPopup.PREVIEW_INSET - this.previewRenderer.y;
    }

    /**
     * Flatten supported markup for preview only. The chosen property replaces
     * that property across the selection; the other property retains all
     * nested formatting exactly as the composer renderer resolves it.
     */
    @bound
    private createPreviewMarkup(forceColor: boolean, forceSize: boolean): string {
      if (this.previewSource.length == 0) {
        return '';
      }
      RichBitmapMarkupParser.parse(
        this.previewSource,
        this._selectedSize,
        this._selectedColor,
        this.parsedPreview,
      );
      if (this.parsedPreview.text.length == 0) {
        return '';
      }
      let output: any[] = [];
      let start: number = 0;
      while (start < this.parsedPreview.text.length) {
        let color: number = forceColor ? this._selectedColor : this.parsedPreview.colors[start];
        let size: number = forceSize ? this._selectedSize : this.parsedPreview.sizes[start];
        let end: number = start + 1;
        while (
          end < this.parsedPreview.text.length &&
          (forceColor || this.parsedPreview.colors[end] == color) &&
          (forceSize || this.parsedPreview.sizes[end] == size)
        ) {
          end++;
        }
        output.push(
          "<font color='#" +
            ChatSelectionFormatPopup.colorHex(color) +
            "' size='" +
            size +
            "'>" +
            ChatSelectionFormatPopup.escapeMarkup(this.parsedPreview.text.substring(start, end)) +
            '</font>',
        );
        start = end;
      }
      return output.join('');
    }

    @bound
    private static colorHex(value: number): string {
      let hex: string = (value & 0xffffff).toString(16);
      while (hex.length < 6) {
        hex = '0' + hex;
      }
      return hex;
    }

    @bound
    private static escapeMarkup(value: string): string {
      return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
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
    private onAddedToStage(event: Event): void {
      this.configureHexInputEditor();
      if (this.isOpen) {
        this.attachOutsideListener();
      }
    }

    @bound
    private onRemovedFromStage(event: Event): void {
      this.detachOutsideListener();
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
    private static createLabel(
      width: number,
      height: number,
      text: string,
      size: number,
      color: number,
      alignment: string,
    ): TextField {
      let label: TextField = new TextField(
        width,
        height,
        text,
        new TextFormat(VerdanaBitmapFontRegistry.fontNameForSize(size), size, color, alignment),
      );
      label.touchable = false;
      return label;
    }

    @bound
    private static addBorder(
      parent: Sprite,
      x: number,
      y: number,
      width: number,
      height: number,
    ): Quad {
      let border: Quad = new Quad(width, height, ChatSelectionFormatPopup.BORDER_COLOR);
      border.alpha = 0.82;
      border.x = x;
      border.y = y;
      border.touchable = false;
      parent.addChild(border);
      return border;
    }

    @bound
    /*override*/
    public dispose(): void {
      this.detachOutsideListener();
      this.clearHexInputFocus();
      this.removeEventListener(Event.ADDED_TO_STAGE, this.onAddedToStage);
      this.removeEventListener(Event.REMOVED_FROM_STAGE, this.onRemovedFromStage);
      this.menuPanel.removeEventListener(TouchEvent.TOUCH, this.onMenuTouch);
      this.detailPanel.removeEventListener(TouchEvent.TOUCH, this.onDetailTouch);
      this.hexInput.removeEventListener(Event.CHANGE, this.onHexInputChange);
      this.hexInput.removeEventListener('focusOut', this.onHexInputFocusOut);
      if (this.hexNativeFocus != null) {
        this.hexNativeFocus.removeEventListener('keyDown', this.onHexNativeKeyDown);
        this.hexNativeFocus = null;
      }
      this.redSlider.removeEventListener(Event.CHANGE, this.onColorSliderChange);
      this.greenSlider.removeEventListener(Event.CHANGE, this.onColorSliderChange);
      this.blueSlider.removeEventListener(Event.CHANGE, this.onColorSliderChange);
      this.sizeSlider.removeEventListener(Event.CHANGE, this.onSizeSliderChange);
      this.menuRows.length = 0;
      this.menuLabels.length = 0;
      this.channelLabels.length = 0;
      this.channelValues.length = 0;
      this.parsedPreview = null;
      this.scratchPoint = null;
      this.outsideListenerStage = null;
      if (this.previewRenderer != null) {
        this.previewRenderer.mask = null;
      }
      if (this.previewMask != null) {
        this.previewMask.dispose();
        this.previewMask = null;
      }
      super.dispose();
    }
  }

  return ChatSelectionFormatPopup;
}
