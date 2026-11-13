import { type API, type Raw } from '../api/Types';
import { isBoundMethod } from '../runtime/HaxeInterop';
import { portedClasses } from '../ported/Registry';
import { createSettingsState } from '../ported/SettingsState';
import { devicePreferenceKeys, type DeviceSettings } from './DeviceSettings';
import { GameReflection } from '../api/GameReflection';
import { closeSettingsForUnload, detachSettingsResizeListeners } from './SettingsUnload';

/** Retain the game's state identity and host Plugins hooks, replacing its pages. */
export function installNativeSettings(api: API, preferences?: DeviceSettings): void {
  const native = api.cls('core.states.gameStates.SettingsState')?.prototype;
  if (typeof native?.show !== 'function') return;
  const settings = api.cls('core.scene.SceneBase')!.settings;
  if (preferences) {
    for (const key of devicePreferenceKeys) {
      // These two properties are already owned by BackgroundLayers.
      if (key === 'backgroundOpacity' || key === 'starBrightness') continue;
      const previous = Object.getOwnPropertyDescriptor(settings, key);
      Object.defineProperty(settings, key, {
        configurable: true,
        get: () => preferences.get(key),
        set: (value) => preferences.set(key, value),
      });
      api.defer(() => {
        if (previous) Object.defineProperty(settings, key, previous);
        else delete settings[key];
      });
    }
    api.before(settings, 'save', () => preferences.flush());
  }
  const source = createSettingsState(portedClasses(api).resolve);
  const reflection = new GameReflection(api);
  const initialized = new WeakSet<Raw>();
  const live = new Set<Raw>();
  for (const [name, descriptor] of Object.entries(
    Object.getOwnPropertyDescriptors(source.prototype),
  )) {
    if (name === 'constructor') continue;
    const method =
      descriptor.value ??
      (isBoundMethod(descriptor) ? descriptor.get!.call(source.prototype) : undefined);
    if (typeof method !== 'function') continue;
    const invoke = function (this: Raw, ...args: any[]) {
      if (!initialized.has(this)) {
        // The open vanilla state may retain a closure bound before these hooks.
        // Rebuilding it enters PlayState again and registers the new closure.
        if (
          name === 'enter' ||
          (name !== 'exit' && name !== 'close' && this.g?.gameStateMachine?.currentState === this)
        )
          detachSettingsResizeListeners(
            reflection.cast(this, 'core.states.gameStates.SettingsState'),
          );
        source.initializeNative(this);
        initialized.add(this);
        // Hot enable can encounter a SettingsState that already entered while
        // this adapter was absent. Re-enter through the native dispatcher so
        // the host also remounts its Plugins category on the rebuilt panel.
        if (
          name !== 'enter' &&
          name !== 'exit' &&
          name !== 'close' &&
          this.g?.gameStateMachine?.currentState === this
        )
          this.enter();
      }
      if (name === 'enter') live.add(this);
      if (name === 'exit') live.delete(this);
      return method.apply(this, args);
    };
    Object.defineProperty(invoke, 'length', { value: method.length });
    if (typeof native[name] === 'function') {
      api.around(native, name, function (_next, ...args) {
        return invoke.apply(this, args);
      });
    } else {
      Object.defineProperty(native, name, { configurable: true, writable: true, value: invoke });
      api.defer(() => {
        if (native[name] === invoke) delete native[name];
      });
    }
  }
  api.defer(() => {
    for (const state of live)
      closeSettingsForUnload(reflection.cast(state, 'core.states.gameStates.SettingsState'));
    live.clear();
  });
  const game = api.game;
  const current = game?.gameStateMachine?.currentState;
  if (
    game &&
    !game.get_isLeaving() &&
    reflection.is(current, 'core.states.gameStates.SettingsState')
  )
    current.enter();
}
