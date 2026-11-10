// Source port of movement/RemoteRotationBuffer.as.
export interface RotationHeading {
  time: number;
  rotation: number;
  rotateLeft: boolean;
  rotateRight: boolean;
}
interface RotationSnapshot {
  time: number;
  angle: number;
  rawAngle: number;
  direction: number;
  rate: number;
}

/**
 * Buffered playback of a remote player's timestamped rotation states.
 * Receipt time anchors a 66 ms buffer; server-clock age is not subtracted a
 * second time. Raw Headings are copied before movement extrapolation; callers
 * use the sampled angle for the remote hull and its logical weapon heading.
 */
export class RemoteRotationBuffer {
  private static readonly BUFFER_MS: number = 66;
  private static readonly MAX_SNAPSHOTS: number = 32;
  private static readonly MAX_ELAPSED_MS: number = 500;
  private static readonly CLOCK_SLEW: number = 0.1;
  private static readonly MIN_SLEW_RATE: number = 1.2;
  private static readonly TWO_PI: number = Math.PI * 2;

  private snapshots: RotationSnapshot[] = [];
  private clockOffset: number = NaN;
  private playbackTime: number = NaN;
  private lastNow: number = NaN;
  private lastReceipt: number = NaN;
  private displayedAngle: number = NaN;
  private cachedAngle: number = NaN;
  private sampledDirection: number = 0;
  private sampledRate: number = 0;

  public reset(): void {
    this.snapshots.length = 0;
    this.clockOffset = this.playbackTime = this.lastNow = this.lastReceipt = NaN;
    this.displayedAngle = this.cachedAngle = NaN;
    this.sampledDirection = 0;
    this.sampledRate = 0;
  }

  /**
   * False rejects an older/invalid raw pose. Equal-time rotation duplicates
   * return true: their enclosing course may still revise position/velocity.
   */
  public add(heading: RotationHeading, receivedAt: number, rotationSpeed: number): boolean {
    if (heading == null || !isFinite(heading.time) || !isFinite(heading.rotation)) {
      return false;
    }
    let previous: RotationSnapshot | null =
      this.snapshots.length == 0 ? null : this.snapshots[this.snapshots.length - 1];
    if (previous != null && heading.time < previous.time) {
      return false;
    }
    if (!isFinite(receivedAt)) {
      return true;
    }
    let rate: number = isFinite(rotationSpeed)
      ? Math.max(0, rotationSpeed)
      : previous == null
        ? 0
        : previous.rate;
    let direction: number = (heading.rotateRight ? 1 : 0) - (heading.rotateLeft ? 1 : 0);
    if (
      previous != null &&
      heading.time == previous.time &&
      heading.rotation == previous.rawAngle &&
      direction == previous.direction &&
      rate == previous.rate
    ) {
      return true;
    }

    let angle: number = heading.rotation;
    if (previous != null) {
      // A long held turn can cross several revolutions between packets.
      // Unwrap against that known motion, not merely the last raw angle.
      let expected: number =
        previous.angle +
        (previous.direction * previous.rate * (heading.time - previous.time)) / 1000;
      angle = expected + RemoteRotationBuffer.shortest(heading.rotation - expected);
    }
    let snapshot: RotationSnapshot = {
      time: heading.time,
      angle: angle,
      rawAngle: heading.rotation,
      direction: direction,
      rate: rate,
    };
    if (previous != null && heading.time == previous.time) {
      this.snapshots[this.snapshots.length - 1] = snapshot;
    } else {
      this.snapshots.push(snapshot);
      if (this.snapshots.length > RemoteRotationBuffer.MAX_SNAPSHOTS) {
        this.snapshots.shift();
      }
    }

    if (previous == null) {
      this.clockOffset = heading.time - receivedAt;
      this.playbackTime = heading.time - RemoteRotationBuffer.BUFFER_MS;
      this.lastNow = receivedAt;
    } else if (receivedAt >= this.lastNow) {
      // Packets adjust only the desired mapping, never the live cursor.
      // Cap each observation's influence so jitter cannot jump playback.
      let offsetError: number = heading.time - receivedAt - this.clockOffset;
      this.clockOffset += RemoteRotationBuffer.clamp(offsetError, -100, 100) * 0.1;
    }
    this.lastReceipt = receivedAt;
    return true;
  }

  public sample(now: number): number {
    if (this.snapshots.length == 0) {
      return NaN;
    }
    if (!isFinite(now)) {
      return this.cachedAngle;
    }
    let elapsed: number = now - this.lastNow;
    if (elapsed == 0 && isFinite(this.cachedAngle)) {
      return this.cachedAngle;
    }
    if (elapsed < 0 || elapsed > RemoteRotationBuffer.MAX_ELAPSED_MS) {
      // Timer wrap/backwards movement or a paused renderer is a new
      // baseline, not a request to animate all the missed revolutions.
      let newest: RotationSnapshot = this.snapshots[this.snapshots.length - 1];
      if (elapsed < 0) {
        this.clockOffset = newest.time - now;
        this.lastReceipt = now;
      } else {
        this.clockOffset = newest.time - this.lastReceipt;
      }
      this.playbackTime = now + this.clockOffset - RemoteRotationBuffer.BUFFER_MS;
      this.lastNow = now;
      if (!isFinite(this.displayedAngle)) {
        this.displayedAngle = this.angleAt(this.playbackTime);
        this.cachedAngle = RemoteRotationBuffer.normalized(this.displayedAngle);
      }
      return this.cachedAngle;
    }

    let nextTime: number = this.playbackTime + elapsed;
    let clockError: number = now + this.clockOffset - RemoteRotationBuffer.BUFFER_MS - nextTime;
    // Even when correcting the mapping, playback never travels backwards
    // and cannot jump forward because a packet happened to arrive.
    this.playbackTime =
      nextTime +
      RemoteRotationBuffer.clamp(
        clockError,
        -elapsed * RemoteRotationBuffer.CLOCK_SLEW,
        elapsed * RemoteRotationBuffer.CLOCK_SLEW,
      );
    this.lastNow = now;
    let target: number = this.angleAt(this.playbackTime);
    if (!isFinite(this.displayedAngle)) {
      this.displayedAngle = target;
    } else if (elapsed > 0) {
      let seconds: number = elapsed / 1000;
      let nominal: number = this.sampledDirection * this.sampledRate * seconds;
      let correction: number = RemoteRotationBuffer.shortest(
        target - (this.displayedAngle + nominal),
      );
      let maximum: number =
        Math.max(this.sampledRate * 1.35, RemoteRotationBuffer.MIN_SLEW_RATE) * seconds;
      // Bound the TOTAL visual step, not just its correction component.
      // Held ON is extrapolated indefinitely at the known engine rate;
      // there is deliberately no short timeout that freezes rotation.
      this.displayedAngle += RemoteRotationBuffer.clamp(nominal + correction, -maximum, maximum);
    }
    this.cachedAngle = RemoteRotationBuffer.normalized(this.displayedAngle);
    return this.cachedAngle;
  }

  private angleAt(time: number): number {
    let previous: RotationSnapshot = this.snapshots[0];
    if (time < previous.time) {
      this.sampledDirection = 0;
      this.sampledRate = previous.rate;
      return previous.angle;
    }
    for (let i: number = 1; i < this.snapshots.length; i++) {
      let next: RotationSnapshot = this.snapshots[i];
      if (time < next.time) {
        this.sampledDirection = previous.direction;
        this.sampledRate = previous.rate;
        let fraction: number = (time - previous.time) / (next.time - previous.time);
        return previous.angle + (next.angle - previous.angle) * fraction;
      }
      previous = next;
    }
    this.sampledDirection = previous.direction;
    this.sampledRate = previous.rate;
    // An OFF snapshot terminates prediction at its authoritative angle.
    // A late stop is approached through sample's bounded angular slew.
    return (
      previous.angle + (this.sampledDirection * this.sampledRate * (time - previous.time)) / 1000
    );
  }

  private static shortest(angle: number): number {
    return (
      angle -
      Math.floor((angle + Math.PI) / RemoteRotationBuffer.TWO_PI) * RemoteRotationBuffer.TWO_PI
    );
  }

  private static normalized(angle: number): number {
    return angle - Math.floor(angle / RemoteRotationBuffer.TWO_PI) * RemoteRotationBuffer.TWO_PI;
  }

  private static clamp(value: number, minimum: number, maximum: number): number {
    return Math.max(minimum, Math.min(maximum, value));
  }
}
