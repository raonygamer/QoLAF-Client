export interface RadioInvitePeer {
  id: string;
  name: string;
}
export interface RadioInviteSelection {
  peers: RadioInvitePeer[];
  bulk: boolean;
  roomScoped: boolean;
}

/** Original all-or-nothing target grammar, including quoted commas in player names. */
export function selectRadioInviteTargets(
  value: string | null,
  online: readonly RadioInvitePeer[],
  findPeer: (query: string) => RadioInvitePeer | null,
  inRoom: (id: string) => boolean,
): RadioInviteSelection | null {
  const text = (value ?? '').trim(),
    mode = text.toLowerCase();
  const roomScoped = mode === 'roompeers';
  if (roomScoped || mode === 'allpeers')
    return { peers: online.filter((p) => !roomScoped || inRoom(p.id)), bulk: true, roomScoped };
  const specs: string[] = [],
    bulk = text.charAt(0) === '[';
  if (bulk) {
    if (text.charAt(text.length - 1) !== ']') return null;
    let start = 1,
      quote = '';
    for (let i = 1; i < text.length; i++) {
      const c = text.charAt(i);
      if (quote) {
        if (c === quote) quote = '';
        continue;
      }
      if ((c === '"' || c === "'") && /^\s*@\s*$/.test(text.substring(start, i))) {
        quote = c;
        continue;
      }
      if (c === ',' || i === text.length - 1) {
        const spec = text.substring(start, i).trim();
        if (spec.charAt(0) !== '@') return null;
        specs.push(spec);
        start = i + 1;
      } else if (c === '[' || c === ']') return null;
    }
    if (quote || !specs.length || specs.length > 512) return null;
  } else specs.push(text);
  const peers: RadioInvitePeer[] = [];
  for (let query of specs) {
    if (query.charAt(0) === '@') query = query.slice(1).trim();
    if (query.charAt(0) === '"' || query.charAt(0) === "'") {
      if (query.length < 3 || query.charAt(query.length - 1) !== query.charAt(0)) return null;
      query = query.slice(1, -1);
    }
    const peer = query.length ? findPeer(query) : null;
    if (!peer) return null;
    peers.push(peer);
  }
  return { peers, bulk, roomScoped: false };
}
