import type { RadioState, RadioTrack } from './RadioState';
import { RadioStateWire } from './RadioStateWire';

export interface RadioQueueOwner {
  readonly state: RadioState | null;
  readonly host: boolean;
  readonly online: boolean;
  readonly synchronized: boolean;
  readonly transferringLeadership: boolean;
  readonly serverNow: number;
  resetReadiness(): void;
  /** The queue has already incremented revision and, when needed, queueRevision. */
  publish(queueChanged: boolean): void;
}

/** RadioRooms' authoritative queue transitions. Only the leader mutates the queue. */
export class RadioQueue {
  constructor(
    private owner: RadioQueueOwner,
    private random: () => number = Math.random,
  ) {}

  enqueueTrack(track: RadioTrack): boolean {
    const state = this.owner.state;
    if (
      !state ||
      !this.owner.host ||
      !this.owner.online ||
      this.owner.transferringLeadership ||
      !RadioStateWire.validTrack(track) ||
      state.queue.length >= 10
    )
      return false;
    const empty = !state.queue.length;
    const finished =
      !empty &&
      !state.playing &&
      !state.buffering &&
      state.positionMs >= state.queue[state.currentIndex].durationMs;
    state.queue.push(RadioStateWire.copyTrack(track));
    if (empty) {
      state.playedMask = 0;
      this.beginTrack(state, 0);
    } else if (finished) this.beginTrack(state, state.queue.length - 1);
    this.publish(state, true);
    return true;
  }

  pause(): void {
    const state = this.controllable;
    if (!state || !state.playing) return;
    state.positionMs = RadioStateWire.expectedPosition(
      state,
      this.owner.synchronized,
      this.owner.serverNow,
    );
    state.playing = false;
    state.anchorAt = this.owner.serverNow;
    this.publish(state, false);
  }

  resume(): void {
    const state = this.controllable;
    if (!state || state.playing || !state.queue.length) return;
    if (state.positionMs >= state.queue[state.currentIndex].durationMs) {
      state.playedMask = 0;
      this.beginTrack(state, 0);
      this.publish(state, true);
      return;
    }
    state.playing = true;
    state.anchorAt = this.owner.serverNow + 1000;
    this.publish(state, false);
  }

  skip(): void {
    this.advanceTrack(false);
  }

  /** Only natural completion honors repeat-one; an explicit skip always advances. */
  advanceTrack(natural: boolean): void {
    const state = this.controllable;
    if (!state?.queue.length) return;
    const index = state.currentIndex;
    if (natural && state.repeatMode === 'one') {
      this.beginTrack(state, index);
      this.publish(state, false);
      return;
    }
    let nextStart = index;
    if (state.keepFinished) {
      state.playedMask |= 1 << index;
      nextStart++;
    } else this.removeQueueEntry(state, index);
    const candidates: number[] = [];
    const count = state.queue.length;
    for (let n = 0; n < count; n++) {
      const candidate = (nextStart + n) % count;
      if (!(state.playedMask & (1 << candidate))) candidates.push(candidate);
    }
    if (!candidates.length && count > 0 && state.repeatMode === 'all') {
      state.playedMask = 0;
      for (let n = 0; n < count; n++) candidates.push((nextStart + n) % count);
      if (state.shuffle && count > 1) candidates.splice(candidates.indexOf(index), 1);
    }
    if (candidates.length)
      this.beginTrack(
        state,
        candidates[state.shuffle ? Math.floor(this.random() * candidates.length) : 0],
      );
    else {
      this.owner.resetReadiness();
      state.currentIndex = count === 0 ? 0 : Math.min(index, count - 1);
      state.playbackRevision++;
      state.positionMs = count === 0 ? 0 : state.queue[state.currentIndex].durationMs;
      state.anchorAt = this.owner.serverNow;
      state.playing = state.buffering = false;
    }
    this.publish(state, true);
  }

  setQueueModes(shuffle: boolean, repeatMode: string, keepFinished: boolean): void {
    const state = this.controllable;
    if (!state || (repeatMode !== 'off' && repeatMode !== 'one' && repeatMode !== 'all')) return;
    if (repeatMode === 'all') keepFinished = true;
    if (
      state.shuffle === shuffle &&
      state.repeatMode === repeatMode &&
      state.keepFinished === keepFinished
    )
      return;
    state.shuffle = shuffle;
    state.repeatMode = repeatMode;
    state.keepFinished = keepFinished;
    this.publish(state, true);
  }

  seek(positionMs: number): void {
    const state = this.controllable;
    if (!state?.queue.length || !Number.isFinite(positionMs)) return;
    this.owner.resetReadiness();
    state.playbackRevision++;
    state.positionMs = Math.max(
      0,
      Math.min(state.queue[state.currentIndex].durationMs, positionMs),
    );
    state.anchorAt = this.owner.serverNow;
    state.buffering = true;
    this.publish(state, false);
  }

  playTrack(index: number): void {
    const state = this.controllable;
    if (!state || !Number.isInteger(index) || index < 0 || index >= state.queue.length) return;
    this.beginTrack(state, index);
    this.publish(state, true);
  }

  /** Explicit removal ignores both retention and repeat modes. */
  removeTrack(index: number): void {
    const state = this.controllable;
    if (!state || !Number.isInteger(index) || index < 0 || index >= state.queue.length) return;
    const active = state.currentIndex;
    this.removeQueueEntry(state, index);
    if (!state.queue.length) {
      this.owner.resetReadiness();
      state.currentIndex = 0;
      state.playbackRevision++;
      state.positionMs = 0;
      state.playing = state.buffering = false;
    } else if (index === active) this.beginTrack(state, Math.min(index, state.queue.length - 1));
    else if (index < active) state.currentIndex--;
    this.publish(state, true);
  }

  private get controllable(): RadioState | null {
    return this.owner.host && this.owner.synchronized && !this.owner.transferringLeadership
      ? this.owner.state
      : null;
  }

  private beginTrack(state: RadioState, index: number): void {
    this.owner.resetReadiness();
    state.currentIndex = index;
    state.playedMask &= ~(1 << index);
    state.playbackRevision++;
    state.positionMs = 0;
    state.anchorAt = this.owner.serverNow;
    state.playing = state.buffering = true;
  }

  private removeQueueEntry(state: RadioState, index: number): void {
    state.queue.splice(index, 1);
    state.playedMask =
      (state.playedMask & ((1 << index) - 1)) | ((state.playedMask >> (index + 1)) << index);
  }

  private publish(state: RadioState, queueChanged: boolean): void {
    state.revision++;
    if (queueChanged) state.queueRevision++;
    this.owner.publish(queueChanged);
  }
}
