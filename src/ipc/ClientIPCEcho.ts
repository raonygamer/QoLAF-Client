import { ClientIPCCodec, type IPCMessage } from './ClientIPCCodec';
import { ClientIPCPolicy } from './ClientIPCPolicy';
import { ClientIPCQueue } from './ClientIPCQueue';
import { ClientIPCService, type IPCEnvironment } from './ClientIPCService';

export type ClientEchoEvent =
  | { kind: 'start'; expected: number }
  | { kind: 'end'; count: number }
  | { kind: 'error'; message: string }
  | {
      kind: 'reply';
      id: string;
      name: string;
      version: string;
      build: string;
      compatibility: number;
      gameProtocol: number;
      packetVersion: number;
      discoverySchema: number;
      elapsedMs: number;
    };
type Report = (event: ClientEchoEvent) => void;
interface Request {
  nonce: string;
  session: string;
  report: Report;
  seen: Set<string>;
  expected: number;
  sentAt: number;
  deadline: number;
  retryAt: number;
  retried: boolean;
}
interface QueryRecord {
  at: number;
  attempts: number;
  lastSentAt: number;
}
interface ReplyJob {
  key: string;
  record: QueryRecord;
  id: string;
  nonce: string;
  remoteSession: string;
  localSession: string;
  deadline: number;
  after: number;
  queued: boolean;
  finished: boolean;
}

/** Source QIPC version query. Only the requester presents results to chat. */
export class ClientIPCEcho {
  private static readonly query = 'qipc3.client.echoQuery';
  private static readonly reply = 'qipc3.client.echoReply';
  private static singleton: ClientIPCEcho | null = null;
  private pending: Request | null = null;
  private jobs: ReplyJob[] = [];
  private readonly lastQueries = new Map<string, QueryRecord>();
  private readonly peerCooldowns = new Map<
    string,
    {
      at: number;
      remoteSession: string;
      localSession: string;
    }
  >();
  private nextRequest = 0;
  private stopTimer: (() => void) | null = null;
  private disposed = false;

  private constructor(
    private readonly ipc: ClientIPCService,
    private readonly compatibility: number,
    private readonly gameProtocol: number,
    private readonly environment: Pick<IPCEnvironment, 'now' | 'interval' | 'random'>,
    private readonly md5: (text: string) => string,
  ) {
    ipc.addMessageHandler(ClientIPCEcho.query, this.onQuery);
    ipc.addMessageHandler(ClientIPCEcho.reply, this.onReply);
    ipc.addDisposeHandler(this.dispose);
  }

  static get instance(): ClientIPCEcho | null {
    return this.singleton;
  }
  static ensure(
    ipc: ClientIPCService | null,
    compatibility: number,
    gameProtocol: number,
    environment: Pick<IPCEnvironment, 'now' | 'interval' | 'random'>,
    md5: (text: string) => string,
  ): ClientIPCEcho | null {
    if (this.singleton && this.singleton.ipc !== ipc) this.singleton.dispose();
    if (ipc && !this.singleton)
      this.singleton = new ClientIPCEcho(ipc, compatibility, gameProtocol, environment, md5);
    return this.singleton;
  }

  private current(): boolean {
    return !this.disposed && this.ipc === ClientIPCService.instance && this.ipc.connected;
  }
  private startTimer(): void {
    this.stopTimer ??= this.environment.interval(() => this.tick(), 250);
  }
  private emit(report: Report, event: ClientEchoEvent): void {
    try {
      report(event);
    } catch {
      /* Presentation cannot interrupt transport cleanup. */
    }
  }

  request(report: Report): void {
    const now = this.environment.now();
    const error = (message: string) => this.emit(report, { kind: 'error', message });
    const session = this.ipc.sessionId;
    if (!this.current() || this.ipc.paused || !session) return error('Client IPC is not ready.');
    if (this.pending) return error('A client check is already running.');
    if (now < this.nextRequest)
      return error(
        'Wait ' + Math.ceil((this.nextRequest - now) / 1000) + 's before using /spececho again.',
      );
    const request: Request = {
      nonce: this.md5(this.environment.random() + ':' + now)
        .slice(0, 12)
        .toLowerCase(),
      session,
      report,
      seen: new Set(),
      expected: this.ipc.onlinePlayers.length,
      sentAt: -1,
      deadline: now + ClientIPCQueue.maxQueueMs,
      retryAt: 0,
      retried: false,
    };
    this.pending = request;
    this.nextRequest = now + 5000;
    this.startTimer();
    this.sendQuery(request, false);
  }

  private sendQuery(request: Request, retry: boolean): void {
    const message: IPCMessage = {
      type: ClientIPCEcho.query,
      fields: [request.nonce, request.session],
    };
    const queued = this.ipc.broadcast(message, {
      onSent: () => {
        if (
          this.pending !== request ||
          !this.current() ||
          this.ipc.sessionId !== request.session ||
          retry
        )
          return;
        request.sentAt = this.environment.now();
        request.deadline = request.sentAt + 20000;
        request.retryAt = request.sentAt + 6000;
        this.emit(request.report, { kind: 'start', expected: request.expected });
      },
      onError: () => {
        if (!retry && this.pending === request)
          this.finish('The IPC client check could not be sent.');
      },
      beforeSend: () =>
        this.current() &&
        this.pending === request &&
        this.ipc.sessionId === request.session &&
        this.environment.now() < request.deadline
          ? message
          : null,
    });
    if (!queued && !retry && this.pending === request)
      this.finish('The IPC client check could not be queued.');
  }

  private readonly onQuery = (message: IPCMessage, id: string): void => {
    const [nonce, remoteSession] = message.fields;
    const localSession = this.ipc.sessionId;
    if (
      !this.current() ||
      !localSession ||
      message.fields.length !== 2 ||
      typeof nonce !== 'string' ||
      typeof remoteSession !== 'string' ||
      !ClientIPCCodec.validId(nonce) ||
      remoteSession !== this.ipc.peerSessionId(id)
    )
      return;
    const now = this.environment.now();
    const key = id.length + ':' + id + ':' + remoteSession + ':' + localSession + ':' + nonce;
    for (const [old, record] of this.lastQueries)
      if (now - record.at > 60000) this.lastQueries.delete(old);
    for (const [old, record] of this.peerCooldowns)
      if (now - record.at > 60000) this.peerCooldowns.delete(old);
    const cooldown = this.peerCooldowns.get(id);
    if (
      cooldown &&
      cooldown.remoteSession === remoteSession &&
      cooldown.localSession === localSession &&
      now - cooldown.at < 5000
    )
      return;
    let record = this.lastQueries.get(key);
    if ((record && record.attempts >= 2) || (!record && this.lastQueries.size >= 512)) return;
    if (
      this.jobs.some((job) => job.key === key && !job.finished && this.validJob(job)) ||
      this.jobs.length >= 32
    )
      return;
    if (!record) {
      record = { at: now, attempts: 0, lastSentAt: -5000 };
      this.lastQueries.set(key, record);
    }
    record.at = now;
    record.attempts++;
    this.peerCooldowns.set(id, { at: now, remoteSession, localSession });
    this.jobs.push({
      key,
      record,
      id,
      nonce,
      remoteSession,
      localSession,
      deadline: now + 20000,
      after: Math.max(now, record.lastSentAt + 5000),
      queued: false,
      finished: false,
    });
    this.startTimer();
    this.pumpReplies();
  };

  private validJob(job: ReplyJob): boolean {
    return (
      this.current() &&
      this.environment.now() < job.deadline &&
      this.ipc.sessionId === job.localSession &&
      this.ipc.peerSessionId(job.id) === job.remoteSession
    );
  }
  private sendReply(job: ReplyJob): void {
    const info = this.ipc.ownLoginInfo();
    if (!info) {
      job.finished = true;
      return;
    }
    job.queued = true;
    job.after = this.environment.now() + 1000;
    const message: IPCMessage = {
      type: ClientIPCEcho.reply,
      fields: [
        job.nonce,
        job.remoteSession,
        job.localSession,
        info.version,
        info.build,
        this.compatibility,
        this.gameProtocol,
        ClientIPCCodec.packetVersion,
        ClientIPCService.discoverySchema,
      ],
    };
    const accepted = this.ipc.send(job.id, message, {
      onSent: () => {
        job.finished = true;
        if (this.lastQueries.get(job.key) === job.record)
          job.record.lastSentAt = this.environment.now();
      },
      onError: () => {
        job.queued = false;
        if (!this.validJob(job)) job.finished = true;
      },
      beforeSend: () => (this.validJob(job) ? message : null),
    });
    if (!accepted) job.queued = false;
  }
  private pumpReplies(): void {
    let attempts = 0;
    for (let index = this.jobs.length - 1; index >= 0; index--) {
      const job = this.jobs[index];
      if (job.finished || !this.validJob(job)) {
        this.jobs.splice(index, 1);
        continue;
      }
      if (job.queued || this.environment.now() < job.after || attempts >= 8) continue;
      attempts++;
      this.sendReply(job);
    }
  }

  private readonly onReply = (message: IPCMessage, id: string, name: string): void => {
    const request = this.pending;
    const fields = message.fields;
    if (
      !this.current() ||
      !request ||
      request.sentAt < 0 ||
      this.environment.now() >= request.deadline ||
      request.session !== this.ipc.sessionId ||
      fields.length !== 9 ||
      fields.slice(0, 5).some((field) => typeof field !== 'string')
    )
      return;
    if (
      fields[0] !== request.nonce ||
      fields[1] !== request.session ||
      fields[2] !== this.ipc.peerSessionId(id) ||
      request.seen.has(id) ||
      request.seen.size >= 512
    )
      return;
    const version = fields[3],
      build = fields[4];
    const info = this.ipc.peerLoginInfo(id);
    if (
      !ClientIPCPolicy.validVersion(version) ||
      !ClientIPCPolicy.validBuild(build) ||
      (info && (info.version !== version || info.build !== build))
    )
      return;
    if (
      fields
        .slice(5)
        .some(
          (value) =>
            typeof value !== 'number' ||
            !Number.isInteger(value) ||
            value < 0 ||
            value > 2147483647,
        )
    )
      return;
    request.seen.add(id);
    this.emit(request.report, {
      kind: 'reply',
      id,
      name,
      version,
      build,
      compatibility: fields[5] as number,
      gameProtocol: fields[6] as number,
      packetVersion: fields[7] as number,
      discoverySchema: fields[8] as number,
      elapsedMs: Math.round(this.environment.now() - request.sentAt),
    });
  };

  private tick(): void {
    const request = this.pending;
    if (request && (!this.current() || request.session !== this.ipc.sessionId))
      this.finish('Client IPC reconnected; run /spececho again.');
    else if (request && this.environment.now() >= request.deadline)
      this.finish(request.sentAt < 0 ? 'The IPC client check could not be sent in time.' : null);
    else if (
      request &&
      request.sentAt >= 0 &&
      !request.retried &&
      this.environment.now() >= request.retryAt
    ) {
      request.retried = true;
      this.sendQuery(request, true);
    }
    this.pumpReplies();
    if (!this.pending && !this.jobs.length) {
      this.stopTimer?.();
      this.stopTimer = null;
    }
  }
  private finish(error: string | null): void {
    const request = this.pending;
    this.pending = null;
    if (request)
      this.emit(
        request.report,
        error ? { kind: 'error', message: error } : { kind: 'end', count: request.seen.size },
      );
  }
  readonly dispose = (): void => {
    if (ClientIPCEcho.singleton === this) ClientIPCEcho.singleton = null;
    this.disposed = true;
    this.stopTimer?.();
    this.stopTimer = null;
    this.ipc.removeDisposeHandler(this.dispose);
    this.ipc.removeMessageHandler(ClientIPCEcho.query, this.onQuery);
    this.ipc.removeMessageHandler(ClientIPCEcho.reply, this.onReply);
    this.pending = null;
    this.jobs = [];
    this.lastQueries.clear();
    this.peerCooldowns.clear();
  };
}
