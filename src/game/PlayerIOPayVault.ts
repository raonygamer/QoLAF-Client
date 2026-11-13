/** Extra history API provided by the browser SDK beneath the Haxe wrapper. */
export interface PlayerIOPayVault {
  readHistory(
    start: number,
    limit: number,
    success: (entries: unknown) => void,
    failure: (error: unknown) => void,
  ): void;
}
