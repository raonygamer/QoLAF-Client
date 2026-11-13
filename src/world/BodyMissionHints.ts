import type { API } from '../api/Types';
import { Body, type StarlingTextField } from '../game/Bindings';
import { RussoBitmapFontRegistry } from '../ui/RussoBitmapFontRegistry';

/** Apply the original mission-marker atlas after native factory text initialization. */
export function installBodyMissionHints(api: API): void {
  const originals = new WeakMap<StarlingTextField, { font: string; snapping: boolean }>();
  const fields = new Set<WeakRef<StarlingTextField>>();
  api.before(Body.prototype, 'preDraw', function () {
    const field = this.missionHint;
    if (!this.canTriggerMission || !field) return;
    if (!originals.has(field)) {
      originals.set(field, {
        font: field.get_format().get_font(),
        snapping: field.get_pixelSnapping(),
      });
      fields.add(new WeakRef(field));
    }
    field.get_format().set_font(RussoBitmapFontRegistry.COMBAT_FONT_NAME);
    field.set_pixelSnapping(true);
  });
  api.after(Body.prototype, 'reset', function () {
    // Native reset already stops the tween. Release the marker's display/GPU
    // resources too, as the original client does when leaving the room.
    this.hintTween = null;
    const field = this.missionHint;
    if (!field) return;
    originals.delete(field);
    this.missionHint = null;
    field.removeFromParent();
    field.dispose();
  });
  api.defer(() => {
    for (const reference of fields) {
      const field = reference.deref();
      const original = field && originals.get(field);
      if (!field || !original) continue;
      const format = field.get_format();
      if (format.get_font() === RussoBitmapFontRegistry.COMBAT_FONT_NAME)
        format.set_font(original.font);
      if (field.get_pixelSnapping()) field.set_pixelSnapping(original.snapping);
    }
    fields.clear();
  });
}
