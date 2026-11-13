import { TorpedoSpawnTiming, type TorpedoTimingRow } from './TorpedoSpawnTiming';

/** Opt-in local output, batched outside projectile processing. */
export class TorpedoTimingReporter {
  active = false;
  private timing = new TorpedoSpawnTiming();
  private pending: TorpedoTimingRow[] = [];
  private dropped = 0;
  private timer: ReturnType<typeof setTimeout> | undefined;
  private generation = 0;

  constructor(private write: (text: string) => void) {}

  command(value: string): void {
    const action = value.trim().toLowerCase();
    if (action === 'off') {
      this.active = false;
      this.cancelPrint();
      while (this.pending.length || this.dropped) this.printBatch();
      this.write('Torpedo timings OFF.');
    } else if (action === '' || action === 'on' || action === 'reset') {
      this.dispose();
      this.active = true;
      this.write(
        'Torpedo timings ON. First received Xhersix spawn = 0 ms. Exact same-shooter/timestamp torpedoes count as one volley.',
      );
      this.write(
        "Stamp = time since first spawn; gap/change = this shooter's spawn interval/variation. Receive = arrival interval; jitter = receive minus spawn gap; drift = arrival offset since first. All ms. /torptiming off stops.",
      );
    } else this.write('Usage: /torptiming [on|off|reset]');
  }

  observe(ownerId: number, spawnTime: number, receivedAt: number): void {
    if (!this.active) return;
    try {
      const row = this.timing.observe(ownerId, spawnTime, receivedAt);
      if (!row) return;
      if (this.pending.length >= 64) {
        this.pending.shift();
        this.dropped++;
      }
      this.pending.push(row);
      this.schedulePrint();
    } catch {
      this.dispose();
    }
  }

  private schedulePrint(): void {
    if (this.timer !== undefined || !this.active || !this.pending.length) return;
    const epoch = this.generation;
    this.timer = setTimeout(() => {
      if (epoch !== this.generation) return;
      this.timer = undefined;
      try {
        this.printBatch();
        this.schedulePrint();
      } catch {
        this.dispose();
      }
    }, 16);
  }

  private printBatch(): void {
    if (this.dropped) {
      this.write(`[Torps] ${this.dropped} timing rows omitted: local output queue full.`);
      this.dropped = 0;
    }
    for (const row of this.pending.splice(0, 8)) this.write(TorpedoTimingReporter.format(row));
  }

  private static format(row: TorpedoTimingRow): string {
    const ms = (value: number, signed = false): string =>
      !Number.isFinite(value) ? '--' : (signed && value > 0 ? '+' : '') + value.toFixed(1) + ' ms';
    return (
      `[Torps #${row.index} E${row.ownerId}] stamp ${ms(row.spawnElapsedMs)}` +
      ` | gap ${ms(row.spawnGapMs)} (change ${ms(row.gapChangeMs, true)})` +
      ` | receive ${ms(row.arrivalGapMs)} (jitter ${ms(row.arrivalJitterMs, true)})` +
      ` | drift ${ms(row.arrivalDriftMs, true)}${row.outOfOrder ? ' [OUT OF ORDER]' : ''}`
    );
  }

  private cancelPrint(): void {
    if (this.timer !== undefined) clearTimeout(this.timer);
    this.timer = undefined;
    this.generation++;
  }

  dispose(): void {
    this.active = false;
    this.cancelPrint();
    this.pending = [];
    this.dropped = 0;
    this.timing.reset();
  }
}
