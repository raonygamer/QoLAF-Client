import type { API, Raw } from '../api/Types';

/** Source account-scoped annotations; never stored in server artifact records. */
export class ArtifactFavorites {
  private accounts: Raw = {};
  constructor(private storage: API['storage']) {
    try {
      const accounts = storage.get<unknown>('qolaf-artifact-favorites', {});
      if (accounts && typeof accounts === 'object' && !Array.isArray(accounts))
        this.accounts = accounts;
    } catch {
      /* Disabled storage retains session-only annotations. */
    }
  }
  isFavorite(playerId: string, artifactId: string): boolean {
    if (!playerId || !artifactId) return false;
    const entries = this.accounts['account:' + playerId];
    return (
      !!entries &&
      typeof entries === 'object' &&
      !Array.isArray(entries) &&
      entries['artifact:' + artifactId] === true
    );
  }
  setFavorite(playerId: string, artifactId: string, favorite: boolean): void {
    if (!playerId || !artifactId) return;
    const key = 'account:' + playerId;
    let entries = this.accounts[key];
    if (!entries || typeof entries !== 'object' || Array.isArray(entries)) {
      if (!favorite) return;
      entries = this.accounts[key] = {};
    }
    if (favorite) entries['artifact:' + artifactId] = true;
    else delete entries['artifact:' + artifactId];
    try {
      this.storage.set('qolaf-artifact-favorites', this.accounts);
    } catch {
      /* Keep the in-memory annotation if persistence is unavailable. */
    }
  }
}
