import type { API } from '../api/Types';
import { GameReflection } from '../api/GameReflection';
import { Localize, MessageLog } from '../game/Bindings';
import { networkTime } from '../rendering/NetworkTime';
import { DeathMessageSelection } from './DeathMessageSelection';
import { EmperorDeathMessages } from './EmperorDeathMessages';
import { AureusDeathMessages } from './AureusDeathMessages';
import { FactionDeathMessages } from './FactionDeathMessages';
import { NetherDeathMessages } from './NetherDeathMessages';
import { DeathMessageVariants } from './DeathMessageVariants';

function escapeName(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/** Presentation only: the native death event retains authority over killer and cause. */
export function installNativeDeathMessages(api: API): void {
  const reflection = new GameReflection(api);
  reflection.around(MessageLog, 'writeDeathNote', (next, victim, killer, cause) => {
    if (killer != null && /^Naxar Wave Generator(?:\s+lvl\s+\d+)?$/.test(killer))
      killer = killer.replace('Naxar', 'Nexar');
    const game = api.game ? reflection.cast(api.game, 'core.scene.Game') : null;
    const selection = new DeathMessageSelection(
      networkTime(game),
      game?.room?.id ?? '',
      victim.id,
      killer,
      cause,
    );
    let variant =
      EmperorDeathMessages.choose(killer, cause, selection) ??
      AureusDeathMessages.choose(killer, cause, selection) ??
      FactionDeathMessages.choose(killer, cause, selection) ??
      NetherDeathMessages.choose(killer, cause, selection);
    const attacker =
      variant == null || killer == null
        ? killer
        : killer.replace(/\s+lvl\s+(?:\d+|\?+)(?=\s|$)/i, '');
    variant ??= DeathMessageVariants.choose(cause, selection);
    if (variant == null || (!killer && variant.includes('[attacker]')))
      return next(victim, killer, cause);
    const localized = Localize.t(variant);
    const victimText = escapeName(victim.get_name());
    const attackerText = escapeName(attacker ?? '');
    const text = localized.replace(/\[(victim|attacker)\]/g, (token: string) =>
      token === '[victim]' ? victimText : attackerText,
    );
    MessageLog.writeChatMsg('death', "<FONT COLOR='#ff4444'>" + text + '</FONT>');
  });
}
