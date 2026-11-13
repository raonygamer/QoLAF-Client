import { MessageLog, type GameScene } from '../game/Bindings';
import { projectileRenderTime } from '../rendering/TorpedoFrames';
import { downloadTorpedoRecording } from './TorpedoDebugDownload';
import { TorpedoDebugObserver } from './TorpedoDebugObserver';
import { TorpedoDebugOverlay } from './TorpedoDebugOverlay';
import { TorpedoDebugRecording } from './TorpedoDebugRecording';
import { TorpedoDebugSampling, type TorpedoSamplingScene } from './TorpedoDebugSampling';
import {
  TorpedoDebugPlayerSnapshots,
  type TorpedoDebugPlayerSnapshot,
} from './TorpedoDebugSnapshots';

/** One room owns its recorder, overlay, raw snapshots and pending exports. */
export class TorpedoDebugRoom {
  readonly recording: TorpedoDebugRecording;
  readonly observer: TorpedoDebugObserver;
  private readonly overlay: TorpedoDebugOverlay;
  private readonly sampling: TorpedoDebugSampling;
  private players: TorpedoDebugPlayerSnapshot[] = [];
  private disposed = false;

  constructor(
    private readonly game: GameScene,
    correctionSetting: () => boolean,
  ) {
    if (!game.canvas || !game.canvasProjectiles) throw new Error('The game canvas is not ready.');
    this.overlay = new TorpedoDebugOverlay(game.canvas, game.canvasProjectiles);
    this.recording = new TorpedoDebugRecording(
      {
        clock: () => this.clock(),
        metadata: () => ({
          system: game.solarSystem?.name ?? '',
          instanceType: game.solarSystem?.type ?? '',
          playerId: game.get_me()?.id ?? '',
          correctionSetting: correctionSetting(),
        }),
        marker: () => ({ torpedoes: this.sampling.markerEntries(), players: this.players }),
        resetObservations: () => {
          this.sampling.reset();
          this.players = [];
        },
        write: (text, type) => {
          if (MessageLog.g === game) MessageLog.write(text, type ?? 'info');
        },
        save: downloadTorpedoRecording,
      },
      this.overlay,
    );
    this.sampling = new TorpedoDebugSampling(
      this.recording.tracker,
      new TorpedoDebugPlayerSnapshots(),
    );
    this.observer = new TorpedoDebugObserver(this.recording, this.sampling, {
      clock: () => this.clock(),
      scene: () => this.scene(),
      playerById: (id) => game.playerManager?.get_playersById().h[id] ?? null,
    });
  }

  command(argument: string): void {
    if (this.disposed) return;
    try {
      this.recording.command(argument);
    } catch (error) {
      this.recording.observerFailed(error);
    }
  }

  draw(): void {
    if (this.disposed || !this.recording.active || this.game.get_isLeaving()) return;
    try {
      const clock = this.clock();
      this.recording.observeDraw(clock.localMs);
      const ownPosition = this.game.get_me()?.ship?.get_pos();
      const center = this.game.camera?.getCameraCenter() ?? ownPosition;
      const frame = this.sampling.frame(this.scene(), clock, center?.x ?? 0, center?.y ?? 0);
      this.players = frame.players;
      if (frame.sample)
        this.recording.event('frame', {
          torpedoes: frame.torpedoes,
          players: frame.players,
          selected: frame.selected,
          tracked: frame.tracked,
          frameAlpha: frame.frameAlpha,
        });
      try {
        this.overlay.render(
          frame.torpedoes,
          frame.players,
          'Purple: server snapshot projected (estimate) | White: client drawn\n' +
            'one-way latency ' +
            clock.oneWayLatencyMs.toFixed(0) +
            ' ms | world units / units per second',
          false,
          clock.localMs,
        );
      } catch (error) {
        this.recording.overlayFailed(error);
      }
    } catch (error) {
      this.recording.observerFailed(error);
    }
  }

  tick(): void {
    if (this.disposed || !this.recording.active || this.game.get_isLeaving()) return;
    try {
      const clock = this.clock();
      const position = this.game.get_me()?.ship?.get_pos();
      this.recording.recordTick(
        this.sampling.tick(
          this.scene(),
          clock,
          position?.x ?? 0,
          position?.y ?? 0,
          clock.simulationMs,
          clock.oneWayLatencyMs,
        ),
      );
    } catch (error) {
      this.recording.observerFailed(error);
    }
  }

  private clock() {
    return {
      localMs: performance.now() >>> 0,
      serverEstimateMs: this.game.clock?.getServerTime() ?? NaN,
      simulationMs: this.game.time,
      oneWayLatencyMs: this.game.clock?.latency ?? NaN,
      projectileRenderTime: projectileRenderTime(this.game),
      frameAlpha: Math.max(0, Math.min(1, (this.game.gameStateMachine?.accumulator ?? 33) / 33)),
    };
  }

  private scene(): TorpedoSamplingScene {
    return {
      projectiles: this.game.projectileManager.projectiles,
      players: this.game.shipManager.players,
      projectileById: (id) => this.game.projectileManager.projectilesById.h[id] ?? null,
      playerShipById: (id) => this.game.playerManager?.get_playersById().h[id]?.ship ?? null,
    };
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.recording.dispose();
    this.sampling.reset();
    this.players = [];
  }
}
