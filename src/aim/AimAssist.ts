import type { Raw } from '../api/Types';
import type { AimAssistSettings } from './AimAssistTarget';

export interface AimAssistInput {
  now: number;
  angle: number;
  shipRotation: number;
  rotationSpeed: number;
  tickLength: number;
  mouseAim: boolean;
  mouseBlocked: boolean;
  keyboardDirection: number;
  target: Raw | null;
  targetLocked: boolean;
  directAngle: number;
  leadAngle: number;
  rejectionReason: string;
}

/** Same signed, single-turn difference used by the native Util class. */
export function aimAngleDifference(a: number, b: number): number {
  const difference = a - b;
  return difference > Math.PI
    ? difference - Math.PI * 2
    : difference < -Math.PI
      ? difference + Math.PI * 2
      : difference;
}

/** Source player-guided acquisition and stationary tracking, independent of command transport. */
export class AimAssist {
  active = false;
  tracking = false;
  settled = false;
  targetLocked = false;
  aimAngle = NaN;
  mouseAngle = NaN;
  reason = 'waiting for input';
  correction = NaN;
  turnError = NaN;
  turnThreshold = NaN;
  intentError = NaN;
  leadError = NaN;
  mouseSpeed = NaN;
  mouseMoving = false;
  movingToward = false;
  private target: Raw | null = null;
  private lastUpdate = 0;
  private lastSignificantInput = 0;

  constructor(private readonly settings: AimAssistSettings) {}

  private option(name: string): boolean {
    return this.settings.getAimAssistBoolean('aim_assist_' + name);
  }

  private number(name: string): number {
    return this.settings.getAimAssistNumber('aim_assist_' + name);
  }

  release(reason: string): void {
    this.active = false;
    this.settled = false;
    this.target = null;
    if (!Number.isNaN(this.mouseAngle)) this.aimAngle = this.mouseAngle;
    this.reason = reason;
  }

  thresholdRatio(): number {
    return this.number(
      this.tracking
        ? 'tracking_turn_threshold_ratio'
        : this.targetLocked && this.option('locked_profile')
          ? 'locked_turn_threshold_ratio'
          : 'guided_turn_threshold_ratio',
    );
  }

  update(input: AimAssistInput): void {
    this.tracking = false;
    this.targetLocked = false;
    this.correction = this.turnError = this.turnThreshold = NaN;
    this.intentError = this.leadError = this.mouseSpeed = NaN;
    this.mouseMoving = this.movingToward = false;
    const elapsed =
      this.lastUpdate === 0 ? 0 : Math.max(0.001, (input.now - this.lastUpdate) / 1000);
    this.lastUpdate = input.now;
    const hasPrevious = !Number.isNaN(this.mouseAngle);
    const previousAngle = hasPrevious ? this.mouseAngle : input.angle;
    this.mouseAngle = this.aimAngle = input.angle;
    if (!hasPrevious) return this.release('waiting for a second steering sample');
    if (elapsed <= 0) return this.release('invalid frame time');
    if (input.mouseAim && input.mouseBlocked)
      return this.release('mouse aim is blocked by keyboard steering');
    if (!this.option('enabled')) return this.release('aim assist is disabled in QoLAF settings');
    if (!input.target) return this.release(input.rejectionReason);

    const intentError = aimAngleDifference(input.directAngle, this.mouseAngle);
    const previousError = aimAngleDifference(input.directAngle, previousAngle);
    const correctionError = aimAngleDifference(input.leadAngle, this.mouseAngle);
    const mouseDelta = aimAngleDifference(this.mouseAngle, previousAngle);
    const mouseSpeed = Math.abs(mouseDelta) / elapsed;
    const lockedProfile = input.targetLocked && this.option('locked_profile');
    const minimumDelta = this.number(lockedProfile ? 'locked_min_mouse_delta' : 'min_mouse_delta');
    const tolerance = this.number(lockedProfile ? 'locked_toward_tolerance' : 'toward_tolerance');
    const moving = input.mouseAim
      ? Math.abs(mouseDelta) >= minimumDelta
      : input.keyboardDirection !== 0;
    const toward = input.mouseAim
      ? Math.abs(intentError) <= Math.abs(previousError) + tolerance
      : intentError * input.keyboardDirection > 0;
    const significant = input.mouseAim
      ? mouseSpeed >= this.number('significant_mouse_speed')
      : input.keyboardDirection !== 0;
    if (!this.active || significant) this.lastSignificantInput = input.now;
    const tracking =
      this.option('stationary_tracking') &&
      this.active &&
      input.now - this.lastSignificantInput >=
        this.number(lockedProfile ? 'locked_tracking_delay' : 'tracking_delay');
    this.intentError = intentError;
    this.leadError = correctionError;
    this.mouseSpeed = mouseSpeed;
    this.mouseMoving = moving;
    this.movingToward = toward;
    this.tracking = tracking;
    this.targetLocked = input.targetLocked;

    if (this.active) {
      if (this.target !== input.target) return this.release('confirmed hit target changed');
      if (
        Math.abs(intentError) > this.number(tracking ? 'tracking_release_angle' : 'release_angle')
      )
        return this.release(
          tracking ? 'outside the 30 deg tracking cone' : 'outside the 18 deg release cone',
        );
      const overrideSpeed = this.number('override_mouse_speed');
      if (input.mouseAim && mouseSpeed > overrideSpeed)
        return this.release(
          'manual override: mouse faster than ' + overrideSpeed.toFixed(2) + ' rad/s',
        );
      if (significant && !toward) return this.release('manual override: steering away from target');
    } else {
      if (!moving)
        return this.release(
          input.mouseAim
            ? 'move the mouse slowly toward the target to acquire'
            : 'steer left or right toward the target to acquire',
        );
      if (!toward)
        return this.release(
          input.mouseAim
            ? 'mouse is not moving toward the visible target'
            : 'turn key is steering away from the visible target',
        );
      const maximumSpeed = this.number(
        lockedProfile ? 'locked_max_mouse_speed' : 'max_mouse_speed',
      );
      if (input.mouseAim && mouseSpeed > maximumSpeed)
        return this.release(
          'mouse faster than ' + maximumSpeed.toFixed(2) + ' rad/s acquisition limit',
        );
      const acquireAngle = this.number(lockedProfile ? 'locked_acquire_angle' : 'acquire_angle');
      if (Math.abs(intentError) > acquireAngle)
        return this.release(
          'outside the ' + Math.round((acquireAngle * 180) / Math.PI) + ' deg acquisition cone',
        );
    }
    this.active = true;
    this.target = input.target;
    const ratio = this.number(
      tracking
        ? 'tracking_correction_ratio'
        : lockedProfile
          ? 'locked_correction_ratio'
          : 'correction_ratio',
    );
    const maximum = this.number(
      tracking
        ? 'tracking_max_correction'
        : lockedProfile
          ? 'locked_max_correction'
          : 'max_correction',
    );
    let correction = Math.max(-maximum, Math.min(maximum, correctionError * ratio));
    const step = (input.rotationSpeed * input.tickLength) / 1000;
    const threshold = step * 1.5 * this.thresholdRatio();
    const desiredError = aimAngleDifference(input.shipRotation, input.leadAngle);
    let correctedAngle = this.mouseAngle + correction;
    let correctedError = aimAngleDifference(input.shipRotation, correctedAngle);
    if (Math.abs(desiredError) > threshold && Math.abs(correctedError) <= threshold) {
      const magnitude = Math.min(
        Math.abs(desiredError),
        threshold + step * this.number('turn_margin_ratio'),
      );
      correctedAngle = input.shipRotation - Math.sign(desiredError) * magnitude;
      correction = aimAngleDifference(correctedAngle, this.mouseAngle);
      correctedError = aimAngleDifference(input.shipRotation, correctedAngle);
    }
    this.correction = correction;
    this.turnError = correctedError;
    this.turnThreshold = threshold;
    this.aimAngle = correctedAngle;
    this.reason = tracking
      ? 'ACTIVE: stationary tracking'
      : input.targetLocked
        ? 'ACTIVE: locked player-guided'
        : 'ACTIVE: player-guided';
  }

  /** Source tracking hysteresis; caller sends stop-turn through native transport. */
  shouldStopTracking(rotationFreedom: number, angleError: number): boolean {
    if (!this.active || !this.tracking) {
      this.settled = false;
      return false;
    }
    const settle = this.number('tracking_settle_steps');
    const restart = Math.max(settle, this.number('tracking_restart_steps'));
    if (this.settled) {
      if (Math.abs(angleError) <= rotationFreedom * restart) return true;
      this.settled = false;
    }
    if (Math.abs(angleError) <= rotationFreedom * settle) {
      this.settled = true;
      return true;
    }
    return false;
  }
}
