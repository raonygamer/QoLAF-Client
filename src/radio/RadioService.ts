import type { PreparedRadioAudio } from './RadioAudio';
import { RadioAudio } from './RadioAudio';
import { RadioRooms, type RadioRoomTransport } from './RadioRooms';
import type { RadioState, RadioTrack } from './RadioState';
import type { RadioViewService } from './RadioViewService';

export interface RadioMediaReply {
  videoId?: string;
  title?: string;
  durationMs?: number;
  path?: string;
  url?: string;
}
export interface RadioMediaTransport {
  readonly available: boolean;
  readonly canSetup: boolean;
  readonly busy: boolean;
  readonly status: string;
  readonly terminalFailure: boolean;
  readonly preparedFileError: string;
  start(ready: () => void, failed: (reason: string) => void): void;
  request(
    operation: 'setup' | 'resolve' | 'stream' | 'prepare',
    fields: { query?: string; videoId?: string },
    complete: (reply: RadioMediaReply) => void,
    failed: (reason: string) => void,
    progress?: (reply: RadioMediaReply) => void,
  ): boolean;
  preparedFile(path: string | undefined): PreparedRadioAudio | null;
  tick(): void;
  cancel(): void;
  dispose(): void;
}
export interface RadioServiceEnvironment {
  now(): number;
  every(callback: () => void, interval: number): () => void;
  ipc(): (RadioRoomTransport & { peerLoginInfo(id: string): { name: string } | null }) | null;
  game(): {
    networkServerTime: number;
    isLeaving: boolean;
    me?: { id: string; name: string };
  } | null;
  musicVolume(): number | null;
  acquireMusic(owner: object, leave: () => void): boolean;
  releaseMusic(owner: object): void;
  createTransport(): RadioMediaTransport;
  createAudio(): RadioAudio;
  notice(message: string): void;
}
interface SongQuery {
  query: string;
  roomId: string;
}
interface PendingSong extends SongQuery {
  id: string;
  requester: string;
  requestId: string;
  senderId: string;
  session: string;
  created: number;
}

/** Original RadioService orchestration; filesystem/helper, sound and music ownership are platform boundaries. */
export class RadioService implements RadioViewService {
  rooms: RadioRooms;
  private transport: RadioMediaTransport;
  private audio: RadioAudio;
  private stopTimer: () => void;
  private files = new Map<string, PreparedRadioAudio>();
  private failedTracks = new Set<string>();
  private streamSources = new Map<string, { url: string; durationMs?: number }>();
  private streamDisabled = new Set<string>();
  private queries: SongQuery[] = [];
  private pendingSongs: PendingSong[] = [];
  private requestNonce = 0;
  private closed = false;
  private ownsMusic = false;
  private started = false;
  private account: string | null = null;
  private roomKey: string | null = null;
  private job = '';
  private jobVideo = '';
  private generation = 0;
  private clockOffset = NaN;
  private clockObservedAt = 0;
  private previousVideo = '';
  private playbackRevision = -1;
  private lastVolume = 0;
  private wasLeader = false;
  private messageText = 'Set up Radio once, then create or join a group.';

  constructor(private environment: RadioServiceEnvironment) {
    this.rooms = this.createRooms();
    this.transport = environment.createTransport();
    this.audio = environment.createAudio();
    this.stopTimer = environment.every(() => this.tick(), 250);
    this.tick();
  }
  private createRooms(): RadioRooms {
    const rooms = new RadioRooms(() => this.environment.now());
    rooms.onTrackRequest = (query, sender, id) => this.onRequestedTrack(query, sender, id);
    rooms.onRequestResult = (_id, outcome) => {
      this.messageText = {
        pending: "Your song request is waiting for the leader's approval.",
        accepted: 'The leader accepted your song request. Waiting for the song lookup.',
        denied: 'The leader denied your song request.',
        rejected: 'Your song request could not be added. Please try again later.',
        expired: 'Your song request expired without a decision.',
      }[outcome];
    };
    rooms.onControlResult = (outcome) => {
      this.messageText = {
        applied: 'Playback updated.',
        denied: 'DJ access is no longer available.',
        stale: 'The queue changed. Please try that control again.',
        waiting: 'Waiting for the leader to apply your last control.',
        failed: "The leader didn't confirm that control. Please try again.",
      }[outcome];
    };
    rooms.onNotice = (message) => this.environment.notice(message);
    return rooms;
  }
  get available(): boolean {
    return this.transport.available;
  }
  get canSetup(): boolean {
    return this.transport.canSetup;
  }
  get busy(): boolean {
    return this.transport.busy;
  }
  get volume(): number {
    const value = this.environment.musicVolume();
    if (value !== null && Number.isFinite(value)) this.lastVolume = Math.max(0, Math.min(1, value));
    return this.lastVolume;
  }
  get message(): string {
    return this.messageText === 'Transferring leadership...' ? this.rooms.status : this.messageText;
  }
  get pendingRequests() {
    return this.rooms.host
      ? this.pendingSongs.map(({ id, query, requester }) => ({ id, query, requester }))
      : [];
  }
  get positionMs(): number {
    return this.rooms.expectedPosition(this.clock());
  }
  get telemetry() {
    if (this.closed) return null;
    const info = this.rooms.telemetry;
    if (info)
      info.playing =
        info.playing && this.ownsMusic && this.audio.playing && this.audio.videoId === info.videoId;
    return info;
  }
  get status(): string {
    if (!this.available) return this.transport.status;
    if (this.rooms.transferringLeadership || !this.rooms.joined || !this.rooms.synchronized)
      return this.rooms.status;
    const state = this.rooms.state!,
      track = this.currentTrack(state);
    if (!track) return this.busy ? this.transport.status : 'Queue is empty';
    if (this.failedTracks.has(track.videoId))
      return 'This track is unavailable. Waiting for the next song.';
    if (state.buffering && this.audio.ready) return this.rooms.status;
    if (!this.audio.ready)
      return (
        (this.audio.videoId === track.videoId ? this.audio.status : this.transport.status) +
        ' • ' +
        track.title
      );
    if (!state.playing && state.positionMs >= track.durationMs) return 'Queue finished';
    if (state.playing && this.clock() < state.anchorAt) return 'Starting together...';
    return state.playing ? this.audio.status : 'Paused';
  }

  open(): void {
    if (this.closed) return;
    this.tick();
    this.rooms.refresh();
    if (this.started) return;
    this.started = true;
    this.transport.start(
      () => {
        this.messageText = this.available
          ? 'Ready. Create or join a group to listen.'
          : 'One-time setup downloads about 100 MB of verified tools for this computer.';
      },
      (reason) => {
        this.started = false;
        this.messageText = reason;
      },
    );
  }
  setup(): void {
    if (!this.canSetup) {
      this.open();
      return;
    }
    this.messageText =
      'Downloading verified tools. You can cancel with Stop Radio. Allow about 500 MB of free disk space.';
    this.transport.request(
      'setup',
      {},
      () => {
        this.messageText = 'Radio tools are ready. Create or join a group.';
      },
      (reason) => {
        this.messageText = reason;
      },
    );
  }
  retry(): void {
    this.leave();
    this.transport.dispose();
    this.transport = this.environment.createTransport();
    this.files.clear();
    this.streamSources.clear();
    this.streamDisabled.clear();
    this.started = false;
    this.open();
  }
  create(name: string, password = ''): void {
    if (!this.available) {
      this.messageText = 'Set up Radio before creating a group.';
      return;
    }
    if (!name?.trim()) name = 'Radio';
    this.rooms.create(name, password);
    this.messageText = this.rooms.status;
    this.tick();
  }
  join(room: { hostId: string; roomId: string } | null, password = ''): void {
    if (!this.available) {
      this.messageText = 'Set up Radio before joining a group.';
      return;
    }
    if (!room) {
      this.messageText = 'Select a radio group first.';
      return;
    }
    this.rooms.join(room.hostId, room.roomId, password);
    this.messageText = this.rooms.status;
    this.tick();
  }
  add(query: string): void {
    if (!this.rooms.joined || !this.available) {
      this.messageText = 'Create or join a radio group first.';
      return;
    }
    query = (query ?? '').trim();
    if (!query.length || query.length > 240 || /[\x00-\x1f\x7f]/.test(query)) {
      this.messageText = 'Enter a song name or YouTube URL (up to 240 characters).';
      return;
    }
    this.messageText = this.rooms.status;
    if (this.rooms.requestTrack(query))
      this.messageText = this.rooms.host
        ? 'Song added to the lookup queue.'
        : this.rooms.controller
          ? "Song sent to the leader's queue."
          : "Song requested. Waiting for the leader's approval.";
    else if (!this.rooms.host) this.messageText = this.rooms.status;
  }
  private onRequestedTrack(query: string, senderId: string, requestId: string | null): boolean {
    const state = this.rooms.state;
    if (!this.rooms.host || !this.available || !state) return false;
    if (requestId !== null && this.rooms.isDJ(senderId)) {
      if (!this.canQueueRequest() || !this.rooms.respondToRequest(senderId, requestId, 'accepted'))
        return false;
      this.queries.push({ query, roomId: state.roomId });
      return true;
    }
    if (requestId !== null) {
      this.expireRequests();
      const same = this.pendingSongs.filter((p) => p.senderId === senderId);
      if (same.some((p) => p.requestId === requestId)) return true;
      if (this.pendingSongs.length >= 16 || same.length >= 2) return false;
      const ipc = this.environment.ipc(),
        session = ipc?.peerSessionId(senderId);
      if (!session) return false;
      const requester = ipc?.peerLoginInfo(senderId)?.name ?? senderId;
      this.pendingSongs.push({
        id: String(++this.requestNonce),
        query,
        requester,
        requestId,
        senderId,
        session,
        roomId: state.roomId,
        created: this.environment.now(),
      });
      this.messageText = requester + ' requested a song. Accept or deny it in Requests.';
      return true;
    }
    if (!this.canQueueRequest()) return false;
    this.queries.push({ query, roomId: state.roomId });
    return true;
  }
  private canQueueRequest(): boolean {
    if (this.rooms.transferringLeadership) {
      this.messageText = 'Wait for the leadership transfer to finish.';
      return false;
    }
    if (this.queries.length >= 8) {
      this.messageText = 'The song lookup queue is full. Please wait a moment.';
      return false;
    }
    const state = this.rooms.state;
    if (
      !state ||
      state.queue.length + this.queries.length + (this.job === 'resolve' ? 1 : 0) >= 10
    ) {
      this.messageText = 'The radio queue is full (10 songs).';
      return false;
    }
    return true;
  }
  acceptRequest(id: string): void {
    this.expireRequests();
    if (!this.rooms.host || !this.available || !this.rooms.synchronized) return;
    const index = this.pendingSongs.findIndex((p) => p.id === id);
    if (index < 0 || !this.canQueueRequest()) return;
    const request = this.pendingSongs[index];
    if (!this.rooms.respondToRequest(request.senderId, request.requestId, 'accepted')) {
      this.messageText = "Couldn't accept that request yet. Try again shortly.";
      return;
    }
    this.pendingSongs.splice(index, 1);
    this.queries.push({ query: request.query, roomId: request.roomId });
    this.messageText = 'Accepted ' + request.requester + "'s song request. Waiting for lookup.";
  }
  denyRequest(id: string): void {
    this.expireRequests();
    if (!this.rooms.host || !this.rooms.synchronized) return;
    const index = this.pendingSongs.findIndex((p) => p.id === id);
    if (index < 0) return;
    const request = this.pendingSongs[index];
    if (!this.rooms.respondToRequest(request.senderId, request.requestId, 'denied')) {
      this.messageText = "Couldn't deny that request yet. Try again shortly.";
      return;
    }
    this.pendingSongs.splice(index, 1);
    this.messageText = 'Denied ' + request.requester + "'s song request.";
  }
  private expireRequests(): void {
    const state = this.rooms.state,
      ipc = this.environment.ipc(),
      now = this.environment.now();
    for (let i = this.pendingSongs.length - 1; i >= 0; i--) {
      const request = this.pendingSongs[i];
      const current =
        this.rooms.host &&
        state?.roomId === request.roomId &&
        ipc?.peerSessionId(request.senderId) === request.session &&
        this.rooms.requestIsPending(request.senderId, request.requestId);
      if (current && now - request.created < 120000) continue;
      this.pendingSongs.splice(i, 1);
      if (current) this.rooms.respondToRequest(request.senderId, request.requestId, 'expired');
    }
  }
  pauseOrResume(): void {
    if (this.available && this.rooms.state) {
      this.rooms.control(this.rooms.state.playing ? 'pause' : 'resume');
      this.tick();
    }
  }
  skip(): void {
    if (this.available) {
      this.rooms.control('next');
      this.tick();
    }
  }
  seek(position: number): void {
    if (this.available) {
      this.rooms.control('seek', position);
      this.tick();
    }
  }
  playTrack(index: number): void {
    if (this.available) {
      this.rooms.control('play', index);
      this.tick();
    }
  }
  removeTrack(index: number): void {
    if (this.available) {
      this.rooms.control('remove', index);
      this.tick();
    }
  }
  setQueueModes(shuffle: boolean, repeat: string, keep: boolean): void {
    if (this.available) this.rooms.control('modes', shuffle, repeat, keep);
  }
  setDJ(id: string, session: string, enabled: boolean): void {
    this.rooms.setDJ(id, session, enabled);
  }
  promoteLeader(id: string, session: string): void {
    this.messageText = this.rooms.promoteLeader(id, session)
      ? 'Transferring leadership...'
      : 'That player cannot become leader right now.';
  }
  kickPeer(id: string, session: string): void {
    this.messageText = this.rooms.kickPeer(id, session)
      ? this.rooms.status
      : 'That player cannot be removed right now.';
  }

  leave(): void {
    this.rooms.leave();
    this.cancelJob();
    this.queries = [];
    this.pendingSongs = [];
    this.roomKey = null;
    this.previousVideo = '';
    this.playbackRevision = -1;
    this.streamSources.clear();
    this.audio.clear();
    this.releaseMusic();
  }
  stop(): void {
    this.leave();
    this.transport.dispose();
    this.transport = this.environment.createTransport();
    this.files.clear();
    this.streamSources.clear();
    this.streamDisabled.clear();
    this.started = false;
    this.messageText = 'Radio stopped. Your normal music settings are restored.';
  }
  private clock(): number {
    const game = this.environment.game(),
      now = this.environment.now(),
      value = game?.networkServerTime;
    if (value !== undefined && Number.isFinite(value) && value > 0 && !game!.isLeaving) {
      this.clockOffset = value - now;
      this.clockObservedAt = now;
    }
    return Number.isFinite(this.clockOffset) && now - this.clockObservedAt < 60000
      ? this.clockOffset + now
      : NaN;
  }
  tick(): void {
    if (this.closed) return;
    try {
      this.transport.tick();
      if (this.transport.terminalFailure && this.rooms.joined) {
        this.messageText = this.transport.status;
        this.leave();
        return;
      }
      const ipc = this.environment.ipc(),
        info = ipc?.ownLoginInfo();
      if (info && this.account !== null && this.account !== info.id) {
        this.rooms.leave(true);
        this.stop();
        this.rooms.dispose();
        this.rooms = this.createRooms();
        this.files.clear();
        this.failedTracks.clear();
        this.streamSources.clear();
        this.streamDisabled.clear();
      }
      if (info) this.account = info.id;
      const game = this.environment.game();
      if (game?.me && info && game.me.id === info.id) this.rooms.setDisplayName(game.me.name);
      const now = this.clock();
      this.rooms.tick(ipc, now);
      let state = this.rooms.state;
      if (!state) {
        this.wasLeader = false;
        this.pendingSongs = [];
        if (this.roomKey !== null) {
          this.cancelJob();
          this.queries = [];
          this.audio.clear();
          this.releaseMusic();
          this.roomKey = null;
          this.streamSources.clear();
        }
        return;
      }
      if (this.roomKey !== state.roomId) {
        this.cancelJob();
        this.queries = [];
        this.pendingSongs = [];
        this.audio.clear();
        this.failedTracks.clear();
        this.roomKey = state.roomId;
        this.previousVideo = '';
        this.playbackRevision = -1;
      }
      if (this.wasLeader !== this.rooms.host) {
        this.wasLeader = this.rooms.host;
        this.pendingSongs = [];
        this.queries = [];
        if (this.job === 'resolve') this.cancelJob();
      }
      this.expireRequests();
      if (!this.ownsMusic) this.ownsMusic = this.environment.acquireMusic(this, () => this.leave());
      if (!this.available || !this.rooms.synchronized) {
        this.audio.pause();
        return;
      }
      const head = this.currentTrack(state);
      if (!head) {
        this.audio.clear();
        this.previousVideo = '';
        if (['stream', 'prepare', 'prefetch'].includes(this.job)) this.cancelJob();
      } else {
        if (this.failedTracks.has(head.videoId) && this.rooms.host) {
          this.audio.clear();
          this.rooms.removeTrack(state.currentIndex);
          return;
        }
        if (
          this.previousVideo !== head.videoId ||
          this.playbackRevision !== state.playbackRevision
        ) {
          this.audio.clear();
          this.previousVideo = head.videoId;
          this.playbackRevision = state.playbackRevision;
          if (
            ['prefetch', 'stream', 'prepare'].includes(this.job) &&
            this.jobVideo !== head.videoId
          )
            this.cancelJob();
        }
        const file = this.cached(head.videoId);
        if (this.audio.videoId !== head.videoId && !this.failedTracks.has(head.videoId)) {
          if (file) this.loadAudio(head, file);
          else if (this.streamSources.has(head.videoId) && !this.streamDisabled.has(head.videoId))
            this.loadStream(head, this.streamSources.get(head.videoId)!);
        }
        state = this.rooms.state!;
        this.audio.sync(
          this.rooms.expectedPosition(now),
          this.ownsMusic && state.playing && !state.buffering && now >= state.anchorAt,
          this.volume,
        );
        if (this.audio.ready && state.buffering)
          this.rooms.ready(head.videoId, state.playbackRevision);
      }
      if (!this.busy && this.job === '') this.schedule(state);
    } catch {
      this.audio.pause();
      this.messageText =
        'Radio encountered a problem. Stop Radio or retry setup; the game is unaffected.';
    }
  }
  private currentTrack(state: RadioState | null): RadioTrack | null {
    return state?.queue[state.currentIndex] ?? null;
  }
  private cached(id: string): PreparedRadioAudio | null {
    const file = this.files.get(id);
    if (!file) return null;
    if (!file.exists) {
      this.files.delete(id);
      return null;
    }
    return file;
  }
  private schedule(state: RadioState): void {
    const head = this.currentTrack(state);
    if (head && !this.cached(head.videoId) && !this.failedTracks.has(head.videoId)) {
      this.prepare(head, false);
      return;
    }
    if (this.queries.length && this.rooms.host && !this.rooms.transferringLeadership) {
      this.resolveNext();
      return;
    }
    if (state.queue.length > 1 && !state.shuffle) {
      const index = (state.currentIndex + 1) % state.queue.length;
      if (index === 0 && state.repeatMode !== 'all') return;
      const next = state.queue[index];
      if (!this.cached(next.videoId) && !this.failedTracks.has(next.videoId))
        this.prepare(next, true);
    }
  }
  private resolveNext(): void {
    const query = this.queries.shift()!;
    if (query.roomId !== this.rooms.state?.roomId) return;
    const attempt = ++this.generation;
    this.job = 'resolve';
    if (
      !this.transport.request(
        'resolve',
        { query: query.query },
        (reply) => {
          if (
            attempt !== this.generation ||
            !this.rooms.host ||
            this.rooms.state?.roomId !== query.roomId
          )
            return;
          this.job = '';
          if (this.rooms.transferringLeadership) {
            this.queries.unshift(query);
            return;
          }
          if (
            !/^[A-Za-z0-9_-]{11}$/.test(String(reply.videoId)) ||
            typeof reply.title !== 'string' ||
            !Number.isFinite(reply.durationMs) ||
            reply.durationMs! <= 0 ||
            reply.durationMs! > 1200000
          ) {
            this.messageText =
              'This song is unsupported (live streams and tracks over 20 minutes are excluded).';
            return;
          }
          const track = {
            videoId: reply.videoId!,
            title: reply.title.replace(/[\x00-\x1f\x7f]/g, ' ').slice(0, 96),
            durationMs: reply.durationMs!,
          };
          this.messageText = this.rooms.enqueueTrack(track)
            ? 'Queued: ' + track.title
            : 'The queue is full or the group changed.';
        },
        (reason) => {
          if (attempt === this.generation) {
            this.job = '';
            this.messageText = reason;
          }
        },
      )
    )
      this.job = '';
  }
  private prepare(track: RadioTrack, prefetch: boolean): void {
    const id = track.videoId,
      room = this.roomKey,
      attempt = ++this.generation;
    const progressive = !prefetch && !this.streamDisabled.has(id);
    this.job = prefetch ? 'prefetch' : progressive ? 'stream' : 'prepare';
    this.jobVideo = id;
    if (
      !this.transport.request(
        progressive ? 'stream' : 'prepare',
        { videoId: id },
        (reply) => {
          if (attempt !== this.generation || room !== this.roomKey) return;
          this.job = this.jobVideo = '';
          if (reply.videoId !== id) {
            this.trackFailed(id, 'Prepared audio belongs to a different song.');
            return;
          }
          const file = this.transport.preparedFile(reply.path);
          if (!file) {
            this.trackFailed(id, this.transport.preparedFileError);
            return;
          }
          this.files.set(id, file);
        },
        (reason) => {
          if (attempt !== this.generation || room !== this.roomKey) return;
          this.job = this.jobVideo = '';
          if (progressive) this.streamFailed(id);
          else this.trackFailed(id, reason);
        },
        (reply) => {
          if (
            attempt !== this.generation ||
            room !== this.roomKey ||
            reply.videoId !== id ||
            this.streamDisabled.has(id)
          )
            return;
          this.streamSources.set(id, { url: reply.url!, durationMs: reply.durationMs });
        },
      )
    )
      this.job = this.jobVideo = '';
  }
  private loadAudio(track: RadioTrack, file: PreparedRadioAudio): void {
    const id = track.videoId,
      room = this.roomKey,
      revision = this.rooms.state?.playbackRevision ?? -1;
    this.audio.load(
      id,
      file,
      () => {
        if (
          room === this.roomKey &&
          this.currentTrack(this.rooms.state)?.videoId === id &&
          this.rooms.state?.playbackRevision === revision
        )
          this.rooms.ready(id, revision);
      },
      (reason) => {
        if (room === this.roomKey && this.rooms.state?.playbackRevision === revision)
          this.trackFailed(id, reason);
      },
    );
  }
  private loadStream(track: RadioTrack, source: { url: string }): void {
    const id = track.videoId,
      room = this.roomKey,
      revision = this.rooms.state?.playbackRevision ?? -1;
    this.audio.loadStream(
      id,
      source.url,
      track.durationMs,
      this.rooms.expectedPosition(this.clock()),
      () => {
        if (
          room === this.roomKey &&
          this.currentTrack(this.rooms.state)?.videoId === id &&
          this.rooms.state?.playbackRevision === revision
        )
          this.rooms.ready(id, revision);
      },
      () => {
        if (room === this.roomKey && this.rooms.state?.playbackRevision === revision)
          this.streamFailed(id);
      },
    );
  }
  private streamFailed(id: string): void {
    this.streamDisabled.add(id);
    this.streamSources.delete(id);
    if (this.audio.videoId === id) this.audio.clear();
    this.messageText = 'Streaming unavailable; switching to the complete download.';
  }
  private trackFailed(id: string, reason: string): void {
    this.failedTracks.add(id);
    this.messageText = reason;
    const state = this.rooms.state;
    if (this.currentTrack(state)?.videoId === id) {
      this.audio.clear();
      if (this.rooms.host) this.rooms.removeTrack(state!.currentIndex);
    }
  }
  private cancelJob(): void {
    this.generation++;
    if (this.job === 'stream') this.streamSources.delete(this.jobVideo);
    this.transport.cancel();
    this.job = this.jobVideo = '';
  }
  private releaseMusic(): void {
    if (!this.ownsMusic) return;
    this.ownsMusic = false;
    try {
      this.environment.releaseMusic(this);
    } catch {
      /* Radio cannot interrupt normal music teardown. */
    }
  }
  dispose(): void {
    if (this.closed) return;
    this.closed = true;
    this.stopTimer();
    this.rooms.leave(true);
    this.leave();
    this.rooms.dispose();
    this.audio.dispose();
    this.transport.dispose();
  }
}
