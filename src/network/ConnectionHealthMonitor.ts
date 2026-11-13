/** Source passive timing classifier. Silence without an outstanding request is not lag. */
export class ConnectionHealthMonitor {
  private static lastWarning = new Map<string, number>();
  private observing = false;
  private activeSince = NaN;
  private lastUpdate = NaN;
  private seenSequence = 0;
  private baseline = NaN;
  private lastSlowReply = NaN;
  private slowReplies = 0;
  private healthyReplies = 0;
  private warnedEpisode = false;
  private consideredPending = NaN;
  private readonly label: 'Game' | 'Service';

  constructor(label = 'Game') {
    this.label = label === 'Service' ? 'Service' : 'Game';
  }

  updateSamples(
    active: boolean,
    sequence: number,
    sentAt: number,
    receivedAt: number,
    rtt: number,
    pendingSince: number,
    initialRtt = NaN,
    now = performance.now(),
  ): string | null {
    if (!active || !Number.isFinite(now)) {
      this.reset();
      return null;
    }
    if (Number.isFinite(this.lastUpdate) && (now < this.lastUpdate || now - this.lastUpdate > 1500))
      this.reset();
    this.lastUpdate = now;
    if (!this.observing) {
      this.observing = true;
      this.activeSince = now;
      this.seenSequence = sequence;
      if (Number.isFinite(initialRtt) && initialRtt >= 0) this.baseline = Math.max(1, initialRtt);
      return null;
    }
    if (sequence !== this.seenSequence) {
      this.seenSequence = sequence;
      if (
        Number.isFinite(sentAt) &&
        sentAt >= this.activeSince &&
        Number.isFinite(receivedAt) &&
        receivedAt >= sentAt &&
        receivedAt <= now &&
        Number.isFinite(rtt) &&
        rtt >= 0
      ) {
        if (!Number.isFinite(this.baseline)) this.baseline = Math.max(1, rtt);
        const slow =
          rtt >= 2500 || (rtt >= 1200 && rtt >= this.baseline * 2.5 && rtt - this.baseline >= 750);
        if (slow) {
          this.healthyReplies = 0;
          if (!Number.isFinite(this.lastSlowReply) || receivedAt - this.lastSlowReply > 65000)
            this.slowReplies = 0;
          this.lastSlowReply = receivedAt;
          this.slowReplies = Math.min(2, this.slowReplies + 1);
          if (this.slowReplies >= 2 && now - this.activeSince >= 3000 && this.allowWarning(now))
            return (
              this.label +
              ' connection: responses seem unusually slow. Possible cause: server load or network congestion.'
            );
        } else {
          this.slowReplies = 0;
          this.lastSlowReply = NaN;
          this.healthyReplies = Math.min(2, this.healthyReplies + 1);
          if (this.healthyReplies >= 2) this.warnedEpisode = false;
          this.baseline += (Math.max(1, rtt) - this.baseline) * 0.15;
        }
      }
    }
    if (
      !Number.isFinite(pendingSince) ||
      pendingSince < this.activeSince ||
      pendingSince > now ||
      pendingSince === this.consideredPending
    )
      return null;
    const limit = Math.max(
      5000,
      Number.isFinite(this.baseline) ? Math.min(20000, this.baseline * 6) : 0,
    );
    if (now - pendingSince >= limit && now - this.activeSince >= 3000) {
      this.consideredPending = pendingSince;
      this.healthyReplies = 0;
      if (this.allowWarning(now))
        return (
          this.label +
          ' connection: still waiting for a response (' +
          ((now - pendingSince) / 1000).toFixed(1) +
          's). Possible cause: server load, packet loss, or a network interruption.'
        );
    }
    return null;
  }

  reset(): void {
    this.observing = false;
    this.activeSince =
      this.lastUpdate =
      this.baseline =
      this.lastSlowReply =
      this.consideredPending =
        NaN;
    this.seenSequence = this.slowReplies = this.healthyReplies = 0;
    this.warnedEpisode = false;
  }
  private allowWarning(now: number): boolean {
    if (this.warnedEpisode) return false;
    const previous = ConnectionHealthMonitor.lastWarning.get(this.label) ?? NaN;
    if (Number.isFinite(previous) && now >= previous && now - previous < 90000) return false;
    ConnectionHealthMonitor.lastWarning.set(this.label, now);
    this.warnedEpisode = true;
    return true;
  }
}
