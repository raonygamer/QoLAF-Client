import type { API } from '../api/Types';

/** Device-local additions from data/Settings.as. Server settings stay upstream. */
export interface DevicePreferences {
  renderFrameRate: number;
  dpiScale: number;
  legacyChatFontSize: number;
  enableNewChatIntegrationSystem: boolean;
  backgroundOpacity: number;
  starBrightness: number;
  cameraZoom: number;
  compactWarpGateUI: boolean;
  showBlackHoleDistortion: boolean;
  formatDamageText: boolean;
  formatHealthAndShield: boolean;
  formatTargetBarValues: boolean;
  showPlayerClanIdentification: boolean;
  disableSpaceToRespawn: boolean;
}

const defaults: DevicePreferences = {
  renderFrameRate: 241,
  dpiScale: 1,
  legacyChatFontSize: 14,
  enableNewChatIntegrationSystem: true,
  backgroundOpacity: 0.3,
  starBrightness: 0.3,
  cameraZoom: 1,
  compactWarpGateUI: true,
  showBlackHoleDistortion: true,
  formatDamageText: true,
  formatHealthAndShield: true,
  formatTargetBarValues: false,
  showPlayerClanIdentification: true,
  disableSpaceToRespawn: true,
};

export const devicePreferenceKeys = Object.keys(defaults) as (keyof DevicePreferences)[];
const ranges = {
  renderFrameRate: [30, 241],
  dpiScale: [0.5, 2],
  legacyChatFontSize: [12, 24],
  backgroundOpacity: [0, 1],
  starBrightness: [0, 1],
  cameraZoom: [0.25, 2],
} as const;
type NumberPreference = keyof typeof ranges;

export class DeviceSettings {
  private values = { ...defaults };
  private dirty = false;
  private listeners = new Set<(key: keyof DevicePreferences) => void>();

  constructor(private readonly storage: API['storage']) {
    const saved = storage.get<Record<string, unknown>>('device-settings', {});
    if (!saved || typeof saved !== 'object') return;
    for (const key of Object.keys(defaults) as (keyof DevicePreferences)[]) {
      if (!(key in saved)) continue;
      if (typeof defaults[key] === 'boolean') {
        (this.values[key] as boolean) = Boolean(saved[key]);
      } else {
        const numericKey = key as NumberPreference;
        const value = Number(saved[key]);
        const [minimum, maximum] = ranges[numericKey];
        if (key === 'cameraZoom') this.values.cameraZoom = this.clampCameraZoom(value);
        else if (Number.isFinite(value) && value >= minimum && value <= maximum) {
          this.values[numericKey] =
            key === 'legacyChatFontSize'
              ? Math.round(value)
              : key === 'renderFrameRate'
                ? Math.trunc(value)
                : value;
        }
      }
    }
    // Before the original gained canvasStars, background opacity dimmed both.
    if (!('starBrightness' in saved)) this.values.starBrightness = this.values.backgroundOpacity;
    if (!('disableSpaceToRespawn' in saved) && 'autoRespawn' in saved) {
      this.values.disableSpaceToRespawn = Boolean(saved.autoRespawn);
    }
  }

  get<K extends keyof DevicePreferences>(key: K): DevicePreferences[K] {
    return this.values[key];
  }

  set<K extends keyof DevicePreferences>(key: K, value: DevicePreferences[K]): void {
    let normalized: number | boolean = value;
    if (typeof defaults[key] === 'number') {
      const [minimum, maximum] = ranges[key as NumberPreference];
      normalized =
        key === 'cameraZoom'
          ? this.clampCameraZoom(Number(value))
          : Math.max(minimum, Math.min(maximum, Number(value)));
      if (!Number.isFinite(normalized)) return;
      if (key === 'renderFrameRate' || key === 'legacyChatFontSize')
        normalized = Math.trunc(normalized);
    } else normalized = Boolean(value);
    if (this.values[key] === normalized) return;
    this.values[key] = normalized as DevicePreferences[K];
    this.dirty = true;
    for (const listener of this.listeners) listener(key);
  }

  subscribe(listener: (key: keyof DevicePreferences) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  flush(): void {
    if (!this.dirty) return;
    this.storage.set('device-settings', { ...this.values });
    this.dirty = false;
  }

  private clampCameraZoom(value: number): number {
    return Number.isFinite(value) ? Math.max(0.25, Math.min(2, value)) : 1;
  }
}
