import type { Raw } from '../../api/Types';
import type { Resolve } from '../../runtime/As3';
import { RichBitmapEditorModel } from './RichBitmapEditorModel';
import { RichBitmapMarkup } from './RichBitmapMarkup';
import { RichBitmapMarkupParser } from './RichBitmapMarkupParser';
import { RichBitmapTextNavigation } from './RichBitmapTextNavigation';

/** Starling drawing and caret geometry from the original RichBitmapFontTextEditor. */
export class RichBitmapEditorView {
  readonly node: Raw;
  private readonly renderer: Raw;
  private readonly metrics: Raw;
  private readonly promptRenderer: Raw;
  private prompt = '';
  private readonly selection: Raw;
  private readonly cursor: Raw;
  private readonly mask: Raw;
  private readonly markup = new RichBitmapMarkup();
  private scrollX = 0;
  private width = 0;
  private height = 0;
  private focused = false;
  private disposed = false;

  constructor(
    resolve: Resolve,
    readonly model: RichBitmapEditorModel,
    private format: Raw,
    private readonly artifactResolver: Function | null = null,
  ) {
    const Sprite = resolve('starling.display.Sprite');
    const Quad = resolve('starling.display.Quad');
    const Renderer = resolve('core.hud.components.chat.rich.RichBitmapFontTextRenderer');
    const Metrics = resolve('core.hud.components.chat.rich.RichBitmapTextMetrics');
    this.node = new Sprite();
    this.renderer = new Renderer();
    this.metrics = new Metrics();
    this.promptRenderer = new Renderer();
    this.selection = new Quad(1, 1, 0x3b78c8);
    this.selection.set_alpha(0.65);
    this.cursor = new Quad(1, 1, 0xffffff);
    this.mask = new Quad(1, 1, 0xff00ff);
    this.node.addChild(this.selection);
    this.node.addChild(this.renderer);
    this.node.addChild(this.cursor);
    this.node.addChild(this.promptRenderer);
    this.promptRenderer.set_alpha(0.55);
    this.promptRenderer.textureSmoothing = 'bilinear';
    this.promptRenderer.pixelSnapping = false;
    this.promptRenderer.wordWrap = false;
    this.promptRenderer.truncateToFit = true;
    this.promptRenderer.useSeparateBatch = false;
    this.node.set_mask(this.mask);
    this.node.set_touchable(false);
    this.renderer.textureSmoothing = 'bilinear';
    this.renderer.pixelSnapping = false;
    this.renderer.truncateToFit = false;
    this.renderer.useSeparateBatch = false;
    this.renderer.wordWrap = false;
    this.renderer.artifactTokenLabelResolver = artifactResolver;
  }

  setPrompt(text: string): void {
    if (this.prompt === text) return;
    this.prompt = text;
    this.refresh();
  }

  setBounds(width: number, height: number): void {
    this.width = Math.max(0, width);
    this.height = Math.max(0, height);
    this.mask.set_width(Math.max(1, this.width));
    this.mask.set_height(Math.max(1, this.height));
    this.refresh();
  }

  setFocus(focused: boolean): void {
    this.focused = focused;
    this.refresh();
  }

  setFormat(format: Raw): void {
    this.format = format;
    this.refresh();
  }

  refresh(): void {
    if (this.disposed) return;
    RichBitmapMarkupParser.parse(
      this.model.text,
      this.model.defaultSize,
      this.model.defaultColor,
      this.markup,
      this.artifactResolver,
    );
    this.metrics.update(this.markup, this.format, this.model.password);
    this.renderer.textFormat = this.format;
    this.renderer.text = this.renderText();
    this.renderer.set_width(NaN);
    this.renderer.set_height(this.metrics.height);
    this.renderer.validate();

    const showPrompt = this.prompt.length > 0 && this.model.text.length === 0;
    this.promptRenderer.set_visible(showPrompt);
    if (showPrompt) {
      this.promptRenderer.textFormat = this.format;
      this.promptRenderer.text = this.prompt;
      this.promptRenderer.set_width(this.width);
      this.promptRenderer.validate();
      this.promptRenderer.set_y(
        Math.max(0, Math.round((this.height - this.promptRenderer.height) / 2)),
      );
    }

    const caretX = this.metrics.xAt(this.model.selectionActive);
    if (caretX - this.scrollX > this.width - 2) this.scrollX = caretX - this.width + 2;
    else if (caretX - this.scrollX < 2) this.scrollX = Math.max(0, caretX - 2);
    this.scrollX = Math.max(
      0,
      Math.min(Math.max(0, this.metrics.width - this.width + 2), this.scrollX),
    );
    const y = Math.max(0, Math.round((this.height - this.metrics.height) / 2));
    this.renderer.set_x(-this.scrollX);
    this.renderer.set_y(y);
    this.cursor.set_x(Math.round(caretX - this.scrollX));
    this.cursor.set_y(y);
    this.cursor.set_height(Math.max(1, this.metrics.height));
    const clampX = (index: number) =>
      Math.max(0, Math.min(this.width, this.metrics.xAt(index) - this.scrollX));
    const start = clampX(this.model.selectionBegin);
    this.selection.set_x(start);
    this.selection.set_y(y);
    this.selection.set_width(Math.max(0, clampX(this.model.selectionEnd) - start));
    this.selection.set_height(Math.max(1, this.metrics.height));
    const collapsed = this.model.selectionBegin === this.model.selectionEnd;
    this.cursor.set_visible(this.focused && this.model.editable && collapsed);
    this.selection.set_visible(this.focused && !collapsed);
  }

  /** Coordinates are in the clipped bitmap viewport, including its horizontal scroll. */
  selectAt(x: number, extend = false, clicks = 1): void {
    const index = this.metrics.indexAt(x + this.scrollX);
    if (clicks > 2) this.model.select(0, this.model.visibleText.length);
    else if (clicks === 2) this.model.selectWordAt(index);
    else this.model.select(extend ? this.model.selectionAnchor : index, index);
    this.refresh();
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.node.set_mask(null);
    this.mask.dispose();
    this.node.removeFromParent(true);
  }

  private renderText(): string {
    if (!this.model.password) return this.model.text;
    let masked = '';
    for (let index = 0; index < this.markup.text.length; ) {
      masked += '*';
      index = RichBitmapTextNavigation.nextClusterEnd(this.markup.text, index);
    }
    return masked;
  }
}
