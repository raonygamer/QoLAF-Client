import type { API } from '../api/Types';
import { GameReflection } from '../api/GameReflection';
import { SkinItem, type DisplayObject } from '../game/Bindings';

/** SkinItem's optional sections can remain detached in preview/spinner modes. */
export function installHangarPreviewLifecycle(api: API): void {
  const reflection = new GameReflection(api);
  const disposed = new WeakSet<SkinItem>();
  // Haxe invokes these prototype methods from its constructor. Guard each
  // step because replacing the exported class would miss lexical new calls.
  for (const method of [
    'addBuy',
    'addShip',
    'addNameAndDescription',
    'addBaseStats',
    'addSpecialStats',
    'addSpecialWeapon',
    'addPremanufacturedSkills',
    'addPremanufacturedDetails',
  ] as const) {
    reflection.around(SkinItem.prototype, method, function (next) {
      try {
        return next();
      } catch (error) {
        try {
          this.dispose();
        } catch (cleanupError) {
          api.log('SkinItem cleanup failed after construction error:', cleanupError);
        }
        throw error;
      }
    });
  }
  reflection.around(SkinItem.prototype, 'dispose', function (next) {
    if (disposed.has(this)) return;
    disposed.add(this);
    // The current native dispose owns all tracked emitters and attached children.
    // Its original-client counterpart also releases these unparented sections.
    const detached = new Set<DisplayObject>();
    for (const key of [
      'buyContainer',
      'premanufacturedDetails',
      'specialweapon',
      'premanufactured',
      'specialStats',
      'desc',
      'stats',
    ] as const) {
      const section = this[key];
      if (section && !section.get_parent()) detached.add(section);
    }
    try {
      return next();
    } finally {
      for (const section of detached) section.dispose();
    }
  });
}
