import type { API } from '../api/Types';
import { GameReflection } from '../api/GameReflection';
import { EliteTechIcon, EliteTechPopupMenu, TechLevelIcon } from '../game/Bindings';
import { VerdanaBitmapFontRegistry } from '../ui/VerdanaBitmapFontRegistry';
import type {} from '../game/TechLevelIcon';

/** Source tech-label fonts and compact specialization rows, using native controls. */
export function installTechPresentation(api: API): void {
  const reflection = new GameReflection(api);
  const owner = TechLevelIcon.prototype;
  const getTechBar = function (this: TechLevelIcon) {
    return this.tb;
  };
  for (const [name, descriptor] of Object.entries({
    techBar: { get: getTechBar },
    get_techBar: { value: getTechBar, writable: true },
  })) {
    const previous = Object.getOwnPropertyDescriptor(owner, name);
    Object.defineProperty(owner, name, { configurable: true, ...descriptor });
    api.defer(() => {
      const current = Object.getOwnPropertyDescriptor(owner, name);
      if (current?.get !== descriptor.get || current?.value !== descriptor.value) return;
      if (previous) Object.defineProperty(owner, name, previous);
      else Reflect.deleteProperty(owner, name);
    });
  }
  const initialized = new WeakSet<object>();
  for (const [prototype, size] of [
    [EliteTechIcon.prototype, 12],
    [TechLevelIcon.prototype, 13],
  ] as const) {
    reflection.before(prototype, 'updateState', function () {
      if (!this.number || initialized.has(this.number)) return;
      const format = this.number.get_format();
      if (!format) return;
      format.set_font(VerdanaBitmapFontRegistry.fontNameForSize(size));
      format.set_size(size);
      initialized.add(this.number);
    });
  }
  reflection.after(EliteTechPopupMenu.prototype, 'load', function () {
    let top = 0;
    for (const row of this.eliteTechs) {
      row.set_y(top);
      // AS3 accumulated into an int, truncating after each row.
      top = Math.trunc(top + row.get_height() + 3);
    }
  });
}
