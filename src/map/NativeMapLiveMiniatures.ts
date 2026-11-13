import type { API } from '../api/Types';
import { GameReflection } from '../api/GameReflection';
import {
  GameObject,
  StarMap,
  type Boss,
  type EnemyShip,
  type GameScene,
  type Sprite,
} from '../game/Bindings';
import { NativeUI } from '../ui/NativeUI';
import { NexarEnemyIdentification } from '../ship/NexarEnemyIdentification';
import { MapLiveMiniature } from './MapLiveMiniature';

/** Reconcile live identities while the map is open; never mutate game units. */
export class MapLiveMiniatures {
  private readonly bosses = new Map<Boss, MapLiveMiniature>();
  private readonly minibosses = new Map<EnemyShip, MapLiveMiniature>();
  constructor(
    private readonly game: GameScene,
    private readonly scale: number,
    private readonly create: (owner: Boss | EnemyShip, boss: boolean) => MapLiveMiniature,
  ) {}

  update(): void {
    const bosses = this.game.bossManager?.bosses ?? [];
    const enemies = this.game.shipManager?.enemies ?? [];
    const byId = this.game.shipManager?.enemiesById;
    const validBoss = (owner: Boss) =>
      owner.alive && !owner.awaitingActivation && bosses.includes(owner);
    const validMiniboss = (owner: EnemyShip) => {
      const id = owner.get_id();
      // Haxe's IntMap stores numeric keys in its .h object.
      const current = byId?.h[id];
      return (
        owner.alive &&
        id > 0 &&
        current === owner &&
        enemies.includes(owner) &&
        NexarEnemyIdentification.usesMinibossMarker(owner)
      );
    };
    const sync = <T extends Boss | EnemyShip>(
      items: Map<T, MapLiveMiniature>,
      sources: T[],
      valid: (owner: T) => boolean,
      boss: boolean,
    ) => {
      for (const [owner, marker] of items)
        if (!marker.ownsCurrentLifecycle || !valid(owner)) {
          marker.dispose();
          items.delete(owner);
        }
      for (const owner of sources)
        if (valid(owner) && !items.has(owner)) items.set(owner, this.create(owner, boss));
      for (const marker of items.values()) marker.update(this.scale);
    };
    sync(this.bosses, bosses, validBoss, true);
    sync(this.minibosses, enemies, validMiniboss, false);
  }

  dispose(): void {
    for (const marker of [...this.bosses.values(), ...this.minibosses.values()]) marker.dispose();
    this.bosses.clear();
    this.minibosses.clear();
  }
}

export function installMapLiveMiniatures(api: API, game: GameScene): void {
  const reflection = new GameReflection(api);
  const prototype = StarMap.prototype;
  const ui = new NativeUI(api),
    lives = new WeakMap<object, number>();
  const life = (object: object) => lives.get(object) ?? 0;
  if (typeof GameObject.prototype.reset === 'function')
    reflection.before(GameObject.prototype, 'reset', function () {
      lives.set(this, life(this) + 1);
    });
  const maps = new Map<
    StarMap,
    {
      controller: MapLiveMiniatures;
      original: Array<[Sprite, boolean]>;
    }
  >();
  const dispose = (map: StarMap) => {
    const state = maps.get(map);
    if (!state) return;
    state.controller.dispose();
    for (const [layer, visible] of state.original) layer.set_visible(visible);
    maps.delete(map);
  };
  reflection.before(prototype, 'load', function () {
    dispose(this);
  });
  reflection.after(prototype, 'load', function () {
    if (this.g !== game) return;
    const original: Array<[Sprite, boolean]> = [];
    for (const marker of this.mapBosses) {
      original.push([marker.layer, marker.layer.get_visible()]);
      marker.layer.set_visible(false);
    }
    const map = this;
    const controller = new MapLiveMiniatures(
      game,
      StarMap.SCALE,
      (owner, boss) => new MapLiveMiniature(ui, map.mapContainer, owner, boss, life),
    );
    maps.set(map, { controller, original });
    controller.update();
  });
  reflection.after(prototype, 'update', function () {
    maps.get(this)?.controller.update();
  });
  reflection.before(prototype, 'dispose', function () {
    dispose(this);
  });
  api.on('frame', ({ game: current }) => {
    if (current !== game) return;
    for (const [map, state] of maps) if (map.get_stage()) state.controller.update();
  });
  api.defer(() => {
    for (const map of maps.keys()) dispose(map);
  });
}
