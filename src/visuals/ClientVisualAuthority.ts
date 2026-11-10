/** Exact original account IDs. Names, role labels and stored flags grant no access. */
export function isClientDeveloper(playerId: unknown): boolean {
  return (
    typeof playerId === 'string' &&
    [
      'steam76561199032900322',
      'steam76561198188053594',
      'simple1622136353425',
      'simple1547032044962',
      'simple1789865760026',
      'simple1789865163183',
    ].includes(playerId)
  );
}
