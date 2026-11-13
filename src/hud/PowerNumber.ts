import type { API } from '../api/Types';
import { GameReflection } from '../api/GameReflection';
import { PowerBar, type GameScene } from '../game/Bindings';
import { formatAmount } from './HealthAndShield';

/** Original PowerBar uses Util.formatAmount on the native rounded power value. */
export function installPowerNumber(api: API, game: GameScene): void {
  new GameReflection(api).after(PowerBar.prototype, 'update', function () {
    if (this.g !== game || !this.heatNumber) return;
    const text = this.heatNumber.get_text();
    if (!/^-?\d+$/.test(text)) return;
    const formatted = formatAmount(Number(text));
    if (formatted !== text) this.heatNumber.set_text(formatted);
  });
}
