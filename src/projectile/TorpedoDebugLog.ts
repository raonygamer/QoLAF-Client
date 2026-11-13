export interface TorpedoLogFields {
  readonly [key: string]: TorpedoLogValue | undefined;
}

/** Detached values accepted at the diagnostic serialization boundary. */
export type TorpedoLogValue =
  | null
  | string
  | number
  | boolean
  | readonly TorpedoLogValue[]
  | TorpedoLogFields;
export interface TorpedoLogExport {
  fileName: string;
  content: string;
}

/** Original bounded JSONL ring. No live game references survive record(). */
export class TorpedoDebugLog {
  private static readonly maxEvents = 15000;
  private static readonly maxBytes = 8 * 1024 * 1024;
  private static readonly maxRecordBytes = 64 * 1024;
  private static nextSaveId = 0;
  lastError = '';
  private lines: (string | null)[] = [];
  private sizes: number[] = [];
  private first = 0;
  private count = 0;
  private bytes = 0;
  private header: string | null = null;
  private headerBytes = 0;
  private eventsSeen = 0;
  private droppedEvents = 0;
  private rejectedEvents = 0;
  private recording = false;
  private disposed = false;

  start(metadata: TorpedoLogValue): void {
    this.lastError = '';
    if (this.disposed) {
      this.lastError = 'The torpedo recorder has been disposed.';
      return;
    }
    this.lines = [];
    this.sizes = [];
    this.first = this.count = this.bytes = this.headerBytes = 0;
    this.eventsSeen = this.droppedEvents = this.rejectedEvents = 0;
    this.recording = false;
    this.header = this.serialize({
      type: 'header',
      format: 'qolaf-torpedo-debug',
      schemaVersion: 1,
      startedAt: Date.now(),
      metadata,
    });
    if (this.header === null) return;
    this.headerBytes = TorpedoDebugLog.utf8Length(this.header);
    this.recording = true;
  }

  record(event: TorpedoLogValue): void {
    if (!this.recording || this.disposed) return;
    this.eventsSeen++;
    const line = this.serialize(event);
    if (line === null) {
      this.droppedEvents++;
      this.rejectedEvents++;
      return;
    }
    const size = TorpedoDebugLog.utf8Length(line);
    while (
      this.count > 0 &&
      (this.count >= TorpedoDebugLog.maxEvents ||
        this.bytes + size + this.headerBytes > TorpedoDebugLog.maxBytes)
    ) {
      this.bytes -= this.sizes[this.first];
      this.lines[this.first] = null;
      this.sizes[this.first] = 0;
      this.first = (this.first + 1) % TorpedoDebugLog.maxEvents;
      this.count--;
      this.droppedEvents++;
    }
    const index = (this.first + this.count) % TorpedoDebugLog.maxEvents;
    this.lines[index] = line;
    this.sizes[index] = size;
    this.bytes += size;
    this.count++;
  }

  /** Repeated exports leave the ring intact; the browser adapter owns delivery. */
  snapshot(): TorpedoLogExport | null {
    this.lastError = '';
    if (!this.recording || this.disposed || this.header === null) {
      this.lastError = 'No active torpedo recording is available to save.';
      return null;
    }
    const snapshot = [this.header];
    for (let index = 0; index < this.count; index++) {
      const line = this.lines[(this.first + index) % TorpedoDebugLog.maxEvents];
      if (line !== null) snapshot.push(line);
    }
    snapshot.push(
      JSON.stringify({
        type: 'summary',
        eventsSeen: this.eventsSeen,
        retainedEvents: this.count,
        droppedEvents: this.droppedEvents,
        rejectedEvents: this.rejectedEvents,
        retainedBytes: this.bytes,
        maxEvents: TorpedoDebugLog.maxEvents,
        maxBytes: TorpedoDebugLog.maxBytes,
        maxRecordBytes: TorpedoDebugLog.maxRecordBytes,
      }) + '\n',
    );
    return {
      fileName: `torpedoes-${Date.now()}-${++TorpedoDebugLog.nextSaveId}-${Math.floor(Math.random() * 0x7fffffff).toString(16)}.jsonl`,
      content: snapshot.join(''),
    };
  }

  dispose(): void {
    this.recording = false;
    this.disposed = true;
    this.lines = [];
    this.sizes = [];
    this.header = null;
    this.first = this.count = this.bytes = this.headerBytes = 0;
  }

  private serialize(value: TorpedoLogValue): string | null {
    try {
      if (value === null) {
        this.lastError = 'A torpedo log record was missing.';
        return null;
      }
      const line = JSON.stringify(value);
      if (
        line == null ||
        line.length + 1 > TorpedoDebugLog.maxRecordBytes ||
        TorpedoDebugLog.utf8Length(line) + 1 > TorpedoDebugLog.maxRecordBytes
      ) {
        this.lastError = 'A torpedo log record exceeded the 64 KiB limit.';
        return null;
      }
      return line + '\n';
    } catch (error) {
      let description = 'Unknown local recording error.';
      try {
        description = String(error).slice(0, 400);
      } catch {
        /* Keep the fallback. */
      }
      this.lastError = 'Unable to serialize torpedo log record: ' + description;
      return null;
    }
  }

  private static utf8Length(value: string): number {
    let size = 0;
    for (let index = 0; index < value.length; index++) {
      const code = value.charCodeAt(index);
      if (code <= 0x7f) size++;
      else if (code <= 0x7ff) size += 2;
      else if (
        code >= 0xd800 &&
        code <= 0xdbff &&
        index + 1 < value.length &&
        value.charCodeAt(index + 1) >= 0xdc00 &&
        value.charCodeAt(index + 1) <= 0xdfff
      ) {
        size += 4;
        index++;
      } else size += 3;
    }
    return size;
  }
}
