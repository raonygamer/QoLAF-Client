import type { API } from '../api/Types';
import { GameReflection } from '../api/GameReflection';
import { GameScene, SceneBase } from '../game/Bindings';
import type { AutomationGame } from '../game/AutomationGame';

/** Original persistent preference plus temporary module ownership, per game session. */
export function installInactivityPreference(api: API, game: AutomationGame): void {
  const settings = () => SceneBase.clientSettings;
  const persistent = () => !!settings()?.dontKick;
  const active = () => persistent() || !!game.automationManager?.transientDontKickActive;
  const set = (value: boolean) => {
    const current = settings();
    if (!current) return false;
    current.dontKick = value; // ClientSettings setter persists per account.
    GameScene.playerPerformedAction();
    return value;
  };
  const properties: Record<string, PropertyDescriptor> = {
    setInactivityDisconnectPrevention: { value: set, writable: true },
    toggleInactivityDisconnectPrevention: { value: () => set(!persistent()), writable: true },
    persistentInactivityDisconnectPrevention: { get: persistent },
    inactivityDisconnectPreventionActive: { get: active },
    get_persistentInactivityDisconnectPrevention: { value: persistent, writable: true },
    get_inactivityDisconnectPreventionActive: { value: active, writable: true },
  };
  for (const [name, descriptor] of Object.entries(properties)) {
    const previous = Object.getOwnPropertyDescriptor(game, name);
    Object.defineProperty(game, name, { configurable: true, ...descriptor });
    api.defer(() => {
      const current = Object.getOwnPropertyDescriptor(game, name);
      if (current?.value !== descriptor.value || current?.get !== descriptor.get) return;
      if (previous) Object.defineProperty(game, name, previous);
      else Reflect.deleteProperty(game, name);
    });
  }
  const watchedTimers = new WeakSet<object>();
  const watchTimer = () => {
    const timer = game.idleTimer;
    if (!timer || watchedTimers.has(timer)) return;
    watchedTimers.add(timer);
    api.around(timer, 'run', () => {
      // A cancelled/replaced timer must not operate on the current room.
      if (game.idleTimer === timer) game.disconnectIfInactive();
    });
  };
  new GameReflection(api).around(GameScene.prototype, 'disconnectIfInactive', function (next) {
    if (this !== game) return next();
    const elapsed = (new Date().getTime() - GameScene.lastActive) | 0;
    if (!active() && elapsed > 1800000) {
      api.log('Inactivity disconnect: protection off, idle for', elapsed, 'ms');
      return next();
    }
    // Keep the native recurring timer, but never enter its 10-minute kick
    // branch while protected or before the original client's 30-minute limit.
    if (!game.idleTimer) {
      const previous = GameScene.lastActive;
      const bootstrapTime = new Date().getTime() | 0;
      GameScene.lastActive = bootstrapTime;
      try {
        next();
      } finally {
        if (GameScene.lastActive === bootstrapTime) GameScene.lastActive = previous;
      }
    }
    watchTimer();
  });
  // The initial Haxe callback was bound before session hooks were installed.
  // Also watch every subsequently created timer, not just that first instance.
  watchTimer();
}
