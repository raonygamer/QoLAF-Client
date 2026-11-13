import type { API } from '../api/Types';
import { GameReflection } from '../api/GameReflection';
import { PlayerShip, Ship, Converger, type GameScene } from '../game/Bindings';
import type { BoostedPlayerShip } from '../game/BoostedPlayerShip';
import { BoostHistory, boostReadyAt } from './BoostHistory';

/** Preserve current native physics while selecting boost speed from the replayed heading time. */
export function installNativeBoostHistory(api: API, game: GameScene): void {
  const playerShip: BoostedPlayerShip = PlayerShip.prototype;
  const shipClass = Ship.prototype;
  const converger = Converger.prototype;
  const reflection = new GameReflection(api);
  const histories = new WeakMap<PlayerShip, BoostHistory>();
  const replayTime = new WeakMap<Ship, number>();
  const history = (ship: PlayerShip): BoostHistory => {
    let value = histories.get(ship);
    if (!value) {
      value = new BoostHistory();
      histories.set(ship, value);
      // A plugin may attach in the middle of an existing native boost.
      if (ship._usingBoost && Number.isFinite(ship.boostEndTime))
        value.add(ship.boostEndTime - ship.boostDuration, ship.boostDuration, game.time);
    }
    return value;
  };
  const stop = (ship: PlayerShip, ended = true): void => {
    for (const emitter of ship.speedBoostEffect ?? []) emitter.killEmitter();
    if (ship.speedBoostEffect) ship.speedBoostEffect.length = 0;
    ship._usingBoost = false;
    if (ended) ship.boostEndedLastTick = true;
  };
  const updateState = (ship: PlayerShip, previous: boolean) => {
    if (history(ship).activeAt(game.time)) {
      ship._usingBoost = true;
      if (!previous) ship.boostEffect();
    } else if (previous) stop(ship);
  };
  const cooldown = (ship: PlayerShip, stamp: number) => {
    ship.boostNextRdy = boostReadyAt(stamp, ship.boostCD, ship.artifact_cooldownReduction);
  };
  reflection.around(playerShip, 'boost', function (next, stamp = NaN, confirmed = false) {
    if (this.g !== game) return next(stamp, confirmed);
    if (Number.isNaN(stamp)) stamp = this.get_course()?.time ?? game.time;
    const previous = this._usingBoost;
    history(this).add(stamp, this.boostDuration, game.time, confirmed);
    cooldown(this, stamp);
    // Native updateHeading still checks this field; source-style expiry is handled first below.
    this.boostEndTime = stamp + this.boostDuration;
    updateState(this, previous);
  });
  const previousSync = Object.getOwnPropertyDescriptor(playerShip, 'syncBoost');
  const previousActive = Object.getOwnPropertyDescriptor(playerShip, 'isBoostActiveAt');
  const previousSyncMethod = playerShip.syncBoost;
  const previousActiveMethod = playerShip.isBoostActiveAt;
  const syncBoost = function (this: PlayerShip, stamp: number): void {
    if (this.g !== game) return previousSyncMethod?.call(this, stamp);
    const previous = this._usingBoost;
    if (!history(this).confirm(stamp, this.boostDuration, game.time)) return;
    cooldown(this, stamp);
    this.boostEndTime = stamp + this.boostDuration;
    updateState(this, previous);
  };
  const isBoostActiveAt = function (this: PlayerShip, stamp: number): boolean {
    if (this.g !== game) return previousActiveMethod?.call(this, stamp) ?? this.get_usingBoost();
    return history(this).activeAt(stamp);
  };
  playerShip.syncBoost = syncBoost;
  playerShip.isBoostActiveAt = isBoostActiveAt;
  reflection.around(playerShip, 'updateHeading', function (next, ...args) {
    if (this.g !== game || !this.alive || !this.get_course()) return next(...args);
    if (this._usingBoost && !history(this).activeAt(game.time)) stop(this);
    // The source's history determines expiry, including overlapping windows.
    // Suppress only the native single-end-time check for this synchronous call.
    const end = this.boostEndTime;
    if (this._usingBoost) this.boostEndTime = Infinity;
    try {
      return next(...args);
    } finally {
      if (this.boostEndTime === Infinity) this.boostEndTime = end;
    }
  });
  reflection.around(converger, 'updateHeading', function (next, heading) {
    const ship = this.ship;
    if (this.g !== game || !(ship instanceof PlayerShip) || !ship.player) return next(heading);
    const previous = replayTime.get(ship);
    replayTime.set(ship, heading.time);
    try {
      return next(heading);
    } finally {
      if (previous === undefined) replayTime.delete(ship);
      else replayTime.set(ship, previous);
    }
  });
  reflection.around(shipClass, 'get_usingBoost', function (next, ...args) {
    const stamp = replayTime.get(this);
    return stamp === undefined || !(this instanceof PlayerShip)
      ? next(...args)
      : history(this).activeAt(stamp);
  });
  reflection.before(playerShip, 'reset', function () {
    if (this.g === game) {
      histories.delete(this);
      replayTime.delete(this);
      // Native reset replaces the array without stopping the previous emitters.
      // Source PlayerShip.reset calls stopSpeedBoost(false) before releasing it.
      stop(this, false);
      this.boostEndedLastTick = false;
    }
  });
  api.defer(() => {
    if (playerShip.syncBoost === syncBoost) {
      if (previousSync) Object.defineProperty(playerShip, 'syncBoost', previousSync);
      else delete playerShip.syncBoost;
    }
    if (playerShip.isBoostActiveAt === isBoostActiveAt) {
      if (previousActive) Object.defineProperty(playerShip, 'isBoostActiveAt', previousActive);
      else delete playerShip.isBoostActiveAt;
    }
  });
}
