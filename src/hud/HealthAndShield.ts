import type { API } from '../api/Types';
import { GameReflection } from '../api/GameReflection';
import {
  HealthAndShield as NativeHealthAndShield,
  SceneBase,
  type GameScene,
  type Ship,
  type Image,
  type StarlingTextField,
} from '../game/Bindings';

interface HealthDisplay {
  playerHPBar: Pick<Image, 'set_width'>;
  playerShieldBar: Pick<Image, 'set_width'>;
  playerHPText: Pick<StarlingTextField, 'get_text' | 'set_text'>;
  playerShieldText: Pick<StarlingTextField, 'get_text' | 'set_text'>;
}
interface HealthSettings {
  formatHealthAndShield?: boolean;
}

/** Original generics.Util.formatAmount thresholds, including rollover before rounding. */
export function formatAmount(value: number): string {
  const magnitude = Math.abs(value);
  let divisor = 1;
  let suffix = '';
  if (magnitude >= 999950000000) {
    divisor = 1e12;
    suffix = 'T';
  } else if (magnitude >= 999950000) {
    divisor = 1e9;
    suffix = 'B';
  } else if (magnitude >= 999950) {
    divisor = 1e6;
    suffix = 'M';
  } else if (magnitude >= 1000) {
    divisor = 1000;
    suffix = 'k';
  }
  if (divisor === 1) return String(value);
  const rounded = Math.round((value / divisor) * 10) / 10;
  return (
    (rounded === Math.round(rounded) ? String(Math.round(rounded)) : rounded.toFixed(1)) + suffix
  );
}

/** Value animation from core.hud.components.HealthAndShield; owns no replacement UI. */
export class HealthAndShield {
  targetHP = 0;
  targetShield = 0;
  targetHPMax = 1;
  targetShieldMax = 1;
  displayedHP = 0;
  displayedShield = 0;
  initialized = false;

  constructor(
    private readonly native: HealthDisplay,
    private readonly settings: () => HealthSettings | null,
  ) {}

  update(ship: Pick<Ship, 'hp' | 'shieldHp' | 'get_hpMax' | 'get_shieldHpMax'>): void {
    this.targetHP = Math.max(0, ship.hp);
    this.targetShield = Math.max(0, ship.shieldHp);
    this.targetHPMax = Math.max(1, ship.get_hpMax());
    this.targetShieldMax = Math.max(1, ship.get_shieldHpMax());
    if (!this.initialized) {
      this.displayedHP = this.targetHP;
      this.displayedShield = this.targetShield;
      this.initialized = true;
    }
    this.render();
  }

  animate(elapsedSeconds: number): void {
    if (!this.initialized) return;
    const amount = 1 - Math.exp(-12 * Math.min(elapsedSeconds, 0.1));
    this.displayedHP += (this.targetHP - this.displayedHP) * amount;
    this.displayedShield += (this.targetShield - this.displayedShield) * amount;
    if (Math.abs(this.targetHP - this.displayedHP) < 0.05) this.displayedHP = this.targetHP;
    if (Math.abs(this.targetShield - this.displayedShield) < 0.05)
      this.displayedShield = this.targetShield;
    this.render();
  }

  private render(): void {
    const native = this.native;
    native.playerHPBar.set_width(
      Math.max(0, Math.min(120, (120 * this.displayedHP) / this.targetHPMax)),
    );
    native.playerShieldBar.set_width(
      Math.max(0, Math.min(120, (120 * this.displayedShield) / this.targetShieldMax)),
    );
    const settings = this.settings();
    const format = settings == null || settings.formatHealthAndShield ? formatAmount : String;
    const hp = format(Math.max(0, Math.round(this.displayedHP)));
    const shield = format(Math.max(0, Math.round(this.displayedShield)));
    if (native.playerHPText.get_text() !== hp) native.playerHPText.set_text(hp);
    if (native.playerShieldText.get_text() !== shield) native.playerShieldText.set_text(shield);
  }
}

export function installHealthAndShield(api: API, game: GameScene): void {
  const prototype = NativeHealthAndShield.prototype;
  if (typeof prototype?.update !== 'function') return;
  const instances = new Map<NativeHealthAndShield, HealthAndShield>();
  const settings = () => SceneBase.settings ?? null;
  new GameReflection(api).around(prototype, 'update', function (next) {
    if (this.g !== game) return next();
    const ship = game.get_me()?.ship;
    if (!ship) return;
    // Keep current upstream warning, texture, tooltip and shield calculations.
    next();
    let display = instances.get(this);
    if (!display) {
      display = new HealthAndShield(this, settings);
      instances.set(this, display);
    }
    display.update(ship);
  });
  api.on('frame', ({ game: current, event }) => {
    if (current !== game) return;
    for (const [native, display] of instances) {
      if (native.get_stage()) display.animate(event.get_passedTime());
    }
  });
  api.defer(() => instances.clear());
}
