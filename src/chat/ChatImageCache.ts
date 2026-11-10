import { ChatDiscordImageLink } from './ChatDiscordImageLink';
import { ChatImageAsset } from './ChatImageAsset';

type Complete = (asset: ChatImageAsset) => void;
type Failed = (reason: string) => void;

export interface ChatImageLoader {
  loadCandidates(urls: string[], onComplete: Complete, onFailed: Failed): void;
}
interface Waiter {
  ok: Complete | null;
  fail: Failed | null;
}
interface Entry {
  asset: ChatImageAsset | null;
  loader: ChatImageLoader | null;
  waiters: Waiter[];
}

/** Source shared-load and LRU policy, with the platform loader injected. */
export class ChatImageCache {
  private static readonly maxEntries = 24;
  private static readonly maxTextureBytes = 96 * 1024 * 1024;
  private readonly entries = new Map<string, Entry>();

  constructor(
    private readonly createLoader: () => ChatImageLoader,
    private readonly now: () => number = () => performance.now(),
  ) {}

  acquire(
    link: ChatDiscordImageLink | null,
    onComplete: Complete | null,
    onFailed: Failed | null,
  ): void {
    if (!link?.rawUrl) {
      onFailed?.('Invalid image URL.');
      return;
    }
    const key = this.keyFor(link);
    const existing = this.entries.get(key);
    if (existing?.asset) {
      const cached = existing.asset;
      cached.lastUse = this.now();
      if (onComplete) {
        cached.refCount++;
        this.deliver(onComplete, cached);
      }
      return;
    }
    const waiter = { ok: onComplete, fail: onFailed };
    if (existing) {
      existing.waiters.push(waiter);
      return;
    }
    const loader = this.createLoader();
    const entry: Entry = { asset: null, loader, waiters: [waiter] };
    this.entries.set(key, entry);
    loader.loadCandidates(
      link.candidateUrls(2048, 2048),
      (asset) => {
        if (this.entries.get(key) !== entry) {
          asset.dispose();
          return;
        }
        entry.asset = asset;
        entry.loader = null;
        asset.lastUse = this.now();
        const waiters = entry.waiters;
        entry.waiters = [];
        // Reserve every reference before callbacks. A prefetch may release and
        // trim immediately; a later consumer must still receive a live texture.
        for (const pending of waiters) if (pending.ok) asset.refCount++;
        for (const pending of waiters) if (pending.ok) this.deliver(pending.ok, asset);
        this.trim();
      },
      (reason) => {
        if (this.entries.get(key) !== entry) return;
        this.entries.delete(key);
        const waiters = entry.waiters;
        entry.waiters = [];
        for (const pending of waiters) if (pending.fail) this.deliver(pending.fail, reason);
      },
    );
  }

  cachedSize(link: ChatDiscordImageLink | null): { width: number; height: number } | null {
    if (!link?.rawUrl) return null;
    const asset = this.entries.get(this.keyFor(link))?.asset;
    return asset ? { width: asset.width, height: asset.height } : null;
  }

  prefetch(link: ChatDiscordImageLink | null): void {
    if (link)
      this.acquire(
        link,
        (asset) => this.release(asset),
        () => {},
      );
  }

  release(asset: ChatImageAsset | null): void {
    if (!asset) return;
    asset.refCount = Math.max(0, asset.refCount - 1);
    asset.lastUse = this.now();
    this.trim();
  }

  private keyFor(link: ChatDiscordImageLink): string {
    return link.candidateUrls(2048, 2048)[0] ?? link.rawUrl;
  }

  private deliver<T>(callback: (value: T) => void, value: T): void {
    try {
      callback(value);
    } catch {
      // Preserve the reference: a consumer can retain the asset before throwing.
      // Other waiters must still receive their result.
    }
  }

  private trim(): void {
    const loaded: { key: string; asset: ChatImageAsset }[] = [];
    let totalBytes = 0;
    for (const [key, entry] of this.entries) {
      if (!entry.asset) continue;
      loaded.push({ key, asset: entry.asset });
      totalBytes += entry.asset.estimatedBytes;
    }
    let loadedCount = loaded.length;
    if (loadedCount <= ChatImageCache.maxEntries && totalBytes <= ChatImageCache.maxTextureBytes)
      return;
    loaded.sort((a, b) => a.asset.lastUse - b.asset.lastUse);
    for (const { key, asset } of loaded) {
      if (loadedCount <= ChatImageCache.maxEntries && totalBytes <= ChatImageCache.maxTextureBytes)
        break;
      if (asset.refCount !== 0) continue;
      this.entries.delete(key);
      loadedCount--;
      totalBytes = Math.max(0, totalBytes - asset.estimatedBytes);
      asset.dispose();
    }
  }
}
