import {
  DataLocator,
  GameScene,
  SceneBase,
  Projectile,
  ProjectileFactory,
  type FragmentFilter,
} from '../game/Bindings';
import type { API } from '../api/Types';
import type { RingDistortionFilter } from './RingDistortionFilter';
import { createRingDistortionFilter } from './RingDistortionFilter';
import { RingDistortionTextures } from './RingDistortionSource';
import { ShockwaveDistortion } from './ShockwaveDistortion';

const bombEffects = new Set(['ULFD9eDI_kylxaRkHovbsw', 'k6OCAEQySUyYZWhTiipOeQ']);

/** Original BodyManager bomb distortions; stellar distortions remain disabled. */
export function installNativeBombShockwaves(api: API, game: GameScene): void {
  const projectile = Projectile.prototype;
  const factory = ProjectileFactory;
  const canvas = game.canvas;
  if (!projectile || !factory || !canvas) return;
  const textures = new RingDistortionTextures(api);
  const waves: ShockwaveDistortion[] = [];
  const speeds = new WeakMap<Projectile, number>();
  const triggered = new WeakSet<Projectile>();
  let filter: RingDistortionFilter | null = null;
  let previousFilter: FragmentFilter | null = null;
  let creating: { game: GameScene; speed: number } | null = null;
  const enabled = () => !!GameScene.highSettings && !!SceneBase.settings?.get_showEffects();

  api.around(factory, 'create', function (next, key, owner, ...args) {
    if (owner !== game) return next(key, owner, ...args);
    const definition = DataLocator.getService().loadKey('Projectiles', key);
    const previous = creating;
    creating = { game: owner, speed: Number(definition?.aiBlastSpeed ?? 0) };
    try {
      const result = next(key, owner, ...args);
      if (result) speeds.set(result, creating.speed);
      return result;
    } finally {
      creating = previous;
    }
  });
  api.before(projectile, 'reset', function () {
    speeds.delete(this);
    triggered.delete(this);
  });
  api.before(projectile, 'explode', function () {
    if (this.g !== game || !bombEffects.has(this.explosionEffect) || triggered.has(this)) return;
    // Mark before any visibility/quality checks, exactly once per pooled life.
    triggered.add(this);
    const position = this.get_pos();
    const radius = this.dmgRadius;
    if (
      !enabled() ||
      !position ||
      !Number.isFinite(position.x) ||
      !Number.isFinite(position.y) ||
      !Number.isFinite(radius) ||
      radius <= 0 ||
      !Number.isFinite(game.time)
    )
      return;
    if (waves.length >= 12) waves.shift()!.dispose();
    const speed = speeds.get(this) ?? (creating?.game === game ? creating.speed : 0);
    waves.push(new ShockwaveDistortion(api, textures, game, position.x, position.y, radius, speed));
  });

  const detach = () => {
    if (filter && canvas.get_filter() === filter) canvas.set_filter(previousFilter);
    previousFilter = null;
  };
  const clear = () => {
    for (const wave of waves) wave.dispose();
    waves.length = 0;
    detach();
    filter?.dispose();
    filter = null;
  };
  const update = () => {
    if (!enabled() || game.get_isLeaving()) {
      clear();
      return;
    }
    const sources = [];
    for (let index = waves.length - 1; index >= 0; index--) {
      const wave = waves[index];
      if (wave.expired) {
        waves.splice(index, 1);
        wave.dispose();
      } else if (wave.updatePosition()) sources.push(wave.source);
    }
    if (!sources.length) {
      detach();
      return;
    }
    filter ??= createRingDistortionFilter(api);
    if (filter.compose(sources)) {
      if (canvas.get_filter() !== filter) {
        previousFilter = canvas.get_filter();
        canvas.set_filter(filter);
      }
    } else detach();
  };
  // The game's existing frame listener draws/interpolates and moves the camera
  // first. Project these maps afterwards, immediately before Starling renders.
  game.addEventListener('enterFrame', update);
  api.defer(() => {
    game.removeEventListener('enterFrame', update);
    clear();
    textures.dispose();
  });
}
