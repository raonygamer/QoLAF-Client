import { read, type Raw } from '../api/Types';

/** SceneBase.networkServerTime: observe the clock without writing game.time. */
export function networkTime(game: Raw | null | undefined): number {
  return read(game, 'networkServerTime') ?? game?.clock?.getServerTime?.() ?? NaN;
}
