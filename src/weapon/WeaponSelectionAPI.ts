import type {} from '../game/WeaponSelection';
import type { API } from '../api/Types';
import { Player } from '../game/Bindings';
import type { WeaponSelection } from './WeaponSelection';

/** Original public Player methods and Haxe-style accessors share one state owner. */
export function installWeaponSelectionAPI(
  api: API,
  selection: (player: Player) => WeaponSelection,
): void {
  const nativeSend = Player.prototype.sendChangeWeapon;
  const properties: Record<string, PropertyDescriptor> = {
    canSelectWeaponIndex: {
      value(this: Player, index: number) {
        return selection(this).canSelect(index);
      },
    },
    acceptReceivedWeaponSelection: {
      value(this: Player, index: number) {
        return selection(this).acceptReceived(index);
      },
    },
    requestWeaponChange: {
      value(this: Player, hotkey: number) {
        return selection(this).request(hotkey, () => nativeSend.call(this, hotkey));
      },
    },
    noteWeaponChangeFailed: {
      value(this: Player) {
        selection(this).failed();
      },
    },
  };
  const fields = {
    weaponChangePendingGeneration: 'pendingGeneration',
    weaponChangeResolvedGeneration: 'resolvedGeneration',
    weaponChangeResolvedSuccessfully: 'resolvedSuccessfully',
    weaponChangeRequestedKey: 'requestedKey',
    weaponChangeResolvedKey: 'resolvedKey',
    acknowledgedWeaponKey: 'acknowledgedKey',
  } as const;
  for (const [name, field] of Object.entries(fields)) {
    const get = function (this: Player) {
      return selection(this)[field];
    };
    properties[name] = { get };
    properties[`get_${name}`] = { value: get };
  }
  for (const [name, property] of Object.entries(properties)) {
    const previous = Object.getOwnPropertyDescriptor(Player.prototype, name);
    const owner = Player.prototype;
    Object.defineProperty(owner, name, {
      configurable: true,
      ...('value' in property ? { writable: true } : {}),
      ...property,
    });
    api.defer(() => {
      const current = Object.getOwnPropertyDescriptor(owner, name);
      if (current?.value !== property.value || current?.get !== property.get) return;
      if (previous) Object.defineProperty(owner, name, previous);
      else Reflect.deleteProperty(owner, name);
    });
  }
}
