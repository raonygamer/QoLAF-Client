import type { API } from '../api/Types';
import { GameReflection } from '../api/GameReflection';
import { Starling, LandedState, LandedHangar, LandedLore } from '../game/Bindings';

/** The original removes only the landed screens' hardcoded 30/60 FPS writes. */
export function installLandedFrameRate(api: API): void {
  const reflection = new GameReflection(api);
  const stages = new WeakMap<ReturnType<Starling['get_nativeStage']>, { depth: number }>();
  const protect = <Result>(run: () => Result): Result => {
    const stage = Starling.get_current()?.get_nativeStage();
    if (!stage) return run();
    let scope = stages.get(stage);
    if (!scope) {
      scope = { depth: 0 };
      stages.set(stage, scope);
      const state = scope;
      reflection.around(stage, 'set_frameRate', function (next, rate) {
        return state.depth > 0 && (rate === 30 || rate === 60) ? rate : next(rate);
      });
    }
    scope.depth++;
    try {
      return run();
    } finally {
      scope.depth--;
    }
  };
  for (const prototype of [LandedState.prototype, LandedHangar.prototype, LandedLore.prototype])
    reflection.around(prototype, 'enter', function (next) {
      return protect(() => next());
    });
  reflection.around(LandedState.prototype, 'exit', function (next, complete) {
    return protect(() => next(complete));
  });
}
