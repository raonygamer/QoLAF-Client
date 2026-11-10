import type { API } from '../api/Types';
import { ChatDiscordImageLink } from './ChatDiscordImageLink';

export interface ChatImageShortcut {
  name: string;
  url: string;
}

/** Original local shortcut store; plugin storage replaces Flash SharedObject. */
export class ChatImageShortcutStore {
  static readonly MAX_ENTRIES = 64;
  private static readonly storageKey = 'chat-image-shortcuts';
  private readonly values = new Map<string, ChatImageShortcut>();

  constructor(
    private readonly storage: API['storage'],
    private readonly prefetch: (link: ChatDiscordImageLink) => void,
  ) {
    this.load();
  }

  resolve(name: string | null): string | null {
    return this.values.get(this.normalizeName(name))?.url ?? null;
  }

  entries(): ChatImageShortcut[] {
    return [...this.values.values()]
      .map((record) => ({ ...record }))
      .sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0));
  }

  save(name: string | null, url: string | null): string | null {
    name = this.normalizeName(name);
    url = (url ?? '').trim();
    if (!/^[a-z0-9_+\-]{1,32}$/.test(name))
      return 'Shortcut must be 1-32 letters, numbers, _, +, or -.';
    const link = ChatDiscordImageLink.parseAt(url, 0);
    if (!link || link.sourceBegin !== 0 || link.sourceEnd !== url.length)
      return 'Use a direct HTTP(S) .png/.jpg/.jpeg/.gif/.webp URL.';
    if (!this.values.has(name) && this.values.size >= ChatImageShortcutStore.MAX_ENTRIES)
      return `Shortcut limit reached (${ChatImageShortcutStore.MAX_ENTRIES}).`;
    this.values.set(name, { name, url });
    this.persist();
    this.prefetch(link);
    return null;
  }

  remove(name: string | null): boolean {
    if (!this.values.delete(this.normalizeName(name))) return false;
    this.persist();
    return true;
  }

  private load(): void {
    let stored: unknown;
    try {
      stored = this.storage.get<unknown>(ChatImageShortcutStore.storageKey, []);
    } catch {
      return;
    }
    if (!Array.isArray(stored)) return;
    for (const record of stored) {
      if (!record || typeof record.name !== 'string' || typeof record.url !== 'string') continue;
      const name = this.normalizeName(record.name);
      const url = record.url.trim();
      if (!/^[a-z0-9_+\-]{1,32}$/.test(name)) continue;
      const link = ChatDiscordImageLink.parseAt(url, 0);
      if (!link || link.sourceEnd !== url.length) continue;
      if (this.values.size >= ChatImageShortcutStore.MAX_ENTRIES) break;
      this.values.set(name, { name, url });
    }
  }

  private persist(): void {
    try {
      this.storage.set(ChatImageShortcutStore.storageKey, this.entries());
    } catch {
      // Source keeps the in-memory changes when SharedObject.flush fails.
    }
  }

  private normalizeName(value: string | null): string {
    return (value ?? '').trim().toLowerCase();
  }
}
