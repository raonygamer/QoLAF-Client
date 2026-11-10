import { read, type API, type Raw } from '../Api/Types';

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
    private readonly native: Raw,
    private readonly settings: () => Raw | null,
  ) {}

  update(ship: Raw): void {
    this.targetHP = Math.max(0, ship.hp);
    this.targetShield = Math.max(0, ship.shieldHp);
    this.targetHPMax = Math.max(1, read(ship, 'hpMax'));
    this.targetShieldMax = Math.max(1, read(ship, 'shieldHpMax'));
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
    if (read(native.playerHPText, 'text') !== hp) native.playerHPText.set_text(hp);
    if (read(native.playerShieldText, 'text') !== shield) native.playerShieldText.set_text(shield);
  }
}

export function installHealthAndShield(api: API, game: Raw): void {
  const prototype = api.cls('core.hud.components.HealthAndShield')?.prototype;
  if (typeof prototype?.update !== 'function') return;
  const instances = new Map<Raw, HealthAndShield>();
  const settings = () => api.cls('core.scene.SceneBase')?.settings ?? null;
  api.around(prototype, 'update', function (next) {
    if (this.g !== game) return next();
    const ship = read(game, 'me')?.ship;
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
      if (read(native, 'stage')) display.animate(read(event, 'passedTime', 0));
    }
  });
  api.defer(() => instances.clear());
}
