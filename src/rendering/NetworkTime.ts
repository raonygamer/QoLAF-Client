import type { Clock } from '../game/Bindings';

/** Native clock plus the original client's optional read-only observer API. */
export interface NetworkTimeSource {
  readonly clock?: Pick<Clock, 'getServerTime'> | null;
  readonly networkServerTime?: number | null;
  get_networkServerTime?(): number | null | undefined;
}

/** Observe server time without invoking SceneBase.getServerTime, which writes game.time. */
export function networkTime(game: NetworkTimeSource | null | undefined): number {
  if (!game) return NaN;
  const observed = game.get_networkServerTime
    ? game.get_networkServerTime()
    : game.networkServerTime;
  return observed ?? game.clock?.getServerTime() ?? NaN;
}
