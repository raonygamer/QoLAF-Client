import type { API } from '../api/Types';
import { GameReflection } from '../api/GameReflection';
import { Damage, Localize } from '../game/Bindings';

const names = ['Kinetic', 'Energy', 'Corrosive', 'Health', 'Special'] as const;
const colors = ['#00ffff', '#ff030d', '#009900', '#00ff00', '#ff0000'] as const;
type Translate = (text: string) => string;

export function damageTypeHTML(index: number, translate: Translate): string {
  return `<FONT COLOR='${colors[index]}'>${translate(names[index])}</FONT>`;
}

export function damageDescription(damage: readonly number[], translate: Translate): string {
  const parts: string[] = [];
  for (let index = 0; index < 3; index++) {
    if (damage[index] > 0)
      parts.push(
        translate("<FONT COLOR='#eeeeee'>[damage]</FONT> [type] damage")
          .replace('[damage]', () => damage[index].toFixed(0))
          .replace('[type]', () => damageTypeHTML(index, translate)),
      );
  }
  let text = parts.length ? translate('Deals: ') + parts.join(' + ') : '';
  if (damage[3] > 0) {
    if (text) text += '\n';
    text += translate("Repairs: <FONT COLOR='#eeeeee'>[damage]</FONT> [type]")
      .replace('[damage]', () => damage[3].toFixed(0))
      .replace('[type]', () => damageTypeHTML(3, translate));
  }
  return text ? text + translate(' per hit.\n') : '';
}

export function debuffDamageDescription(
  damage: readonly number[],
  multiplier: number,
  duration: number,
  timing: string,
  translate: Translate,
): string {
  let text = '';
  const interval = timing === ' after' ? 'after' : 'over';
  for (let index = 0; index < 4; index++) {
    if (!(damage[index] > 0)) continue;
    const verb = index === 3 ? 'Repairs' : 'Deals';
    text += translate(
      `${verb} <FONT COLOR='#eeeeee'>[damage]</FONT> [type] ${interval} <FONT COLOR='#eeeeee'>[duration]</FONT> seconds \n`,
    )
      .replace('[damage]', () => Math.ceil(multiplier * damage[index]).toFixed(0))
      .replace('[type]', () => damageTypeHTML(index, translate))
      .replace('[duration]', () => duration.toFixed(1));
  }
  return text;
}

/** Original display-only localization delta; damage values remain native. */
export function installDamageDescription(api: API): void {
  const reflection = new GameReflection(api);
  const translate = (text: string) => Localize.t(text);
  reflection.around(Damage.prototype, 'damageText', function () {
    return damageDescription(this.damage, translate);
  });
  reflection.around(
    Damage.prototype,
    'debuffdamageText',
    function (_next, multiplier, duration, timing) {
      return debuffDamageDescription(this.damage, multiplier, duration, timing, translate);
    },
  );
}
