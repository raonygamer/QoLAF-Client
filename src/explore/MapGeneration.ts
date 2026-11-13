import type { API } from '../api/Types';
import {
  Box,
  ExploreMap,
  ExploreState,
  Localize,
  Random,
  Sprite,
  TextBitmap,
} from '../game/Bindings';

/** Original exploration map generation: one seed attempt per frame after a visible loading frame. */
export function installExploreMapGeneration(api: API): void {
  interface Pending {
    state: ExploreState;
    label: TextBitmap;
    frame: () => void;
  }
  const pending = new Map<ExploreMap, Pending>();
  let constructing: ExploreState | null = null;
  const clear = (map: ExploreMap) => {
    const work = pending.get(map);
    if (!work) return;
    pending.delete(map);
    map.removeEventListener('enterFrame', work.frame);
    work.label.removeFromParent(true);
  };
  const finish = (state: ExploreState, map: ExploreMap) => {
    if (!state.container || state.exploreMap !== map) return;
    state.addExploreAreas(map);
    state.addChild(state.areaBox);
    const box = new Box(610, 45, 'normal', 0.95, 12);
    box.set_x(80);
    box.set_y(45);
    state.addImg(box);
  };
  api.around(ExploreMap.prototype, 'drawMap', function (next) {
    if (!pending.has(this)) return next();
  });
  api.around(ExploreMap.prototype, 'generateMap', function (next) {
    const state = constructing;
    if (!state) return next();
    const map = this;
    clear(map);
    map.done = false;
    const label = new TextBitmap(330, 330, Localize.t('Calculating exploration map...'), 18);
    label.center();
    map.addChild(label);
    let delay = 1;
    const frame = () => {
      if (delay-- > 0) return;
      try {
        map.r = new Random(map.seed);
        map.done = map.tryGenerateMap();
        if (!map.done) {
          api.log('Error: invalid seed!');
          map.seed += 0.12341;
          if (map.seed > 1) map.seed /= 2;
          return;
        }
        clear(map);
        state.b.generatedAreas = map.areas;
        state.b.generatedShells = map.shell;
        map.drawMap();
        finish(state, map);
        map.dispatchEventWith('explorationMapGenerationComplete');
      } catch (error) {
        clear(map);
        throw error;
      }
    };
    pending.set(map, { state, label, frame });
    map.addEventListener('enterFrame', frame);
  });
  api.around(ExploreState.prototype, 'createMap', function () {
    this.areas = [];
    const previous = constructing;
    constructing = this;
    let map: ExploreMap;
    try {
      map = new ExploreMap(this.g, this.bodyAreas, this.b);
    } finally {
      constructing = previous;
    }
    this.exploreMap = map;
    if (pending.has(map)) {
      // The native constructor caches immediately after generateMap returns.
      // Deferred attempts must not expose partial arrays as a completed map.
      this.b.generatedAreas = null;
      this.b.generatedShells = null;
    }
    map.set_x(50);
    map.set_y(110);
    this.addChild(map);
    if (!pending.has(map)) {
      map.done = true;
      finish(this, map);
    }
  });
  for (const method of ['execute', 'stopEffect'] as const)
    api.before(ExploreState.prototype, method, function () {
      // Native loops predate deferred generation and assume an array exists.
      this.areas ??= [];
    });
  api.before(ExploreState.prototype, 'exit', function () {
    if (this.exploreMap) clear(this.exploreMap);
  });
  api.before(Sprite.prototype, 'dispose', function () {
    if (this instanceof ExploreMap) clear(this);
  });
  api.defer(() => {
    for (const map of pending.keys()) clear(map);
  });
}
