import type { Message } from '../game/Bindings';

export type ServiceHandshakeMessage = Pick<
  Message,
  'type' | 'length' | 'getString' | 'getInt' | 'getNumber'
>;

/** Original ServiceConnectionPool wire validation, without parsing startup state. */
export function isValidServiceHandshake(
  message: ServiceHandshakeMessage | null,
  playerId: string | null,
): boolean {
  if (!message || message.type !== 'joined' || message.length < 19 || !playerId) return false;
  try {
    if (message.getString(0) !== playerId) return false;
    for (const index of [1, 5, 6, 7, 8, 10, 11, 12]) message.getInt(index);
    for (const index of [3, 4, 9]) if (!Number.isFinite(message.getNumber(index))) return false;
    for (const index of [2, 13, 14, 15, 16, 17, 18]) message.getString(index);
    return true;
  } catch {
    return false;
  }
}
