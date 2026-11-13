import type {} from '../game/Clock';
import type { API } from '../api/Types';
import { GameReflection } from '../api/GameReflection';
import { Clock, MessageLog, type GameScene, type Connection, type Message } from '../game/Bindings';

interface Sample {
  latency: number;
  delta: number;
}
interface Batch {
  game: GameScene;
  clock: Clock;
  connection: Connection;
  pending: number[];
  samples: Sample[] | null;
  count: number;
  started: number;
  cooldown: number;
  receive: (message: Message) => void;
}

/** Original parallel resync, retaining the newer clock's monotonic slew policy. */
export function createClockResync(api: API): (game: GameScene, argument: string) => void {
  const batches = new Map<Clock, Batch>();
  const reflection = new GameReflection(api);
  const write = (message: string) => MessageLog.write(message);
  const fail = (batch: Batch) => {
    if (!batch.samples) return;
    // The protocol has no request IDs. Drain every outstanding response before
    // allowing another batch; a timed-out reply must never satisfy a newer send.
    batch.samples = null;
    write('Clock resync failed to collect the requested samples in time. Previous timing kept.');
  };
  const dispose = (batch: Batch) => {
    batch.connection.removeMessageHandler('serverTime', batch.receive);
    batch.pending.length = 0;
    batch.samples = null;
    batches.delete(batch.clock);
  };
  reflection.around(Clock.prototype, 'requestServerTime', function (next) {
    if (!batches.get(this)?.pending.length) next();
  });
  reflection.before(Clock.prototype, 'dispose', function () {
    const batch = batches.get(this);
    if (batch) dispose(batch);
  });
  api.interval(() => {
    for (const batch of batches.values()) {
      if (
        api.game !== batch.game ||
        batch.game.clock !== batch.clock ||
        batch.game.get_isLeaving() ||
        !batch.connection.get_connected()
      ) {
        dispose(batch);
      } else if (batch.samples && performance.now() - batch.started >= 10000) {
        fail(batch);
      }
    }
  }, 250);
  api.defer(() => {
    for (const batch of batches.values()) dispose(batch);
  });

  return (game, argument) => {
    const value = argument.trim();
    if (value && !/^(?:[1-9]|10)$/.test(value)) {
      write('Usage: /resync [1-10] (default: 1)');
      return;
    }
    const clock = game.clock;
    const connection = clock?.connection;
    if (
      !clock ||
      !connection ||
      !clock.lockedInServerTime ||
      game.get_isLeaving() ||
      !connection.get_connected()
    ) {
      write('Wait until the Game room is connected before resyncing the clock.');
      return;
    }
    let batch = batches.get(clock);
    const now = performance.now();
    if (batch && batch.cooldown > now) {
      write('Wait ' + Math.ceil((batch.cooldown - now) / 1000) + 's before using /resync again.');
      return;
    }
    if (batch?.samples) {
      write('Clock resync is already in progress.');
      return;
    }
    if (clock.responsePending || batch?.pending.length) {
      write('A clock response is still pending. Try /resync again once it arrives.');
      return;
    }
    if (!batch) {
      batch = {
        game,
        clock,
        connection,
        pending: [],
        samples: null,
        count: 0,
        started: 0,
        cooldown: 0,
        receive: () => {},
      };
      const owner = batch;
      batch.receive = (message: Message) => {
        const sent = owner.pending.shift();
        if (sent === undefined || !owner.samples) return;
        const received = performance.now();
        let serverTime: number;
        try {
          serverTime = message.getNumber(0);
        } catch {
          fail(owner);
          return;
        }
        if (
          api.game !== game ||
          game.clock !== clock ||
          !connection.get_connected() ||
          !Number.isFinite(serverTime) ||
          received < sent ||
          received - sent >= 10000 ||
          received - owner.started >= 10000
        ) {
          fail(owner);
          return;
        }
        const latency = (received - sent) / 2;
        owner.samples.push({ latency, delta: serverTime - Date.now() + latency });
        if (owner.samples.length !== owner.count) return;
        const samples = owner.samples.slice().sort((a, b) => a.latency - b.latency);
        const middle = Math.floor(samples.length / 2);
        const median =
          samples.length % 2
            ? samples[middle].latency
            : (samples[middle - 1].latency + samples[middle].latency) / 2;
        while (samples.length && samples[samples.length - 1].latency > median * 1.5) samples.pop();
        const average = (key: keyof Sample) =>
          samples.reduce((total, sample) => total + sample[key], 0) / samples.length;
        const delta = Math.round(average('delta'));
        if (!Number.isFinite(delta)) {
          fail(owner);
          return;
        }
        const adjustment = Math.round(delta - clock.syncTimeDelta);
        clock.latency = average('latency');
        clock.latencyError = Math.abs(samples[samples.length - 1].latency - clock.latency);
        // Current vanilla smooths modest corrections and guards against time
        // moving backwards. Apply through its setter instead of replacing it.
        clock.setTargetSyncTimeDelta(delta);
        owner.samples = null;
        write(
          'Clock resynced from ' +
            owner.count +
            (owner.count === 1 ? ' sample. Adjustment: ' : ' samples. Adjustment: ') +
            (adjustment > 0 ? '+' : '') +
            adjustment +
            ' ms; latency: ' +
            Math.round(clock.latency) +
            ' ms.',
        );
      };
      connection.addMessageHandler('serverTime', batch.receive);
      batches.set(clock, batch);
    }
    batch.count = value ? Number(value) : 1;
    batch.started = now;
    batch.cooldown = now + batch.count * 1000;
    batch.samples = [];
    try {
      for (let index = 0; index < batch.count; index++) {
        if (!connection.get_connected()) throw Error('Disconnected');
        batch.pending.push(performance.now());
        connection.send('timeRequest', clock.client.connectUserId);
      }
      write(
        'Resyncing the game clock with ' +
          batch.count +
          (batch.count === 1 ? ' sample...' : ' parallel samples...'),
      );
    } catch {
      batch.samples = null;
      write('Clock resync could not start. Try again when the Game connection is ready.');
    }
  };
}
