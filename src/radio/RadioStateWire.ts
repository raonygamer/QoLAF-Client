import type { IPCMessage, IPCValue } from '../ipc/ClientIPCCodec';
import type { RadioPeer, RadioState, RadioTrack } from './RadioState';

export interface RadioStateContext {
  current: RadioState | null;
  host: boolean;
  hostSession: string;
  minimumRevision: number;
  awaitingSnapshot: boolean;
}

export type RadioStateResult =
  | { kind: 'snapshotRequired'; minimumRevision: number }
  | {
      kind: 'state';
      state: RadioState;
      roster: RadioPeer[];
      successorId: string;
      successorSession: string;
      resetReadiness: boolean;
    };

/** RadioRooms' exact primitive snapshot/timeline schemas, including v1-v3 options. */
export class RadioStateWire {
  static decode(
    message: IPCMessage,
    sender: string,
    context: RadioStateContext,
  ): RadioStateResult | null {
    const full = message.type === 'qipc3.radio.state';
    if (!full && message.type !== 'qipc3.radio.timeline') return null;
    const f = message.fields;
    const current = context.current;
    if (
      !current ||
      context.host ||
      sender !== current.hostId ||
      f.length < 9 ||
      f[0] !== context.hostSession ||
      f[1] !== current.roomId ||
      !this.integer(f[2], 0, 2147483647) ||
      !this.integer(f[3], 0, 2147483647) ||
      typeof f[4] !== 'boolean' ||
      typeof f[5] !== 'boolean' ||
      !this.number(f[6], 0, 1200000) ||
      !this.number(f[7], 0, 1e16) ||
      !this.integer(f[8], 0, 2147483647)
    )
      return null;
    const revision = f[2];
    if (
      revision < context.minimumRevision ||
      revision < current.revision ||
      (revision === current.revision && !context.awaitingSnapshot)
    )
      return null;
    let queue = current.queue;
    let name = current.name;
    let optionsAt = 9;
    if (full) {
      if (f.length < 11 || !this.text(f[9], 48) || !this.integer(f[10], 0, 10)) return null;
      optionsAt = 11 + 3 * f[10];
      if (f.length < optionsAt) return null;
      name = f[9];
      queue = [];
      for (let i = 11; i < optionsAt; i += 3) {
        const track = { videoId: f[i], title: f[i + 1], durationMs: f[i + 2] };
        if (!this.validTrack(track)) return null;
        queue.push(track);
      }
    } else {
      if (f.length !== 9 && f.length < 15) return null;
      if (f[3] !== current.queueRevision || context.awaitingSnapshot)
        return {
          kind: 'snapshotRequired',
          minimumRevision: Math.max(context.minimumRevision, revision),
        };
    }
    let index = 0,
      shuffle = false,
      keepFinished = false,
      playedMask = 0;
    let repeatMode: RadioState['repeatMode'] = 'off';
    let roster: RadioPeer[] = [];
    let successorId = '',
      successorSession = '';
    if (f.length > optionsAt) {
      const version = f[optionsAt],
        selected = f[optionsAt + 1],
        shuffled = f[optionsAt + 2],
        repeat = f[optionsAt + 3],
        keep = f[optionsAt + 4],
        mask = f[optionsAt + 5];
      if (
        f.length < optionsAt + 6 ||
        !this.integer(version, 1, 3) ||
        !this.integer(selected, 0, Math.max(0, queue.length - 1)) ||
        typeof shuffled !== 'boolean' ||
        (repeat !== 'off' && repeat !== 'one' && repeat !== 'all') ||
        typeof keep !== 'boolean' ||
        !this.integer(mask, 0, (1 << queue.length) - 1)
      )
        return null;
      index = selected;
      shuffle = shuffled;
      repeatMode = repeat;
      keepFinished = keep;
      playedMask = mask;
      if (repeatMode === 'all' && !keepFinished) return null;
      if (version === 1) {
        if (f.length !== optionsAt + 6) return null;
      } else {
        let rosterAt = optionsAt + 6;
        if (version === 3) {
          const leader = f[rosterAt],
            session = f[rosterAt + 1];
          if (typeof leader !== 'string' || typeof session !== 'string') return null;
          successorId = leader;
          successorSession = session;
          rosterAt += 2;
        }
        const parsed = this.readRoster(f, rosterAt, sender, context.hostSession);
        if (!parsed) return null;
        roster = parsed;
        if (successorId) {
          if (
            !roster.some(
              (peer) =>
                peer.id === successorId && peer.session === successorSession && peer.role === 'dj',
            )
          )
            return null;
        } else if (successorSession) return null;
      }
    }
    if (((f[4] || f[5]) && !queue.length) || (queue.length > 0 && f[6] > queue[index].durationMs))
      return null;
    return {
      kind: 'state',
      state: {
        roomId: current.roomId,
        hostId: sender,
        name,
        revision,
        queueRevision: f[3],
        queue,
        playing: f[4],
        buffering: f[5],
        positionMs: f[6],
        anchorAt: f[7],
        playbackRevision: f[8],
        currentIndex: index,
        shuffle,
        repeatMode,
        keepFinished,
        playedMask,
      },
      roster,
      successorId,
      successorSession,
      resetReadiness: current.playbackRevision !== f[8],
    };
  }

  static encode(
    state: RadioState,
    session: string,
    peers: readonly RadioPeer[],
    successor: Pick<RadioPeer, 'id' | 'session'> | null,
    full: boolean,
  ): IPCMessage {
    const fields: IPCValue[] = [
      session,
      state.roomId,
      state.revision,
      state.queueRevision,
      state.playing,
      state.buffering,
      state.positionMs,
      state.anchorAt,
      state.playbackRevision,
    ];
    if (full) {
      fields.push(state.name, state.queue.length);
      for (const track of state.queue) fields.push(track.videoId, track.title, track.durationMs);
    }
    fields.push(
      3,
      state.currentIndex,
      state.shuffle,
      state.repeatMode,
      state.keepFinished,
      state.playedMask,
      successor?.id ?? '',
      successor?.session ?? '',
      peers.length,
    );
    for (const peer of peers)
      fields.push(peer.id, peer.session, peer.name, peer.role, peer.authority);
    return { type: full ? 'qipc3.radio.state' : 'qipc3.radio.timeline', fields };
  }

  static expectedPosition(
    state: RadioState | null,
    synchronized: boolean,
    serverTime: number,
  ): number {
    if (!state?.queue.length) return 0;
    let position = state.positionMs;
    if (
      synchronized &&
      state.playing &&
      !state.buffering &&
      Number.isFinite(serverTime) &&
      serverTime > 0
    )
      position += Math.max(0, serverTime - state.anchorAt);
    return Math.max(0, Math.min(state.queue[state.currentIndex].durationMs, position));
  }

  static validTrack(track: {
    videoId: unknown;
    title: unknown;
    durationMs: unknown;
  }): track is RadioTrack {
    return (
      typeof track.videoId === 'string' &&
      /^[A-Za-z0-9_-]{11}$/.test(track.videoId) &&
      this.text(track.title, 160) &&
      this.integer(track.durationMs, 1, 1200000)
    );
  }
  static copyTrack(track: RadioTrack): RadioTrack {
    return {
      videoId: track.videoId,
      title: track.title.slice(0, 96),
      durationMs: track.durationMs,
    };
  }

  private static readRoster(
    fields: readonly IPCValue[],
    start: number,
    hostId: string,
    hostSession: string,
  ): RadioPeer[] | null {
    const count = fields[start];
    if (!this.integer(count, 1, 9) || fields.length !== start + 1 + 5 * count) return null;
    const peers: RadioPeer[] = [],
      ids = new Set<string>();
    let foundHost = false;
    for (let i = start + 1; i < fields.length; i += 5) {
      const [id, session, name, role, authority] = fields.slice(i, i + 5);
      if (
        !this.text(id, 128) ||
        !this.text(session, 128) ||
        !this.text(name, 100) ||
        (role !== 'host' && role !== 'dj' && role !== 'listener') ||
        !this.integer(authority, 0, 2147483647) ||
        ids.has(id) ||
        (id === hostId) !== (role === 'host') ||
        (role === 'dj' && authority === 0)
      )
        return null;
      if (role === 'host') {
        if (session !== hostSession) return null;
        foundHost = true;
      }
      ids.add(id);
      peers.push({ id, session, name, role, authority });
    }
    return foundHost ? peers : null;
  }
  private static text(value: unknown, max: number): value is string {
    return (
      typeof value === 'string' &&
      value.length > 0 &&
      value.length <= max &&
      !/[\x00-\x1f\x7f]/.test(value)
    );
  }
  private static number(value: unknown, min: number, max: number): value is number {
    return typeof value === 'number' && Number.isFinite(value) && value >= min && value <= max;
  }
  private static integer(value: unknown, min: number, max: number): value is number {
    return this.number(value, min, max) && Number.isInteger(value);
  }
}
