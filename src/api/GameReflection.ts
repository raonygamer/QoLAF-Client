import type { API, Cleanup } from './Types';
import type { GameClasses, GameClassName, GameInstance } from '../game/Game';
import type { Method, MethodKey, MethodOf } from './HookTypes';

function metadata(value: unknown, key: string): unknown {
  return value !== null && (typeof value === 'object' || typeof value === 'function')
    ? Reflect.get(value, key)
    : undefined;
}

/** Typed access to live Haxe classes; never wraps or copies game instances. */
export class GameReflection {
  constructor(private readonly api: API) {}

  find<K extends GameClassName>(name: K): GameClasses[K] | undefined {
    return this.api.cls(name) as GameClasses[K] | undefined;
  }

  require<K extends GameClassName>(name: K): GameClasses[K] {
    const cls = this.find(name);
    if (!cls) throw new Error(`Game class is unavailable: ${name}. Wait for classesReady.`);
    return cls;
  }

  is<K extends GameClassName>(value: unknown, name: K): value is GameInstance<K> {
    const cls = this.find(name);
    if (!cls || value === null || (typeof value !== 'object' && typeof value !== 'function'))
      return false;
    // Haxe interfaces are metadata links rather than JS prototype parents.
    const visited = new Set<unknown>();
    const pending: unknown[] = [metadata(value, '__class__')];
    while (pending.length) {
      const current = pending.pop();
      if (!current || visited.has(current)) continue;
      if (current === cls) return true;
      visited.add(current);
      pending.push(metadata(current, '__super__'));
      const interfaces: unknown = metadata(current, '__interfaces__');
      if (Array.isArray(interfaces)) pending.push(...interfaces);
    }
    return typeof cls === 'function' && value instanceof cls;
  }

  cast<K extends GameClassName>(value: unknown, name: K): GameInstance<K> {
    if (!this.is(value, name)) throw new TypeError(`Expected game instance of ${name}`);
    return value;
  }

  /** Resolve a previously bound native method; pass its original function reference. */
  bound<T extends object, F extends Method>(owner: T, original: F): F {
    const id = metadata(original, '__id__');
    const bound =
      typeof id === 'number' ? metadata(metadata(owner, 'hx__closures__'), String(id)) : undefined;
    // Haxe's bind cache stores the same callable with its receiver attached.
    return typeof bound === 'function' ? (bound as F) : original;
  }

  /** Replace an existing Starling listener, restoring it exactly once on cleanup. */
  replaceListener<T extends object, F extends Method>(
    dispatcher: {
      addEventListener(type: string, listener: Method): void;
      removeEventListener(type: string, listener: Method): void;
    },
    event: string,
    owner: T,
    original: F,
    replacement: (this: T, ...args: Parameters<F>) => void,
    restore: () => boolean = () => true,
  ): Cleanup {
    const previous = this.bound(owner, original);
    const listener = (...args: Parameters<F>) => replacement.apply(owner, args);
    dispatcher.removeEventListener(event, previous);
    try {
      dispatcher.addEventListener(event, listener);
    } catch (error) {
      dispatcher.addEventListener(event, previous);
      throw error;
    }
    let active = true;
    return () => {
      if (!active) return;
      active = false;
      dispatcher.removeEventListener(event, listener);
      if (restore()) dispatcher.addEventListener(event, previous);
    };
  }

  before<T extends object, K extends MethodKey<T>>(
    target: T,
    method: K,
    callback: (this: T, ...args: Parameters<MethodOf<T, K>>) => void,
  ): Cleanup {
    return this.api.before<T, K>(target, method, callback);
  }

  after<T extends object, K extends MethodKey<T>>(
    target: T,
    method: K,
    callback: (
      this: T,
      result: ReturnType<MethodOf<T, K>>,
      ...args: Parameters<MethodOf<T, K>>
    ) => void,
  ): Cleanup {
    return this.api.after<T, K>(target, method, callback);
  }

  around<T extends object, K extends MethodKey<T>>(
    target: T,
    method: K,
    callback: (
      this: T,
      next: MethodOf<T, K>,
      ...args: Parameters<MethodOf<T, K>>
    ) => ReturnType<MethodOf<T, K>>,
  ): Cleanup {
    return this.api.around<T, K>(target, method, callback);
  }
}
