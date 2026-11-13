export interface MovementCommand {
  type: number;
  active: boolean;
  time: number;
}

export interface ReplayHeading {
  time: number;
  accelerate: boolean;
  deaccelerate: boolean;
  rotateLeft: boolean;
  rotateRight: boolean;
  runCommand(command: MovementCommand): void;
}

const axes = ['accelerate', 'rotateLeft', 'rotateRight', 'deaccelerate'] as const;
const axisByCommand: Partial<Record<number, (typeof axes)[number]>> = {
  0: 'accelerate',
  1: 'rotateLeft',
  2: 'rotateRight',
  8: 'deaccelerate',
};

/** CommandManager's retained input states and chronological 33ms replay buckets. */
export class MovementReplay {
  lastCommandTime = NaN;
  private ship: object | null = null;
  private converger: object | null = null;
  private retained: Partial<Record<(typeof axes)[number], boolean>> = {};

  constructor(readonly commands: MovementCommand[]) {}

  prepareOwner(ship: object | null, converger: object | null): void {
    if (ship !== this.ship || converger !== this.converger) this.reset(ship, converger);
  }

  reset(ship: object | null = null, converger: object | null = null): void {
    this.commands.length = 0;
    this.retained = {};
    this.lastCommandTime = NaN;
    this.ship = ship;
    this.converger = converger;
  }

  forceState(ship: object, converger: object | null, heading: ReplayHeading | null): void {
    this.reset(ship, converger);
    if (heading) for (const axis of axes) this.retained[axis] = heading[axis];
  }

  store(command: MovementCommand): void {
    let index = this.commands.length;
    while (index > 0 && this.commands[index - 1].time > command.time) index--;
    this.commands.splice(index, 0, command);
  }

  prepareHeading(ship: object, converger: object | null, heading: ReplayHeading): void {
    this.prepareOwner(ship, converger);
    let count = 0;
    while (count < this.commands.length && this.commands[count].time <= heading.time) {
      this.fold(this.commands[count]);
      count++;
    }
    if (count) this.commands.splice(0, count);
    for (const axis of axes)
      if (this.retained[axis] !== undefined) heading[axis] = this.retained[axis]!;
  }

  /** A command stamped at the next boundary belongs to the next integration interval. */
  run(heading: ReplayHeading, time: number): void {
    const end = time + 33;
    for (const command of this.commands) {
      if (command.time >= end) break;
      if (command.time >= time) heading.runCommand(command);
    }
  }

  clearBefore(time: number): void {
    let count = 0;
    while (count < this.commands.length && this.commands[count].time < time) count++;
    if (count) this.commands.splice(0, count);
  }

  private fold(command: MovementCommand): void {
    const axis = axisByCommand[command.type];
    if (axis) this.retained[axis] = command.active;
    else if (command.type === 4) {
      // Native Heading.runCommand(BOOST) uses these same four persistent flags.
      this.retained = {
        accelerate: true,
        deaccelerate: false,
        rotateLeft: false,
        rotateRight: false,
      };
    }
  }
}

export function isMovementCommand(type: number): boolean {
  return type === 0 || type === 1 || type === 2 || type === 4 || type === 8;
}

export function redundantMovement(heading: ReplayHeading, type: number, active: boolean): boolean {
  const axis = axisByCommand[type];
  return axis ? heading[axis] === active : false;
}
