import { steeringCommands } from './SteeringCommands';
import { AimAssistDebugOverlay } from './AimAssistDebugOverlay';
import { read, type API, type Raw } from '../api/Types';
import { isMapNavigating } from '../map/NativeMapNavigation';
import type { DamageObserver } from '../telemetry/DamageObserver';
import type { TargetSystem } from '../target/TargetSystem';
import { AimAssist, aimAngleDifference } from './AimAssist';
import {
  calculateProjectileAimAngle,
  selectAimAssistTarget,
  type AimAssistSettings,
  type AimAssistEligibility,
} from './AimAssistTarget';

/** Adapt source aiming to live Haxe objects without changing weapon simulation. */
export function installNativeAimAssist(
  api: API,
  game: Raw,
  settings: AimAssistSettings & { setAimAssistBoolean?: (key: string, value: boolean) => void },
  targets: TargetSystem,
  contacts: Pick<DamageObserver, 'lastContact' | 'now'>,
): void {
  const Play = api.cls('core.states.gameStates.PlayState');
  const prototype = Play?.prototype;
  if (!prototype?.updateCommands || !prototype.updateMouseAim || !prototype.handleTurn) return;
  const states = new WeakMap<Raw, AimAssist>();
  const eligibility = new WeakMap<Raw, AimAssistEligibility>();
  const debug = new AimAssistDebugOverlay((name) => {
    const value = api.cls(name);
    if (!value) throw Error('Missing aim debug class: ' + name);
    return value;
  });
  let debugOwner: Raw | undefined;
  const drawDebug = (state: Raw) => {
    if (state.g !== game) return;
    if (!settings.getAimAssistBoolean('aim_assist_debug')) {
      debug.dispose();
      debugOwner = undefined;
      return;
    }
    const overlay = read(read(api.cls('starling.core.Starling'), 'current'), 'nativeOverlay');
    if (!overlay) return;
    let assist = states.get(state);
    if (!assist) {
      assist = new AimAssist(settings);
      states.set(state, assist);
    }
    debug.update(overlay, {
      assist,
      ship: state.me?.ship ?? null,
      activeTarget: targets.current,
      eligibility: assist.evaluatedTarget ? eligibility.get(state) : undefined,
      mouseAim: mouseAim(),
      mode: automated() ? 'AutomationControlled' : 'PlayerControlled',
    });
    debugOwner = state;
  };
  const method = (object: Raw, name: string, value: Function) => {
    const previous = Object.getOwnPropertyDescriptor(object, name);
    Object.defineProperty(object, name, { configurable: true, writable: true, value });
    api.defer(() => {
      if (object[name] !== value) return;
      if (previous) Object.defineProperty(object, name, previous);
      else delete object[name];
    });
  };
  method(prototype, 'applyAimAssistDebugVisibility', function (this: Raw) {
    drawDebug(this);
  });
  method(prototype, 'releaseAimAssist', function (this: Raw) {
    if (this.g !== game) return;
    states.get(this)?.release('player commands cancelled');
  });
  if (settings.setAimAssistBoolean)
    method(Play!, 'toggleAimAssistDebug', () => {
      const value = !settings.getAimAssistBoolean('aim_assist_debug');
      settings.setAimAssistBoolean!('aim_assist_debug', value);
      return value;
    });
  api.defer(() => {
    debug.dispose();
    debugOwner = undefined;
  });
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
    if (isMapNavigating(game)) {
      const assist = states.get(this);
      assist?.resetDiagnostics();
      assist?.release('map navigation');
      return;
    }
    let assist = states.get(this);
    if (!assist) {
      assist = new AimAssist(settings);
      states.set(this, assist);
    }
    if (automated()) {
      assist.automate(contacts.now(), this.get_currentAimAngle());
      return;
    }
    const ship = this.me?.ship;
    const starling = read(api.cls('starling.core.Starling'), 'current');
    const overlay = read(starling, 'nativeOverlay');
    if (!ship || !ship.engine || !overlay) {
      assist.suspend(contacts.now(), 'player, ship, or native overlay unavailable');
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
    eligibility.set(this, eligible);
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
  api.after(prototype, 'updateCommands', function () {
    drawDebug(this);
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
    if (!belongs(this) || automated()) return next(...args);
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
    const settle = assist.shouldStopTracking(step, error);
    // handleTurn is gated on the 33ms course boundary by NativeControlTiming.
    // Source stopMouseTurn releases both axes if both are latched.
    for (const command of steeringCommands(
      course.rotateLeft,
      course.rotateRight,
      error,
      threshold,
      settle,
    ))
      this.sendCommand(command.type, command.active);
  });
  if (typeof prototype.get_currentAimAngle === 'function')
    api.around(prototype, 'get_currentAimAngle', function (next, ...args) {
      const assist = states.get(this);
      return belongs(this) &&
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
        eligibility.delete(this);
        if (debugOwner === this) {
          debug.dispose();
          debugOwner = undefined;
        }
      });
}
