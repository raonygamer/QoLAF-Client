import type {} from '../game/Clock';
import type { API, Cleanup } from '../api/Types';
import { GameReflection } from '../api/GameReflection';
import { Clock, type Connection } from '../game/Bindings';
import { ResponseSamples } from '../network/ResponseSamples';

const samples = new WeakMap<Clock, ResponseSamples>();
export function clockResponseSamples(clock: Clock): ResponseSamples {
  let current = samples.get(clock);
  if (!current) {
    current = new ResponseSamples();
    samples.set(clock, current);
  }
  return current;
}

/** Observe native and parallel-resync requests, including initialization. */
export function installClockResponseSamples(api: API): void {
  const reflection = new GameReflection(api);
  const subscriptions = new Map<Clock, { connection: Connection; release: Cleanup }>();
  const release = (clock: Clock) => {
    subscriptions.get(clock)?.release();
    subscriptions.delete(clock);
    samples.get(clock)?.reset();
  };
  reflection.around(Clock.prototype, 'start', function (next) {
    const connection = this.connection;
    if (subscriptions.get(this)?.connection === connection) return next();
    release(this);
    const sample = clockResponseSamples(this);
    const receive = () => sample.replyOldest();
    connection.addMessageHandler('serverTime', receive);
    const restore = reflection.around(connection, 'send', function (next, type, ...values) {
      if (type !== 'timeRequest' || !this.get_connected()) return next(type, ...values);
      // Register before dispatch so a synchronous response cannot precede its token.
      const token = sample.request();
      try {
        return next(type, ...values);
      } catch (error) {
        sample.cancel(token);
        throw error;
      }
    });
    subscriptions.set(this, {
      connection,
      release: () => {
        restore();
        connection.removeMessageHandler('serverTime', receive);
      },
    });
    next();
  });
  reflection.before(Clock.prototype, 'dispose', function () {
    release(this);
  });
  api.defer(() => {
    for (const clock of subscriptions.keys()) release(clock);
  });
}
