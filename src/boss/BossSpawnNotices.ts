import type { API } from '../api/Types';
import { Localize, TextManager } from '../game/Bindings';

/** Native boss creation supplies an English suffix; original QoLAF translates both parts. */
export function installBossSpawnNotices(api: API): void {
  api.around(TextManager.prototype, 'createBossSpawnedText', function (next, text) {
    const suffix = ' has spawned';
    if (!text.endsWith(suffix)) return next(text);
    const name = text.slice(0, -suffix.length);
    return next(Localize.t('[name] has spawned').replace('[name]', Localize.t(name)));
  });
}
