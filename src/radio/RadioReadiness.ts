import type { IPCMessage } from '../ipc/ClientIPCCodec';
import type { RadioState } from './RadioState';

export interface RadioReadinessOwner {
  readonly state: RadioState | null;
  readonly host: boolean;
  readonly synchronized: boolean;
  readonly online: boolean;
  readonly clockReady: boolean;
  readonly transferringLeadership: boolean;
  readonly elapsed: number;
  readonly serverNow: number;
  readonly ownSession: string;
  readonly hostSession: string;
  readonly members: ReadonlyMap<string, { session: string; seen: number }>;
  peerSessionId(id: string): string | null;
  changed(): void;
  /** State revision has already advanced before publication. */
  publish(): void;
  queueReady(
    target: string,
    message: IPCMessage,
    key: string,
    sent: () => void,
    isCurrent: () => boolean,
  ): void;
}

/** RadioRooms' bounded buffering barrier, with session-bound guest acknowledgements. */
export class RadioReadiness {
  private readyPeers = new Map<string, { session: string; playback: number }>();
  private cohort = new Map<string, string>();
  private playback = -1;
  private deadline = -1;
  private guestPlayback = -1;
  private guestSession: string | null = null;
  private guestSentPlayback = -1;
  private guestSentSession: string | null = null;
  private nextAck = 0;
  private generation = 0;

  constructor(private owner: RadioReadinessOwner) {}

  get guestReady(): boolean {
    return this.owner.state?.playbackRevision === this.guestPlayback;
  }

  markSent(playback: number, session: string): void {
    this.guestSentPlayback = playback;
    this.guestSentSession = session;
  }

  get waitingCount(): number {
    const state = this.owner.state;
    if (!this.owner.host || !state?.buffering || this.playback !== state.playbackRevision) return 0;
    let count = 0;
    for (const [id, session] of this.cohort) {
      if (
        this.owner.members.get(id)?.session !== session ||
        this.owner.peerSessionId(id) !== session
      )
        continue;
      const ready = this.readyPeers.get(id);
      if (!ready || ready.session !== session || ready.playback !== this.playback) count++;
    }
    return count;
  }
  get waitingMs(): number {
    return this.owner.host &&
      this.owner.state?.buffering &&
      this.playback === this.owner.state.playbackRevision &&
      this.deadline >= 0
      ? Math.max(0, this.deadline - this.owner.elapsed)
      : 0;
  }
  get waitingForPeers(): boolean {
    return this.deadline >= 0 && this.owner.elapsed < this.deadline && this.waitingCount > 0;
  }

  ready(videoId: string, playbackRevision = -1): void {
    const o = this.owner,
      state = o.state;
    if (
      !o.synchronized ||
      o.transferringLeadership ||
      !state?.buffering ||
      !state.queue.length ||
      state.queue[state.currentIndex].videoId !== videoId ||
      (playbackRevision >= 0 && playbackRevision !== state.playbackRevision)
    )
      return;
    if (!o.host) {
      if (this.guestPlayback !== state.playbackRevision || this.guestSession !== o.ownSession) {
        this.guestPlayback = state.playbackRevision;
        this.guestSession = o.ownSession;
        this.nextAck = o.elapsed;
      }
      if (
        (this.guestSentPlayback === state.playbackRevision &&
          this.guestSentSession === o.ownSession) ||
        o.elapsed < this.nextAck
      )
        return;
      this.nextAck = o.elapsed + 1000;
      const session = o.ownSession,
        hostSession = o.hostSession,
        host = state.hostId,
        room = state.roomId,
        playback = state.playbackRevision,
        generation = this.generation,
        created = o.elapsed;
      const isCurrent = () => {
        const current = o.state;
        return (
          generation === this.generation &&
          o.online &&
          !o.host &&
          o.ownSession === session &&
          o.hostSession === hostSession &&
          current?.hostId === host &&
          current.roomId === room &&
          current.buffering &&
          current.playbackRevision === playback &&
          o.elapsed - created < 15000
        );
      };
      o.queueReady(
        host,
        { type: 'qipc3.radio.ready', fields: [session, room, hostSession, playback, videoId] },
        'ready:' + playback,
        () => {
          if (isCurrent()) {
            this.guestSentPlayback = playback;
            this.guestSentSession = session;
          }
        },
        isCurrent,
      );
      return;
    }
    if (this.playback !== state.playbackRevision) {
      this.playback = state.playbackRevision;
      this.deadline = o.elapsed + 8000;
      this.cohort.clear();
      for (const [id, member] of o.members) {
        if (
          member.session &&
          o.elapsed - member.seen <= 65000 &&
          o.peerSessionId(id) === member.session
        )
          this.cohort.set(id, member.session);
      }
      o.changed();
    }
    this.finish();
  }

  /** Includes the outer RadioRooms.receive identity checks, before accepting an ack. */
  receive(message: IPCMessage, sender: string): boolean {
    const o = this.owner,
      state = o.state,
      f = message.fields;
    if (
      message.type !== 'qipc3.radio.ready' ||
      !o.online ||
      !o.host ||
      o.transferringLeadership ||
      !state?.buffering ||
      !state.queue.length ||
      f.length !== 5 ||
      typeof f[0] !== 'string' ||
      o.peerSessionId(sender) !== f[0] ||
      o.members.get(sender)?.session !== f[0] ||
      f[1] !== state.roomId ||
      f[2] !== o.ownSession ||
      typeof f[3] !== 'number' ||
      !Number.isInteger(f[3]) ||
      f[3] < 0 ||
      f[3] > 2147483647 ||
      f[3] !== state.playbackRevision ||
      f[4] !== state.queue[state.currentIndex].videoId
    )
      return false;
    this.readyPeers.set(sender, { session: f[0], playback: f[3] });
    this.finish();
    o.changed();
    return true;
  }

  finish(): void {
    const o = this.owner,
      state = o.state;
    if (
      !o.host ||
      o.transferringLeadership ||
      !o.online ||
      !o.clockReady ||
      !state?.buffering ||
      this.playback !== state.playbackRevision ||
      this.deadline < 0
    )
      return;
    for (const [id, session] of this.cohort) {
      if (o.members.get(id)?.session !== session || o.peerSessionId(id) !== session)
        this.cohort.delete(id);
    }
    if (this.waitingCount > 0 && o.elapsed < this.deadline) return;
    this.deadline = -1;
    this.cohort.clear();
    state.buffering = false;
    state.anchorAt = o.serverNow + 1000;
    // Pausing while audio prepares must remain paused when listeners are ready.
    state.revision++;
    o.publish();
  }

  removePeer(id: string): void {
    this.readyPeers.delete(id);
  }
  reset(): void {
    this.generation++;
    this.readyPeers.clear();
    this.cohort.clear();
    this.playback = this.deadline = this.guestPlayback = this.guestSentPlayback = -1;
    this.guestSession = this.guestSentSession = null;
    this.nextAck = 0;
  }
}
