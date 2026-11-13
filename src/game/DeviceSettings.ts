import type { DevicePreferences } from '../settings/DeviceSettings';
import type {} from './Game';

declare module './Game' {
  namespace Game.data {
    interface Settings extends Partial<DevicePreferences> {}
  }
}
