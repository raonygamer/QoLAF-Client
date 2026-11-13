import type { ControllerPreferences } from './ControllerSettings';
import type { DualSenseOutput, TriggerEffect } from './DualSenseReport';

export interface WeaponFeedback {
  type: string;
  interval: number;
  speed: number;
  firing: boolean;
  charging: boolean;
  missile: boolean;
}

export function weaponTrigger(weapon: WeaponFeedback | null, strength: number): TriggerEffect {
  if (!weapon || strength <= 0 || ['teleport', 'cloak', 'petSpawner'].includes(weapon.type))
    return { kind: 'off' };
  if (weapon.charging && !weapon.firing)
    return { kind: 'resistance', start: 2, strength: strength * 0.35 };
  if (!weapon.firing) return { kind: 'weapon', start: 2, end: 6, strength: strength * 0.45 };
  if (weapon.type !== 'beam' && weapon.interval >= 250)
    return { kind: 'weapon', start: 2, end: 7, strength };
  return {
    kind: 'vibration',
    start: 2,
    strength:
      strength * Math.max(0.35, Math.min(1, weapon.type === 'beam' ? 0.65 : weapon.speed / 1000)),
    frequency: Math.max(1, Math.min(60, Math.round(1000 / Math.max(17, weapon.interval)))),
  };
}

/** Stable per-system palette, independent of map iteration order or room ID. */
export function systemLight(key: string): readonly [number, number, number] {
  let hash = 2166136261;
  for (const char of key) hash = Math.imul(hash ^ char.charCodeAt(0), 16777619);
  const hue = ((hash >>> 0) % 360) / 60;
  const x = 180 * (1 - Math.abs((hue % 2) - 1));
  const rgb =
    hue < 1
      ? [180, x, 0]
      : hue < 2
        ? [x, 180, 0]
        : hue < 3
          ? [0, 180, x]
          : hue < 4
            ? [0, x, 180]
            : hue < 5
              ? [x, 0, 180]
              : [180, 0, x];
  return [Math.round(rgb[0] + 35), Math.round(rgb[1] + 35), Math.round(rgb[2] + 35)];
}

export function feedbackOutput(
  preferences: ControllerPreferences,
  weapon: WeaponFeedback | null,
  system: string,
  population: number,
  damage: number,
  boosting: boolean,
): DualSenseOutput {
  const effect = preferences.adaptiveTriggers
    ? weaponTrigger(weapon, preferences.triggerStrength)
    : { kind: 'off' as const };
  const firesWith = (index: number) =>
    preferences.mappings.some(
      (mapping) =>
        mapping.action === 19 &&
        mapping.binding.kind === 'button' &&
        mapping.binding.index === index,
    );
  return {
    right: firesWith(7) ? effect : { kind: 'off' },
    left: firesWith(6) ? effect : { kind: 'off' },
    weak: preferences.vibration * Math.min(1, damage * 0.6 + (boosting ? 0.15 : 0)),
    strong: preferences.vibration * Math.min(1, damage),
    light: preferences.systemLight ? systemLight(system) : undefined,
    population: preferences.populationLights ? population : undefined,
  };
}
