import { DamageRumble } from './DamageRumble';
import type { ControllerDevice } from './ControllerDevices';
import { hasControllerFocus } from './ControllerFocus';
import {
  getRumbleActuator,
  playRumble,
  resetRumble,
  type RumbleActuator,
} from './ControllerRumble';
import type { API } from '../api/Types';
import { ProjectileGun, Weapon, type GameScene } from '../game/Bindings';
import { WeaponCadence } from './WeaponCadence';
import type { ControllerSettings } from './ControllerSettings';
import type { DualSenseHID } from './DualSenseHID';
import { feedbackOutput, type WeaponFeedback } from './ControllerFeedback';

export function installControllerFeedback(
  api: API,
  settings: ControllerSettings,
  hid: DualSenseHID,
  currentPad: () => ControllerDevice | null,
): void {
  const cadence = new WeakMap<Weapon, WeaponCadence>();
  const recordShot = (weapon: Weapon) => {
    if (weapon.unit !== weapon.g.get_me()?.ship) return;
    let observed = cadence.get(weapon);
    if (!observed) cadence.set(weapon, (observed = new WeaponCadence()));
    observed.shot(weapon.g.time, weapon.reloadTime);
  };
  // Network projectiles arrive through this separate native path.
  if (typeof ProjectileGun?.prototype?.shootSyncedProjectile === 'function')
    api.after(ProjectileGun.prototype, 'shootSyncedProjectile', function () {
      recordShot(this);
    });
  // SmartGun (Acid Blaster), Blaster and other local weapon families advance
  // lastFire only after their native heat check and firing loop succeed.
  if (typeof Weapon?.prototype?.update === 'function')
    api.around(Weapon.prototype, 'update', function (next) {
      const previous = this.lastFire;
      const result = next();
      if (this.type !== 'projectile' && this.lastFire !== previous && this.lastFire === this.g.time)
        recordShot(this);
      return result;
    });
  const damageRumble = new DamageRumble();
  let lastShip: object | null = null;
  let lastRoom: GameScene | null = null;
  let lastDamage = 0;
  let lastHealth = 0;

  let lastUpdate = 0;
  let active = false;
  let previousLight = false;
  let previousPopulation = false;
  let actuator: RumbleActuator | null = null;
  let rumblePending = false;
  const failedActuators = new WeakSet<RumbleActuator>();
  const logError = (error: unknown) => api.log('Controller feedback:', error);
  const reset = () => {
    if (active) {
      void hid.reset();
      void resetRumble(actuator).catch(logError);
    }
    active = false;
    lastShip = null;
    lastRoom = null;
    damageRumble.clear();
  };
  window.addEventListener('blur', reset);
  window.addEventListener('pagehide', reset);
  window.addEventListener('gamepaddisconnected', reset);
  api.defer(() => {
    reset();
    window.removeEventListener('blur', reset);
    window.removeEventListener('pagehide', reset);
    window.removeEventListener('gamepaddisconnected', reset);
  });
  api.on('frame', ({ game }) => {
    const preferences = settings.values;
    const pad = currentPad();
    const player = game.get_me();
    const ship = player?.ship;
    if (
      !preferences.enabled ||
      !pad ||
      !ship ||
      game.get_isLeaving() ||
      document.hidden ||
      !hasControllerFocus()
    ) {
      reset();
      return;
    }
    const now = performance.now();
    if (now - lastUpdate < 50) return;
    lastUpdate = now;
    active = true;
    const health = ship.hp + ship.shieldHp;
    const damageTime: unknown = ship.lastDmgTime;
    const marker = typeof damageTime === 'number' && Number.isFinite(damageTime) ? damageTime : 0;
    if (lastRoom !== game || lastShip !== ship) {
      damageRumble.clear();
    } else if (marker > lastDamage && health < lastHealth) {
      const maximum = Math.max(1, ship.get_hpMax() + ship.get_shieldHpMax());
      damageRumble.record(now, lastHealth - health, maximum);
    }
    lastRoom = game;
    lastShip = ship;
    lastHealth = health;
    lastDamage = marker;
    const weapon = ship.weapons[player.selectedWeaponIndex];
    const observed = weapon ? cadence.get(weapon)?.sample(game.time, weapon.reloadTime) : null;
    const description: WeaponFeedback | null = weapon
      ? {
          type: typeof weapon.type === 'string' ? weapon.type : '',
          interval: observed?.interval ?? weapon.reloadTime,
          nominalInterval: weapon.reloadTime,
          speed: weapon.speed,
          firing:
            ship.alive &&
            !player.get_inSafeZone() &&
            (weapon.type === 'beam' ? weapon.get_fire() : (observed?.firing ?? false)),
          charging: weapon.hasChargeUp === true,
          missile: weapon.isMissileWeapon === true,
        }
      : null;
    const output = feedbackOutput(
      preferences,
      ship.alive ? description : null,
      game.solarSystem?.key ?? '',
      game.playerManager?.get_players().length ?? game.shipManager.players.length,
      damageRumble.intensity(now),
      ship.get_usingBoost(),
    );
    // Explicitly relinquish lights on a toggle transition; absence alone means "leave unchanged".
    if (previousLight && !preferences.systemLight) output.releaseLights = true;
    if (previousPopulation && !preferences.populationLights) output.population = 0;
    previousLight = preferences.systemLight;
    previousPopulation = preferences.populationLights;
    if (hid.connected) {
      if (actuator) {
        void resetRumble(actuator).catch(logError);
        actuator = null;
      }
      hid.update(output);
    } else {
      const nextActuator = getRumbleActuator(pad);
      if (nextActuator !== actuator) {
        void resetRumble(actuator).catch(logError);
        actuator = nextActuator;
      }
      if (!actuator || rumblePending || failedActuators.has(actuator)) return;
      const target = actuator;
      rumblePending = true;
      void playRumble(target, output.weak, output.strong)
        .catch((error) => {
          failedActuators.add(target);
          logError(error);
        })
        .finally(() => {
          rumblePending = false;
        });
    }
  });
}
