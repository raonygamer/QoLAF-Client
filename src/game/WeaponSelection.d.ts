import './Game';

declare module './Game' {
  namespace Game.core.player {
    interface Player {
      canSelectWeaponIndex(index: number): boolean;
      acceptReceivedWeaponSelection(index: number): boolean;
      requestWeaponChange(hotkey: number): number;
      noteWeaponChangeFailed(): void;
      readonly weaponChangePendingGeneration: number;
      readonly weaponChangeResolvedGeneration: number;
      readonly weaponChangeResolvedSuccessfully: boolean;
      readonly weaponChangeRequestedKey: string;
      readonly weaponChangeResolvedKey: string;
      readonly acknowledgedWeaponKey: string;
      get_weaponChangePendingGeneration(): number;
      get_weaponChangeResolvedGeneration(): number;
      get_weaponChangeResolvedSuccessfully(): boolean;
      get_weaponChangeRequestedKey(): string;
      get_weaponChangeResolvedKey(): string;
      get_acknowledgedWeaponKey(): string;
    }
  }
}
