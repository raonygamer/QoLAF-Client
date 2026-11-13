export interface ClientWelcomeStorage {
  data?: Record<string, unknown>;
  get_data?(): Record<string, unknown>;
  flush(): unknown;
}

/** One invitation per local profile, retained across room changes if storage fails. */
export class ClientHelpWelcomeState {
  private state: 'pending' | 'dismissed' | undefined;
  private static readonly storageKey = 'qolafClientHelpWelcomeState';

  initialize(storage: ClientWelcomeStorage | undefined): void {
    if (this.state) return;
    try {
      const data = storage?.get_data ? storage.get_data() : storage?.data;
      const saved = data?.[ClientHelpWelcomeState.storageKey];
      if (saved === 'pending' || saved === 'dismissed') {
        this.state = saved;
        return;
      }
      if (Number(data?.qolafLastSeenClientVersion) > 0) this.state = 'dismissed';
    } catch {
      // A denied local-storage quota must not prevent joining the game.
    }
    this.state ??= 'pending';
    this.save(storage);
  }

  get pending(): boolean {
    return this.state === 'pending';
  }

  dismiss(storage: ClientWelcomeStorage | undefined): void {
    this.state = 'dismissed';
    this.save(storage);
  }

  private save(storage: ClientWelcomeStorage | undefined): void {
    try {
      if (!storage) return;
      const data = storage.get_data ? storage.get_data() : storage.data;
      if (!data) return;
      data[ClientHelpWelcomeState.storageKey] = this.state;
      storage.flush();
    } catch {
      // The in-memory state still survives sector transitions.
    }
  }
}
