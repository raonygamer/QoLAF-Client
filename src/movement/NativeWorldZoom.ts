import { installZoomFilterCache } from '../rendering/ZoomFilterCache';
import type {} from '../game/InitialWorld';
import type {} from '../game/GameRecovery';
import type {} from '../game/LoadingCover';
import type { API } from '../api/Types';
import { GameReflection } from '../api/GameReflection';
import { DomOverlay, GameScene, Login, PlayState, Point, RoamingState } from '../game/Bindings';
import type { DeviceSettings } from '../settings/DeviceSettings';
import { WorldZoom } from './WorldZoom';

/** World-only wheel zoom; native HUD, popups, radar and text inputs retain scrolling. */
export function installNativeWorldZoom(
  api: API,
  game: GameScene,
  preferences?: DeviceSettings,
): void {
  const reflection = new GameReflection(api);
  installZoomFilterCache(api, game);
  let owner: PlayState | undefined;
  const removals = new Map<PlayState, () => void>();
  const zoom = new WorldZoom(
    () => game.get_me()?.zoom ?? 1,
    (value) => {
      const player = game.get_me();
      if (!player) return;
      player.zoom = value;
      game.camera?.zoomFocus(value, 4);
    },
    (value) => preferences?.set('cameraZoom', value),
    () => preferences?.flush(),
    () => !!owner && (owner.keybinds.isInputDown(27) || owner.keybinds.isInputDown(28)),
  );
  const unwatch = (state: PlayState) => {
    const removed = removals.get(state);
    if (removed) state.container.removeEventListener('removedFromStage', removed);
    removals.delete(state);
    if (owner === state) {
      zoom.dispose();
      owner = undefined;
    }
  };
  const watch = (state: PlayState) => {
    owner = state;
    if (removals.has(state)) return;
    const removed = () => unwatch(state);
    removals.set(state, removed);
    state.container.addEventListener('removedFromStage', removed);
  };
  let restored = false;
  const restore = (force = false, frames = 4) => {
    if ((restored && !force) || !game.get_me()) return;
    restored = true;
    const player = game.get_me()!;
    player.zoom = WorldZoom.clamp(preferences?.get('cameraZoom') ?? player.zoom);
    game.camera?.zoomFocus(player.zoom, frames);
  };
  reflection.around(PlayState.prototype, 'checkZoom', function (next) {
    if (this.g !== game) return next();
    watch(this);
    restore();
    zoom.keyboard(this.keybinds.isInputDown(27), this.keybinds.isInputDown(28));
  });
  reflection.after(RoamingState.prototype, 'enter', function () {
    if (this.g === game) restore(true, 1);
  });
  reflection.before(PlayState.prototype, 'exit', function () {
    if (this.g === game) unwatch(this);
  });
  const onWheel = (event: WheelEvent) => {
    if (!event.deltaY || event.defaultPrevented || document.hidden || !document.hasFocus()) return;
    const focused = document.activeElement;
    if (
      focused instanceof HTMLElement &&
      (focused.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(focused.tagName))
    )
      return;
    const state: unknown = game.gameStateMachine?.currentState;
    const player = game.get_me();
    const ship = player?.ship;
    const canvas = game.canvas;
    const stage = game.get_stage();
    if (
      GameScene.instance !== game ||
      !(state instanceof RoamingState) ||
      !state.container.get_stage() ||
      !state.get_loaded() ||
      game.get_isLeaving() ||
      !game.get_connected() ||
      !game.serviceConnection?.get_connected() ||
      game.get_isRecoveringGameConnection() ||
      !game.get_initialWorldIsRevealed() ||
      game.blockHotkeys ||
      !game.get_visible() ||
      game.get_alpha() <= 0 ||
      !game.camera ||
      !canvas?.get_visible() ||
      !stage ||
      Login.fadeScreen?.get_isCoverVisible() ||
      !player?.get_commandable() ||
      player.isLanded ||
      player.get_isWarpJumping() ||
      !ship?.alive ||
      ship.isTeleporting ||
      !ship.stateMachine?.inState('Roaming')
    )
      return;
    const css = DomOverlay.toCss({
      x: 0,
      y: 0,
      width: stage.get_stageWidth(),
      height: stage.get_stageHeight(),
    });
    if (!css || css.width <= 0 || css.height <= 0) return;
    const point = new Point(
      ((event.clientX - css.x) * stage.get_stageWidth()) / css.width,
      ((event.clientY - css.y) * stage.get_stageHeight()) / css.height,
    );
    if (
      point.x < 0 ||
      point.y < 0 ||
      point.x >= stage.get_stageWidth() ||
      point.y >= stage.get_stageHeight()
    )
      return;
    const hit = stage.hitTest(point);
    if (!hit || (hit !== stage && hit !== canvas && !canvas.contains(hit))) return;
    const radar = game.hud?.radar;
    if (game.hud?.get_show() && radar?.get_visible() && radar.get_stage()) {
      const local = radar.globalToLocal(point);
      if (local.x >= 0 && local.y >= 0 && local.x < radar.radius * 2 && local.y < radar.radius * 2)
        return;
    }
    event.preventDefault();
    event.stopImmediatePropagation();
    restore();
    watch(state);
    zoom.wheel(event.deltaY);
  };
  // Bubble phase lets native controls and capture-phase popup handlers consume first.
  window.addEventListener('wheel', onWheel, { passive: false });
  api.defer(() => {
    window.removeEventListener('wheel', onWheel);
    for (const state of removals.keys()) unwatch(state);
    zoom.dispose();
  });
}
