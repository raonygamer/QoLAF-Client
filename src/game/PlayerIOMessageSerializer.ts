/** Values accepted by the current SDK's private message serializer. */
export type PlayerIOMessageValue = string | number | boolean | number[] | Uint8Array;
export interface PlayerIOSDKMessage {
  readonly type: string;
  readonly length: number;
  getString(index: number): string;
  getInt(index: number): number;
  getUInt(index: number): number;
  getLong(index: number): number;
  getULong(index: number): number;
  getFloat(index: number): number;
  getDouble(index: number): number;
  getBoolean(index: number): boolean;
  _internal_(command: 'get-objects'): PlayerIOMessageValue[];
  _internal_(command: 'get-types'): number[];
}
export interface PlayerIOMessageSerializer {
  serializeMessage(message: PlayerIOSDKMessage): number[];
}
export function createPlayerIOMessageSerializer(): PlayerIOMessageSerializer | null {
  const Constructor = globalThis._pio?.messageSerializer;
  return typeof Constructor === 'function' ? new Constructor() : null;
}
