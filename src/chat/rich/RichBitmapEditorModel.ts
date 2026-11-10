import { RichBitmapMarkup } from './RichBitmapMarkup';
import { RichBitmapMarkupParser } from './RichBitmapMarkupParser';
import { RichBitmapMarkupSerializer } from './RichBitmapMarkupSerializer';
import { RichBitmapTextNavigation } from './RichBitmapTextNavigation';
import { RichBitmapTypedMarkup } from './RichBitmapTypedMarkup';

/** Document/selection operations from RichBitmapFontTextEditor.as, without Flash focus/rendering. */
export class RichBitmapEditorModel {
  private source = '';
  private document = new RichBitmapMarkup();
  private anchor = 0;
  private active = 0;
  private continuationColor = 0;
  private continuationSize = NaN;
  maxChars = 0;
  editable = true;
  enabled = true;
  password = false;
  filterText: ((text: string) => string) | null = null;

  constructor(
    readonly defaultSize = 13,
    readonly defaultColor = 0xffffff,
    private artifactResolver: Function | null = null,
  ) {}

  get text(): string {
    return this.source;
  }
  set text(value: string) {
    value ??= '';
    if (value === this.source) return;
    this.source = value;
    this.continuationSize = NaN;
    this.parse();
    // Source text assignment snaps both old caret endpoints backward.
    this.anchor = this.snapBackward(this.anchor);
    this.active = this.snapBackward(this.active);
  }
  get visibleText(): string {
    return this.document.text;
  }
  get selectionAnchor(): number {
    return this.anchor;
  }
  get selectionActive(): number {
    return this.active;
  }
  get selectionBegin(): number {
    return Math.min(this.anchor, this.active);
  }
  get selectionEnd(): number {
    return Math.max(this.anchor, this.active);
  }
  get sourceSelectionBegin(): number {
    return this.document.sourceIndexAtVisibleBoundary(
      this.selectionBegin,
      this.selectionBegin === this.selectionEnd && this.selectionBegin === this.visibleText.length,
    );
  }
  get sourceSelectionEnd(): number {
    return this.selectionBegin === this.selectionEnd
      ? this.sourceSelectionBegin
      : this.document.sourceIndexAtVisibleBoundary(this.selectionEnd, true);
  }
  get selectedVisibleText(): string {
    return this.visibleText.slice(this.selectionBegin, this.selectionEnd);
  }
  get selectedCopyText(): string {
    return this.document.copyTextForVisibleRange(this.selectionBegin, this.selectionEnd);
  }
  get selectedColor(): number {
    return this.selectionBegin < this.selectionEnd
      ? this.colorAt(this.selectionBegin)
      : this.defaultColor;
  }
  get selectedSize(): number {
    return Math.round(
      this.selectionBegin < this.selectionEnd ? this.sizeAt(this.selectionBegin) : this.defaultSize,
    );
  }
  get selectedRichMarkup(): string {
    return this.serialize(this.slice(this.selectionBegin, this.selectionEnd));
  }

  select(anchor: number, active = anchor): void {
    this.continuationSize = NaN;
    const length = this.visibleText.length;
    anchor = Math.max(0, Math.min(length, anchor));
    active = Math.max(0, Math.min(length, active));
    if (anchor === active) this.anchor = this.active = this.snapForward(anchor);
    else if (anchor < active) {
      this.anchor = this.snapBackward(anchor);
      this.active = this.snapForward(active);
    } else {
      this.anchor = this.snapForward(anchor);
      this.active = this.snapBackward(active);
    }
  }

  /** Resolver changes preserve source positions even when displayed token labels change. */
  refreshArtifactLabels(resolver = this.artifactResolver): void {
    const begin = this.sourceSelectionBegin,
      end = this.sourceSelectionEnd;
    this.artifactResolver = resolver;
    this.parse();
    if (begin === end) {
      const caret = this.snapForward(this.document.visibleIndexAtSource(begin, true));
      this.select(caret);
    } else
      this.select(
        this.document.visibleIndexAtSource(begin, false),
        this.document.visibleIndexAtSource(end, true),
      );
  }

  applySelectionColor(color: number): boolean {
    return this.applyStyle('colors', color & 0xffffff);
  }
  applySelectionSize(size: number): boolean {
    return this.applyStyle('sizes', Math.max(12, Math.min(48, Math.trunc(size))));
  }
  private applyStyle(key: 'colors' | 'sizes', value: number): boolean {
    if (!this.enabled || !this.editable || this.selectionBegin === this.selectionEnd) return false;
    const candidate = this.slice(0, this.visibleText.length);
    for (let index = this.selectionBegin; index < this.selectionEnd; index++)
      candidate[key][index] = value;
    return this.commit(candidate, this.selectionBegin, this.selectionEnd);
  }

  replaceSelection(value: string, parseTypedMarkup = false): boolean {
    return this.replaceRange(this.selectionBegin, this.selectionEnd, value, parseTypedMarkup);
  }

  replaceRange(begin: number, end: number, value: string, parseTypedMarkup = false): boolean {
    if (!this.enabled || !this.editable) return false;
    begin = this.snapBackward(begin);
    end = Math.max(begin, this.snapForward(end));
    value = (value ?? '').replace(/\r\n|\r|\n/g, '');
    if (this.filterText) value = this.filterText(value);
    const styleIndex =
      begin < end && begin < this.visibleText.length
        ? begin
        : begin > 0
          ? begin - 1
          : begin < this.visibleText.length
            ? begin
            : -1;
    let color = this.colorAt(styleIndex),
      size = this.sizeAt(styleIndex);
    let keepContinuation =
      parseTypedMarkup &&
      begin === end &&
      value.length > 0 &&
      Number.isFinite(this.continuationSize);
    if (keepContinuation) {
      color = this.continuationColor;
      size = this.continuationSize;
    }
    let inserted = new RichBitmapMarkup();
    if (!this.artifactResolver || !value.length) {
      inserted.text = value;
      inserted.colors = Array(value.length).fill(color);
      inserted.sizes = Array(value.length).fill(size);
    } else
      inserted = RichBitmapMarkupParser.parse(
        value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'),
        size,
        color,
        null,
        this.artifactResolver,
      );
    let candidate = this.slice(0, begin);
    this.append(candidate, inserted, 0, inserted.text.length);
    this.append(candidate, this.document, end, this.visibleText.length);
    let caret = begin + inserted.text.length;
    if (
      parseTypedMarkup &&
      !this.password &&
      (!this.filterText || this.filterText('<>') === '<>') &&
      !/^\/global(?:\s|$)/i.test(candidate.text)
    ) {
      const promoted = RichBitmapTypedMarkup.promote(
        candidate,
        this.document,
        begin,
        end,
        caret,
        this.defaultSize,
        this.defaultColor,
        this.artifactResolver,
      );
      if (promoted && this.sameCommandPrefix(candidate, promoted.markup)) {
        if (/<\/\s*(font|b|i|u)\s*>$/i.test(candidate.text.slice(0, caret)))
          keepContinuation = true;
        candidate = promoted.markup;
        caret = promoted.caret;
      }
    }
    return this.commit(candidate, caret, caret, color, keepContinuation ? size : NaN);
  }

  backspace(): boolean {
    if (this.selectionBegin !== this.selectionEnd) return this.replaceSelection('', true);
    if (this.active <= 0) return false;
    const atomic = this.document.previousAtomicBoundary(this.active);
    const begin =
      atomic >= 0
        ? atomic
        : RichBitmapTextNavigation.previousBoundary(this.visibleText, this.active);
    return this.replaceRange(begin, this.active, '', true);
  }
  deleteForward(): boolean {
    if (this.selectionBegin !== this.selectionEnd) return this.replaceSelection('', true);
    if (this.active >= this.visibleText.length) return false;
    const atomic = this.document.nextAtomicBoundary(this.active);
    const end =
      atomic >= 0 ? atomic : RichBitmapTextNavigation.nextBoundary(this.visibleText, this.active);
    return this.replaceRange(this.active, end, '', true);
  }

  private commit(
    candidate: RichBitmapMarkup,
    anchor: number,
    active: number,
    continuationColor = 0,
    continuationSize = NaN,
  ): boolean {
    const source = this.serialize(candidate);
    if (this.maxChars > 0 && source.length > this.maxChars && source.length >= this.source.length)
      return false;
    const changed = source !== this.source;
    this.source = source;
    this.parse();
    this.select(anchor, active);
    this.continuationColor = continuationColor;
    this.continuationSize = continuationSize;
    return changed;
  }
  private sameCommandPrefix(before: RichBitmapMarkup, after: RichBitmapMarkup): boolean {
    const command = (markup: RichBitmapMarkup) => {
      const source = this.serialize(markup);
      return source.startsWith('/') ? source.split(' ')[0] : '';
    };
    return command(before) === command(after);
  }
  private parse(): void {
    RichBitmapMarkupParser.parse(
      this.source,
      this.defaultSize,
      this.defaultColor,
      this.document,
      this.artifactResolver,
    );
  }
  private serialize(markup: RichBitmapMarkup): string {
    return RichBitmapMarkupSerializer.serialize(markup, this.defaultSize, this.defaultColor);
  }
  private colorAt(index: number): number {
    return this.document.colors[index] ?? this.defaultColor;
  }
  private sizeAt(index: number): number {
    return this.document.sizes[index] ?? this.defaultSize;
  }
  private snapBackward(index: number): number {
    return this.document.snapVisibleBackward(
      RichBitmapTextNavigation.snapBackward(this.visibleText, index),
    );
  }
  private snapForward(index: number): number {
    return this.document.snapVisibleForward(
      RichBitmapTextNavigation.snapForward(this.visibleText, index),
    );
  }
  private slice(begin: number, end: number): RichBitmapMarkup {
    const result = new RichBitmapMarkup();
    this.append(result, this.document, begin, end);
    return result;
  }
  private append(
    target: RichBitmapMarkup,
    source: RichBitmapMarkup,
    begin: number,
    end: number,
  ): void {
    const destination = target.text.length;
    target.text += source.text.slice(begin, end);
    for (let index = begin; index < end; index++) {
      target.colors.push(source.colors[index] ?? this.defaultColor);
      target.sizes.push(source.sizes[index] ?? this.defaultSize);
    }
    source.copyAtomsTo(target, begin, end, destination);
  }
}
