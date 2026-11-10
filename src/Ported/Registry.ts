import { createSettingsAutomations } from './SettingsAutomations';
import { createFontRegistries } from '../UI/FontRegistries';
import { createButtonAdapter } from '../UI/ButtonAdapter';
import { createSettingsBindings } from './SettingsBindings';
import { createSettingsChat } from './SettingsChat';
import { createSettingsKeybind } from './SettingsKeybind';
import type { API, Raw } from '../Api/Types';
import { aliasProperties } from '../Runtime/As3';
import { createLoginButton } from './LoginButton';
import { createLoginProfilePanel } from './LoginProfilePanel';
import { createLoginAccountTypePanel } from './LoginAccountTypePanel';
import { createSettingsWindowChrome } from './SettingsWindowChrome';
import { createSettingsGeneral } from './SettingsGeneral';
import { createSettingsQoLAF } from './SettingsQoLAF';
import { settingsControls } from '../Settings/NativeControls';
export function portedClasses(api: API) {
  const cache: Record<string, any> = {
    'starling.utils.Align': {
      LEFT: 'left',
      CENTER: 'center',
      RIGHT: 'right',
      TOP: 'top',
      BOTTOM: 'bottom',
    },
    'starling.events.TouchPhase': {
      BEGAN: 'began',
      ENDED: 'ended',
      HOVER: 'hover',
      MOVED: 'moved',
      STATIONARY: 'stationary',
    },
  };
  const resolve = (name: string): any => {
    if (cache[name]) return cache[name];
    if (
      name === 'core.text.RussoBitmapFontRegistry' ||
      name === 'core.text.VerdanaBitmapFontRegistry'
    ) {
      const fonts = createFontRegistries(resolve);
      cache['core.text.RussoBitmapFontRegistry'] = fonts.RussoBitmapFontRegistry;
      cache['core.text.VerdanaBitmapFontRegistry'] = fonts.VerdanaBitmapFontRegistry;
      return cache[name];
    }
    if (name.startsWith('feathers.controls.')) {
      Object.assign(cache, settingsControls(resolve));
      if (cache[name]) return cache[name];
    }
    if (name === 'qolaf.data.ClientSettings') {
      const instance = resolve('core.scene.SceneBase').clientSettings;
      if (!instance) throw Error('Initialize session settings before opening a settings page');
      return (cache[name] = instance.constructor);
    }
    if (name === 'core.hud.components.SettingsKeybind')
      return (cache[name] = createSettingsKeybind(resolve));
    if (name === 'core.states.gameStates.SettingsAutomations')
      return (cache[name] = createSettingsAutomations(resolve));
    if (name === 'core.states.gameStates.SettingsChat')
      return (cache[name] = createSettingsChat(resolve));
    if (name === 'core.states.gameStates.SettingsBindings')
      return (cache[name] = createSettingsBindings(resolve));
    if (name === 'qolaf.states.SettingsQoLAF') return (cache[name] = createSettingsQoLAF(resolve));
    if (name === 'core.states.gameStates.SettingsGeneral')
      return (cache[name] = createSettingsGeneral(resolve));
    const cls = api.cls(name);
    if (!cls) throw Error('Missing native dependency: ' + name);
    // Importing Sprite also needs inherited DisplayObject properties.
    for (let current: Raw | undefined = cls; current; current = current.__super__)
      aliasProperties(api, current);
    if (name === 'core.hud.components.Button')
      return (cache[name] = createButtonAdapter(cls, resolve));
    if (name === 'RymdenRunt') {
      return (cache[name] = Object.assign(Object.create(cls), {
        UNLIMITED_FRAME_RATE: 241,
        MIN_DPI_SCALE: 0.5,
        MAX_DPI_SCALE: 2,
      }));
    }
    return (cache[name] = cls);
  };
  cache['core.hud.components.LoginButton'] = createLoginButton(resolve);
  cache['core.hud.components.LoginProfilePanel'] = createLoginProfilePanel(resolve);
  cache['core.hud.components.LoginAccountTypePanel'] = createLoginAccountTypePanel(resolve);
  cache['core.hud.components.SettingsWindowChrome'] = createSettingsWindowChrome(resolve);
  return { resolve };
}
