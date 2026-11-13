import type { Artifact } from '../game/Bindings';
import { read, type Raw } from '../api/Types';
import { ChatArtifactLinkData } from './ChatArtifactLinkData';
import { ChatArtifactToken } from './rich/ChatArtifactToken';
import { ChatArtifactTokenRegistry } from './rich/ChatArtifactTokenRegistry';

type Result = ChatArtifactLinkData | null;
type Callback = (data: Result) => void;

class ArtifactCache {
  readonly players = new Map<string, Raw>();
  readonly playerFailures = new Map<string, number>();
  readonly artifacts = new Map<string, ChatArtifactLinkData>();
  readonly failures = new Map<string, number>();
  constructor(
    readonly owner: string,
    readonly registry = new ChatArtifactTokenRegistry(),
  ) {}
}

/** Source two-stage BigDB lookup, bounded session caches, and verified label projection. */
export class ChatArtifactLinkResolver {
  private static session: ArtifactCache | undefined;
  private static readonly fallback = { label: '[Artifact]', color: 0xffaa44 };
  private readonly cache: ArtifactCache;
  private readonly shared: boolean;
  private readonly playerWaiters = new Map<string, ((player: Raw | null) => void)[]>();
  private readonly artifactWaiters = new Map<string, Callback[]>();
  private readonly listeners = new Set<(data: ChatArtifactLinkData) => void>();
  private disposed = false;

  constructor(
    private game: Raw,
    private createArtifact: (record: Raw) => Artifact,
    private localize: (text: string) => string = (text) => text,
    private now: () => number = () => performance.now(),
    registry?: ChatArtifactTokenRegistry,
  ) {
    const owner = String(game.client?.connectUserId ?? '');
    this.shared = !registry && owner.length > 0;
    if (this.shared) {
      if (ChatArtifactLinkResolver.session?.owner !== owner)
        ChatArtifactLinkResolver.session = new ArtifactCache(owner);
      this.cache = ChatArtifactLinkResolver.session!;
    } else this.cache = new ArtifactCache(owner, registry);
  }

  get registry(): ChatArtifactTokenRegistry {
    return this.cache.registry;
  }

  onResolved(listener: (data: ChatArtifactLinkData) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  readonly resolveLabel = (playerId: string, artifactId: string): string =>
    this.resolvePresentation(playerId, artifactId).label;

  readonly resolvePresentation = (
    playerId: string,
    artifactId: string,
  ): ChatArtifactLinkData | { label: string; color: number } => {
    const data = this.cached(playerId, artifactId);
    if (data) return data;
    this.resolve(playerId, artifactId);
    return ChatArtifactLinkResolver.fallback;
  };

  cached(playerId: string, artifactId: string): Result {
    if (!this.current() || !this.valid(playerId, artifactId)) return null;
    return this.cache.artifacts.get(this.key(playerId, artifactId)) ?? null;
  }

  registerLocal(playerId: string, artifact: Artifact): Result {
    const me = read(this.game, 'me');
    if (
      !this.current() ||
      !artifact?.revealed ||
      !me ||
      playerId !== me.id ||
      !this.valid(playerId, artifact.id)
    )
      return null;
    const data = new ChatArtifactLinkData(
      playerId,
      artifact.id,
      read(me, 'name', ''),
      artifact,
      read(me, 'level', 0),
      this.localize,
    );
    this.cacheResolved(data);
    this.drain(this.key(playerId, artifact.id), data);
    this.notify(data);
    return data;
  }

  resolveText(value: string | null): boolean {
    if (!this.current()) return false;
    if (!value?.includes(ChatArtifactToken.PREFIX)) return true;
    const seen = new Set<string>();
    let settled = true;
    for (let index = 0; index < value.length && seen.size < 8; ) {
      if (value[index] === '<') {
        const end = value.indexOf('>', index + 1);
        if (end < 0) break;
        index = end + 1;
        continue;
      }
      const token = value[index] === '$' ? ChatArtifactToken.parseAt(value, index) : null;
      if (!token) {
        index++;
        continue;
      }
      const key = this.key(token.playerId, token.artifactId);
      if (!seen.has(key)) {
        seen.add(key);
        if (!this.resolve(token.playerId, token.artifactId)) settled = false;
      }
      index = token.sourceEnd;
    }
    return settled;
  }

  resolve(playerId: string, artifactId: string, callback?: Callback): boolean {
    if (!this.current() || !this.valid(playerId, artifactId)) {
      callback?.(null);
      return false;
    }
    const key = this.key(playerId, artifactId);
    const hit = this.cache.artifacts.get(key);
    if (hit) {
      this.registry.setLabel(playerId, artifactId, hit.label);
      callback?.(hit);
      return true;
    }
    if ((this.cache.failures.get(key) ?? 0) > this.now()) {
      callback?.(null);
      return true;
    }
    this.cache.failures.delete(key);
    const waiting = this.artifactWaiters.get(key);
    if (waiting) {
      if (callback) waiting.push(callback);
      return false;
    }
    if (this.artifactWaiters.size >= 32) {
      callback?.(null);
      return false;
    }
    this.artifactWaiters.set(key, callback ? [callback] : []);
    this.loadPlayer(playerId, (player) => {
      if (!this.current() || !player || !this.game.client?.bigDB) {
        this.finish(key, null);
        return;
      }
      this.game.client.bigDB.load(
        'Artifacts',
        artifactId,
        (record: Raw | null) => {
          if (
            !this.current() ||
            !record ||
            String(record.key) !== artifactId ||
            String(record.player) !== playerId ||
            record.revealed !== true
          ) {
            this.finish(key, null);
            return;
          }
          let artifact: Artifact;
          try {
            artifact = this.createArtifact(record);
          } catch {
            this.finish(key, null);
            return;
          }
          this.finish(
            key,
            new ChatArtifactLinkData(
              playerId,
              artifactId,
              String(player.name ?? ''),
              artifact,
              Number(player.level),
              this.localize,
            ),
          );
        },
        () => this.finish(key, null),
      );
    });
    return false;
  }

  private loadPlayer(playerId: string, callback: (player: Raw | null) => void): void {
    const hit = this.cache.players.get(playerId);
    if (hit) {
      callback(hit);
      return;
    }
    if ((this.cache.playerFailures.get(playerId) ?? 0) > this.now()) {
      callback(null);
      return;
    }
    this.cache.playerFailures.delete(playerId);
    const waiting = this.playerWaiters.get(playerId);
    if (waiting) {
      waiting.push(callback);
      return;
    }
    this.playerWaiters.set(playerId, [callback]);
    if (!this.game.client?.bigDB) {
      this.finishPlayer(playerId, null);
      return;
    }
    this.game.client.bigDB.load(
      'PlayerObjects',
      playerId,
      (record: Raw | null) => {
        this.finishPlayer(playerId, record && String(record.key) === playerId ? record : null);
      },
      () => this.finishPlayer(playerId, null),
    );
  }

  private finishPlayer(playerId: string, player: Raw | null): void {
    if (this.disposed) return;
    if (!this.current()) player = null;
    else if (player) {
      this.makeRoom(this.cache.players, 256, playerId);
      this.cache.players.set(playerId, player);
      this.cache.playerFailures.delete(playerId);
    } else {
      this.makeRoom(this.cache.playerFailures, 256, playerId);
      this.cache.playerFailures.set(playerId, this.now() + 30000);
    }
    const callbacks = this.playerWaiters.get(playerId) ?? [];
    this.playerWaiters.delete(playerId);
    for (const callback of callbacks) callback(player);
  }

  private finish(key: string, data: Result): void {
    if (this.disposed) return;
    if (!this.current()) {
      this.drain(key, null);
      return;
    }
    const existing = this.cache.artifacts.get(key);
    if (existing) data = existing;
    let notify = false;
    if (!data) {
      this.makeRoom(this.cache.failures, 512, key);
      this.cache.failures.set(key, this.now() + 30000);
    } else if (!existing) {
      this.cacheResolved(data);
      notify = true;
    }
    this.drain(key, data);
    if (notify && data) this.notify(data);
  }

  private drain(key: string, data: Result): void {
    const callbacks = this.artifactWaiters.get(key) ?? [];
    this.artifactWaiters.delete(key);
    for (const callback of callbacks) callback(data);
  }

  private cacheResolved(data: ChatArtifactLinkData): void {
    const key = this.key(data.playerId, data.artifactId);
    const evicted = this.makeRoom(this.cache.artifacts, 512, key);
    if (evicted) {
      const [playerId, artifactId] = evicted.split('\u001f');
      this.registry.removeLabel(playerId, artifactId);
    }
    this.cache.artifacts.set(key, data);
    this.cache.failures.delete(key);
    this.registry.setLabel(data.playerId, data.artifactId, data.label);
  }

  private notify(data: ChatArtifactLinkData): void {
    if (!this.disposed)
      for (const listener of this.listeners) {
        if (this.disposed) break;
        listener(data);
      }
  }

  private current(): boolean {
    return !this.disposed && (!this.shared || this.cache === ChatArtifactLinkResolver.session);
  }

  private valid(playerId: string, artifactId: string): boolean {
    return ChatArtifactToken.isValidId(playerId) && ChatArtifactToken.isValidId(artifactId);
  }

  private key(playerId: string, artifactId: string): string {
    return playerId + '\u001f' + artifactId;
  }

  private makeRoom<T>(values: Map<string, T>, maximum: number, key: string): string | undefined {
    if (values.has(key) || values.size < maximum) return;
    const evicted = values.keys().next().value!;
    values.delete(evicted);
    return evicted;
  }

  dispose(): void {
    this.disposed = true;
    this.playerWaiters.clear();
    this.artifactWaiters.clear();
    this.listeners.clear();
  }
}
