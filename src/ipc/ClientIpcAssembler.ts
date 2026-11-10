import { ClientIpcCodec, type IpcMessage } from './ClientIpcCodec';

interface Assembly {
  sender: string;
  channel: string;
  size: number;
  count: number;
  digest: string;
  parts: string[];
  received: number;
  characters: number;
  last: number;
  deadline: number;
}

/** Source sender-keyed reassembly: no application effects until END commits. */
export class ClientIpcAssembler {
  private readonly active = new Map<string, Assembly>();
  private readonly recent = new Map<string, number>();
  private readonly peerRecent = new Map<string, number>();

  clear(): void {
    this.active.clear();
    this.recent.clear();
    this.peerRecent.clear();
  }

  expire(now: number): void {
    for (const [key, entry] of this.active)
      if (now - entry.last >= 30000 || now >= entry.deadline) this.discard(key, now);
    for (const [key, expires] of this.recent) {
      if (now < expires) continue;
      this.recent.delete(key);
      const peer = this.replayPeer(key);
      const count = (this.peerRecent.get(peer) ?? 0) - 1;
      if (count <= 0) this.peerRecent.delete(peer);
      else this.peerRecent.set(peer, count);
    }
  }

  discardPeer(senderId: string, now: number): void {
    for (const [key, entry] of this.active) if (entry.sender === senderId) this.discard(key, now);
  }

  accept(
    text: string,
    channel: string,
    senderId: string,
    _senderName: string,
    now: number,
  ): IpcMessage | null {
    const frame = ClientIpcCodec.parse(text);
    if (!frame) return null;
    const key = `${senderId.length}:${senderId}:${frame.id}`;
    if (this.recent.has(key)) return null;
    const entry = this.active.get(key);
    if (
      (frame.kind === 's' || frame.kind === 'b') &&
      !entry &&
      (this.peerRecent.get(this.replayPeer(key)) ?? 0) >= 128
    )
      return null;
    if (frame.kind === 's') {
      if (entry || this.recent.size + this.active.size >= 2048) return null;
      this.remember(key, now);
      return this.unpack(frame.data, frame.digest, -1);
    }
    if (frame.kind === 'b') {
      if (entry) {
        if (
          entry.size !== frame.size ||
          entry.count !== frame.count ||
          entry.digest !== frame.digest ||
          entry.channel !== channel
        )
          this.discard(key, now);
        return null;
      }
      if (this.active.size >= 32 || this.recent.size + this.active.size >= 2048) return null;
      let peers = 0;
      for (const other of this.active.values()) if (other.sender === senderId) peers++;
      if (peers >= 8) return null;
      this.active.set(key, {
        sender: senderId,
        channel,
        size: frame.size,
        count: frame.count,
        digest: frame.digest,
        parts: [],
        received: 0,
        characters: 0,
        last: now,
        deadline: now + 30000 + frame.count * (channel === 'local' ? 2000 : 400),
      });
      return null;
    }
    if (!entry) return null;
    if (entry.channel !== channel || now >= entry.deadline || now - entry.last >= 30000) {
      this.discard(key, now);
      return null;
    }
    if (frame.kind === 'p') {
      const encodedLength = Math.ceil((entry.size * 4) / 3);
      const expected =
        frame.index === entry.count - 1
          ? encodedLength - frame.index * ClientIpcCodec.partChars
          : ClientIpcCodec.partChars;
      if (frame.index >= entry.count || frame.data.length !== expected) {
        this.discard(key, now);
        return null;
      }
      if (entry.parts[frame.index] !== undefined) {
        if (entry.parts[frame.index] !== frame.data) this.discard(key, now);
        return null;
      }
      entry.parts[frame.index] = frame.data;
      entry.received++;
      entry.characters += frame.data.length;
      entry.last = now;
      return null;
    }
    this.discard(key, now);
    if (entry.received !== entry.count || entry.characters !== Math.ceil((entry.size * 4) / 3))
      return null;
    return this.unpack(entry.parts.join(''), entry.digest, entry.size);
  }

  private unpack(encoded: string, digest: string, expected: number): IpcMessage | null {
    try {
      const bytes = ClientIpcCodec.decode(encoded);
      if ((expected >= 0 && bytes.length !== expected) || ClientIpcCodec.checksum(bytes) !== digest)
        return null;
      return ClientIpcCodec.deserialize(bytes);
    } catch {
      return null;
    }
  }

  private discard(key: string, now: number): void {
    this.active.delete(key);
    this.remember(key, now);
  }

  private remember(key: string, now: number): void {
    if (this.recent.has(key) || this.recent.size >= 2048) return;
    this.recent.set(key, now + 300000);
    const peer = this.replayPeer(key);
    this.peerRecent.set(peer, (this.peerRecent.get(peer) ?? 0) + 1);
  }

  private replayPeer(key: string): string {
    return key.slice(0, key.lastIndexOf(':'));
  }
}
