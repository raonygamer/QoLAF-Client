import type { API } from '../api/Types';
import { GameReflection } from '../api/GameReflection';
import { ShopItemBar, Localize } from '../game/Bindings';
import { RussoBitmapFontRegistry } from './RussoBitmapFontRegistry';

/** Translate the displayed item name without changing the item sent to purchases. */
export function installShopText(api: API): void {
  const reflection = new GameReflection(api);
  reflection.before(ShopItemBar.prototype, 'addDescription', function (item) {
    // Called at the end of native construction, after both label and icon exist.
    for (const label of [this.nameText, this.alreadyAquiredText, this.orText]) {
      const format = label.get_format();
      format.set_font(RussoBitmapFontRegistry.fontNameForSize(format.get_size()));
      label.autoWidth();
    }
    this.nameText.set_text(Localize.t(item.name));
    this.nameText.set_y(
      this.weaponIcon.get_y() + this.weaponIcon.get_height() / 2 - this.nameText.get_height() / 2,
    );
    this.buyWithFluxButton.set_x(this.orText.get_x() + this.orText.get_width() + 10);
    // Special-weapon troon requirements are the only direct TextField child;
    // other labels are TextBitmap and purchase controls are nested containers.
    for (let index = 0; index < this.infoContainer.get_numChildren(); index++) {
      const child = this.infoContainer.getChildAt(index);
      if (!reflection.is(child, 'starling.text.TextField')) continue;
      if (reflection.is(child, 'core.hud.components.TextBitmap')) continue;
      child.set_height(16);
      child.get_format().set_font(RussoBitmapFontRegistry.fontNameForSize(13));
    }
  });
}
