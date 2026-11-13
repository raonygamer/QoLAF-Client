import { read, type Raw } from '../api/Types';
import type { Resolve } from '../runtime/HaxeInterop';
import type { AimAssist } from './AimAssist';
import type { AimAssistEligibility } from './AimAssistTarget';

export interface AimAssistDebugSnapshot {
  assist: AimAssist;
  ship: Raw | null;
  activeTarget: Raw | null;
  eligibility?: AimAssistEligibility;
  mouseAim: boolean;
  mode: string;
}

const overlayName = 'qolafAimAssistDebugOverlay';
const yes = (value: boolean) => (value ? 'yes' : 'no');
const number = (value: number, digits: number) =>
  Number.isNaN(value) ? '-' : value.toFixed(digits);
const angle = (value: number) =>
  Number.isNaN(value) ? '-' : ((value * 180) / Math.PI).toFixed(2) + ' deg';
const unitName = (unit: Raw | null) =>
  unit ? (read(unit, 'name') || 'unnamed') + ' #' + read(unit, 'id') : '-';

export function aimAssistDebugText(snapshot: AimAssistDebugSnapshot): string {
  const { assist: a, ship, eligibility: e, mouseAim, mode, activeTarget } = snapshot;
  const weapon = read(ship, 'weapon');
  const weaponName = weapon
    ? (read(weapon, 'name') || weapon.type || 'unnamed') +
      ' [' +
      (weapon.projectileFunction ?? 'no projectile') +
      ']'
    : '-';
  const hit = e?.candidate
    ? unitName(e.candidate) +
      ' | age ' +
      (e.hitAge < 0 ? '-' : Math.trunc(e.hitAge) + ' ms') +
      '/' +
      (e.hitWindow < 0 ? '-' : e.hitWindow + ' ms')
    : '-';
  return [
    'AIM ASSIST DEBUG',
    'mode: ' + mode + ' | state: ' + (a.active ? 'ACTIVE' : 'inactive'),
    'controls: ' + (mouseAim ? 'mouse aim' : 'keyboard steering'),
    'profile: ' +
      (a.tracking
        ? 'stationary tracking'
        : a.targetLocked
          ? 'locked player-guided'
          : 'player-guided'),
    'reason: ' + a.reason,
    'weapon: ' + weaponName + ' | fire=' + !!read(weapon, 'fire', false),
    'confirmed hit: ' + hit,
    'active target: ' + unitName(activeTarget) + ' | locked=' + yes(a.targetLocked),
    'distance: ' +
      number(e?.distance ?? NaN, 1) +
      ' | required: ' +
      number(e?.minimumDistance ?? NaN, 1),
    'input active: ' +
      yes(a.mouseMoving) +
      ' | toward=' +
      yes(a.movingToward) +
      (mouseAim
        ? ' | ' + (Number.isNaN(a.mouseSpeed) ? '-' : a.mouseSpeed.toFixed(3) + ' rad/s')
        : ' | turn keys'),
    'intent error: ' + angle(a.intentError) + ' | lead error: ' + angle(a.leadError),
    'correction: ' +
      angle(a.correction) +
      ' | raw/final: ' +
      angle(a.mouseAngle) +
      '/' +
      angle(a.aimAngle),
    'ship turn: ' + angle(a.turnError) + ' | deadzone: ' + angle(a.turnThreshold),
    'rays: white=input  yellow=target  cyan=lead  green=applied',
  ].join('\n');
}

/** Original OpenFL/native overlay, including source geometry, typography and ray colors. */
export class AimAssistDebugOverlay {
  private container: Raw | undefined;
  private shape: Raw | undefined;
  private field: Raw | undefined;
  private overlay: Raw | undefined;

  constructor(private readonly resolve: Resolve) {}

  update(overlay: Raw, snapshot: AimAssistDebugSnapshot): void {
    if (!this.container) {
      const Sprite = this.resolve('openfl.display.Sprite');
      const Shape = this.resolve('openfl.display.Shape');
      const TextField = this.resolve('openfl.text.TextField');
      const TextFormat = this.resolve('openfl.text.TextFormat');
      this.container = new Sprite();
      this.container!.set_name(overlayName);
      this.container!.mouseEnabled = false;
      this.container!.mouseChildren = false;
      this.shape = new Shape();
      this.field = new TextField();
      const field = this.field!;
      field.set_x(8);
      field.set_y(72);
      field.set_width(460);
      field.set_height(218);
      field.set_defaultTextFormat(new TextFormat('_typewriter', 12, 0xffffff));
      field.set_background(true);
      field.set_backgroundColor(0);
      field.set_border(true);
      field.set_borderColor(0x555555);
      field.set_alpha(0.9);
      field.set_multiline(true);
      field.set_wordWrap(false);
      field.set_selectable(false);
      field.mouseEnabled = false;
      this.container!.addChild(this.shape);
      this.container!.addChild(field);
    }
    for (let i = read(overlay, 'numChildren') - 1; i >= 0; i--) {
      const child = overlay.getChildAt(i);
      if (child !== this.container && read(child, 'name') === overlayName) overlay.removeChildAt(i);
    }
    if (read(this.container, 'parent') !== overlay) overlay.addChild(this.container);
    this.overlay = overlay;
    this.field!.set_text(aimAssistDebugText(snapshot));
    const graphics = read(this.shape, 'graphics');
    graphics.clear();
    const { assist, ship } = snapshot;
    if (!ship || Number.isNaN(assist.mouseAngle)) return;
    const origin = ship.getGlobalPos();
    const ray = (value: number, color: number, width: number, length: number) => {
      if (Number.isNaN(value)) return;
      graphics.lineStyle(width, color, 0.9);
      graphics.moveTo(origin.x, origin.y);
      graphics.lineTo(origin.x + Math.cos(value) * length, origin.y + Math.sin(value) * length);
    };
    ray(assist.mouseAngle, 0xffffff, 1, 130);
    ray(assist.directAngle, 0xffd84a, 2, 145);
    ray(assist.leadAngle, 0x54d9ff, 2, 160);
    if (assist.active) ray(assist.aimAngle, 0x55ff77, 3, 175);
    graphics.lineStyle(1, 0xffffff, 0.75);
    graphics.drawCircle(origin.x, origin.y, 4);
  }

  dispose(): void {
    if (this.overlay)
      for (let i = read(this.overlay, 'numChildren') - 1; i >= 0; i--)
        if (read(this.overlay.getChildAt(i), 'name') === overlayName) this.overlay.removeChildAt(i);
    read(this.container, 'parent')?.removeChild(this.container);
    this.container = this.shape = this.field = this.overlay = undefined;
  }
}
