import type { API, Raw } from '../Api/Types';
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
export function bound(
  _target: object,
  key: string,
  descriptor: PropertyDescriptor,
): PropertyDescriptor {
  const method = descriptor.value;
  return {
    configurable: true,
    get(this: Raw) {
      const fn = method.bind(this);
      Object.defineProperty(this, key, { value: fn, writable: true, configurable: true });
      return fn;
    },
  };
}
export type Resolve = (name: string) => any;
