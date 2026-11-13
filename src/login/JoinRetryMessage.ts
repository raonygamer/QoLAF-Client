/** JoinRoomManager.diff: retry only the source's temporary account/session locks. */
export function transientJoinRetryMessage(reason: string): string | null {
  const normalized = reason
    .toLowerCase()
    .replace(/['\u2018\u2019]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/[.!]+$/, '')
    .trim();
  if (
    normalized === 'your account is still in the game' ||
    /^you(?:re| are) not allowed to join yet - you are already inside the game, please try again in 10 seconds$/.test(
      normalized,
    )
  )
    return 'Previous Game session is still closing; retrying...';
  if (
    normalized === 'youre not allowed to join yet' ||
    normalized === 'you are not allowed to join yet'
  )
    return 'Not allowed to join yet, retrying...';
  return null;
}
