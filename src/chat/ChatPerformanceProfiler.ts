import { CLIENT_BUILD, CLIENT_VERSION_LABEL } from '../login/LoginIdentity';

interface Statistic {
  count: number;
  total: number;
  maximum: number;
  values: number[];
}
type Sample = [number, string, string, number, number, number];
export interface ChatProfileExport {
  fileName: string;
  content: string;
}

/** Original bounded samples and exact percentile summaries; no network IO. */
export class ChatPerformanceProfiler {
  static active = false;
  private static startedAt = 0;
  private static startedMemory = NaN;
  private static sessionName = 'chat';
  private static samples: Sample[] = [];
  private static statistics = new Map<string, Statistic>();
  private static frameTimes = new Map<string, number>();

  static now(): number {
    return Math.floor(performance.now());
  }

  private static memory(): number {
    // Browser heap telemetry is optional and is not AIR process memory.
    const memory: unknown = Reflect.get(performance, 'memory');
    if (!memory || typeof memory !== 'object') return NaN;
    const bytes: unknown = Reflect.get(memory, 'usedJSHeapSize');
    return typeof bytes === 'number' ? bytes / 1048576 : NaN;
  }

  static start(name: string): void {
    this.sessionName =
      name
        .toLowerCase()
        .replace(/[^a-z0-9_-]+/g, '-')
        .replace(/^-+|-+$/g, '') || 'chat';
    this.startedAt = this.now();
    this.startedMemory = this.memory();
    this.samples = [];
    this.statistics.clear();
    this.frameTimes.clear();
    this.active = true;
    this.record('session', 'start', 0, this.startedMemory, 0);
  }

  static record(path: string, phase: string, duration: number, value1 = NaN, value2 = NaN): void {
    if (!this.active) return;
    const key = path + '.' + phase;
    let stat = this.statistics.get(key);
    if (!stat) {
      stat = { count: 0, total: 0, maximum: 0, values: [] };
      this.statistics.set(key, stat);
    }
    stat.count++;
    stat.total += duration;
    stat.maximum = Math.max(stat.maximum, duration);
    stat.values.push(duration);
    if (this.samples.length < 20000)
      this.samples.push([this.now() - this.startedAt, path, phase, duration, value1, value2]);
  }

  static frame(path: string): void {
    if (!this.active) return;
    const now = this.now();
    const previous = this.frameTimes.get(path);
    this.frameTimes.set(path, now);
    if (previous !== undefined && previous !== 0)
      this.record(path, 'frame_interval', now - previous, this.memory(), 0);
  }

  static finish(status: string): ChatProfileExport | null {
    if (!this.active) return null;
    this.record('session', status, this.now() - this.startedAt, this.startedMemory, this.memory());
    this.active = false;
    const number = (value: number) => (Number.isNaN(value) ? '' : value.toFixed(3));
    const csv = (value: string) => '"' + value.replace(/"/g, '""') + '"';
    const lines = [
      '# QoLAF chat performance profile',
      `# version,${CLIENT_VERSION_LABEL} (${CLIENT_BUILD})`,
      `# chat_view,${this.sessionName}`,
      `# status,${status}`,
      `# duration_ms,${this.now() - this.startedAt}`,
      `# start_memory_mb,${number(this.startedMemory)}`,
      `# end_memory_mb,${number(this.memory())}`,
      '# memory_source,browser_used_js_heap_when_available',
      '',
      'summary_metric,count,total_ms,average_ms,p50_ms,p95_ms,max_ms',
    ];
    for (const key of [...this.statistics.keys()].sort()) {
      const stat = this.statistics.get(key);
      if (!stat) continue;
      const values = [...stat.values].sort((a, b) => a - b);
      const percentile = (ratio: number) =>
        values[Math.min(values.length - 1, Math.max(0, Math.ceil(values.length * ratio) - 1))] ??
        NaN;
      lines.push(
        [
          csv(key),
          stat.count,
          number(stat.total),
          number(stat.total / stat.count),
          number(percentile(0.5)),
          number(percentile(0.95)),
          number(stat.maximum),
        ].join(','),
      );
    }
    lines.push('', 'sample_elapsed_ms,path,phase,duration_ms,value1,value2');
    for (const [elapsed, path, phase, duration, value1, value2] of this.samples)
      lines.push(
        [
          number(elapsed),
          csv(path),
          csv(phase),
          number(duration),
          number(value1),
          number(value2),
        ].join(','),
      );
    return {
      fileName: `Astroflux-chat-profile-${this.sessionName}.csv`,
      content: lines.join('\n') + '\n',
    };
  }
}
