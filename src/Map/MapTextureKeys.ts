import type { API } from '../Api/Types';

/** Source map-orbits/map-elite keys prevent reuse of differently scaled world art. */
export function installMapTextureKeys(api: API): void {
  const textures = api.cls('textures.TextureManager');
  if (typeof textures?.imageFromSprite !== 'function') return;
  let key: string | undefined;
  for (const [name, prefix] of [
    ['core.hud.components.map.MapBodyBase', 'map-orbits'],
    ['core.hud.components.map.MapEliteArea', 'map-elite'],
  ]) {
    const prototype = api.cls(name)?.prototype;
    if (typeof prototype?.addOrbits !== 'function') continue;
    api.around(prototype, 'addOrbits', function (next, ...args) {
      const previous = key;
      key = `${prefix}:${this.body.key}:${api.cls('core.hud.components.map.Map')!.SCALE}`;
      try {
        return next(...args);
      } finally {
        key = previous;
      }
    });
  }
  api.around(textures, 'imageFromSprite', function (next, sprite, nativeKey, ...args) {
    return next(sprite, key ?? nativeKey, ...args);
  });
}
