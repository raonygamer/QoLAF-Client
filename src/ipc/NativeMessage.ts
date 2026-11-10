import { read, type Raw } from '../api/Types';
import type { IpcServerMessage } from './ClientIpcService';

/** Preserve the SDK's primitive types; typed getters would coerce malformed replies. */
export function readNativeMessage(message: Raw | null): IpcServerMessage | null {
  try {
    const fields = message?.raw?._internal_('get-objects');
    const type = read(message, 'type');
    return Array.isArray(fields) &&
      fields.length === read(message, 'length') &&
      typeof type === 'string'
      ? { type, fields: fields.slice() }
      : null;
  } catch {
    return null;
  }
}
