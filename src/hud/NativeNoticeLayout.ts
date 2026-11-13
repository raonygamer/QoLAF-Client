import type { API } from '../api/Types';
import { GameReflection } from '../api/GameReflection';
import { Hud, type GameScene } from '../game/Bindings';
import { separateHudNotices } from './NoticeLayout';

/** The source's safe-zone and landing formulas coincide at a stage height of 1080. */
export function installNativeNoticeLayout(api: API, game: GameScene): void {
  const reflection = new GameReflection(api);
  let disposed = false;
  const layout = () => {
    const hud = game.hud,
      stage = game.get_stage();
    if (disposed || !hud || !stage || game.get_isLeaving()) return;
    const height = stage.get_stageHeight();
    const labels = [hud.safeZoneText, hud.repairText, hud.landText];
    const anchors = [height / 2 + 180, height / 2 + 210, height - height / 3];
    // Re-evaluate from native anchors without dirtying display positions twice per frame.
    const visible = labels
      .map((label, index) => ({ label, index }))
      .filter(({ label }) => label.get_visible() && label.get_parent());
    const positions = separateHudNotices(
      visible.map(({ label, index }) => ({
        x: label.get_x(),
        y: anchors[index],
        width: label.get_width(),
        height: label.get_height(),
      })),
    );
    visible.forEach(({ index }, position) => {
      anchors[index] = positions[position];
    });
    labels.forEach((label, index) => {
      if (label.get_y() !== anchors[index]) label.set_y(anchors[index]);
    });
  };
  reflection.after(Hud.prototype, 'resize', function () {
    if (this === game.hud) layout();
  });
  api.on('frame', ({ game: current }) => {
    if (current === game) layout();
  });
  api.defer(() => {
    disposed = true;
    if (!game.get_isLeaving()) game.hud?.resize();
  });
  layout();
}
