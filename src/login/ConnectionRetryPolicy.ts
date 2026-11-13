import type { PlayerIOError } from '../game/Bindings';
import { transientJoinRetryMessage } from './JoinRetryMessage';

const retryableCodes = new Map<number, string>([
  [2, 'InternalError'],
  [7, 'ExternalError'],
  [13, 'NoServersAvailable'],
  [17, 'UnknownRoom'],
  [19, 'RoomIsFull'],
  [40, 'HeartbeatFailed'],
  [130, 'NetworkIssue'],
]);
const retryableNames = new Set(retryableCodes.values());

/** AS3 uses errorID; the Haxe SDK wrapper preserves browser code and sets ID to -1. */
export function isRetryableConnectionError(error: PlayerIOError): boolean {
  if (error.errorID >= 0) return retryableCodes.has(error.errorID);
  return typeof error.code === 'number'
    ? retryableCodes.has(error.code)
    : retryableNames.has(error.code);
}

interface Retry {
  delay: number;
  status: string;
}

/** Source recovery transport budget and independently bounded stale-session retries. */
export class ConnectionRetryPolicy {
  private static readonly recoveryDelays = [1000, 2000, 4000, 8000, 15000];
  private attempt: number;
  private staleRetries = 0;

  constructor(
    attempt = 1,
    private readonly waitForGameRelease = false,
  ) {
    this.attempt = attempt;
  }

  next(error: PlayerIOError): Retry | null {
    if (transientJoinRetryMessage(error.message)) return this.nextStale(error.message);
    return isRetryableConnectionError(error)
      ? this.nextTransport('Retrying room connection...')
      : null;
  }

  nextStale(reason: string): Retry | null {
    const stale = transientJoinRetryMessage(reason);
    if (!stale) return null;
    // Explicit refresh uses the server rejection as its release check.
    if (this.waitForGameRelease) return { delay: 1000, status: '' };
    if (this.staleRetries >= 3) return null;
    this.staleRetries++;
    return { delay: 2000, status: `${stale} (${this.staleRetries}/3)` };
  }

  nextTimeout(): Retry | null {
    return this.nextTransport(
      `Game room is not responding, retrying... (${this.attempt}/${ConnectionRetryPolicy.recoveryDelays.length - 1})`,
    );
  }

  nextLoadingTimeout(): Retry | null {
    return this.nextTransport('Retrying room connection...');
  }

  private nextTransport(status: string): Retry | null {
    if (this.attempt >= ConnectionRetryPolicy.recoveryDelays.length) return null;
    const delay = ConnectionRetryPolicy.recoveryDelays[this.attempt]!;
    this.attempt++;
    return { delay, status };
  }
}
