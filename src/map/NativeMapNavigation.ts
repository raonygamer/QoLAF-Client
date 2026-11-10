import { read, type API, type Raw } from '../api/Types';
import { NativeUI } from '../ui/NativeUI';
import { MapNavigation } from './MapNavigation';

interface MapView {
  map: Raw;
  viewport: Raw;
  hitArea: Raw;
  mask: Raw;
  oldMask: Raw;
  navigation: MapNavigation;
  scale: number;
  padding: number;
  corner: number;
  pointer: Raw;
  nativePointer: Raw;
  centerButton?: Raw;
  wheelStage?: Raw;
  onTouch: (event: Raw) => void;
  onWheel: (event: Raw) => void;
  attach: () => void;
  detach: () => void;
  cancel: () => void;
}
const views = new WeakMap<Raw, MapView>();
const navigating = new WeakSet<Raw>();

export function isMapNavigating(game: Raw): boolean {
  return navigating.has(game);
}

export function mapHeatViewport(map: Raw, width: number, height: number) {
  const view = views.get(map),
    zoom = view?.navigation.zoom ?? 1;
  const mask = read(map.mapContainer, 'mask');
  const left = view
    ? -read(map.mapContainer, 'x') / zoom
    : read(mask, 'x', -read(map.mapContainer, 'x'));
  const top = view
    ? -read(map.mapContainer, 'y') / zoom
    : read(mask, 'y', -read(map.mapContainer, 'y'));
  return { left, top, right: left + width / zoom, bottom: top + height / zoom };
}

/** Native Starling viewport and input adapter for the original source navigation. */
export function installMapNavigation(api: API, game: Raw): void {
  const MapClass = api.cls('core.hud.components.map.Map'),
    prototype = MapClass?.prototype;
  if (!prototype?.load || !prototype?.update) return;
  const ui = new NativeUI(api),
    owned = new Set<MapView>();
  let pointerView: MapView | undefined;
  const activate = (view: MapView) =>
    Object.assign(MapClass!, {
      SCALE: view.scale,
      WIDTH: view.navigation.width,
      HEIGHT: view.navigation.height,
      PADDING: view.padding,
      CORNER: view.corner,
    });
  const apply = (view: MapView) => {
    const container = view.map.mapContainer,
      nav = view.navigation;
    container.set_scaleX(nav.zoom);
    container.set_scaleY(nav.zoom);
    container.set_x(nav.x);
    container.set_y(nav.y);
  };
  const center = (view: MapView) => {
    view.centerButton?.set_enabled(true);
    view.cancel();
    view.navigation.followingPlayer = true;
    const player = view.map.mapPlayers.find((value: Raw) => read(value, 'isMe'));
    if (player) view.navigation.center(read(player, 'x'), read(player, 'y'));
    apply(view);
  };
  const drawPlayers = (view: MapView) => {
    for (const player of view.map.mapPlayers) {
      player.update();
      if (!read(player, 'isMe')) continue;
      const x = read(player, 'x'),
        y = read(player, 'y');
      view.navigation.follow(x, y);
      const coords = view.map.coords;
      coords.set_text(
        api.cls('generics.Localize')!.t('Current position:') +
          ' ' +
          Math.round(x) +
          ', ' +
          Math.round(y),
      );
      coords.set_x(view.padding + 10);
      coords.set_y(view.padding + view.navigation.height - read(coords, 'height') - 10);
    }
    apply(view);
  };
  const dispose = (view: MapView) => {
    view.detach();
    view.map.removeEventListener('addedToStage', view.attach);
    view.map.removeEventListener('removedFromStage', view.detach);
    view.viewport.removeEventListener('touch', view.onTouch);
    view.centerButton?.removeFromParent(true);
    // Return native-owned content before disposing only the added viewport.
    view.map.mapContainer.removeFromParent();
    view.map.addChild(view.map.mapContainer);
    view.map.mapContainer.set_mask(view.oldMask);
    view.map.mapContainer.set_scaleX(1);
    view.map.mapContainer.set_scaleY(1);
    view.viewport.set_mask(null);
    view.mask.dispose();
    view.viewport.removeFromParent(true);
    owned.delete(view);
    views.delete(view.map);
  };
  api.before(prototype, 'load', function () {
    const view = views.get(this);
    if (view) dispose(view);
  });
  api.after(
    prototype,
    'load',
    function (_result, _scale, width = 698, height = 538, padding = 31, corner = 10, pvp = false) {
      if (this.g !== game) return;
      const Point = ui.cls('openfl.geom.Point'),
        map = this,
        container = map.mapContainer;
      const viewport = ui.sprite(),
        hitArea = ui.quad(width, height, 0, 0),
        mask = ui.quad(width, height, 0);
      const oldMask = read(container, 'mask');
      const index = map.getChildIndex(container);
      container.set_mask(null);
      container.removeFromParent();
      viewport.set_x(padding);
      viewport.set_y(padding);
      viewport.addChild(hitArea);
      viewport.addChild(container);
      viewport.set_mask(mask);
      map.addChildAt(viewport, index);
      const view: MapView = {
        map,
        viewport,
        hitArea,
        mask,
        oldMask,
        navigation: new MapNavigation(width, height),
        scale: MapClass!.SCALE,
        padding,
        corner,
        pointer: new Point(),
        nativePointer: new Point(),
        onTouch: () => {},
        onWheel: () => {},
        attach: () => {},
        detach: () => {},
        cancel: () => {},
      };
      view.cancel = () => {
        if (pointerView === view) {
          pointerView = undefined;
          navigating.delete(game);
        }
        view.navigation.cancelPan();
      };
      view.onTouch = (event) => {
        if (!read(map, 'visible')) return;
        const nav = view.navigation,
          touch = event.getTouch(viewport, null, nav.dragTouchId);
        if (!touch) return;
        touch.getLocation(viewport, view.pointer);
        const phase = read(touch, 'phase'),
          id = read(touch, 'id');
        if (phase === 'began' && nav.dragTouchId < 0) {
          nav.begin(id, view.pointer.x, view.pointer.y);
          pointerView = view;
          navigating.add(game);
        } else if (id === nav.dragTouchId && (phase === 'moved' || phase === 'ended')) {
          nav.move(id, view.pointer.x, view.pointer.y);
          apply(view);
          if (phase === 'ended') {
            const recenter =
              !nav.panGestureActive &&
              read(touch, 'tapCount') === 2 &&
              read(event, 'target') === hitArea;
            view.cancel();
            if (recenter) center(view);
          }
        }
      };
      view.onWheel = (event) => {
        const stage = read(map, 'stage'),
          delta = read(event, 'delta');
        if (
          !read(map, 'visible') ||
          !stage ||
          !delta ||
          game.isLeaving ||
          api.cls('RymdenRunt')?.isInFocus === false ||
          read(event, 'target') !== view.wheelStage
        )
          return;
        const starling = read(stage, 'starling'),
          rect = read(starling, 'viewPort');
        if (!rect || rect.width <= 0 || rect.height <= 0) return;
        view.nativePointer.setTo(
          (read(stage, 'stageWidth') * (read(event, 'stageX') - rect.x)) / rect.width,
          (read(stage, 'stageHeight') * (read(event, 'stageY') - rect.y)) / rect.height,
        );
        const target = stage.hitTest(view.nativePointer);
        if (!target || !viewport.contains(target)) return;
        viewport.globalToLocal(view.nativePointer, view.pointer);
        const { x, y } = view.pointer;
        if (x < 0 || y < 0 || x >= width || y >= height) return;
        event.preventDefault();
        event.stopImmediatePropagation();
        view.navigation.wheel(delta, x, y);
        apply(view);
      };
      view.attach = () => {
        const starling = read(read(map, 'stage'), 'starling');
        if (view.wheelStage || !starling) return;
        const stage = read(starling, 'nativeStage');
        if (!stage) return;
        view.wheelStage = stage;
        stage.addEventListener('mouseWheel', view.onWheel, false, 1000);
        stage.addEventListener('deactivate', view.cancel);
      };
      view.detach = () => {
        view.wheelStage?.removeEventListener('mouseWheel', view.onWheel);
        view.wheelStage?.removeEventListener('deactivate', view.cancel);
        view.wheelStage = undefined;
        view.cancel();
      };
      if (!pvp) {
        const Button = ui.cls('core.hud.components.ButtonExpandableHud');
        view.centerButton = new Button(() => center(view), 'Center');
        view.centerButton!.set_x(
          read(map.closeButton, 'x') - read(view.centerButton, 'width') - 10,
        );
        view.centerButton!.set_y(read(map.closeButton, 'y'));
        map.addChild(view.centerButton);
      }
      views.set(map, view);
      owned.add(view);
      viewport.addEventListener('touch', view.onTouch);
      map.addEventListener('addedToStage', view.attach);
      map.addEventListener('removedFromStage', view.detach);
      center(view);
      view.attach();
    },
  );
  api.around(prototype, 'update', function (next, ...args) {
    const view = views.get(this);
    if (!view) return next(...args);
    activate(view);
    for (const key of ['mapBodies', 'pvpZones', 'mapSpawners', 'mapBosses'])
      for (const item of this[key]) item.update();
    drawPlayers(view);
    this.mapLastKilled.update();
  });
  api.around(prototype, 'playerJoined', function (next, ...args) {
    if (this.g !== game) return next(...args);
    const view = views.get(this);
    // The PvP map can receive joins before its first load. That load enumerates
    // the current players itself; do not append a marker to an unready map.
    if (!view) return;
    activate(view);
    return next(...args);
  });
  api.before(prototype, 'dispose', function () {
    const view = views.get(this);
    if (view) dispose(view);
  });
  const body = api.cls('core.hud.components.map.MapBodyBase')?.prototype;
  if (typeof body?.click === 'function')
    api.around(body, 'click', function (next, event) {
      for (const view of owned) {
        if (!view.viewport.contains(this.layer)) continue;
        const nav = view.navigation;
        if (
          nav.cancelledTouchId >= 0 &&
          event.getTouch(view.viewport, 'ended', nav.cancelledTouchId)
        )
          return;
        if (nav.dragTouchId >= 0) {
          const touch = event.getTouch(view.viewport, null, nav.dragTouchId);
          if (touch) {
            touch.getLocation(view.viewport, view.pointer);
            nav.detectPan(view.pointer.x, view.pointer.y);
          }
        }
        if (nav.panGestureActive) return;
      }
      return next(event);
    });
  // Do not steer the ship with the pointer while it belongs to a map gesture.
  const play = api.cls('core.states.gameStates.PlayState')?.prototype;
  for (const method of ['updateAimAngle', 'updateMouseAim', 'updateMouseIntegrator'])
    if (typeof play?.[method] === 'function')
      api.around(play, method, function (next, ...args) {
        if (
          this.g === game &&
          pointerView?.navigation.dragTouchId !== undefined &&
          pointerView.navigation.dragTouchId >= 0
        )
          return;
        return next(...args);
      });
  api.on('frame', ({ game: current }) => {
    if (current !== game) return;
    for (const view of owned)
      if (read(view.map, 'stage')) {
        activate(view);
        drawPlayers(view);
      }
  });
  api.defer(() => {
    for (const view of owned) dispose(view);
  });
}
