import { normalizeSavedProfiles, type Profile } from './LoginProfile';

export interface LoginProfileState {
  profiles: Profile[];
  /** Persisted last authenticated profile, not the currently highlighted row. */
  selected: string | null;
  autoLogin: boolean;
  steamIntegrationEnabled: boolean;
  steamProfileNames: Record<string, string>;
}

/** Validate persisted JSON before it reaches account selection/authentication. */
export function decodeLoginProfileState(value: unknown): LoginProfileState {
  const result: LoginProfileState = {
    profiles: [],
    selected: null,
    autoLogin: false,
    steamIntegrationEnabled: true,
    steamProfileNames: {},
  };
  if (!value || typeof value !== 'object' || Array.isArray(value)) return result;
  if ('profiles' in value) result.profiles = normalizeSavedProfiles(value.profiles);
  if ('selected' in value && typeof value.selected === 'string') result.selected = value.selected;
  if ('autoLogin' in value) result.autoLogin = value.autoLogin === true;
  if ('steamIntegrationEnabled' in value)
    result.steamIntegrationEnabled = value.steamIntegrationEnabled !== false;
  if ('steamProfileNames' in value) {
    const names = value.steamProfileNames;
    if (names && typeof names === 'object' && !Array.isArray(names)) {
      for (const key of Object.keys(names)) {
        const name: unknown = Reflect.get(names, key);
        if (typeof name === 'string')
          Object.defineProperty(result.steamProfileNames, key, {
            value: name.trim().slice(0, 64),
            enumerable: true,
            writable: true,
            configurable: true,
          });
      }
    }
  }
  return result;
}
