import type { DebugMessage } from './PacketCapture';

export interface CommandHeading {
  time: number;
  accelerate: boolean;
  rotateLeft: boolean;
  rotateRight: boolean;
  deaccelerate: boolean;
}

interface PendingCommand {
  type: number;
  active: boolean;
  stamp: number;
  sentAt: number;
  completed: boolean;
}

const movementCommands = [0, 1, 2, 8] as const;
const commandProperties = {
  0: 'accelerate',
  1: 'rotateLeft',
  2: 'rotateRight',
  8: 'deaccelerate',
} as const;
const commandLabels = { 0: 'accel', 1: 'left', 2: 'right', 8: 'decel' } as const;

/** Original heading diagnostic: acknowledgement requires both timestamp and input state. */
export class CommandAcknowledgements {
  private pending = new Map<number, PendingCommand>();
  private order: PendingCommand[] = [];
  lastLatency = NaN;
  lastAt = 0;
  lastLabel = 'none';
  timeoutCount = 0;
  supersededCount = 0;

  constructor(private now: () => number) {}

  get count(): number {
    return this.pending.size;
  }

  format(): string {
    const now = this.now();
    this.cleanup(now);
    let result =
      'course state echo  ' +
      (Number.isNaN(this.lastLatency)
        ? 'none'
        : `${this.lastLabel} ${this.lastLatency.toFixed(0)} ms (${Math.max(0, now - this.lastAt)} ms ago)`);
    result += `  pending ${this.count}`;
    const oldest = this.order.find((command) => !command.completed);
    if (oldest) result += ` oldest ${Math.max(0, now - oldest.sentAt)} ms`;
    if (this.timeoutCount > 0) result += ` expired ${this.timeoutCount}`;
    if (this.supersededCount > 0) result += ` superseded ${this.supersededCount}`;
    return result;
  }

  reset(): void {
    this.pending.clear();
    this.order.length = 0;
    this.lastLatency = NaN;
    this.lastAt = 0;
    this.lastLabel = 'none';
    this.timeoutCount = 0;
    this.supersededCount = 0;
  }

  sent(message: DebugMessage): void {
    if (message.type !== 'command' || message.length < 3) return;
    for (let offset = 0; offset + 2 < message.length; offset += 3) {
      try {
        this.add(
          message.getInt(offset),
          message.getBoolean(offset + 1),
          message.getNumber(offset + 2),
        );
      } catch {
        return;
      }
    }
  }

  private add(type: number, active: boolean, stamp: number): void {
    if (!movementCommands.some((command) => command === type)) return;
    const previous = this.pending.get(type);
    if (previous && !previous.completed) {
      previous.completed = true;
      this.supersededCount++;
    }
    const command = { type, active, stamp, sentAt: this.now(), completed: false };
    this.pending.set(type, command);
    this.order.push(command);
    this.cleanup();
  }

  authoritative(heading: CommandHeading): void {
    const now = this.now();
    this.cleanup(now);
    for (const type of movementCommands) {
      const command = this.pending.get(type);
      if (
        !command ||
        command.completed ||
        heading.time < command.stamp ||
        heading[commandProperties[type]] !== command.active
      )
        continue;
      command.completed = true;
      this.pending.delete(type);
      this.lastAt = now;
      this.lastLatency = Math.max(0, now - command.sentAt);
      this.lastLabel = `${commandLabels[type]} ${command.active ? 'ON' : 'OFF'}`;
    }
  }

  cleanup(now = this.now()): void {
    while (this.order.length) {
      const command = this.order[0];
      if (command.completed) {
        this.order.shift();
        continue;
      }
      if (now - command.sentAt <= 15000) break;
      this.order.shift();
      if (this.pending.get(command.type) === command) this.pending.delete(command.type);
      command.completed = true;
      this.timeoutCount++;
    }
  }
}
