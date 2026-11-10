import type { API, Raw } from '../api/Types';
// AS3 display properties map to Haxe's generated accessors. Keep dispatch
// dynamic so subclass accessors still win (e.g. TextField.width).
export function aliasProperties(api: API, ctor: Raw) {
  for (const target of [ctor, ctor.prototype]) {
    if (!target) continue;
    const properties = target.__properties__ ?? {};
    for (const entry of Object.keys(properties)) {
      if (!/^(get|set)_/.test(entry)) continue;
      const name = entry.slice(4);
      if (name in target) continue;
      const get = properties['get_' + name],
        set = properties['set_' + name];
      const descriptor: PropertyDescriptor = { configurable: true };
      if (get)
        descriptor.get = function (this: Raw) {
          return this[get]();
        };
      if (set)
        descriptor.set = function (this: Raw, value) {
          this[set](value);
        };
      Object.defineProperty(target, name, descriptor);
      api.defer(() => {
        const current = Object.getOwnPropertyDescriptor(target, name);
        if (current?.get === descriptor.get && current?.set === descriptor.set) delete target[name];
      });
    }
  }
}
// AS3 method closures bind their receiver. Preserve arity for Starling events.
const boundGetters = new WeakSet<Function>();
export function bound(
  target: object,
  key: string,
  descriptor: PropertyDescriptor,
): PropertyDescriptor {
  const method = descriptor.value;
  const getter = function (this: Raw) {
    // Inspecting a source prototype must not permanently bind it to itself.
    if (this === target) return method;
    const fn = method.bind(this);
    Object.defineProperty(this, key, { value: fn, writable: true, configurable: true });
    return fn;
  };
  boundGetters.add(getter);
  return { configurable: true, get: getter };
}

export function isBoundMethod(descriptor: PropertyDescriptor): boolean {
  return !!descriptor.get && boundGetters.has(descriptor.get);
}

/** Let native Haxe callers use an AS3 port's explicit ES property overrides. */
export function bridgeNativeProperties(ctor: Raw): void {
  const prototype = ctor.prototype;
  for (const [name, descriptor] of Object.entries(Object.getOwnPropertyDescriptors(prototype))) {
    if (descriptor.get && !boundGetters.has(descriptor.get)) {
      Object.defineProperty(prototype, 'get_' + name, {
        configurable: true,
        writable: true,
        value: function (this: Raw) {
          return descriptor.get!.call(this);
        },
      });
    }
    if (descriptor.set) {
      Object.defineProperty(prototype, 'set_' + name, {
        configurable: true,
        writable: true,
        value: function (this: Raw, value: any) {
          descriptor.set!.call(this, value);
          return value;
        },
      });
    }
  }
}
export type Resolve = (name: string) => any;
