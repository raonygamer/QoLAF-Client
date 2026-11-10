import type { API, Raw } from '../api/Types';
import type { WeaponColor } from './WeaponColors';

/** Source Instant/InstantSplitting enter tinting, before pooled lines initialize. */
export function installInstantWeaponColors(
  api: API,
  game: Raw,
  selected: (weapon: Raw | null) => WeaponColor | null,
): (line: Raw) => WeaponColor | undefined {
  const lines = new WeakMap<Raw, WeaponColor>();
  const projectiles = new Map<
    Raw,
    { color?: PropertyDescriptor; grayscale?: PropertyDescriptor }
  >();
  let initializing: WeaponColor | null = null;
  const restore = (projectile: Raw) => {
    const previous = projectiles.get(projectile);
    if (!previous) return;
    for (const [key, descriptor] of [
      ['determinedColor', previous.color],
      ['determinedGrayscale', previous.grayscale],
    ] as const) {
      if (descriptor) Object.defineProperty(projectile, key, descriptor);
      else delete projectile[key];
    }
    projectiles.delete(projectile);
  };
  const line = api.cls('core.hud.components.BeamLine')?.prototype;
  if (!line) return () => undefined;
  api.around(line, 'init', function (next, ...args) {
    lines.delete(this);
    if (initializing) {
      lines.set(this, initializing);
      args[3] = args[6] = initializing.color;
    }
    return next(...args);
  });
  for (const name of ['Instant', 'InstantSplitting']) {
    const state = api.cls(`core.states.aistates.${name}`)?.prototype;
    if (!state) continue;
    api.around(state, 'enter', function (next, ...args) {
      if (this.g !== game) return next(...args);
      restore(this.p);
      const color = selected(this.p.weapon);
      const previous = initializing;
      initializing = color;
      if (color) {
        projectiles.set(this.p, {
          color: Object.getOwnPropertyDescriptor(this.p, 'determinedColor'),
          grayscale: Object.getOwnPropertyDescriptor(this.p, 'determinedGrayscale'),
        });
        this.p.determinedColor = color.color;
        this.p.determinedGrayscale = color.grayscale;
      }
      try {
        return next(...args);
      } finally {
        initializing = previous;
      }
    });
  }
  const projectile = api.cls('core.projectile.Projectile')?.prototype;
  if (projectile)
    api.before(projectile, 'reset', function () {
      restore(this);
    });
  api.defer(() => {
    for (const projectile of projectiles.keys()) restore(projectile);
  });
  return (line) => lines.get(line);
}
