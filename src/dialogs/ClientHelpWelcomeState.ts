import { read, type Raw } from '../api/Types';

/** One invitation per local profile, retained across room changes if storage fails. */
export class ClientHelpWelcomeState {
  private state: 'pending' | 'dismissed' | undefined;
  private static readonly storageKey = 'qolafClientHelpWelcomeState';

  initialize(storage: Raw | undefined): void {
    if (this.state) return;
    try {
      const data = read(storage, 'data');
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

  dismiss(storage: Raw | undefined): void {
    this.state = 'dismissed';
    this.save(storage);
  }

  private save(storage: Raw | undefined): void {
    try {
      if (!storage) return;
      read(storage, 'data')[ClientHelpWelcomeState.storageKey] = this.state;
      storage.flush();
    } catch {
      // The in-memory state still survives sector transitions.
    }
  }
}
