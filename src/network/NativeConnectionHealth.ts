import type { API } from '../api/Types';
import { type GameScene, type Clock } from '../game/Bindings';
import { writeConnectionStatus } from './ConnectionNotices';
import { serviceGameIsReady } from '../service/ServiceGameReadiness';
import { clockResponseSamples } from '../clock/ClockResponseSamples';
import { ResponseSamples } from './ResponseSamples';
import { serviceResponseSamples } from './SceneRPC';
import { ConnectionHealthMonitor } from './ConnectionHealthMonitor';
import { isWarpJoinPending } from '../login/WarpTransition';

/** Uses only existing clock requests and Service RPCs; emits local notices, never probes. */
export function installNativeConnectionHealth(api: API, game: GameScene): void {
  const gameHealth = new ConnectionHealthMonitor('Game');
  const serviceHealth = new ConnectionHealthMonitor('Service');
  let clockSamples = new ResponseSamples();
  const serviceSamples = serviceResponseSamples(game);
  let service = game.serviceConnection;
  let clock: Clock | null = null;
  const syncService = () => {
    if (service === game.serviceConnection) return;
    service = game.serviceConnection;
    serviceHealth.reset();
  };
  const syncClock = () => {
    const current = game.clock;
    if (current === clock) return;
    clock = current;
    clockSamples = current ? clockResponseSamples(current) : new ResponseSamples();
    gameHealth.reset();
  };
  syncClock();
  const update = () => {
    syncService();
    syncClock();
    const foreground = typeof document === 'undefined' || (!document.hidden && document.hasFocus());
    const active =
      api.game === game &&
      foreground &&
      serviceGameIsReady(game) &&
      !isWarpJoinPending(game) &&
      !game.noAutoReconnect;
    const now = performance.now();
    for (const [monitor, samples, initial] of [
      [gameHealth, clockSamples, Number(game.clock?.latency) * 2],
      [serviceHealth, serviceSamples, serviceSamples.rtt],
    ] as const) {
      const notice = monitor.updateSamples(
        active,
        samples.sequence,
        samples.sentAt,
        samples.receivedAt,
        samples.rtt,
        samples.pendingSince,
        initial,
        now,
      );
      if (notice) writeConnectionStatus(notice);
    }
  };
  game.addEventListener('enterFrame', update);
  api.defer(() => {
    game.removeEventListener('enterFrame', update);
  });
}
