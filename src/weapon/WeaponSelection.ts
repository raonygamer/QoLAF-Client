import type { Player, PlayerShip } from '../game/Bindings';
import type { RenderedGameObject } from '../game/RenderedGameObject';

/** Original Player pending-switch ownership and acknowledgement bookkeeping. */
export class WeaponSelection {
  private generation = 0;
  pendingGeneration = 0;
  resolvedGeneration = 0;
  resolvedSuccessfully = false;
  requestedKey = '';
  resolvedKey = '';
  acknowledgedKey = '';
  private pendingShip: PlayerShip | null = null;
  private pendingLifecycle = 0;
  private pendingIndex = -1;
  private previousIndex = -1;

  constructor(private readonly player: Player) {}

  private lifecycle(ship: RenderedGameObject): number {
    return ship.get_lifecycleId?.() ?? 0;
  }

  private ownsShip(): boolean {
    return (
      this.pendingShip !== null &&
      this.player.ship === this.pendingShip &&
      this.lifecycle(this.pendingShip) === this.pendingLifecycle
    );
  }

  canSelect(index: number): boolean {
    const weapon = index >= 0 ? this.player.ship?.weapons[index] : undefined;
    return (
      !!weapon &&
      (!this.player.isMe ||
        (weapon.active && weapon.hotkey > 0 && weapon.hotkey <= this.player.unlockedWeaponSlots))
    );
  }

  acceptReceived(index: number): boolean {
    if (!this.canSelect(index)) return false;
    if (
      this.player.isMe &&
      (this.player.ship?.weaponIsChanging || this.pendingGeneration !== 0) &&
      index !== this.player.selectedWeaponIndex
    )
      return false;
    this.player.selectedWeaponIndex = index;
    return true;
  }

  request(hotkey: number, send: () => void): number {
    if (this.pendingGeneration !== 0) {
      if (this.ownsShip()) return 0;
      this.resolve(false, this.acknowledgedKey);
    }
    const ship = this.player.ship;
    if (!hotkey || !ship || ship.weaponIsChanging) return 0;
    const index = ship.weapons.findIndex((weapon) => weapon?.active && weapon.hotkey === hotkey);
    if (index < 0) return 0;
    const generation = (this.generation = (this.generation + 1) >>> 0 || 1);
    this.pendingGeneration = generation;
    this.requestedKey = ship.weapons[index].key;
    this.pendingShip = ship;
    this.pendingLifecycle = this.lifecycle(ship);
    this.pendingIndex = index;
    this.previousIndex = this.player.selectedWeaponIndex;
    try {
      // Native sendChangeWeapon owns local selection, firing stops and the wire call.
      send();
    } catch (error) {
      if (this.pendingGeneration === generation) this.failed();
      throw error;
    }
    return generation;
  }

  acknowledge(index: number): void {
    const ship = this.player.ship;
    if (!ship) {
      this.resolve(false, '');
      return;
    }
    if (!this.canSelect(index)) {
      this.failed();
      return;
    }
    this.acknowledgedKey = ship.weapons[index].key;
    this.resolve(
      this.ownsShip() && this.pendingIndex === index && this.requestedKey === this.acknowledgedKey,
      this.acknowledgedKey,
    );
  }

  failed(): void {
    if (this.pendingGeneration !== 0) {
      if (this.ownsShip()) {
        const ship = this.pendingShip!;
        if (this.previousIndex >= 0 && this.previousIndex < ship.weapons.length)
          this.player.selectedWeaponIndex = this.previousIndex;
        ship.weaponIsChanging = false;
      }
      this.resolve(false, this.acknowledgedKey);
    } else if (this.player.ship) this.player.ship.weaponIsChanging = false;
  }

  private resolve(success: boolean, key: string): void {
    if (this.pendingGeneration === 0) return;
    this.resolvedGeneration = this.pendingGeneration;
    this.resolvedSuccessfully = success;
    this.resolvedKey = key;
    this.pendingGeneration = 0;
    this.pendingIndex = this.previousIndex = -1;
    this.pendingShip = null;
    this.pendingLifecycle = 0;
  }
}
