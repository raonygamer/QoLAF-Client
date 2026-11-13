import type { API } from '../api/Types';
import { AIStateFactory, DataLocator, EnemyShip } from '../game/Bindings';

/** Source AIStateFactory instantStyle selection; only constructor appearance changes. */
export function installNetherBeamStyle(api: API): void {
  api.around(AIStateFactory, 'createProjectileAI', function (next, original, game, projectile) {
    if (
      original.ai !== 'instant' ||
      projectile.weapon?.key !== '222ekuHQxE6j9IOXMVXs6g' ||
      !(projectile.unit instanceof EnemyShip) ||
      !projectile.unit.hasFaction('Nether')
    )
      return next(original, game, projectile);
    const style = DataLocator.getService().loadKey('Projectiles', '-gg79fF6tUObIXe40zzifg');
    if (!style) return next(original, game, projectile);
    const appearance = { ...original };
    for (const key of ['color', 'glowColor', 'thickness', 'alpha'] as const)
      appearance[key] = style[key];
    appearance.texture = style.texture;
    if (Object.hasOwn(style, 'amplitude')) appearance.amplitude = style.amplitude;
    else delete appearance.amplitude;
    if (Object.hasOwn(style, 'frequency')) appearance.frequency = style.frequency;
    else delete appearance.frequency;
    return next(appearance, game, projectile);
  });
}
