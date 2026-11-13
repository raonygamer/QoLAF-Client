import type { API } from '../api/Types';

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

/** Source account-scoped annotations; never stored in server artifact records. */
export class ArtifactFavorites {
  private accounts: Record<string, unknown> = {};
  constructor(private storage: API['storage']) {
    try {
      const accounts = storage.get<unknown>('qolaf-artifact-favorites', {});
      if (isRecord(accounts)) this.accounts = accounts;
    } catch {
      /* Disabled storage retains session-only annotations. */
    }
  }
  isFavorite(playerId: string, artifactId: string): boolean {
    if (!playerId || !artifactId) return false;
    const entries = this.accounts['account:' + playerId];
    return isRecord(entries) && entries['artifact:' + artifactId] === true;
  }
  setFavorite(playerId: string, artifactId: string, favorite: boolean): void {
    if (!playerId || !artifactId) return;
    const key = 'account:' + playerId;
    const stored = this.accounts[key];
    let entries: Record<string, unknown>;
    if (isRecord(stored)) entries = stored;
    else {
      if (!favorite) return;
      entries = {};
      this.accounts[key] = entries;
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
