import { read, type API, type Raw } from '../api/Types';
import type { Resolve } from '../runtime/As3';
import { ClientDevVisual } from './ClientDevVisual';
import type { HullPalette } from './NativePhaseBlade';
import { createGrayscaleTintStyle } from './GrayscaleTintStyle';

/** Original Emitter.changeTintColor brightness fade, without replacing particle timing. */
export function tintAtOriginalBrightness(color: number, original: number): number {
  const brightness = Math.max((original >> 16) & 255, (original >> 8) & 255, original & 255) / 255;
  return (
    (Math.floor(((color >> 16) & 255) * brightness + 0.5) << 16) |
    (Math.floor(((color >> 8) & 255) * brightness + 0.5) << 8) |
    Math.floor((color & 255) * brightness + 0.5)
  );
}

interface EmitterState {
  owner: Raw;
  start: number;
  finish: number;
  appliedStart: number;
  appliedFinish: number;
  particles: Map<Raw, { previous: Raw; owned: Raw }>;
  previousBatch: Raw | null;
}

export function installBeamEmitterTint(api: API, resolve: Resolve) {
  const owned = new Map<Raw, EmitterState>();
  let Style: any;
  const Collective = api.cls('core.particle.CollectiveMeshBatch') as any;
  let tintBatch: Raw | null = null;
  const isolateBatch = (emitter: Raw): Raw | null => {
    const previous = emitter.collectiveMeshBatch;
    if (!Collective || !previous || emitter.canvasTarget != null) return null;
    if (!tintBatch) {
      tintBatch = new Collective();
      tintBatch!.set_blendMode(read(previous, 'blendMode'));
      Collective.meshBatches.push(tintBatch);
    }
    previous.remove(emitter);
    if (previous.emitters.length === 0) {
      previous.markUpdated();
      previous.clear();
    }
    tintBatch!.emitters.push(emitter);
    emitter.collectiveMeshBatch = tintBatch;
    emitter.setBatchParent();
    return previous;
  };
  const styleParticle = (state: EmitterState, particle: Raw) => {
    const current = read(particle, 'style');
    // Aura styles have their own geometry and take precedence in the source.
    if (current?.__class__?.__name__?.endsWith('.GrayscaleAuraStyle')) return;
    if (state.particles.has(particle)) return;
    Style ??= createGrayscaleTintStyle(resolve);
    const style = new Style();
    style.set_texture(read(particle, 'texture'));
    style.set_textureSmoothing(read(particle, 'textureSmoothing'));
    state.particles.set(particle, { previous: current, owned: style });
    particle.setStyle(style, false);
  };
  const releaseEmitter = (emitter: Raw, disposing = false) => {
    const state = owned.get(emitter);
    if (!state) return;
    for (const [particle, style] of state.particles)
      if (read(particle, 'style') === style.owned) particle.setStyle(style.previous, false);
    if (emitter._startColor === state.appliedStart) emitter._startColor = state.start;
    if (emitter._finishColor === state.appliedFinish) emitter._finishColor = state.finish;
    if (state.previousBatch && emitter.collectiveMeshBatch === tintBatch) {
      tintBatch!.remove(emitter);
      emitter.collectiveMeshBatch = state.previousBatch;
      if (!disposing && !state.previousBatch.emitters.includes(emitter))
        state.previousBatch.emitters.push(emitter);
      if (tintBatch!.emitters.length === 0) {
        tintBatch!.markUpdated();
        tintBatch!.clear();
      }
    }
    owned.delete(emitter);
  };
  const release = (weapon: Raw) => {
    for (const [emitter, state] of owned) if (state.owner === weapon) releaseEmitter(emitter);
  };
  const update = (weapon: Raw, palette: HullPalette | null, transform: Raw) => {
    if (!palette) {
      release(weapon);
      return;
    }
    const time = read(weapon.g, 'networkServerTime', weapon.g?.getServerTime?.() ?? 0);
    const tint = (emitters: Raw[] | undefined, point: Raw | undefined) => {
      if (!point) return;
      const color = ClientDevVisual.colorAt(
        ClientDevVisual.MODES[palette.mode],
        palette.settings,
        time,
        transform.a * point.x + transform.c * point.y + transform.tx,
        transform.b * point.x + transform.d * point.y + transform.ty,
      );
      for (const emitter of emitters ?? []) {
        let state = owned.get(emitter);
        if (state && state.owner !== weapon) {
          releaseEmitter(emitter);
          state = undefined;
        }
        if (!state) {
          state = {
            owner: weapon,
            start: emitter._startColor,
            finish: emitter._finishColor,
            appliedStart: emitter._startColor,
            appliedFinish: emitter._finishColor,
            particles: new Map(),
            previousBatch: isolateBatch(emitter),
          };
          owned.set(emitter, state);
        }
        state.appliedStart = emitter._startColor = tintAtOriginalBrightness(
          color,
          emitter._originalStartColor,
        );
        state.appliedFinish = emitter._finishColor = tintAtOriginalBrightness(
          color,
          emitter._originalFinishColor,
        );
        for (const particle of emitter.particles ?? []) styleParticle(state, particle);
        for (const particle of emitter.inactiveParticles ?? []) styleParticle(state, particle);
      }
    };
    tint(weapon.startEffect, weapon.renderStartPos ?? weapon.startPos);
    tint(weapon.startEffect2, weapon.renderStartPos2 ?? weapon.startPos2);
    tint(weapon.endEffect, weapon.renderEndPos ?? weapon.endPos);
  };
  const Emitter = api.cls('core.particle.Emitter')?.prototype;
  if (Emitter) {
    api.around(Emitter, 'add', function (next, ...args) {
      const count = this.particles?.length ?? 0;
      const result = next(...args);
      const state = owned.get(this);
      if (state)
        for (let index = count; index < this.particles.length; index++)
          styleParticle(state, this.particles[index]);
      return result;
    });
    api.before(Emitter, 'dispose', function () {
      releaseEmitter(this, true);
    });
  }
  api.defer(() => {
    for (const emitter of owned.keys()) releaseEmitter(emitter);
    if (tintBatch) {
      const index = Collective.meshBatches.indexOf(tintBatch);
      if (index >= 0) Collective.meshBatches.splice(index, 1);
      tintBatch.removeFromParent();
      tintBatch.dispose();
      tintBatch = null;
    }
  });
  return { update, release };
}
