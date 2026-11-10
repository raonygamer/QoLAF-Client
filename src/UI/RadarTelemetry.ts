import type { DamageObserver } from '../Telemetry/DamageObserver';
import { read, type Raw } from '../Api/Types';
import { NativeUI } from './NativeUI';
import { Telemetry } from '../Telemetry/Telemetry';
import type { Settings } from '../Settings/Settings';
// RadarTelemetry.as: 15px rows, 10px Verdana, above the existing radar.
export class RadarTelemetry {
  readonly node: Raw;
  private labels: Raw[] = [];
  private metrics = new Telemetry();
  private elapsed = 0.1;
  private sampledShip: Raw | undefined;
  private sampledLifecycle: number | undefined;
  constructor(
    private ui: NativeUI,
    private game: Raw,
    private config: Settings,
    private damage?: DamageObserver,
  ) {
    this.node = ui.sprite();
    this.node.set_touchable(false);
    for (let i = 0; i < 5; i++) {
      const label = ui.text(i >= 4 ? 420 : 200, 15, '', 10, 0xbfc4cc, 'left', 'QoLAF_Verdana16');
      label.set_alpha(0.85);
      this.node.addChild(label);
      this.labels.push(label);
    }
  }
  update(dt: number) {
    const ship = read(this.game, 'me')?.ship,
      speed = read(ship, 'course')?.speed;
    if (ship !== this.sampledShip || ship?.lifecycleId !== this.sampledLifecycle) {
      this.sampledShip = ship;
      this.sampledLifecycle = ship?.lifecycleId;
      this.metrics.resetMotion();
    }
    this.metrics.advance(
      dt,
      ship?.landed ? 0 : speed?.x,
      ship?.landed ? 0 : speed?.y,
      !!ship?.alive && !!speed,
    );
    this.elapsed += dt;
    if (this.elapsed < 0.1) return;
    this.elapsed %= 0.1;
    const format = (value: number) =>
      Number.isFinite(value) && value >= 0 ? String(Math.round(value)) : '--';
    const lines: string[] = [];
    if (this.config.show_radar_fps) lines.push(`Frames/sec: ${format(this.metrics.fps)}`);
    if (this.config.show_radar_latency)
      lines.push(`Latency: ${format(this.game.clock?.latency)} ms`);
    if (this.config.show_radar_dps && this.damage) {
      const now = this.damage.now();
      lines.push(
        `Current DPS: ~${format(this.damage.estimate.perSecond(now))}${this.damage.estimate.isPartial(now) ? ' (partial)' : ''}`,
      );
    }
    if (this.config.show_radar_speed)
      lines.push(
        `Current speed: ${format(this.metrics.displaySpeed(this.config.radar_speed_in_mph))} ${this.config.radar_speed_in_mph ? 'mph' : 'km/h'}`,
      );
    if (this.config.show_radar_service)
      lines.push(
        `Service: ${read(this.game.serviceConnection, 'connected', false) ? read(this.game.serviceConnection, 'roomId', this.game.serviceRoomId) : 'disconnected'}`,
      );
    this.labels.forEach((label, i) => {
      const text = lines[i] ?? '';
      if (read(label, 'text') !== text) label.set_text(text);
      label.set_y(i * 15);
      label.set_visible(i < lines.length);
    });
    const radar = this.game.hud.radar;
    this.node.set_x(read(radar, 'x'));
    this.node.set_y(Math.max(0, read(radar, 'y') - lines.length * 15 - 18));
    this.node.set_visible(read(radar, 'visible') && lines.length > 0);
  }
  dispose() {
    this.ui.dispose(this.node);
  }
}
