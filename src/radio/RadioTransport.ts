import type { PreparedRadioAudio } from './RadioAudio';
import type { RadioMediaReply, RadioMediaTransport } from './RadioService';
import { RadioStreamURL } from './RadioStreamURL';

export interface RadioHelperChannel {
  write(line: string): void;
  /** Close gracefully, then terminate the owned helper if necessary. */
  close(): void;
}
export interface RadioTransportPlatform {
  now(): number;
  readonly toolsDirectory: string;
  open(
    output: (bytes: Uint8Array) => void,
    exited: (code: number) => void,
    failed: () => void,
  ): RadioHelperChannel;
  validatePreparedFile(path: string | undefined): PreparedRadioAudio;
}
interface HelperReply extends RadioMediaReply {
  status: string;
  id?: number;
  available?: boolean;
  detail?: string;
  totalBytes?: number;
  doneBytes?: number;
}

/** Original bounded helper protocol; platform owns process/loopback access and file validation. */
export class RadioTransport implements RadioMediaTransport {
  private channel: RadioHelperChannel | null = null;
  private output = new Uint8Array(0);
  private probing = false;
  private usable = false;
  private readyForSetup = false;
  private closed = false;
  private deadline = 0;
  private lastReply = 0;
  private lastPing = 0;
  private nextRequest = 0;
  private requestId = 0;
  private cancelId = 0;
  private completed: ((reply: RadioMediaReply) => void) | null = null;
  private failed: ((reason: string) => void) | null = null;
  private updated: ((reply: RadioMediaReply) => void) | null = null;
  private started: (() => void) | null = null;
  private startFailed: ((reason: string) => void) | null = null;
  private operation = '';
  private streamVideo = '';
  private validationError = '';
  private generation = 0;
  status = 'Radio is off';
  onStatus: (() => void) | null = null;
  constructor(private platform: RadioTransportPlatform) {}
  get available(): boolean {
    return this.usable && !this.closed;
  }
  get busy(): boolean {
    return (
      this.probing ||
      (!!this.channel && !this.readyForSetup) ||
      this.requestId !== 0 ||
      this.cancelId !== 0
    );
  }
  get canSetup(): boolean {
    return this.readyForSetup && !this.busy && !this.closed;
  }
  get terminalFailure(): boolean {
    return this.closed;
  }
  get preparedFileError(): string {
    return this.validationError;
  }

  start(ready: () => void, failed: (reason: string) => void): void {
    if (this.available) {
      ready();
      return;
    }
    if (this.channel) return;
    this.closed = false;
    this.started = ready;
    this.startFailed = failed;
    this.lastReply = this.lastPing = this.platform.now();
    this.deadline = this.platform.now() + 30000;
    this.setStatus('Starting radio helper');
    const generation = ++this.generation;
    try {
      this.channel = this.platform.open(
        (bytes) => {
          if (generation === this.generation && !this.closed) this.onOutput(bytes);
        },
        (code) => {
          if (generation === this.generation && !this.closed)
            this.fatal('Radio helper stopped (exit ' + code + '). Retry when ready.');
        },
        () => {
          if (generation === this.generation && !this.closed)
            this.fatal('Radio helper connection failed.');
        },
      );
    } catch (error) {
      this.fatal(error instanceof Error ? error.message : 'Radio helper could not start.');
    }
  }
  request(
    operation: 'setup' | 'resolve' | 'stream' | 'prepare',
    fields: { query?: string; videoId?: string },
    complete: (reply: RadioMediaReply) => void,
    failed: (reason: string) => void,
    progress?: (reply: RadioMediaReply) => void,
  ): boolean {
    if ((!this.available && !(operation === 'setup' && this.canSetup)) || this.busy) return false;
    this.operation = operation;
    this.requestId = this.nextRequest = (this.nextRequest + 1) >>> 0;
    if (!this.requestId) this.requestId = this.nextRequest = 1;
    this.completed = complete;
    this.failed = failed;
    this.updated = progress ?? null;
    this.streamVideo = operation === 'stream' ? String(fields.videoId) : '';
    this.deadline =
      this.platform.now() +
      (operation === 'setup'
        ? 600000
        : operation === 'prepare' || operation === 'stream'
          ? 240000
          : 45000);
    this.setStatus(
      operation === 'setup'
        ? 'Downloading radio tools'
        : operation === 'stream'
          ? 'Opening audio stream'
          : operation === 'prepare'
            ? 'Preparing audio'
            : 'Looking up song',
    );
    return this.send({
      ...fields,
      op: operation,
      id: this.requestId,
      ...(operation === 'setup' ? { toolsDir: this.platform.toolsDirectory } : {}),
    });
  }
  private send(data: object): boolean {
    try {
      if (!this.channel) throw Error('No helper');
      const text = JSON.stringify(data);
      if (text.length > 4096) throw Error('Oversized request');
      this.channel.write(text + '\n');
      return true;
    } catch {
      this.fatal('Radio helper connection failed.');
      return false;
    }
  }
  private onOutput(bytes: Uint8Array): void {
    try {
      if (bytes.length > 65536 || this.output.length + bytes.length > 65536)
        throw Error('Oversized reply');
      const combined = new Uint8Array(this.output.length + bytes.length);
      combined.set(this.output);
      combined.set(bytes, this.output.length);
      this.output = combined;
      let consumed = 0;
      for (let i = 0; i < combined.length; i++) {
        if (combined[i] !== 10) continue;
        const line = new TextDecoder().decode(combined.subarray(consumed, i));
        consumed = i + 1;
        if (!line.length) continue;
        const reply: unknown = JSON.parse(line);
        this.lastReply = this.platform.now();
        this.handleReply(reply);
        if (this.closed || !this.channel) break;
      }
      if (!this.closed && consumed) this.output = combined.slice(consumed);
    } catch {
      this.fatal('Radio helper sent an invalid response.');
    }
  }
  private handleReply(value: unknown): void {
    if (!value || typeof value !== 'object' || typeof (value as HelperReply).status !== 'string')
      throw Error('Invalid reply');
    const reply = value as HelperReply;
    if (reply.status === 'alive') return;
    if (reply.status === 'error' && Number(reply.id) === 0 && !this.readyForSetup) {
      this.fatal(this.safeDetail(reply.detail, 'Radio helper could not start.'));
      return;
    }
    if (reply.status === 'helper_ready') {
      if (this.usable || this.probing) return;
      this.probing = true;
      this.deadline = this.platform.now() + 45000;
      this.readyForSetup = true;
      this.send({ op: 'probe', id: 0, toolsDir: this.platform.toolsDirectory });
      this.setStatus('Checking radio tools');
      return;
    }
    if (reply.status === 'capabilities' && this.probing && Number(reply.id) === 0) {
      this.probing = false;
      this.usable = reply.available === true;
      this.setStatus(
        this.usable ? 'Ready' : this.safeDetail(reply.detail, 'Radio needs one-time setup.'),
      );
      const callback = this.started;
      this.started = this.startFailed = null;
      callback?.();
      return;
    }
    if (this.cancelId !== 0 && Number(reply.id) === this.cancelId) {
      if (['error', 'resolved', 'prepared', 'capabilities'].includes(reply.status)) {
        this.cancelId = 0;
        this.setStatus(this.usable ? 'Ready' : 'Radio setup cancelled.');
      }
      return;
    }
    if (!this.requestId || typeof reply.id !== 'number' || reply.id !== this.requestId) return;
    if (reply.status === 'streaming' && this.operation === 'stream') {
      if (
        reply.videoId !== this.streamVideo ||
        typeof reply.url !== 'string' ||
        !RadioStreamURL.valid(reply.url, this.streamVideo) ||
        !Number.isFinite(reply.durationMs) ||
        reply.durationMs! <= 0 ||
        reply.durationMs! > 1200000
      )
        throw Error('Invalid local audio stream');
      this.setStatus('Streaming and caching audio');
      this.updated?.(reply);
      return;
    }
    if (reply.status === 'setup_progress' && this.operation === 'setup') {
      let progress = this.safeDetail(reply.detail, 'Downloading radio tools');
      if (
        Number.isFinite(reply.totalBytes) &&
        reply.totalBytes! > 0 &&
        Number.isFinite(reply.doneBytes)
      )
        progress +=
          ' (' +
          Math.max(0, Math.min(100, Math.round((100 * reply.doneBytes!) / reply.totalBytes!))) +
          '%)';
      this.setStatus(progress);
      return;
    }
    if (reply.status === 'capabilities' && this.operation === 'setup') {
      this.usable = reply.available === true;
      if (!this.usable) reply.status = 'error';
    } else if (!['resolved', 'prepared', 'error'].includes(reply.status)) return;
    if (
      (reply.status === 'resolved' && this.operation !== 'resolve') ||
      (reply.status === 'prepared' && this.operation !== 'prepare' && this.operation !== 'stream')
    )
      throw Error('Mismatched reply');
    const done = this.completed,
      failed = this.failed;
    this.clearRequest();
    if (reply.status === 'error') {
      this.setStatus(this.safeDetail(reply.detail, 'This song could not be prepared.'));
      failed?.(this.status);
    } else {
      this.setStatus('Ready');
      done?.(reply);
    }
  }
  preparedFile(path: string | undefined): PreparedRadioAudio | null {
    this.validationError = '';
    try {
      return this.platform.validatePreparedFile(path);
    } catch (error) {
      this.validationError =
        error instanceof Error
          ? this.safeDetail(error.message, 'Prepared audio could not be checked.')
          : 'Prepared audio could not be checked.';
      return null;
    }
  }
  tick(): void {
    if (this.closed) return;
    const now = this.platform.now();
    if (this.busy && now > this.deadline) {
      this.fatal('Radio operation timed out. Retry or choose another song.');
      return;
    }
    if (!this.channel) return;
    if (now - this.lastReply > 20000) {
      this.fatal('Radio helper stopped responding.');
      return;
    }
    if (now - this.lastPing >= 3000) {
      this.lastPing = now;
      this.send({ op: 'ping' });
    }
  }
  cancel(): void {
    const id = this.requestId;
    this.clearRequest();
    if (id && this.channel && !this.closed) {
      this.cancelId = id;
      this.deadline = this.platform.now() + 10000;
      this.setStatus('Cancelling radio operation');
      this.send({ op: 'cancel', id });
    }
  }
  private clearRequest(): void {
    this.requestId = 0;
    this.operation = '';
    this.completed = this.failed = this.updated = null;
    this.streamVideo = '';
  }
  private fatal(message: string): void {
    if (this.closed) return;
    const callback = this.failed ?? this.startFailed;
    this.dispose();
    this.setStatus(message);
    callback?.(message);
  }
  private setStatus(value: string): void {
    this.status = value;
    this.onStatus?.();
  }
  private safeDetail(value: unknown, fallback: string): string {
    return typeof value === 'string' && value.length
      ? value.replace(/[\x00-\x1f\x7f]/g, ' ').slice(0, 200)
      : fallback;
  }
  dispose(): void {
    if (this.closed) return;
    this.closed = true;
    this.generation++;
    const channel = this.channel;
    this.channel = null;
    try {
      channel?.write('{"op":"quit"}\n');
    } catch {
      /* Broken stdin cannot recurse into disposal. */
    }
    this.usable = this.probing = this.readyForSetup = false;
    this.cancelId = 0;
    this.clearRequest();
    this.started = this.startFailed = null;
    this.output = new Uint8Array(0);
    channel?.close();
  }
}
