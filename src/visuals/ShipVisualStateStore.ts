import { read, type Raw, type Cleanup } from '../api/Types';
import { VisualShareWire } from '../ipc/VisualShareWire';
import { ClientDevVisual } from './ClientDevVisual';

/** One scene's live local snapshot and validated, detached remote appearance records. */
export class ShipVisualStateStore {
  private static sessions = new WeakMap<Raw, ShipVisualStateStore>();
  private providers = new Map<string, () => Raw>();
  private remoteStates = new Map<string, Raw>();
  private listeners = new Set<() => void>();
  private applyRemote: ((id: string, state: Raw | null) => boolean) | null = null;
  private constructor(private game: Raw) {}

  static forGame(game: Raw): ShipVisualStateStore {
    let store = this.sessions.get(game);
    if (!store) {
      store = new ShipVisualStateStore(game);
      this.sessions.set(game, store);
    }
    return store;
  }
  bind(name: string, snapshot: () => Raw): Cleanup {
    this.providers.set(name, snapshot);
    return () => {
      if (this.providers.get(name) === snapshot) this.providers.delete(name);
    };
  }
  onChange(callback: () => void): Cleanup {
    this.listeners.add(callback);
    return () => {
      this.listeners.delete(callback);
    };
  }
  changed(): void {
    for (const callback of this.listeners) callback();
  }
  bindRemoteApplication(callback: (id: string, state: Raw | null) => boolean): Cleanup {
    this.applyRemote = callback;
    return () => {
      if (this.applyRemote === callback) this.applyRemote = null;
    };
  }
  static defaults(): Raw {
    return {
      enabled: false,
      source: '',
      key: '',
      engineKey: null,
      shadowDisabled: false,
      originalColor: false,
      useVisualEmitters: false,
      shootingPointIndex: -1,
      aura: '',
      devvis: 'default',
      devvisSettings: ClientDevVisual.defaults(),
      scale: 1,
      weaponStyles: {},
    };
  }
  local(): Raw | null {
    const state = ShipVisualStateStore.defaults();
    for (const provider of this.providers.values()) Object.assign(state, provider());
    state.scale = read(read(this.game, 'me')?.ship, 'experimentalVisualScale', 1);
    return this.validate(state);
  }
  private validate(state: Raw): Raw | null {
    const wire = VisualShareWire.encode(state, '000000000000', 1);
    return wire ? (VisualShareWire.decode(wire)?.state ?? null) : null;
  }
  setRemote(id: string, state: Raw): boolean {
    if (!id || id === read(this.game, 'me')?.id) return false;
    const validated = this.validate(state);
    if (!validated) return false;
    if (this.applyRemote && !this.applyRemote(id, validated)) return false;
    this.remoteStates.set(id, validated);
    return true;
  }
  remote(id: string): Raw | null {
    return this.remoteStates.get(id) ?? null;
  }
  clearRemote(id: string): boolean {
    if (this.applyRemote && !this.applyRemote(id, null)) return false;
    this.remoteStates.delete(id);
    return true;
  }
}
