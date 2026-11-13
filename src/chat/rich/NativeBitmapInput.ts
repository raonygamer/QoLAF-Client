import type { ArtifactLabelResolver } from './ArtifactLabelResolver';
import { placeNativeInput } from '../../ui/NativeInputPlacement';
import { GameReflection } from '../../api/GameReflection';
import type { API } from '../../api/Types';
import { GameScene, type TextEntry } from '../../game/Bindings';
import { BitmapFontTextFormat } from '../../ui/BitmapFontTextFormat';
import type { Resolve } from '../../runtime/HaxeInterop';
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
  input: TextEntry,
  resolve: Resolve,
  active = () => true,
  artifactResolver: ArtifactLabelResolver | null = null,
): NativeBitmapInput {
  const element = input.element;
  if (!element) throw new Error('Bitmap input requires an initialized TextEntry element');
  const cleanups: (() => void)[] = [];
  const api: API = {
    ...owner,
    around: (...args: Parameters<API['around']>) => {
      const off = owner.around(...args);
      cleanups.push(off);
      return off;
    },
    after: (...args: Parameters<API['after']>) => {
      const off = owner.after(...args);
      cleanups.push(off);
      return off;
    },
    defer: (fn) => {
      cleanups.push(fn);
      return fn;
    },
  };
  const overlay = new GameReflection(api).find('core.hud.components.ui.DomOverlay');
  const initialFormat = input.textFormat;
  const model = new RichBitmapEditorModel(
    initialFormat?.size ?? 13,
    initialFormat?.color ?? 0xffffff,
    artifactResolver,
  );
  model.text = input.get_text();
  model.maxChars = input.maxChars;
  const makeFormat = () =>
    // AstroTheme's bitmap chat format deliberately uses the 48px atlas: it
    // contains the synthetic full-color emoji glyphs that smaller text faces lack.
    new BitmapFontTextFormat('verdana48_bitmap', model.defaultSize, model.defaultColor);
  const view = new RichBitmapEditorView(resolve, model, makeFormat(), artifactResolver);
  view.node.set_name('QoLAF.RichComposer');
  input.addChild(view.node);
  const opacity = element.style.opacity;
  const placementStyles = Object.fromEntries(
    (['fontSize', 'paddingLeft', 'paddingRight', 'paddingTop', 'paddingBottom'] as const).map(
      (key) => [key, element.style[key]],
    ),
  );
  const maxLength = element.getAttribute('maxlength');
  const originalRestrict = input.restrict;
  const binding = new RichBitmapInputBinding(
    model,
    element,
    () => input.dispatchEventWith('change', true),
    () => view.refresh(),
    () => GameScene.playerPerformedAction(),
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
    const format = input.textFormat;
    const size = format?.size ?? 13;
    const color = format?.color ?? 0xffffff;
    if (model.defaultSize !== size || model.defaultColor !== color) {
      model.setDefaultFormat(size, color);
      view.setFormat(makeFormat());
    }
    const left = input.paddingLeft ?? 0;
    const top = input.paddingTop ?? 0;
    const width = Math.max(0, input.get_width() - left - (input.paddingRight ?? 0));
    const height = Math.max(0, input.get_height() - top - (input.paddingBottom ?? 0));
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
  api.after(input, 'updatePlacement', (shown: boolean) => {
    if (shown) placeNativeInput(input, overlay);
    layout();
  });
  api.after(input, 'set_textFormat', layout);
  listen(element, 'focus', layout);
  listen(element, 'blur', layout);
  const selectPointer = (event: MouseEvent, extend: boolean, clicks = 1) => {
    const rect = element.getBoundingClientRect();
    if (rect.width <= 0) return;
    const x =
      ((event.clientX - rect.left) * input.get_width()) / rect.width - (input.paddingLeft ?? 0);
    view.selectAt(x, extend, clicks);
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
  // PointerEvent.detail is not a portable click count. Mouse click detail
  // supplies the source Touch.tapCount behavior after pointer release.
  listen(element, 'click', (raw) => {
    const event = raw as MouseEvent;
    if (event.button !== 0 || event.detail < 2 || element.disabled || binding.isComposing) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    selectPointer(event, false, event.detail);
  });
  listen(element, 'dblclick', (event) => {
    // The bitmap model already selected the word; prevent a second DOM range.
    event.preventDefault();
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
    Object.assign(element.style, placementStyles);
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
