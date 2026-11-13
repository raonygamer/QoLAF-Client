import type { Game } from '../game/Game';
import type { Texture } from '../game/Bindings';
import {
  NativeTextFormat as TextFormat,
  Point,
  Event,
  GlowFilter,
  DisplayObjectContainer,
} from '../game/Bindings';
import { bitmapTextAlign } from '../ui/TextAlignment';
import type { createRichBitmapFontTextRenderer } from './RichBitmapFontTextRenderer';
import { RichBitmapMarkup } from '../chat/rich/RichBitmapMarkup';
import { RichBitmapMarkupParser } from '../chat/rich/RichBitmapMarkupParser';
import { BitmapFontTextFormat } from '../ui/BitmapFontTextFormat';
import { RussoBitmapFontRegistry } from '../ui/RussoBitmapFontRegistry';
import { VerdanaBitmapFontRegistry } from '../ui/VerdanaBitmapFontRegistry';
type Renderer = InstanceType<ReturnType<typeof createRichBitmapFontTextRenderer>>;
// Source port of core/hud/components/Text.as.
import { bound, bridgeNativeProperties, type Resolve } from '../runtime/HaxeInterop';
export function createText(resolve: Resolve) {
  const RichBitmapFontTextRenderer = resolve(
    'core.hud.components.chat.rich.RichBitmapFontTextRenderer',
  ) as ReturnType<typeof createRichBitmapFontTextRenderer>;
  resolve('starling.display.DisplayObjectContainer');

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
    protected finalLayer: Renderer | null = null;
    protected _hAlign: number = Text.H_ALIGN_LEFT;

    private format: TextFormat | null = null;
    private _vAlign: number = Text.V_ALIGN_TOP;
    private _wordWrap: boolean = false;
    private _fieldWidth: number = Text.DEFAULT_WIDTH;
    private _fieldHeight: number = Text.DEFAULT_HEIGHT;
    private _measuredHeight: number = NaN;
    private _htmlText: string = '';
    private _plainText: string = '';
    private renderedText: string = '';
    private oldText: string = '';
    private isHTML: boolean = false;
    private autoWidthOnNextDraw: boolean = false;
    private autoHeightOnNextDraw: boolean = false;
    private _sharpness: number = 0;
    private glowFilter: GlowFilter | null = null;
    private markup: RichBitmapMarkup = new RichBitmapMarkup();
    private metrics: Point = new Point();
    private _disposed: boolean = false;

    /** Initialize the original renderer on an existing Haxe Text instance. */
    public static initializeNative(
      instance: Text & { tf: Game.openfl.text.TextField; texture: Texture | null },
    ): void {
      const field = instance.tf;
      const format = instance.format;
      const content = field.get_text() ?? '';
      const html = field.get_htmlText() ?? '';
      const isHTML = instance.oldText !== content;
      const width = field.get_width();
      const height = field.get_height();
      const wrap = field.get_wordWrap();
      if (instance.finalLayer) instance.removeChild(instance.finalLayer, true);
      if (instance.texture) instance.texture.dispose();
      instance.texture = null;
      instance._wordWrap = wrap;
      instance._fieldWidth = width;
      instance._fieldHeight = height;
      instance._measuredHeight = 0;
      instance._htmlText = '';
      instance._plainText = '';
      instance.renderedText = '';
      instance.oldText = '';
      instance.isHTML = false;
      instance.autoWidthOnNextDraw = false;
      instance.autoHeightOnNextDraw = false;
      instance._sharpness = 0;
      instance.glowFilter = null;
      instance.markup = new RichBitmapMarkup();
      instance.metrics = new Point();
      instance._disposed = false;
      instance.format = format;
      instance.finalLayer = new RichBitmapFontTextRenderer();
      instance.finalLayer.set_touchable(false);
      instance.finalLayer.wordWrap = wrap;
      instance.finalLayer.truncateToFit = false;
      instance.finalLayer.useSeparateBatch = false;
      instance.finalLayer.textureSmoothing = 'bilinear';
      instance.finalLayer.pixelSnapping = false;
      instance.addChild(instance.finalLayer);
      instance.applyFormat();
      if (content.length || html.length) {
        if (isHTML) instance.htmlText = html;
        else instance.text = content;
      }
    }

    /** Restore a still-live native label after its original methods have been reinstalled. */
    public static restoreNative(
      instance: Text & { tf: Game.openfl.text.TextField; texture: Texture | null },
    ): void {
      const html = instance._htmlText;
      const plain = instance._plainText;
      const isHTML = instance.isHTML;
      if (instance.finalLayer) instance.removeChild(instance.finalLayer, true);
      instance.finalLayer = null;
      instance.markup.clear();
      instance.tf.set_wordWrap(instance._wordWrap);
      instance.tf.set_width(instance._fieldWidth);
      instance.tf.set_height(instance._fieldHeight);
      if (!instance.format) throw Error('Cannot restore a native label without its text format');
      instance.tf.set_defaultTextFormat(instance.format);
      if (isHTML) instance.tf.set_htmlText(html);
      else instance.tf.set_text(plain);
      instance.oldText = isHTML ? html : plain;
      instance.draw();
    }

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
      this.finalLayer.set_touchable(false);
      this.finalLayer.wordWrap = this._wordWrap;
      this.finalLayer.truncateToFit = false;
      this.finalLayer.useSeparateBatch = false;
      this.finalLayer.textureSmoothing = 'bilinear';
      this.finalLayer.pixelSnapping = false;
      this.applyFormat();
      this.addChild(this.finalLayer);

      this.set_touchable(false);
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
    private setGlowFilter(param1: GlowFilter | null): void {
      if (this.glowFilter != null) {
        this.finalLayer?.set_filter(null);
        this.glowFilter.dispose();
      }
      this.glowFilter = param1;
      this.requireRenderer().set_filter(this.glowFilter);
    }

    @bound
    public centerPivot(): void {
      this.set_pivotX(this.width / 2);
      this.set_pivotY(this.height / 2);
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
      const format = this.requireFormat();
      if (Number(format.size) == param1) {
        return;
      }
      format.size = param1;
      this.defaultTextFormat = format;
    }

    public get size(): number {
      return Number(this.requireFormat().size);
    }

    public set color(param1: number) {
      const format = this.requireFormat();
      if (Number(format.color) == param1) {
        return;
      }
      format.color = param1;
      this.defaultTextFormat = format;
    }

    public get color(): number {
      return Number(this.requireFormat().color);
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
      const format = this.requireFormat();
      if (String(format.font) == param1) {
        return;
      }
      format.font = param1;
      this.defaultTextFormat = format;
    }

    public set bold(param1: boolean) {
      const format = this.requireFormat();
      if (Boolean(format.bold) == param1) {
        return;
      }
      // Russo One has a single face. Keep this value for API compatibility;
      // the bitmap renderer intentionally does not synthesize a blurred bold.
      format.bold = param1;
      this.defaultTextFormat = format;
    }

    public set wordWrap(param1: boolean) {
      if (this._wordWrap == param1) {
        return;
      }
      this._wordWrap = param1;
      this.requireRenderer().wordWrap = param1;
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
      param1 = param1 == null ? '' : String(param1);
      if (this.isHTML && this.oldText == param1) {
        return;
      }
      this.isHTML = true;
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
      param1 = param1 == null ? '' : String(param1);
      if (!this.isHTML && this.oldText == param1) {
        return;
      }
      this.isHTML = false;
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
    public set defaultTextFormat(param1: TextFormat | null) {
      if (param1 == null) {
        return;
      }
      this.format = param1;
      this.applyFormat();
      // Native Haxe labels often set size/color before enabling word wrap.
      // Styling an empty field must retain its layout width for the first text;
      // an explicit text assignment still owns empty-content auto-sizing.
      if (this.renderedText.length > 0) this.requestAutoSize();
      this.draw();
    }

    @bound
    private requestAutoSize(): void {
      this.autoWidthOnNextDraw = !this._wordWrap;
      this.autoHeightOnNextDraw = true;
    }

    private requireFormat(): TextFormat {
      if (!this.format) throw Error('Text format is not available after disposal');
      return this.format;
    }

    private requireRenderer(): Renderer {
      if (!this.finalLayer) throw Error('Text renderer is not available after disposal');
      return this.finalLayer;
    }

    @bound
    private applyFormat(): void {
      const format = this.requireFormat();
      const renderer = this.requireRenderer();
      let fontName: string =
        format.font == null ? RussoBitmapFontRegistry.PRIMARY_FONT_NAME : String(format.font);
      let fontSize: number = format.size == null ? 10 : Number(format.size);
      if (fontName.toLowerCase() == 'verdana') {
        fontName = VerdanaBitmapFontRegistry.fontNameForSize(fontSize);
      } else if (fontName == RussoBitmapFontRegistry.PRIMARY_FONT_NAME) {
        fontName = RussoBitmapFontRegistry.fontNameForSize(fontSize);
      }
      let fontColor: number = format.color == null ? 0xffffff : Number(format.color) & 0xffffff;
      const align = bitmapTextAlign(format.align);
      let letterSpacing: number = format.letterSpacing == null ? 0 : Number(format.letterSpacing);
      let bitmapFormat: BitmapFontTextFormat = new BitmapFontTextFormat(
        fontName,
        fontSize,
        fontColor,
        align,
      );
      bitmapFormat.letterSpacing = letterSpacing;
      bitmapFormat.leading = format.leading == null ? Text.LEADING : Number(format.leading);
      renderer.textFormat = bitmapFormat;
      // Keep camera-scaled combat text stable. Verdana bitmap labels use
      // integer placement and nearest sampling so compact glyphs stay clear.
      renderer.pixelSnapping = fontName == RussoBitmapFontRegistry.COMBAT_FONT_NAME;
      renderer.textureSmoothing = 'bilinear';
    }

    @bound
    protected draw(): void {
      if (this._disposed || this.finalLayer == null) {
        return;
      }
      if (!this.hasEventListener(Event.REMOVED_FROM_STAGE)) {
        this.addEventListener(Event.REMOVED_FROM_STAGE, this.clean);
      }

      this.finalLayer.set_visible(this.renderedText.length > 0);
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
        this.finalLayer.set_x(-this._fieldWidth / 2);
      } else if (this._hAlign == Text.H_ALIGN_RIGHT) {
        this.finalLayer.set_x(-this._fieldWidth);
      } else {
        this.finalLayer.set_x(0);
      }
      if (this._vAlign == Text.V_ALIGN_MIDDLE) {
        this.finalLayer.set_y(-this._fieldHeight / 2 + Text.LEADING / 2);
      } else if (this._vAlign == Text.V_ALIGN_BOTTOM) {
        this.finalLayer.set_y(-this._fieldHeight + Text.LEADING / 2);
      } else {
        this.finalLayer.set_y(0);
      }

      this.autoWidthOnNextDraw = false;
      this.autoHeightOnNextDraw = false;
    }

    @bound
    private static escapePlainText(param1: string): string {
      return param1.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    }

    @bound
    public clean(param1: Event | null = null): void {
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
        this.finalLayer?.set_filter(null);
        this.glowFilter.dispose();
        this.glowFilter = null;
      }
      this.renderedText = '';
      this.oldText = '';
      this._htmlText = '';
      this._plainText = '';
      this.markup.clear();

      super.dispose();
      this.finalLayer = null;
      this.format = null;
    }
  }

  bridgeNativeProperties(Text);
  return Text;
}
