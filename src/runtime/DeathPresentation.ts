import type { API } from '../api/Types';
import { KilledPlayerState, StarlingTextField, type TextFormat } from '../game/Bindings';
import { RussoBitmapFontRegistry } from '../ui/RussoBitmapFontRegistry';

/** Source death-screen atlas sizes, including the countdown-to-instruction transition. */
export function installDeathPresentation(api: API): void {
  const originals = new WeakMap<
    TextFormat,
    { font: string; size: number; applied: string; appliedSize: number }
  >();
  const formats = new Set<WeakRef<TextFormat>>();
  const apply = (field: StarlingTextField, atlasSize: number, size?: number) => {
    const format = field.get_format();
    const font = RussoBitmapFontRegistry.fontNameForSize(atlasSize);
    const finalSize = size ?? format.get_size();
    if (format.get_font() === font && format.get_size() === finalSize) return false;
    let original = originals.get(format);
    if (!original) {
      original = {
        font: format.get_font(),
        size: format.get_size(),
        applied: font,
        appliedSize: finalSize,
      };
      originals.set(format, original);
      formats.add(new WeakRef(format));
    }
    original.applied = font;
    original.appliedSize = finalSize;
    format.set_size(finalSize);
    format.set_font(font);
    return true;
  };
  api.after(KilledPlayerState.prototype, 'enter', function () {
    if (!this.player.isMe || !this.box) return;
    for (let index = 0; index < this.box.get_numChildren(); index++) {
      const field = this.box.getChildAt(index);
      if (!(field instanceof StarlingTextField)) continue;
      if (field === this.respawnText || field === this.uberText) {
        apply(field, 52, 52);
        field.alignPivot();
      } else apply(field, field === this.deathInfo ? 20 : 12, 12);
    }
  });
  api.after(KilledPlayerState.prototype, 'execute', function () {
    if (!this.player.isMe || !this.respawnText) return;
    const field = this.respawnText;
    if (apply(field, field.get_format().get_size())) field.alignPivot();
  });
  api.defer(() => {
    for (const reference of formats) {
      const format = reference.deref();
      const original = format && originals.get(format);
      if (!format || !original) continue;
      if (format.get_font() === original.applied) format.set_font(original.font);
      if (format.get_size() === original.appliedSize) format.set_size(original.size);
    }
    formats.clear();
  });
}
