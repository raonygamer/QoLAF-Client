import type { API } from '../api/Types';

export interface PlayerIOStringEncoder {
  bytesFromString(value: string): number[];
}

/** Preserve original chat strings; the JS SDK must encode complete Unicode scalars. */
export function installPlayerIOUnicode(
  api: API,
  serializer: PlayerIOStringEncoder | undefined = globalThis._pio?.binaryserializer,
): void {
  if (!serializer) throw new Error('PlayerIO string serializer is unavailable');
  const encoder = new TextEncoder();
  api.around(serializer, 'bytesFromString', function (_next, value) {
    return Array.from(encoder.encode(value));
  });
}
