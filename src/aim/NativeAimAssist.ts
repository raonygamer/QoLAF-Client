import { read, type API, type Raw } from '../api/Types';
import { isMapNavigating } from '../map/NativeMapNavigation';
import type { DamageObserver } from '../telemetry/DamageObserver';
import type { TargetSystem } from '../target/TargetSystem';
import { AimAssist, aimAngleDifference } from './AimAssist';
import {
  calculateProjectileAimAngle,
  selectAimAssistTarget,
  type AimAssistSettings,
} from './AimAssistTarget';

/** Adapt source aiming to live Haxe objects without changing weapon simulation. */
export function installNativeAimAssist(
  api: API,
  game: Raw,
  settings: AimAssistSettings,
  targets: TargetSystem,
  contacts: Pick<DamageObserver, 'lastContact' | 'now'>,
): void {
  const Play = api.cls('core.states.gameStates.PlayState');
  const prototype = Play?.prototype;
  if (!prototype?.updateCommands || !prototype.updateMouseAim || !prototype.handleTurn) return;
  const states = new WeakMap<Raw, AimAssist>();
  const enabled = () => settings.getAimAssistBoolean('aim_assist_enabled');
  const automated = () => !!game.automationManager?.controlsClaimed;
  const belongs = (state: Raw) => state.g === game;
  const mouseAim = () => !!read(api.cls('core.scene.SceneBase')?.settings, 'mouseAim');
  const instanceOf = (name: string, value: Raw) => {
    const type = api.cls(name);
    return !!type?.prototype.isPrototypeOf(value);
  };
  const context = {
    get current() {
      return targets.current;
    },
    get locked() {
      return targets.locked;
    },
    lastContact: (weapon: Raw) => contacts.lastContact(weapon),
    isPlayer: (unit: Raw) => instanceOf('core.ship.PlayerShip', unit),
    isTeleport: (weapon: Raw) => instanceOf('core.weapon.Teleport', weapon),
    isBeam: (weapon: Raw) => instanceOf('core.weapon.Beam', weapon),
    isEnemyShip: (unit: Raw) => instanceOf('core.ship.EnemyShip', unit),
  };
  api.before(prototype, 'updateCommands', function () {
    if (!belongs(this)) return;
    if (automated() || isMapNavigating(game)) {
      states.get(this)?.release(automated() ? 'automation owns aim control' : 'map navigation');
      return;
    }
    let assist = states.get(this);
    if (!assist) {
      assist = new AimAssist(settings);
      states.set(this, assist);
    }
    const ship = this.me?.ship;
    const starling = read(api.cls('starling.core.Starling'), 'current');
    const overlay = read(starling, 'nativeOverlay');
    if (!ship || !ship.engine || !overlay) {
      assist.release('player, ship, or native overlay unavailable');
      return;
    }
    const usingMouse = mouseAim();
    let angle = read(ship, 'rotation');
    if (usingMouse) {
      const position = ship.getGlobalPos();
      const dx = read(overlay, 'mouseX') - position.x;
      const dy = read(overlay, 'mouseY') - position.y;
      angle =
        dx * dx + dy * dy <= 12 * 12
          ? Number.isNaN(assist.mouseAngle)
            ? angle
            : assist.mouseAngle
          : Math.atan2(dy, dx);
    }
    const now = contacts.now();
    const weapon = read(ship, 'weapon');
    const eligible = selectAimAssistTarget(ship, weapon, now, settings, context);
    const target = eligible.target;
    const origin = read(ship, 'pos');
    const position = read(target, 'pos');
    assist.update({
      now,
      angle,
      shipRotation: read(ship, 'rotation'),
      rotationSpeed: read(ship.engine, 'rotationSpeed'),
      tickLength: api.cls('core.scene.Game')?.TICK_LENGTH ?? 33,
      mouseAim: usingMouse,
      mouseBlocked: !!Play!.mouseBlocked,
      keyboardDirection:
        Number(this.keybinds.isInputDown(14)) - Number(this.keybinds.isInputDown(13)),
      target,
      targetLocked: targets.locked && targets.current === target,
      directAngle: target ? Math.atan2(position.y - origin.y, position.x - origin.x) : NaN,
      leadAngle: target
        ? calculateProjectileAimAngle(ship, weapon, target, settings, context.isEnemyShip)
        : NaN,
      rejectionReason: eligible.reason,
    });
  });
  api.around(prototype, 'handleTurn', function (next, ...args) {
    if (!belongs(this) || !enabled() || automated() || isMapNavigating(game)) return next(...args);
    const assist = states.get(this);
    if (!mouseAim() && assist?.active) {
      if (this.keybinds.isInputDown(13) || this.keybinds.isInputDown(14)) {
        Play!.mouseBlocked = true;
        Play!.mouseIntegrator = 0;
      }
      return this.updateMouseAim();
    }
    return next(...args);
  });
  api.around(prototype, 'updateMouseAim', function (next, ...args) {
    if (!belongs(this) || !enabled() || automated()) return next(...args);
    if (isMapNavigating(game)) return;
    const assist = states.get(this);
    if (!assist || !Number.isFinite(assist.aimAngle)) return next(...args);
    const ship = this.me.ship;
    const course = read(ship, 'course');
    const step =
      (read(ship.engine, 'rotationSpeed') * (api.cls('core.scene.Game')?.TICK_LENGTH ?? 33)) / 1000;
    let threshold = step * 1.5;
    if (assist.active) threshold *= assist.thresholdRatio();
    else if (!course.rotateLeft && !course.rotateRight) threshold = Math.max(threshold, step * 2);
    const error = aimAngleDifference(read(ship, 'rotation'), assist.aimAngle);
    const stop =
      assist.shouldStopTracking(step, error) || (error < threshold && error > -threshold);
    let command = -1;
    let value = false;
    if (stop) {
      if (course.rotateLeft) command = 1;
      else if (course.rotateRight) command = 2;
    } else if (error > threshold) {
      if (course.rotateRight) command = 2;
      else if (!course.rotateLeft) {
        command = 1;
        value = true;
      }
    } else if (error < -threshold) {
      if (course.rotateLeft) command = 1;
      else if (!course.rotateRight) {
        command = 2;
        value = true;
      }
    }
    // Preserve current Haxe transport: at most one turn command per send interval.
    const interval = Play!.MOUSE_AIM_SEND_INTERVAL ?? 66;
    if (command >= 0 && game.time - this.mouseAimLastSendTime >= interval) {
      this.mouseAimLastSendTime = game.time;
      this.sendCommand(command, value);
    }
  });
  if (typeof prototype.get_currentAimAngle === 'function')
    api.around(prototype, 'get_currentAimAngle', function (next, ...args) {
      const assist = states.get(this);
      return belongs(this) &&
        enabled() &&
        !automated() &&
        !isMapNavigating(game) &&
        assist &&
        Number.isFinite(assist.aimAngle)
        ? assist.aimAngle
        : next(...args);
    });
  for (const method of ['enter', 'exit'])
    if (typeof prototype[method] === 'function')
      api.before(prototype, method, function () {
        states.delete(this);
      });
}
