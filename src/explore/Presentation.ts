import type { API } from '../api/Types';
import {
  CrewDisplayBox,
  ExploreArea,
  StarlingTextField,
  type Sprite,
  type TextFormat,
} from '../game/Bindings';
import { RussoBitmapFontRegistry } from '../ui/RussoBitmapFontRegistry';

/** Font changes made by the original client, scoped to the two native labels. */
export function installExplorationPresentation(api: API): void {
  const originals = new WeakMap<TextFormat, { original: string; applied: string }>();
  const formats = new Set<WeakRef<TextFormat>>();
  const apply = (container: Sprite, size: number) => {
    for (let index = 0; index < container.get_numChildren(); index++) {
      const child = container.getChildAt(index);
      if (!(child instanceof StarlingTextField)) continue;
      const format = child.get_format();
      if (format.get_size() !== size || format.get_font() !== 'font13') continue;
      const applied = RussoBitmapFontRegistry.fontNameForSize(size);
      originals.set(format, { original: format.get_font(), applied });
      formats.add(new WeakRef(format));
      format.set_font(applied);
    }
  };
  api.after(CrewDisplayBox.prototype, 'addLocation', function (_result, box) {
    apply(box, 14);
  });
  api.after(ExploreArea.prototype, 'handleFinished', function () {
    apply(this, 20);
  });
  api.defer(() => {
    for (const reference of formats) {
      const format = reference.deref();
      const value = format && originals.get(format);
      if (format && value && format.get_font() === value.applied) format.set_font(value.original);
    }
    formats.clear();
  });
}
