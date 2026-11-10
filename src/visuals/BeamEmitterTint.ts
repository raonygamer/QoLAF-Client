import { getActiveBeamGeometry } from '../weapon/BeamRenderGeometry';
import { networkTime } from '../rendering/NetworkTime';
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
  grayscale: boolean;
}

// Hull palettes and fixed weapon colors install separate render hooks. Transfer
// ownership before saving restoration state, never nest one temporary style/batch
// inside another. Weak keys do not retain disposed native emitters.
const emitterOwners = new WeakMap<Raw, (emitter: Raw) => void>();

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
    if (emitterOwners.get(emitter) === releaseEmitter) emitterOwners.delete(emitter);
  };
  const claim = (emitter: Raw) => {
    const previous = emitterOwners.get(emitter);
    if (previous && previous !== releaseEmitter) previous(emitter);
    emitterOwners.set(emitter, releaseEmitter);
  };
  const release = (weapon: Raw) => {
    for (const [emitter, state] of owned) if (state.owner === weapon) releaseEmitter(emitter);
  };
  /** Fixed weapon RGB uses source brightness; beams may supply the source hue rotation. */
  const updateFixed = (
    owner: Raw,
    emitters: Raw[],
    color: number,
    grayscale: boolean,
    hue?: number,
  ) => {
    for (const emitter of emitters) {
      claim(emitter);
      let state = owned.get(emitter);
      if (state && (state.owner !== owner || state.grayscale !== grayscale)) {
        releaseEmitter(emitter);
        state = undefined;
      }
      if (!state) {
        state = {
          owner,
          start: emitter._startColor,
          finish: emitter._finishColor,
          appliedStart: emitter._startColor,
          appliedFinish: emitter._finishColor,
          particles: new Map(),
          grayscale,
          previousBatch: grayscale ? isolateBatch(emitter) : null,
        };
        owned.set(emitter, state);
        emitterOwners.set(emitter, releaseEmitter);
      }
      if (hue !== undefined) emitter.changeHue(hue);
      else {
        emitter._startColor = tintAtOriginalBrightness(color, emitter._originalStartColor);
        emitter._finishColor = tintAtOriginalBrightness(color, emitter._originalFinishColor);
      }
      state.appliedStart = emitter._startColor;
      state.appliedFinish = emitter._finishColor;
      state.grayscale = grayscale;
      if (grayscale) {
        state.previousBatch ??= isolateBatch(emitter);
        for (const particle of emitter.particles ?? []) styleParticle(state, particle);
        for (const particle of emitter.inactiveParticles ?? []) styleParticle(state, particle);
      } else {
        for (const [particle, style] of state.particles)
          if (read(particle, 'style') === style.owned) particle.setStyle(style.previous, false);
        state.particles.clear();
      }
    }
  };
  const update = (weapon: Raw, palette: HullPalette | null, transform: Raw) => {
    if (!palette) {
      release(weapon);
      return;
    }
    const observedTime = networkTime(weapon.g);
    const time = Number.isFinite(observedTime) ? observedTime : 0;
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
        claim(emitter);
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
            grayscale: true,
            previousBatch: isolateBatch(emitter),
          };
          owned.set(emitter, state);
          emitterOwners.set(emitter, releaseEmitter);
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
    const geometry = getActiveBeamGeometry(weapon);
    tint(weapon.startEffect, geometry?.start ?? weapon.renderStartPos ?? weapon.startPos);
    tint(weapon.startEffect2, geometry?.second ?? weapon.renderStartPos2 ?? weapon.startPos2);
    tint(weapon.endEffect, geometry?.end ?? weapon.renderEndPos ?? weapon.endPos);
  };
  const Emitter = api.cls('core.particle.Emitter')?.prototype;
  if (Emitter) {
    api.around(Emitter, 'add', function (next, ...args) {
      const count = this.particles?.length ?? 0;
      const result = next(...args);
      const state = owned.get(this);
      if (state?.grayscale)
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
  return { update, updateFixed, release };
}
