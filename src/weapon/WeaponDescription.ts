import type { API } from '../api/Types';
import { GameReflection } from '../api/GameReflection';
import { Localize, Weapon } from '../game/Bindings';

const heading = "<FONT COLOR='#8888ff'>[name], lvl [level]</FONT>\n";
const bonus =
  "\nDeals <FONT COLOR='#eeeeee'>[bonus]%</FONT> more damage if target is afflicted by [condition].";

/** Translate the original client's two text additions without replacing native stats. */
export function installWeaponDescription(api: API): void {
  const reflection = new GameReflection(api);
  reflection.around(Weapon.prototype, 'getDescription', function (next, compact) {
    let text = next(compact);
    const name = this.get_name();
    const template = Localize.t(heading);
    const title = (value: string) =>
      template.split('[name]').join(value).split('[level]').join(String(this.level));
    const nativeTitle = title(name);
    if (text.startsWith(nativeTitle))
      text = title(Localize.t(name)) + text.slice(nativeTitle.length);

    const condition = this.specialCondition;
    if (condition != null && condition !== '') {
      const percentage = String(this.specialBonusPercentage);
      const nativeBonus = Localize.t(
        `\nDeals <FONT COLOR='#eeeeee'>${percentage}%</FONT> more damage if target is afflicted by ${condition}.`,
      );
      if (nativeBonus && text.endsWith(nativeBonus)) {
        const translated = Localize.t(bonus)
          .split('[bonus]')
          .join(percentage)
          .split('[condition]')
          .join(Localize.t(condition));
        text = text.slice(0, -nativeBonus.length) + translated;
      }
    }
    return text;
  });
}
