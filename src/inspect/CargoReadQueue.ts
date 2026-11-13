import type { API } from '../api/Types';
import type { GameScene, Message } from '../game/Bindings';
import { GameReflection } from '../api/GameReflection';

type CargoArguments = NonNullable<Parameters<GameScene['rpc']>[2]>;

type Callback = ((message: Message) => void) | null;
type Failure = ((reason: string) => void) | null;
interface CargoRequest {
  arguments: CargoArguments;
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
    private send: ((callback: (message: Message) => void, args: CargoArguments) => void) | null,
    private isCurrent: (() => boolean) | null,
  ) {}

  enqueue(args: CargoArguments, callback: Callback, onError: Failure = null): void {
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
    const send = this.send;
    if (!send || !this.isCurrent?.()) {
      this.dispose();
      return;
    }
    const request = this.pending.shift()!;
    this.inFlight = request;
    try {
      send((message) => this.finish(request, message), request.arguments);
    } catch {
      if (!this.stopped && this.inFlight === request) this.failClosed();
    }
  }

  private finish(request: CargoRequest, message: Message): void {
    if (this.stopped) return;
    if (!this.isCurrent?.()) {
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

  private validResponse(message: Message): boolean {
    if (!message) return false;
    try {
      const length = message.length;
      if (length % 4 !== 0) return false;
      for (let index = 0; index < length; index += 4) {
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
      if (!this.stopped && this.isCurrent?.())
        this.invoke(onError, 'Cargo send failed; reconnect before requesting cargo again.');
    }
  }

  private invoke<T>(callback: ((value: T) => void) | null, value: T): void {
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
    // Match the source: late reply closures may retain this queue after exit.
    // They must not retain the old Game through its sender/current predicates.
    this.send = null;
    this.isCurrent = null;
  }
}

/** Haxe represents rest arguments as one array at the RPC boundary. */
export function installNativeCargoQueue(api: API, game: GameScene): CargoReadQueue {
  const rpc = game.rpc.bind(game);
  const queue = new CargoReadQueue(
    (receive, args) => rpc('getCargo', receive, args),
    () => api.game === game && !game.get_isLeaving(),
  );
  new GameReflection(api).around(game, 'rpc', (next, type, callback, args = []) => {
    if (type !== 'getCargo') return next(type, callback, args);
    queue.enqueue(args, callback);
  });
  api.defer(() => queue.dispose());
  return queue;
}
