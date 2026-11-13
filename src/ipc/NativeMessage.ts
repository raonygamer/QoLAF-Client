import type { IPCServerMessage } from './ClientIPCService';

function member(value: unknown, key: string): unknown {
  return value !== null && (typeof value === 'object' || typeof value === 'function')
    ? Reflect.get(value, key)
    : undefined;
}

function property(value: unknown, key: string): unknown {
  const getter = member(value, `get_${key}`);
  return typeof getter === 'function' ? Reflect.apply(getter, value, []) : member(value, key);
}

/** Preserve SDK primitive types: coercing getters would accept malformed replies. */
export function readNativeMessage(message: unknown): IPCServerMessage | null {
  try {
    const raw = member(message, 'raw');
    const internal = member(raw, '_internal_');
    if (typeof internal !== 'function') return null;
    const fields: unknown = Reflect.apply(internal, raw, ['get-objects']);
    const type = property(message, 'type');
    if (
      !Array.isArray(fields) ||
      fields.length !== property(message, 'length') ||
      typeof type !== 'string'
    )
      return null;
    const values: readonly unknown[] = fields;
    return { type, fields: values.slice() };
  } catch {
    return null;
  }
}
