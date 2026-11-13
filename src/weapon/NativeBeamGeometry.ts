import { installNativeBeamContinuity } from './NativeBeamContinuity';
import { Beam, Matrix, PlayerShip, type GameScene, type Unit } from '../game/Bindings';
import type { API } from '../api/Types';
import { GameReflection } from '../api/GameReflection';
import type { RenderPoint } from './PhaseBladeMounts';
import {
  BeamRenderGeometry,
  renderPosition,
  getActiveBeamGeometry,
  setActiveBeamGeometry,
} from './BeamRenderGeometry';
import { writePhaseBladeMounts } from './PhaseBladeMounts';
import { ClientDevVisual } from '../visuals/ClientDevVisual';

interface BeamMountShip extends PlayerShip {
  experimentalVisual?: object;
  writePhaseBladeMounts?(first: RenderPoint, second: RenderPoint): number;
}

/** Redirect only Beam.draw's geometry arguments. Native shoot/update never sees render points. */
export function installNativeBeamGeometry(api: API, game: GameScene): void {
  const reflection = new GameReflection(api);
  const continuity = installNativeBeamContinuity(api, game);
  const geometry = new WeakMap<Beam, BeamRenderGeometry>();
  const matrix = new Matrix();
  let drawing: {
    weapon: Beam;
    view: BeamRenderGeometry;
    chainIndex: number;
    targets: readonly Unit[];
  } | null = null;
  reflection.around(Beam.prototype, 'draw', function (next, ...args) {
    const targets = this.g === game ? continuity.prepare(this) : undefined;
    if (this.g !== game || !this.drawBeam || !this.unit?.weaponPos) return next(...args);
    let view = geometry.get(this);
    if (!view) {
      view = new BeamRenderGeometry();
      geometry.set(this, view);
    }
    const ship = this.unit;
    const mountShip: BeamMountShip | null = ship instanceof PlayerShip ? ship : null;
    const mounts =
      this.key === ClientDevVisual.PHASE_BLADE && mountShip
        ? (first: RenderPoint, second: RenderPoint) =>
            typeof mountShip.writePhaseBladeMounts === 'function'
              ? mountShip.writePhaseBladeMounts(first, second)
              : writePhaseBladeMounts(
                  mountShip.experimentalVisual ?? mountShip.obj,
                  mountShip.imgObj,
                  mountShip.get_movieClip(),
                  game.canvasEffects,
                  first,
                  second,
                  matrix,
                )
        : undefined;
    view.update(this, mounts, targets?.target);
    view.updateEmitters(this);
    const previous = drawing;
    drawing = {
      weapon: this,
      view,
      chainIndex: 0,
      targets: targets?.secondary ?? this.secondaryTargets,
    };
    const previousGeometry = getActiveBeamGeometry(this);
    setActiveBeamGeometry(this, view);
    try {
      if (targets) return continuity.draw(this, view, targets);
      return next(...args);
    } finally {
      drawing = previous;
      setActiveBeamGeometry(this, previousGeometry);
    }
  });
  reflection.around(Beam.prototype, 'drawBeamEffect', function (next, index, start, end, strands) {
    if (drawing?.weapon !== this) return next(index, start, end, strands);
    const view = drawing.view;
    if (start === this.startPos) {
      const following = next(index, view.start, view.end, strands);
      return view.twin && !this.twin ? next(following, view.second, view.end, strands) : following;
    }
    if (start === this.startPos2)
      return view.twin ? next(index, view.second, view.end, strands) : index;
    // Native draw walks only alive secondary targets, retaining its own order.
    const targets = drawing.targets;
    let target: Unit | undefined;
    while (drawing.chainIndex < targets.length) {
      const candidate = targets[drawing.chainIndex++];
      if (candidate.alive) {
        target = candidate;
        break;
      }
    }
    if (!target) return next(index, start, end, strands);
    renderPosition(target, view.chain);
    const following = next(index, view.last, view.chain, strands);
    view.last.x = view.chain.x;
    view.last.y = view.chain.y;
    return following;
  });
}
