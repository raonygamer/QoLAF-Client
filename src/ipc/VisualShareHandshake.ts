import type { IPCMessage } from './ClientIPCCodec';
import { ClientIPCService } from './ClientIPCService';
import { ClientIPCQueue } from './ClientIPCQueue';
import { VisualShareWire } from './VisualShareWire';
import { VisualShareState } from './VisualShareState';

interface QueryRequest {
  nonce: string;
  epoch: number;
  sent: boolean;
  deadline: number;
}
interface WriteJob {
  key: string;
  state: PeerState;
  epoch: number;
  deadline: number;
}
interface PeerState {
  id: string;
  session: string | null;
  localSession: string | null;
  epoch: number;
  remoteScene: string | null;
  retiredScenes: string[];
  needsQuery: boolean;
  retries: number;
  queryAfter: number;
  queryUntil: number;
  request: QueryRequest | null;
  job: WriteJob | null;
  replyNonce: string | null;
  replyUntil: number;
  replyAfter: number;
  lastQueryNonce: string | null;
  lastReplyAt: number;
  shareHash: string | null;
  shareUntil: number;
  shareAfter: number;
  shareAttempts: number;
}
export interface VisualShareEnvironment {
  now(): number;
  random(): number;
  md5(text: string): string;
  interval(callback: () => void, milliseconds: number): () => void;
}

/** Scene-owned source hash negotiation; IPC retains transport and identity ownership. */
export class VisualShareHandshake {
  private static readonly query = 'qipc3.visual.hashQuery';
  private static readonly reply = 'qipc3.visual.hashReply';
  private static localSession: string | null = null;
  private static negotiated = new Map<string, string>();
  private states = new Map<string, PeerState>();
  private writes = new Map<string, WriteJob>();
  private pending = 0;
  private disposed = false;
  private wasConnected: boolean;
  private sequence = 0;
  private seed: string;
  private stopTimer: () => void;

  constructor(
    private ipc: ClientIPCService,
    private createShare: () => IPCMessage | null,
    private savedHash: (id: string) => string,
    private permitsShare: (id: string) => boolean,
    private environment: VisualShareEnvironment,
  ) {
    this.seed = environment
      .md5(environment.random() + ':' + environment.now() + ':' + environment.random())
      .toLowerCase();
    this.wasConnected = ipc.connected;
    this.syncCache();
    ipc.addMessageHandler(VisualShareHandshake.query, this.onQuery);
    ipc.addMessageHandler(VisualShareHandshake.reply, this.onReply);
    ipc.addPeerHandler(this.onPeer);
    for (const peer of ipc.onlinePlayers) if (!this.negotiated(peer.id)) this.onPeer(peer.id);
    this.stopTimer = environment.interval(() => this.tick(), 250);
  }

  private now(): number {
    return this.environment.now();
  }
  private syncCache(): void {
    if (VisualShareHandshake.localSession === this.ipc.sessionId) return;
    VisualShareHandshake.localSession = this.ipc.sessionId;
    VisualShareHandshake.negotiated.clear();
  }
  private negotiated(id: string): boolean {
    this.syncCache();
    const remote = this.ipc.peerSessionId(id);
    return remote != null && VisualShareHandshake.negotiated.get(id) === remote;
  }
  private markNegotiated(state: PeerState): void {
    this.syncCache();
    const remote = this.ipc.peerSessionId(state.id);
    if (remote && state.session === remote && state.localSession === this.ipc.sessionId)
      VisualShareHandshake.negotiated.set(state.id, remote);
  }
  private current(): boolean {
    return !this.disposed && this.ipc === ClientIPCService.instance && this.ipc.connected;
  }
  private knownPeer(id: string): boolean {
    return this.current() && id.length > 0 && id.length <= 128 && this.ipc.findPeer(id)?.id === id;
  }
  private stateFor(id: string): PeerState | null {
    let state = this.states.get(id);
    if (state) {
      if (
        this.knownPeer(id) &&
        (state.session !== this.ipc.peerSessionId(id) || state.localSession !== this.ipc.sessionId)
      ) {
        state.session = this.ipc.peerSessionId(id);
        state.localSession = this.ipc.sessionId;
        state.remoteScene = null;
        state.retiredScenes = [];
        state.lastQueryNonce = state.replyNonce = null;
        this.beginRound(state);
      }
      return state;
    }
    if (!this.knownPeer(id) || this.states.size >= 512) return null;
    state = {
      id,
      session: this.ipc.peerSessionId(id),
      localSession: this.ipc.sessionId,
      epoch: 0,
      remoteScene: null,
      retiredScenes: [],
      needsQuery: false,
      retries: 0,
      queryAfter: 0,
      queryUntil: 0,
      request: null,
      job: null,
      replyNonce: null,
      replyUntil: 0,
      replyAfter: 0,
      lastQueryNonce: null,
      lastReplyAt: -1000,
      shareHash: null,
      shareUntil: 0,
      shareAfter: 0,
      shareAttempts: 0,
    };
    this.states.set(id, state);
    return state;
  }
  private onPeer = (id: string): void => {
    if (!this.knownPeer(id) || this.negotiated(id)) return;
    this.prunePeers();
    const state = this.stateFor(id);
    if (state) this.beginRound(state);
  };
  private beginRound(state: PeerState): void {
    state.epoch++;
    this.clearRequest(state);
    this.releaseWrite(state.job);
    state.needsQuery = true;
    state.retries = state.queryAfter = state.queryUntil = state.shareAttempts = 0;
    state.shareHash = null;
  }
  private onQuery = (message: IPCMessage, id: string): void => {
    const nonce = message.fields[0];
    if (
      !this.knownPeer(id) ||
      message.type !== VisualShareHandshake.query ||
      message.fields.length !== 1 ||
      !VisualShareState.validHash(nonce)
    )
      return;
    const state = this.stateFor(id);
    if (!state || state.lastQueryNonce === nonce) return;
    const scene = nonce.slice(0, 16);
    if (state.remoteScene !== scene) {
      if (state.retiredScenes.includes(scene)) return;
      if (state.remoteScene != null) {
        state.retiredScenes.push(state.remoteScene);
        if (state.retiredScenes.length > 16) state.retiredScenes.shift();
      }
      state.remoteScene = scene;
      this.beginRound(state);
    }
    state.lastQueryNonce = state.replyNonce = nonce;
    state.replyUntil = this.now() + ClientIPCQueue.maxQueueMs + 30000;
  };
  private onReply = (message: IPCMessage, id: string): void => {
    const [nonce, hash, allowed] = message.fields;
    if (
      !this.knownPeer(id) ||
      message.type !== VisualShareHandshake.reply ||
      message.fields.length !== 3 ||
      !VisualShareState.validHash(nonce) ||
      typeof hash !== 'string' ||
      (hash !== '' && !VisualShareState.validHash(hash)) ||
      typeof allowed !== 'boolean'
    )
      return;
    const state = this.states.get(id),
      request = state?.request;
    if (
      !state ||
      !request ||
      !this.validState(state, request.epoch) ||
      !request.sent ||
      request.nonce !== nonce ||
      this.now() > request.deadline
    )
      return;
    this.clearRequest(state);
    if (!allowed || this.ownShare()?.hash === hash) {
      this.markNegotiated(state);
      return;
    }
    state.shareHash = hash;
    state.shareUntil = this.now() + ClientIPCQueue.maxQueueMs + 30000;
    state.shareAfter = 0;
  };

  private tick(): void {
    if (this.disposed) return;
    if (this.ipc !== ClientIPCService.instance) {
      this.dispose();
      return;
    }
    const now = this.now();
    if (!this.current()) {
      if (this.wasConnected) this.clearWork();
      this.wasConnected = false;
      return;
    }
    this.wasConnected = true;
    this.prunePeers();
    for (const state of this.states.values()) {
      if (state.request && now >= state.request.deadline) {
        this.clearRequest(state);
        this.retryQuery(state);
      }
      if (state.replyNonce != null && now >= state.replyUntil) state.replyNonce = null;
      if (state.shareHash != null && now >= state.shareUntil) state.shareHash = null;
      if (state.needsQuery && state.queryUntil > 0 && now >= state.queryUntil)
        state.needsQuery = false;
    }
    for (const job of this.writes.values()) if (now >= job.deadline) this.releaseWrite(job);
    if (this.ipc.paused) return;
    let attempts = 0;
    for (const state of this.states.values()) {
      if (this.writes.size >= 8 || attempts >= 8) break;
      if (
        !state.job &&
        state.replyNonce != null &&
        now >= state.replyAfter &&
        now - state.lastReplyAt >= 1000
      ) {
        attempts++;
        this.sendReply(state);
      }
    }
    for (const state of this.states.values()) {
      if (this.writes.size >= 8 || attempts >= 8) break;
      if (!state.job && state.shareHash != null && now >= state.shareAfter) {
        attempts++;
        this.sendShare(state);
      }
    }
    for (const state of this.states.values()) {
      if (this.writes.size >= 8 || this.pending >= 8 || attempts >= 8) break;
      if (!state.job && !state.request && state.needsQuery && now >= state.queryAfter) {
        attempts++;
        this.sendQuery(state);
      }
    }
  }

  private sendQuery(state: PeerState): void {
    if (!this.knownPeer(state.id) || !this.ownShare()) return;
    if (state.queryUntil <= 0) state.queryUntil = this.now() + ClientIPCQueue.maxQueueMs + 30000;
    state.needsQuery = false;
    const request: QueryRequest = {
      nonce: this.seed.slice(0, 16) + this.nextNonce().slice(0, 16),
      epoch: state.epoch,
      sent: false,
      deadline: this.now() + ClientIPCQueue.maxQueueMs + 30000,
    };
    state.request = request;
    this.pending++;
    const job = this.reserveWrite(state);
    const message: IPCMessage = { type: VisualShareHandshake.query, fields: [request.nonce] };
    const queued = this.ipc.send(state.id, message, {
      onSent: () => {
        this.releaseWrite(job);
        if (!this.validState(state, request.epoch) || state.request !== request) return;
        request.sent = true;
        request.deadline = this.now() + 30000;
      },
      onError: (reason) => {
        this.releaseWrite(job);
        if (state.request !== request) return;
        this.clearRequest(state);
        if (!this.validState(state, request.epoch)) return;
        if (reason === 'IPC send queue is full.') {
          if (this.now() < state.queryUntil) {
            state.needsQuery = true;
            state.queryAfter = this.now() + 1000;
          }
        } else this.retryQuery(state);
      },
      beforeSend: () => (this.validWrite(job) && state.request === request ? message : null),
    });
    if (!queued) this.releaseWrite(job);
  }
  private retryQuery(state: PeerState): void {
    if (state.retries >= 1) return;
    state.retries++;
    state.needsQuery = true;
    state.queryAfter = this.now() + 1000;
    state.queryUntil = this.now() + ClientIPCQueue.maxQueueMs + 30000;
  }
  private sendReply(state: PeerState): void {
    const nonce = state.replyNonce!,
      deadline = state.replyUntil;
    state.replyNonce = null;
    const job = this.reserveWrite(state);
    const queued = this.ipc.send(
      state.id,
      { type: VisualShareHandshake.reply, fields: [nonce, '', false] },
      {
        onSent: () => this.releaseWrite(job),
        onError: () => {
          this.releaseWrite(job);
          if (
            this.validState(state, job.epoch) &&
            state.lastQueryNonce === nonce &&
            this.now() < deadline &&
            state.replyNonce == null
          ) {
            state.replyNonce = nonce;
            state.replyUntil = deadline;
            state.replyAfter = this.now() + 1000;
          }
        },
        beforeSend: () => {
          if (!this.validWrite(job) || state.lastQueryNonce !== nonce || this.now() > deadline)
            return null;
          try {
            const hash = this.savedHash(state.id),
              allowed = this.permitsShare(state.id);
            if (!this.validWrite(job)) return null;
            state.lastReplyAt = this.now();
            return {
              type: VisualShareHandshake.reply,
              fields: [nonce, VisualShareState.validHash(hash) ? hash : '', allowed === true],
            };
          } catch {
            return null;
          }
        },
      },
    );
    if (!queued) this.releaseWrite(job);
  }
  private sendShare(state: PeerState): void {
    const remoteHash = state.shareHash!,
      deadline = state.shareUntil,
      own = this.ownShare();
    if (!own) return;
    state.shareHash = null;
    if (own.hash === remoteHash || state.shareAttempts >= 3) return;
    state.shareAttempts++;
    const job = this.reserveWrite(state);
    let unnecessary = false;
    const queued = this.ipc.send(state.id, own.message, {
      onSent: () => {
        this.releaseWrite(job);
        if (this.validState(state, job.epoch)) this.verifyShare(state, 2000);
      },
      onError: (reason) => {
        this.releaseWrite(job);
        if (!this.validState(state, job.epoch) || unnecessary) return;
        if (reason === 'IPC send queue is full.') {
          state.shareAttempts--;
          if (this.now() < deadline && state.shareHash == null) {
            state.shareHash = remoteHash;
            state.shareUntil = deadline;
            state.shareAfter = this.now() + 1000;
          }
        } else if (state.shareAttempts < 3 && this.now() < deadline) this.verifyShare(state, 1000);
      },
      beforeSend: () => {
        if (!this.validWrite(job) || this.now() > deadline) return null;
        const fresh = this.ownShare();
        if (!this.validWrite(job) || !fresh) return null;
        unnecessary = fresh.hash === remoteHash;
        return unnecessary ? null : fresh.message;
      },
    });
    if (!queued) this.releaseWrite(job);
  }
  private verifyShare(state: PeerState, delay: number): void {
    this.clearRequest(state);
    state.needsQuery = true;
    state.retries = 0;
    state.queryAfter = this.now() + delay;
    state.queryUntil = 0;
  }
  private ownShare(): { message: IPCMessage; hash: string } | null {
    if (!this.current()) return null;
    try {
      const message = this.createShare();
      if (!message || !this.current()) return null;
      const decoded = VisualShareWire.decode(message);
      if (!decoded || decoded.sessionId !== this.ipc.sessionId) return null;
      const hash = VisualShareState.hash(decoded.state, (text) => this.environment.md5(text));
      return hash ? { message, hash } : null;
    } catch {
      return null;
    }
  }
  private reserveWrite(state: PeerState): WriteJob {
    const job = {
      key: this.nextNonce(),
      state,
      epoch: state.epoch,
      deadline: this.now() + ClientIPCQueue.maxQueueMs + 180000,
    };
    this.writes.set(job.key, job);
    state.job = job;
    return job;
  }
  private releaseWrite(job: WriteJob | null): void {
    if (!job || this.writes.get(job.key) !== job) return;
    this.writes.delete(job.key);
    if (job.state.job === job) job.state.job = null;
  }
  private validState(state: PeerState, epoch: number): boolean {
    return (
      this.current() &&
      this.states.get(state.id) === state &&
      state.epoch === epoch &&
      this.knownPeer(state.id) &&
      state.session === this.ipc.peerSessionId(state.id) &&
      state.localSession === this.ipc.sessionId
    );
  }
  private validWrite(job: WriteJob): boolean {
    return (
      !this.disposed &&
      this.writes.get(job.key) === job &&
      this.now() < job.deadline &&
      this.validState(job.state, job.epoch)
    );
  }
  private clearRequest(state: PeerState): void {
    if (!state.request) return;
    state.request = null;
    if (this.states.get(state.id) === state) this.pending--;
  }
  private prunePeers(): void {
    for (const [id, state] of this.states)
      if (!this.knownPeer(id)) {
        this.clearRequest(state);
        this.states.delete(id);
      }
  }
  private clearWork(): void {
    this.states.clear();
    this.writes.clear();
    this.pending = 0;
  }
  private nextNonce(): string {
    return this.environment.md5(this.seed + ':' + ++this.sequence + ':' + this.now()).toLowerCase();
  }
  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.stopTimer();
    this.ipc.removeMessageHandler(VisualShareHandshake.query, this.onQuery);
    this.ipc.removeMessageHandler(VisualShareHandshake.reply, this.onReply);
    this.ipc.removePeerHandler(this.onPeer);
    this.clearWork();
  }
}
