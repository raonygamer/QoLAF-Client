import { read, type API, type Raw } from '../Api/Types';
import { formatAmount } from './HealthAndShield';

/** Format the current game's damage/healing particles without replacing its mechanics. */
export function installDamageText(api: API, game: Raw): void {
  const prototype = api.cls('core.text.TextManager')?.prototype;
  if (typeof prototype?.createDmgText !== 'function') return;
  api.after(prototype, 'createDmgText', function (_result, amount: number, unit: Raw) {
    if (this.g !== game || amount === 0) return;
    const particle = amount > 0 ? unit.lastDmgText : unit.lastHealText;
    if (!particle) return;
    const value = amount > 0 ? unit.lastDmg : unit.lastHeal;
    const text = api.cls('core.scene.SceneBase')?.settings?.formatDamageText
      ? formatAmount(value)
      : String(value);
    if (read(particle, 'text') !== text) particle.set_text(text);
  });
}
