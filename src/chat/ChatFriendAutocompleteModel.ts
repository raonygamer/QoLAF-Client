import { ChatCommandSuggestion } from './ChatCommandSuggestion';

export interface AutocompleteFriend {
  id?: string | null;
  name: string;
  isOnline?: boolean;
  level?: number;
  playerId?: string | null;
  skin?: string | null;
  previewShipHue?: number;
  previewShipBrightness?: number;
  previewShipSaturation?: number;
  previewShipContrast?: number;
}
interface AutocompletePlayer {
  id: string;
  name: string;
  description: string;
  useId: boolean;
}

/** Source friend ranking and explicit-roster completion, without service access. */
export class ChatFriendAutocompleteModel {
  private sourceFriends: AutocompleteFriend[] = [];
  private sourcePlayers: AutocompletePlayer[] | null = null;
  private visibleMatches: ChatCommandSuggestion[] = [];
  private readonly maxResults: number;
  selectedIndex = -1;
  active = false;
  query = '';
  readonly argumentMode = false;

  constructor(maxResults = 128) {
    this.maxResults = Math.max(1, maxResults);
  }

  setFriends(value: readonly (AutocompleteFriend | null)[] | null): void {
    this.sourcePlayers = null;
    this.sourceFriends = [];
    const seen = new Set<string>();
    for (const friend of value ?? []) {
      if (!friend || !friend.name?.trim()) continue;
      const identity = friend.id ? 'id:' + friend.id : 'name:' + friend.name.toLowerCase();
      if (seen.has(identity)) continue;
      seen.add(identity);
      this.sourceFriends.push(friend);
    }
  }

  setPlayers(value: readonly unknown[] | null, description: string | null): void {
    this.sourceFriends = [];
    this.sourcePlayers = [];
    const seen = new Set<string>();
    const names = new Map<string, number>();
    for (const record of value ?? []) {
      if (!record || typeof record !== 'object') continue;
      const player = record as Record<string, unknown>;
      if (
        typeof player.id !== 'string' ||
        typeof player.name !== 'string' ||
        !player.id ||
        !player.name.trim() ||
        seen.has(player.id)
      )
        continue;
      seen.add(player.id);
      this.sourcePlayers.push({
        id: player.id,
        name: player.name,
        description:
          typeof player.description === 'string' ? player.description : (description ?? ''),
        useId: false,
      });
      const key = player.name.toLowerCase();
      names.set(key, (names.get(key) ?? 0) + 1);
    }
    for (const player of this.sourcePlayers)
      player.useId = (names.get(player.name.toLowerCase()) ?? 0) > 1 || player.name.includes('@');
  }

  update(inputText: string | null): boolean {
    this.dismiss();
    this.query = inputText?.toLowerCase() ?? '';
    if (inputText === null) return false;
    if (this.sourcePlayers !== null) this.query = this.query.replace(/^["']|["']$/g, '');
    const ranked: { suggestion: ChatCommandSuggestion; rank: number; name: string }[] = [];
    for (const friend of this.sourceFriends) {
      const name = friend.name.toLowerCase();
      const rank = this.matchRank(name);
      if (rank >= 0) ranked.push({ suggestion: this.friendSuggestion(friend), rank, name });
    }
    for (const player of this.sourcePlayers ?? []) {
      const name = player.name.toLowerCase();
      let rank = this.matchRank(name);
      const idRank = this.matchRank(player.id.toLowerCase());
      if (idRank >= 0 && (rank < 0 || idRank < rank)) rank = idRank;
      if (rank >= 0) ranked.push({ suggestion: this.playerSuggestion(player), rank, name });
    }
    ranked.sort(
      (left, right) =>
        left.rank - right.rank || (left.name < right.name ? -1 : left.name > right.name ? 1 : 0),
    );
    this.visibleMatches = ranked.slice(0, this.maxResults).map((item) => item.suggestion);
    this.active = this.visibleMatches.length > 0;
    this.selectedIndex = this.active ? 0 : -1;
    return this.active;
  }

  dismiss(): void {
    this.active = false;
    this.visibleMatches = [];
    this.selectedIndex = -1;
  }
  selectNext(): void {
    if (this.active) this.selectedIndex = (this.selectedIndex + 1) % this.visibleMatches.length;
  }
  selectPrevious(): void {
    if (this.active)
      this.selectedIndex =
        (this.selectedIndex + this.visibleMatches.length - 1) % this.visibleMatches.length;
  }
  selectIndex(index: number): void {
    if (this.active && index >= 0 && index < this.visibleMatches.length) this.selectedIndex = index;
  }
  get matches(): ChatCommandSuggestion[] {
    return [...this.visibleMatches];
  }
  get selectedSuggestion(): ChatCommandSuggestion | null {
    return this.visibleMatches[this.selectedIndex] ?? null;
  }
  get selectedFriend(): AutocompleteFriend | null {
    return this.sourcePlayers === null
      ? ((this.selectedSuggestion?.context as AutocompleteFriend) ?? null)
      : null;
  }
  complete(): string | null {
    return this.selectedSuggestion?.completionText ?? null;
  }

  private matchRank(name: string): number {
    if (!this.query) return 3;
    if (name === this.query) return 0;
    if (name.startsWith(this.query)) return 1;
    if (name.includes(' ' + this.query)) return 2;
    return name.includes(this.query) ? 3 : -1;
  }
  private friendSuggestion(friend: AutocompleteFriend): ChatCommandSuggestion {
    const details = [friend.isOnline ? 'Online' : 'Friend'];
    if ((friend.level ?? 0) > 0) details.push('Level ' + friend.level);
    if (friend.playerId) details.push(friend.playerId);
    return new ChatCommandSuggestion(
      friend.name,
      '',
      details.join('  •  '),
      '@' + friend.name,
      '@' + friend.name,
      0,
      friend.skin ?? null,
      friend,
    );
  }
  private playerSuggestion(player: AutocompletePlayer): ChatCommandSuggestion {
    let useId = player.useId;
    let target = useId ? player.id : player.name;
    if (!useId && /\s|["']/.test(player.name)) {
      if (!player.name.includes('"')) target = '"' + player.name + '"';
      else if (!player.name.includes("'")) target = "'" + player.name + "'";
      else {
        useId = true;
        target = player.id;
      }
    }
    return new ChatCommandSuggestion(
      player.name,
      '',
      player.description + '  •  ' + player.id,
      useId ? target : '@' + target,
      '@' + player.name,
      0,
      null,
      player,
    );
  }
}
