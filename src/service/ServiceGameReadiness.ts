import type { GameScene, Connection } from '../game/Bindings';

/** Native initialization state plus the original client's reveal/recovery accessors. */
export interface ServiceGameState
  extends Partial<
    Pick<
      GameScene,
      | 'get_connected'
      | 'get_isLeaving'
      | 'initSolarSystemComplete'
      | 'initPlayerComplete'
      | 'initEnemyPlayersComplete'
      | 'initEnemiesComplete'
      | 'initDropsComplete'
      | 'initServerComplete'
      | 'synchedEnemies'
    >
  > {
  connected?: boolean;
  isLeaving?: boolean;
  serviceConnected?: boolean;
  get_serviceConnected?: () => boolean;
  serviceConnection?: (Partial<Pick<Connection, 'get_connected'>> & { connected?: boolean }) | null;
  isRecoveringGameConnection?: boolean;
  get_isRecoveringGameConnection?: () => boolean;
  initialWorldIsRevealed?: boolean;
  get_initialWorldIsRevealed?: () => boolean;
}

/** A running game loop alone is not proof that the initial world is visible. */
export function serviceGameIsReady(game: ServiceGameState | null, requireWorld = true): boolean {
  if (!game || (game.get_isLeaving?.() ?? game.isLeaving ?? false)) return false;
  if (!(game.get_connected?.() ?? game.connected ?? false)) return false;
  const serviceConnected =
    game.get_serviceConnected?.() ??
    game.serviceConnected ??
    game.serviceConnection?.get_connected?.() ??
    game.serviceConnection?.connected ??
    false;
  if (!serviceConnected) return false;
  if (game.get_isRecoveringGameConnection?.() ?? game.isRecoveringGameConnection ?? false)
    return false;
  if (!requireWorld) return true;
  const revealed = game.get_initialWorldIsRevealed?.() ?? game.initialWorldIsRevealed;
  if (revealed !== undefined) return revealed;
  // Haxe starts its loop after six data packets, then reveals the canvas only
  // after the separate initSyncEnemies response. Preserve both requirements.
  return (
    game.initSolarSystemComplete === true &&
    game.initPlayerComplete === true &&
    game.initEnemyPlayersComplete === true &&
    game.initEnemiesComplete === true &&
    game.initDropsComplete === true &&
    game.initServerComplete === true &&
    game.synchedEnemies === true
  );
}
