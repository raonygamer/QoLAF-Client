// Source port of core/hud/components/Text.as.
import { bound, bridgeNativeProperties, type Resolve } from '../Runtime/As3';
export function createText(resolve: Resolve): any {
  const RichBitmapFontTextRenderer: any = resolve(
    'core.hud.components.chat.rich.RichBitmapFontTextRenderer',
  );
  type RichBitmapFontTextRenderer = any;
  const RichBitmapMarkup: any = resolve('core.hud.components.chat.rich.RichBitmapMarkup');
  type RichBitmapMarkup = any;
  const RichBitmapMarkupParser: any = resolve(
    'core.hud.components.chat.rich.RichBitmapMarkupParser',
  );
  type RichBitmapMarkupParser = any;
  const RussoBitmapFontRegistry: any = resolve('core.text.RussoBitmapFontRegistry');
  type RussoBitmapFontRegistry = any;
  const VerdanaBitmapFontRegistry: any = resolve('core.text.VerdanaBitmapFontRegistry');
  type VerdanaBitmapFontRegistry = any;
  const BitmapFontTextFormat: any = resolve('feathers.text.BitmapFontTextFormat');
  type BitmapFontTextFormat = any;
  const Point: any = resolve('openfl.geom.Point');
  type Point = any;
  const TextFormat: any = resolve('openfl.text.TextFormat');
  type TextFormat = any;
  const DisplayObjectContainer: any = resolve('starling.display.DisplayObjectContainer');
  type DisplayObjectContainer = any;
  const Event: any = resolve('starling.events.Event');
  type Event = any;
  const GlowFilter: any = resolve('starling.filters.GlowFilter');
  type GlowFilter = any;
  const TextureSmoothing: any = resolve('starling.textures.TextureSmoothing');
  type TextureSmoothing = any;

  /**
   * Legacy text API backed by one reusable bitmap-glyph batch.
   *
   * This class intentionally keeps its old setters and alignment semantics so
   * the rest of the UI can migrate away from runtime TrueType textures without
   * hundreds of call-site changes. The renderer borrows the globally registered
   * Russo atlas; disposing a Text instance never disposes that shared texture.
   */

  class Text extends DisplayObjectContainer {
    public static H_ALIGN_LEFT: number = 0;
    public static H_ALIGN_RIGHT: number = 1;
    public static H_ALIGN_CENTER: number = 2;
    public static V_ALIGN_TOP: number = 0;
    public static V_ALIGN_MIDDLE: number = 1;
    public static V_ALIGN_BOTTOM: number = 2;

    private static GLOW_COLOR: number = 0xffffff;
    private static LEADING: number = 8;
    private static DEFAULT_WIDTH: number = 100;
    private static DEFAULT_HEIGHT: number = 100;
    private static AUTO_WIDTH_PADDING: number = 5;

    // CreditLabel relies on this protected display object for icon placement.
    protected finalLayer: RichBitmapFontTextRenderer = null;
    protected _hAlign: number = Text.H_ALIGN_LEFT;

    private format: TextFormat = null;
    private _vAlign: number = Text.V_ALIGN_TOP;
    private _wordWrap: boolean = false;
    private _fieldWidth: number = Text.DEFAULT_WIDTH;
    private _fieldHeight: number = Text.DEFAULT_HEIGHT;
    private _measuredHeight: number = NaN;
    private _htmlText: string = '';
    private _plainText: string = '';
    private renderedText: string = '';
    private oldText: string = '';
    private isHtml: boolean = false;
    private autoWidthOnNextDraw: boolean = false;
    private autoHeightOnNextDraw: boolean = false;
    private _sharpness: number = 0;
    private glowFilter: GlowFilter = null;
    private markup: RichBitmapMarkup = new RichBitmapMarkup();
    private metrics: Point = new Point();
    private _disposed: boolean = false;

    constructor(
      param1: number = 0,
      param2: number = 0,
      param3: boolean = false,
      param4: string = 'DAIDRR',
    ) {
      super();
      RussoBitmapFontRegistry.register();

      this.format = new TextFormat();
      this.format.font = param4;
      this.format.leading = Text.LEADING;
      this.format.color = 0xffffff;
      this.format.size = 10;

      this._wordWrap = param3;
      this.finalLayer = new RichBitmapFontTextRenderer();
      this.finalLayer.touchable = false;
      this.finalLayer.wordWrap = this._wordWrap;
      this.finalLayer.truncateToFit = false;
      this.finalLayer.useSeparateBatch = false;
      this.finalLayer.textureSmoothing = TextureSmoothing.BILINEAR;
      this.finalLayer.pixelSnapping = false;
      this.applyFormat();
      this.addChild(this.finalLayer);

      this.touchable = false;
      this.x = param1;
      this.y = param2;
      this.addEventListener(Event.REMOVED_FROM_STAGE, this.clean);
    }

    public set glow(param1: boolean) {
      this.setGlowFilter(param1 ? new GlowFilter(Text.GLOW_COLOR, 1, 3, 0.5) : null);
    }

    @bound
    public glowIn(
      param1: number,
      param2: number = 1,
      param3: number = 6,
      param4: number = 2,
    ): void {
      // Flash's fourth glow argument was strength. Starling models a hard
      // edge with alpha values above one, while its fourth argument is the
      // render-texture resolution and must not receive the old strength.
      this.setGlowFilter(new GlowFilter(param1, param2 * Math.max(1, param4), param3, 0.5));
    }

    @bound
    private setGlowFilter(param1: GlowFilter): void {
      if (this.glowFilter != null) {
        this.finalLayer.filter = null;
        this.glowFilter.dispose();
      }
      this.glowFilter = param1;
      this.finalLayer.filter = this.glowFilter;
    }

    @bound
    public centerPivot(): void {
      this.pivotX = this.width / 2;
      this.pivotY = this.height / 2;
    }

    @bound
    public center(): void {
      if (this._hAlign == Text.H_ALIGN_CENTER && this._vAlign == Text.V_ALIGN_MIDDLE) {
        return;
      }
      this._hAlign = Text.H_ALIGN_CENTER;
      this._vAlign = Text.V_ALIGN_MIDDLE;
      this.draw();
    }

    @bound
    public alignRight(): void {
      if (this._hAlign == Text.H_ALIGN_RIGHT) {
        return;
      }
      this._hAlign = Text.H_ALIGN_RIGHT;
      this.draw();
    }

    @bound
    public alignLeft(): void {
      if (this._hAlign == Text.H_ALIGN_LEFT) {
        return;
      }
      this._hAlign = Text.H_ALIGN_LEFT;
      this.draw();
    }

    @bound
    public alignCenter(): void {
      if (this._hAlign == Text.H_ALIGN_CENTER) {
        return;
      }
      this._hAlign = Text.H_ALIGN_CENTER;
      this.draw();
    }

    @bound
    public alignTop(): void {
      if (this._vAlign == Text.V_ALIGN_TOP) {
        return;
      }
      this._vAlign = Text.V_ALIGN_TOP;
      this.draw();
    }

    @bound
    public alignMiddle(): void {
      if (this._vAlign == Text.V_ALIGN_MIDDLE) {
        return;
      }
      this._vAlign = Text.V_ALIGN_MIDDLE;
      this.draw();
    }

    @bound
    public alignBottom(): void {
      if (this._vAlign == Text.V_ALIGN_BOTTOM) {
        return;
      }
      this._vAlign = Text.V_ALIGN_BOTTOM;
      this.draw();
    }

    /** Bitmap glyphs have fixed source sharpness; retain the legacy API. */
    public set sharpness(param1: number) {
      this._sharpness = param1;
    }

    public set size(param1: number) {
      if (Number(this.format.size) == param1) {
        return;
      }
      this.format.size = param1;
      this.defaultTextFormat = this.format;
    }

    public get size(): number {
      return Number(this.format.size);
    }

    public set color(param1: number) {
      if (Number(this.format.color) == param1) {
        return;
      }
      this.format.color = param1;
      this.defaultTextFormat = this.format;
    }

    public get color(): number {
      return Number(this.format.color);
    }

    /*override*/ public set width(param1: number) {
      param1 = Math.max(0, param1);
      if (this._fieldWidth == param1) {
        return;
      }
      this._fieldWidth = param1;
      this.draw();
    }

    /*override*/ public get width(): number {
      return this._fieldWidth;
    }

    public set font(param1: string) {
      if (String(this.format.font) == param1) {
        return;
      }
      this.format.font = param1;
      this.defaultTextFormat = this.format;
    }

    public set bold(param1: boolean) {
      if (<boolean>this.format.bold == param1) {
        return;
      }
      // Russo One has a single face. Keep this value for API compatibility;
      // the bitmap renderer intentionally does not synthesize a blurred bold.
      this.format.bold = param1;
      this.defaultTextFormat = this.format;
    }

    public set wordWrap(param1: boolean) {
      if (this._wordWrap == param1) {
        return;
      }
      this._wordWrap = param1;
      this.finalLayer.wordWrap = param1;
      this.draw();
    }

    /*override*/ public set height(param1: number) {
      param1 = Math.max(0, param1);
      if (this._fieldHeight == param1) {
        return;
      }
      this._fieldHeight = param1;
      this.draw();
    }

    /*override*/ public get height(): number {
      return this._measuredHeight;
    }

    public set htmlText(param1: string) {
      param1 = param1 == null ? '' : param1;
      if (this.isHtml && this.oldText == param1) {
        return;
      }
      this.isHtml = true;
      this.oldText = param1;
      this._htmlText = param1;
      RichBitmapMarkupParser.parse(param1, this.size, this.color, this.markup);
      this._plainText = this.markup.text;
      this.renderedText = param1;
      this.requestAutoSize();
      this.draw();
    }

    public get htmlText(): string {
      return this._htmlText;
    }

    public set text(param1: string) {
      param1 = param1 == null ? '' : param1;
      if (!this.isHtml && this.oldText == param1) {
        return;
      }
      this.isHtml = false;
      this.oldText = param1;
      this._plainText = param1;
      this._htmlText = Text.escapePlainText(param1);
      this.renderedText = this._htmlText;
      this.requestAutoSize();
      this.draw();
    }

    public get text(): string {
      return this._plainText;
    }

    public get x(): number {
      return DisplayObjectContainer.prototype.get_x.call(this);
    }

    /*override*/ public set x(param1: number) {
      DisplayObjectContainer.prototype.set_x.call(this, Math.floor(param1));
    }

    public get y(): number {
      return DisplayObjectContainer.prototype.get_y.call(this);
    }

    /*override*/ public set y(param1: number) {
      DisplayObjectContainer.prototype.set_y.call(this, Math.floor(param1));
    }

    /** Accepts flash.text.TextFormat to preserve the legacy public ABI. */
    public set defaultTextFormat(param1: TextFormat) {
      if (param1 == null) {
        return;
      }
      this.format = param1;
      this.applyFormat();
      this.requestAutoSize();
      this.draw();
    }

    @bound
    private requestAutoSize(): void {
      this.autoWidthOnNextDraw = !this._wordWrap;
      this.autoHeightOnNextDraw = true;
    }

    @bound
    private applyFormat(): void {
      let fontName: string =
        this.format.font == null
          ? RussoBitmapFontRegistry.PRIMARY_FONT_NAME
          : String(this.format.font);
      let fontSize: number = this.format.size == null ? 10 : Number(this.format.size);
      if (fontName.toLowerCase() == 'verdana') {
        fontName = VerdanaBitmapFontRegistry.fontNameForSize(fontSize);
      } else if (fontName == RussoBitmapFontRegistry.PRIMARY_FONT_NAME) {
        fontName = RussoBitmapFontRegistry.fontNameForSize(fontSize);
      }
      let fontColor: number =
        this.format.color == null ? 0xffffff : Number(this.format.color) & 0xffffff;
      let align: string = this.format.align == null ? 'left' : String(this.format.align);
      let letterSpacing: number =
        this.format.letterSpacing == null ? 0 : Number(this.format.letterSpacing);
      let bitmapFormat: BitmapFontTextFormat = new BitmapFontTextFormat(
        fontName,
        fontSize,
        fontColor,
        align,
      );
      bitmapFormat.letterSpacing = letterSpacing;
      bitmapFormat.leading =
        this.format.leading == null ? Text.LEADING : Number(this.format.leading);
      this.finalLayer.textFormat = bitmapFormat;
      // Keep camera-scaled combat text stable. Verdana bitmap labels use
      // integer placement and nearest sampling so compact glyphs stay clear.
      this.finalLayer.pixelSnapping = fontName == RussoBitmapFontRegistry.COMBAT_FONT_NAME;
      this.finalLayer.textureSmoothing = TextureSmoothing.BILINEAR;
    }

    @bound
    protected draw(): void {
      if (this._disposed || this.finalLayer == null) {
        return;
      }
      if (!this.hasEventListener(Event.REMOVED_FROM_STAGE)) {
        this.addEventListener(Event.REMOVED_FROM_STAGE, this.clean);
      }

      this.finalLayer.visible = this.renderedText.length > 0;
      this.finalLayer.wordWrap = this._wordWrap;
      this.finalLayer.height = NaN;
      if (this._wordWrap) {
        this.finalLayer.width = this._fieldWidth;
      } else if (this.autoWidthOnNextDraw) {
        this.finalLayer.width = NaN;
      }
      this.finalLayer.text = this.renderedText;
      this.finalLayer.validate();
      this.finalLayer.measureText(this.metrics);

      this._measuredHeight = this.renderedText.length == 0 ? 0 : this.metrics.y;
      if (this.autoWidthOnNextDraw) {
        this._fieldWidth =
          this.renderedText.length == 0 ? 0 : Math.ceil(this.metrics.x) + Text.AUTO_WIDTH_PADDING;
        this.finalLayer.width = this._fieldWidth;
      }
      if (this.autoHeightOnNextDraw) {
        this._fieldHeight = this._measuredHeight + (this._wordWrap ? Text.LEADING : 0);
      }
      this.finalLayer.height = this._fieldHeight;

      if (this._hAlign == Text.H_ALIGN_CENTER) {
        this.finalLayer.x = -this._fieldWidth / 2;
      } else if (this._hAlign == Text.H_ALIGN_RIGHT) {
        this.finalLayer.x = -this._fieldWidth;
      } else {
        this.finalLayer.x = 0;
      }
      if (this._vAlign == Text.V_ALIGN_MIDDLE) {
        this.finalLayer.y = -this._fieldHeight / 2 + Text.LEADING / 2;
      } else if (this._vAlign == Text.V_ALIGN_BOTTOM) {
        this.finalLayer.y = -this._fieldHeight + Text.LEADING / 2;
      } else {
        this.finalLayer.y = 0;
      }

      this.autoWidthOnNextDraw = false;
      this.autoHeightOnNextDraw = false;
    }

    @bound
    private static escapePlainText(param1: string): string {
      return param1.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    }

    @bound
    public clean(param1: Event = null): void {
      this.dispose();
    }

    @bound
    /*override*/
    public dispose(): void {
      if (this._disposed) {
        return;
      }
      this._disposed = true;
      this.removeEventListeners();
      if (this.glowFilter != null) {
        this.finalLayer.filter = null;
        this.glowFilter.dispose();
        this.glowFilter = null;
      }
      this.renderedText = '';
      this.oldText = '';
      this._htmlText = '';
      this._plainText = '';
      this.markup.clear();
      this.markup = null;
      this.metrics = null;
      super.dispose();
      this.finalLayer = null;
      this.format = null;
    }
  }

  bridgeNativeProperties(Text);
  return Text;
}
