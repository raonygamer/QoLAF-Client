import type {} from '../game/Clock';
import type { API } from '../api/Types';
import { GameReflection } from '../api/GameReflection';
import { Clock, SceneBase, GameScene, type Message, type Event } from '../game/Bindings';
import { clockResponseSamples } from './ClockResponseSamples';
import { ElapsedClock } from './ElapsedClock';

interface Timing {
  pending: number[];
  receive(message: Message): void;
}

/** Source startup/refresh flow, using current Haxe monotonic slew for live changes. */
export function installNativeClockTiming(api: API): void {
  const reflection = new GameReflection(api);
  const elapsedClocks = new WeakMap<Clock, ElapsedClock>();
  reflection.around(Clock.prototype, 'get_elapsedTime', function (next) {
    let elapsed = elapsedClocks.get(this);
    if (!elapsed) {
      // Keep the existing clock's origin, including when attaching to a live
      // scene. Only the first sample uses Haxe's wall-clock elapsed getter.
      elapsed = new ElapsedClock(next());
      elapsedClocks.set(this, elapsed);
    }
    return elapsed.read();
  });
  const timings = new Map<Clock, Timing>();
  const release = (clock: Clock) => {
    const timing = timings.get(clock);
    if (!timing) return;
    timings.delete(clock);
    timing.pending.length = 0;
    clock.connection.removeMessageHandler('serverTime', timing.receive);
    clock.responsePending = false;
  };
  const send = (clock: Clock, timing: Timing) => {
    const sent = performance.now();
    timing.pending.push(sent);
    clock.responsePending = true;
    try {
      clock.connection.send('timeRequest', clock.client.connectUserId);
    } catch (error) {
      const index = timing.pending.indexOf(sent);
      if (index >= 0) timing.pending.splice(index, 1);
      clock.responsePending = timing.pending.length > 0;
      throw error;
    }
  };
  reflection.around(Clock.prototype, 'start', function () {
    if (timings.has(this)) return;
    // Anchor before network initialization so wall-clock changes during login
    // cannot enter the first simulation frame's elapsed-time calculation.
    this.get_elapsedTime();
    const timing: Timing = { pending: [], receive: (message) => this.onServerTime(message) };
    timings.set(this, timing);
    this.deltas = [];
    // Current original source: INITIAL_SYNC_SAMPLES = 1 (not its stale comment).
    this.maxDeltas = 1;
    this.lockedInServerTime = false;
    this.responsePending = false;
    this.connection.addMessageHandler('serverTime', timing.receive);
    send(this, timing);
  });
  reflection.around(Clock.prototype, 'requestServerTime', function () {
    const timing = timings.get(this);
    if (
      timing &&
      !this.responsePending &&
      this.connection.get_connected() &&
      !Number.isFinite(clockResponseSamples(this).pendingSince)
    )
      send(this, timing);
  });
  reflection.around(Clock.prototype, 'onServerTime', function (_next, message) {
    const timing = timings.get(this);
    const sent = timing?.pending.shift();
    // Parallel /resync owns its replies separately; never apply them twice.
    if (sent === undefined || !timing) return;
    this.responsePending = timing.pending.length > 0;
    const now = performance.now();
    const elapsed = now - sent;
    const server = message.getNumber(0);
    if (elapsed < 0 || !Number.isFinite(server)) return;
    const wall = Date.now();
    if (!this.lockedInServerTime) {
      // Preserve Haxe's epoch-based offset, but measure RTT with a monotonic clock.
      this.addTimeDelta(wall - elapsed, wall, server);
      if (this.deltas.length === this.maxDeltas) this.dispatchEventWith('clockReady');
      return;
    }
    const latency = elapsed / 2;
    this.latency = latency;
    if (elapsed < 10000) {
      this.setTargetSyncTimeDelta(
        this.syncTimeDelta + (server - wall + latency - this.syncTimeDelta) * 0.2,
      );
    }
    // An overdue reply remains observable by the watchdog; it cannot move time.
    this.dispatchEventWith('clockReady');
  });
  reflection.around(SceneBase.prototype, 'refreshClock', function () {
    const clock = this.clock;
    if (
      this.get_isLeaving() ||
      !this.get_connected() ||
      !this.clockInitComplete ||
      !clock?.lockedInServerTime ||
      clock.responsePending ||
      Number.isFinite(clockResponseSamples(clock).pendingSince)
    )
      return;
    const callback = (event: Event) => {
      clock.removeEventListener('clockReady', callback);
      this.onRefreshClockReady(event);
    };
    clock.addEventListener('clockReady', callback);
    try {
      clock.requestServerTime();
    } catch (error) {
      clock.removeEventListener('clockReady', callback);
      throw error;
    }
  });
  // The native initial assignment still says 50s; clamp once before first refresh.
  const schedules = new WeakSet<GameScene>();
  reflection.around(GameScene.prototype, 'updateSync', function () {
    if (!schedules.has(this)) {
      schedules.add(this);
      this.nextSync = Math.min(this.nextSync, this.time + 25000);
    }
    if (this.nextSync < this.time) {
      this.nextSync = this.time + 25000;
      this.refreshClock();
    }
  });
  reflection.before(Clock.prototype, 'dispose', function () {
    release(this);
  });
  api.defer(() => {
    for (const clock of timings.keys()) release(clock);
  });
}
