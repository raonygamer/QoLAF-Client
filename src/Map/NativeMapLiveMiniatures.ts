import { read, type API, type Raw } from '../Api/Types';
import { NativeUI } from '../UI/NativeUI';
import { NexarEnemyIdentification } from '../Ship/NexarEnemyIdentification';
import { MapLiveMiniature } from './MapLiveMiniature';

/** Reconcile live identities while the map is open; never mutate game units. */
export class MapLiveMiniatures {
  private readonly bosses = new Map<Raw, MapLiveMiniature>();
  private readonly minibosses = new Map<Raw, MapLiveMiniature>();
  constructor(
    private readonly game: Raw,
    private readonly scale: number,
    private readonly create: (owner: Raw, boss: boolean) => MapLiveMiniature,
  ) {}

  update(): void {
    const bosses: Raw[] = this.game.bossManager?.bosses ?? [];
    const enemies: Raw[] = this.game.shipManager?.enemies ?? [];
    const byId = this.game.shipManager?.enemiesById;
    const validBoss = (owner: Raw) =>
      owner.alive && !owner.awaitingActivation && bosses.includes(owner);
    const validMiniboss = (owner: Raw) => {
      const id = read(owner, 'id');
      // Haxe's IntMap stores numeric keys in its .h object.
      const current = typeof byId?.get === 'function' ? byId.get(id) : (byId?.h ?? byId)?.[id];
      return (
        owner.alive &&
        id > 0 &&
        current === owner &&
        enemies.includes(owner) &&
        NexarEnemyIdentification.usesMinibossMarker(owner)
      );
    };
    const sync = (
      items: Map<Raw, MapLiveMiniature>,
      sources: Raw[],
      valid: (owner: Raw) => boolean,
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

export function installMapLiveMiniatures(api: API, game: Raw): void {
  const MapClass = api.cls('core.hud.components.map.Map'),
    prototype = MapClass?.prototype;
  if (!prototype?.load) return;
  const ui = new NativeUI(api),
    lives = new WeakMap<Raw, number>();
  const life = (object: Raw) => lives.get(object) ?? 0;
  const object = api.cls('core.GameObject')?.prototype;
  if (typeof object?.reset === 'function')
    api.before(object, 'reset', function () {
      lives.set(this, life(this) + 1);
    });
  const maps = new Map<Raw, { controller: MapLiveMiniatures; original: [Raw, boolean][] }>();
  const dispose = (map: Raw) => {
    const state = maps.get(map);
    if (!state) return;
    state.controller.dispose();
    for (const [layer, visible] of state.original) layer.set_visible(visible);
    maps.delete(map);
  };
  api.before(prototype, 'load', function () {
    dispose(this);
  });
  api.after(prototype, 'load', function () {
    if (this.g !== game) return;
    const original: [Raw, boolean][] = [];
    for (const marker of this.mapBosses) {
      original.push([marker.layer, read(marker.layer, 'visible')]);
      marker.layer.set_visible(false);
    }
    const map = this;
    const controller = new MapLiveMiniatures(
      game,
      MapClass!.SCALE,
      (owner, boss) => new MapLiveMiniature(ui, map.mapContainer, owner, boss, life),
    );
    maps.set(map, { controller, original });
    controller.update();
  });
  api.after(prototype, 'update', function () {
    maps.get(this)?.controller.update();
  });
  api.before(prototype, 'dispose', function () {
    dispose(this);
  });
  api.on('frame', ({ game: current }) => {
    if (current !== game) return;
    for (const [map, state] of maps) if (read(map, 'stage')) state.controller.update();
  });
  api.defer(() => {
    for (const map of maps.keys()) dispose(map);
  });
}
