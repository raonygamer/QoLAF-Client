/** Server-authenticated IDs from Game.isRoomOperator, never names or role badges. */
export function isRoomOperator(playerId: string): boolean {
  return playerId === 'steam76561199032900322' || playerId === 'simple1547032044962';
}

export function validRoomNoticeIdentity(id: string, name: string): boolean {
  return (
    id.length > 0 &&
    id.length <= 128 &&
    name.length > 0 &&
    name.length <= 100 &&
    !/[\x00-\x1f\x7f]/.test(id + name)
  );
}

/** Source encoded-length limit; brackets must remain literal through colorCoding. */
export function escapeRoomControlText(value: string): string {
  const entities: Record<string, string> = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&apos;',
    '[': '&#91;',
    ']': '&#93;',
  };
  let result = '';
  for (let index = 0; index < value.length; index++) {
    const character = value.charAt(index);
    const encoded = entities[character] ?? character;
    if (result.length + encoded.length > 140) return result + '...';
    result += encoded;
  }
  return result;
}
