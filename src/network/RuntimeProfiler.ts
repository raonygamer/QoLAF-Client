interface Timing {
  name: string;
  count: number;
  total: number;
  maximum: number;
}

/** Original bounded, opt-in CPU sampler. No per-frame or per-packet history survives a sample. */
export class RuntimeProfiler {
  active = false;
  trafficAvailable = true;
  private sampleStart = 0;
  private frames = 0;
  private frameIntervals: number[] = [];
  private frameIntervalSum = 0;
  private frameIntervalMaximum = 0;
  private rx = 0;
  private tx = 0;
  private seenRX = new WeakSet<object>();
  private timings = new Map<string, Timing>();
  private lastSummary = 'Waiting for the first one-second sample...';

  constructor(
    private now: () => number = () => Math.floor(performance.now()),
    private memory: () => number | null = () => null,
  ) {}
  setActive(value: boolean): void {
    if (this.active === value) return;
    this.active = value;
    this.reset();
  }
  reset(): void {
    this.clearSample(this.now());
    this.seenRX = new WeakSet();
    this.lastSummary = 'Waiting for the first one-second sample...';
  }
  private clearSample(now: number): void {
    this.sampleStart = now;
    this.frames = this.frameIntervalSum = this.frameIntervalMaximum = this.rx = this.tx = 0;
    this.frameIntervals = [];
    this.timings.clear();
  }
  frame(seconds: number): void {
    if (!this.active || !Number.isFinite(seconds) || seconds < 0) return;
    this.frames++;
    const milliseconds = seconds * 1000;
    this.frameIntervalSum += milliseconds;
    this.frameIntervalMaximum = Math.max(this.frameIntervalMaximum, milliseconds);
    if (this.frameIntervals.length < 512) this.frameIntervals.push(milliseconds);
  }
  record(name: string, milliseconds: number): void {
    if (!this.active || !Number.isFinite(milliseconds) || milliseconds < 0) return;
    let stat = this.timings.get(name);
    if (!stat) {
      stat = { name, count: 0, total: 0, maximum: 0 };
      this.timings.set(name, stat);
    }
    stat.count++;
    stat.total += milliseconds;
    stat.maximum = Math.max(stat.maximum, milliseconds);
  }
  lap(name: string, start: number): number {
    const now = this.now();
    this.record(name, now - start);
    return now;
  }
  recordRX(message: object | null): void {
    if (!this.active || !message || this.seenRX.has(message)) return;
    this.seenRX.add(message);
    this.rx++;
  }
  recordTX(message: object | null): void {
    if (this.active && message) this.tx++;
  }
  format(): string {
    const now = this.now(),
      elapsed = now - this.sampleStart;
    if (this.active && elapsed >= 1000) {
      const seconds = elapsed / 1000;
      this.frameIntervals.sort((left, right) => left - right);
      const p95 =
        this.frameIntervals[Math.max(0, Math.ceil(this.frameIntervals.length * 0.95) - 1)] ?? 0;
      const pad = (value: string, width: number) => value.padEnd(width, ' ') + ' ';
      const lines = [
        'FPS ' +
          (this.frames / seconds).toFixed(1) +
          '   Frame ms: avg ' +
          (this.frames ? (this.frameIntervalSum / this.frames).toFixed(2) : '--') +
          ' / p95 ' +
          p95.toFixed(2) +
          ' / max ' +
          this.frameIntervalMaximum.toFixed(2),
        this.trafficAvailable
          ? 'RX ' +
            (this.rx / seconds).toFixed(1) +
            ' pkt/s   TX ' +
            (this.tx / seconds).toFixed(1) +
            ' pkt/s (observed Game + Service traffic)'
          : 'RX --   TX -- (packet rates unavailable)',
        '',
        pad('CPU section', 30) +
          pad('calls/s', 10) +
          pad('avg ms', 10) +
          pad('max ms', 10) +
          'ms/s',
      ];
      const rows = [...this.timings.values()].sort((left, right) => right.total - left.total);
      for (const stat of rows)
        lines.push(
          pad(stat.name, 30) +
            pad((stat.count / seconds).toFixed(1), 10) +
            pad((stat.total / stat.count).toFixed(2), 10) +
            pad(stat.maximum.toFixed(1), 10) +
            (stat.total / seconds).toFixed(1),
        );
      if (!rows.length) lines.push('No game updates in this sample (loading or paused).');
      lines.push(
        '',
        'Sample: ' + seconds.toFixed(2) + 's. Timings have 1 ms resolution.',
        'TOTAL/state timings include child rows; do not add them together.',
        'CPU sections only, not GPU time or a full frame breakdown.',
      );
      this.lastSummary = lines.join('\n');
      this.clearSample(now);
    }
    const bytes = this.memory();
    return (
      'JS memory: ' +
      (bytes != null && Number.isFinite(bytes)
        ? (bytes / 1048576).toFixed(1) + ' MiB'
        : 'unavailable') +
      '\n' +
      this.lastSummary
    );
  }
}
