import { RichBitmapEditorModel } from './RichBitmapEditorModel';

/** Provisional IME edits share the editor's styles, restrictions and atomic ranges. */
export class RichBitmapComposition {
  private session = 0;
  private snapshot: { text: string; anchor: number; active: number } | null = null;
  private begin = 0;
  private end = 0;

  constructor(private readonly editor: RichBitmapEditorModel) {}

  get isActive(): boolean {
    return this.snapshot !== null;
  }

  start(): number {
    if (this.snapshot) return this.session;
    this.snapshot = {
      text: this.editor.text,
      anchor: this.editor.selectionAnchor,
      active: this.editor.selectionActive,
    };
    this.begin = this.editor.selectionBegin;
    this.end = this.editor.selectionEnd;
    return ++this.session;
  }

  update(session: number, value: string, anchor = value.length, active = anchor): boolean {
    if (!this.accepts(session)) return false;
    const beforeLength = this.editor.visibleText.length;
    const replacedLength = this.end - this.begin;
    // Composition is literal. Incomplete markup must not restructure the range
    // while the platform is still revising it.
    const changed = this.editor.replaceRange(this.begin, this.end, value);
    const acceptedLength = Math.max(
      0,
      this.editor.visibleText.length - beforeLength + replacedLength,
    );
    this.end = this.begin + acceptedLength;
    const clamp = (index: number) => Math.max(0, Math.min(acceptedLength, index));
    this.editor.select(this.begin + clamp(anchor), this.begin + clamp(active));
    return changed;
  }

  /** Browser compositionend owns confirmation; the following input is a notification. */
  finish(session: number, value: string): boolean {
    if (!this.accepts(session)) return false;
    this.restore();
    this.invalidate();
    return this.editor.replaceSelection(value);
  }

  cancel(session: number): boolean {
    if (!this.accepts(session)) return false;
    const changed = this.editor.text !== this.snapshot!.text;
    this.restore();
    this.invalidate();
    return changed;
  }

  /** External text assignment or focus disposal must invalidate queued IME events. */
  discard(): void {
    this.invalidate();
  }

  private accepts(session: number): boolean {
    return this.snapshot !== null && session === this.session;
  }

  private restore(): void {
    const snapshot = this.snapshot!;
    this.editor.text = snapshot.text;
    this.editor.select(snapshot.anchor, snapshot.active);
  }

  private invalidate(): void {
    this.snapshot = null;
    this.session++;
  }
}
