import type { API } from '../api/Types';
import { GameReflection } from '../api/GameReflection';
import { DailyManager, Localize, type DailyMission, type GameScene } from '../game/Bindings';

/** Translate instantiated mission labels, never the shared mission definitions. */
export function installDailyMissionLocalization(api: API): void {
  const reflection = new GameReflection(api);
  const originals = new Map<
    DailyMission,
    {
      name: string;
      description: string;
      translatedName: string;
      translatedDescription: string;
    }
  >();
  const translate = (game: GameScene) => {
    for (const daily of game.get_me()?.dailyMissions ?? []) {
      if (originals.has(daily)) continue;
      const translatedName = Localize.t(daily.name);
      const translatedDescription = Localize.t(daily.description);
      originals.set(daily, {
        name: daily.name,
        description: daily.description,
        translatedName,
        translatedDescription,
      });
      daily.name = translatedName;
      daily.description = translatedDescription;
    }
  };
  reflection.after(DailyManager.prototype, 'initDailyMissionsFromMessage', function () {
    translate(this.g);
  });
  api.onGame(translate);
  api.defer(() => {
    for (const [daily, original] of originals) {
      if (daily.name === original.translatedName) daily.name = original.name;
      if (daily.description === original.translatedDescription)
        daily.description = original.description;
    }
    originals.clear();
  });
}
