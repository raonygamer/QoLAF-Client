import type { API } from '../api/Types';
import { Text as NativeText } from '../game/Bindings';
import type { createText } from '../ported/Text';
type TextClass = ReturnType<typeof createText>;
type BridgedText = Parameters<TextClass['initializeNative']>[0] & { keepWhenRemoved?: boolean };
type BridgedMethod = (...args: unknown[]) => unknown;
import { isBoundMethod } from '../runtime/HaxeInterop';

export function bridgeNativeBitmapText(api: API, Text: TextClass): void {
  const native = NativeText.prototype;
  const source = Text.prototype;
  const initialized = new WeakSet<BridgedText>();
  const live = new Set<BridgedText>();
  const cleanMethods = new WeakMap<BridgedText, BridgedMethod>();
  let active = true;
  const cleanups: (() => void)[] = [];
  const initialize = (instance: BridgedText) => {
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
    const value: unknown =
      descriptor.value ?? (isBoundMethod(descriptor) ? descriptor.get!.call(source) : undefined);
    if (typeof value === 'function') {
      const wrapper = function (this: BridgedText, ...args: unknown[]) {
        if (!active) {
          const original: unknown = previous?.value;
          return typeof original === 'function' ? Reflect.apply(original, this, args) : undefined;
        }
        initialize(this);
        if (name === 'clean' && this.keepWhenRemoved && args[0]) return;
        try {
          return Reflect.apply(value, this, args);
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
              get(this: BridgedText) {
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
        replacement.get = function (this: BridgedText) {
          initialize(this);
          return descriptor.get!.call(this);
        };
      if (descriptor.set)
        replacement.set = function (this: BridgedText, value: unknown) {
          initialize(this);
          descriptor.set!.call(this, value);
        };
    }
    Object.defineProperty(native, name, replacement);
    cleanups.push(() => {
      if (previous) Object.defineProperty(native, name, previous);
      else Reflect.deleteProperty(native, name);
    });
  }
  api.defer(() => {
    active = false;
    for (const cleanup of cleanups.reverse()) cleanup();
    for (const instance of live) Text.restoreNative(instance);
    live.clear();
  });
}
