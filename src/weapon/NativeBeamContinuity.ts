import type { API } from '../api/Types';
import { GameReflection } from '../api/GameReflection';
import { Beam, type GameScene, type Unit } from '../game/Bindings';
import type { RenderedGameObject } from '../game/RenderedGameObject';
import {
  BeamVisualContinuity,
  type BeamVisualSnapshot,
  type BeamVisualUnit,
} from './BeamVisualContinuity';
import { renderPosition, type BeamRenderGeometry } from './BeamRenderGeometry';

class VisualUnit implements BeamVisualUnit {
  private readonly point = { x: 0, y: 0 };
  constructor(readonly source: Unit) {}
  get alive() {
    return this.source.alive;
  }
  get renderX() {
    renderPosition(this.source, this.point);
    return this.point.x;
  }
  get renderY() {
    renderPosition(this.source, this.point);
    return this.point.y;
  }
  get renderRotation() {
    const rendered: RenderedGameObject = this.source;
    return rendered.get_renderRotation?.() ?? this.source.get_rotation();
  }
  get collisionRadius() {
    return this.source.collisionRadius;
  }
}

export interface BeamVisualTargets {
  target: Unit | null;
  secondary: readonly Unit[];
}

/** Skeletor-only presentation state; native target arrays are never replaced. */
export function installNativeBeamContinuity(api: API, game: GameScene) {
  const reflection = new GameReflection(api);
  const states = new Map<Beam, BeamVisualContinuity<VisualUnit>>();
  const units = new WeakMap<Unit, VisualUnit>();
  const visual = (unit: Unit | null): VisualUnit | null => {
    if (!unit) return null;
    let view = units.get(unit);
    if (!view) {
      view = new VisualUnit(unit);
      units.set(unit, view);
    }
    return view;
  };
  const state = (beam: Beam) => {
    let model = states.get(beam);
    if (!model) {
      model = new BeamVisualContinuity<VisualUnit>();
      states.set(beam, model);
    }
    return model;
  };
  const applies = (beam: Beam) => beam.g === game && beam.get_name() === 'Skeletor Lightning';
  const snapshot = (beam: Beam): BeamVisualSnapshot<VisualUnit> => ({
    name: beam.get_name(),
    time: game.time,
    firing: beam.get_fire(),
    unit: visual(beam.unit),
    target: visual(beam.target),
    secondaryTargets: beam.secondaryTargets.map((unit) => visual(unit)!),
    range: beam.range,
    angleVariance: beam.angleVariance,
  });
  const stop = (beam: Beam) => {
    state(beam).clear();
    beam.drawBeam = false;
    beam.lineBatch?.clear();
    beam.lineBatch?.removeFromParent();
    for (const line of beam.lines) line.clear();
    for (const effect of beam.startEffect) effect.stop();
    if (beam.twin) for (const effect of beam.startEffect2) effect.stop();
    for (const effect of beam.endEffect) effect.stop();
  };
  reflection.around(Beam.prototype, 'set_fire', function (next, value) {
    if (!applies(this) || !this.alive) return next(value);
    if (this.targetBody || value === this.get_fire()) return this.get_fire();
    const model = state(this);
    const continuing = model.setFiring(snapshot(this), value, this.drawBeam);
    this._fire = value;
    this.lastFire = 0;
    if (value) {
      if (!continuing) {
        for (const effect of this.startEffect) effect.play();
        if (this.twin) for (const effect of this.startEffect2) effect.play();
      }
    } else if (!continuing) stop(this);
    return value;
  });
  reflection.before(Beam.prototype, 'destroy', function () {
    states.delete(this);
  });
  api.defer(() => {
    for (const beam of states.keys()) if (beam.alive && !beam.get_fire()) stop(beam);
    states.clear();
  });
  return {
    prepare(beam: Beam): BeamVisualTargets | undefined {
      if (!applies(beam)) return undefined;
      if (!beam.alive || !beam.lineBatch) {
        states.delete(beam);
        return undefined;
      }
      const model = state(beam);
      if (model.stopExpired(game.time, beam.get_fire())) stop(beam);
      if (!beam.drawBeam) return undefined;
      const value = snapshot(beam);
      return {
        target: beam.targetBody ? null : (model.resolveTarget(value)?.source ?? null),
        secondary: model.resolveSecondary(value).map((unit) => unit.source),
      };
    },
    draw(beam: Beam, view: BeamRenderGeometry, targets: BeamVisualTargets): void {
      const batch = beam.lineBatch;
      if (!beam.drawBeam || !batch) return;
      const heat = game.get_me()?.ship?.weaponHeat;
      const intensity = Math.max(
        0.3,
        heat ? Math.min(1, (heat.get_heat() / heat.get_max()) * 1.5) : 0,
      );
      const alpha =
        intensity * (targets.target || beam.targetBody ? beam.startBeamAlpha : beam.beamAlpha);
      for (const line of beam.lines) {
        line.set_alpha(alpha);
        line.set_visible(false);
      }
      let index = beam.drawBeamEffect(0, beam.startPos, beam.endPos, beam.beams);
      if (beam.twin) index = beam.drawBeamEffect(index, beam.startPos2, beam.endPos, beam.beams);
      let strands = beam.beams;
      const last = { x: view.end.x, y: view.end.y };
      for (const target of targets.secondary) {
        if (!target.alive) continue;
        if (strands > 1) strands--;
        index = beam.drawBeamEffect(index, last, target.get_pos(), strands);
        renderPosition(target, last);
      }
      batch.clear();
      for (const line of beam.lines) if (line.get_visible()) batch.addMesh(line);
      batch.set_alpha(alpha);
    },
  };
}
