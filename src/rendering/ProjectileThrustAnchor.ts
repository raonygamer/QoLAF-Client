import type { API } from '../api/Types';
import { GameReflection } from '../api/GameReflection';
import { Missile, Boomerang, Projectile } from '../game/Bindings';

interface Pose {
  x: number;
  y: number;
  rotation: number;
}

interface Anchor {
  valid(): boolean;
  pose(): Pose;
}

let anchors = new WeakMap<object, Anchor>();

export function projectileThrustPose(target: object): Pose | undefined {
  const anchor = anchors.get(target);
  return anchor?.valid() ? anchor.pose() : undefined;
}

export function staleProjectileThrust(target: object): boolean {
  const anchor = anchors.get(target);
  return !!anchor && !anchor.valid();
}

/** Source ProjectileThrustAnchor, retaining native AI and authored trail rotation. */
export function installProjectileThrustAnchors(
  api: API,
  sample: (projectile: Projectile) => Pose,
): void {
  const reflection = new GameReflection(api);
  const generations = new WeakMap<Projectile, number>();
  const owned = anchors;
  reflection.before(Projectile.prototype, 'reset', function () {
    generations.set(this, (generations.get(this) ?? 0) + 1);
  });
  const capture = (state: Missile | Boomerang): void => {
    const target = state.engine;
    if (owned.has(target)) return;
    const source = state.p;
    const generation = generations.get(source) ?? 0;
    owned.set(target, {
      valid: () =>
        source.alive &&
        source.get_movieClip() !== null &&
        (generations.get(source) ?? 0) === generation,
      pose: () => {
        const pose = sample(source);
        const radius = source.get_radius();
        return {
          x: pose.x - Math.cos(pose.rotation) * radius,
          y: pose.y - Math.sin(pose.rotation) * radius,
          // Original dummy GameObject rotation remained zero.
          rotation: 0,
        };
      },
    });
  };
  for (const prototype of [Missile.prototype, Boomerang.prototype]) {
    reflection.before(prototype, 'enter', function () {
      capture(this);
    });
    reflection.before(prototype, 'execute', function () {
      capture(this);
    });
  }
  api.defer(() => {
    if (anchors === owned) anchors = new WeakMap();
  });
}
