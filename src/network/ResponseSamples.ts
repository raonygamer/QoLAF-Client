export class ResponseSamples {
  sequence = 0;
  sentAt = NaN;
  receivedAt = NaN;
  rtt = NaN;
  private pending = new Map<object, number>();

  get pendingSince(): number {
    return this.pending.values().next().value ?? NaN;
  }

  replyOldest(): void {
    const token = this.pending.keys().next().value;
    if (token) this.reply(token);
  }

  request(): object {
    const token = {};
    this.pending.set(token, performance.now());
    return token;
  }
  reply(token: object): void {
    const sentAt = this.pending.get(token);
    this.pending.delete(token);
    if (sentAt === undefined) return;
    const now = performance.now();
    if (now < sentAt) return;
    this.sequence++;
    this.sentAt = sentAt;
    this.receivedAt = now;
    this.rtt = now - sentAt;
  }
  cancel(token: object): void {
    this.pending.delete(token);
  }
  reset(): void {
    this.pending.clear();
    this.sequence = 0;
    this.sentAt = this.receivedAt = this.rtt = NaN;
  }
}
