import { read, type API, type Raw } from '../api/Types';

type Callback = ((message: Raw) => void) | null;
type Failure = ((reason: string) => void) | null;
interface CargoRequest {
  arguments: unknown[];
  callback: Callback;
  onError: Failure;
}

/** getCargo replies have no owner/request ID. Share one FIFO with native cargo. */
export class CargoReadQueue {
  private pending: CargoRequest[] = [];
  private inFlight: CargoRequest | null = null;
  private stopped = false;
  private failed = false;

  constructor(
    private readonly send: (callback: (message: Raw) => void, args: unknown[]) => void,
    private readonly isCurrent: () => boolean,
  ) {}

  enqueue(args: unknown[], callback: Callback, onError: Failure = null): void {
    if (this.stopped || this.failed) {
      this.invoke(onError, 'Cargo reads are unavailable until the next room connection.');
      return;
    }
    if (!args[0] || !callback) {
      this.invoke(onError, 'A cargo request requires a player ID and callback.');
      return;
    }
    if (this.pending.length >= 64) {
      this.invoke(onError, 'Too many pending cargo reads.');
      return;
    }
    this.pending.push({ arguments: args, callback, onError });
    this.pump();
  }

  private pump(): void {
    if (this.stopped || this.failed || this.inFlight || !this.pending.length) return;
    if (!this.isCurrent()) {
      this.dispose();
      return;
    }
    const request = this.pending.shift()!;
    this.inFlight = request;
    try {
      this.send((message) => this.finish(request, message), request.arguments);
    } catch {
      if (!this.stopped && this.inFlight === request) this.failClosed();
    }
  }

  private finish(request: CargoRequest, message: Raw): void {
    if (this.stopped) return;
    if (!this.isCurrent()) {
      this.dispose();
      return;
    }
    if (this.inFlight !== request) return;
    this.inFlight = null;
    const { callback, onError } = request;
    this.release(request);
    if (this.failed) return;
    if (this.validResponse(message)) this.invoke(callback, message);
    else this.invoke(onError, 'The server returned an invalid cargo response.');
    this.pump();
  }

  private validResponse(message: Raw): boolean {
    if (!message || read(message, 'length', -1) % 4 !== 0) return false;
    try {
      for (let index = 0; index < read(message, 'length', -1); index += 4) {
        message.getString(index);
        message.getString(index + 1);
        message.getString(index + 2);
        message.getInt(index + 3);
      }
      return true;
    } catch {
      return false;
    }
  }

  private failClosed(): void {
    // Sending may have installed a type-only RPC handler before throwing.
    this.failed = true;
    const rejected = this.pending;
    this.pending = [];
    if (this.inFlight) rejected.unshift(this.inFlight);
    for (const request of rejected) {
      const onError = request.onError;
      this.release(request);
      if (!this.stopped && this.isCurrent())
        this.invoke(onError, 'Cargo send failed; reconnect before requesting cargo again.');
    }
  }

  private invoke(callback: Function | null, value: unknown): void {
    try {
      callback?.(value);
    } catch (error) {
      console.warn('Cargo read callback failed', error);
    }
  }

  private release(request: CargoRequest): void {
    request.callback = request.onError = null;
    request.arguments = [];
  }

  dispose(): void {
    if (this.stopped) return;
    this.stopped = true;
    if (this.inFlight) this.release(this.inFlight);
    this.inFlight = null;
    for (const request of this.pending) this.release(request);
    this.pending.length = 0;
  }
}

/** Haxe represents rest arguments as one array at the RPC boundary. */
export function installNativeCargoQueue(api: API, game: Raw): CargoReadQueue {
  const rpc = game.rpc.bind(game);
  const queue = new CargoReadQueue(
    (receive, args) => rpc('getCargo', receive, args),
    () => api.game === game && !game.isLeaving,
  );
  api.around(game, 'rpc', (next, type, callback, args = []) => {
    if (type !== 'getCargo') return next(type, callback, args);
    queue.enqueue(args, callback);
  });
  api.defer(() => queue.dispose());
  return queue;
}
