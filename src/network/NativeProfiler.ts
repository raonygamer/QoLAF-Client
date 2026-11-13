import type { API } from '../api/Types';
import { GameReflection } from '../api/GameReflection';
import type { MethodKey, MethodOf } from '../api/HookTypes';
import {
  JoinRoomLocator,
  MessageLog,
  Starling,
  type Event,
  type GameScene,
} from '../game/Bindings';
import { gameRecoveryActive } from '../service/GameRecovery';
import { portedClasses } from '../ported/Registry';
import { createProfilerWindow } from './ProfilerWindow';
import { RuntimeProfiler } from './RuntimeProfiler';
import { NativeTraffic } from './NativeTraffic';

type ProfiledGame = GameScene & { toggleProfiler?: () => boolean };

function heapBytes(): number | null {
  const memory: unknown = Reflect.get(performance, 'memory');
  if (!memory || typeof memory !== 'object') return null;
  const used: unknown = Reflect.get(memory, 'usedJSHeapSize');
  return typeof used === 'number' && Number.isFinite(used) ? used : null;
}

/** Opt-in native profiler window and typed CPU sampling at current Haxe method boundaries. */
export function installNativeProfiler(api: API, owner: object): void {
  const reflection = new GameReflection(api);
  const game: ProfiledGame = reflection.cast(owner, 'core.scene.Game');
  const resolve = portedClasses(api).resolve;
  const Window = createProfilerWindow(resolve);
  const panel = new Window();
  const now = () => Math.floor(performance.now());
  const profiler = new RuntimeProfiler(now, heapBytes);
  const traffic = NativeTraffic.forGame(api, game);
  profiler.trafficAvailable = traffic.available;
  api.defer(
    traffic.observe({
      active: () => profiler.active,
      receive: (message) => profiler.recordRX(message),
      transmit: (message) => profiler.recordTX(message),
    }),
  );
  panel.activeChanged = (active) => profiler.setActive(active);
  panel.resetHandler = () => profiler.reset();
  panel.stateProvider = () => {
    const latency = game.clock?.latency ?? NaN;
    return (
      'Units ' +
      (game.unitManager?.units.length ?? 0) +
      '   Projectiles ' +
      (game.projectileManager?.projectiles.length ?? 0) +
      '   Emitters ' +
      (game.emitterManager?.emitters?.length ?? 0) +
      '   Players ' +
      (game.playerManager?.get_players().length ?? 0) +
      (gameRecoveryActive(JoinRoomLocator.getService()) ? '   RECONNECTING' : '') +
      '\nGame: ' +
      (game.get_connected() ? 'connected' : 'disconnected') +
      '   Service: ' +
      (game.serviceConnection?.get_connected() ? 'connected' : 'disconnected') +
      '   RTT estimate: ' +
      (Number.isFinite(latency) ? Math.round(latency * 2) + ' ms' : '--') +
      '\n' +
      profiler.format()
    );
  };
  const overlay = () => Starling.get_current()?.get_nativeOverlay();
  const toggle = () => {
    const container = overlay();
    return !game.get_isLeaving() && container ? panel.toggle(container) : false;
  };
  const previous = Object.getOwnPropertyDescriptor(game, 'toggleProfiler');
  game.toggleProfiler = toggle;
  const measure = <T extends object, K extends MethodKey<T>>(
    object: T | null,
    method: K,
    label: string,
  ) => {
    if (!object) return;
    reflection.around(object, method, function (next, ...args) {
      if (!profiler.active) return next(...args) as ReturnType<MethodOf<T, K>>;
      const start = now();
      try {
        return next(...args) as ReturnType<MethodOf<T, K>>;
      } finally {
        profiler.record(label, now() - start);
      }
    });
  };
  measure(game.playerManager, 'update', 'Players.update');
  measure(game.shipManager, 'update', 'Tick: ships');
  measure(game.weaponManager, 'update', 'Tick: weapons');
  measure(game.projectileManager, 'update', 'Tick: projectiles');
  measure(game.bodyManager, 'update', 'Bodies.update');
  measure(game.gameStateMachine, 'update', 'State + ticks + movement');
  measure(game.parallaxManager, 'update', 'Background.update');
  measure(game.parallaxManager, 'draw', 'Background.draw');
  measure(game.textManager, 'update', 'Frame: floating text');
  measure(game, 'tickUpdate', 'TOTAL simulation tick CPU');
  measure(game, 'draw', 'Game.draw CPU');
  // The native Game subscribes on this dispatcher. A second listener avoids
  // replacing its cached bound callback and counts frames even without parallax.
  const frame = (event: Event) => {
    if (profiler.active)
      profiler.frame(reflection.cast(event, 'starling.events.EnterFrameEvent').get_passedTime());
  };
  game.addEventListener('enterFrame', frame);
  api.defer(() => game.removeEventListener('enterFrame', frame));
  const registry: unknown = api.cls('af.ChatCommandRegistry');
  if (registry && (typeof registry === 'function' || typeof registry === 'object')) {
    const reserve: unknown = Reflect.get(registry, 'reserveBuiltInCommands');
    if (typeof reserve === 'function') Reflect.apply(reserve, registry, [['profiler']]);
  }
  const chat = game.chatInput;
  if (chat)
    reflection.around(chat, 'sendMessage', function (next) {
      if (!/^\/profiler\s*$/i.test(chat.input.get_text().trim())) return next();
      chat.input.set_text('');
      chat.updateTab();
      MessageLog.write(toggle() ? 'Profiler enabled.' : 'Profiler disabled.');
    });
  const container = overlay();
  if (container) panel.restore(container);
  api.defer(() => {
    panel.dispose();
    profiler.setActive(false);
    if (previous) Object.defineProperty(game, 'toggleProfiler', previous);
    else delete game.toggleProfiler;
  });
}
