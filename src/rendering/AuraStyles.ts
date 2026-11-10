import { read, type API, type Raw } from '../api/Types';
import { createAuraStyle } from './AuraStyle';

/** Apply the source aura style to active and pooled particles, restoring their quad geometry on reuse. */
export function installAuraStyles(api: API): void {
  const factory = api.cls('core.particle.EmitterFactory');
  const emitter = api.cls('core.particle.Emitter')?.prototype;
  const particle = api.cls('core.particle.Particle')?.prototype;
  if (!factory?.createRareType || !emitter || !particle) return;
  const Style = createAuraStyle(api);
  const emitters = new Set<Raw>();
  const prepare = (value: Raw): void => {
    if (!(read(value, 'style') instanceof Style)) value.set_style(new Style());
  };
  const release = (value: Raw): void => {
    if (!emitters.delete(value)) return;
    for (const item of [...value.particles, ...value.inactiveParticles]) {
      if (!(read(item, 'style') instanceof Style)) continue;
      item.set_style(null);
      const texture = read(item, 'texture'),
        vertices = read(item, 'vertexData');
      if (texture && vertices) {
        texture.setupVertexPositions(vertices);
        texture.setupTextureCoordinates(vertices);
        item.setVertexDataChanged();
      }
    }
  };
  api.after(factory, 'createRareType', function (values: Raw[] | null) {
    for (const value of values ?? []) {
      emitters.add(value);
      for (const item of [...value.particles, ...value.inactiveParticles]) prepare(item);
    }
  });
  api.after(emitter, 'add', function () {
    const item = this.particles[this.particles.length - 1];
    if (item && emitters.has(this)) prepare(item);
  });
  api.after(particle, 'set_texture', function () {
    const style = read(this, 'style');
    if (style instanceof Style) style.prepareQuad();
  });
  api.before(emitter, 'dispose', function () {
    release(this);
  });
  api.defer(() => {
    for (const value of emitters) release(value);
  });
}
