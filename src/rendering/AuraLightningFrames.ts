import { createAuraOutlineLightning } from './AuraOutlineLightning';
import { AuraTextureContours } from './AuraTextureContours';
import { read, type API, type Raw } from '../api/Types';
import { createAuraLightning } from './AuraLightning';
import { AuraTextureAnchors } from './AuraTextureAnchors';
import { installAuraTextureSource } from './AuraTextureSource';

interface LightningEntry {
  frequency: number;
  mesh: Raw | null;
  outline: Raw | null;
  particle: Raw | null;
  alpha: number;
}

/** Emitter.updateAuraLightning: track the strongest actually drawn aura pulse. */
export class AuraLightningFrames {
  private entries = new Map<Raw, LightningEntry>();
  constructor(
    private api: API,
    private Mesh: any,
    private anchors: AuraTextureAnchors,
    private OutlineMesh?: any,
    private contours?: AuraTextureContours,
  ) {}

  prepare(emitter: Raw, rarity: number): void {
    if (!this.entries.has(emitter))
      this.entries.set(emitter, {
        frequency: rarity === 4 || rarity === 5 ? 0.3125 : 0.25,
        mesh: null,
        outline: null,
        particle: null,
        alpha: 0,
      });
  }
  begin(emitter: Raw): void {
    if (emitter.qolafAuraLightningFrequency != null && !this.entries.has(emitter)) {
      this.prepare(emitter, 4);
    }
    const entry = this.entries.get(emitter);
    if (!entry) return;
    entry.mesh?.set_visible(false);
    entry.outline?.set_visible(false);
    entry.particle = null;
    entry.alpha = 0;
  }
  observe(emitter: Raw, particle: Raw, alpha: number): void {
    const entry = this.entries.get(emitter);
    if (entry && alpha > entry.alpha) {
      entry.particle = particle;
      entry.alpha = alpha;
    }
  }
  finish(emitter: Raw, elapsed: number): void {
    const entry = this.entries.get(emitter);
    if (
      !entry ||
      !emitter.isEmitting ||
      !emitter.isOnScreen ||
      read(emitter.g, 'isLeaving') ||
      this.api.cls('core.scene.SceneBase')?.clientSettings?.disableRemasteredAuras
    )
      return;
    const particle = entry.particle;
    const texture = read(particle, 'texture');
    const target = emitter.target;
    const clip = read(target, 'movieClip');
    const owner = read(target, 'auraDisplayObject', clip);
    const layer = read(emitter.collectiveMeshBatch, 'parent');
    if (
      !particle ||
      !texture ||
      !clip ||
      entry.alpha <= 0 ||
      !layer ||
      !read(layer, 'visible') ||
      !read(layer, 'parent')
    )
      return;
    const mesh = entry.mesh ?? (entry.mesh = new this.Mesh());
    if (read(mesh, 'parent') !== layer) layer.addChild(mesh);
    mesh.setAnchors(this.anchors.points(texture));
    mesh.advance(
      elapsed,
      (read(texture, 'width') * Math.abs(read(particle, 'scaleX'))) / 2,
      (read(texture, 'height') * Math.abs(read(particle, 'scaleY'))) / 2,
      read(particle, 'color'),
      8,
      3,
      emitter.qolafAuraLightningFrequency ?? entry.frequency,
    );
    this.align(mesh, particle, entry.alpha, clip, owner);
    if (this.OutlineMesh && this.contours) {
      const outline = entry.outline ?? (entry.outline = new this.OutlineMesh());
      if (read(outline, 'parent') !== layer) layer.addChild(outline);
      outline.setContours(this.contours.contours(texture));
      outline.advance(
        elapsed,
        (read(texture, 'width') * Math.abs(read(particle, 'scaleX'))) / 2,
        (read(texture, 'height') * Math.abs(read(particle, 'scaleY'))) / 2,
        read(particle, 'color'),
        8,
        3,
        (emitter.qolafAuraLightningFrequency ?? entry.frequency) / 16,
      );
      this.align(outline, particle, entry.alpha, clip, owner);
    }
  }

  private align(mesh: Raw, particle: Raw, particleAlpha: number, clip: Raw, owner: Raw): void {
    mesh.set_x(read(particle, 'x'));
    mesh.set_y(read(particle, 'y'));
    mesh.set_rotation(read(particle, 'rotation'));
    mesh.set_scaleX(read(particle, 'scaleX') < 0 ? -1 : 1);
    mesh.set_scaleY(read(particle, 'scaleY') < 0 ? -1 : 1);
    let alpha =
      read(mesh, 'alpha') * Math.min(1, particleAlpha / Math.max(0.001, particle.startAlpha));
    for (let node = clip; node && node !== owner; node = read(node, 'parent')) {
      alpha *= read(node, 'alpha');
      if (!read(node, 'visible')) mesh.set_visible(false);
    }
    mesh.set_alpha(alpha);
  }
  release(emitter: Raw): void {
    const entry = this.entries.get(emitter);
    if (!entry) return;
    this.entries.delete(emitter);
    entry.mesh?.removeFromParent(true);
    entry.outline?.removeFromParent(true);
  }
  dispose(): void {
    for (const emitter of this.entries.keys()) this.release(emitter);
  }
}

export function installAuraLightning(api: API): AuraLightningFrames | undefined {
  const factory = api.cls('core.particle.EmitterFactory');
  const Emitter = api.cls('core.particle.Emitter');
  if (!factory?.createRareType || !Emitter) return;
  const source = installAuraTextureSource(api);
  if (!source) return;
  const frames = new AuraLightningFrames(
    api,
    createAuraLightning(api),
    new AuraTextureAnchors(source),
    createAuraOutlineLightning(api),
    new AuraTextureContours(source),
  );
  api.after(
    factory,
    'createRareType',
    function (emitters: Raw[] | null, _game: Raw, _target: Raw, rarity = 0) {
      // Golden has two layers, but only the first owns the lightning.
      if (emitters?.length) frames.prepare(emitters[0], rarity);
    },
  );
  api.before(Emitter.prototype, 'dispose', function () {
    delete this.qolafAuraLightningFrequency;
    frames.release(this);
  });
  api.defer(() => frames.dispose());
  return frames;
}
