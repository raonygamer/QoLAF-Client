import type { API } from '../api/Types';
import { GameReflection } from '../api/GameReflection';
import { MessagePackHandler } from '../game/Bindings';
import type { Game } from '../game/Game';

/** Record lengths include the two-field type/length header, as in the native dispatcher. */
export class PackedRecordBounds {
  private readonly active = new WeakMap<Game.playerio.Message, Map<number, number>>();

  constructor(api: API) {
    const dispatcher = MessagePackHandler?.prototype;
    if (!dispatcher) return;
    const active = this.active;
    new GameReflection(api).around(dispatcher, 'handleMessagePack', function (next, message) {
      const previous = active.get(message);
      const bounds = new Map<number, number>();
      // Index only complete records. Native dispatch still owns order and errors.
      for (let cursor = 0; cursor + 1 < message.length; ) {
        let length: number;
        try {
          length = message.getInt(cursor + 1);
        } catch {
          break;
        }
        if (!Number.isInteger(length) || length < 2 || cursor + length > message.length) break;
        bounds.set(cursor + 2, cursor + length);
        cursor += length;
      }
      active.set(message, bounds);
      try {
        return next(message);
      } finally {
        if (previous) active.set(message, previous);
        else active.delete(message);
      }
    });
  }

  /** An unknown offset inside a pack has no readable payload. */
  end(message: Game.playerio.Message, payloadStart: number, explicitLength = -1): number {
    const bounds = this.active.get(message);
    if (bounds) return bounds.get(payloadStart) ?? payloadStart;
    return explicitLength >= 0
      ? Math.max(payloadStart, Math.min(message.length, payloadStart + explicitLength - 2))
      : message.length;
  }
}
