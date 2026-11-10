import type { API, Raw } from '../api/Types';

/** Source AIStateFactory instantStyle selection; only constructor appearance changes. */
export function installNetherBeamStyle(api: API): void {
  const factory = api.cls('core.states.aistates.AIStateFactory');
  const Enemy = api.cls('core.ship.EnemyShip') as any;
  const data = api.cls('data.DataLocator');
  if (!factory?.createProjectileAI || !Enemy || !data) return;
  api.around(factory, 'createProjectileAI', function (next, original, game, projectile) {
    if (
      original.ai !== 'instant' ||
      projectile.weapon?.key !== '222ekuHQxE6j9IOXMVXs6g' ||
      !(projectile.unit instanceof Enemy) ||
      !projectile.unit.hasFaction('Nether')
    )
      return next(original, game, projectile);
    const style = data.getService().loadKey('Projectiles', '-gg79fF6tUObIXe40zzifg');
    if (!style) return next(original, game, projectile);
    const appearance: Raw = { ...original };
    for (const key of ['color', 'glowColor', 'thickness', 'alpha', 'texture'])
      appearance[key] = style[key];
    for (const key of ['amplitude', 'frequency']) {
      if (Object.hasOwn(style, key)) appearance[key] = style[key];
      else delete appearance[key];
    }
    return next(appearance, game, projectile);
  });
}
