import type { GameScene } from '../game/Bindings';
import type { ChatFriendAutocompleteToken } from './ChatFriendAutocompleteParser';

export interface AutocompletePlayer {
  id: string;
  name: string;
  description?: string;
}

type PlayerSource = 'friends' | 'ipc' | 'visual-reset' | 'none';
const visualTargets = new WeakMap<object, () => AutocompletePlayer[]>();

/** Scene-owned saved and disabled profiles; never borrow another login's roster. */
export function bindVisualAutocompleteTargets(
  game: object,
  provider: () => AutocompletePlayer[],
): () => void {
  visualTargets.set(game, provider);
  return () => {
    if (visualTargets.get(game) === provider) visualTargets.delete(game);
  };
}

export function knownVisualResetPlayers(game: GameScene): AutocompletePlayer[] {
  const me = game.get_me();
  if (!me) return [];
  const players: AutocompletePlayer[] = [];
  for (const player of game.playerManager?.get_players() ?? []) {
    if (!player || player.id === me.id) continue;
    players.push({ id: player.id, name: player.get_name(), description: 'Current room' });
  }
  for (const player of visualTargets.get(game)?.() ?? []) {
    if (player.id !== me.id) players.push(player);
  }
  return players;
}

/** Source command grammar determines which identity provider owns the caret. */
export function playerAutocompleteSource(
  text: string,
  token: Pick<ChatFriendAutocompleteToken, 'beginIndex'>,
  floating: boolean,
): PlayerSource {
  const command = /^\/([^\s]+)(?:\s|$)/.exec(text);
  if (!command) return 'friends';
  const name = command[1].toLowerCase();
  const before = text.substring(0, token.beginIndex);
  if (name === 'ssv') {
    if (floating) return 'none';
    if (/^\/ssv\s+["']?$/i.test(before)) return 'ipc';
    if (/^\/ssv\s+(?:disable|enable)\s+["']?$/i.test(before)) return 'ipc';
    if (/^\/ssv\s+reset\s+["']?$/i.test(before)) return 'visual-reset';
    return 'none';
  }
  if (typeof __QOLAF_PRIVATE__ !== 'undefined' && __QOLAF_PRIVATE__) {
    if (name === 'invitetoroom' || name === 'kickfromroom') {
      if (floating) return 'none';
      return /^\/(?:invitetoroom|kickfromroom)\s+(?:\[\s*(?:@(?:"[^"]*"|'[^']*'|[^,\]]+)\s*,\s*)*)?["']?$/i.test(
        before,
      )
        ? 'ipc'
        : 'none';
    }
  }
  // These commands never use friend names, including unsupported radio commands.
  if (['invitetoroom', 'kickfromroom', 'roominvite', 'invitetoradio', 'radioinvite'].includes(name))
    return 'none';
  return 'friends';
}

/** Explicit targets may start with a quote before @; completion supplies its own quoting. */
export function playerAutocompleteReplacementBegin(
  text: string,
  token: Pick<ChatFriendAutocompleteToken, 'beginIndex'>,
  floating: boolean,
): number {
  const source = playerAutocompleteSource(text, token, floating);
  if (source === 'ipc' || source === 'visual-reset') {
    const preceding = text.charAt(token.beginIndex - 1);
    if (preceding === '"' || preceding === "'") return token.beginIndex - 1;
  }
  return token.beginIndex;
}
