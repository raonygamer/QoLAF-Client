import { read, type API, type Raw } from '../../api/Types';
import type { Resolve } from '../../runtime/As3';
import { RichBitmapEditorModel } from './RichBitmapEditorModel';
import { RichBitmapEditorView } from './RichBitmapEditorView';
import { RichBitmapInputBinding } from './RichBitmapInputBinding';

export interface NativeBitmapInput {
  model: RichBitmapEditorModel;
  binding: RichBitmapInputBinding;
  view: RichBitmapEditorView;
  layout(): void;
  dispose(): void;
}

/** One native TextEntry's document, bitmap drawing, browser transport and lifecycle. */
export function bindNativeBitmapInput(
  owner: API,
  input: Raw,
  resolve: Resolve,
  active = () => true,
): NativeBitmapInput {
  const element: HTMLInputElement = input.element;
  const cleanups: (() => void)[] = [];
  const api: API = {
    ...owner,
    around: (...args) => {
      const off = owner.around(...args);
      cleanups.push(off);
      return off;
    },
    after: (...args) => {
      const off = owner.after(...args);
      cleanups.push(off);
      return off;
    },
    defer: (fn) => {
      cleanups.push(fn);
      return fn;
    },
  };
  const Format = resolve('feathers.text.BitmapFontTextFormat');
  const initialFormat = read(input, 'textFormat');
  const model = new RichBitmapEditorModel(
    initialFormat?.size ?? 13,
    initialFormat?.color ?? 0xffffff,
  );
  model.text = read(input, 'text', '');
  model.maxChars = input.maxChars;
  const makeFormat = () =>
    // AstroTheme's bitmap chat format deliberately uses the 48px atlas: it
    // contains the synthetic full-color emoji glyphs that smaller text faces lack.
    new Format('verdana48_bitmap', model.defaultSize, model.defaultColor);
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
  const layout = () => {
    if (disposed) return;
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
    const hasFocus = element.ownerDocument.activeElement === element && active();
    if (hasFocus !== focused) {
      focused = hasFocus;
      view.setFocus(focused);
    }
  };
  api.around(input, 'get_text', () => model.text);
  api.around(input, 'get_length', () => model.text.length);
  api.around(input, 'set_text', (_next, text) => {
    binding.setText(text ?? '');
    return text;
  });
  api.around(input, 'selectRange', (_next, begin, end) => {
    model.selectSource(begin, end);
    binding.project();
  });
  api.around(input, 'set_restrict', (next, restriction) => {
    next(restriction);
    model.filterText = (value) => input.sanitize(value);
    // Source restrict filters new input; changing channels must not damage an
    // already formatted draft. Native set_restrict rewrites the DOM buffer.
    binding.project();
    return restriction;
  });
  api.around(input, 'set_maxChars', (_next, count) => {
    input.maxChars = model.maxChars = count;
    element.removeAttribute('maxlength');
    return count;
  });
  api.after(input, 'updatePlacement', layout);
  api.after(input, 'set_textFormat', layout);
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
    binding.dispose();
    view.dispose();
    element.style.opacity = opacity;
    if (maxLength === null) element.removeAttribute('maxlength');
    else element.setAttribute('maxlength', maxLength);
    input.set_restrict(originalRestrict);
    element.value = input.sanitize(model.text);
  });
  model.filterText = (value) => input.sanitize(value);
  layout();
  const dispose = () => {
    if (disposed) return;
    for (const cleanup of cleanups.splice(0).reverse()) cleanup();
  };
  owner.defer(dispose);
  return { model, binding, view, layout, dispose };
}
