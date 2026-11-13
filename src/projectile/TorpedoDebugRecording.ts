import { CLIENT_BUILD, CLIENT_VERSION_LABEL } from '../login/LoginIdentity';
import { TorpedoDebugHistory, type TorpedoTickSnapshot } from './TorpedoDebugHistory';
import {
  TorpedoDebugLog,
  type TorpedoLogExport,
  type TorpedoLogFields,
  type TorpedoLogValue,
} from './TorpedoDebugLog';
import type { TorpedoDebugOverlay } from './TorpedoDebugOverlay';
import { TorpedoDebugTracker } from './TorpedoDebugTracker';

export interface TorpedoRecordingClock {
  localMs: number;
  serverEstimateMs: number;
  simulationMs: number;
  oneWayLatencyMs: number;
}

export interface TorpedoRecordingHost {
  clock(): TorpedoRecordingClock;
  metadata(): {
    system: string;
    instanceType: string;
    playerId: string;
    correctionSetting: boolean;
  };
  marker(): { torpedoes: readonly TorpedoLogValue[]; players: readonly TorpedoLogValue[] };
  resetObservations(): void;
  write(text: string, type?: 'info' | 'error'): void;
  /** Returns only after handing the export to the local save mechanism; throws on failure. */
  save(recording: TorpedoLogExport): void;
}

/** Room-owned recording lifecycle, independent of gameplay and wire decoding. */
export class TorpedoDebugRecording {
  readonly tracker: TorpedoDebugTracker;
  private readonly history: TorpedoDebugHistory;
  private readonly log = new TorpedoDebugLog();
  private recordingActive = false;
  private hasRecording = false;
  private dirtyRecording = false;
  private disposed = false;
  private sequence = 0;
  private lastDrawLocalMs = NaN;
  private clockOffset = NaN;
  private deathSaveTimer: ReturnType<typeof setTimeout> | undefined;

  constructor(
    private readonly host: TorpedoRecordingHost,
    private readonly overlay: Pick<TorpedoDebugOverlay, 'clear' | 'dispose'>,
  ) {
    this.tracker = new TorpedoDebugTracker((removedId) =>
      this.event('tracking_limit', { removedId }),
    );
    this.history = new TorpedoDebugHistory({
      available: () => this.hasRecording && !this.disposed,
      dirty: () => {
        this.dirtyRecording = true;
      },
      event: (kind, data) => this.event(kind, data),
      failed: (error) => this.observerFailed(error),
    });
  }

  get active(): boolean {
    return this.recordingActive;
  }

  command(value: string): void {
    if (this.disposed) return;
    value = value.trim();
    const split = value.indexOf(' ');
    let action = (split < 0 ? value : value.substring(0, split)).toLowerCase();
    if (!action) action = this.active ? 'off' : 'on';
    if (action === 'on') {
      if (this.active) {
        this.host.write('Torpedo debug is already recording.');
        return;
      }
      if (this.hasRecording && this.dirtyRecording) {
        this.save();
        if (this.dirtyRecording) {
          this.host.write(
            'Keep the previous recording: use /torpdbg save before starting again.',
            'error',
          );
          return;
        }
      }
      this.tracker.reset();
      this.host.resetObservations();
      this.cancelDeathSave();
      this.history.reset();
      this.sequence = 0;
      this.lastDrawLocalMs = NaN;
      this.clockOffset = NaN;
      this.log.start({
        client: `${CLIENT_VERSION_LABEL} (${CLIENT_BUILD})`,
        ...this.host.metadata(),
        sampleIntervalMs: 100,
        maxVisible: 12,
        maxTracked: 256,
        diagnosticsRevision: 3,
        tickIntervalMs: 33,
        maxTickHistory: 160,
        historyExport:
          'Deferred, deduplicated tick IDs. Sample clocks are original; requestedAfterSequence and request clocks identify the triggering event. JSONL sequence is export order. Pending overflow is explicitly reported.',
        maxPendingHistory: 160,
        historyDrainChunk: 4,
        tickPlayerFields:
          'id,x,y,vx,vy,courseTime,rotation,radius,hp,shield,renderX,renderY,invulnerable,accelerate,deaccelerate,rotateLeft,rotateRight',
        tickTorpedoFields:
          'id,generation,x,y,vx,vy,courseTime,rotation,radius,oldX,oldY,renderX,renderY,ttl,shooterId',
        note: 'Purple is an independent client-model replay of a server snapshot, NOT a live server position or an actual correction. Damage packets identify the victim, not the projectile; candidates are not attribution. Death packets name the killer/cause but do not supply a projectile ID, authoritative impact position, or impact timestamp.',
      });
      this.recordingActive = !this.log.lastError;
      this.hasRecording = this.dirtyRecording = this.active;
      if (!this.active) {
        this.host.write('Torpedo debug could not start: ' + this.log.lastError, 'error');
        return;
      }
      this.host.write(
        'Torpedo debug ON: purple = CLIENT projection, NOT a server correction; white = drawn; blue = raw server packet; green = player simulation.',
      );
      this.host.write(
        'Deaths auto-save with recent 33 ms history. /torpdbg save or /torpdbg off also saves. All data stays local.',
      );
    } else if (action === 'off') {
      this.cancelDeathSave();
      this.flushHistory('manual_stop');
      if (this.active) this.event('stop', {});
      this.recordingActive = false;
      this.overlay.clear();
      this.save();
    } else if (action === 'save') {
      this.flushHistory('manual_save');
      this.save();
    } else if (action === 'mark') {
      if (!this.active) {
        this.host.write('Enable /torpdbg first.');
        return;
      }
      this.event('mark', {
        text: split < 0 ? 'manual' : value.substring(split + 1, split + 161),
        ...this.host.marker(),
      });
      this.host.write('Torpedo debug marker recorded.');
    } else this.host.write('Usage: /torpdbg [on|off|save|mark description]');
  }

  event(kind: string, data: TorpedoLogFields): void {
    if (this.disposed) return;
    const clock = this.host.clock();
    const localMs = clock.localMs >>> 0;
    this.log.record({
      ...data,
      event: kind,
      sequence: ++this.sequence,
      localMs,
      serverEstimateMs: clock.serverEstimateMs,
      simulationMs: clock.simulationMs,
      oneWayLatencyMs: clock.oneWayLatencyMs,
      estimatedClockOffsetMs: clock.serverEstimateMs - localMs,
      lastObservedDrawAgeMs: Number.isNaN(this.lastDrawLocalMs)
        ? NaN
        : (localMs - this.lastDrawLocalMs) >>> 0,
    });
    this.dirtyRecording = true;
  }

  observeDraw(localMs: number): void {
    if (this.active) this.lastDrawLocalMs = localMs >>> 0;
  }

  recordTick(snapshot: TorpedoTickSnapshot): void {
    if (!this.active) return;
    const offset = snapshot.serverEstimateMs - (snapshot.localMs >>> 0);
    if (Number.isFinite(this.clockOffset) && Math.abs(offset - this.clockOffset) > 2) {
      this.event('clock_adjustment', {
        previousOffsetMs: this.clockOffset,
        currentOffsetMs: offset,
        deltaMs: offset - this.clockOffset,
      });
    }
    this.clockOffset = offset;
    this.history.recordTick(snapshot);
  }

  requestHistory(reason: string): void {
    if (!this.hasRecording || this.disposed) return;
    this.history.request(reason, { ...this.host.clock(), sequence: this.sequence });
  }

  /** Called after the fatal packet snapshot, before native cleanup loses the victim. */
  scheduleDeathSave(): void {
    if (!this.active) return;
    this.requestHistory('player_killed');
    if (this.deathSaveTimer !== undefined) return;
    this.deathSaveTimer = setTimeout(() => {
      this.deathSaveTimer = undefined;
      if (!this.hasRecording || this.disposed) return;
      try {
        this.flushHistory('post_death');
        this.save();
      } catch (error) {
        this.observerFailed(error);
      }
    }, 750);
  }

  private flushHistory(reason: string): void {
    this.requestHistory(reason);
    this.history.drainForSave();
  }

  private save(): void {
    this.history.drainForSave();
    const output = this.log.snapshot();
    if (!output) {
      this.host.write('Torpedo debug save failed: ' + this.log.lastError, 'error');
      return;
    }
    try {
      this.host.save(output);
    } catch (error) {
      this.host.write('Torpedo debug save failed: ' + this.errorMessage(error), 'error');
      return;
    }
    this.dirtyRecording = false;
    this.host.write('Torpedo debug saved: ' + output.fileName, 'info');
  }

  overlayFailed(error: unknown): void {
    if (this.disposed) return;
    this.recordingActive = false;
    this.overlay.clear();
    this.host.write(
      'Torpedo overlay stopped: ' +
        this.errorMessage(error) +
        '. Use /torpdbg save to keep the recording.',
      'error',
    );
  }

  observerFailed(error: unknown): void {
    if (this.disposed) return;
    this.recordingActive = false;
    const message = this.errorMessage(error);
    try {
      this.event('observer_error', { message });
    } catch {
      /* Keep cleanup independent. */
    }
    try {
      this.overlay.clear();
    } catch {
      /* Preserve recording for manual export. */
    }
    try {
      this.host.write(
        'Torpedo debug stopped after an observer error: ' +
          message +
          '. Use /torpdbg save to keep the recording.',
        'error',
      );
    } catch {
      /* The room may already be leaving. */
    }
  }

  private errorMessage(error: unknown): string {
    try {
      return error instanceof Error ? error.message : String(error);
    } catch {
      return 'Unknown local recording error.';
    }
  }

  private cancelDeathSave(): void {
    if (this.deathSaveTimer !== undefined) clearTimeout(this.deathSaveTimer);
    this.deathSaveTimer = undefined;
  }

  dispose(): void {
    if (this.disposed) return;
    this.cancelDeathSave();
    try {
      this.flushHistory('room_exit');
      if (this.hasRecording && (this.active || this.dirtyRecording)) {
        this.event('room_exit', {});
        this.save();
      }
    } catch {
      /* Room disposal must continue even if export fails. */
    } finally {
      this.recordingActive = false;
      this.disposed = true;
      this.history.reset();
      this.tracker.reset();
      try {
        this.overlay.dispose();
      } catch {
        /* Continue releasing recorder storage. */
      }
      this.log.dispose();
    }
  }
}
