import { SkinItem, Sprite, Text } from '../game/Bindings';
import { read, type API, type Raw } from '../api/Types';
import { installHangarPreviewLifecycle } from './HangarPreviewLifecycle';
import { installHangarLabels } from './HangarLabels';

function validPrice(value: unknown): boolean {
  return (
    value != null &&
    String(value).trim() !== '' &&
    Number.isFinite(Number(value)) &&
    Number(value) >= 0
  );
}

export function hasHangarPurchaseData(skin: Raw): boolean {
  return (
    skin.payVaultItem != null &&
    String(skin.payVaultItem).replace(/\s/g, '') !== '' &&
    skin.purchaseAvailable === true &&
    validPrice(skin.price)
  );
}

/** Hangar.as copies shared DB records before decorating or sorting nested upgrades. */
export function loadHangarSkinCopies(
  game: Raw,
  keys: unknown[],
  report: (text: string) => void,
): Raw[] {
  const result: Raw[] = [];
  for (const value of keys) {
    if (value == null || String(value).length === 0) continue;
    const key = String(value),
      cached = game.dataManager.loadKey('Skins', key);
    if (!cached) continue;
    try {
      const copy = JSON.parse(JSON.stringify(cached));
      if (!copy) continue;
      copy.key = key;
      for (const field of ['icon', 'price', 'salePrice', 'purchaseAvailable']) delete copy[field];
      result.push(copy);
    } catch (error) {
      report('Could not copy hangar skin ' + key + ': ' + error);
    }
  }
  return result;
}

export function installHangarCatalog(api: API, game: Raw): void {
  const hangar = api.cls('core.hud.components.Hangar')?.prototype;
  const log = api.cls('core.hud.components.chat.MessageLog');
  if (!hangar || !SkinItem || !log) return;
  installHangarPreviewLifecycle(api);
  installHangarLabels(api);
  const localize = (text: string) => api.cls('generics.Localize')?.t(text) ?? text;
  const report = (text: string) => log.write('[error] ' + text, 'error');
  api.around(hangar, 'drawMenu', function (next, ...args) {
    if (this.g !== game) return next(...args);
    const allShips = this.body?.qolafPortableCatalog === true;
    if (allShips) {
      this.mode = 3;
      this.getChildAt(0).set_text(localize('Portable Hangar'));
      const table = game.dataManager.loadTable('Skins');
      this.skins = Object.keys(table?.h ?? table ?? {});
    } else if (this.mode === this.MODE_SHOP) {
      this.skins = (this.body.obj.shopItems ?? [])
        .filter((item: Raw) => item.available)
        .map((item: Raw) => item.item);
    } else if (this.mode === this.MODE_SWITCH_SKIN) {
      const fleet = read(game, 'me').fleet;
      fleet.sort((left: Raw, right: Raw) => (left.lastUsed > right.lastUsed ? 1 : -1));
      this.skins = fleet.map((entry: Raw) => entry.skin).reverse();
    }
    this.skinsItems = loadHangarSkinCopies(game, this.skins, report);
    if (allShips || this.mode === this.MODE_SHOP) {
      for (const skin of this.skinsItems) {
        if (skin.payVaultItem == null || String(skin.payVaultItem).replace(/\s/g, '') === '')
          continue;
        const item = game.dataManager.loadKey('PayVaultItems', String(skin.payVaultItem));
        if (
          !item ||
          !Object.prototype.hasOwnProperty.call(item, 'PriceCoins') ||
          !validPrice(item.PriceCoins)
        )
          continue;
        skin.price = item.PriceCoins;
        skin.purchaseAvailable = true;
        if (game.salesManager?.isSkinSale(skin.key)) {
          const sale = game.salesManager.getSkinSale(skin.key);
          if (sale && validPrice(sale.salePrice)) skin.salePrice = sale.salePrice;
        }
      }
      this.skinsItems.sort(
        allShips
          ? (left: Raw, right: Raw) =>
              String(left.name).toLowerCase().localeCompare(String(right.name).toLowerCase())
          : (left: Raw, right: Raw) => Number(left.price ?? 0) - Number(right.price ?? 0),
      );
    } else if (this.mode === this.MODE_SWITCH_SKIN && this.skinsItems.length === 1) {
      this.skinsItems.push({
        name: localize('Empty Slot'),
        emptySlot: true,
        ship: this.skinsItems[0].ship,
      });
    }
    this.drawList();
  });
  api.around(hangar, 'setSelectedItem', function (next, ...args) {
    if (this.g !== game || this.mode !== 3) return next(...args);
    if (this.skinsItems.length) this.list.set_selectedItem(this.skinsItems[0]);
  });
  api.around(hangar, 'onSelect', function (next, event: Raw) {
    if (this.g !== game) return next(event);
    const selected = read(read(event, 'currentTarget'), 'selectedItem');
    if (!selected) return;
    try {
      this.selectedItemContainer.removeChildren(0, -1, true);
      let mode = 0;
      if (this.mode === 3 || this.mode === this.MODE_SHOP)
        mode = game.salesManager && hasHangarPurchaseData(selected) ? 1 : 2;
      if (selected.emptySlot) {
        const container = new Sprite();
        const label = new Text(15, 110);
        label.set_text(localize('Visit the hangar to get more ships.'));
        label.set_size(14);
        label.set_width(370);
        container.addChild(label);
        this.selectedItemContainer.addChild(container);
      } else this.selectedItemContainer.addChild(new SkinItem(game, selected, mode));
    } catch (error) {
      report('Fleet preview failed for ' + (selected.name ?? 'unknown ship') + ': ' + error);
    }
  });
}
