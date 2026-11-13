interface SoundRequests {
  generation: number;
  keys: Map<string, number>;
}

/** Cancels pending playback without cancelling reusable audio downloads. */
export class SoundRequestGuard {
  private services = new WeakMap<object, SoundRequests>();
  private active = true;

  capture(service: object, key: string): () => boolean {
    const state = this.stateFor(service);
    const generation = state.generation;
    const revision = state.keys.get(key) ?? 0;
    return () =>
      this.active && state.generation === generation && (state.keys.get(key) ?? 0) === revision;
  }

  cancelKey(service: object, key: string): void {
    const state = this.stateFor(service);
    state.keys.set(key, (state.keys.get(key) ?? 0) + 1);
  }

  cancelService(service: object): void {
    const state = this.stateFor(service);
    state.generation++;
    state.keys.clear();
  }

  dispose(): void {
    this.active = false;
    this.services = new WeakMap();
  }

  private stateFor(service: object): SoundRequests {
    let state = this.services.get(service);
    if (!state) {
      state = { generation: 0, keys: new Map() };
      this.services.set(service, state);
    }
    return state;
  }
}
