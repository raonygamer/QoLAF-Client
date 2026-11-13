import type { API } from '../api/Types';
import { GameReflection } from '../api/GameReflection';
import { ShipFactory } from '../game/Bindings';

/** Body/name setters can refresh labels before the native factory assigns player. */
export function installShipCreation(api: API): void {
  new GameReflection(api).before(ShipFactory, 'createPlayer', function (_game, player, ship) {
    ship.player = player;
  });
}
