import { read, type API, type Raw } from '../api/Types';

interface AutomationAim {
  owner: string;
  angle: number;
  lastCourseTime: number;
}

/** Original PlayState automation ownership, using native commands and ship state. */
export function installAutomationControls(api: API): void {
  const PlayState = api.cls('core.states.gameStates.PlayState');
  const prototype = PlayState?.prototype;
  if (!prototype) return;
  const RoamingState = api.cls('core.states.gameStates.RoamingState');
  const aimByState = new WeakMap<object, AutomationAim>();
  const ownsControls = (state: Raw) => !!state.g?.automationManager?.controlsClaimed;
  const currentAim = (state: Raw) => {
    const aim = aimByState.get(state);
    return aim && state.g?.automationManager?.ownsControls(aim.owner) ? aim : undefined;
  };
  const stopTurn = (state: Raw, course: Raw) => {
    if (course.rotateLeft) state.sendCommand(1, false);
    if (course.rotateRight) state.sendCommand(2, false);
  };
  const tickLength = () => api.cls('core.scene.Game')?.TICK_LENGTH ?? 33;
  const updateAim = (state: Raw) => {
    if (!read(state, 'loaded', state._loaded) || !read(state.me, 'commandable')) return;
    const ship = state.me.ship;
    const course = read(ship, 'course');
    if (!course || !ship.engine) return;
    const aim = currentAim(state);
    if (
      ship.channelingEnd > state.g.time ||
      ship.isTeleporting ||
      read(ship, 'usingBoost') ||
      !aim ||
      !Number.isFinite(aim.angle)
    ) {
      stopTurn(state, course);
      return;
    }
    // Source throttle follows serialized course time, including clock rollback.
    if (
      Number.isFinite(aim.lastCourseTime) &&
      course.time >= aim.lastCourseTime &&
      course.time - aim.lastCourseTime < tickLength()
    )
      return;
    aim.lastCourseTime = course.time;
    const threshold = ((read(ship.engine, 'rotationSpeed') * tickLength()) / 1000) * 0.6;
    const difference = api.cls('generics.Util')!.angleDifference(read(ship, 'rotation'), aim.angle);
    if (difference < threshold && difference > -threshold) stopTurn(state, course);
    else if (difference > threshold) {
      if (course.rotateRight) state.sendCommand(2, false);
      else if (!course.rotateLeft) state.sendCommand(1, true);
    } else if (difference < -threshold) {
      if (course.rotateLeft) state.sendCommand(1, false);
      else if (!course.rotateRight) state.sendCommand(2, true);
    }
  };
  const addProperty = (target: Raw, name: string, descriptor: PropertyDescriptor) => {
    const previous = Object.getOwnPropertyDescriptor(target, name);
    Object.defineProperty(target, name, { configurable: true, ...descriptor });
    api.defer(() => {
      const current = Object.getOwnPropertyDescriptor(target, name);
      if (current?.value !== descriptor.value || current?.get !== descriptor.get) return;
      if (previous) Object.defineProperty(target, name, previous);
      else delete target[name];
    });
  };
  const method = (name: string, value: Function) =>
    addProperty(prototype, name, { writable: true, value });
  method('setAutomationAimAngle', function (this: Raw, id: string, angle: number): boolean {
    if (!this.g?.automationManager?.ownsControls(id) || !Number.isFinite(angle)) return false;
    const previous = currentAim(this);
    aimByState.set(this, {
      owner: id,
      angle: api.cls('generics.Util')!.clampRadians(angle),
      lastCourseTime: previous?.lastCourseTime ?? NaN,
    });
    return true;
  });
  method('clearAutomationAimAngle', function (this: Raw, id: string): boolean {
    if (!this.g?.automationManager?.ownsControls(id)) return false;
    aimByState.delete(this);
    const course = read(this.me?.ship, 'course');
    if (course) stopTurn(this, course);
    return true;
  });
  const controlMode = function (this: Raw): string {
    return ownsControls(this) ? 'AutomationControlled' : 'PlayerControlled';
  };
  const aimAngle = function (this: Raw): number {
    if (ownsControls(this)) return currentAim(this)?.angle ?? NaN;
    const ship = this.me?.ship;
    if (!ship) return NaN;
    const settings = api.cls('core.scene.SceneBase')?.settings;
    if (!read(settings, 'mouseAim') || PlayState!.mouseBlocked) return read(ship, 'rotation', NaN);
    const starling = read(api.cls('starling.core.Starling'), 'current');
    const overlay = read(starling, 'nativeOverlay');
    if (!overlay || typeof ship.getGlobalPos !== 'function') return NaN;
    const position = ship.getGlobalPos();
    return Math.atan2(read(overlay, 'mouseY') - position.y, read(overlay, 'mouseX') - position.x);
  };
  method('get_currentAimAngle', aimAngle);
  addProperty(prototype, 'currentAimAngle', { get: aimAngle });
  method('get_currentAimControlMode', controlMode);
  addProperty(prototype, 'currentAimControlMode', { get: controlMode });
  for (const [name, value] of Object.entries({
    AIM_CONTROL_PLAYER_CONTROLLED: 'PlayerControlled',
    AIM_CONTROL_AUTOMATION_CONTROLLED: 'AutomationControlled',
    AUTOMATION_AIM_TURN_THRESHOLD_STEPS: 0.6,
  }))
    addProperty(PlayState!, name, { writable: true, value });

  api.around(prototype, 'updateCommands', function (next, ...args) {
    if (!ownsControls(this)) {
      aimByState.delete(this);
      return next(...args);
    }
    updateAim(this);
  });
  api.around(prototype, 'checkAccelerate', function (next, ...args) {
    if (!ownsControls(this)) return next(...args);
    // Native RoamingState calls this branch while chat is open. Keep the source
    // automation steering loop alive while physical input remains suppressed.
    if (args[0] === true && RoamingState?.prototype.isPrototypeOf(this)) this.updateCommands();
  });
  for (const name of ['enter', 'exit']) {
    if (typeof prototype[name] === 'function')
      api.before(prototype, name, function () {
        aimByState.delete(this);
      });
  }
}
