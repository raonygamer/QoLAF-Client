import type { API, Raw } from '../api/Types';
import { isBoundMethod } from '../runtime/As3';

export function bridgeNativeBitmapText(api: API, Text: Raw): void {
  const native = api.cls('core.hud.components.Text')!.prototype;
  const source = Text.prototype;
  const initialized = new WeakSet<Raw>();
  const live = new Set<Raw>();
  const cleanMethods = new WeakMap<Raw, Function>();
  let active = true;
  const cleanups: (() => void)[] = [];
  const initialize = (instance: Raw) => {
    if (initialized.has(instance)) return;
    initialized.add(instance);
    live.add(instance);
    Text.initializeNative(instance);
  };
  const skip = new Set(['constructor', 'x', 'y', 'get_x', 'get_y', 'set_x', 'set_y']);
  for (const [name, descriptor] of Object.entries(Object.getOwnPropertyDescriptors(source))) {
    if (skip.has(name)) continue;
    const previous = Object.getOwnPropertyDescriptor(native, name);
    let replacement: PropertyDescriptor;
    // AS3 @bound method descriptors return the raw function when read on their prototype.
    const value =
      descriptor.value ?? (isBoundMethod(descriptor) ? descriptor.get!.call(source) : undefined);
    if (typeof value === 'function') {
      const wrapper = function (this: Raw, ...args: any[]) {
        if (!active) return previous?.value?.apply(this, args);
        initialize(this);
        if (name === 'clean' && this.keepWhenRemoved && args[0]) return;
        try {
          return value.apply(this, args);
        } finally {
          if (name === 'dispose') live.delete(this);
        }
      };
      Object.defineProperty(wrapper, 'length', { value: value.length });
      // clean is passed directly to Starling by the source draw() method.
      replacement =
        name === 'clean'
          ? {
              configurable: true,
              get(this: Raw) {
                let method = cleanMethods.get(this);
                if (!method) {
                  method = wrapper.bind(this);
                  cleanMethods.set(this, method);
                }
                return method;
              },
            }
          : { configurable: true, writable: true, value: wrapper };
    } else {
      replacement = { configurable: true };
      if (descriptor.get)
        replacement.get = function (this: Raw) {
          initialize(this);
          return descriptor.get!.call(this);
        };
      if (descriptor.set)
        replacement.set = function (this: Raw, value: any) {
          initialize(this);
          descriptor.set!.call(this, value);
        };
    }
    Object.defineProperty(native, name, replacement);
    cleanups.push(() => {
      if (previous) Object.defineProperty(native, name, previous);
      else delete native[name];
    });
  }
  api.defer(() => {
    active = false;
    for (const cleanup of cleanups.reverse()) cleanup();
    for (const instance of live) {
      const html = instance._htmlText;
      const plain = instance._plainText;
      const isHtml = instance.isHtml;
      instance.removeChild(instance.finalLayer, true);
      instance.finalLayer = null;
      instance.markup?.clear();
      instance.tf.set_wordWrap(instance._wordWrap);
      instance.tf.set_width(instance._fieldWidth);
      instance.tf.set_height(instance._fieldHeight);
      instance.tf.set_defaultTextFormat(instance.format);
      if (isHtml) instance.tf.set_htmlText(html);
      else instance.tf.set_text(plain);
      instance.oldText = isHtml ? html : plain;
      instance.draw();
    }
    live.clear();
  });
}
