import type { StyleProvider } from '../ui/StyleProvider';
import type { createPodRewardPulseColor } from './PodRewardPulseColor';
import type { createRoomInvitePulseColor } from './RoomInvitePulseColor';
import type { createEchoPulseColor } from './EchoPulseColor';
import type { createClientDeveloperTagColor } from './ClientDeveloperTagColor';
import type { TextFormat } from '../game/Bindings';
import type { Game } from '../game/Game';
import { Image, MeshBatch, Event, type Texture, type DisplayObject } from '../game/Bindings';
import type { createBitmapTextAdapter } from '../ui/BitmapTextAdapter';
import { BitmapFontTextFormat } from '../ui/BitmapFontTextFormat';
import { Point, StarlingTextField as TextField } from '../game/Bindings';
import type {} from '../game/BitmapFont';
import type { createJapaneseGlyphCache } from './JapaneseGlyphCache';
import type { createChatRoleTags } from './ChatRoleTags';
import { RussoBitmapFontRegistry } from '../ui/RussoBitmapFontRegistry';
import type { BitmapChar, BitmapFont } from '../game/Bindings';
import { JapaneseCachedGlyph } from './JapaneseCachedGlyph';
import { RichBitmapLine } from './RichBitmapLine';
import { RichBitmapGlyph } from './RichBitmapGlyph';
import type { ArtifactLabelResolver } from '../chat/rich/ArtifactLabelResolver';
import { RichBitmapEmojiResolver } from '../chat/rich/RichBitmapEmojiResolver';
import { RichBitmapInlineAtom } from '../chat/rich/RichBitmapInlineAtom';
import { RichBitmapMarkupParser } from '../chat/rich/RichBitmapMarkupParser';
import { RichBitmapEmojiMatch } from '../chat/rich/RichBitmapEmojiMatch';
import { RichBitmapMarkup } from '../chat/rich/RichBitmapMarkup';
// Source port of core/hud/components/chat/rich/RichBitmapFontTextRenderer.as.
import { bound, type Resolve } from '../runtime/HaxeInterop';
export function createRichBitmapFontTextRenderer(resolve: Resolve) {
  // Install the native property aliases used by source-ported font metrics.
  resolve('starling.text.BitmapFont');
  // Glyph metrics also use native property aliases. Binding its constructor
  // alone does not install those getters on Haxe's BitmapChar prototype.
  resolve('starling.text.BitmapChar');
  const JapaneseGlyphCache = resolve(
    'core.hud.components.chat.rich.JapaneseGlyphCache',
  ) as ReturnType<typeof createJapaneseGlyphCache>;
  const ClientDeveloperTagColor = resolve(
    'core.hud.components.ClientDeveloperTagColor',
  ) as ReturnType<typeof createClientDeveloperTagColor>;
  const EchoPulseColor = resolve('core.hud.components.EchoPulseColor') as ReturnType<
    typeof createEchoPulseColor
  >;
  const RoomInvitePulseColor = resolve('core.hud.components.RoomInvitePulseColor') as ReturnType<
    typeof createRoomInvitePulseColor
  >;
  const PodRewardPulseColor = resolve('core.hud.components.PodRewardPulseColor') as ReturnType<
    typeof createPodRewardPulseColor
  >;
  const Style = resolve('core.hud.components.Style') as { readonly COLOR_CLIENT_DEVELOPER: number };
  const ChatRoleTags = resolve('core.hud.components.chat.ChatRoleTags') as ReturnType<
    typeof createChatRoleTags
  >;
  const BaseTextRenderer = resolve('feathers.controls.text.BaseTextRenderer') as ReturnType<
    typeof createBitmapTextAdapter
  >;

  /**
   * Feathers text renderer for lightweight per-glyph bitmap-font HTML.
   *
   * It deliberately borrows the globally registered BitmapFont and never owns
   * or disposes its texture. A renderer uses one MeshBatch regardless of the
   * number of colors or sizes in the string.
   */

  class RichBitmapFontTextRenderer extends BaseTextRenderer {
    static __interfaces__ = ['ITextRenderer'];
    public static globalStyleProvider: StyleProvider<RichBitmapFontTextRenderer> | null = null;

    private static CLIENT_DEVELOPER_TAG: string = '[client_dev]';
    private static LEGACY_CLIENT_DEVELOPER_COLOR: number = 0xc2fc03;
    private static ECHO_LABEL_PATTERN: RegExp =
      /(?:[^\r\n]{1,180} - )?QoLAF \(Server \d+ \/ v\d+\.\d+\.\d+(?: FINAL)? \((?:Public|Private)\)\)/g;
    private static LOGIN_SUFFIX_PATTERN: RegExp =
      /^(?:0|[1-9]\d{0,3})\.(?:0|[1-9]\d{0,3})\.(?:0|[1-9]\d{0,3}) \((?:Public|Private)\)$/;
    private characterBatch: MeshBatch | null = null;
    private japaneseBatches: (MeshBatch | null)[] = [];
    private helperImage: Image | null = null;
    private readonly markup: RichBitmapMarkup = new RichBitmapMarkup();
    private glyphPool: RichBitmapGlyph[] = [];
    private activeGlyphs: RichBitmapGlyph[] = [];
    private emojiMatch: RichBitmapEmojiMatch = new RichBitmapEmojiMatch();
    private _animateClientDeveloperTags: boolean = false;
    private _animateEchoLabels: boolean = false;
    private _animateRoomInvites: boolean = false;
    private _animatePodRewards: boolean = false;
    private clientDeveloperTagStarts: number[] = [];
    private clientDeveloperVertices: number[] = [];
    private echoLabelRanges: number[] = [];
    private echoVertices: number[] = [];
    private roomInviteRanges: number[] = [];
    private roomInviteVertices: number[] = [];
    private podRewardRanges: number[] = [];
    private podRewardVertices: number[] = [];
    private podRewardLastColor: number = -1;
    private lowRelicVertices: number[] = [];
    private lowRelicLastColor: number = -1;
    private animatedColorFrameAttached: boolean = false;
    private clientDeveloperLastColor: number = -1;
    private echoLastColor: number = -1;
    private roomInviteLastColor: number = -1;
    private richDisposed: boolean = false;

    private _textFormat: BitmapFontTextFormat | null = null;
    private _resolvedTextFormat: BitmapFontTextFormat | null = null;
    private _textureSmoothing: string = 'bilinear';
    private _emojiScale: number = 1;
    private _artifactTokenLabelResolver: ArtifactLabelResolver | null = null;
    private _collapseImageLinks: boolean = false;
    private _labelImageLinks: boolean = false;
    // Fractional placement lets the bilinear soft-mask atlas provide a
    // small amount of antialiasing at UI sizes; combat Text instances opt
    // back into snapping explicitly.
    private _pixelSnapping: boolean = false;
    private _truncateToFit: boolean = false;
    private _useSeparateBatch: boolean = false;
    private _measureWrappedWidthAtConstraint: boolean = false;
    private japaneseFallbackEnabled: boolean = true;
    private markupInvalid: boolean = true;
    private layoutInvalid: boolean = true;
    private lastLayoutConstraint: number = NaN;
    private measuredWidth: number = NaN;
    private measuredHeight: number = NaN;
    private _numLines: number = 0;
    private readonly lineTops: number[] = [];

    /** Copy scratch layout positions before another text field reuses this renderer. */
    public copyLineTops(): number[] {
      return this.lineTops.slice();
    }

    constructor() {
      super();
      this.isQuickHitAreaEnabled = true;
      JapaneseGlyphCache.whenReady(this.onJapaneseFontsReady);
    }

    @bound
    private onJapaneseFontsReady(): void {
      if (this.richDisposed) return;
      this.layoutInvalid = true;
      this.invalidate('data');
    }

    /*override*/ protected get defaultStyleProvider(): StyleProvider<RichBitmapFontTextRenderer> | null {
      return RichBitmapFontTextRenderer.globalStyleProvider;
    }

    /** Chat-only opt-in; ordinary labels and compositor scratch copies stay static. */
    public get animateClientDeveloperTags(): boolean {
      return this._animateClientDeveloperTags;
    }

    public set animateClientDeveloperTags(value: boolean) {
      if (this._animateClientDeveloperTags == value) return;
      this._animateClientDeveloperTags = value;
      this.refreshAnimatedColorListeners();
    }

    public get animateEchoLabels(): boolean {
      return this._animateEchoLabels;
    }

    public set animateEchoLabels(value: boolean) {
      if (this._animateEchoLabels == value) return;
      this._animateEchoLabels = value;
      this.refreshAnimatedColorListeners();
    }

    public get animateRoomInvites(): boolean {
      return this._animateRoomInvites;
    }

    public set animateRoomInvites(value: boolean) {
      if (this._animateRoomInvites == value) return;
      this._animateRoomInvites = value;
      this.refreshAnimatedColorListeners();
    }

    @bound
    private refreshAnimatedColorListeners(): void {
      if (
        this._animateClientDeveloperTags ||
        this._animateEchoLabels ||
        this._animateRoomInvites ||
        this._animatePodRewards
      ) {
        this.addEventListener(Event.ADDED_TO_STAGE, this.onAnimatedColorAdded);
        this.addEventListener(Event.REMOVED_FROM_STAGE, this.onAnimatedColorRemoved);
      } else {
        this.removeEventListener(Event.ADDED_TO_STAGE, this.onAnimatedColorAdded);
        this.removeEventListener(Event.REMOVED_FROM_STAGE, this.onAnimatedColorRemoved);
      }
      this.clearAnimatedVertices();
      // One rebuild on opt-in/out, including restoring original marker colors.
      this.layoutInvalid = true;
      this.invalidate('styles');
    }

    public get animatePodRewards(): boolean {
      return this._animatePodRewards;
    }

    public set animatePodRewards(value: boolean) {
      if (this._animatePodRewards == value) return;
      this._animatePodRewards = value;
      this.refreshAnimatedColorListeners();
    }

    public get textFormat(): BitmapFontTextFormat | null {
      return this._textFormat;
    }

    public set textFormat(value: BitmapFontTextFormat | null) {
      if (this._textFormat === value) {
        return;
      }
      this._textFormat = value;
      this._resolvedTextFormat = null;
      this.markupInvalid = true;
      this.layoutInvalid = true;
      this.invalidate('styles');
    }

    public get currentTextFormat(): BitmapFontTextFormat | null {
      this.resolveTextFormat();
      return this._resolvedTextFormat;
    }

    /** Null by default for renderers that do not project rich attachments. */
    public get artifactTokenLabelResolver(): ArtifactLabelResolver | null {
      return this._artifactTokenLabelResolver;
    }

    public set artifactTokenLabelResolver(value: ArtifactLabelResolver | null) {
      if (this._artifactTokenLabelResolver === value) {
        return;
      }
      this._artifactTokenLabelResolver = value;
      this.refreshArtifactTokenLabels();
    }

    public get collapseImageLinks(): boolean {
      return this._collapseImageLinks;
    }

    public set collapseImageLinks(value: boolean) {
      if (this._collapseImageLinks == value) return;
      this._collapseImageLinks = value;
      this.markupInvalid = true;
      this.layoutInvalid = true;
      this.invalidate('data');
    }

    public get labelImageLinks(): boolean {
      return this._labelImageLinks;
    }

    public set labelImageLinks(value: boolean) {
      if (this._labelImageLinks == value) return;
      this._labelImageLinks = value;
      this.markupInvalid = true;
      this.layoutInvalid = true;
      this.invalidate('data');
    }

    /** Re-resolves labels after a session registry/cache update. */
    @bound
    public refreshArtifactTokenLabels(): void {
      this.markupInvalid = true;
      this.layoutInvalid = true;
      this.invalidate('data');
    }

    public get textureSmoothing(): string {
      return this._textureSmoothing;
    }

    public set textureSmoothing(value: string) {
      if (this._textureSmoothing == value) {
        return;
      }
      this._textureSmoothing = value;
      this.layoutInvalid = true;
      this.invalidate('styles');
    }

    /** Multiplier applied only to resolved color-emoji glyphs. */
    public get emojiScale(): number {
      return this._emojiScale;
    }

    public set emojiScale(value: number) {
      value = value === value && isFinite(value) && value > 0 ? value : 1;
      if (this._emojiScale == value) {
        return;
      }
      this._emojiScale = value;
      this.layoutInvalid = true;
      this.invalidate('styles');
    }

    public get pixelSnapping(): boolean {
      return this._pixelSnapping;
    }

    public set pixelSnapping(value: boolean) {
      if (this._pixelSnapping == value) {
        return;
      }
      this._pixelSnapping = value;
      this.invalidate('styles');
    }

    public get truncateToFit(): boolean {
      return this._truncateToFit;
    }

    public set truncateToFit(value: boolean) {
      if (this._truncateToFit == value) {
        return;
      }
      // Kept as a drop-in Feathers style property. Rich chat intentionally
      // lays out all text; callers set this to false.
      this._truncateToFit = value;
      this.invalidate('data');
    }

    public get useSeparateBatch(): boolean {
      return this._useSeparateBatch;
    }

    public set useSeparateBatch(value: boolean) {
      if (this._useSeparateBatch == value) {
        return;
      }
      this._useSeparateBatch = value;
      this.invalidate('styles');
    }

    /**
     * Keeps variable-height virtual lists on one stable wrapping width.
     *
     * Most Feathers controls expect maxWidth to be a ceiling and measure to
     * their natural width below it. Advanced chat is the exception: its
     * virtual layout must retain the full constraint while row heights are
     * discovered, or its validation can oscillate between two wrap widths.
     */
    public get measureWrappedWidthAtConstraint(): boolean {
      return this._measureWrappedWidthAtConstraint;
    }

    public set measureWrappedWidthAtConstraint(value: boolean) {
      if (this._measureWrappedWidthAtConstraint == value) {
        return;
      }
      this._measureWrappedWidthAtConstraint = value;
      this.layoutInvalid = true;
      this.invalidate('size');
    }

    public get numLines(): number {
      return this._numLines;
    }

    public get baseline(): number {
      this.resolveTextFormat();
      if (this._resolvedTextFormat == null || this._resolvedTextFormat.font == null) {
        return 0;
      }
      let size: number = RichBitmapFontTextRenderer.normalizedSize(
        this._resolvedTextFormat.font,
        this._resolvedTextFormat.size,
      );
      return (
        (this._resolvedTextFormat.font.get_baseline() * size) /
        this._resolvedTextFormat.font.get_size()
      );
    }

    @bound
    public measureText(result: Point | null = null): Point {
      if (result == null) {
        result = new Point();
      }
      // Stock Feathers renderers measure without validating themselves.
      // Calling validate() here may dispatch RESIZE into a parent that is
      // already in its own validation pass, returning a virtual List to the
      // validation queue. Prepare the layout without saving measurements or
      // dispatching component events.
      if (this.characterBatch == null) {
        this.initializeNow();
      }
      this.refreshLayoutState();
      result.x =
        this._explicitWidth === this._explicitWidth ? this._explicitWidth : this.measuredWidth;
      result.y =
        this._explicitHeight === this._explicitHeight ? this._explicitHeight : this.measuredHeight;
      return result;
    }

    /** Optional presentation-only scrolling; leaves glyph layout/measurement intact. */
    protected get unscrolledTextWidth(): number {
      return this.measuredWidth;
    }

    @bound
    protected setTextScrollOffset(value: number): void {
      if (this.characterBatch != null) this.characterBatch.set_x(value);
      for (const batch of this.japaneseBatches) {
        if (batch != null) batch.set_x(value);
      }
    }

    /** Returns the decoded visible-text index under a local point. */
    @bound
    public visibleTextIndexAtPoint(localX: number, localY: number): number {
      if (this.characterBatch == null) {
        this.initializeNow();
      }
      this.refreshLayoutState();
      for (const glyph of this.activeGlyphs) {
        if (
          glyph.hitWidth <= 0 ||
          glyph.hitHeight <= 0 ||
          localX < glyph.hitX ||
          localX >= glyph.hitX + glyph.hitWidth ||
          localY < glyph.hitY ||
          localY >= glyph.hitY + glyph.hitHeight
        ) {
          continue;
        }
        return glyph.textBegin;
      }
      return -1;
    }

    /** Looks up marked roles in parsed text, independent of animated vertex RGB. */
    @bound
    public roleTagAtPoint(localX: number, localY: number): string | null {
      let index: number = this.visibleTextIndexAtPoint(localX, localY);
      return ChatRoleTags.atVisibleIndex(this.markup, index);
    }

    /** Maps a painted/visible index back to its raw message source offset. */
    @bound
    public sourceTextIndexAtVisibleIndex(index: number): number {
      if (this.characterBatch == null) {
        this.initializeNow();
      }
      this.refreshLayoutState();
      if (index < 0 || index >= this.markup.sourceStarts.length) {
        return -1;
      }
      return this.markup.sourceStarts[index];
    }

    /** Painted local X of a raw-source caret boundary. */
    @bound
    public localXAtSourceIndex(sourceIndex: number): number {
      if (this.characterBatch == null) this.initializeNow();
      this.refreshLayoutState();
      let visibleIndex: number = this.markup.visibleIndexAtSource(sourceIndex, false);
      let previous: RichBitmapGlyph | null = null;
      for (const glyph of this.activeGlyphs) {
        if (glyph.textBegin >= visibleIndex) return glyph.hitX;
        if (glyph.textEnd <= visibleIndex) previous = glyph;
      }
      return previous == null ? 0 : previous.hitX + previous.hitWidth;
    }

    /** Painted local Y of a raw-source caret boundary. */
    @bound
    public localYAtSourceIndex(sourceIndex: number): number {
      if (this.characterBatch == null) this.initializeNow();
      this.refreshLayoutState();
      let visibleIndex: number = this.markup.visibleIndexAtSource(sourceIndex, false);
      let previous: RichBitmapGlyph | null = null;
      for (const glyph of this.activeGlyphs) {
        if (glyph.textBegin >= visibleIndex) return glyph.hitY;
        if (glyph.textEnd <= visibleIndex) previous = glyph;
      }
      return previous == null ? 0 : previous.hitY;
    }

    /**
     * Composes HTML bitmap text into a Starling TextField's own MeshBatch.
     *
     * This is intentionally a scratch operation: the glyph geometry is copied
     * into {@code target}, so the renderer may be reused immediately by the
     * next TextField. Neither the renderer nor the target owns the font atlas.
     */
    @bound
    public fillExternalMeshBatch(
      target: MeshBatch,
      width: number,
      height: number,
      value: string,
      font: BitmapFont,
      format: TextFormat,
      options: Game.starling.text.TextOptions | null,
    ): void {
      if (target == null || font == null || value == null || value.length == 0) {
        return;
      }
      if (this.characterBatch == null) {
        this.initializeNow();
      }
      let previousJapaneseFallback: boolean = this.japaneseFallbackEnabled;
      this.japaneseFallbackEnabled = false;

      let size: number = format.get_size();
      if (size < 0) {
        size *= -font.get_size();
      }
      size = RichBitmapFontTextRenderer.normalizedSize(font, size);
      let bitmapFormat: BitmapFontTextFormat = new BitmapFontTextFormat(
        font,
        size,
        format.get_color(),
        format.get_horizontalAlign(),
        format.get_leading(),
      );
      bitmapFormat.isKerningEnabled = format.get_kerning();

      // Haxe TextField keeps its previous hit-area width for HTML even when
      // horizontal autosizing is enabled. An empty/short previous value can
      // therefore constrain the next value to one glyph per line. Match the
      // native plain-text compositor's unconstrained measurement width.
      if (
        options != null &&
        (options.get_autoSize() === 'horizontal' || options.get_autoSize() === 'bothDirections')
      ) {
        width = 100000;
      }

      this._textFormat = bitmapFormat;
      this._resolvedTextFormat = bitmapFormat;
      this._text = value;
      this._wordWrap = options != null && options.get_wordWrap();
      this._explicitWidth = Math.max(0, width);
      this._explicitHeight = NaN;
      this._textureSmoothing = font.get_smoothing();
      this.markupInvalid = true;
      this.layoutInvalid = true;
      this.lastLayoutConstraint = NaN;
      this.refreshLayoutState();

      // Match BitmapFont's autoscale behavior closely for fixed-size fields.
      // HTML sizes are reparsed on each pass so relative default-size text
      // shrinks without allocating any textures.
      if (options != null && options.get_autoScale()) {
        while (
          bitmapFormat.size > 3 &&
          (this.measuredHeight > height || (!this._wordWrap && this.measuredWidth > width))
        ) {
          bitmapFormat.size--;
          this.markupInvalid = true;
          this.layoutInvalid = true;
          this.refreshLayoutState();
        }
      }

      let offsetY: number = 0;
      if (format.get_verticalAlign() == 'bottom') {
        offsetY = height - this.measuredHeight;
      } else if (format.get_verticalAlign() == 'center') {
        offsetY = (height - this.measuredHeight) / 2;
      }
      const batch = this.requireCharacterBatch();
      batch.set_x(0);
      batch.set_y(Math.max(0, offsetY));
      target.addMesh(batch);
      batch.set_x(0);
      batch.set_y(0);
      this.japaneseFallbackEnabled = previousJapaneseFallback;
    }

    @bound
    /*override*/
    protected initialize(): void {
      if (this.characterBatch == null) {
        this.characterBatch = new MeshBatch();
        this.characterBatch.set_touchable(false);
        this.addChild(this.characterBatch);
      }
    }

    @bound
    /*override*/
    protected draw(): void {
      this.refreshLayoutState();
      this.saveMeasurements(
        this.measuredWidth,
        this.measuredHeight,
        this.measuredWidth,
        this.measuredHeight,
      );
      this.updateAnimatedColors();
    }

    @bound
    private refreshLayoutState(): void {
      let dataChanged: boolean = this.isInvalid('data');
      let sizeChanged: boolean = this.isInvalid('size');
      let stylesChanged: boolean = this.isInvalid('styles') || this.isInvalid('state');
      if (dataChanged) {
        this.markupInvalid = true;
        this.layoutInvalid = true;
      }
      if (stylesChanged) {
        this.markupInvalid = true;
        this.layoutInvalid = true;
        this._resolvedTextFormat = null;
      }
      if (sizeChanged) {
        this.layoutInvalid = true;
      }

      this.resolveTextFormat();

      if (this.characterBatch != null) {
        this.characterBatch.set_pixelSnapping(this._pixelSnapping);
        this.characterBatch.set_batchable(!this._useSeparateBatch);
      }
      for (const japaneseBatch of this.japaneseBatches) {
        if (japaneseBatch == null) continue;
        japaneseBatch.set_pixelSnapping(this._pixelSnapping);
        japaneseBatch.set_batchable(!this._useSeparateBatch);
      }

      let constraint: number = this.getLayoutConstraint();
      if (
        constraint != this.lastLayoutConstraint &&
        !(isNaN(constraint) && isNaN(this.lastLayoutConstraint))
      ) {
        this.layoutInvalid = true;
      }
      if (this.markupInvalid) {
        this.refreshMarkup();
      }
      if (this.layoutInvalid) {
        this.layout(constraint);
      }
    }

    @bound
    private refreshMarkup(): void {
      this.markupInvalid = false;
      let defaultSize: number = 13;
      let defaultColor: number = 0xffffff;
      if (this._resolvedTextFormat != null) {
        if (this._resolvedTextFormat.font != null) {
          defaultSize = RichBitmapFontTextRenderer.normalizedSize(
            this._resolvedTextFormat.font,
            this._resolvedTextFormat.size,
          );
        }
        defaultColor = this._resolvedTextFormat.color;
      }
      RichBitmapMarkupParser.parse(
        this._text,
        defaultSize,
        defaultColor,
        this.markup,
        this._artifactTokenLabelResolver,
        this._collapseImageLinks,
        this._labelImageLinks,
      );
    }

    @bound
    private getLayoutConstraint(): number {
      if (!this._wordWrap) {
        return Infinity;
      }
      let width: number = this._explicitWidth;
      if (width !== width) {
        width = this._explicitMaxWidth;
      }
      if (width !== width || width == Infinity) {
        return Infinity;
      }
      return Math.max(0, width);
    }

    @bound
    private layout(constraint: number): void {
      this.layoutInvalid = false;
      this.lastLayoutConstraint = constraint;
      this.measuredWidth = 0;
      this.measuredHeight = 0;
      this._numLines = 0;
      this.lineTops.length = 0;
      this.clearAnimatedVertices();
      this.findClientDeveloperTags();
      this.findEchoLabels();
      this.findRoomInvites();
      this.findPodRewards();
      this.recycleActiveGlyphs();
      this.requireCharacterBatch().clear();
      for (const japaneseBatch of this.japaneseBatches) {
        if (japaneseBatch != null) japaneseBatch.clear();
      }

      if (
        this._resolvedTextFormat == null ||
        this._resolvedTextFormat.font == null ||
        this.markup.text.length == 0
      ) {
        return;
      }

      let font: BitmapFont = this._resolvedTextFormat.font;
      if (this.japaneseFallbackEnabled) {
        JapaneseGlyphCache.prepare(this.markup.text);
      }
      let defaultSize: number = RichBitmapFontTextRenderer.normalizedSize(
        font,
        this._resolvedTextFormat.size,
      );
      let defaultLineHeight: number = (font.get_lineHeight() * defaultSize) / font.get_size();
      let line: RichBitmapLine = new RichBitmapLine();
      let top: number = 0;
      let length: number = this.markup.text.length;
      let endsWithLineBreak: boolean = false;
      let atomIndex: number = 0;
      let atom: RichBitmapInlineAtom | null =
        this.markup.atoms.length == 0 ? null : this.markup.atoms[0];

      for (let i: number = 0; i < length; i++) {
        let charID: number = this.markup.text.charCodeAt(i);
        if (charID == 13 || charID == 10) {
          if (charID == 13 && i + 1 < length && this.markup.text.charCodeAt(i + 1) == 10) {
            i++;
          }
          top = this.finishLine(line, top, defaultLineHeight, constraint);
          line.clear();
          endsWithLineBreak = true;
          continue;
        }
        endsWithLineBreak = false;

        let scalarStart: number = i;
        while (atom != null && scalarStart >= atom.visibleEnd) {
          atomIndex++;
          atom = atomIndex < this.markup.atoms.length ? this.markup.atoms[atomIndex] : null;
        }
        RichBitmapEmojiResolver.resolve(this.markup.text, i, this.emojiMatch);
        let scalarEnd: number = Math.min(
          length,
          scalarStart + Math.max(1, this.emojiMatch.consumed),
        );
        i += this.emojiMatch.consumed - 1;
        if (this.emojiMatch.isIgnored) {
          continue;
        }
        charID = this.emojiMatch.isEmoji
          ? this.emojiMatch.glyphID
          : Number(this.emojiMatch.codePoint);
        let glyphColor: number =
          this.markup.colors[Math.min(scalarStart, this.markup.colors.length - 1)];
        if (
          atom != null &&
          scalarStart >= atom.visibleBegin &&
          scalarStart < atom.visibleEnd &&
          atom.displayColor != RichBitmapInlineAtom.INHERIT_COLOR
        ) {
          glyphColor = atom.displayColor;
        }

        let glyph: RichBitmapGlyph = this.acquireGlyph();
        this.configureGlyph(
          glyph,
          font,
          charID,
          this.emojiMatch.codePoint,
          this.markup.sizes[Math.min(scalarStart, this.markup.sizes.length - 1)],
          glyphColor,
          this.emojiMatch.isEmoji,
          scalarStart,
          scalarEnd,
        );

        if (glyph.isWhitespace && line.glyphs.length == 0) {
          this.recycleGlyph(glyph);
          continue;
        }
        this.appendGlyph(line, glyph);

        if (constraint != Infinity && line.width > constraint) {
          if (glyph.isWhitespace) {
            line.glyphs.pop();
            this.recycleGlyph(glyph);
            this.recomputeLine(line);
            top = this.finishLine(line, top, defaultLineHeight, constraint);
            line.clear();
            continue;
          }

          let breakIndex: number = this.findLastWhitespace(line);
          if (breakIndex >= 0) {
            let moved: RichBitmapGlyph[] = line.glyphs.splice(
              breakIndex + 1,
              line.glyphs.length - breakIndex - 1,
            );
            while (line.glyphs.length > 0 && line.glyphs[line.glyphs.length - 1].isWhitespace) {
              const whitespace = line.glyphs.pop();
              if (whitespace) this.recycleGlyph(whitespace);
            }
            this.recomputeLine(line);
            top = this.finishLine(line, top, defaultLineHeight, constraint);
            line.clear();
            for (const movedGlyph of moved) {
              this.appendGlyph(line, movedGlyph);
            }
            moved.length = 0;
          } else if (line.glyphs.length > 1) {
            line.glyphs.pop();
            this.recomputeLine(line);
            top = this.finishLine(line, top, defaultLineHeight, constraint);
            line.clear();
            this.appendGlyph(line, glyph);
          }
        }
      }

      // A terminal newline already finalized its preceding line. Do not add
      // a second, phantom empty line; this matches Starling BitmapFont's
      // trailing-newline measurement while preserving intentional blank
      // lines from consecutive newline characters.
      if (!endsWithLineBreak) {
        this.finishLine(line, top, defaultLineHeight, constraint);
      }

      // Advanced chat opts into the full constraint so its variable-height
      // virtual rows do not alternate between maxWidth and their longest
      // rendered line. Auto-sized controls retain normal natural widths.
      if (this._measureWrappedWidthAtConstraint && this._wordWrap && constraint != Infinity) {
        this.measuredWidth = constraint;
      }
      this.syncAnimatedColorFrame();
    }

    @bound
    private configureGlyph(
      glyph: RichBitmapGlyph,
      font: BitmapFont,
      charID: number,
      sourceCodePoint: number,
      size: number,
      color: number,
      isEmoji: boolean,
      textBegin: number,
      textEnd: number,
    ): void {
      let character: BitmapChar | null = font.getChar(charID);
      let japaneseGlyph: JapaneseCachedGlyph | null = null;
      if (character == null && this.japaneseFallbackEnabled && !isEmoji) {
        japaneseGlyph = JapaneseGlyphCache.acquire(sourceCodePoint);
        if (japaneseGlyph != null) {
          character = japaneseGlyph.character;
        }
      }
      if (character == null) {
        character = font.getChar(65533);
      }
      if (character == null) {
        character = font.getChar(63);
      }
      if (character == null) {
        character = font.getChar(32);
      }
      glyph.character = character;
      glyph.japaneseGlyph = japaneseGlyph;
      glyph.batchGroup = japaneseGlyph == null ? 0 : japaneseGlyph.batchGroup;
      glyph.charID = character == null ? charID : character.charID;
      glyph.isEmoji = isEmoji && character != null && character.charID == charID;
      // Color glyph pixels already contain their final RGB values. White
      // preserves them through Starling's regular tinted-image shader.
      glyph.color = glyph.isEmoji ? 0xffffff : color;
      // Both halves of the unified atlas use native 48 px metrics. Keeping
      // the emoji denominator explicit prevents a future text-font size
      // change from silently resizing its color glyphs.
      let resolvedSize: number = RichBitmapFontTextRenderer.normalizedSize(font, size);
      if (japaneseGlyph != null) resolvedSize = Math.max(20, resolvedSize);
      glyph.scale =
        resolvedSize / (glyph.isEmoji ? RichBitmapGlyph.EMOJI_NATIVE_SIZE : font.get_size());
      if (glyph.isEmoji) {
        glyph.scale *= this._emojiScale;
      }
      glyph.isWhitespace = sourceCodePoint == 32 || sourceCodePoint == 9;
      glyph.textBegin = textBegin;
      glyph.textEnd = textEnd;
      glyph.isClientDeveloperTag =
        !glyph.isEmoji && this.isClientDeveloperGlyph(textBegin, textEnd, glyph.color);
      glyph.isEchoLabel = !glyph.isEmoji && this.isEchoGlyph(textBegin, textEnd, glyph.color);
      glyph.advance = character == null ? 0 : character.get_xAdvance() * glyph.scale;
      if (sourceCodePoint == 9) {
        glyph.advance *= 4;
      }
    }

    @bound
    private appendGlyph(line: RichBitmapLine, glyph: RichBitmapGlyph): void {
      const format = this._resolvedTextFormat;
      if (!format) throw Error('Resolve a text format before laying out glyphs');
      let kerning: number = 0;
      if (
        format.isKerningEnabled &&
        line.previousCharID >= 0 &&
        glyph.character != null &&
        !line.previousWasEmoji &&
        !glyph.isEmoji
      ) {
        kerning = glyph.character.getKerning(line.previousCharID) * glyph.scale;
      }
      line.cursor += kerning;
      glyph.x = line.cursor;
      glyph.visualRight = glyph.x;
      if (glyph.character != null) {
        glyph.visualRight +=
          (glyph.character.get_xOffset() + glyph.character.get_width()) * glyph.scale;
        line.lineHeight = Math.max(line.lineHeight, format.font.get_lineHeight() * glyph.scale);
        line.baseline = Math.max(line.baseline, format.font.get_baseline() * glyph.scale);
      }
      line.cursor += glyph.advance + format.letterSpacing;
      line.width = Math.max(line.width, line.cursor, glyph.visualRight);
      line.previousCharID = glyph.charID;
      line.previousWasEmoji = glyph.isEmoji;
      line.glyphs.push(glyph);
    }

    @bound
    private recomputeLine(line: RichBitmapLine): void {
      let glyphs: RichBitmapGlyph[] = line.glyphs.concat();
      line.clear();
      for (const glyph of glyphs) {
        this.appendGlyph(line, glyph);
      }
      glyphs.length = 0;
    }

    @bound
    private findLastWhitespace(line: RichBitmapLine): number {
      for (let i: number = line.glyphs.length - 2; i >= 0; i--) {
        if (line.glyphs[i].isWhitespace) {
          return i;
        }
      }
      return -1;
    }

    @bound
    private finishLine(
      line: RichBitmapLine,
      top: number,
      defaultLineHeight: number,
      constraint: number,
    ): number {
      const format = this._resolvedTextFormat;
      if (!format) throw Error('Resolve a text format before laying out glyphs');
      let font: BitmapFont = format.font;
      let lineHeight: number = line.lineHeight > 0 ? line.lineHeight : defaultLineHeight;

      // Only an oversized whitespace glyph is an attachment spacer. Keep
      // the historical baseline for every ordinary/mixed-size rich-text
      // line, and bottom-align visible text only inside attachment rows.
      let maxVisibleLineHeight: number = 0;
      let maxVisibleDescent: number = 0;
      let maxWhitespaceLineHeight: number = 0;
      for (const baselineGlyph of line.glyphs) {
        if (baselineGlyph.character == null) continue;
        let glyphLineHeight: number = font.get_lineHeight() * baselineGlyph.scale;
        if (baselineGlyph.isWhitespace) {
          maxWhitespaceLineHeight = Math.max(maxWhitespaceLineHeight, glyphLineHeight);
          continue;
        }
        maxVisibleLineHeight = Math.max(maxVisibleLineHeight, glyphLineHeight);
        let descent: number = (font.get_lineHeight() - font.get_baseline()) * baselineGlyph.scale;
        maxVisibleDescent = Math.max(maxVisibleDescent, descent);
      }
      let hasAttachmentSpacer: boolean =
        maxVisibleLineHeight > 0 && maxWhitespaceLineHeight > maxVisibleLineHeight + 0.01;
      let lineBaseline: number = hasAttachmentSpacer
        ? lineHeight - maxVisibleDescent
        : line.baseline > 0
          ? line.baseline
          : this.baseline;
      if (this._numLines > 0) {
        top += format.leading;
      }
      this.lineTops.push(top);
      let alignmentWidth: number = constraint;
      if (alignmentWidth == Infinity && this._explicitWidth === this._explicitWidth) {
        alignmentWidth = this._explicitWidth;
      }
      let offsetX: number = 0;
      if (alignmentWidth != Infinity && alignmentWidth === alignmentWidth) {
        if (format.align == 'center') {
          offsetX = Math.round((alignmentWidth - line.width) / 2);
        } else if (format.align == 'right') {
          offsetX = alignmentWidth - line.width;
        }
      }

      for (const glyph of line.glyphs) {
        glyph.hitX = offsetX + glyph.x + font.get_offsetX() * glyph.scale;
        glyph.hitY = top;
        glyph.hitWidth = Math.max(
          1,
          glyph.advance + format.letterSpacing,
          glyph.visualRight - glyph.x,
        );
        glyph.hitHeight = lineHeight;
        this.addGlyphToBatch(
          glyph,
          offsetX + glyph.x + font.get_offsetX() * glyph.scale,
          top + lineBaseline - font.get_baseline() * glyph.scale + font.get_offsetY() * glyph.scale,
        );
      }

      this.measuredWidth = Math.max(this.measuredWidth, line.width);
      top += lineHeight;
      this.measuredHeight = top;
      this._numLines++;
      return top;
    }

    @bound
    private addGlyphToBatch(glyph: RichBitmapGlyph, x: number, y: number): void {
      let character: BitmapChar | null = glyph.character;
      if (character == null) {
        return;
      }
      let texture: Texture = character.get_texture();
      const frame = texture.get_frame();
      if (
        (frame != null && (frame.width == 0 || frame.height == 0)) ||
        (frame == null && (texture.get_width() == 0 || texture.get_height() == 0))
      ) {
        return;
      }
      if (this.helperImage == null) {
        this.helperImage = new Image(texture);
      } else {
        this.helperImage.set_texture(texture);
        this.helperImage.readjustSize();
      }
      this.helperImage.set_x(x + character.get_xOffset() * glyph.scale);
      this.helperImage.set_y(y + character.get_yOffset() * glyph.scale);
      this.helperImage.set_scaleX(glyph.scale);
      this.helperImage.set_scaleY(glyph.scale);
      this.helperImage.set_color(glyph.color);
      this.helperImage.set_alpha(1);
      this.helperImage.set_textureSmoothing(this._textureSmoothing);
      this.helperImage.set_pixelSnapping(this._pixelSnapping);
      let targetBatch: MeshBatch = this.batchForGroup(glyph.batchGroup);
      let firstVertex: number = targetBatch.get_numVertices();
      targetBatch.addMesh(this.helperImage);
      let animatedVertices: number[] | null =
        targetBatch !== this.characterBatch
          ? null
          : glyph.isClientDeveloperTag
            ? this.clientDeveloperVertices
            : glyph.isEchoLabel
              ? this.echoVertices
              : !glyph.isEmoji &&
                  this.isRoomInviteGlyph(glyph.textBegin, glyph.textEnd, glyph.color)
                ? this.roomInviteVertices
                : !glyph.isEmoji &&
                    this.isPodRewardGlyph(glyph.textBegin, glyph.textEnd, glyph.color)
                  ? glyph.color == PodRewardPulseColor.LOW_RELIC_MARKER_COLOR
                    ? this.lowRelicVertices
                    : this.podRewardVertices
                  : null;
      if (animatedVertices != null) {
        for (let vertex: number = firstVertex; vertex < targetBatch.get_numVertices(); vertex++) {
          animatedVertices.push(vertex);
        }
      }
    }

    private requireCharacterBatch(): MeshBatch {
      if (!this.characterBatch) throw Error('Initialize the renderer before composing glyphs');
      return this.characterBatch;
    }

    @bound
    private batchForGroup(group: number): MeshBatch {
      if (group <= 0) return this.requireCharacterBatch();
      let index: number = group - 1;
      while (this.japaneseBatches.length <= index) {
        this.japaneseBatches.push(null);
      }
      let batch = this.japaneseBatches[index];
      if (batch == null) {
        batch = new MeshBatch();
        batch.set_touchable(false);
        batch.set_pixelSnapping(this._pixelSnapping);
        batch.set_batchable(!this._useSeparateBatch);
        this.japaneseBatches[index] = batch;
        this.addChild(batch);
      }
      return batch;
    }

    @bound
    private findClientDeveloperTags(): void {
      this.clientDeveloperTagStarts.length = 0;
      if (!this._animateClientDeveloperTags) return;
      let start: number = this.markup.text.indexOf(RichBitmapFontTextRenderer.CLIENT_DEVELOPER_TAG);
      while (start >= 0) {
        let color: number = this.markup.colors[start];
        if (
          color == Style.COLOR_CLIENT_DEVELOPER ||
          color == RichBitmapFontTextRenderer.LEGACY_CLIENT_DEVELOPER_COLOR
        ) {
          let end: number = start + RichBitmapFontTextRenderer.CLIENT_DEVELOPER_TAG.length;
          let matching: boolean = true;
          for (let i: number = start; i < end; i++) {
            if (this.markup.colors[i] != color) {
              matching = false;
              break;
            }
          }
          if (matching) this.clientDeveloperTagStarts.push(start);
        }
        start = this.markup.text.indexOf(
          RichBitmapFontTextRenderer.CLIENT_DEVELOPER_TAG,
          start + RichBitmapFontTextRenderer.CLIENT_DEVELOPER_TAG.length,
        );
      }
    }

    @bound
    private isClientDeveloperGlyph(begin: number, end: number, color: number): boolean {
      if (
        color != Style.COLOR_CLIENT_DEVELOPER &&
        color != RichBitmapFontTextRenderer.LEGACY_CLIENT_DEVELOPER_COLOR
      )
        return false;
      for (const start of this.clientDeveloperTagStarts) {
        if (
          begin >= start &&
          end <= start + RichBitmapFontTextRenderer.CLIENT_DEVELOPER_TAG.length
        ) {
          return true;
        }
      }
      return false;
    }

    @bound
    private findEchoLabels(): void {
      this.echoLabelRanges.length = 0;
      if (!this._animateEchoLabels) return;
      // Match the visible label and its existing gold marker, not arbitrary
      // gold text/artifacts. Wire messages and stored HTML stay unchanged.
      RichBitmapFontTextRenderer.ECHO_LABEL_PATTERN.lastIndex = 0;
      let match: RegExpExecArray | null;
      while (
        (match = RichBitmapFontTextRenderer.ECHO_LABEL_PATTERN.exec(this.markup.text)) != null
      ) {
        let start: number = Number(match.index);
        let end: number = start + String(match[0]).length;
        let matching: boolean = true;
        for (let i: number = start; i < end; i++) {
          if (this.markup.colors[i] != EchoPulseColor.MARKER_COLOR) {
            matching = false;
            break;
          }
        }
        if (matching) this.echoLabelRanges.push(start, end);
      }
    }

    @bound
    private isEchoGlyph(begin: number, end: number, color: number): boolean {
      if (color != EchoPulseColor.MARKER_COLOR) return false;
      for (let i: number = 0; i < this.echoLabelRanges.length; i += 2) {
        if (begin >= this.echoLabelRanges[i] && end <= this.echoLabelRanges[i + 1]) {
          return true;
        }
      }
      return false;
    }

    @bound
    private findRoomInvites(): void {
      this.roomInviteRanges.length = 0;
      if (!this._animateRoomInvites) return;
      // A reserved visible prefix AND marker color are required; ordinary
      // gold text never opts in. This only marks glyphs, not executable data.
      for (const prefix of [RoomInvitePulseColor.LABEL_PREFIX, RoomInvitePulseColor.RADIO_PREFIX]) {
        let start: number = this.markup.text.indexOf(prefix);
        while (start >= 0) {
          let end: number = start;
          while (
            end < this.markup.text.length &&
            this.markup.colors[end] == RoomInvitePulseColor.MARKER_COLOR
          )
            end++;
          if (end >= start + prefix.length) this.roomInviteRanges.push(start, end);
          start = this.markup.text.indexOf(prefix, Math.max(start + prefix.length, end));
        }
      }
      this.findLoginNotices();
      this.findEmperorDefeatNotices();
    }

    @bound
    private findLoginNotices(): void {
      // Simple chat combines messages with line breaks; Advanced chat uses
      // one row each. Recognize complete logical lines before soft wrapping,
      // so adjacent marker-colored prose never inherits the login animation.
      let phrase: string = RoomInvitePulseColor.LOGIN_PHRASE;
      let start: number = 0;
      while (start < this.markup.text.length) {
        let end: number = start;
        while (
          end < this.markup.text.length &&
          this.markup.text.charCodeAt(end) != 10 &&
          this.markup.text.charCodeAt(end) != 13
        )
          end++;
        let line: string = this.markup.text.substring(start, end);
        let phraseAt: number = line.lastIndexOf(phrase);
        if (
          phraseAt > 0 &&
          RichBitmapFontTextRenderer.LOGIN_SUFFIX_PATTERN.test(
            line.substr(phraseAt + phrase.length),
          )
        ) {
          let matching: boolean = true;
          for (let i: number = start; i < end; i++) {
            if (this.markup.colors[i] != RoomInvitePulseColor.MARKER_COLOR) {
              matching = false;
              break;
            }
          }
          if (matching) this.roomInviteRanges.push(start, end);
        }
        start = end + 1;
      }
    }

    @bound
    private findEmperorDefeatNotices(): void {
      // This local notice deliberately has no visible invitation prefix. Match
      // only the complete reserved line plus marker color so ordinary gold
      // chat text cannot accidentally opt into the attention pulse.
      let notice: string = RoomInvitePulseColor.EMPEROR_DEFEAT_TEXT;
      let start: number = 0;
      while (start < this.markup.text.length) {
        let end: number = start;
        while (
          end < this.markup.text.length &&
          this.markup.text.charCodeAt(end) != 10 &&
          this.markup.text.charCodeAt(end) != 13
        )
          end++;
        if (
          end - start == notice.length &&
          this.markup.text.substr(start, notice.length) == notice
        ) {
          let matching: boolean = true;
          for (let i: number = start; i < end; i++) {
            if (this.markup.colors[i] != RoomInvitePulseColor.MARKER_COLOR) {
              matching = false;
              break;
            }
          }
          if (matching) this.roomInviteRanges.push(start, end);
        }
        start = end + 1;
      }
    }

    @bound
    private isRoomInviteGlyph(begin: number, end: number, color: number): boolean {
      if (color != RoomInvitePulseColor.MARKER_COLOR) return false;
      for (let i: number = 0; i < this.roomInviteRanges.length; i += 2) {
        if (begin >= this.roomInviteRanges[i] && end <= this.roomInviteRanges[i + 1]) return true;
      }
      return false;
    }

    @bound
    private findPodRewards(): void {
      this.podRewardRanges.length = 0;
      if (!this._animatePodRewards) return;
      let start: number = 0;
      while (start < this.markup.text.length) {
        let end: number = start;
        while (
          end < this.markup.text.length &&
          this.markup.text.charCodeAt(end) != 10 &&
          this.markup.text.charCodeAt(end) != 13
        )
          end++;
        if (PodRewardPulseColor.isNoticeText(this.markup.text.substring(start, end))) {
          let marker: number = this.markup.colors[start];
          let matching: boolean =
            marker == PodRewardPulseColor.MARKER_COLOR ||
            marker == PodRewardPulseColor.LOW_RELIC_MARKER_COLOR;
          for (let i: number = start; i < end; i++) {
            if (this.markup.colors[i] != marker) {
              matching = false;
              break;
            }
          }
          if (matching) this.podRewardRanges.push(start, end);
        }
        start = end + 1;
      }
    }

    @bound
    private isPodRewardGlyph(begin: number, end: number, color: number): boolean {
      if (
        color != PodRewardPulseColor.MARKER_COLOR &&
        color != PodRewardPulseColor.LOW_RELIC_MARKER_COLOR
      )
        return false;
      for (let i: number = 0; i < this.podRewardRanges.length; i += 2) {
        if (begin >= this.podRewardRanges[i] && end <= this.podRewardRanges[i + 1]) return true;
      }
      return false;
    }

    @bound
    private clearAnimatedVertices(): void {
      if (this.animatedColorFrameAttached) {
        this.removeEventListener(Event.ENTER_FRAME, this.onAnimatedColorFrame);
        this.animatedColorFrameAttached = false;
      }
      this.clientDeveloperVertices.length = 0;
      this.echoVertices.length = 0;
      this.roomInviteVertices.length = 0;
      this.podRewardVertices.length = 0;
      this.podRewardLastColor = -1;
      this.lowRelicVertices.length = 0;
      this.lowRelicLastColor = -1;
      this.clientDeveloperLastColor = -1;
      this.echoLastColor = -1;
      this.roomInviteLastColor = -1;
    }

    @bound
    private syncAnimatedColorFrame(): void {
      let needed: boolean =
        this.get_stage() != null &&
        ((this._animateClientDeveloperTags && this.clientDeveloperVertices.length > 0) ||
          (this._animateEchoLabels && this.echoVertices.length > 0) ||
          (this._animateRoomInvites && this.roomInviteVertices.length > 0) ||
          (this._animatePodRewards &&
            (this.podRewardVertices.length > 0 || this.lowRelicVertices.length > 0)));
      if (needed == this.animatedColorFrameAttached) return;
      this.animatedColorFrameAttached = needed;
      if (needed) this.addEventListener(Event.ENTER_FRAME, this.onAnimatedColorFrame);
      else this.removeEventListener(Event.ENTER_FRAME, this.onAnimatedColorFrame);
    }

    @bound
    private onAnimatedColorAdded(event: Event): void {
      this.syncAnimatedColorFrame();
    }

    @bound
    private onAnimatedColorRemoved(event: Event): void {
      // Do not retain a virtualized/recycled row through Stage's frame list.
      this.removeEventListener(Event.ENTER_FRAME, this.onAnimatedColorFrame);
      this.animatedColorFrameAttached = false;
    }

    @bound
    private onAnimatedColorFrame(event: Event): void {
      // Validation, not animation, owns parsing/layout and recycled row data.
      if (this.markupInvalid || this.layoutInvalid || this.isInvalid()) return;
      this.updateAnimatedColors();
    }

    @bound
    private updateAnimatedColors(): void {
      if (
        this.characterBatch == null ||
        this.get_stage() == null ||
        (this.clientDeveloperVertices.length == 0 &&
          this.echoVertices.length == 0 &&
          this.roomInviteVertices.length == 0 &&
          this.podRewardVertices.length == 0 &&
          this.lowRelicVertices.length == 0)
      )
        return;
      let current: DisplayObject | null = this;
      while (current != null) {
        if (!current.get_visible() || current.get_alpha() <= 0) return;
        current = current.get_parent();
      }
      let changed: boolean = false;
      let color: number;
      let vertex: number;
      if (this._animateClientDeveloperTags && this.clientDeveloperVertices.length > 0) {
        color = ClientDeveloperTagColor.currentColor;
        if (this.clientDeveloperLastColor != color) {
          this.clientDeveloperLastColor = color;
          for (const vertex of this.clientDeveloperVertices) {
            this.characterBatch.setVertexColor(vertex, color);
          }
          changed = true;
        }
      }
      if (this._animateEchoLabels && this.echoVertices.length > 0) {
        color = EchoPulseColor.currentColor;
        if (this.echoLastColor != color) {
          this.echoLastColor = color;
          for (const vertex of this.echoVertices) {
            this.characterBatch.setVertexColor(vertex, color);
          }
          changed = true;
        }
      }
      if (this._animateRoomInvites && this.roomInviteVertices.length > 0) {
        color = RoomInvitePulseColor.currentColor;
        if (this.roomInviteLastColor != color) {
          this.roomInviteLastColor = color;
          for (const vertex of this.roomInviteVertices) {
            this.characterBatch.setVertexColor(vertex, color);
          }
          changed = true;
        }
      }
      if (this._animatePodRewards && this.podRewardVertices.length > 0) {
        color = PodRewardPulseColor.currentColor;
        if (this.podRewardLastColor != color) {
          this.podRewardLastColor = color;
          for (const vertex of this.podRewardVertices) {
            this.characterBatch.setVertexColor(vertex, color);
          }
          changed = true;
        }
      }
      if (this._animatePodRewards && this.lowRelicVertices.length > 0) {
        color = PodRewardPulseColor.currentLowRelicColor;
        if (this.lowRelicLastColor != color) {
          this.lowRelicLastColor = color;
          for (const vertex of this.lowRelicVertices) {
            this.characterBatch.setVertexColor(vertex, color);
          }
          changed = true;
        }
      }
      // Invalidate Starling's parent render cache, never Feathers text/layout.
      if (changed) this.setRequiresRedraw();
    }

    @bound
    private acquireGlyph(): RichBitmapGlyph {
      let glyph: RichBitmapGlyph = this.glyphPool.pop() ?? new RichBitmapGlyph();
      this.activeGlyphs.push(glyph);
      return glyph;
    }

    @bound
    private recycleGlyph(glyph: RichBitmapGlyph): void {
      let index: number = this.activeGlyphs.indexOf(glyph);
      if (index >= 0) {
        this.activeGlyphs.splice(index, 1);
      }
      JapaneseGlyphCache.release(glyph.japaneseGlyph);
      glyph.clear();
      this.glyphPool.push(glyph);
    }

    @bound
    private recycleActiveGlyphs(): void {
      while (this.activeGlyphs.length > 0) {
        const glyph = this.activeGlyphs.pop();
        if (!glyph) break;
        JapaneseGlyphCache.release(glyph.japaneseGlyph);
        glyph.clear();
        this.glyphPool.push(glyph);
      }
    }

    @bound
    private static normalizedSize(font: BitmapFont, value: number): number {
      return value === value && isFinite(value) && value > 0 ? value : font.get_size();
    }

    /**
     * Resolves Feathers' modern state-aware FontStylesSet without replacing an
     * explicitly supplied BitmapFontTextFormat. Aeon passes its inherited
     * Starling TextFormat through this path, while chat and legacy wrappers
     * continue to own their explicit bitmap formats.
     */
    @bound
    private resolveTextFormat(): void {
      if (this._resolvedTextFormat != null) {
        return;
      }
      if (this._textFormat != null) {
        this._resolvedTextFormat = this._textFormat;
        return;
      }
      if (this._fontStyles == null) {
        return;
      }

      let inherited: TextFormat | null = this._fontStyles.getTextFormatForTarget(this);
      if (inherited == null) {
        return;
      }
      let inheritedFontName: string = inherited.get_font();
      if (
        inheritedFontName == null ||
        inheritedFontName.toLowerCase() == RussoBitmapFontRegistry.DEVICE_FONT_ALIAS ||
        inheritedFontName == RussoBitmapFontRegistry.PRIMARY_FONT_NAME
      ) {
        inheritedFontName = RussoBitmapFontRegistry.fontNameForSize(inherited.get_size());
      }
      let font: BitmapFont | null = TextField.getBitmapFont(inheritedFontName);
      if (font == null) {
        // The Aeon base theme uses the device-font name "_sans". Falling
        // back to Russo keeps custom FontStylesSet values useful even when
        // a caller supplies another unavailable device-font name.
        font = TextField.getBitmapFont(
          RussoBitmapFontRegistry.fontNameForSize(inherited.get_size()),
        );
      }
      if (font == null) {
        return;
      }

      let size: number = inherited.get_size();
      if (size < 0) {
        size *= -font.get_size();
      }
      let bitmapFormat: BitmapFontTextFormat = new BitmapFontTextFormat(
        font,
        RichBitmapFontTextRenderer.normalizedSize(font, size),
        inherited.get_color(),
        inherited.get_horizontalAlign(),
        inherited.get_leading(),
      );
      bitmapFormat.isKerningEnabled = inherited.get_kerning();
      this._resolvedTextFormat = bitmapFormat;
    }

    @bound
    /*override*/
    public dispose(): void {
      if (this.richDisposed) return;
      this.richDisposed = true;
      JapaneseGlyphCache.removeReadyCallback(this.onJapaneseFontsReady);
      this.removeEventListener(Event.ADDED_TO_STAGE, this.onAnimatedColorAdded);
      this.removeEventListener(Event.REMOVED_FROM_STAGE, this.onAnimatedColorRemoved);
      this.clearAnimatedVertices();
      this.clientDeveloperTagStarts.length = 0;
      this.clientDeveloperTagStarts = [];
      this.clientDeveloperVertices = [];
      this.echoLabelRanges.length = 0;
      this.echoLabelRanges = [];
      this.echoVertices = [];
      this.roomInviteRanges.length = 0;
      this.roomInviteRanges = [];
      this.roomInviteVertices = [];
      this.podRewardRanges.length = 0;
      this.podRewardRanges = [];
      this.podRewardVertices = [];
      this.lowRelicVertices = [];
      this.recycleActiveGlyphs();
      this.glyphPool.length = 0;
      this.glyphPool = [];
      this.activeGlyphs = [];
      this.markup.clear();
      if (this.helperImage != null) {
        this.helperImage.dispose();
        this.helperImage = null;
      }
      if (this.characterBatch != null) {
        this.characterBatch.removeFromParent(false);
        this.characterBatch.dispose();
        this.characterBatch = null;
      }
      for (const japaneseBatch of this.japaneseBatches) {
        if (japaneseBatch == null) continue;
        japaneseBatch.removeFromParent(false);
        japaneseBatch.dispose();
      }
      this.japaneseBatches.length = 0;
      this.japaneseBatches = [];
      this._textFormat = null;
      this._resolvedTextFormat = null;
      super.dispose();
    }
  }

  return RichBitmapFontTextRenderer;
}
