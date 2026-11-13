import type { Game } from './Game';
import type { GameScene, Heading, Ship } from './Bindings';
import type { ReconciliationObserver } from '../movement/SelfCourseQueue';

/** Source-client methods installed on the native room objects. */
export interface ReplayCommands
  extends Omit<Game.movement.CommandManager, 'addCommand' | 'runCommand'> {
  addCommand(type: number, active: boolean, force?: boolean): boolean | void;
  runCommand(heading: Heading, time: number, cursor?: number): number | void;
  prepareHeadingReplay?(ship: Ship, heading: Heading): void;
  resetMovementReplay?(ship?: Ship | null): void;
  forceMovementReplayState?(ship: Ship | null): void;
}

export interface SelfShipSync extends Omit<Game.core.ship.ShipSync, 'fastforwardMe'> {
  fastforwardMe(ship: Ship, heading: Heading): boolean | void;
  flushPendingSelfCourse?(): void;
  resetSelfCourse?(ship?: Ship | null, timestamp?: number): void;
}

export interface SelfMovementGame extends GameScene {
  recordHeadingDebug?: ReconciliationObserver;
}
