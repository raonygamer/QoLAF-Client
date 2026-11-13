import type { ControllerStyle } from './ControllerIdentity';
import type { API } from '../api/Types';
import type { ControllerMapping, ControllerThresholds } from './ControllerInput';

export const previousWeaponAction = 29;
export const nextWeaponAction = 30;

export interface ControllerPreferences extends ControllerThresholds {
  enabled: boolean;
  iconStyle: ControllerStyle;
  controllerIndex: number;
  vibration: number;
  adaptiveTriggers: boolean;
  triggerStrength: number;
  systemLight: boolean;
  populationLights: boolean;
  mappings: ControllerMapping[];
}

export function defaultControllerPreferences(): ControllerPreferences {
  return {
    enabled: false,
    iconStyle: 'auto',
    controllerIndex: -1,
    deadzone: 0.15,
    press: 0.5,
    release: 0.35,
    exponent: 1,
    vibration: 0.6,
    adaptiveTriggers: false,
    triggerStrength: 0.5,
    systemLight: false,
    populationLights: false,
    mappings: [
      { action: 13, binding: { kind: 'axis', index: 0, direction: -1 } },
      { action: 14, binding: { kind: 'axis', index: 0, direction: 1 } },
      { action: 11, binding: { kind: 'axis', index: 1, direction: -1 } },
      { action: 12, binding: { kind: 'axis', index: 1, direction: 1 } },
      ...[
        [19, 7],
        [16, 6],
        [15, 0],
        [18, 2],
        [17, 1],
        [10, 3],
        [previousWeaponAction, 4],
        [nextWeaponAction, 5],
        [20, 12],
        [21, 15],
        [22, 13],
        [23, 14],
        [24, 10],
        [9, 8],
        [8, 9],
      ].map(
        ([action, index]): ControllerMapping => ({ action, binding: { kind: 'button', index } }),
      ),
    ],
  };
}

export class ControllerSettings {
  readonly values: ControllerPreferences;
  constructor(private readonly storage: API['storage']) {
    const defaults = defaultControllerPreferences();
    const saved = storage.get<Partial<ControllerPreferences> | null>('controller-settings', null);
    this.values = defaults;
    if (!saved || typeof saved !== 'object') return;
    if (['auto', 'xbox', 'playstation', 'generic'].includes(saved.iconStyle ?? ''))
      defaults.iconStyle = saved.iconStyle!;
    for (const key of ['enabled', 'adaptiveTriggers', 'systemLight', 'populationLights'] as const)
      if (typeof saved[key] === 'boolean') defaults[key] = saved[key];
    for (const [key, minimum, maximum] of [
      ['controllerIndex', -1, 15],
      ['deadzone', 0, 0.95],
      ['press', 0.01, 1],
      ['release', 0, 0.99],
      ['exponent', 0.25, 4],
      ['vibration', 0, 1],
      ['triggerStrength', 0, 1],
    ] as const) {
      const value = saved[key];
      if (typeof value === 'number' && Number.isFinite(value))
        defaults[key] = Math.min(maximum, Math.max(minimum, value));
    }
    defaults.controllerIndex = Math.trunc(defaults.controllerIndex);
    defaults.release = Math.min(defaults.release, defaults.press - 0.001);
    if (Array.isArray(saved.mappings)) defaults.mappings = saved.mappings.filter(validMapping);
  }

  save(): void {
    this.storage.set('controller-settings', this.values);
  }
}

function validMapping(value: unknown): value is ControllerMapping {
  if (!value || typeof value !== 'object' || !('action' in value) || !('binding' in value))
    return false;
  if (
    typeof value.action !== 'number' ||
    !Number.isInteger(value.action) ||
    value.action < 0 ||
    value.action > 30
  )
    return false;
  const binding = value.binding;
  if (!binding || typeof binding !== 'object' || !('index' in binding) || !('kind' in binding))
    return false;
  if (
    typeof binding.index !== 'number' ||
    !Number.isInteger(binding.index) ||
    binding.index < 0 ||
    binding.index > 63
  )
    return false;
  return (
    binding.kind === 'button' ||
    (binding.kind === 'axis' &&
      'direction' in binding &&
      (binding.direction === 1 || binding.direction === -1))
  );
}
