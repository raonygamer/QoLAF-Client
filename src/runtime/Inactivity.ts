import type { API, Raw } from '../api/Types';

/** Original persistent preference plus temporary module ownership, per game session. */
export function installInactivityPreference(api: API, game: Raw): void {
  const settings = () => api.cls('core.scene.SceneBase')!.clientSettings;
  const persistent = () => !!settings()?.dontKick;
  const active = () => persistent() || !!game.automationManager?.transientDontKickActive;
  const set = (value: boolean) => {
    settings().dontKick = value; // ClientSettings setter persists per account.
    api.cls('core.scene.Game')!.playerPerformedAction();
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
      else delete game[name];
    });
  }
  const native = api.cls('core.scene.Game')!.prototype;
  if (typeof native.disconnectIfInactive === 'function')
    api.around(native, 'disconnectIfInactive', function (next, ...args) {
      if (this !== game || !active()) return next(...args);
    });
}
