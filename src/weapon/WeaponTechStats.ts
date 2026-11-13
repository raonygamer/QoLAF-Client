import type { API } from '../api/Types';
import { GameReflection } from '../api/GameReflection';
import { Weapon } from '../game/Bindings';

/** Original addTechStats keeps authored variance when the tech level omits it. */
export function installWeaponTechStats(api: API): void {
  const reflection = new GameReflection(api);
  reflection.around(Weapon.prototype, 'addTechStats', function (next, definition, level) {
    const effectiveLevel = Math.min(level, 6);
    const finalLevel = definition.techLevels[effectiveLevel - 1];
    const preserve =
      Number.isInteger(effectiveLevel) &&
      effectiveLevel > 0 &&
      finalLevel !== undefined &&
      !Object.hasOwn(finalLevel, 'positionVariance');
    const variance = this.positionYVariance;
    const result = next(definition, level);
    if (preserve) this.positionYVariance = variance;
    return result;
  });
}
