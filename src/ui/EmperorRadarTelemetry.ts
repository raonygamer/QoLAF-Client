import type { Sprite, StarlingTextField, GameScene } from '../game/Bindings';
import { TextureLocator, MessageLog } from '../game/Bindings';
import { EmperorReadyNotifier } from '../ipc/EmperorReadyNotifier';
import { NexarEnemyIdentification } from '../ship/NexarEnemyIdentification';
import { NativeUI } from './NativeUI';

/** Original three 22px rows, native boss icons, and shared observation colors. */
export class EmperorRadarTelemetry {
  readonly node: Sprite;
  blockHeight = 0;
  private labels: StarlingTextField[] = [];
  private observedMask = 0;
  private observedIds = [-1, -1, -1];
  private defeatNotified = false;
  private readonly names = ['Emperor Xhersix', 'Emperor Yhgvis', 'Emperor Zharix'];

  constructor(
    private ui: NativeUI,
    private game: GameScene,
  ) {
    this.node = ui.sprite();
    this.node.set_touchable(false);
    const textures = TextureLocator.getService();
    for (let index = 0; index < 3; index++) {
      const row = ui.sprite();
      row.set_touchable(false);
      row.set_y(index * 22);
      const texture = textures?.getTextureMainByTextureName(
        ['boss_nexar_3', 'boss_nexar_2', 'boss_nexar_1'][index],
      );
      if (texture) {
        const icon = ui.image(texture);
        icon.set_touchable(false);
        icon.set_textureSmoothing('bilinear');
        const scale = Math.min(
          18 / Math.max(1, icon.get_width()),
          18 / Math.max(1, icon.get_height()),
        );
        icon.set_scaleX(scale);
        icon.set_scaleY(scale);
        ui.place(
          icon,
          Math.round((18 - icon.get_width()) / 2),
          Math.round((22 - icon.get_height()) / 2),
          row,
        );
      }
      const label = ui.text(285, 22, '', 10, 0xff7188, 'left', 'QoLAF_Verdana16');
      label.set_batchable(true);
      ui.place(label, 23, 0, row);
      this.labels.push(label);
      this.node.addChild(row);
    }
  }

  refresh(): void {
    const tracker = EmperorReadyNotifier.instance;
    const ownTracker = tracker?.owns(this.game) ? tracker : null;
    this.refreshDefeat(ownTracker);
    const visible = EmperorReadyNotifier.isCoordinationArea(this.game);
    this.blockHeight = visible ? 66 : 0;
    this.node.set_visible(visible);
    if (!visible) return;
    this.names.forEach((name, index) => {
      const state = ownTracker?.status(name);
      let text = name.slice(8),
        color: number;
      if (state?.known && state.reconstructing) {
        text += ' (reconstructing) (' + Math.max(1, Math.ceil(state.reconstructMs / 1000)) + 's)';
        color = 0xf2c94c;
      } else if (!state?.known) {
        text += ' (unknown)';
        color = 0x9aa3b2;
      } else if (state.ready) {
        text += ' (ready)';
        if (state.hp >= 0)
          text += ' (' + String(state.hp).replace(/\B(?=(\d{3})+(?!\d))/g, ',') + ' HP left)';
        color = 0x55d9d0;
      } else {
        text += ' (not ready)';
        color = 0xff7188;
      }
      const label = this.labels[index];
      if (label.get_text() !== text) label.set_text(text);
      const format = label.get_format();
      if (format.get_color() !== color) format.set_color(color);
    });
  }

  private refreshDefeat(tracker: EmperorReadyNotifier | null): void {
    const enemies = this.game.shipManager?.enemies;
    if (!enemies) return;
    let currentMask = 0;
    for (const enemy of enemies) {
      if (!enemy) continue;
      const index = this.names.indexOf(NexarEnemyIdentification.displayName(enemy.get_name()));
      if (index < 0) continue;
      this.observedIds[index] = enemy.get_id();
      currentMask |= 1 << index;
    }
    if (this.defeatNotified) {
      if (!currentMask) return;
      this.observedMask = currentMask;
      this.defeatNotified = false;
    }
    this.observedMask |= currentMask;
    if (this.observedMask !== 7 || currentMask !== 0) return;
    this.defeatNotified = true;
    if (tracker)
      tracker.notifyTrioRemoved(this.observedIds[0], this.observedIds[1], this.observedIds[2]);
    else MessageLog.write("<font color='#ffcc33'>Three Emperors were defeated!</font>");
  }
}
