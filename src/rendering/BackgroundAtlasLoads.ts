import type { Cleanup } from '../api/Types';
import type { Event, TextureManager } from '../game/Bindings';
import { BackgroundAtlasCache } from './BackgroundAtlasCache';

interface Load {
  manager: TextureManager;
  texture: string;
  atlas: string;
  callbacks: Set<(loaded: boolean) => void>;
  failed: boolean;
  cancelled: boolean;
  complete?: () => void;
  error?: (event: Event) => void;
  terminalFailure?: () => void;
}

/** One background batch at a time: native TextureManager has mutable batch counters. */
export class BackgroundAtlasLoads {
  private readonly loads = new Map<string, Load>();
  private readonly queue: Load[] = [];
  private active?: Load;
  private disposed = false;

  constructor(private readonly cache: BackgroundAtlasCache) {}

  request(
    manager: TextureManager,
    texture: string,
    atlas: string,
    completed: (loaded: boolean) => void,
  ): Cleanup {
    if (this.disposed) return () => {};
    if (this.cache.get(atlas)) {
      // Consumers acquire before cache trimming can evict an unpinned atlas.
      completed(true);
      this.cache.cache(atlas);
      return () => {};
    }
    let load = this.loads.get(atlas);
    if (load && load.manager !== manager) {
      load.cancelled = true;
      load.callbacks.clear();
      load = undefined;
    }
    if (!load) {
      load = { manager, texture, atlas, callbacks: new Set(), failed: false, cancelled: false };
      this.loads.set(atlas, load);
      this.queue.push(load);
    }
    load.callbacks.add(completed);
    this.startNext();
    return () => load.callbacks.delete(completed);
  }

  dispose(): void {
    this.disposed = true;
    if (this.active) this.detach(this.active);
    for (const load of this.loads.values()) load.callbacks.clear();
    this.loads.clear();
    this.queue.length = 0;
    this.active = undefined;
  }

  private startNext(): void {
    if (this.disposed || this.active) return;
    let load = this.queue.shift();
    while (load?.cancelled) load = this.queue.shift();
    if (!load) return;
    this.active = load;
    load.complete = () => this.finish(load, !load.failed && !!this.cache.get(load.atlas));
    load.error = (event) => {
      const file = event.data;
      if (file === `${load.texture}.xml` || file === `${load.texture}.jpg`) load.failed = true;
      // Keep the slot until preloadComplete: the failed item's sibling still
      // owns the native manager's counters and may finish asynchronously.
    };
    // Current Haxe stops the entire serial batch after retry exhaustion. The
    // original parallel loader instead emits preloadError for each failed item
    // and preloadComplete once all siblings settle. Support both contracts.
    load.terminalFailure = () => this.finish(load, false);
    load.manager.addEventListener('preloadComplete', load.complete);
    load.manager.addEventListener('preloadError', load.error);
    load.manager.addEventListener('preloadFailed', load.terminalFailure);
    if (this.cache.get(load.atlas)) return this.finish(load, true);
    try {
      load.manager.loadTextures([`${load.texture}.xml`, `${load.texture}.jpg`]);
    } catch (error) {
      if (this.active !== load) throw error;
      this.detach(load);
      if (this.loads.get(load.atlas) === load) this.loads.delete(load.atlas);
      this.active = undefined;
      // A thrown start may have left native IO running. Do not launch another
      // batch over it; let the owner dispose/recreate this loader.
      this.dispose();
      throw error;
    }
  }

  private detach(load: Load): void {
    if (load.complete) load.manager.removeEventListener('preloadComplete', load.complete);
    if (load.error) load.manager.removeEventListener('preloadError', load.error);
    if (load.terminalFailure)
      load.manager.removeEventListener('preloadFailed', load.terminalFailure);
  }

  private finish(load: Load, success: boolean): void {
    if (this.disposed || this.active !== load) return;
    this.detach(load);
    if (this.loads.get(load.atlas) === load) this.loads.delete(load.atlas);
    const callbacks = load.cancelled ? [] : [...load.callbacks];
    load.callbacks.clear();
    let callbackError: unknown;
    let failed = false;
    try {
      for (const callback of callbacks) {
        try {
          callback(success);
        } catch (error) {
          if (!failed) callbackError = error;
          failed = true;
        }
      }
      if (success) this.cache.cache(load.atlas);
    } finally {
      this.active = undefined;
      this.startNext();
    }
    if (failed) throw callbackError;
  }
}
