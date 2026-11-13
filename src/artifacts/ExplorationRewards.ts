import type { API } from '../api/Types';
import { ArtifactBox, GameScene, ReportState, TweenMax } from '../game/Bindings';

/** Confirm exploration grants before metadata loads; callbacks retain their original owner. */
export function installExplorationRewards(api: API): void {
  const counted = new WeakMap<ReportState, Set<string>>();
  let disposed = false;
  api.defer(() => {
    disposed = true;
  });
  api.around(ReportState.prototype, 'createArtifactFunction', function (next, count, index, id) {
    const native = next(count, index, id);
    const game = this.g;
    const owner = game.get_me();
    if (!owner) return native;
    let rewards = counted.get(this);
    if (!rewards) counted.set(this, (rewards = new Set()));
    if (id && !rewards.has(id)) {
      rewards.add(id);
      if (!owner.getArtifactById(id)) {
        owner.artifactCount++;
        if (owner.artifactCount >= owner.get_artifactLimit()) game.hud?.showArtifactLimitText();
      }
    }
    return (artifact) => {
      if (!artifact) return native(artifact);
      if (!owner.artifacts) return;
      const cached = owner.getArtifactById(id);
      if (cached) artifact = cached;
      else owner.artifacts.push(artifact);
      if (disposed || game.get_isLeaving() || GameScene.instance !== game || !this.container)
        return;
      const box = new ArtifactBox(game, artifact);
      box.update();
      box.set_y(200);
      box.set_x(380 - (3 * (box.get_width() + 15)) / 2 + (box.get_width() + 15) * index);
      this.rewardTweens.push(
        TweenMax.from(box, 1 + index, { alpha: 0, scaleX: 2, scaleY: 2, paused: true }),
      );
      this.rewardStepContainer.addChild(box);
    };
  });
}
