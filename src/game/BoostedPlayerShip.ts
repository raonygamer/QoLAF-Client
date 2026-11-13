import type { PlayerShip } from './Bindings';

/** Optional until the room-scoped boost-history hooks have been installed. */
export interface BoostedPlayerShip extends PlayerShip {
  boost(timestamp?: number, confirmed?: boolean): void;
  syncBoost?(timestamp: number): void;
  isBoostActiveAt?(timestamp: number): boolean;
}
