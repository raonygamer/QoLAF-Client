import { read, type API, type Raw } from '../api/Types';
import {
  BeamRenderGeometry,
  renderPosition,
  getActiveBeamGeometry,
  setActiveBeamGeometry,
} from './BeamRenderGeometry';
import { writePhaseBladeMounts } from './PhaseBladeMounts';
import { ClientDevVisual } from '../visuals/ClientDevVisual';

/** Redirect only Beam.draw's geometry arguments. Native shoot/update never sees render points. */
export function installNativeBeamGeometry(api: API, game: Raw): void {
  const Beam = api.cls('core.weapon.Beam')?.prototype;
  const Matrix = api.cls('openfl.geom.Matrix') as any;
  const PlayerShip = api.cls('core.ship.PlayerShip') as any;
  if (!Beam || !Matrix) return;
  const geometry = new WeakMap<Raw, BeamRenderGeometry>();
  const matrix = new Matrix();
  let drawing: { weapon: Raw; view: BeamRenderGeometry; chainIndex: number } | null = null;
  api.around(Beam, 'draw', function (next, ...args) {
    if (this.g !== game || !this.drawBeam || !this.unit?.weaponPos) return next(...args);
    let view = geometry.get(this);
    if (!view) {
      view = new BeamRenderGeometry();
      geometry.set(this, view);
    }
    const ship = this.unit;
    const mounts =
      this.key === ClientDevVisual.PHASE_BLADE && PlayerShip && ship instanceof PlayerShip
        ? (first: any, second: any) =>
            writePhaseBladeMounts(
              ship.experimentalVisual ?? ship.obj,
              ship.imgObj,
              read(ship, 'movieClip', ship._mc),
              game.canvasEffects,
              first,
              second,
              matrix,
            )
        : undefined;
    view.update(this, mounts);
    view.updateEmitters(this);
    const previous = drawing;
    drawing = { weapon: this, view, chainIndex: 0 };
    const previousGeometry = getActiveBeamGeometry(this);
    setActiveBeamGeometry(this, view);
    try {
      return next(...args);
    } finally {
      drawing = previous;
      setActiveBeamGeometry(this, previousGeometry);
    }
  });
  api.around(Beam, 'drawBeamEffect', function (next, index, start, end, strands) {
    if (drawing?.weapon !== this) return next(index, start, end, strands);
    const view = drawing.view;
    if (start === this.startPos) {
      const following = next(index, view.start, view.end, strands);
      return view.twin && !this.twin ? next(following, view.second, view.end, strands) : following;
    }
    if (start === this.startPos2)
      return view.twin ? next(index, view.second, view.end, strands) : index;
    // Native draw walks only alive secondary targets, retaining its own order.
    const targets = this.secondaryTargets;
    let target: Raw | undefined;
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
