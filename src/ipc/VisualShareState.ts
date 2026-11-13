import type { Raw } from '../api/Types';
import { ClientDevVisual } from '../visuals/ClientDevVisual';
import { VisualShareWire } from './VisualShareWire';

/** Canonical equality fingerprint from VisualShareHandshake.as; never authentication. */
export class VisualShareState {
  static hash(state: Raw, md5: (text: string) => string): string {
    try {
      const message = VisualShareWire.encode(state, '000000000000', 1);
      const normalized = message && VisualShareWire.decode(message)?.state;
      if (!normalized) return '';
      const styles = Object.keys(normalized.weaponStyles)
        .sort()
        .map((key) => [
          key,
          normalized.weaponStyles[key].color,
          normalized.weaponStyles[key].grayscale,
        ]);
      const canonical: unknown[] = [
        normalized.enabled,
        normalized.source,
        normalized.key,
        normalized.engineKey,
        normalized.shadowDisabled,
        normalized.originalColor,
        normalized.useVisualEmitters,
        normalized.shootingPointIndex,
        normalized.aura,
        styles,
      ];
      if (normalized.devvis !== 'default') canonical.push(normalized.devvis);
      if (!ClientDevVisual.isDefault(normalized.devvisSettings))
        canonical.push(ClientDevVisual.signature(normalized.devvisSettings));
      if (normalized.scale !== 1) canonical.push(['scale', normalized.scale]);
      return md5(JSON.stringify(canonical)).toLowerCase();
    } catch {
      return '';
    }
  }

  static validHash(value: unknown): value is string {
    return typeof value === 'string' && /^[0-9a-f]{32}$/.test(value);
  }
}
