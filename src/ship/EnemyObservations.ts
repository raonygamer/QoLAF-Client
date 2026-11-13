import type { Game } from '../game/Game';
import { PackedRecordBounds } from '../network/PackedRecordBounds';
import type { API } from '../api/Types';
import { GameReflection } from '../api/GameReflection';
import { EnemyShip, ShipManager, ShipSync, AIResurect } from '../game/Bindings';

/** Metadata installed by the observation hooks, absent while the plugin is disabled. */
export interface ObservedEnemy extends EnemyShip {
  readonly hasFreshResourceSnapshot?: boolean;
  readonly reconstructionStartedAt?: number;
  readonly isReconstructing?: boolean;
  isServerTargeting?(id: number): boolean;
}

interface EnemyObservation {
  resourceSnapshotAt: number;
  targetId: number | null;
  reconstructionStartedAt: number;
  reconstructing: boolean;
}

/** Presentation metadata only. Never changes HP, shields, AI, targets or regeneration. */
export class EnemyObservations {
  private readonly states = new WeakMap<EnemyShip, EnemyObservation>();
  constructor(private readonly now: () => number = () => performance.now()) {}

  private state(enemy: EnemyShip): EnemyObservation {
    let state = this.states.get(enemy);
    if (!state) {
      state = {
        resourceSnapshotAt: NaN,
        targetId: null,
        reconstructionStartedAt: -1,
        // Hot enable may attach after enter() already ran. Native get_type()
        // mislabels this state as AITeleport, so use the class identity overload.
        // The start time is unknown: do not invent a new ten-second countdown.
        reconstructing: enemy.stateMachine?.inState(AIResurect) ?? false,
      };
      this.states.set(enemy, state);
    }
    return state;
  }
  reset(enemy: EnemyShip): void {
    this.states.delete(enemy);
  }
  recordResources(enemy: EnemyShip | null | undefined): void {
    if (enemy) this.state(enemy).resourceSnapshotAt = this.now();
  }
  recordTarget(enemy: EnemyShip | null | undefined, id: number): void {
    if (enemy) this.state(enemy).targetId = id;
  }
  hasFreshResources(enemy: EnemyShip): boolean {
    const age = this.now() - this.state(enemy).resourceSnapshotAt;
    return Number.isFinite(age) && age >= 0 && age <= 2000;
  }
  isServerTargeting(enemy: EnemyShip, id: number): boolean {
    return this.state(enemy).targetId === id;
  }
  isReconstructing(enemy: EnemyShip): boolean {
    return this.state(enemy).reconstructing;
  }
  reconstructionStartedAt(enemy: EnemyShip): number {
    return this.state(enemy).reconstructionStartedAt;
  }
  startReconstruction(enemy: EnemyShip): void {
    const state = this.state(enemy);
    state.reconstructionStartedAt = this.now();
    state.reconstructing = true;
  }
  endReconstruction(enemy: EnemyShip): void {
    this.state(enemy).reconstructing = false;
    this.recordResources(enemy);
  }
}

function findEnemy(manager: ShipManager, id: number): EnemyShip | undefined {
  return manager.enemiesById.h[id];
}

/** Observe the current protocol after its native handlers have applied packets. */
export function installEnemyObservations(api: API): EnemyObservations {
  const observations = new EnemyObservations();
  const reflection = new GameReflection(api);
  const records = new PackedRecordBounds(api);
  const enemy = EnemyShip.prototype;
  const manager = ShipManager.prototype;
  const sync = ShipSync.prototype;
  const reconstruct = AIResurect.prototype;
  if (enemy) {
    const descriptors: Record<string, PropertyDescriptor> = {
      hasFreshResourceSnapshot: {
        get(this: EnemyShip) {
          return observations.hasFreshResources(this);
        },
      },
      reconstructionStartedAt: {
        get(this: EnemyShip) {
          return observations.reconstructionStartedAt(this);
        },
      },
      isReconstructing: {
        get(this: EnemyShip) {
          return observations.isReconstructing(this);
        },
      },
      isServerTargeting: {
        value(this: EnemyShip, id: number) {
          return observations.isServerTargeting(this, id);
        },
      },
    };
    for (const [key, descriptor] of Object.entries(descriptors)) {
      const previous = Object.getOwnPropertyDescriptor(enemy, key);
      Object.defineProperty(enemy, key, { ...descriptor, configurable: true });
      api.defer(() => {
        if (previous) Object.defineProperty(enemy, key, previous);
        else Reflect.deleteProperty(enemy, key);
      });
    }
    reflection.after(enemy, 'reset', function () {
      observations.reset(this);
    });
  }
  if (manager) {
    reflection.around(
      manager,
      'enemyFire',
      function (_next, message: Game.playerio.Message, start = 0) {
        const end = records.end(message, start);
        if (end < start + 3) return;
        const id = message.getInt(start);
        const slot = message.getInt(start + 1);
        const firing = message.getBoolean(start + 2);
        const ship = this.getShipFromId(id);
        if (!ship) return;
        const hasTarget = end > start + 3;
        const targetId = hasTarget ? message.getInt(start + 3) : -1;
        // A stopped weapon clears its own target, not the ship's sampled aggro.
        // Only a real target field from this record can update that observation.
        const observedEnemy = findEnemy(this, id);
        if (firing && hasTarget && observedEnemy === ship)
          observations.recordTarget(observedEnemy, targetId);
        const weapon = ship.weapons[slot];
        if (!weapon) return;
        weapon.set_fire(firing);
        weapon.target = hasTarget ? this.g.unitManager.getTarget(targetId) : null;
      },
    );
    reflection.after(
      manager,
      'damaged',
      function (_result: unknown, message: Game.playerio.Message, start: number) {
        observations.recordResources(findEnemy(this, message.getInt(start + 1)));
      },
    );
    reflection.after(
      manager,
      'onEnemyUpdate',
      function (_result: unknown, message: Game.playerio.Message) {
        const ship = findEnemy(this.g.shipManager, message.getInt(0));
        observations.recordResources(ship);
        observations.recordTarget(ship, message.getInt(3));
      },
    );
    reflection.after(
      manager,
      'readEnemyEntry',
      function (_result: unknown, message: Game.playerio.Message, start: number) {
        const ship = findEnemy(this.g.shipManager, message.getInt(start));
        if (!ship) return;
        const flags = message.getInt(start + 1);
        if (flags & 6) observations.recordResources(ship);
        // Heading contains ten fields; resource and target fields are optional.
        let cursor = start + 2 + (flags & 1 ? 10 : 0);
        if (flags & 2) cursor++;
        if (flags & 4) cursor++;
        if (flags & 8) {
          const encoded = message.getInt(cursor);
          observations.recordTarget(ship, encoded > 0 ? encoded - 1 : -1);
        }
      },
    );
    reflection.after(
      manager,
      'syncEnemyTarget',
      function (_result: unknown, message: Game.playerio.Message, start: number) {
        for (let cursor = start; cursor + 3 < message.length; ) {
          observations.recordTarget(
            findEnemy(this.g.shipManager, message.getInt(cursor)),
            message.getInt(cursor + 2),
          );
          const weapons = message.getInt(cursor + 3);
          if (weapons < 0) break;
          cursor += 4 + weapons;
        }
      },
    );
  }
  if (sync) {
    reflection.after(sync, 'aiCourse', function (_result: unknown, message: Game.playerio.Message) {
      for (let cursor = 0; cursor + 13 < message.length; ) {
        const ship = findEnemy(this.g.shipManager, message.getInt(cursor));
        // Native aiCourse aborts when a referenced hull is absent.
        if (!ship) break;
        observations.recordTarget(ship, message.getInt(cursor + 11));
        const kind = message.kindAt(cursor + 13);
        const optionalSlowdown = kind === 4 || kind === 5 ? 2 : 0;
        const weapons = message.getInt(cursor + 13 + optionalSlowdown);
        if (weapons < 0) break;
        cursor += 14 + optionalSlowdown + 3 * weapons;
      }
    });
    reflection.after(
      sync,
      'aiStateChanged',
      function (_result: unknown, message: Game.playerio.Message, start = 0) {
        const ship = findEnemy(this.g.shipManager, message.getInt(start));
        const type = message.getString(start + 1);
        if (
          ship &&
          ship.alive &&
          ['AIObserve', 'AIChase', 'AIFollow', 'AIResurect', 'AIMelee', 'AIKamikaze'].includes(type)
        )
          observations.recordTarget(
            ship,
            type === 'AIFollow' || type === 'AIResurect'
              ? message.getNumber(start + 13) | 0
              : message.getInt(start + 13),
          );
      },
    );
  }
  if (reconstruct) {
    // Observe the lifecycle directly; this also works before the reconstruction
    // adapter corrects the native AITeleport label.
    reflection.after(reconstruct, 'enter', function () {
      observations.startReconstruction(this.s);
    });
    reflection.after(reconstruct, 'exit', function () {
      observations.endReconstruction(this.s);
    });
  }
  return observations;
}
