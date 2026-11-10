import { read, type Raw } from '../api/Types';

/** Haxe Group exposes get_id(); do not equate two absent JS properties. */
export function samePlayerGroup(
  first: Raw | null | undefined,
  second: Raw | null | undefined,
): boolean {
  const mine = read(first, 'group');
  const theirs = read(second, 'group');
  if (!mine || !theirs) return false;
  const id = read(mine, 'id');
  return id != null && id === read(theirs, 'id');
}
