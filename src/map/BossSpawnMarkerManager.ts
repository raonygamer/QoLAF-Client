import { mapHeatViewport } from './NativeMapNavigation';
import { read, type API, type Raw } from '../api/Types';
import { NativeUI } from '../ui/NativeUI';
import { BossSpawnCatalog, type BossSpawnDescription } from './BossSpawnCatalog';
import { BossSpawnLocation, type SpawnViewport } from './BossSpawnLocation';
import { BossSpawnMarker } from './BossSpawnMarker';
import { MinibossSpawnHeat } from './MinibossSpawnHeat';

/** Shared source locations with independent world and system-map display ownership. */
export class BossSpawnMarkerManager {
  readonly locations: BossSpawnLocation[] = [];
  readonly heatLocations: BossSpawnLocation[] = [];
  private readonly layer: Raw;
  private readonly heatLayer: Raw;
  private readonly markers: BossSpawnMarker[] = [];
  private readonly heatAreas: MinibossSpawnHeat[] = [];
  private readonly topLeft: Raw;
  private readonly bottomRight: Raw;
  private readonly viewport: SpawnViewport = { left: 0, right: 0, top: 0, bottom: 0 };

  constructor(
    private readonly ui: NativeUI,
    private readonly game: Raw,
    life: (object: Raw) => number,
  ) {
    this.layer = ui.sprite();
    this.heatLayer = ui.sprite();
    for (const layer of [this.layer, this.heatLayer]) {
      layer.set_touchable(false);
      layer.set_visible(false);
    }
    const Point = ui.cls('openfl.geom.Point');
    this.topLeft = new Point();
    this.bottomRight = new Point();
    game.canvasBodies.addChildAt(this.heatLayer, 0);
    game.canvasBodies.addChild(this.layer);
    const bosses = game.dataManager.loadTable('Bosses'),
      enemies = game.dataManager.loadTable('Enemies');
    const add = (
      anchor: Raw,
      description: BossSpawnDescription | null,
      heat = false,
      gravityBody?: Raw,
    ) => {
      if (!description) return;
      const location = new BossSpawnLocation(anchor, description, game, life);
      if (gravityBody) location.setGravityBody(gravityBody);
      if (heat) {
        this.heatLocations.push(location);
        const area = new MinibossSpawnHeat(ui, location);
        this.heatAreas.push(area);
        this.heatLayer.addChild(area.node);
      } else {
        this.locations.push(location);
        const marker = new BossSpawnMarker(ui, location);
        marker.node.set_alpha(0.75);
        this.markers.push(marker);
        this.layer.addChild(marker.node);
      }
    };
    for (const body of game.bodyManager.bodies) {
      add(body, BossSpawnCatalog.describeBoss(body.obj, bosses));
      for (const spawner of body.spawners ?? []) {
        add(
          spawner,
          BossSpawnCatalog.describeSpawner(spawner.obj, enemies),
          false,
          BossSpawnCatalog.isNetherBlobSpawner(spawner.obj) ? body : undefined,
        );
        add(spawner, BossSpawnCatalog.describeSpawnerHeat(spawner.obj, enemies), true);
      }
    }
  }

  get enabled(): boolean {
    return this.ui.api.cls('core.scene.SceneBase')?.clientSettings?.showBossSpawnMarkers ?? true;
  }
  get heatEnabled(): boolean {
    return (
      this.ui.api.cls('core.scene.SceneBase')?.clientSettings?.showMinibossSpawnHeatmap ?? true
    );
  }

  draw(): void {
    const game = this.game,
      stage = read(game, 'stage');
    const active = !!stage && !!read(game.canvas, 'visible');
    this.layer.set_visible(active && this.enabled);
    this.heatLayer.set_visible(active && this.heatEnabled);
    if (!active || (!this.enabled && !this.heatEnabled)) return;
    const scale = Math.abs(read(game.canvas, 'scaleX') * read(game.canvasBodies, 'scaleX'));
    if (!Number.isFinite(scale) || scale <= 0) {
      this.layer.set_visible(false);
      this.heatLayer.set_visible(false);
      return;
    }
    this.topLeft.setTo(0, 0);
    this.bottomRight.setTo(read(stage, 'stageWidth'), read(stage, 'stageHeight'));
    this.layer.globalToLocal(this.topLeft, this.topLeft);
    this.layer.globalToLocal(this.bottomRight, this.bottomRight);
    Object.assign(this.viewport, {
      left: this.topLeft.x,
      top: this.topLeft.y,
      right: this.bottomRight.x,
      bottom: this.bottomRight.y,
    });
    if (this.enabled) for (const marker of this.markers) marker.update(1, 1 / scale, this.viewport);
    if (this.heatEnabled) for (const heat of this.heatAreas) heat.update(1, this.viewport);
  }

  dispose(): void {
    for (const marker of this.markers) marker.dispose();
    for (const heat of this.heatAreas) heat.dispose();
    this.layer.removeFromParent(true);
    this.heatLayer.removeFromParent(true);
    for (const location of [...this.locations, ...this.heatLocations]) location.dispose();
    this.markers.length =
      this.heatAreas.length =
      this.locations.length =
      this.heatLocations.length =
        0;
  }
}

/** Native anchors have no AS3 lifecycleId; observe reset without modifying native objects. */
export function installBossSpawnMarkers(api: API, game: Raw): void {
  const ui = new NativeUI(api),
    lives = new WeakMap<Raw, number>();
  const life = (object: Raw) => lives.get(object) ?? 0;
  const object = api.cls('core.GameObject')?.prototype;
  if (typeof object?.reset === 'function')
    api.before(object, 'reset', function () {
      lives.set(this, life(this) + 1);
    });
  let manager: BossSpawnMarkerManager | undefined;
  const ensureManager = () => {
    if (
      !manager &&
      game.initSolarSystemComplete &&
      game.canvasBodies &&
      game.bodyManager?.bodies &&
      game.dataManager
    )
      manager = new BossSpawnMarkerManager(ui, game, life);
    return manager;
  };
  const maps = new Map<
    Raw,
    {
      markers: BossSpawnMarker[];
      heat: MinibossSpawnHeat[];
      layer: Raw;
      heatLayer: Raw;
      legend?: Raw;
      scale: number;
      width: number;
      height: number;
    }
  >();
  const mapClass = api.cls('core.hud.components.map.Map');
  const disposeMap = (map: Raw) => {
    const state = maps.get(map);
    if (!state) return;
    for (const marker of state.markers) marker.dispose();
    for (const heat of state.heat) heat.dispose();
    state.layer.removeFromParent(true);
    state.heatLayer.removeFromParent(true);
    state.legend?.removeFromParent(true);
    maps.delete(map);
  };
  const drawMap = (map: Raw) => {
    const state = maps.get(map);
    if (!state || !manager) return;
    state.layer.set_visible(manager.enabled);
    state.heatLayer.set_visible(manager.heatEnabled);
    state.legend?.set_visible(manager.heatEnabled && state.heat.length > 0);
    if (manager.enabled) for (const marker of state.markers) marker.update(state.scale);
    const viewport = mapHeatViewport(map, state.width, state.height);
    if (manager.heatEnabled) for (const heat of state.heat) heat.update(state.scale, viewport);
  };
  if (typeof mapClass?.prototype.load === 'function')
    api.after(
      mapClass.prototype,
      'load',
      function (_result, _scale, width = 698, height = 538, padding = 31, _corner, pvp = false) {
        if (this.g !== game) return;
        disposeMap(this);
        const source = ensureManager();
        if (!source) return;
        const layer = ui.sprite(),
          heatLayer = ui.sprite();
        layer.set_touchable(false);
        heatLayer.set_touchable(false);
        this.mapContainer.addChildAt(heatLayer, 0);
        this.mapContainer.addChildAt(layer, 1);
        const markers = source.locations.map((location) => {
          const marker = new BossSpawnMarker(ui, location, true);
          layer.addChild(marker.node);
          return marker;
        });
        const heat = source.heatLocations.map((location) => {
          const area = new MinibossSpawnHeat(ui, location);
          heatLayer.addChild(area.node);
          return area;
        });
        let legend: Raw | undefined;
        if (!pvp) {
          const TextBitmap = ui.cls('core.hud.components.TextBitmap');
          legend = new TextBitmap(
            padding + 10,
            0,
            'Heatmap: potential miniboss areas • brighter where areas overlap',
            10,
          );
          legend!.set_y(padding + height - read(legend, 'height') - 30);
          legend!.get_format().set_color(0xe49a61);
          legend!.set_alpha(0.65);
          legend!.set_batchable(true);
          legend!.set_touchable(false);
          this.addChild(legend);
        }
        maps.set(this, {
          markers,
          heat,
          layer,
          heatLayer,
          legend,
          scale: mapClass.SCALE,
          width,
          height,
        });
        drawMap(this);
      },
    );
  if (typeof mapClass?.prototype.dispose === 'function')
    api.before(mapClass.prototype, 'dispose', function () {
      disposeMap(this);
    });
  if (typeof mapClass?.prototype.update === 'function')
    api.after(mapClass.prototype, 'update', function () {
      drawMap(this);
    });
  api.on('frame', ({ game: current }) => {
    if (current !== game) return;
    ensureManager()?.draw();
    for (const map of maps.keys()) if (read(map, 'stage')) drawMap(map);
  });
  api.defer(() => {
    for (const map of maps.keys()) disposeMap(map);
    manager?.dispose();
  });
}
