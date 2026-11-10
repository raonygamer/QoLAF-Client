import { RichBitmapComposition } from './RichBitmapComposition';
import { RichBitmapEditorModel } from './RichBitmapEditorModel';

/** Browser input transport. The document remains markup; the native buffer is visible text. */
export class RichBitmapInputBinding {
  private readonly composition: RichBitmapComposition;
  private session = 0;
  private readonly cleanups: (() => void)[] = [];
  private disposed = false;

  constructor(
    readonly model: RichBitmapEditorModel,
    private readonly element: HTMLInputElement,
    private readonly changed: () => void,
    private readonly selectionChanged: () => void = () => {},
  ) {
    this.composition = new RichBitmapComposition(model);
    this.listen(element, 'beforeinput', (event) => this.beforeInput(event as InputEvent));
    this.listen(element, 'input', (event) => this.input(event as InputEvent));
    this.listen(element, 'keydown', (event) => {
      // Let the IME handle candidate navigation/confirmation without submitting
      // chat or activating game shortcuts through TextEntry's native listener.
      if (this.composition.isActive || (event as KeyboardEvent).isComposing)
        event.stopImmediatePropagation();
      else this.navigate(event as KeyboardEvent);
    });
    this.listen(element, 'compositionstart', () => {
      this.readSelection();
      this.session = this.composition.start();
    });
    this.listen(element, 'compositionupdate', (event) => {
      if (this.composition.update(this.session, (event as CompositionEvent).data)) this.changed();
      this.selectionChanged();
    });
    this.listen(element, 'compositionend', (event) => {
      const changed = this.composition.finish(this.session, (event as CompositionEvent).data);
      this.publish(changed);
    });
    this.listen(element, 'copy', (event) => this.copy(event as ClipboardEvent, false));
    this.listen(element, 'cut', (event) => this.copy(event as ClipboardEvent, true));
    this.listen(element, 'paste', (event) => this.paste(event as ClipboardEvent));
    this.listen(element, 'select', () => this.readSelection());
    this.listen(element.ownerDocument, 'selectionchange', () => {
      if (element.ownerDocument.activeElement === element) this.readSelection();
    });
    this.project();
  }

  /** History, commands and channel changes replace source text, never the visible buffer. */
  setText(source: string): void {
    this.composition.discard();
    this.model.text = source;
    this.project();
  }

  project(): void {
    if (this.disposed || this.composition.isActive) return;
    if (this.element.value !== this.model.visibleText) this.element.value = this.model.visibleText;
    const backward = this.model.selectionAnchor > this.model.selectionActive;
    this.element.setSelectionRange(
      this.model.selectionBegin,
      this.model.selectionEnd,
      backward ? 'backward' : 'forward',
    );
    this.selectionChanged();
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.composition.discard();
    for (const cleanup of this.cleanups.splice(0)) cleanup();
  }

  private listen(target: EventTarget, name: string, listener: EventListener): void {
    const options = { capture: true };
    target.addEventListener(name, listener, options);
    this.cleanups.push(() => target.removeEventListener(name, listener, options));
  }

  private readSelection(): void {
    if (this.composition.isActive) return;
    const begin = this.element.selectionStart ?? 0;
    const end = this.element.selectionEnd ?? begin;
    const backward = this.element.selectionDirection === 'backward';
    const anchor = backward ? end : begin;
    const active = backward ? begin : end;
    // Re-selecting an unchanged caret would clear the typed-markup continuation style.
    if (anchor === this.model.selectionAnchor && active === this.model.selectionActive) return;
    this.model.select(anchor, active);
    this.selectionChanged();
  }

  private navigate(event: KeyboardEvent): void {
    if (event.ctrlKey || event.altKey || event.metaKey) return;
    if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
    this.readSelection();
    event.preventDefault();
    event.stopImmediatePropagation();
    if (event.key === 'ArrowLeft' || event.key === 'ArrowRight')
      this.model.moveHorizontal(event.key === 'ArrowLeft' ? -1 : 1, event.shiftKey);
    else {
      const target = event.key === 'Home' ? 0 : this.model.visibleText.length;
      this.model.select(event.shiftKey ? this.model.selectionAnchor : target, target);
    }
    this.project();
  }

  private beforeInput(event: InputEvent): void {
    if (event.isComposing || this.composition.isActive || !event.cancelable) return;
    this.readSelection();
    let edit: (() => boolean) | undefined;
    switch (event.inputType) {
      case 'insertText':
      case 'insertReplacementText':
        if (event.data !== null) edit = () => this.model.replaceSelection(event.data!, true);
        break;
      case 'deleteContentBackward':
        edit = () => this.model.backspace();
        break;
      case 'deleteContentForward':
        edit = () => this.model.deleteForward();
        break;
      case 'insertLineBreak':
      case 'insertParagraph':
        edit = () => false;
        break;
    }
    if (!edit) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    this.publish(edit());
  }

  private input(event: InputEvent): void {
    // Native TextEntry's bubble listener sanitizes markup and publishes a second change.
    event.stopImmediatePropagation();
    if (event.isComposing || this.composition.isActive) return;
    const previous = this.model.visibleText;
    const next = this.element.value;
    if (previous === next) return;
    // Non-cancelable input (spellcheck, accessibility tools, browser-specific edits).
    let begin = 0;
    while (begin < previous.length && begin < next.length && previous[begin] === next[begin])
      begin++;
    let oldEnd = previous.length;
    let newEnd = next.length;
    while (oldEnd > begin && newEnd > begin && previous[oldEnd - 1] === next[newEnd - 1]) {
      oldEnd--;
      newEnd--;
    }
    // Shared prefixes can end inside a surrogate pair, emoji cluster or artifact
    // label. Include its unchanged parts in the replacement before snapping.
    this.model.select(begin, oldEnd);
    newEnd += this.model.selectionEnd - oldEnd;
    this.publish(this.model.replaceSelection(next.slice(this.model.selectionBegin, newEnd), true));
  }

  private copy(event: ClipboardEvent, cut: boolean): void {
    if (!event.clipboardData || this.composition.isActive) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    if (!this.model.enabled || this.model.password) return;
    this.readSelection();
    if (this.model.selectionBegin === this.model.selectionEnd) return;
    event.clipboardData.setData('text/plain', this.model.selectedCopyText);
    if (cut) this.publish(this.model.replaceSelection(''));
  }

  private paste(event: ClipboardEvent): void {
    if (!event.clipboardData || this.composition.isActive) return;
    this.readSelection();
    event.preventDefault();
    event.stopImmediatePropagation();
    this.publish(this.model.replaceSelection(event.clipboardData.getData('text/plain'), true));
  }

  private publish(changed: boolean): void {
    this.project();
    if (changed) this.changed();
  }
}
