import { read, type API, type Raw } from '../api/Types';
import { type Resolve } from '../runtime/As3';
import { installBeamEmitterTint } from './BeamEmitterTint';
import { createGrayscaleTintStyle } from './GrayscaleTintStyle';
import { WeaponColors, type WeaponColor } from './WeaponColors';
import { ClientDevVisual } from './ClientDevVisual';

/** Presentation only: the native factory, simulation, collision and damage still run. */
export function installNativeWeaponColors(
  api: API,
  game: Raw,
  resolve: Resolve,
  colors: WeaponColors,
) {
  const emitters = installBeamEmitterTint(api, resolve);
  const Color = resolve('generics.Color');
  let Style: any;
  const makeStyle = (mesh: Raw) => {
    Style ??= createGrayscaleTintStyle(resolve);
    const style = new Style();
    style.set_texture(read(mesh, 'texture'));
    style.set_textureSmoothing(read(mesh, 'textureSmoothing'));
    return style;
  };
  const hue = (color: number) => {
    const rgb = [(color >> 16) & 255, (color >> 8) & 255, color & 255];
    const hsv = Color.RGBtoHSV(...rgb);
    return (((hsv[0] - 120 + 360) % 360) * Math.PI) / 360;
  };
  const selected = (weapon: Raw | null): WeaponColor | null =>
    weapon && weapon.unit === game.me?.ship ? colors.get(weapon.key) : null;
  const ownsHullPalette = (weapon: Raw) =>
    weapon.key === ClientDevVisual.PHASE_BLADE &&
    read(read(weapon.unit, 'movieClip'), 'style')?.__class__?.__name__ ===
      'qolaf.visuals.ClientDevVisualStyle';

  let beamColor: WeaponColor | null = null;
  const beamStyles = new WeakMap<Raw, Raw>();
  const Beam = api.cls('core.weapon.Beam')?.prototype;
  const BeamLine = api.cls('core.hud.components.BeamLine')?.prototype;
  if (Beam && BeamLine) {
    api.around(Beam, 'draw', function (next, ...args) {
      const style = this.g === game && !ownsHullPalette(this) ? selected(this) : null;
      const previous = beamColor;
      beamColor = style;
      if (style)
        emitters.updateFixed(
          this,
          [...(this.startEffect ?? []), ...(this.startEffect2 ?? []), ...(this.endEffect ?? [])],
          style.color,
          style.grayscale,
          hue(style.color),
        );
      else emitters.release(this);
      const saved = style ? this.lines.map((line: Raw) => [line, read(line, 'color')]) : [];
      try {
        for (const [line] of saved) line.set_color(style!.color);
        return next(...args);
      } finally {
        for (const [line, color] of saved) line.set_color(color);
        beamColor = previous;
      }
    });
    api.around(BeamLine, 'addMesh', function (next, segment, ...args) {
      if (!beamColor?.grayscale) return next(segment, ...args);
      let style = beamStyles.get(segment);
      if (!style) {
        style = makeStyle(segment);
        beamStyles.set(segment, style!);
      }
      style!.set_texture(read(segment, 'texture'));
      style!.set_textureSmoothing(read(segment, 'textureSmoothing'));
      const previous = read(segment, 'style');
      segment.setStyle(style, false);
      try {
        return next(segment, ...args);
      } finally {
        segment.setStyle(previous, false);
      }
    });
    for (const method of ['destroy', 'init'])
      api.before(Beam, method, function () {
        if (this.g === game) emitters.release(this);
      });
  }

  interface ProjectileState {
    color: WeaponColor;
    clip: Raw;
    previousColor: number;
    previousStyle: Raw;
    ownedStyle: Raw | null;
    ribbon: Raw | null;
    ribbonColor: number;
    ribbonStyle: Raw | null;
    ownedRibbonStyle: Raw | null;
  }
  const projectiles = new Map<Raw, ProjectileState>();
  const meshes = new WeakMap<Raw, ProjectileState>();
  const restore = (projectile: Raw) => {
    const state = projectiles.get(projectile);
    if (!state) return;
    if (read(state.clip, 'color') === state.color.color) state.clip.set_color(state.previousColor);
    if (state.ownedStyle && read(state.clip, 'style') === state.ownedStyle)
      state.clip.setStyle(state.previousStyle, false);
    if (state.ribbon && read(state.ribbon, 'color') === state.color.color)
      state.ribbon.set_color(state.ribbonColor);
    if (state.ribbon) {
      if (state.ownedRibbonStyle && read(state.ribbon, 'style') === state.ownedRibbonStyle)
        state.ribbon.setStyle(state.ribbonStyle, false);
      meshes.delete(state.ribbon);
    }
    emitters.release(projectile);
    meshes.delete(state.clip);
    projectiles.delete(projectile);
  };
  const Factory = api.cls('core.projectile.ProjectileFactory');
  const Projectile = api.cls('core.projectile.Projectile')?.prototype;
  if (Factory && Projectile) {
    api.around(Factory, 'create', function (next, ...args) {
      const projectile = next(...args);
      if (!projectile || projectile.g !== game) return projectile;
      restore(projectile);
      const color = selected(projectile.weapon);
      if (!color) return projectile;
      const clip = read(projectile, 'movieClip');
      if (!clip) return projectile;
      const ribbon = projectile.ribbonTrail;
      const state: ProjectileState = {
        color,
        clip,
        previousColor: read(clip, 'color'),
        previousStyle: read(clip, 'style'),
        ownedStyle: color.grayscale ? makeStyle(clip) : null,
        ribbon,
        ribbonColor: read(ribbon, 'color'),
        ribbonStyle: read(ribbon, 'style', null),
        ownedRibbonStyle: ribbon && color.grayscale ? makeStyle(ribbon) : null,
      };
      projectiles.set(projectile, state);
      meshes.set(clip, state);
      clip.set_color(color.color);
      if (state.ownedStyle) clip.setStyle(state.ownedStyle, false);
      if (ribbon) {
        ribbon.set_color(color.color);
        meshes.set(ribbon, state);
        if (state.ownedRibbonStyle) ribbon.setStyle(state.ownedRibbonStyle, false);
      }
      emitters.updateFixed(
        projectile,
        projectile.thrustEmitters ?? [],
        color.color,
        color.grayscale,
      );
      return projectile;
    });
    api.before(Projectile, 'reset', function () {
      restore(this);
    });
    let exploding: { owner: Raw; color: WeaponColor } | null = null;
    api.around(Projectile, 'explode', function (next, ...args) {
      const previous = exploding;
      const state = projectiles.get(this);
      // Explosion particles outlive the pooled projectile; give them their own owner.
      exploding = state ? { owner: {}, color: state.color } : null;
      try {
        return next(...args);
      } finally {
        exploding = previous;
      }
    });
    const EmitterFactory = api.cls('core.particle.EmitterFactory');
    if (EmitterFactory)
      api.around(EmitterFactory, 'create', function (next, ...args) {
        const result = next(...args);
        if (exploding && args[1] === game && Array.isArray(result))
          emitters.updateFixed(
            exploding.owner,
            result,
            exploding.color.color,
            exploding.color.grayscale,
          );
        return result;
      });
  }

  // Each native pool shares one shader batch. Keep tinted meshes in a compatible batch.
  const extraBatches: Raw[] = [];
  for (const manager of [game.projectileManager, game.ribbonTrailPool]) {
    if (!manager?.meshBatch) continue;
    let batch: Raw | null = null;
    api.before(manager, 'update', () => {
      batch?.clear();
    });
    api.around(manager.meshBatch, 'addMesh', function (next, mesh, ...args) {
      if (!meshes.get(mesh)?.color.grayscale) return next(mesh, ...args);
      if (!batch) {
        const Batch = resolve('starling.display.MeshBatch');
        batch = new Batch();
        batch!.set_touchable(false);
        batch!.set_blendMode(read(manager.meshBatch, 'blendMode'));
        extraBatches.push(batch!);
      }
      const parent = read(manager.meshBatch, 'parent');
      if (parent && read(batch, 'parent') !== parent) parent.addChild(batch);
      return batch!.addMesh(mesh, ...args);
    });
  }
  const Ship = api.cls('core.ship.PlayerShip')?.prototype;
  if (Ship)
    api.after(Ship, 'startChargeUpEffect', function () {
      if (this !== game.me?.ship) return;
      const style = selected(read(this, 'weapon'));
      if (style)
        emitters.updateFixed(
          this,
          this.chargeUpEffect ?? [],
          style.color,
          style.grayscale,
          hue(style.color),
        );
      else emitters.release(this);
    });
  api.defer(() => {
    for (const projectile of projectiles.keys()) restore(projectile);
    for (const batch of extraBatches) batch.removeFromParent(true);
  });
}
