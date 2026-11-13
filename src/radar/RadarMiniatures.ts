import { RadarIdentity } from './RadarIdentity';
import type { API } from '../api/Types';
import { GameReflection } from '../api/GameReflection';
import {
  Boss,
  Mesh,
  Polygon,
  EnemyShip,
  Radar,
  RadarBlip,
  Sprite,
  type GameObject,
  type GameScene,
} from '../game/Bindings';
import type { RenderedGameObject } from '../game/RenderedGameObject';
import { MapLiveMiniature } from '../map/MapLiveMiniature';
import { NexarEnemyIdentification } from '../ship/NexarEnemyIdentification';
import { NativeUI } from '../ui/NativeUI';

/** Original radar projects contacts onto the rim, fading from 2500 to 5000 units. */
export function radarPosition(dx: number, dy: number) {
  const distance = Math.hypot(dx, dy);
  const radius = Math.min(60, (distance / 2500) * 60);
  return {
    x: distance > 0.0001 ? 60 + (dx / distance) * radius : 60,
    y: distance > 0.0001 ? 60 + (dy / distance) * radius : 60,
    alpha: distance < 2500 ? 1 : Math.max(0, 1 - (distance - 2500) / 2500),
    visible: distance < 5000,
  };
}

export function installRadarMiniatures(api: API, game: GameScene): void {
  const reflection = new GameReflection(api);
  const ui = new NativeUI(api);
  const states = new Map<
    Radar,
    { layer: Sprite; mask: Mesh; markers: Map<GameObject, MapLiveMiniature> }
  >();
  const life = (owner: RenderedGameObject) => owner.get_lifecycleId?.() ?? 0;
  const identities = new RadarIdentity<GameObject>(life, (owner) => {
    if (!(owner instanceof EnemyShip)) return true;
    return owner.get_id() > 0 && game.shipManager.enemiesById.h[owner.get_id()] === owner;
  });
  const capture = (radar: Radar) => {
    if (radar.g !== game || !radar.blips) return;
    for (const blip of radar.blips) identities.capture(blip, blip.go);
  };
  const prune = (radar: Radar) => {
    if (!radar.blips) return;
    for (let index = radar.blips.length - 1; index >= 0; index--) {
      const blip = radar.blips[index];
      if (identities.owns(blip, blip.go)) continue;
      radar.blips.splice(index, 1);
      blip.dispose();
    }
  };
  const dispose = (radar: Radar) => {
    const state = states.get(radar);
    if (!state) return;
    for (const marker of state.markers.values()) marker.dispose();
    state.layer.set_mask(null);
    state.layer.removeFromParent(true);
    state.mask.dispose();
    states.delete(radar);
  };
  const update = (radar: Radar) => {
    if (radar.g !== game || !radar.blips) return;
    capture(radar);
    prune(radar);
    let state = states.get(radar);
    if (!state) {
      const layer = new Sprite();
      const mask: Mesh = Mesh.fromPolygon(Polygon.createCircle(60, 60, 60));
      layer.set_touchable(false);
      mask.set_touchable(false);
      layer.set_mask(mask);
      radar.addChild(layer);
      state = { layer, mask, markers: new Map() };
      states.set(radar, state);
    }
    const candidates = new Set<GameObject>();
    for (const blip of radar.blips) {
      const owner = blip.go;
      if (
        (owner instanceof Boss && owner.alive && !owner.awaitingActivation) ||
        (owner instanceof EnemyShip &&
          owner.alive &&
          NexarEnemyIdentification.usesMinibossMarker(owner))
      )
        candidates.add(owner);
    }
    for (const [owner, marker] of state.markers) {
      if (!candidates.has(owner) || !marker.ownsCurrentLifecycle) {
        marker.dispose();
        state.markers.delete(owner);
      }
    }
    const player = game.get_me();
    const ship: RenderedGameObject | null = player?.ship ?? null;
    state.layer.set_visible(!!ship && !player?.isLanded);
    for (const owner of candidates) {
      let marker = state.markers.get(owner);
      if (!marker) {
        marker = new MapLiveMiniature(ui, state.layer, owner, owner instanceof Boss, life);
        state.markers.set(owner, marker);
      }
      marker.update(0);
      if (!ship) continue;
      const rendered: RenderedGameObject = owner;
      const pose = radarPosition(
        (rendered.get_renderX?.() ?? owner.get_x()) - (ship.get_renderX?.() ?? ship.get_x()),
        (rendered.get_renderY?.() ?? owner.get_y()) - (ship.get_renderY?.() ?? ship.get_y()),
      );
      const layer = marker.layer;
      layer.set_x(pose.x);
      layer.set_y(pose.y);
      layer.set_alpha(pose.alpha);
      layer.set_visible(pose.visible);
    }
  };
  reflection.after(Radar.prototype, 'createBlip', function () {
    capture(this);
  });
  reflection.before(Radar.prototype, 'update', function () {
    if (this.g === game) {
      capture(this);
      prune(this);
    }
  });
  reflection.after(Radar.prototype, 'load', function () {
    update(this);
  });
  reflection.before(Radar.prototype, 'dispose', function () {
    dispose(this);
  });
  reflection.around(RadarBlip.prototype, 'updateVisibility', function (next) {
    const visible = next();
    if (this.g !== game) return visible;
    for (const state of states.values()) {
      const marker = state.markers.get(this.go);
      if (marker?.ownsCurrentLifecycle && marker.hasParts) return false;
    }
    return visible;
  });
  api.on('frame', ({ game: current }) => {
    if (current !== game) return;
    const radar = game.hud?.radar;
    if (radar) update(radar);
  });
  api.defer(() => {
    for (const radar of states.keys()) dispose(radar);
  });
}
