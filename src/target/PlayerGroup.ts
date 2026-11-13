import type { Player } from '../game/Bindings';

/** Haxe Group exposes get_id(); absent groups never establish membership. */
export function samePlayerGroup(
  first: Pick<Player, 'get_group'> | null | undefined,
  second: Pick<Player, 'get_group'> | null | undefined,
): boolean {
  const mine = first?.get_group();
  const theirs = second?.get_group();
  if (!mine || !theirs) return false;
  const id = mine.get_id();
  return id != null && id === theirs.get_id();
}
