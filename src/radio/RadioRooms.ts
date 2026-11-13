import type { IPCMessage, IPCValue } from '../ipc/ClientIPCCodec';
import { RadioControls, type RadioControlOutcome } from './RadioControls';
import { RadioDirectory } from './RadioDirectory';
import { RadioLeadership } from './RadioLeadership';
import { RadioMembership } from './RadioMembership';
import { RadioOutbox, type RadioPacketTransport } from './RadioOutbox';
import { RadioPassword } from './RadioPassword';
import { RadioQueue } from './RadioQueue';
import { RadioReadiness } from './RadioReadiness';
import { RadioRequests, type RadioRequestOutcome } from './RadioRequests';
import type { RadioPeer, RadioState, RadioTrack } from './RadioState';
import { RadioStateWire } from './RadioStateWire';

type RadioHandler = (message: IPCMessage, sender: string, name: string) => void;
export interface RadioRoomTransport extends RadioPacketTransport {
  readonly connected: boolean;
  readonly paused: boolean;
  readonly sessionId: string | null;
  ownLoginInfo(): { id: string; name?: string } | null;
  addMessageHandler(type: string, handler: RadioHandler): void;
  removeMessageHandler(type: string, handler: RadioHandler): void;
  addDisposeHandler(handler: () => void): void;
  removeDisposeHandler(handler: () => void): void;
}
const messageKinds = [
  'discover',
  'advertise',
  'join',
  'joinResult',
  'leave',
  'request',
  'requestResult',
  'state',
  'timeline',
  'close',
  'ready',
  'control',
  'controlResult',
  'handoff',
  'handoffReady',
  'leader',
  'takeover',
  'kick',
];

/** Session-owned original room coordination, independent of media preparation and its view. */
export class RadioRooms {
  private transport: RadioRoomTransport | null = null;
  private currentState: RadioState | null = null;
  private ownId = '';
  private ownSession = '';
  private hostSession = '';
  private ownName = '';
  private passwordKey = '';
  private joinAttempt = '';
  private roster: RadioPeer[] = [];
  private successorId = '';
  private successorSession = '';
  private elapsed = 0;
  private serverNow = 0;
  private clockReady = false;
  private wasOnline = false;
  private awaitingSnapshot = false;
  private minimumRevision = 0;
  private missingSince = -1;
  private joinedAt = 0;
  private nextJoin = 0;
  private nonce = 0;
  private closed = false;
  private lastTimer: number;
  private statusText = 'Radio is not connected.';
  private directory: RadioDirectory;
  private membership: RadioMembership;
  private outbox: RadioOutbox;
  private playback: RadioQueue;
  private readiness: RadioReadiness;
  private requests: RadioRequests;
  private controls: RadioControls;
  private leadership: RadioLeadership;
  onChange: (() => void) | null = null;
  onTrackRequest: ((query: string, sender: string, requestId: string | null) => boolean) | null =
    null;
  onRequestResult: ((id: string, outcome: RadioRequestOutcome) => void) | null = null;
  onControlResult: ((outcome: RadioControlOutcome) => void) | null = null;
  onNotice: ((message: string) => void) | null = null;

  constructor(
    private now: () => number = () => performance.now(),
    private random: () => number = Math.random,
  ) {
    this.lastTimer = now();
    const r = this;
    const shared = {
      get state() {
        return r.currentState;
      },
      get host() {
        return r.host;
      },
      get online() {
        return r.online;
      },
      get closed() {
        return r.closed;
      },
      get synchronized() {
        return r.synchronized;
      },
      get controller() {
        return r.controller;
      },
      get ownAuthority() {
        return r.ownAuthority;
      },
      get transferringLeadership() {
        return r.transferringLeadership;
      },
      get elapsed() {
        return r.elapsed;
      },
      get serverNow() {
        return r.serverNow;
      },
      get ownId() {
        return r.ownId;
      },
      get ownSession() {
        return r.ownSession;
      },
      get hostSession() {
        return r.hostSession;
      },
      get clockReady() {
        return r.clockReady;
      },
      get members() {
        return r.membership.members;
      },
      get transport() {
        return r.transport;
      },
      get joinAttempt() {
        return r.joinAttempt;
      },
      get awaitingSnapshot() {
        return r.awaitingSnapshot;
      },
      get successorId() {
        return r.successorId;
      },
      get successorSession() {
        return r.successorSession;
      },
      get handoffPending() {
        return r.leadership.pending;
      },
      get handoffOffer() {
        return r.leadership.offer;
      },
      get leadershipProof() {
        return r.leadership.proof;
      },
      get controlPending() {
        return r.controls.pending;
      },
      get passwordProtected() {
        return r.passwordKey !== '';
      },
      get memberCount() {
        return r.membership.members.size;
      },
      peerSessionId: (id: string) => r.transport?.peerSessionId(id) ?? null,
      queue: (...args: Parameters<RadioOutbox['queue']>) => r.outbox.queue(...args),
      changed: () => r.changed(),
      status: (message: string) => r.setStatus(message),
      publish: () => r.publish(false),
      advertiseSoon: () => r.directory.advertiseSoon(),
      sendSnapshot: (id: string) => r.sendSnapshot(id),
      clearRoom: (reason: string) => r.clearRoom(reason),
      nextNonce: () => ++r.nonce,
      isDJ: (id: string) => r.membership.isDJ(id),
      adoptLeader: (id: string, session: string, revision: number, keep: boolean) =>
        r.adoptLeader(id, session, revision, keep),
      awaitSnapshot: () => {
        r.awaitingSnapshot = true;
        r.joinedAt = r.elapsed;
        r.nextJoin = r.elapsed;
      },
    };
    const extend = <T extends object>(extra: T): typeof shared & T =>
      Object.assign(Object.create(shared), extra);
    this.directory = new RadioDirectory(shared);
    this.membership = new RadioMembership(
      extend({
        verifyPassword: (sender: string, session: string, proof: string) =>
          RadioPassword.matches(
            RadioPassword.proof(
              r.passwordKey,
              r.ownSession,
              r.currentState!.roomId,
              sender,
              session,
            ),
            proof,
          ),
        invalidateRequests: (id: string) => r.requests.invalidateMember(id),
        removeReadyPeer: (id: string) => r.readiness.removePeer(id),
        finishReadiness: () => r.readiness.finish(),
      }),
    );
    this.outbox = new RadioOutbox(
      extend({
        hasOutstandingRequest: (id: string) => r.requests.hasOutstanding(id),
        abandonRequest: (id: string) => r.requests.abandon(id),
        snapshotMessage: () => r.stateMessage(true),
        timelineMessage: () => r.stateMessage(false),
        readySent: (playback: number, session: string) => r.readiness.markSent(playback, session),
        cancelHandoff: () => r.leadership.cancel(),
      }),
    );
    this.playback = new RadioQueue(
      extend({
        resetReadiness: () => r.readiness.reset(),
        publish: (queueChanged: boolean) => r.publish(queueChanged, false),
      }),
      random,
    );
    this.readiness = new RadioReadiness(
      extend({
        publish: () => r.publish(false, false),
        queueReady: (target: string, message: IPCMessage, key: string) => {
          r.outbox.queue(target, message, key, true, 'ready');
        },
      }),
    );
    this.requests = new RadioRequests(
      extend({
        queue: (
          target: string,
          message: IPCMessage,
          key: string,
          kind: 'request' | 'requestResult',
        ) => r.outbox.queue(target, message, key, true, kind),
        onTrackRequest: (query: string, sender: string, id: string | null) =>
          r.onTrackRequest?.(query, sender, id) ?? false,
        onRequestResult: (id: string, outcome: RadioRequestOutcome) =>
          r.onRequestResult?.(id, outcome),
      }),
    );
    this.controls = new RadioControls(
      extend({ onControlResult: (outcome: RadioControlOutcome) => r.onControlResult?.(outcome) }),
      this.playback,
    );
    this.leadership = new RadioLeadership(shared);
  }

  private get online(): boolean {
    return !!this.transport?.connected && !this.transport.paused;
  }
  get host(): boolean {
    return !!this.currentState && this.currentState.hostId === this.ownId;
  }
  get joined(): boolean {
    return this.currentState !== null;
  }
  get synchronized(): boolean {
    return !this.closed && this.joined && this.online && this.clockReady && !this.awaitingSnapshot;
  }
  get transferringLeadership(): boolean {
    return this.leadership.pending !== null;
  }
  get controller(): boolean {
    return (
      this.synchronized && !this.transferringLeadership && (this.host || this.ownAuthority > 0)
    );
  }
  private get ownAuthority(): number {
    return (
      this.roster.find(
        (p) => p.id === this.ownId && p.session === this.ownSession && p.role === 'dj',
      )?.authority ?? 0
    );
  }
  get rooms() {
    return this.directory.rooms;
  }
  get state() {
    const state = this.currentState;
    return state
      ? {
          ...state,
          queue: state.queue.map(RadioStateWire.copyTrack),
          playing: this.synchronized && state.playing,
          waitingForPeers: this.readiness.waitingForPeers,
          waitingCount: this.readiness.waitingCount,
          waitingMs: this.readiness.waitingMs,
        }
      : null;
  }
  get telemetry() {
    const s = this.currentState,
      track = s?.queue[s.currentIndex];
    return s
      ? {
          group: s.name,
          title: track?.title ?? '',
          videoId: track?.videoId ?? '',
          playing: this.synchronized && s.playing && !s.buffering,
        }
      : null;
  }
  get peers(): RadioPeer[] {
    if (!this.currentState) return [];
    if (!this.host) return this.roster.map((p) => ({ ...p }));
    const name =
      this.ownName || this.transport?.ownLoginInfo()?.name || this.clean(this.ownId, 100);
    return [
      { id: this.ownId, session: this.ownSession, name, role: 'host', authority: 0 },
      ...Array.from(
        this.membership.members,
        ([id, m]): RadioPeer => ({
          id,
          session: m.session,
          name: m.name,
          role: m.dj ? 'dj' : 'listener',
          authority: m.authority,
        }),
      ),
    ];
  }
  get status(): string {
    if (this.joined && !this.clockReady) return 'Waiting for the game clock.';
    if (this.readiness.waitingForPeers)
      return `Waiting for ${this.readiness.waitingCount} listener(s), up to ${(this.readiness.waitingMs / 1000).toFixed(1)}s.`;
    if (
      !this.host &&
      this.synchronized &&
      this.currentState?.buffering &&
      this.readiness.guestReady
    )
      return 'Audio ready. Waiting for the leader to start.';
    return this.statusText;
  }
  get invitationKey(): string | null {
    return this.host && this.synchronized && !this.transferringLeadership ? this.passwordKey : null;
  }
  expectedPosition(time: number): number {
    return RadioStateWire.expectedPosition(this.currentState, this.synchronized, time);
  }
  setDisplayName(name: string): void {
    if (!this.validText(name, 100) || name === this.ownName) return;
    this.ownName = name;
    if (this.host && !this.transferringLeadership) this.publish(false);
  }
  refresh(): void {
    this.directory.refresh();
  }
  isDJ(id: string): boolean {
    return this.membership.isDJ(id);
  }
  setDJ(id: string, session: string, enabled: boolean): void {
    this.membership.setDJ(id, session, enabled);
  }
  kickPeer(id: string, session: string): boolean {
    return this.membership.kickPeer(id, session);
  }
  promoteLeader(id: string, session: string): boolean {
    return this.leadership.promoteLeader(id, session);
  }
  control(action: string, a: IPCValue = 0, b: IPCValue = false, c: IPCValue = false): boolean {
    return this.controls.control(action, a, b, c);
  }
  enqueueTrack(track: RadioTrack): boolean {
    return this.playback.enqueueTrack(track);
  }
  pause(): void {
    this.playback.pause();
  }
  resume(): void {
    this.playback.resume();
  }
  skip(): void {
    this.playback.skip();
  }
  seek(position: number): void {
    this.playback.seek(position);
  }
  playTrack(index: number): void {
    this.playback.playTrack(index);
  }
  removeTrack(index: number): void {
    this.playback.removeTrack(index);
  }
  setQueueModes(shuffle: boolean, repeat: 'off' | 'one' | 'all', keep: boolean): void {
    this.playback.setQueueModes(shuffle, repeat, keep);
  }
  ready(videoId: string, revision = -1): void {
    this.readiness.ready(videoId, revision);
  }
  requestTrack(query: string): boolean {
    return this.requests.requestTrack(query);
  }
  respondToRequest(sender: string, id: string, outcome: RadioRequestOutcome): boolean {
    return this.requests.respond(sender, id, outcome);
  }
  requestIsPending(sender: string, id: string): boolean {
    return this.requests.isPending(sender, id);
  }

  create(name: string, password = ''): void {
    if (!this.online || !this.ownId) {
      this.setStatus('Wait for the radio connection.');
      return;
    }
    if (!RadioPassword.valid(password)) {
      this.setStatus('Use a password of up to 64 characters, without line breaks.');
      return;
    }
    name = this.clean(name, 48);
    if (!name) {
      this.setStatus('Enter a radio room name.');
      return;
    }
    this.leave();
    this.hostSession = this.ownSession;
    this.currentState = this.emptyState(
      this.ownId,
      this.ownSession +
        '-' +
        (++this.nonce).toString(16) +
        '-' +
        Math.floor(this.random() * 0x7fffffff).toString(16),
      name,
      1,
    );
    this.passwordKey = RadioPassword.key(password, this.currentState.roomId);
    this.awaitingSnapshot = false;
    this.missingSince = -1;
    this.directory.advertiseSoon();
    this.setStatus('Leading ' + name + '.');
  }

  join(hostId: string, roomId: string, password = '', acceptedKey: string | null = null): void {
    if (!this.online) {
      this.setStatus('Wait for the radio connection.');
      return;
    }
    if (!RadioPassword.valid(password)) {
      this.setStatus('Use a password of up to 64 characters, without line breaks.');
      return;
    }
    const entry = this.directory.get(hostId);
    if (
      hostId === this.ownId ||
      !entry ||
      entry.roomId !== roomId ||
      this.elapsed - entry.seen > 65000 ||
      this.transport?.peerSessionId(hostId) !== entry.session
    ) {
      this.setStatus('That radio room is no longer available. Refresh the list.');
      return;
    }
    this.leave();
    this.hostSession = entry.session;
    this.currentState = this.emptyState(hostId, roomId, entry.name, -1);
    this.passwordKey =
      acceptedKey ?? (entry.passwordProtected ? RadioPassword.key(password, roomId) : '');
    this.joinAttempt = this.ownSession.slice(0, 80) + '-' + (++this.nonce).toString(16);
    this.minimumRevision = 0;
    this.awaitingSnapshot = true;
    this.joinedAt = this.elapsed;
    this.missingSince = -1;
    this.statusText = 'Joining ' + entry.name + '...';
    this.requestSnapshot();
    this.changed();
  }

  joinInvitation(id: string, session: string, room: string, name: string, key: string): boolean {
    if (
      !this.online ||
      this.transport?.peerSessionId(id) !== session ||
      !/^[A-Za-z0-9_-]{1,100}$/.test(room) ||
      !this.validText(name, 48) ||
      typeof key !== 'string' ||
      (key !== '' && !/^[a-f0-9]{64}$/.test(key))
    )
      return false;
    this.directory.set({
      hostId: id,
      hostName: id,
      roomId: room,
      name,
      count: 1,
      session,
      seen: this.elapsed,
      passwordProtected: key !== '',
    });
    this.join(id, room, '', key);
    return this.currentState?.hostId === id && this.currentState.roomId === room;
  }

  leave(handoff = false): void {
    const previous = this.currentState;
    if (!previous) return;
    if (handoff && this.host && this.membership.firstSuccessor()) {
      this.clearRoom('Radio leadership will pass to the first DJ.');
      return;
    }
    const wasHost = this.host,
      session = this.hostSession;
    this.clearRoom('Left the radio room.');
    if (this.online)
      this.outbox.queue(
        wasHost ? null : previous.hostId,
        {
          type: 'qipc3.radio.' + (wasHost ? 'close' : 'leave'),
          fields: wasHost
            ? [this.ownSession, previous.roomId]
            : [this.ownSession, previous.roomId, session],
        },
        (wasHost ? 'close:' : 'leave:') + previous.roomId,
      );
  }

  tick(ipc: RadioRoomTransport | null, serverTime: number): void {
    if (this.closed) return;
    const timer = this.now();
    this.elapsed += Math.max(0, timer - this.lastTimer);
    this.lastTimer = timer;
    if (this.transport !== ipc) this.attach(ipc);
    this.requests.expire();
    this.controls.expire();
    const previousClock = this.clockReady;
    this.clockReady = Number.isFinite(serverTime) && serverTime > 0;
    if (this.clockReady) this.serverNow = serverTime;
    this.leadership.expire();
    if (!this.online) {
      if (this.wasOnline) this.suspend('Radio connection lost. Waiting to reconnect.');
      this.wasOnline = false;
      if (this.joined && this.missingSince >= 0 && this.elapsed - this.missingSince >= 30000)
        this.clearRoom('Radio disconnected. Join again when connected.');
      return;
    }
    const session = this.transport!.sessionId!;
    if (!this.wasOnline || session !== this.ownSession) {
      if (session !== this.ownSession) this.requests.clear();
      const hostReconnected = this.host && !!this.ownSession && session !== this.ownSession;
      if (hostReconnected)
        this.clearRoom('Radio leader reconnected. Create a new room to continue.');
      this.ownSession = session;
      this.ownId = this.transport!.ownLoginInfo()?.id ?? '';
      this.wasOnline = true;
      this.outbox.clear();
      this.outbox.sendSoon();
      this.directory.discoverySoon();
      this.nextJoin = this.elapsed;
      if (this.joined && !this.host) {
        this.awaitingSnapshot = true;
        this.joinedAt = this.elapsed;
      } else if (!this.joined && !hostReconnected)
        this.statusText = 'Ready. Create or join a radio room.';
      if (this.host) {
        this.missingSince = -1;
        this.statusText = 'Leading ' + this.currentState!.name + '.';
        this.publish(false);
      }
      this.changed();
    }
    if (previousClock && !this.clockReady) {
      if (this.host) {
        this.freezeHost();
        this.publish(false);
      }
      this.changed();
    } else if (!previousClock && this.clockReady && this.joined) {
      if (this.host) this.publish(false);
      else {
        this.awaitingSnapshot = true;
        this.joinedAt = this.elapsed;
        this.nextJoin = this.elapsed;
      }
      this.changed();
    }
    this.directory.expire();
    this.requests.expireAdmissionTimes();
    if (this.joined && this.host) {
      this.membership.expire();
      if (!this.transferringLeadership) this.readiness.finish();
      const s = this.currentState!;
      if (
        !this.transferringLeadership &&
        this.clockReady &&
        !s.buffering &&
        s.playing &&
        s.queue.length &&
        this.expectedPosition(this.serverNow) >= s.queue[s.currentIndex].durationMs
      )
        this.playback.advanceTrack(true);
      this.directory.advertiseIfDue();
    } else if (this.currentState) {
      const observed = this.transport!.peerSessionId(this.currentState.hostId);
      if (observed !== this.hostSession && this.leadership.trySuccession()) {
        this.outbox.flush();
        return;
      }
      if (observed !== null && observed !== this.hostSession) {
        if (!this.successorId)
          this.clearRoom('The Radio leader reconnected. Join their new group to continue.');
        else {
          if (this.missingSince < 0) this.missingSince = this.elapsed;
          this.awaitingSnapshot = true;
          if (this.elapsed - this.missingSince >= 30000)
            this.clearRoom('No Radio leader is available. Join another group.');
        }
      } else if (observed === null || !this.directory.get(this.currentState.hostId)) {
        if (this.missingSince < 0) {
          this.missingSince = this.elapsed;
          this.joinedAt = this.elapsed;
          this.awaitingSnapshot = true;
          this.changed();
        }
        if (this.elapsed - this.missingSince >= 30000)
          this.clearRoom('The Radio leader is no longer connected.');
      } else {
        this.missingSince = -1;
        if (this.elapsed >= this.nextJoin) this.requestSnapshot();
        if (this.awaitingSnapshot && this.elapsed - this.joinedAt >= 30000)
          this.clearRoom('The Radio leader did not respond. Please join again.');
      }
    }
    this.outbox.flush();
  }

  private stateMessage(full: boolean): IPCMessage {
    return RadioStateWire.encode(
      this.currentState!,
      this.ownSession,
      this.peers,
      this.membership.firstSuccessor(),
      full,
    );
  }
  private sendSnapshot(id: string): void {
    this.outbox.queue(id, this.stateMessage(true), 'state:' + id, true, 'state');
  }
  private publish(queueChanged: boolean, increment = true): void {
    const s = this.currentState;
    if (!s) return;
    if (increment) {
      s.revision++;
      if (queueChanged) s.queueRevision++;
    }
    for (const id of this.membership.members.keys()) {
      if (queueChanged) this.sendSnapshot(id);
      else this.outbox.queue(id, this.stateMessage(false), 'timeline:' + id, true, 'timeline');
    }
    this.changed();
  }
  private requestSnapshot(): void {
    const s = this.currentState;
    if (!s || this.host) return;
    this.nextJoin = this.elapsed + (this.awaitingSnapshot ? 5000 : 20000);
    this.outbox.queue(
      s.hostId,
      {
        type: 'qipc3.radio.join',
        fields: [
          this.ownSession,
          s.roomId,
          this.hostSession,
          s.revision,
          this.awaitingSnapshot,
          RadioPassword.proof(
            this.passwordKey,
            this.hostSession,
            s.roomId,
            this.ownId,
            this.ownSession,
          ),
          this.joinAttempt,
        ],
      },
      'join',
      true,
      'join',
    );
  }
  private receive: RadioHandler = (message, sender, name) => {
    const f = message.fields;
    if (
      this.closed ||
      !this.online ||
      typeof f[0] !== 'string' ||
      this.transport?.peerSessionId(sender) !== f[0]
    )
      return;
    try {
      const kind = message.type.slice('qipc3.radio.'.length),
        s = this.currentState;
      if (kind === 'state' || kind === 'timeline') {
        const decoded = RadioStateWire.decode(message, sender, {
          current: s,
          host: this.host,
          hostSession: this.hostSession,
          minimumRevision: this.minimumRevision,
          awaitingSnapshot: this.awaitingSnapshot,
        });
        if (!decoded) return;
        if (decoded.kind === 'snapshotRequired') {
          if (!this.awaitingSnapshot) this.joinedAt = this.elapsed;
          this.minimumRevision = decoded.minimumRevision;
          this.awaitingSnapshot = true;
          this.nextJoin = Math.min(this.nextJoin, this.elapsed);
          this.changed();
          return;
        }
        if (decoded.resetReadiness) this.readiness.reset();
        this.roster = decoded.roster;
        this.successorId = decoded.successorId;
        this.successorSession = decoded.successorSession;
        this.currentState = decoded.state;
        this.minimumRevision = decoded.state.revision;
        this.awaitingSnapshot = false;
        this.missingSince = -1;
        this.nextJoin = this.elapsed + 20000;
        this.statusText = 'Listening to ' + decoded.state.name + '.';
        this.leadership.acknowledge();
        this.changed();
        return;
      }
      if (
        kind === 'joinResult' &&
        s &&
        !this.host &&
        this.awaitingSnapshot &&
        sender === s.hostId &&
        f.length === 5 &&
        f[0] === this.hostSession &&
        f[1] === s.roomId &&
        f[2] === this.ownSession &&
        f[3] === this.joinAttempt
      ) {
        if (f[4] === 'password')
          this.clearRoom('Incorrect radio group password. Enter the password and join again.');
        else if (f[4] === 'full') this.clearRoom('That radio group is full.');
        else if (f[4] === 'kicked') this.clearRoom('The leader removed you from the Radio group.');
        return;
      }
      if (
        kind === 'kick' &&
        s &&
        !this.host &&
        sender === s.hostId &&
        f.length === 3 &&
        f[0] === this.hostSession &&
        f[1] === s.roomId &&
        f[2] === this.ownSession
      ) {
        this.clearRoom('The leader removed you from the Radio group.');
        this.onNotice?.('The leader removed you from the Radio group.');
        return;
      }
      this.directory.receive(message, sender, name);
      this.membership.receive(message, sender, name);
      this.requests.receive(message, sender);
      this.controls.receive(message, sender);
      this.leadership.receive(message, sender);
      this.readiness.receive(message, sender);
    } catch {
      /* Match source: malformed or stale callbacks cannot interrupt other IPC consumers. */
    }
  };

  private adoptLeader(id: string, session: string, revision: number, keep: boolean): void {
    const s = this.currentState!;
    const entries = this.peers,
      oldHost = s.hostId;
    this.outbox.clear();
    this.requests.clear();
    this.readiness.reset();
    this.controls.clear();
    this.leadership.clear();
    this.successorId = this.successorSession = '';
    this.directory.remove(oldHost);
    this.roster = this.membership.adoptLeader(entries, oldHost, id, keep);
    s.hostId = id;
    this.hostSession = session;
    s.revision = revision + 1;
    this.minimumRevision = s.revision;
    this.missingSince = -1;
    this.joinedAt = this.elapsed;
    this.nextJoin = this.elapsed;
    this.directory.advertiseSoon();
    this.outbox.sendSoon();
    this.awaitingSnapshot = id !== this.ownId;
    this.joinAttempt = this.ownSession.slice(0, 80) + '-' + (++this.nonce).toString(16);
    this.directory.set({
      hostId: id,
      session,
      roomId: s.roomId,
      name: s.name,
      hostName: id,
      count: this.roster.length,
      seen: this.elapsed,
      passwordProtected: this.passwordKey !== '',
    });
    if (this.host) {
      this.statusText = 'You are now the Radio leader.';
      for (const member of this.membership.members.keys()) this.sendSnapshot(member);
    } else {
      this.statusText = 'Radio leader changed. Syncing playback...';
      this.requestSnapshot();
    }
    this.changed();
  }
  private freezeHost(): void {
    if (!this.host) return;
    const s = this.currentState!;
    s.positionMs = RadioStateWire.expectedPosition(s, true, this.serverNow);
    s.anchorAt = this.serverNow;
    s.playing = false;
    s.revision++;
  }
  private suspend(reason: string): void {
    this.freezeHost();
    this.outbox.clear(true);
    if (this.joined) {
      this.awaitingSnapshot = !this.host;
      this.missingSince = this.joinedAt = this.elapsed;
    }
    this.setStatus(reason);
  }
  private clearRoom(reason: string): void {
    this.readiness.reset();
    this.requests.clearRoom();
    this.currentState = null;
    this.hostSession = '';
    this.membership.clear();
    this.roster = [];
    this.controls.clear();
    this.leadership.clear();
    this.successorId = this.successorSession = this.passwordKey = this.joinAttempt = '';
    this.outbox.clear();
    this.awaitingSnapshot = false;
    this.minimumRevision = 0;
    this.missingSince = -1;
    this.setStatus(reason);
  }
  private attach(ipc: RadioRoomTransport | null): void {
    if (this.transport) {
      this.detach();
      this.clearRoom('Radio authentication changed. Join again to continue.');
    }
    this.transport = ipc;
    this.ownId = this.ownSession = '';
    this.wasOnline = false;
    this.directory.clear();
    this.outbox.clear();
    if (ipc) {
      for (const kind of messageKinds) ipc.addMessageHandler('qipc3.radio.' + kind, this.receive);
      ipc.addDisposeHandler(this.onTransportDisposed);
    }
  }
  private detach(): void {
    if (!this.transport) return;
    for (const kind of messageKinds)
      this.transport.removeMessageHandler('qipc3.radio.' + kind, this.receive);
    this.transport.removeDisposeHandler(this.onTransportDisposed);
  }
  private onTransportDisposed = () => {
    this.clearRoom('Radio session ended.');
    this.directory.clear();
    this.wasOnline = false;
  };
  dispose(): void {
    if (this.closed) return;
    this.leave(true);
    this.outbox.flush();
    this.detach();
    this.closed = true;
    this.transport = null;
    this.currentState = null;
    this.outbox.clear();
    this.directory.clear();
    this.onChange =
      this.onTrackRequest =
      this.onRequestResult =
      this.onControlResult =
      this.onNotice =
        null;
  }
  private emptyState(hostId: string, roomId: string, name: string, revision: number): RadioState {
    return {
      hostId,
      roomId,
      name,
      revision,
      queueRevision: revision,
      playbackRevision: revision < 0 ? -1 : 0,
      queue: [],
      playing: false,
      buffering: false,
      positionMs: 0,
      anchorAt: this.serverNow,
      currentIndex: 0,
      shuffle: false,
      repeatMode: 'off',
      keepFinished: false,
      playedMask: 0,
    };
  }
  private setStatus(text: string): void {
    this.statusText = text;
    this.changed();
  }
  private changed(): void {
    try {
      this.onChange?.();
    } catch {
      /* UI observer isolation. */
    }
  }
  private clean(value: string, max: number): string {
    return (value ?? '')
      .replace(/[\x00-\x1f\x7f]/g, ' ')
      .trim()
      .slice(0, max);
  }
  private validText(value: string, max: number): boolean {
    return (
      typeof value === 'string' &&
      value.length > 0 &&
      value.length <= max &&
      !/[\x00-\x1f\x7f]/.test(value)
    );
  }
}
