import { read, type API, type Raw } from '../api/Types';
import type { Resolve } from '../runtime/As3';
import { RichBitmapEditorModel } from './rich/RichBitmapEditorModel';
import { RichBitmapEditorView } from './rich/RichBitmapEditorView';
import { RichBitmapInputBinding } from './rich/RichBitmapInputBinding';

/** Keep the game's TextEntry identity/events while replacing its document and drawing. */
export function installNativeRichChatInput(api: API, game: Raw, resolve: Resolve): void {
  const chat = game.chatInput;
  const input = chat?.input;
  const element: HTMLInputElement | undefined = input?.element;
  if (!element) return;
  const Format = resolve('feathers.text.BitmapFontTextFormat');
  const Fonts = resolve('core.text.VerdanaBitmapFontRegistry');
  const initialFormat = read(input, 'textFormat');
  const model = new RichBitmapEditorModel(
    initialFormat?.size ?? 13,
    initialFormat?.color ?? 0xffffff,
  );
  model.text = read(input, 'text', '');
  model.maxChars = input.maxChars;
  const makeFormat = () =>
    new Format(Fonts.fontNameForSize(model.defaultSize), model.defaultSize, model.defaultColor);
  const view = new RichBitmapEditorView(resolve, model, makeFormat());
  view.node.set_name('QoLAF.RichComposer');
  input.addChild(view.node);
  const opacity = element.style.opacity;
  const maxLength = element.getAttribute('maxlength');
  const originalRestrict = input.restrict;
  const binding = new RichBitmapInputBinding(
    model,
    element,
    () => input.dispatchEventWith('change', true),
    () => view.refresh(),
  );
  // DOM retains focus, clipboard and IME services; only Starling paints text.
  element.style.opacity = '0';
  element.removeAttribute('maxlength');
  let disposed = false;
  let dimensions = '';
  let focused = false;
  let pointer: number | null = null;
  const listeners: (() => void)[] = [];
  const listen = (target: EventTarget, name: string, fn: EventListener) => {
    const options = { capture: true };
    target.addEventListener(name, fn, options);
    listeners.push(() => target.removeEventListener(name, fn, options));
  };
  const syncChannel = () => {
    const restriction = chat.chatMode === 'global' ? '^<>=&#[]{}' : null;
    if (input.restrict !== restriction) input.set_restrict(restriction);
  };
  const layout = () => {
    if (disposed) return;
    syncChannel();
    model.enabled = !element.disabled;
    model.editable = !element.readOnly;
    const format = read(input, 'textFormat');
    const size = format?.size ?? 13;
    const color = format?.color ?? 0xffffff;
    if (model.defaultSize !== size || model.defaultColor !== color) {
      model.setDefaultFormat(size, color);
      view.setFormat(makeFormat());
    }
    const left = input.paddingLeft ?? 0;
    const top = input.paddingTop ?? 0;
    const width = Math.max(0, read(input, 'width') - left - (input.paddingRight ?? 0));
    const height = Math.max(0, read(input, 'height') - top - (input.paddingBottom ?? 0));
    const key = [left, top, width, height].join(':');
    if (key !== dimensions) {
      dimensions = key;
      view.node.set_x(left);
      view.node.set_y(top);
      view.setBounds(width, height);
    }
    const hasFocus = element.ownerDocument.activeElement === element && chat.isActive();
    if (hasFocus !== focused) {
      focused = hasFocus;
      view.setFocus(focused);
    }
  };
  api.around(input, 'get_text', () => model.text);
  api.around(input, 'get_length', () => model.text.length);
  api.around(input, 'set_text', (_next, text) => {
    binding.setText(input.sanitize(text ?? ''));
    return text;
  });
  api.around(input, 'selectRange', (_next, begin, end) => {
    model.selectSource(begin, end);
    binding.project();
  });
  api.around(input, 'set_restrict', (next, restriction) => {
    next(restriction);
    model.filterText = (value) => input.sanitize(value);
    binding.setText(input.sanitize(model.text));
    return restriction;
  });
  api.around(input, 'set_maxChars', (_next, count) => {
    input.maxChars = model.maxChars = count;
    element.removeAttribute('maxlength');
    return count;
  });
  api.after(input, 'updatePlacement', layout);
  api.after(input, 'set_textFormat', layout);
  api.after(chat, 'toggleChatMode', layout);
  chat.tabs.addEventListener('change', layout);
  listen(element, 'focus', layout);
  listen(element, 'blur', layout);
  const selectPointer = (event: PointerEvent, extend: boolean) => {
    const rect = element.getBoundingClientRect();
    if (rect.width <= 0) return;
    const x =
      ((event.clientX - rect.left) * read(input, 'width')) / rect.width - (input.paddingLeft ?? 0);
    view.selectAt(x, extend);
    binding.project();
  };
  listen(element, 'pointerdown', (raw) => {
    const event = raw as PointerEvent;
    if (event.button !== 0 || element.disabled) return;
    event.preventDefault();
    element.focus();
    pointer = event.pointerId;
    element.setPointerCapture(pointer);
    selectPointer(event, event.shiftKey);
  });
  listen(element, 'pointermove', (raw) => {
    const event = raw as PointerEvent;
    if (pointer === event.pointerId) selectPointer(event, true);
  });
  const releasePointer = (raw: Event) => {
    const event = raw as PointerEvent;
    if (pointer !== event.pointerId) return;
    if (element.hasPointerCapture(pointer)) element.releasePointerCapture(pointer);
    pointer = null;
  };
  listen(element, 'pointerup', releasePointer);
  listen(element, 'pointercancel', releasePointer);
  listen(element, 'lostpointercapture', () => {
    pointer = null;
  });
  api.defer(() => {
    disposed = true;
    if (pointer !== null && element.hasPointerCapture(pointer))
      element.releasePointerCapture(pointer);
    for (const cleanup of listeners) cleanup();
    chat.tabs.removeEventListener('change', layout);
    binding.dispose();
    view.dispose();
    element.style.opacity = opacity;
    if (maxLength === null) element.removeAttribute('maxlength');
    else element.setAttribute('maxlength', maxLength);
    input.set_restrict(originalRestrict);
    element.value = input.sanitize(model.text);
  });
  syncChannel();
  model.filterText = (value) => input.sanitize(value);
  layout();
}
