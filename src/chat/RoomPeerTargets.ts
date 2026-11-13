import type { ClientIPCService } from '../ipc/ClientIPCService';

export interface RoomPeerTarget {
  id: string;
  name: string;
  roomScoped: boolean;
}
export interface RoomPeerSelection {
  targets: RoomPeerTarget[];
  body: string;
}

/** Source selectors resolve authenticated IPC presence, including longest-name matching. */
export function parseRoomPeerTargets(
  value: string,
  ipc: ClientIPCService,
  localId: string,
  inRoom: (id: string) => boolean,
  missingPeer: () => void,
): RoomPeerSelection | null {
  const text = value.trim();
  if (!text) return null;
  const all = /^(roompeers|allpeers)(?:\s+|$)/i.exec(text);
  if (all) {
    const roomScoped = all[1]!.toLowerCase() === 'roompeers';
    const seen = new Set<string>();
    const targets: RoomPeerTarget[] = [];
    for (const peer of ipc.onlinePlayers) {
      if (peer.id === localId || (roomScoped && !inRoom(peer.id)) || seen.has(peer.id)) continue;
      seen.add(peer.id);
      targets.push({ ...peer, roomScoped });
    }
    return {
      body: text.slice(all[0].length).trim(),
      targets,
    };
  }
  if (text.startsWith('[')) {
    const close = text.indexOf(']');
    if (close < 0 || !text.slice(1, close).trim()) return null;
    const targets: RoomPeerTarget[] = [];
    const seen = new Set<string>();
    for (const entry of text.slice(1, close).split(',')) {
      let spec = entry.trim();
      if (spec.length < 2 || !spec.startsWith('@')) return null;
      spec = spec.slice(1).trim();
      if (
        spec.length >= 2 &&
        ((spec.startsWith('"') && spec.endsWith('"')) ||
          (spec.startsWith("'") && spec.endsWith("'")))
      )
        spec = spec.slice(1, -1);
      const peer = ipc.findPeer(spec);
      if (!peer) return null;
      if (seen.has(peer.id)) continue;
      seen.add(peer.id);
      targets.push({ ...peer, roomScoped: false });
    }
    return { targets, body: text.slice(close + 1).trim() };
  }
  let rest = text.startsWith('@') ? text.slice(1) : text;
  let name = '';
  const quote = rest.charAt(0);
  if (quote === '"' || quote === "'") {
    const end = rest.indexOf(quote, 1);
    if (end <= 1 || (end + 1 < rest.length && !/\s/.test(rest.charAt(end + 1)))) return null;
    name = rest.slice(1, end);
    rest = rest.slice(end + 1).trim();
  } else {
    let candidate = rest;
    while (candidate) {
      if (ipc.findPeer(candidate)) {
        name = candidate;
        break;
      }
      const shorter = candidate.replace(/\s+\S+$/, '');
      if (shorter === candidate) break;
      candidate = shorter;
    }
    if (!name) name = rest.split(/\s+/)[0]!;
    rest = rest.slice(name.length).trim();
  }
  if (name.startsWith('@')) name = name.slice(1);
  if (!name || name.length > 60 || /[\x00-\x1f\x7f<>]/.test(name)) return null;
  const peer = ipc.findPeer(name);
  if (!peer) missingPeer();
  return peer ? { targets: [{ ...peer, roomScoped: false }], body: rest } : null;
}
