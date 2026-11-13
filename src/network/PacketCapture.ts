/** Message boundary shared by the Flash decoder and the current PlayerIO wrapper. */
export interface DebugMessage {
  type: string;
  length: number;
  getObject(index: number): unknown;
  getString(index: number): string;
  getInt(index: number): number;
  getBoolean(index: number): boolean;
  getNumber(index: number): number;
}

export interface PacketEntry {
  direction: 'RX' | 'TX' | 'SYNC';
  type: string;
  line: string;
}

const commandNames = [
  'accelerate',
  'left',
  'right',
  'fire',
  'boost',
  'shield',
  'convert',
  'damageBoost',
  'deaccelerate',
];

/** PacketDebugWindow's bounded log and decoder; filtering never changes capture. */
export class PacketCapture {
  active = false;
  paused = false;
  showRX = true;
  showTX = true;
  filter = 'command,msgPack:a';
  dirty = true;
  readonly entries: PacketEntry[] = [];
  private seenRX = new WeakSet<object>();
  private sequence = 0;

  constructor(
    private now: () => number,
    private isBytes: (value: unknown) => boolean = (value) => value instanceof Uint8Array,
  ) {}

  show(): void {
    this.active = true;
    this.seenRX = new WeakSet();
    this.dirty = true;
  }

  clear(): void {
    this.entries.length = 0;
    this.seenRX = new WeakSet();
    this.dirty = true;
  }

  receive(message: DebugMessage, identity: object = message): void {
    if (!this.active || this.paused || this.seenRX.has(identity)) return;
    this.seenRX.add(identity);
    this.record('RX', message);
  }

  transmit(message: DebugMessage): void {
    if (this.active && !this.paused) this.record('TX', message);
  }

  add(direction: PacketEntry['direction'], type: string, payload: string): void {
    this.sequence = (this.sequence + 1) >>> 0;
    this.entries.push({
      direction,
      type,
      line: `${String(this.sequence).padStart(6, '0')} ${(this.now() / 1000).toFixed(3)} ${direction} ${type}${payload.length ? '  ' + payload : ''}`,
    });
    if (this.entries.length > 600) this.entries.splice(0, this.entries.length - 600);
    this.dirty = true;
  }

  format(): string {
    return this.entries
      .filter(
        (entry) =>
          !(entry.direction === 'RX' && !this.showRX) &&
          !(entry.direction === 'TX' && !this.showTX),
      )
      .filter((entry) => this.matchesFilter(entry))
      .map((entry) => entry.line)
      .join('\n');
  }

  private matchesFilter(entry: PacketEntry): boolean {
    const haystack = `${entry.type} ${entry.line}`.toLowerCase();
    let hasInclusion = false;
    let included = false;
    for (const token of this.filter.toLowerCase().split(/[,\s]+/)) {
      if (!token) continue;
      if (token.startsWith('!')) {
        if (token.length > 1 && haystack.includes(token.slice(1))) return false;
      } else {
        hasInclusion = true;
        if (haystack.includes(token)) included = true;
      }
    }
    return !hasInclusion || included;
  }

  private record(direction: 'RX' | 'TX', message: DebugMessage): void {
    if (message.type === 'msgPack') {
      this.recordPack(direction, message);
      return;
    }
    this.add(
      direction,
      message.type,
      message.type === 'command'
        ? this.formatCommand(direction, message)
        : this.formatPayload(message, 0, message.length),
    );
  }

  private recordPack(direction: 'RX' | 'TX', message: DebugMessage): void {
    let offset = 0;
    while (offset + 1 < message.length) {
      let type: string;
      let size: number;
      try {
        type = message.getString(offset);
        size = message.getInt(offset + 1);
      } catch (error) {
        this.add(direction, 'msgPack:invalid', `offset=${offset} ${errorMessage(error)}`);
        return;
      }
      if (size < 2 || offset + size > message.length || !Number.isInteger(size)) {
        this.add(
          direction,
          'msgPack:invalid',
          `offset=${offset} size=${size} length=${message.length}`,
        );
        return;
      }
      this.add(
        direction,
        `msgPack:${type}`,
        type === 'a'
          ? this.formatCourse(message, offset + 2, size - 2)
          : this.formatPayload(message, offset + 2, size - 2),
      );
      offset += size;
    }
  }

  private formatCommand(direction: 'RX' | 'TX', message: DebugMessage): string {
    try {
      if (direction === 'RX' && message.length >= 4) {
        return `player=${this.formatValue(message.getObject(0))} cmd=${commandName(message.getInt(1))} active=${message.getBoolean(2)} stamp=${formatNumber(message.getNumber(3))}`;
      }
      if (message.length >= 3) {
        const commands: string[] = [];
        let offset = 0;
        for (; offset + 2 < message.length; offset += 3) {
          commands.push(
            `cmd=${commandName(message.getInt(offset))} active=${message.getBoolean(offset + 1)} stamp=${formatNumber(message.getNumber(offset + 2))}`,
          );
        }
        if (offset < message.length)
          commands.push('trailing=' + this.formatPayload(message, offset, message.length - offset));
        return commands.join(' | ');
      }
    } catch (error) {
      return `decode-error=${errorMessage(error)} ${this.formatPayload(message, 0, message.length)}`;
    }
    return this.formatPayload(message, 0, message.length);
  }

  private formatCourse(message: DebugMessage, offset: number, count: number): string {
    if (count < 11) return this.formatPayload(message, offset, count);
    try {
      return (
        `player=${this.formatValue(message.getObject(offset))}` +
        ` stamp=${formatNumber(message.getNumber(offset + 1))}` +
        ` pos=(${(0.01 * message.getInt(offset + 2)).toFixed(2)},${(0.01 * message.getInt(offset + 3)).toFixed(2)})` +
        ` vel=(${(0.01 * message.getInt(offset + 4)).toFixed(2)},${(0.01 * message.getInt(offset + 5)).toFixed(2)})` +
        ` rot=${(0.001 * message.getInt(offset + 6)).toFixed(3)}` +
        ` accel=${message.getBoolean(offset + 7)} brake=${message.getBoolean(offset + 8)}` +
        ` left=${message.getBoolean(offset + 9)} right=${message.getBoolean(offset + 10)}`
      );
    } catch (error) {
      return `decode-error=${errorMessage(error)} ${this.formatPayload(message, offset, count)}`;
    }
  }

  private formatPayload(message: DebugMessage, offset: number, count: number): string {
    const fields: string[] = [];
    const end = Math.min(message.length, offset + count);
    const shownEnd = Math.min(end, offset + 24);
    for (let index = offset; index < shownEnd; index++) {
      try {
        fields.push(`${index - offset}=${this.formatValue(message.getObject(index))}`);
      } catch (error) {
        fields.push(`${index - offset}=<${errorMessage(error)}>`);
      }
    }
    if (shownEnd < end) fields.push(`...+${end - shownEnd}`);
    return fields.join(' ');
  }

  private formatValue(value: unknown): string {
    if (this.isBytes(value)) return `<bytes:${(value as { length: number }).length}>`;
    if (typeof value === 'string') {
      let escaped = value.replace(/\r/g, '\\r').replace(/\n/g, '\\n');
      if (escaped.length > 90) escaped = escaped.slice(0, 87) + '...';
      return `"${escaped}"`;
    }
    return String(value);
  }
}

function commandName(type: number): string {
  return `${commandNames[type] ?? 'unknown'}(${type})`;
}
function formatNumber(value: number): string {
  return Number.isFinite(value) ? value.toFixed(3) : String(value);
}
function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
