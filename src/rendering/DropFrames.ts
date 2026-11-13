import type { API } from '../api/Types';
import { GameReflection } from '../api/GameReflection';
import { Drop } from '../game/Bindings';

/** Source Drop.draw: speed is displacement per fixed tick, not units per second. */
export function drawDropFrame(drop: Drop): void {
  if (!drop._mc) return;
  const alpha = Math.max(0, Math.min(1, (drop.g.gameStateMachine?.accumulator ?? 0) / 33));
  const position = drop.get_pos();
  drop._mc.set_x(position.x + drop.speed.x * alpha);
  drop._mc.set_y(position.y + drop.speed.y * alpha);
}

export function installDropFrames(api: API): void {
  new GameReflection(api).after(Drop.prototype, 'draw', function () {
    drawDropFrame(this);
  });
}
