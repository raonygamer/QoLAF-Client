import { read, type API, type Raw } from '../api/Types';
import { isBoundMethod } from '../runtime/As3';
import { portedClasses } from '../ported/Registry';
import { createSettingsState } from '../ported/SettingsState';
import { devicePreferenceKeys, type DeviceSettings } from './DeviceSettings';

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
    const originalStarling = api.cls('starling.core.Starling')?.get_current();
    const originalStage = read(originalStarling, 'nativeStage');
    const originalFrameRate = read(originalStage, 'frameRate');
    const originalSkipFrames = read(originalStarling, 'skipUnchangedFrames');
    api.defer(() => {
      if (originalFrameRate !== undefined) originalStage.set_frameRate(originalFrameRate);
      if (originalSkipFrames !== undefined)
        originalStarling.set_skipUnchangedFrames(originalSkipFrames);
    });
    const applyFrameRate = () => {
      const starling = api.cls('starling.core.Starling')?.get_current();
      if (!starling) return;
      const limit = preferences.get('renderFrameRate');
      starling.set_skipUnchangedFrames(false);
      starling.get_nativeStage().set_frameRate(limit >= 241 ? 1000 : limit);
    };
    api.defer(
      preferences.subscribe((key) => {
        if (key === 'renderFrameRate') applyFrameRate();
      }),
    );
    applyFrameRate();
  }
  const source = createSettingsState(portedClasses(api).resolve);
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
        source.initializeNative(this);
        initialized.add(this);
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
    for (const state of live) state.close();
    live.clear();
  });
}
