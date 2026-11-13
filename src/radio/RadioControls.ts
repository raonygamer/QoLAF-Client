import type { IPCMessage, IPCValue } from '../ipc/ClientIPCCodec';
import type { RadioMember } from './RadioMembership';
import type { RadioQueue } from './RadioQueue';
import type { RadioState } from './RadioState';

export type RadioControlOutcome = 'applied' | 'denied' | 'stale' | 'waiting' | 'failed';
export interface RadioControlsOwner {
  readonly state: RadioState | null;
  readonly host: boolean;
  readonly controller: boolean;
  readonly synchronized: boolean;
  readonly online: boolean;
  readonly closed: boolean;
  readonly transferringLeadership: boolean;
  readonly ownAuthority: number;
  readonly ownSession: string;
  readonly hostSession: string;
  readonly elapsed: number;
  readonly serverNow: number;
  readonly members: ReadonlyMap<string, RadioMember>;
  peerSessionId(id: string): string | null;
  isDJ(id: string): boolean;
  nextNonce(): number;
  queue(
    target: string,
    message: IPCMessage,
    key: string,
    bound: boolean,
    kind: 'control' | 'controlResult',
  ): boolean;
  sendSnapshot(id: string): void;
  onControlResult(outcome: RadioControlOutcome): void;
}

/** DJ operations remain requests; only the leader changes the shared queue. */
export class RadioControls {
  private pendingControl: { id: number; created: number } | null = null;
  constructor(
    private owner: RadioControlsOwner,
    private playback: RadioQueue,
  ) {}

  get pending(): { id: number; created: number } | null {
    return this.pendingControl ? { ...this.pendingControl } : null;
  }

  control(action: string, a: IPCValue = 0, b: IPCValue = false, c: IPCValue = false): boolean {
    const o = this.owner,
      state = o.state;
    if (!o.controller || !state || !this.valid(action, a, b, c)) return false;
    if (o.host) {
      this.perform(action, a, b, c);
      return true;
    }
    if (this.pendingControl) {
      this.notice('waiting');
      return false;
    }
    const id = o.nextNonce();
    this.pendingControl = { id, created: o.elapsed };
    if (
      !o.queue(
        state.hostId,
        {
          type: 'qipc3.radio.control',
          fields: [
            o.ownSession,
            state.roomId,
            o.hostSession,
            o.ownAuthority,
            id,
            state.revision,
            action,
            a,
            b,
            c,
            o.serverNow + 5000,
          ],
        },
        'control:' + id,
        true,
        'control',
      )
    ) {
      this.pendingControl = null;
      this.notice('failed');
      return false;
    }
    return true;
  }

  receive(message: IPCMessage, sender: string): void {
    const o = this.owner,
      state = o.state,
      f = message.fields;
    if (
      o.closed ||
      !o.online ||
      !state ||
      typeof f[0] !== 'string' ||
      o.peerSessionId(sender) !== f[0]
    )
      return;
    if (message.type === 'qipc3.radio.controlResult') {
      if (
        o.host ||
        !this.pendingControl ||
        sender !== state.hostId ||
        f.length !== 5 ||
        f[0] !== o.hostSession ||
        f[1] !== state.roomId ||
        f[2] !== o.ownSession ||
        f[3] !== this.pendingControl.id ||
        (f[4] !== 'applied' && f[4] !== 'denied' && f[4] !== 'stale')
      )
        return;
      this.pendingControl = null;
      this.notice(f[4]);
      return;
    }
    if (
      message.type !== 'qipc3.radio.control' ||
      !o.host ||
      o.transferringLeadership ||
      f.length !== 11 ||
      f[1] !== state.roomId ||
      f[2] !== o.ownSession ||
      !this.integer(f[3], 1, 2147483647) ||
      !this.integer(f[4], 1, 2147483647) ||
      !this.integer(f[5], 0, 2147483647) ||
      typeof f[6] !== 'string' ||
      !this.number(f[10], 0, 1e16)
    )
      return;
    const member = o.members.get(sender);
    if (!member || member.session !== f[0]) return;
    let outcome: RadioControlOutcome = 'denied';
    if (o.isDJ(sender) && member.authority === f[3] && o.synchronized) {
      outcome = 'stale';
      if (
        f[10] >= o.serverNow &&
        f[10] <= o.serverNow + 10000 &&
        f[4] > member.lastControl &&
        f[5] === state.revision &&
        this.valid(f[6], f[7], f[8], f[9])
      ) {
        member.lastControl = f[4];
        this.perform(f[6], f[7], f[8], f[9]);
        outcome = 'applied';
      }
    }
    o.queue(
      sender,
      {
        type: 'qipc3.radio.controlResult',
        fields: [o.ownSession, state.roomId, member.session, f[4], outcome],
      },
      'controlResult:' + sender,
      true,
      'controlResult',
    );
    if (outcome !== 'applied') o.sendSnapshot(sender);
  }

  expire(): void {
    if (this.pendingControl && this.owner.elapsed - this.pendingControl.created >= 5000) {
      this.pendingControl = null;
      this.notice('failed');
    }
  }

  clear(): void {
    this.pendingControl = null;
  }

  private valid(action: string, a: IPCValue, b: IPCValue, c: IPCValue): boolean {
    const state = this.owner.state;
    if (!state) return false;
    if (action === 'pause' || action === 'resume' || action === 'next') return true;
    if (action === 'seek') return this.number(a, 0, 1200000) && !!state.queue[state.currentIndex];
    if (action === 'play' || action === 'remove') return this.integer(a, 0, state.queue.length - 1);
    return (
      action === 'modes' &&
      typeof a === 'boolean' &&
      (b === 'off' || b === 'one' || b === 'all') &&
      typeof c === 'boolean'
    );
  }

  private perform(action: string, a: IPCValue, b: IPCValue, c: IPCValue): void {
    if (action === 'pause') this.playback.pause();
    else if (action === 'resume') this.playback.resume();
    else if (action === 'next') this.playback.skip();
    else if (action === 'seek') this.playback.seek(Number(a));
    else if (action === 'play') this.playback.playTrack(Number(a));
    else if (action === 'remove') this.playback.removeTrack(Number(a));
    else if (action === 'modes')
      this.playback.setQueueModes(Boolean(a), b as 'off' | 'one' | 'all', Boolean(c));
  }

  private notice(outcome: RadioControlOutcome): void {
    try {
      this.owner.onControlResult(outcome);
    } catch {
      /* Observer failures do not retain pending work. */
    }
  }
  private number(value: unknown, min: number, max: number): value is number {
    return typeof value === 'number' && Number.isFinite(value) && value >= min && value <= max;
  }
  private integer(value: unknown, min: number, max: number): value is number {
    return this.number(value, min, max) && Number.isInteger(value);
  }
}
