import type { Game } from '../game/Game';

/** The old DataManager helper forwarded these lookups to the account's BigDB. */
export function loadChatContextRecord(
  database: Pick<Game.playerio.BigDB, 'load'> | null | undefined,
  table: 'Clans' | 'PlayerObjects',
  key: string,
  success: (record: object | null) => void,
  failure: () => void,
): boolean {
  if (!database || !key) return false;
  let answered = false;
  const failed = () => {
    if (answered) return;
    answered = true;
    failure();
  };
  try {
    database.load(
      table,
      key,
      (value: unknown) => {
        if (answered) return;
        answered = true;
        success(value !== null && typeof value === 'object' ? value : null);
      },
      failed,
    );
    return true;
  } catch (error) {
    // A callback error is not a failed request; retain its original exception.
    if (answered) throw error;
    failed();
    return false;
  }
}
