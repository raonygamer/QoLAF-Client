import { rewardRates } from '../telemetry/NativeRewardRates';
import { ClientIPCService } from '../ipc/ClientIPCService';
import { servicePoolFor } from '../service/ServicePools';
import { SceneBase, type Sprite, type StarlingTextField } from '../game/Bindings';
import type { GameScene, PlayerShip } from '../game/Bindings';
import type { RenderedGameObject } from '../game/RenderedGameObject';
import { EmperorRadarTelemetry } from './EmperorRadarTelemetry';
import { bossSpawnTimers } from '../boss/NativeBossSpawnTimers';
import { BossTimerRadarTelemetry } from './BossTimerRadarTelemetry';
import type { DamageObserver } from '../telemetry/DamageObserver';
import { NativeUI } from './NativeUI';
import { Telemetry } from '../telemetry/Telemetry';
import type { Settings } from '../settings/Settings';
// RadarTelemetry.as: 15px rows, 10px Verdana, above the existing radar.
export class RadarTelemetry {
  readonly node: Sprite;
  private labels: StarlingTextField[] = [];
  private emperors: EmperorRadarTelemetry;
  private bossTimers: BossTimerRadarTelemetry;
  private metrics = new Telemetry();
  private elapsed = 0.1;
  private sampledShip: PlayerShip | undefined;
  private sampledLifecycle: number | undefined;
  constructor(
    private ui: NativeUI,
    private game: GameScene,
    private config: Settings,
    private damage?: DamageObserver,
  ) {
    this.node = ui.sprite();
    this.node.set_touchable(false);
    this.bossTimers = new BossTimerRadarTelemetry(ui);
    this.emperors = new EmperorRadarTelemetry(ui, game);
    this.node.addChild(this.emperors.node);
    for (let i = 0; i < 9; i++) {
      const label = ui.text(i >= 4 ? 420 : 200, 15, '', 10, 0xbfc4cc, 'left', 'QoLAF_Verdana16');
      label.set_alpha(0.85);
      label.set_batchable(true);
      if (i >= 4) label.set_wordWrap(true);
      this.node.addChild(label);
      this.labels.push(label);
    }
    this.node.addChild(this.bossTimers.node);
  }
  update(dt: number) {
    if (this.game.get_isLeaving()) return;
    const ship: (PlayerShip & RenderedGameObject) | undefined =
      this.game.get_me()?.ship ?? undefined;
    const speed = ship?.get_course()?.speed;
    const lifecycle = ship?.get_lifecycleId?.();
    if (ship !== this.sampledShip || lifecycle !== this.sampledLifecycle) {
      this.sampledShip = ship;
      this.sampledLifecycle = lifecycle;
      this.metrics.resetMotion();
    }
    this.metrics.advance(
      dt,
      ship?.get_landed() ? 0 : (speed?.x ?? 0),
      ship?.get_landed() ? 0 : (speed?.y ?? 0),
      !!ship?.alive && !!speed,
    );
    this.elapsed += dt;
    if (this.elapsed < 0.1) return;
    this.elapsed %= 0.1;
    const format = (value: number) =>
      Number.isFinite(value) && value >= 0 ? String(Math.round(value)) : '--';
    this.emperors.refresh();
    const emperorHeight = this.emperors.blockHeight;
    const radar = this.game.hud?.radar;
    if (!radar) return;
    const stage = this.game.get_stage();
    const availableWidth = stage ? stage.get_stageWidth() - radar.get_x() - 8 : 420;
    const serviceWidth = Math.max(1, Math.min(420, availableWidth));
    const lines: (string | null)[] = [
      this.config.show_radar_fps ? `Frames/sec: ${format(this.metrics.fps)}` : null,
      this.config.show_radar_latency
        ? `Latency: ${format(this.game.clock?.latency ?? NaN)} ms`
        : null,
      null,
      this.config.show_radar_speed
        ? `Current speed: ${format(this.metrics.displaySpeed(this.config.radar_speed_in_mph))} ${this.config.radar_speed_in_mph ? 'mph' : 'km/h'}`
        : null,
      null,
      null,
    ];
    if (this.config.show_radar_dps && this.damage) {
      const now = this.damage.now();
      lines[2] = `Current DPS: ~${format(this.damage.estimate.perSecond(now))}${this.damage.estimate.isPartial(now) ? ' (partial)' : ''}`;
    }
    if (this.config.show_radar_service) {
      const connection = this.game.serviceConnection;
      let service = `Service: ${connection?.get_connected() ? connection.get_roomId() : 'disconnected'}`;
      const extraServices = servicePoolFor(this.game)?.connectedRoomIds(this.game) ?? [];
      if (extraServices.length) service += ' / ' + extraServices.join(' / ');
      lines[4] = service;
      lines[5] = `Service IPC: ${ClientIPCService.instance?.statusText ?? 'disconnected'}`;
    }
    const rates = rewardRates(this.game)?.perHour(
      performance.now(),
      this.config.radar_count_recycled_arts,
    );
    lines.push(
      this.config.show_radar_xp ? `XP/h: ${format(rates?.xp ?? 0)}` : null,
      this.config.show_radar_cargo ? `Cargo/h: ${format(rates?.cargo ?? 0)}` : null,
      this.config.show_radar_arts ? `Arts/h: ${format(rates?.artifacts ?? 0)}` : null,
    );
    let textHeight = 0;
    this.labels.forEach((label, index) => {
      const text = lines[index];
      label.set_visible(text !== null);
      if (text === null) return;
      const changed = label.get_text() !== text;
      if (changed) label.set_text(text);
      if (index >= 4 && (changed || label.get_width() !== serviceWidth)) {
        label.set_autoSize('vertical');
        label.set_width(serviceWidth);
        const height = Math.max(15, Math.ceil(label.get_textBounds().height / 15) * 15);
        label.set_autoSize('none');
        label.set_height(height);
      }
      label.set_y(emperorHeight + textHeight);
      textHeight += Math.max(15, Math.ceil(label.get_height() / 15) * 15);
    });
    const secondary = SceneBase.clientSettings?.showSecondaryBossTimers === true;
    this.bossTimers.refresh(bossSpawnTimers(this.game).rows(secondary), availableWidth);
    this.bossTimers.node.set_y(emperorHeight + textHeight);
    const height = emperorHeight + textHeight + this.bossTimers.blockHeight;
    this.node.set_x(radar.get_x());
    this.node.set_y(Math.max(0, radar.get_y() - height - 18));
    this.node.set_visible(radar.get_visible() && height > 0);
  }
  dispose() {
    this.ui.dispose(this.node);
  }
}
