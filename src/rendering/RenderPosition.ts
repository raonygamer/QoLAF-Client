import { EngineRenderPose } from './EngineRenderPose';
import type { API } from '../api/Types';
import { GameReflection } from '../api/GameReflection';
import { GameObject, Engine, Projectile, Body } from '../game/Bindings';

import type { RenderedGameObject } from '../game/RenderedGameObject';

const coordinates = [
  ['get_x', 'get_renderX'],
  ['get_y', 'get_renderY'],
  ['get_rotation', 'get_renderRotation'],
] as const;

/** GameObject.as: a canvas attachment is not proof that its pooled clip was drawn. */
export function installRenderPosition(api: API): void {
  const reflection = new GameReflection(api);
  const prototype = GameObject.prototype;
  const ready = new WeakSet<GameObject>();
  const lifecycles = new WeakMap<GameObject, number>();
  const installGetter = <T extends object>(
    owner: T,
    name: string,
    getter: (this: T) => number | boolean,
  ) => {
    // An upstream implementation takes precedence if the game later adds this API.
    if (Object.prototype.hasOwnProperty.call(owner, name)) return;
    Object.defineProperty(owner, name, { configurable: true, writable: true, value: getter });
    api.defer(() => {
      if (Object.getOwnPropertyDescriptor(owner, name)?.value === getter)
        Reflect.deleteProperty(owner, name);
    });
  };
  if (typeof Reflect.get(prototype, 'get_lifecycleId') !== 'function') {
    installGetter(prototype, 'get_lifecycleId', function () {
      return lifecycles.get(this) ?? 0;
    });
    reflection.before(prototype, 'reset', function () {
      lifecycles.set(this, ((lifecycles.get(this) ?? 0) + 1) >>> 0);
    });
  }
  for (const [nativeGetter, renderGetter] of coordinates) {
    installGetter(prototype, renderGetter, function () {
      const clip = this._mc && this.isAddedToCanvas && ready.has(this) ? this._mc : null;
      return clip ? clip[nativeGetter]() : this[nativeGetter]();
    });
  }
  installGetter(prototype, 'get_renderMirrored', function () {
    return !!this._mc && this._mc.get_scaleX() * this._mc.get_scaleY() < 0;
  });
  const enginePoses = new WeakMap<Engine, EngineRenderPose>();
  for (const [nativeGetter, renderGetter] of coordinates) {
    installGetter(Engine.prototype, renderGetter, function () {
      const ship = this.ship;
      if (!this.alive || !ship?.alive || ship.engine !== this || !ship.enginePos)
        return this[nativeGetter]();
      const rendered: RenderedGameObject = ship;
      let pose = enginePoses.get(this);
      if (!pose) {
        pose = new EngineRenderPose();
        enginePoses.set(this, pose);
      }
      pose.update(
        rendered.get_renderX?.() ?? ship.get_x(),
        rendered.get_renderY?.() ?? ship.get_y(),
        rendered.get_renderRotation?.() ?? ship.get_rotation(),
        ship.enginePos.x,
        ship.enginePos.y,
      );
      return nativeGetter === 'get_x' ? pose.x : nativeGetter === 'get_y' ? pose.y : pose.rotation;
    });
  }

  const previous = Object.getOwnPropertyDescriptor(prototype, 'hasRenderPosition');
  const hasRenderPosition = function (this: GameObject): boolean {
    return ready.has(this);
  };
  Object.defineProperty(prototype, 'hasRenderPosition', {
    configurable: true,
    get: hasRenderPosition,
  });
  reflection.after(prototype, 'draw', function () {
    if (this.get_hasImage() && this._mc) ready.add(this);
  });
  reflection.after(Projectile.prototype, 'draw', function () {
    // Concussion spheres have no bitmap: their particles are the visible shot.
    // ProjectileFrames still predicts their placeholder clip, so attached effects
    // must accept that pose even though the native base draw skips imgObj=null.
    if (this.alive && this.course && this._mc) ready.add(this);
  });
  for (const method of ['reset', 'addToCanvas', 'removeFromCanvas'] as const) {
    reflection.before(prototype, method, function () {
      ready.delete(this);
    });
  }
  for (const method of ['addToCanvas', 'removeFromCanvas'] as const) {
    reflection.before(Projectile.prototype, method, function () {
      ready.delete(this);
    });
  }
  reflection.before(Body.prototype, 'addToCanvasForReal', function () {
    ready.delete(this);
  });
  api.defer(() => {
    if (Object.getOwnPropertyDescriptor(prototype, 'hasRenderPosition')?.get !== hasRenderPosition)
      return;
    if (previous) Object.defineProperty(prototype, 'hasRenderPosition', previous);
    else Reflect.deleteProperty(prototype, 'hasRenderPosition');
  });
}
