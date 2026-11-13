import type { API } from '../api/Types';
import { AIResurect, EmitterFactory } from '../game/Bindings';

/** Original reconstruction effects both originate on and follow the reconstructing ship. */
export function installReconstructionEffects(api: API): void {
  // Native enemy destruction branches on this label. Reconstruction must not
  // enter teleport cleanup, which also resets the ship's resources on exit.
  api.around(AIResurect.prototype, 'get_type', () => 'AIResurect');
  api.around(AIResurect.prototype, 'enter', function (next) {
    const ship = this.s;
    const restore = api.around(
      EmitterFactory,
      'create',
      function (create, key, game, x, y, target, ...options) {
        if (key === '5BSaDIEYj0mEuVkMVp1JGw' && game === ship.g && target == null) {
          const position = ship.get_pos();
          return create(key, game, position.x, position.y, ship, ...options);
        }
        return create(key, game, x, y, target, ...options);
      },
    );
    try {
      return next();
    } finally {
      restore();
    }
  });
}
